# Data Model Migration Rules (Post-February 2026)

**Status:** ✅ Active (following February 2026 migration)
**Applies To:** All code touching bracket/match data

---

## Collection Usage

### The Two-Collection System

Following the February 2026 migration, match data is split across TWO collections with distinct purposes:

| Collection | Purpose | Owner | Update Frequency | Access Pattern |
|------------|---------|-------|------------------|----------------|
| `/match` | Bracket structure | brackets-manager | Write-once | READ ONLY (except via brackets-manager API) |
| `/match_scores` | Operational data | Application | Frequent | Read/Write freely |

### ❌ REMOVED Collection

- `/matches` - **DELETED** (do not reference, was legacy collection)

---

## Collection Responsibilities

### `/match` - Bracket Structure

**What it stores:**
- Bracket layout (stages, groups, rounds)
- Match progression (which match feeds into which)
- Opponent positions (participant seeding)
- Match numbers and bracket positions

**Owned by:** brackets-manager library
**Path:** `/tournaments/{id}/match` (server) or `/tournaments/{id}/categories/{id}/_data/match` (client)

**Access Rules:**
- ✅ **READ:** Anytime to get bracket structure
- ✅ **WRITE:** Only via brackets-manager API (BracketsManager.create, BracketsManager.update)
- ❌ **NEVER:** Direct Firestore writes outside brackets-manager

**Schema Example:**
```typescript
{
  id: "0",                    // String ID
  stage_id: "0",              // String ID
  round_id: "0",              // String ID
  group_id: "0",              // String ID
  number: 1,                  // Match number in round
  status: 2,                  // Numeric: 0=Locked, 1=Waiting, 2=Ready, 3=Running, 4=Completed
  opponent1: {
    id: 1,                    // Participant ID (seeding position)
    position: 1,
    result: "win" | "loss"
  },
  opponent2: { /* same */ }
}
```

---

### `/match_scores` - Operational Data

**What it stores:**
- Match scores (game-by-game)
- Match status (for UI display)
- Court assignments
- Scheduling information
- Winner ID (registration ID)
- Timestamps (started, completed)

**Owned by:** Courtmaster application
**Path:** `/tournaments/{id}/match_scores`

**Access Rules:**
- ✅ **READ:** Anytime
- ✅ **WRITE:** Freely via application code
- ✅ **UPDATE:** Use `.set(data, { merge: true })` to preserve existing fields

**Schema Example:**
```typescript
{
  // Document ID = match ID from /match collection
  status: "in_progress",      // String: "scheduled" | "ready" | "in_progress" | "completed"
  scores: [
    { game: 1, player1: 21, player2: 15 },
    { game: 2, player1: 21, player2: 18 }
  ],
  courtId: "court1",
  scheduledTime: Timestamp,
  startedAt: Timestamp,
  completedAt: Timestamp,
  winnerId: "registrationId123",  // Registration ID of winner
  sequence: 1                     // Scheduling sequence number
}
```

---

## ID Type Consistency

**Rule:** All IDs stored as **strings** in Firestore

### Client Adapter
**File:** `src/services/brackets-storage.ts`
- Converts all IDs to strings via `String(value.id)`
- Ensures consistency with server

### Server Adapter
**File:** `functions/src/storage/firestore-adapter.ts`
- Already uses string IDs
- Client now matches server behavior

### Verification
```typescript
// CORRECT
stage_id: "0"     // String
round_id: "0"     // String
group_id: "0"     // String

// WRONG (pre-migration)
stage_id: 0       // Number
round_id: 0       // Number
```

---

## Status Handling

### Dual Status System

There are TWO status fields with different purposes:

| Field | Type | Purpose | Source of Truth |
|-------|------|---------|----------------|
| `/match.status` | number (0-4) | brackets-manager internal state | brackets-manager |
| `/match_scores.status` | string | UI display and app logic | Application |

### Status Values

**`/match.status` (numeric):**
- `0` = Locked (not ready to play)
- `1` = Waiting (waiting for previous match)
- `2` = Ready (both opponents known, can be scheduled)
- `3` = Running (in progress)
- `4` = Completed (finished)

**`/match_scores.status` (string):**
- `"scheduled"` = Has court and time assigned
- `"ready"` = Ready to start (participants known)
- `"in_progress"` = Currently being played
- `"completed"` = Finished with scores

### Conversion Function

**File:** `src/stores/bracketMatchAdapter.ts`

```typescript
function convertBracketsStatus(bracketsStatus: number): MatchStatus {
  switch (bracketsStatus) {
    case 0: case 1: return 'scheduled';
    case 2: return 'ready';
    case 3: return 'in_progress';
    case 4: return 'completed';
    default: return 'scheduled';
  }
}
```

### UI Display Rule

**Always use `/match_scores.status` when available:**

```typescript
// src/stores/matches.ts
const adapted = adaptBracketsMatchToLegacyMatch(bMatch, ...);

// Override with match_scores status if it exists
if (scoreData?.status) {
  adapted.status = scoreData.status;  // match_scores takes precedence
}
```

---

## Cloud Functions

### updateMatch

**File:** `functions/src/updateMatch.ts`

**Collections Used:**
- **READ:** `/match` (to get opponent IDs)
- **WRITE:** `/match` (via brackets-manager API)
- **WRITE:** `/match_scores` (scores and status)

**Pattern:**
```typescript
// 1. Update operational data
await db.collection('match_scores').doc(matchId).set({
  scores, status, winnerId, ...
}, { merge: true });

// 2. Update bracket structure via brackets-manager
const manager = new BracketsManager(new FirestoreStorage(...));
await manager.update.match({ id: matchId, ... });
```

---

### generateSchedule

**File:** `functions/src/scheduling.ts`

**Collections Used:**
- **READ:** `/match` (to get matches needing scheduling)
- **WRITE:** `/match_scores` (court and time assignments)

**Pattern:**
```typescript
// Read matches from brackets-manager collection
const matches = await db
  .collection('match')
  .where('status', 'in', [0, 1, 2])  // Numeric status
  .get();

// Write scheduling to match_scores
const scoreRef = db.collection('match_scores').doc(matchId);
await batch.set(scoreRef, {
  courtId, scheduledTime, sequence
}, { merge: true });
```

**⚠️ Never write to `/match`** - brackets-manager owns that structure

---

### advanceWinner

**File:** `functions/src/index.ts`

**Collections Used:**
- **READ:** `/match` (via brackets-manager)
- **WRITE:** `/match` (via brackets-manager API)

**Pattern:**
```typescript
const manager = new BracketsManager(new FirestoreStorage(...));

// Fetch match to get opponent IDs
const match = await manager.storage.select('match', matchId);

// Update with winner - brackets-manager handles advancement
await manager.update.match({
  id: matchId,
  opponent1: { result: isOpponent1Winner ? 'win' : 'loss' },
  opponent2: { result: isOpponent2Winner ? 'win' : 'loss' }
});
```

**Benefits:**
- brackets-manager automatically advances winner
- Handles single/double elimination
- Updates next match opponents

---

## Never Do These Things

### ❌ Don't Write Directly to `/match`

```typescript
// WRONG - bypasses brackets-manager
await db.collection('match').doc(matchId).update({
  opponent1: { result: 'win' }
});

// CORRECT - use brackets-manager API
const manager = new BracketsManager(new FirestoreStorage(...));
await manager.update.match({
  id: matchId,
  opponent1: { result: 'win' }
});
```

---

### ❌ Don't Reference `/matches`

```typescript
// WRONG - legacy collection removed
await db.collection('matches').doc(matchId).get();

// CORRECT - use /match or /match_scores
await db.collection('match').doc(matchId).get();
await db.collection('match_scores').doc(matchId).get();
```

---

### ❌ Don't Mix Numeric and String IDs

```typescript
// WRONG - inconsistent types
const stageId = 0;  // Number
await db.collection('match').where('stage_id', '==', stageId);

// CORRECT - always use strings
const stageId = "0";  // String
await db.collection('match').where('stage_id', '==', stageId);
```

---

### ❌ Don't Update Bracket Structure Outside Generation

```typescript
// WRONG - manual bracket modification
await db.collection('match').doc('new-match-id').set({
  stage_id: "0",
  round_id: "1",
  // ...
});

// CORRECT - regenerate bracket via brackets-manager
const manager = new BracketsManager(...);
await manager.create({
  name: "Tournament",
  tournamentId: categoryId,
  type: "single_elimination",
  seeding: participantIds
});
```

---

## Code Examples

### Fetching Match Data

```typescript
// Get bracket structure
const matchDoc = await db.collection('match').doc(matchId).get();
const matchData = matchDoc.data();

// Get operational data
const scoresDoc = await db.collection('match_scores').doc(matchId).get();
const scoresData = scoresDoc.data();

// Merge for UI display
const displayMatch = {
  ...matchData,
  scores: scoresData?.scores || [],
  status: scoresData?.status || convertBracketsStatus(matchData.status),
  courtId: scoresData?.courtId,
  scheduledTime: scoresData?.scheduledTime
};
```

---

### Updating Match Score

```typescript
// Only update match_scores collection
await db.collection('match_scores').doc(matchId).set({
  scores: newScores,
  status: "in_progress",
  startedAt: admin.firestore.FieldValue.serverTimestamp()
}, { merge: true });

// Don't touch /match - brackets-manager owns it
```

---

### Completing a Match

```typescript
// 1. Update operational data
await db.collection('match_scores').doc(matchId).set({
  scores: finalScores,
  status: "completed",
  winnerId: registrationId,
  completedAt: admin.firestore.FieldValue.serverTimestamp()
}, { merge: true });

// 2. Update bracket and advance winner via Cloud Function
// (updateMatch Cloud Function handles brackets-manager update)
```

---

## Adapter Path Differences

### Client: Category-Isolated Paths

**Path:** `/tournaments/{id}/categories/{id}/_data/{table}`

**Reason:** Multi-category tournaments need separate brackets

**Example:**
```
/tournaments/tour1/categories/cat1/_data/match/
/tournaments/tour1/categories/cat2/_data/match/
```

### Server: Tournament-Scoped Paths

**Path:** `/tournaments/{id}/{table}`

**Reason:** Cloud Functions operate on tournament scope

**Example:**
```
/tournaments/tour1/match/
/tournaments/tour1/match_scores/
```

**Note:** Both approaches are valid and intentional.

---

## Real-Time Subscriptions

**File:** `src/stores/matches.ts`

### Subscribe to Both Collections

```typescript
// Subscribe to bracket structure changes
const qMatch = collection(db, `tournaments/${tournamentId}/categories/${categoryId}/_data/match`);
const unsubMatch = onSnapshot(qMatch, () => refresh());

// Subscribe to operational data changes
const qScores = collection(db, `tournaments/${tournamentId}/match_scores`);
const unsubScores = onSnapshot(qScores, () => refresh());

// Clean up both subscriptions
return () => {
  unsubMatch();
  unsubScores();
};
```

**Why Both?**
- `/match` changes when bracket regenerated or structure updated
- `/match_scores` changes when scores updated, courts assigned, status changed

---

## Migration History

**Completed:** February 2026
**Duration:** ~6 days

### What Changed
1. Client adapter now uses string IDs (matches server)
2. advanceWinner uses `/match` + brackets-manager API
3. generateSchedule reads `/match`, writes `/match_scores`
4. `/matches` collection and rules completely removed
5. All code references to `/matches` removed

### Files Modified
- `src/services/brackets-storage.ts`
- `functions/src/index.ts`
- `functions/src/scheduling.ts`
- `firestore.rules`

**Full Details:** See [Migration Summary](SUMMARY.md)

---

## Quick Reference

| Task | Collection | Method |
|------|------------|--------|
| Generate bracket | `/match` | brackets-manager API |
| Read bracket structure | `/match` | Direct read |
| Assign court | `/match_scores` | Direct write (merge) |
| Update scores | `/match_scores` | Direct write (merge) |
| Advance winner | `/match` | brackets-manager API |
| Schedule matches | `/match_scores` | Direct write (merge) |
| Get match for UI | Both | Read and merge |

---

**Document Maintained By:** Development Team
**Last Updated:** February 2026
