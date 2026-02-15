# Courtmaster Data Model Quick Reference

**One-page summary for developers**

**KEY FACT: No production data exists - migration is code-only (~1 week)**

---

## The Two Collections Rule

| Collection | Purpose | Updated By | Status Format |
|------------|---------|------------|---------------|
| `/match` | Bracket structure | BracketService only | Numeric (0-4) |
| `/match_scores` | Operational data | Scoring, Scheduling | String |

**REMOVED:** ~~`/matches`~~ - Do NOT use this collection

---

## Collection Details

### `/match` (brackets-manager)
```typescript
{
  id: string,              // "0", "1", "2"...
  stage_id: string,
  group_id: string,
  round_id: string,
  number: number,          // Position in round
  status: number,          // 0=Locked, 1=Waiting, 2=Ready, 3=Running, 4=Completed
  opponent1: { id: number, result?: 'win'|'loss' },
  opponent2: { id: number, result?: 'win'|'loss' }
}
```

### `/match_scores` (custom)
```typescript
{
  // Document ID = match ID from /match
  status: string,          // "scheduled", "ready", "in_progress", "completed"
  scores: GameScore[],     // Array of game scores
  courtId?: string,        // Assigned court
  scheduledTime?: Date,    // Scheduled start
  startedAt?: Date,
  completedAt?: Date,
  winnerId?: string        // Registration ID
}
```

---

## Key Rules

### 1. All IDs are STRINGS
```typescript
// CORRECT
id: "1", stage_id: "0"

// WRONG
id: 1, stage_id: 0
```

### 2. Use `bracketMatchAdapter` to merge data
```typescript
// The adapter combines /match + /match_scores
const adapted = adaptBracketsMatchToLegacyMatch(bracketsMatch, registrations, categoryId, tournamentId);
```

### 3. Status source of truth
- **UI displays:** `/match_scores.status` (string)
- **Bracket progression uses:** `/match.status` (number)

### 4. Never write to /matches
```typescript
// WRONG - legacy collection
db.collection('tournaments').doc(id).collection('matches')

// CORRECT - bracket structure
db.collection('tournaments').doc(id).collection('match')

// CORRECT - operational data
db.collection('tournaments').doc(id).collection('match_scores')
```

---

## Status Mapping

| brackets-manager | Custom String | Meaning |
|------------------|---------------|---------|
| 0 | "scheduled" | Locked/Waiting |
| 1 | "scheduled" | Waiting for participants |
| 2 | "ready" | Both participants known |
| 3 | "in_progress" | Match started |
| 4 | "completed" | Match finished |

---

## Service Responsibilities

| Service | Reads | Writes |
|---------|-------|--------|
| **BracketService** | /registrations | /stage, /group, /round, /match, /participant |
| **ScoringService** | /match | /match_scores |
| **SchedulingService** | /match, /courts | /match_scores |

---

## Common Patterns

### Reading a match with scores
```typescript
// 1. Get bracket data
const matchDoc = await getDoc(doc(db, `tournaments/${tid}/match`, matchId));
const bracketsMatch = matchDoc.data();

// 2. Get operational data
const scoreDoc = await getDoc(doc(db, `tournaments/${tid}/match_scores`, matchId));
const scoreData = scoreDoc.data();

// 3. Merge (or use adapter)
const match = {
  ...adaptBracketsMatch(bracketsMatch),
  status: scoreData?.status || 'scheduled',
  scores: scoreData?.scores || [],
  courtId: scoreData?.courtId,
};
```

### Completing a match
```typescript
// 1. Write scores to match_scores
await setDoc(doc(db, `tournaments/${tid}/match_scores`, matchId), {
  scores,
  winnerId,
  status: 'completed',
  completedAt: serverTimestamp(),
}, { merge: true });

// 2. Update bracket (via Cloud Function or brackets-manager)
await updateMatchFn({ tournamentId, matchId, status: 'completed', winnerId });
```

### Scheduling a match
```typescript
// Write ONLY to match_scores
await setDoc(doc(db, `tournaments/${tid}/match_scores`, matchId), {
  courtId,
  scheduledTime: Timestamp.fromDate(time),
  status: 'ready',
}, { merge: true });
```

---

## File Locations

| Purpose | File |
|---------|------|
| Client Firestore adapter | `src/services/brackets-storage.ts` |
| Server Firestore adapter | `functions/src/storage/firestore-adapter.ts` |
| Match adapter | `src/stores/bracketMatchAdapter.ts` |
| Match store | `src/stores/matches.ts` |
| Bracket generator (client) | `src/composables/useBracketGenerator.ts` |
| Bracket generator (server) | `functions/src/bracket.ts` |
| Scheduling (client) | `src/composables/useMatchScheduler.ts` |
| Scheduling (server) | `functions/src/scheduling.ts` |
| Update match CF | `functions/src/updateMatch.ts` |

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|--------------|-----|
| Winner doesn't advance | ID type mismatch | Check both adapters use string IDs |
| Status shows wrong | Reading from wrong collection | Ensure /match_scores.status used for UI |
| Schedule doesn't appear | Writing to /matches | Update to write to /match_scores |
| Real-time not updating | Missing subscription | Add onSnapshot for /match_scores |

---

**Full documentation:** `docs/architecture/DATA_MODEL_ARCHITECTURE.md`
