# 150+ Player Tournament - Architecture Decision Document

**Date:** January 30, 2026  
**Status:** Decision Required  
**Prepared by:** AI Development Assistant

---

## Executive Summary

This document compares three approaches to handle tournaments with 150+ participants (500+ matches):

| Approach | Timeline | Risk | Cost | Effort |
|----------|----------|------|------|--------|
| **Fix for Now** (quick patches) | 1-2 weeks | Low | $0 | Low |
| **Incremental Refresh** (phased) | 6-8 weeks | Medium | +$170-300/mo | High |
| **Big Bang Rewrite** (all at once) | 4-6 weeks | **Very High** | +$170-300/mo | **Very High** |

**Current system will FAIL at 150 players** due to Firestore batch limits and query constraints.

---

## Current System Breakdown Points

### What Will Fail at 150+ Players

| Component | Breaks At | Why | Impact |
|-----------|-----------|-----|--------|
| **Bracket Generation** | 100-120 players | 500 write batch limit | ❌ Can't create tournament |
| **Match Queries** | 10 categories | `where('in', ...)` limit (10 items) | ❌ Can't load matches |
| **Real-time Updates** | 50+ concurrent | Heavy refresh pattern (O(N²)) | 🐌 UI freezes, $$$ costs |
| **Public Scores** | Any size | No subscription to `/match_scores` | 📉 Stale data |
| **Multi-scorers** | 2+ scorers | No transactions | 💥 Data corruption |

**150 players = ~500 matches (double elimination)**

---

## Option 1: Fix for Now (1-2 Weeks)

### What You Get
- ✅ Bracket generation works (move to Cloud Function)
- ✅ Match queries work (add pagination)
- ✅ Real-time scores (add subscription)
- ✅ No infrastructure changes
- ✅ Tournament can proceed

### Technical Changes

```typescript
// 1. Move bracket generation to Cloud Function
// File: src/stores/tournaments.ts
// Change: Call generateBracket CF instead of client-side

// 2. Add pagination
// File: src/stores/matches.ts
const matchesQuery = query(
  collection(db, 'match'),
  limit(20),  // Add this
  startAfter(lastDoc)  // Add cursor
);

// 3. Add real-time subscription to scores
// File: src/stores/matches.ts
onSnapshot(doc(db, 'match_scores', matchId), (doc) => {
  updateScore(doc.data());
});
```

### Files to Change: ~5
1. `src/stores/tournaments.ts` - Use CF for generation
2. `src/stores/matches.ts` - Add pagination + subscriptions
3. `functions/src/bracket.ts` - Add chunked writes
4. `src/features/public/views/PublicLiveScoresView.vue` - Subscribe to scores
5. Firestore indexes - Add composite indexes

### Cost: $0
Uses existing Firebase infrastructure only.

### Limitations
- ⚠️ Still has 3 match collections (technical debt remains)
- ⚠️ No caching (1000 viewers = expensive Firestore reads)
- ⚠️ No Redis (race conditions with multiple scorers)
- ⚠️ Will need full architecture refresh later
- ⚠️ Not optimized for 1000+ concurrent viewers

### When to Choose This
- Tournament is in < 1 month
- Budget is constrained
- Need immediate fix
- Willing to accept technical debt

---

## Option 2: Incremental Refresh (6-8 Weeks)

### What You Get
- ✅ Everything in "Fix for Now" PLUS:
- ✅ Unified data model (2 collections only)
- ✅ Redis caching (supports 1000+ viewers)
- ✅ CDN for public views
- ✅ Transaction-based scoring (no race conditions)
- ✅ Optimized for 500+ matches
- ✅ Scalable to 500+ players

### Target Architecture

```
CURRENT (3 collections, messy)
/match (brackets-manager schema)
/matches (legacy operational data)
/match_scores (scores + scheduling)
↓
TARGET (2 collections, clean)
/match (bracket structure only)
/match_scores (operational data + scores)
```

### Phase Breakdown

#### Phase 1: Infrastructure (Week 1-2)
- Set up Redis (Cloud Memorystore)
- Set up Cloud CDN
- Add monitoring (Cloud Trace)
- Cost: +$100-150/mo

#### Phase 2: Data Model (Week 3-4)
- Migrate `/matches` to `/match_scores`
- Add denormalized fields to `/match`
- Create composite indexes
- Dual-write period (safety)
- Files: ~10 files changed

#### Phase 3: API Layer (Week 5-6)
- Add pagination everywhere
- Implement cursor-based queries
- Add field-level subscriptions
- Replace heavy refresh pattern
- Files: ~15 files changed

#### Phase 4: Optimization (Week 7-8)
- Add Redis caching layer
- CDN integration for public views
- Load testing
- Performance tuning
- Files: ~5 files changed

### Total Changes
- **Files Modified**: ~20-25
- **New Infrastructure**: Redis, CDN
- **Collections Migrated**: 1 (`/matches` → `/match_scores`)
- **Collections Removed**: 1 (`/matches`)

### Infrastructure Additions

```yaml
Firestore: 
  Standard (no change)

Cloud Functions:
  - Memory: 256MB → 512MB
  - Concurrency: 80 → 200
  - Cost: +$30-50/mo

Redis (Cloud Memorystore):
  - Tier: Basic M2
  - Size: 5GB
  - Cost: +$50-75/mo

Cloud CDN:
  - Cache: Bracket snapshots, static assets
  - Cost: +$20-30/mo

Monitoring:
  - Cloud Trace
  - Cloud Logging
  - Cost: +$20/mo

TOTAL ADDITIONAL: +$170-300/month
```

### Migration Strategy (Safe)

```
Week 1-2:  Set up infrastructure
           Start dual-write to old + new collections
           
Week 3-4:  Switch reads to new collections
           Monitor for issues
           
Week 5-6:  Backfill existing tournaments
           Validate data integrity
           
Week 7-8:  Remove old collections
           Clean up code
           Celebrate!
```

### When to Choose This
- Tournament is in 2-3 months
- Multiple tournaments per year
- Need 500+ player support
- Budget available for infrastructure
- Want scalable long-term solution

---

## Option 3: Big Bang Rewrite (NOT RECOMMENDED)

### Why This Exists
Some teams prefer to "rip the band-aid off" and rebuild everything at once.

### Why NOT to Choose This
1. **❌ Tournament Downtime**: Can't run any tournaments during 4-6 week rewrite
2. **❌ All-or-Nothing**: If something breaks, everything breaks
3. **❌ No Learning**: Can't test with real data incrementally
4. **❌ High Stress**: Pressure to fix issues quickly without rollback
5. **❌ Risk of Data Loss**: Migration in one shot is dangerous

### Timeline: 4-6 Weeks (Full Downtime)
- Week 1-2: Rewrite core data layer
- Week 3-4: Rewrite all UI components
- Week 5-6: Testing (hope it works!)

### Verdict
**Never do this for production tournament software.** The risk is unacceptable.

---

## Detailed Comparison

### Effort Breakdown (Developer Days)

| Task | Fix Now | Incremental | Big Bang |
|------|---------|-------------|----------|
| Bracket generation fix | 2 days | 3 days | 3 days |
| Pagination implementation | 2 days | 5 days | 5 days |
| Real-time subscriptions | 2 days | 3 days | 3 days |
| Data model migration | - | 10 days | 10 days |
| Redis integration | - | 5 days | 5 days |
| CDN setup | - | 3 days | 3 days |
| Testing | 2 days | 10 days | 10 days |
| Documentation | 1 day | 3 days | 3 days |
| **TOTAL** | **9 days** | **42 days** | **42 days** |

### Risk Assessment

| Risk | Fix Now | Incremental | Big Bang |
|------|---------|-------------|----------|
| Data loss | Low | Low | **High** |
| Downtime | None | Minimal (<1 hour) | **Days-Weeks** |
| Rollback ability | Easy | Easy | **Impossible** |
| User impact | None | Minimal | **Severe** |
| Team stress | Low | Medium | **High** |
| Budget overrun | Low | Medium | **High** |

### Scalability Comparison

| Metric | Fix Now | Incremental | Big Bang |
|--------|---------|-------------|----------|
| Max players | 150-200 | 500+ | 500+ |
| Max viewers | 100-200 | 1000+ | 1000+ |
| Real-time scores | ✅ | ✅✅✅ | ✅✅✅ |
| Multi-scorers | ⚠️ | ✅✅✅ | ✅✅✅ |
| CDN caching | ❌ | ✅ | ✅ |
| Race condition safe | ❌ | ✅ | ✅ |

---

## Decision Matrix

Choose based on your situation:

| Your Situation | Recommended Approach |
|----------------|---------------------|
| Tournament in < 2 weeks | **Fix for Now** |
| Tournament in 1 month | **Fix for Now** |
| Tournament in 2-3 months | **Incremental** |
| Budget constrained ($0 extra) | **Fix for Now** |
| Need 500+ player support | **Incremental** |
| Multiple tournaments/year | **Incremental** |
| Proof of concept/MVP | **Fix for Now** |
| Enterprise/production system | **Incremental** |
| Have DevOps resources | **Incremental** |
| Small team, limited time | **Fix for Now** |

---

## Cost Analysis

### Fix for Now
```
Monthly Cost: $0 (existing Firebase plan)
One-time: Developer time (9 days)
```

### Incremental Refresh
```
Monthly Cost: +$170-300
Breakdown:
  - Redis: $50-75
  - CDN: $20-30
  - Cloud Functions: $30-50
  - Monitoring: $20
  - Additional Firestore: $50-100

One-time: Developer time (42 days)
```

### Cost vs Benefit

| Metric | Fix Now | Incremental |
|--------|---------|-------------|
| Monthly cost | $0 | +$200 |
| Max players | 150 | 500+ |
| Viewer capacity | 200 | 1000+ |
| Cost per 1000 viewers | $50-100 | $5-10 |
| **Verdict** | Expensive at scale | Cheaper at scale |

**Break-even**: If you have >3 tournaments/year with 200+ viewers, Incremental pays for itself.

---

## Next Steps

### If You Choose "Fix for Now":

**Week 1:**
- [ ] Move bracket generation to Cloud Function
- [ ] Add chunked batch writes
- [ ] Test with 150 player bracket

**Week 2:**
- [ ] Add pagination to match lists
- [ ] Add real-time score subscriptions
- [ ] Test public views
- [ ] Deploy to production

**I'll implement this immediately.**

---

### If You Choose "Incremental":

**Week 1-2 (Infrastructure):**
- [ ] Set up Redis instance
- [ ] Set up Cloud CDN
- [ ] Add monitoring
- [ ] Create migration plan

**Week 3-4 (Data Model):**
- [ ] Implement dual-write
- [ ] Add denormalized fields
- [ ] Create indexes
- [ ] Backfill data

**Week 5-6 (API Layer):**
- [ ] Add pagination
- [ ] Add field-level subscriptions
- [ ] Remove heavy refresh

**Week 7-8 (Optimization):**
- [ ] Add Redis caching
- [ ] CDN integration
- [ ] Load testing
- [ ] Performance tuning

**I'll create detailed Phase 1 plan immediately.**

---

## Questions to Decide

1. **When is your next tournament?**
   - < 1 month → Fix for Now
   - 1-3 months → Incremental

2. **What's your budget?**
   - $0 extra → Fix for Now
   - $200/mo available → Incremental

3. **How many tournaments per year?**
   - 1-2 → Fix for Now
   - 3+ → Incremental

4. **Max expected players?**
   - < 150 → Fix for Now
   - 150-500 → Incremental

5. **Do you have DevOps resources?**
   - No → Fix for Now
   - Yes → Incremental

---

## My Recommendation

**If you have a tournament in < 1 month:**
👉 **Choose "Fix for Now"**
- Get tournament working
- Accept technical debt
- Plan Incremental for after tournament

**If your tournament is 2-3 months away:**
👉 **Choose "Incremental"**
- Do it right the first time
- Scalable for future growth
- Lower long-term costs

**Never choose Big Bang.**

---

## Appendix

### A. Current Architecture Issues

See `ARCHITECTURE_ANALYSIS.md` for detailed current state analysis.

### B. Target Architecture Diagram

See full architecture diagram in main analysis document.

### C. Migration Runbook

Detailed migration steps available upon approach selection.

### D. Infrastructure Setup Guides

- Redis setup
- CDN configuration
- Monitoring setup

Available upon request.

---

**Document Version**: 1.0  
**Last Updated**: January 30, 2026  
**Decision Deadline**: [Pending]

**Ready to implement either approach. What's your decision?**
