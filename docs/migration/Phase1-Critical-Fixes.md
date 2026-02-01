# Phase 1: Critical Fixes

**Duration:** Days 1-3 | **Status:** 🔄 In Progress

---

## Overview

Fix the 4 critical bugs that break core functionality:
1. ID type mismatch between client and server
2. advanceWinner using wrong collection
3. generateSchedule using wrong collection
4. Firestore rules for removed collection

---

## Prerequisites

- [ ] Git working directory is clean
- [ ] Pre-migration commit hash recorded: _______________
- [ ] Backup branch created: `git checkout -b pre-migration-backup`
- [ ] Firebase emulator installed and working

---

## Step 1.1: Unify ID Types ⏱️ 2 hours

**Goal:** Make client adapter use string IDs to match server adapter

**File:** [src/services/brackets-storage.ts](../../src/services/brackets-storage.ts)

### Tasks

- [ ] Open [src/services/brackets-storage.ts](../../src/services/brackets-storage.ts)
- [ ] Locate `normalizeReferences` method (around line 46-68)
- [ ] Apply changes to lines 55-57 and 64

<details>
<summary><strong>📝 Code Changes</strong></summary>

**Line 55-57 - Change from:**
```typescript
// Keep as is (number)
normalized[key] = value.id;
```

**To:**
```typescript
// Convert to string (match server adapter)
normalized[key] = String(value.id);
```

**Line 64 - Change from:**
```typescript
normalized[key] = value;
```

**To:**
```typescript
normalized[key] = String(value);
```

</details>

### Verification

- [ ] Save the file
- [ ] Run build: `npm run build`
- [ ] Start Firebase emulator: `firebase emulators:start`
- [ ] Generate a bracket in the app
- [ ] Open Firestore emulator UI: http://localhost:4000/firestore
- [ ] Navigate to `/tournaments/{id}/categories/{id}/_data/match`
- [ ] Verify: `stage_id`, `round_id`, `group_id` are strings (e.g., "0" not 0)

<details>
<summary><strong>✅ Expected Result</strong></summary>

In Firestore emulator, a match document should look like:
```json
{
  "id": "0",           // String, not number
  "stage_id": "0",     // String, not number
  "round_id": "0",     // String, not number
  "group_id": "0",     // String, not number
  "number": 1,
  "status": 2,
  "opponent1": { "id": 1 },
  "opponent2": { "id": 2 }
}
```

</details>

### Commit

```bash
git add src/services/brackets-storage.ts
git commit -m "fix: unify ID types to strings in client adapter

- Convert all ID references to strings in normalizeReferences()
- Ensures consistency with server adapter (firestore-adapter.ts)
- Fixes winner advancement ID comparison issues

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

### Rollback

```bash
git checkout HEAD~1 -- src/services/brackets-storage.ts
npm run build
```

---

## Step 1.2: Fix advanceWinner Cloud Function ⏱️ 4 hours

**Goal:** Change advanceWinner to use `/match` collection instead of `/matches`

**File:** [functions/src/index.ts](../../functions/src/index.ts)

### Current Issue

Lines 131-186 read from `/matches` collection (legacy, doesn't exist)

### Tasks

- [ ] Open [functions/src/index.ts](../../functions/src/index.ts)
- [ ] Locate `advanceWinner` function (around line 110-200)
- [ ] Choose implementation approach (Option A recommended)
- [ ] Apply code changes
- [ ] Build functions: `cd functions && npm run build`

<details>
<summary><strong>📝 Option A: Use brackets-manager API (RECOMMENDED)</strong></summary>

**Approach:** Let brackets-manager handle winner advancement automatically.

**Replace entire `advanceWinner` function with:**

```typescript
export const advanceWinner = onCall(async (request) => {
  const { tournamentId, matchId, winnerId } = request.data;

  console.log('advanceWinner called:', { tournamentId, matchId, winnerId });

  try {
    // Initialize brackets-manager with tournament root path
    const manager = new BracketsManager(
      new FirestoreStorage(`tournaments/${tournamentId}`)
    );

    // Fetch current match to get opponent IDs
    const match = await manager.storage.select('match', matchId);
    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    const opponent1Id = String(match.opponent1?.id ?? '');
    const opponent2Id = String(match.opponent2?.id ?? '');

    // Determine winner result
    const isOpponent1Winner = winnerId === opponent1Id;
    const isOpponent2Winner = winnerId === opponent2Id;

    if (!isOpponent1Winner && !isOpponent2Winner) {
      console.warn('Winner ID does not match any opponent', {
        winnerId,
        opponent1Id,
        opponent2Id
      });
    }

    // Update match with winner - brackets-manager handles advancement
    await manager.update.match({
      id: matchId,
      opponent1: {
        result: isOpponent1Winner ? 'win' : 'loss'
      },
      opponent2: {
        result: isOpponent2Winner ? 'win' : 'loss'
      }
    });

    console.log('Match updated successfully, winner advanced');
    return { success: true };
  } catch (error) {
    console.error('Error advancing winner:', error);
    throw new HttpsError('internal', `Failed to advance winner: ${error.message}`);
  }
});
```

**Benefits:**
- Simpler code
- Leverages brackets-manager's built-in advancement logic
- Handles single/double elimination automatically
- Less prone to bugs

</details>

<details>
<summary><strong>📝 Option B: Manual /match Collection Updates</strong></summary>

**Approach:** Manually update `/match` collection references.

**Replace lines 131-136:**
```typescript
// Before
const matchDoc = await db
  .collection('tournaments').doc(tournamentId)
  .collection('matches')  // WRONG
  .doc(matchId).get();

// After
const matchDoc = await db
  .collection('tournaments').doc(tournamentId)
  .collection('match')  // CORRECT
  .doc(matchId).get();
```

**Update all other references in the function:**
- Change all `.collection('matches')` to `.collection('match')`
- Update field references from legacy schema to brackets-manager schema
- Replace `nextMatchId` logic with brackets-manager queries

**Note:** This approach is more error-prone. Option A is recommended.

</details>

### Verification

- [ ] Build functions: `cd functions && npm run build`
- [ ] Deploy function: `firebase deploy --only functions:advanceWinner`
- [ ] Test in emulator:
  - [ ] Generate a bracket
  - [ ] Complete a Round 1 match
  - [ ] Call advanceWinner or use UI to complete match
  - [ ] Verify winner appears in Round 2 match
- [ ] Check Cloud Function logs: `firebase functions:log --only advanceWinner`
  - [ ] Verify logs show `/match` reads, NOT `/matches`

<details>
<summary><strong>✅ Expected Behavior</strong></summary>

1. Complete Match 1 (Round 1) with Winner = Participant #1
2. Check Firestore `/match` collection
3. Round 2, Match 1 should have `opponent1.id = 1`
4. Function logs should show "Match updated successfully, winner advanced"
5. No errors about `/matches` collection

</details>

### Commit

```bash
cd functions
npm run build
cd ..

git add functions/src/index.ts functions/lib/
git commit -m "fix: advanceWinner uses /match collection and brackets-manager API

- Replace legacy /matches collection with /match
- Use BracketsManager API for automatic winner advancement
- Handles single and double elimination brackets
- Fixes bracket progression issues

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

### Rollback

```bash
git checkout HEAD~1 -- functions/src/index.ts
cd functions && npm run build
firebase deploy --only functions:advanceWinner
```

---

## Step 1.3: Fix generateSchedule Cloud Function ⏱️ 4 hours

**Goal:** Change generateSchedule to read from `/match` and write to `/match_scores`

**File:** [functions/src/scheduling.ts](../../functions/src/scheduling.ts)

### Current Issues

- Lines 67-74: Reads from `/matches` (wrong collection)
- Lines 101-112: Writes to `/matches` (wrong collection)
- Uses string status values instead of numeric

### Tasks

- [ ] Open [functions/src/scheduling.ts](../../functions/src/scheduling.ts)
- [ ] Update collection references (lines 67-74)
- [ ] Update write operations (lines 101-112)
- [ ] Update status filtering
- [ ] Build functions: `cd functions && npm run build`

<details>
<summary><strong>📝 Code Changes: Read Operations (lines 67-74)</strong></summary>

**Change from:**
```typescript
const matchesSnapshot = await db
  .collection('tournaments').doc(tournamentId)
  .collection('matches')  // WRONG - legacy collection
  .where('status', 'in', ['scheduled', 'ready'])  // String status
  .orderBy('round').orderBy('matchNumber')
  .get();
```

**To:**
```typescript
const matchesSnapshot = await db
  .collection('tournaments').doc(tournamentId)
  .collection('match')  // CORRECT - brackets-manager collection
  .where('status', 'in', [0, 1, 2])  // Numeric status (0=locked, 1=waiting, 2=ready)
  .get();
```

**Note:** Remove `.orderBy()` if it causes issues with brackets-manager data structure.

</details>

<details>
<summary><strong>📝 Code Changes: Write Operations (lines 101-112)</strong></summary>

**Change from:**
```typescript
const matchRef = db
  .collection('tournaments').doc(tournamentId)
  .collection('matches').doc(slot.matchId);

batch.update(matchRef, {
  courtId: slot.courtId,
  scheduledTime: slot.time,
  status: 'scheduled',
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
});
```

**To:**
```typescript
const scoreRef = db
  .collection('tournaments').doc(tournamentId)
  .collection('match_scores').doc(slot.matchId);

batch.set(scoreRef, {
  courtId: slot.courtId,
  scheduledTime: slot.time,
  sequence: slot.sequence,
  updatedAt: admin.firestore.FieldValue.serverTimestamp()
}, { merge: true });  // Use merge to preserve existing scores
```

**Important:** Don't write to `/match` - brackets-manager owns that data.

</details>

### Verification

- [ ] Build functions: `cd functions && npm run build`
- [ ] Deploy function: `firebase deploy --only functions:generateSchedule`
- [ ] Test in emulator:
  - [ ] Generate a bracket
  - [ ] Create 2 courts
  - [ ] Call generateSchedule Cloud Function (or use client UI)
  - [ ] Check Firestore `/match_scores` collection
    - [ ] Each match_scores doc has `courtId` and `scheduledTime`
  - [ ] Verify NO documents in `/matches` collection
  - [ ] Client app displays scheduled matches correctly

<details>
<summary><strong>✅ Expected Result</strong></summary>

**Firestore `/match_scores` collection should have:**
```json
{
  "courtId": "court1",
  "scheduledTime": { "_seconds": 1234567890, "_nanoseconds": 0 },
  "sequence": 1,
  "updatedAt": { "_seconds": 1234567890, "_nanoseconds": 0 }
}
```

**Firestore `/matches` collection should:**
- Not exist or be empty

**Client UI should:**
- Display matches with court assignments
- Show scheduled times

</details>

### Commit

```bash
cd functions
npm run build
cd ..

git add functions/src/scheduling.ts functions/lib/
git commit -m "fix: generateSchedule reads /match and writes /match_scores

- Read matches from /match (brackets-manager) instead of /matches (legacy)
- Write scheduling data to /match_scores (operational) instead of /matches
- Use numeric status values (0,1,2) for brackets-manager compatibility
- Fixes scheduling Cloud Function to work with new architecture

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

### Rollback

```bash
git checkout HEAD~1 -- functions/src/scheduling.ts
cd functions && npm run build
firebase deploy --only functions:generateSchedule
```

---

## Step 1.4: Delete /matches Collection Rules ⏱️ 30 min

**Goal:** Remove Firestore security rules for `/matches` collection

**File:** [firestore.rules](../../firestore.rules)

### Tasks

- [ ] Open [firestore.rules](../../firestore.rules)
- [ ] Locate `/matches` rules (lines 76-84)
- [ ] Delete the entire section
- [ ] Deploy rules

<details>
<summary><strong>📝 Code to Remove (lines 76-84)</strong></summary>

**Delete this entire block:**
```javascript
// Matches subcollection
match /matches/{matchId} {
  allow read: if true;
  // Admins can create matches (bracket generation)
  allow create: if isAuthenticated();
  // Scorekeepers can update scores, admins can update anything
  allow update: if isScorekeeper() || isAdmin();
  allow delete: if isAdmin();
}
```

**Note:** Since there's no production data, we can delete immediately.

</details>

### Verification

- [ ] Save firestore.rules
- [ ] Deploy rules: `firebase deploy --only firestore:rules`
- [ ] Verify deployment succeeds
- [ ] Test that app still works (read/write to `/match` and `/match_scores`)

### Commit

```bash
git add firestore.rules
git commit -m "fix: remove /matches collection security rules

- Remove rules for legacy /matches collection
- Collection has been replaced with /match and /match_scores
- No data migration needed (no production data exists)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

### Rollback

```bash
git checkout HEAD~1 -- firestore.rules
firebase deploy --only firestore:rules
```

---

## Phase 1 Complete Checklist

- [ ] Step 1.1: ID types unified ✅
- [ ] Step 1.2: advanceWinner fixed ✅
- [ ] Step 1.3: generateSchedule fixed ✅
- [ ] Step 1.4: /matches rules removed ✅
- [ ] All functions deployed successfully
- [ ] Integration test: Generate bracket → Schedule → Complete match → Winner advances
- [ ] No errors in Cloud Function logs
- [ ] No references to `/matches` in running code

---

## Rollback: Full Phase 1

If Phase 1 needs to be completely rolled back:

```bash
# Find all Phase 1 commits
git log --oneline -10

# Revert entire phase (replace with actual commit hashes)
git revert <step-1.4-hash> <step-1.3-hash> <step-1.2-hash> <step-1.1-hash>

# Rebuild and redeploy
npm run build
cd functions && npm run build && cd ..
firebase deploy
```

---

## Next Steps

When Phase 1 is complete:
- Proceed to [Phase 2: Code Cleanup](Phase2-Code-Cleanup.md)
- Update [MASTER_PLAN.md](MASTER_PLAN.md) progress tracking

---

**Phase 1 Sign-Off**

- Completed By: _______________
- Date: ___/___/___
- Issues Encountered: _______________
