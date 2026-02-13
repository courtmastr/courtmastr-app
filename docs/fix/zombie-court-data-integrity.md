# Fix: Zombie Court Data Integrity

> **Status**: Specification  
> **Priority**: High  
> **Root Cause**: Court state (`status`, `currentMatchId`) and match state (`courtId`) are a **bidirectional relationship stored as two independent single links**. When one side breaks (e.g., `match_scores.courtId` is missing or cleared), the other side (`court.currentMatchId`) is never cleaned up, leaving the court permanently stuck in `in_use`.

---

## 1. Problem Description

A court becomes a **"Zombie Court"** when:

1. A match record in `match_scores/{matchId}` loses its `courtId` field (due to a failed write, race condition, or manual DB edit).
2. The corresponding court document at `courts/{courtId}` still has `currentMatchId` pointing to that match and `status: 'in_use'`.
3. When the match completes (or is walked-over, reset, delayed, etc.), the code tries to read `match_scores.courtId` to release the court — but finds nothing.
4. **Result**: The court stays `in_use` forever, unusable until manually cleared.

### Data Model — The Bidirectional Link

```
┌─────────────────────────┐           ┌─────────────────────────┐
│  match_scores/{matchId} │           │    courts/{courtId}     │
│                         │ ──────▶   │                         │
│  courtId: "court-abc"   │  Link A   │  currentMatchId: "m-42" │ ◀── Link B
│  status: "in_progress"  │           │  status: "in_use"       │
└─────────────────────────┘           └─────────────────────────┘
```

**If Link A breaks**, Link B is never cleaned up → **Zombie Court**.

---

## 2. Current State — What's Already Fixed

The `completeMatch()` function in `src/stores/matches.ts` (line 590) **already has a 3-tier fallback** for finding `courtId`:

| Priority | Source | Code |
|----------|--------|------|
| 1st | `match_scores` doc field | `matchData?.courtId` |
| 2nd | In-memory match data | `currentMatch.value?.courtId` or `matches.value.find(...)` |
| 3rd | **Reverse lookup** on courts | `query(courtsRef, where('currentMatchId', '==', matchId))` |

This pattern is the **reference implementation**. It should be replicated everywhere.

---

## 3. Vulnerable Functions — What Still Needs Fixing

The following functions release courts using **only a single link** (`match_scores.courtId`). If that link is missing, the court is never released.

### 3.1. `recordWalkover()` — `src/stores/matches.ts` (line 723)

**Current behavior**: Reads `courtId` from `match_scores` doc only:
```typescript
const courtId = matchData?.courtId;  // Single link — no fallback!
```

**Required change**: Add the same 3-tier fallback chain from `completeMatch()`.

---

### 3.2. `releaseCourtManual()` — `src/stores/tournaments.ts` (line 539)

**Current behavior**: Only clears the court document fields. Does **not** also clear the match side (`match_scores.courtId`), which can cause ghost references.

```typescript
async function releaseCourtManual(tournamentId, courtId) {
  await updateDoc(courtDoc, {
    status: 'available',
    currentMatchId: null,
    assignedMatchId: null,
    // ❌ Does NOT clear match_scores.courtId for the linked match
  });
}
```

**Required change**: Before clearing the court, read the court's `currentMatchId`. If it exists, also clear `courtId` from the corresponding `match_scores` document. Search across all categories' `match_scores` subcollections for a doc with that `courtId`.

---

### 3.3. `delayMatch()` — `src/stores/matches.ts` (line ~1100)

**Current behavior**: Uses in-memory `matches.value.find(m => m.id === matchId)?.courtId` to release the court:
```typescript
if (match?.courtId) {
  batch.update(courtDoc, { status: 'available', currentMatchId: null });
}
```

**Required change**: Add reverse-lookup fallback: if `match?.courtId` is null, query `courts` collection for `where('currentMatchId', '==', matchId)` and release any found court.

---

### 3.4. `resetMatch()` — `src/stores/matches.ts` (line 795)

**Current behavior**: Only resets the `match_scores` document. Does **not** release the court at all — even if a court was assigned.

```typescript
async function resetMatch(tournamentId, matchId, categoryId) {
  await setDoc(matchScoresDoc, {
    scores: [], winnerId: null, status: 'scheduled', ...
  }, { merge: true });
  // ❌ Court is never released!
}
```

**Required change**:
1. Before resetting, read `match_scores.courtId` (with fallback to reverse lookup).
2. If a court is found, release it (set `status: 'available'`, `currentMatchId: null`).

---

### 3.5. `scheduleSingleMatch()` — `src/composables/useMatchScheduler.ts` (line 296)

**Current behavior**: When scheduling a match to a new court, it sets the new court to `in_use` but does **not** check if the match was previously assigned to a different court.

```typescript
async function scheduleSingleMatch(..., courtId, ...) {
  // Sets match_scores.courtId = newCourtId
  // Sets newCourt.currentMatchId = matchId, status = 'in_use'
  // ❌ If match was on OLD court, old court stays in_use forever!
}
```

**Required change**: Before assigning the new court, read the match's current `courtId`. If it exists and differs from the new `courtId`, release the old court first.

---

## 4. Additional Hardening — Orphan Check Utility

Create a reusable utility function to centralize the court-finding logic and prevent future drift.

### 4.1. New helper: `findCourtForMatch()`

**File**: `src/stores/matches.ts` (or a new shared utility file)

```typescript
/**
 * Finds the courtId associated with a match using a 3-tier lookup:
 * 1. match_scores document (primary link)
 * 2. In-memory match data (reactive state)
 * 3. Reverse lookup on courts collection (fallback)
 *
 * Returns the courtId or null if no court is found.
 */
async function findCourtForMatch(
  tournamentId: string,
  matchId: string,
  categoryId?: string
): Promise<string | null>
```

**Implementation**:
1. Read `match_scores/{matchId}` doc → check `courtId` field
2. If null, check `currentMatch.value?.courtId` (if `id` matches)
3. If null, check `matches.value.find(m => m.id === matchId)?.courtId`
4. If null, query `courts` collection: `where('currentMatchId', '==', matchId)`
5. Return the `courtId` or `null`

All functions in Section 3 should call this helper instead of duplicating the lookup logic.

---

### 4.2. New helper: `releaseCourtSafe()`

```typescript
/**
 * Safely releases a court by ID. Also clears the match_scores.courtId
 * for the match that was linked to this court (bidirectional cleanup).
 */
async function releaseCourtSafe(
  tournamentId: string,
  courtId: string,
  matchId?: string,
  categoryId?: string
): Promise<void>
```

**Implementation**:
1. Update court doc: `{ status: 'available', currentMatchId: null, assignedMatchId: null, lastFreedAt, updatedAt }`
2. If `matchId` + `categoryId` provided, clear `courtId` from `match_scores/{matchId}` (set to `null`)
3. Log the release for debugging

All court-release logic in Sections 2-3 should call this helper.

---

## 5. Periodic Orphan Scan (Optional Enhancement)

Add a function that can be called from the Match Control UI (e.g., a "Health Check" button on the Court Status Board) to detect and fix zombie courts:

### `scanAndFixOrphanCourts()`

**File**: `src/stores/tournaments.ts`

```typescript
/**
 * Scans all courts for orphan states:
 * - Court has currentMatchId but referenced match is completed/cancelled
 * - Court is in_use but no match references it
 * Returns a list of courts that were auto-fixed.
 */
async function scanAndFixOrphanCourts(
  tournamentId: string
): Promise<{ fixed: string[]; issues: string[] }>
```

**Algorithm**:
1. Get all courts where `status === 'in_use'`
2. For each, read `currentMatchId`
3. Search all categories' `match_scores` for a document with `id === currentMatchId`
4. If no match found, OR match `status` is `completed`/`walkover`/`cancelled` → release the court
5. Return summary of fixes

---

## 6. Files to Modify

| File | Changes |
|------|---------|
| `src/stores/matches.ts` | Extract `findCourtForMatch()` + `releaseCourtSafe()` helpers. Refactor `completeMatch()`, `recordWalkover()`, `resetMatch()`, `delayMatch()` to use them. |
| `src/stores/tournaments.ts` | Update `releaseCourtManual()` to do bidirectional cleanup. Add optional `scanAndFixOrphanCourts()`. |
| `src/composables/useMatchScheduler.ts` | Update `scheduleSingleMatch()` to release old court before assigning new one. |
| `src/features/tournaments/components/CourtStatusBoard.vue` | *(Optional)* Add "Health Check" button that invokes `scanAndFixOrphanCourts()`. |

---

## 7. Firestore Paths Reference

These are the collection paths used by the court/match relationship:

```
tournaments/{tournamentId}/courts/{courtId}
  → Fields: status, currentMatchId, assignedMatchId, lastFreedAt, updatedAt

tournaments/{tournamentId}/categories/{categoryId}/match_scores/{matchId}
  → Fields: courtId, status, scores, winnerId, startedAt, completedAt, updatedAt
```

> **Note**: `match_scores` lives under each category, so reverse lookups from court → match must search across **all categories** if `categoryId` is not known.

---

## 8. Testing Strategy

1. **Manual test — Simulate zombie court**:
   - Assign a match to a court (court shows `in_use`)
   - Via Firebase console, delete the `courtId` field from the match's `match_scores` document
   - Complete the match via the UI
   - Verify the court returns to `available` (via the reverse lookup)

2. **Manual test — Walkover zombie**:
   - Same setup: assign match, delete `courtId` from `match_scores`
   - Record a walkover
   - Verify court is released

3. **Manual test — Reset match zombie**:
   - Assign match to court, start the match
   - Reset the match via UI
   - Verify court is released

4. **Manual test — Release court manual**:
   - Assign a match to a court
   - Use the "Release Court" menu option on the Court Status Board
   - Verify the `match_scores.courtId` is also cleared (check Firebase console)

5. **Optional — Health check scan**:
   - Create a zombie court (set court `currentMatchId` to a non-existent match ID in Firebase console)
   - Run the orphan scan
   - Verify it auto-fixes the court
