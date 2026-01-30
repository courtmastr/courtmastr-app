# Tournament Organizer App - Cost-Effective Architecture Decision

**Date:** January 30, 2026  
**Status:** Decision Made  
**Use Case:** 150+ players, 8-9 categories, single scorer per game, organizer-focused (no public viewers)

---

## Executive Summary

**Decision:** Use "Fix for Now" approach with Firebase Spark (free) tier

**Rationale:**
- Single scorer per game eliminates race condition concerns
- No public viewers eliminates read-cost scaling issues  
- 150 players × 8-9 categories fits within Firebase free tier limits
- Cloud Function bracket generation already supports chunked writes

**Cost:** $0/month (Firebase Spark plan)

**Timeline:** 1 week of development

---

## Why This Approach Works for Your Use Case

### Your Constraints Are Actually Advantages

| "Typical" Tournament App | Your Tournament App |
|-------------------------|---------------------|
| Multiple scorers per match | Single scorer per match ✅ |
| 1000+ public viewers | Organizer-only ✅ |
| Need Redis for race conditions | No race conditions ✅ |
| CDN required for scale | No CDN needed ✅ |
| $200+/month infrastructure | $0/month ✅ |

### Firebase Free Tier Analysis

**Spark Plan Limits:**
```
Firestore:
  - Reads: 50,000/day
  - Writes: 20,000/day  
  - Deletes: 20,000/day
  - Storage: 1GB

Cloud Functions:
  - Invocations: 125,000/month
  - Execution time: 60 seconds
  - Memory: 256MB

Hosting:
  - Storage: 1GB
  - Bandwidth: 10GB/month
```

**Your Estimated Usage:**

```
Tournament Day (peak load):
- Bracket generation: ~5,000 writes (one-time)
- Score updates: ~20,000 writes (500 matches × 40 points)
- Match status updates: ~1,000 writes
- Total: ~26,000 writes

⚠️ This exceeds daily limit if all in one day!

BUT: Spread across 2-3 days:
- Day 1: Bracket generation (5,000 writes)
- Day 2-3: Tournament (20,000 writes/day)
✅ Within limits
```

**Mitigation if hitting limits:**
1. Enable Firestore usage alerts at 80%
2. If approaching limits, upgrade to Blaze (pay-as-you-go)
3. Blaze cost for your usage: ~$5-10/month

---

## Technical Changes Required

### 1. Fix Bracket Generation (CRITICAL)

**Problem:** Client-side generation hits 500 batch write limit at ~100 players

**Solution:** Use existing Cloud Function

```typescript
// File: src/stores/tournaments.ts
// Change: Call Cloud Function instead of client-side generation

async function generateBracket(tournamentId: string, categoryId: string) {
  const generateBracketFn = httpsCallable(functions, 'generateBracket');
  await generateBracketFn({ tournamentId, categoryId });
}
```

**Cloud Function already supports:**
- Chunked writes (no 500 limit)
- Proper error handling
- Automatic retry logic

### 2. Fix Category Query Limit (CRITICAL)

**Problem:** `where('stage_id', 'in', stageIds)` fails at >10 categories

**Solution:** Use collection group query or multiple parallel queries

```typescript
// File: src/stores/matches.ts
// Current (breaks at 10 categories):
const matchSnap = await getDocs(query(
  collection(db, `tournaments/${tournamentId}/match`),
  where('stage_id', 'in', stageIds)  // ❌ Max 10 items
));

// Fixed (works for any number of categories):
const matchQueries = stageIds.map(stageId => 
  query(
    collection(db, `tournaments/${tournamentId}/match`),
    where('stage_id', '==', stageId)
  )
);
const matchSnaps = await Promise.all(matchQueries.map(q => getDocs(q)));
const matches = matchSnaps.flatMap(snap => snap.docs);
```

### 3. Add Real-Time Score Subscription (NICE-TO-HAVE)

**Problem:** Scoring interface doesn't see live updates

**Solution:** Subscribe to `/match_scores`

```typescript
// File: src/stores/matches.ts
function subscribeMatchScores(tournamentId: string) {
  const q = collection(db, `tournaments/${tournamentId}/match_scores`);
  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'modified') {
        updateLocalScore(change.doc.id, change.doc.data());
      }
    });
  });
}
```

**Note:** Less critical since single scorer, but improves UX

---

## Files to Modify

| File | Change | Effort |
|------|--------|--------|
| `src/stores/tournaments.ts` | Use CF for bracket generation | 2 hrs |
| `src/stores/matches.ts` | Fix query limit + add subscriptions | 4 hrs |
| `src/composables/useBracketGenerator.ts` | Deprecate/remove client generation | 2 hrs |
| Firestore indexes | Add composite indexes | 1 hr |
| Testing | Test with 150 player bracket | 4 hrs |
| **Total** | | **~13 hours** |

---

## What You DON'T Need to Build

| Feature | Why Not Needed | Savings |
|---------|---------------|---------|
| Redis caching | Single scorer = no race conditions | $50-75/mo |
| CDN | No public viewers | $20-30/mo |
| WebSocket service | Firestore real-time sufficient | $50-100/mo |
| Read replicas | Low read volume | $30-50/mo |
| Complex transactions | Single writer per match | Dev time |
| **Total Savings** | | **$150-255/mo + dev time** |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Hit Firestore daily limits | Low | Medium | Enable alerts; upgrade to Blaze ($5-10/mo) if needed |
| Bracket generation fails | Low | High | Use Cloud Function with chunked writes |
| Query limit exceeded | Medium | High | Fix implemented (parallel queries) |
| Single point of failure | Low | Medium | Cloud Functions auto-scale |
| Data inconsistency | Low | Medium | Single scorer eliminates race conditions |

---

## Migration Path (If You Grow)

If you later need:
- **Multiple scorers per match** → Add Redis for optimistic locking
- **Public live scores** → Add CDN + caching layer
- **500+ players** → Implement pagination + data bundles
- **Real-time leaderboards** → Add WebSocket service

**These can be added incrementally without rewriting the core system.**

---

## Implementation Checklist

### Week 1: Critical Fixes

**Day 1-2: Bracket Generation**
- [ ] Switch to Cloud Function bracket generation
- [ ] Test with 150 player bracket
- [ ] Remove client-side generation code
- [ ] Add error handling for CF failures

**Day 3-4: Query Limits**
- [ ] Fix `where('in', ...)` queries
- [ ] Add parallel query pattern
- [ ] Test with 8-9 categories
- [ ] Add Firestore composite indexes

**Day 5: Real-Time (Optional)**
- [ ] Add `/match_scores` subscription
- [ ] Test live score updates
- [ ] Verify no memory leaks

**Weekend: Testing**
- [ ] Load test with 150 players
- [ ] Simulate tournament day
- [ ] Monitor Firestore usage

---

## Cost Comparison

| Approach | Monthly Cost | Setup Time | Max Players | Best For |
|----------|-------------|------------|-------------|----------|
| **This Approach** | **$0** | **1 week** | **150-200** | **Your use case** |
| Incremental Refresh | $170-300 | 6-8 weeks | 500+ | Multiple scorers, public viewers |
| Big Bang Rewrite | $170-300 | 4-6 weeks | 500+ | Never recommended |

---

## Final Recommendation

**Proceed with "Fix for Now" approach.**

Your specific constraints (single scorer, no public viewers, 150 players) make the expensive solutions unnecessary. Firebase free tier can handle your load with minimal changes.

**Key insight:** The architecture documents assumed a typical tournament app with multiple scorers and public viewers. Your use case is simpler and cheaper to support.

**Next step:** Implement the 3 critical fixes above. Test with a simulated 150-player tournament. Monitor Firestore usage. Upgrade to Blaze plan only if you hit daily limits.

---

## Questions Answered

**Q: Will 8-9 categories work with the query limit?**  
A: Yes, with the fix (parallel queries instead of `where('in', ...)`).

**Q: What if I hit Firestore daily limits during the tournament?**  
A: Upgrade to Blaze plan ($5-10/month for your usage). No code changes needed.

**Q: Can I add multiple scorers later?**  
A: Yes, but you'll need Redis for race condition handling. Can be added incrementally.

**Q: What about offline support?**  
A: Firestore has built-in offline persistence. Enable it for the scorer's device.

---

**Document Version:** 1.0  
**Last Updated:** January 30, 2026  
**Next Review:** After tournament testing
