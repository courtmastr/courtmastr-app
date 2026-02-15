# Phase 7c: Match Scoring and Winner Advancement Fixes

**Status:** ✅ **COMPLETE**
**Priority:** CRITICAL - Matches can't complete, winners can't advance
**Complexity:** MEDIUM - Multiple interconnected issues
**Actual Time:** ~2 hours
**Created:** 2026-02-02
**Completed:** 2026-02-02

---

## Executive Summary

Phase 7c fixes critical issues preventing match completion and winner advancement in tournament brackets:

1. **Winner ID Mismatch**: Opponent registration IDs were incorrectly extracted (using numeric participant.id instead of participant.name)
2. **Cloud Function Path Error**: Missing categoryId in path caused "Match not found" 500 errors
3. **Winners Not Advancing**: Failed cloud function prevented bracket updates

**Impact:**
- Matches could be scored but not completed ❌
- Winners couldn't advance to next rounds ❌
- Cloud function returned 500 errors ❌
- Brackets didn't update after match completion ❌

**Solution:**
- Fix opponent ID extraction to use match.participant1Id/participant2Id (already correct from adapter)
- Add categoryId to cloud function call and update path
- Update cloud function to accept categoryId and use correct Firestore path
- All fixes maintain Phase 7b participant ID architecture

---

## Problem Statement

### Issue 1: Winner Registration ID Mismatch

**Console Error:**
```
[completeMatch] Winner registration ID did not match bracket opponents {
  matchId: '0',
  winnerId: 'Wa08X2yYAZjyS3fySMi8',           // ← Correct registration ID from UI
  opponent1Id: 1,                              // ← Wrong: numeric participant ID
  opponent2Id: 8,                              // ← Wrong: numeric participant ID
  opponent1RegistrationId: '1',                // ← Wrong: stringified participant.id
  opponent2RegistrationId: '8'                 // ← Wrong: stringified participant.id
}
```

**User Impact:**
- User enters match scores and clicks "SAVE SCORES"
- Error appears: "Failed to save scores"
- Match remains in "ready" or "in_progress" status
- Winner cannot be determined
- Match doesn't complete

**Root Cause:**

The `completeMatch` function was extracting opponent registration IDs incorrectly:

```typescript
// BUGGY CODE - Getting numeric participant ID
const opponent1RegistrationId = String(match.opponent1?.id);  // Gets 1, 8, etc.
const opponent2RegistrationId = String(match.opponent2?.id);
```

**Why This is Wrong:**
- `match.opponent1.id` contains the numeric brackets-manager participant ID (1, 2, 3...)
- But `winnerId` from the UI is a registration ID like 'Wa08X2yYAZjyS3fySMi8'
- Comparing `'Wa08X2yYAZjyS3fySMi8'` === `'1'` fails
- Winner validation check fails, preventing completion

**The Architecture (from Phase 7b):**
- `participant.id` = Numeric brackets-manager ID (1, 2, 3...)
- `participant.name` = Registration ID (Firestore doc ID like 'Wa08X2yYAZjyS3fySMi8')
- `match.participant1Id` = **Already contains correct registration ID** (from bracketMatchAdapter)

---

### Issue 2: Cloud Function Returns 500 Error

**Console Error:**
```
POST http://localhost:5001/demo-courtmaster/us-central1/updateMatch 500 (Internal Server Error)
[completeMatch] Cloud function failed: FirebaseError: Match not found
```

**User Impact:**
- Even if winner validation passes, cloud function fails
- Match status doesn't update to "completed"
- Winner doesn't advance to next round in bracket
- Bracket visualization doesn't update

**Root Cause:**

The cloud function was being called without `categoryId`:

```typescript
// BUGGY CODE - Missing categoryId
await updateMatch({
  tournamentId: match.tournamentId,
  matchId: match.id,
  winnerId,
  scores: match.scores,
});
```

The cloud function then looked for the match at:
```
tournaments/{tournamentId}/match/{matchId}  // ❌ Wrong - no categories segment
```

But matches are stored at:
```
tournaments/{tournamentId}/categories/{categoryId}/match/{matchId}  // ✓ Correct
```

**Why This Matters:**
- Without categoryId, cloud function constructs wrong Firestore path
- Brackets-manager can't find the match document
- Returns "Match not found" error
- No bracket update occurs

---

### Issue 3: Cloud Function Server-Side Path Issues

**File:** `functions/src/updateMatch.ts`

**Problems:**
1. Cloud function doesn't accept `categoryId` parameter
2. Uses wrong Firestore path without categories
3. May not handle string-to-number conversions for brackets-manager

**Impact:**
- Even if client sends categoryId, cloud function ignores it
- Always looks in wrong path
- Brackets-manager operations fail

---

## Root Cause Summary

The core issue stems from **incorrect ID resolution and missing categoryId**:

1. **Client-side** (`matches.ts` - `completeMatch`):
   - Extracting opponent IDs from raw `match.opponent1.id` (numeric participant ID)
   - Should use `match.participant1Id` (registration ID, already correct from adapter)
   - Not sending `categoryId` to cloud function

2. **Server-side** (`functions/src/updateMatch.ts`):
   - Not accepting `categoryId` parameter
   - Constructing path without categories segment
   - Looking in wrong Firestore location

---

## Implementation Plan

### Fix 1: Correct Opponent Registration ID Extraction

**File:** `src/stores/matches.ts`

**Lines to Modify:** Search for `completeMatch` function, around lines 580-610

**Current Buggy Code:**
```typescript
async function completeMatch(
  tournamentId: string,
  matchId: string,
  categoryId: string,
  winnerId: string
): Promise<void> {
  const match = currentMatch.value;
  if (!match) throw new Error('No match loaded');

  // 🔴 BUGGY: Extracting IDs from raw opponent data
  const opponent1RegistrationId = String(match.opponent1?.id);  // Gets "1", "8", etc.
  const opponent2RegistrationId = String(match.opponent2?.id);

  console.log('[completeMatch] Winner registration ID did not match bracket opponents', {
    matchId,
    winnerId,
    opponent1Id: match.opponent1?.id,
    opponent2Id: match.opponent2?.id,
    opponent1RegistrationId,
    opponent2RegistrationId,
  });

  // Validation fails because 'Wa08X2yYAZjyS3fySMi8' !== '1'
  if (winnerId !== opponent1RegistrationId && winnerId !== opponent2RegistrationId) {
    throw new Error('Winner ID must match one of the match participants');
  }
  // ...
}
```

**Fixed Code:**
```typescript
async function completeMatch(
  tournamentId: string,
  matchId: string,
  categoryId: string,
  winnerId: string
): Promise<void> {
  const match = currentMatch.value;
  if (!match) throw new Error('No match loaded');

  // ✅ CORRECT: Use registration IDs already in the Match object
  // These were correctly extracted by bracketMatchAdapter.ts
  const opponent1RegistrationId = match.participant1Id;  // Already correct registration ID
  const opponent2RegistrationId = match.participant2Id;  // Already correct registration ID

  console.log('[completeMatch] Validating winner', {
    matchId,
    winnerId,
    participant1Id: match.participant1Id,
    participant2Id: match.participant2Id,
    opponent1RegistrationId,
    opponent2RegistrationId,
  });

  // Now validation works: 'Wa08X2yYAZjyS3fySMi8' === 'Wa08X2yYAZjyS3fySMi8' ✓
  if (winnerId !== opponent1RegistrationId && winnerId !== opponent2RegistrationId) {
    throw new Error('Winner ID must match one of the match participants');
  }
  // ...
}
```

**Key Changes:**
1. Changed from `String(match.opponent1?.id)` to `match.participant1Id`
2. Changed from `String(match.opponent2?.id)` to `match.participant2Id`
3. These fields were already populated correctly by `bracketMatchAdapter.ts` (Phase 7b)

**Why This Works:**
- The `Match` object from bracketMatchAdapter already has correct registration IDs
- `match.participant1Id` = registration ID like 'Wa08X2yYAZjyS3fySMi8'
- No need to access raw opponent data or do ID conversions
- Winner validation now succeeds

---

### Fix 2: Add categoryId to Cloud Function Call

**File:** `src/stores/matches.ts`

**Lines to Modify:** In `completeMatch` function, around line 620

**Current Buggy Code:**
```typescript
try {
  const updateMatch = httpsCallable(functions, 'updateMatch');

  // 🔴 BUGGY: Missing categoryId parameter
  await updateMatch({
    tournamentId: match.tournamentId,
    matchId: match.id,
    winnerId,
    scores: match.scores,
  });

  console.log('[completeMatch] Match updated successfully');
} catch (err) {
  console.error('[completeMatch] Cloud function failed:', err);
  throw err;
}
```

**Fixed Code:**
```typescript
try {
  const updateMatch = httpsCallable(functions, 'updateMatch');

  // ✅ CORRECT: Include categoryId so cloud function can find the match
  await updateMatch({
    tournamentId: match.tournamentId,
    categoryId: match.categoryId,  // ← ADD THIS LINE
    matchId: match.id,
    winnerId,
    scores: match.scores,
  });

  console.log('[completeMatch] Match updated successfully');
} catch (err) {
  console.error('[completeMatch] Cloud function failed:', err);
  throw err;
}
```

**Key Change:**
- Added `categoryId: match.categoryId` to the payload

**Why This Works:**
- Cloud function receives categoryId
- Can construct correct Firestore path with categories segment
- Brackets-manager can find and update the match

---

### Fix 3: Update Cloud Function to Handle Category Path

**File:** `functions/src/updateMatch.ts`

**Lines to Modify:** Main function definition and path construction

**Current Buggy Code:**
```typescript
export const updateMatch = onCall(async (request) => {
  // 🔴 BUGGY: Doesn't accept or use categoryId
  const { tournamentId, matchId, winnerId, scores } = request.data;

  console.log('[updateMatch] Called with:', { tournamentId, matchId, winnerId });

  // Wrong path - missing categories segment
  const rootPath = `tournaments/${tournamentId}`;
  const storage = new FirestoreAdapter(admin.firestore(), rootPath);
  const manager = new BracketsManager(storage);

  try {
    // Can't find match because path is wrong
    const match = await manager.get.match(matchId);
    // ...
  } catch (error) {
    console.error('[updateMatch] Error:', error);
    throw new functions.https.HttpsError('not-found', 'Match not found');
  }
});
```

**Fixed Code:**
```typescript
export const updateMatch = onCall(async (request) => {
  // ✅ CORRECT: Accept categoryId and include in path
  const { tournamentId, categoryId, matchId, winnerId, scores } = request.data;

  console.log('[updateMatch] Called with:', { tournamentId, categoryId, matchId, winnerId });

  // Validate required parameters
  if (!categoryId) {
    throw new functions.https.HttpsError('invalid-argument', 'categoryId is required');
  }

  // Correct path - includes categories segment
  const rootPath = `tournaments/${tournamentId}/categories/${categoryId}`;
  const storage = new FirestoreAdapter(admin.firestore(), rootPath);
  const manager = new BracketsManager(storage);

  try {
    // Convert matchId to number - brackets-manager expects numeric IDs
    const numericMatchId = Number(matchId);
    if (isNaN(numericMatchId)) {
      throw new functions.https.HttpsError('invalid-argument', 'matchId must be numeric');
    }

    // Now can find match because path is correct
    const match = await manager.get.match(numericMatchId);

    console.log('[updateMatch] Match found:', match);

    // Determine winner's opponent index (1 or 2)
    let winnerOpponentIndex: 1 | 2;

    // Match has opponent1 and opponent2 with id fields (numeric participant IDs)
    // We need to find which opponent's registrationId matches the winnerId
    // But opponent objects don't directly have registrationId...
    // We need to look up the participant to get the registration ID

    const participants = await manager.get.participants({ tournamentId: categoryId });
    const participant1 = participants.find(p => p.id === match.opponent1?.id);
    const participant2 = participants.find(p => p.id === match.opponent2?.id);

    // participant.name contains the registration ID (Phase 7b architecture)
    const opponent1RegistrationId = participant1?.name;
    const opponent2RegistrationId = participant2?.name;

    console.log('[updateMatch] Participant registration IDs:', {
      opponent1RegistrationId,
      opponent2RegistrationId,
      winnerId
    });

    if (winnerId === opponent1RegistrationId) {
      winnerOpponentIndex = 1;
    } else if (winnerId === opponent2RegistrationId) {
      winnerOpponentIndex = 2;
    } else {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Winner ID ${winnerId} does not match either opponent`
      );
    }

    // Update match with winner
    await manager.update.match({
      id: numericMatchId,
      opponent1: {
        ...match.opponent1,
        result: winnerOpponentIndex === 1 ? 'win' : 'loss',
      },
      opponent2: {
        ...match.opponent2,
        result: winnerOpponentIndex === 2 ? 'win' : 'loss',
      },
    });

    console.log('[updateMatch] Match updated, winner advanced');

    return { success: true, matchId, winnerId };
  } catch (error) {
    console.error('[updateMatch] Error:', error);
    throw new functions.https.HttpsError('internal', String(error));
  }
});
```

**Key Changes:**
1. Accept `categoryId` from request.data
2. Validate `categoryId` is present
3. Include `categoryId` in rootPath: `tournaments/${tournamentId}/categories/${categoryId}`
4. Convert `matchId` to number for brackets-manager
5. Look up participants to get registration IDs (participant.name)
6. Match winner ID to correct opponent
7. Update match with winner, triggering bracket advancement

**Why This Works:**
- Cloud function now uses correct Firestore path
- Brackets-manager can find and update matches
- Winner advancement logic executes correctly
- Next round matches receive the winner

---

### Fix 4: Update Match Status After Cloud Function Success

**File:** `src/stores/matches.ts`

**Lines to Modify:** In `completeMatch` function, after cloud function call

**Add After Cloud Function Call:**
```typescript
// After successful cloud function call
await updateMatch({
  tournamentId: match.tournamentId,
  categoryId: match.categoryId,
  matchId: match.id,
  winnerId,
  scores: match.scores,
});

console.log('[completeMatch] Match updated successfully');

// ✅ ADD THIS: Update local match_scores document
await setDoc(
  doc(db, `tournaments/${match.tournamentId}/categories/${match.categoryId}/match_scores`, match.id),
  {
    status: 'completed',
    winnerId,
    completedAt: serverTimestamp(),
    scores: match.scores,
    updatedAt: serverTimestamp(),
  },
  { merge: true }
);

console.log('[completeMatch] Match status updated to completed');

// Refresh match data to show completed status
await fetchMatch(match.tournamentId, match.id, match.categoryId);
```

**Why This is Needed:**
- Cloud function updates brackets-manager data (for bracket progression)
- But UI uses match_scores document for status display
- Need to update both for complete functionality
- fetchMatch refreshes the UI with completed status

---

## Testing Strategy

### Pre-Implementation Verification

1. **Verify Issue Exists:**
   ```bash
   # Open app, navigate to Match Control
   # Click "ENTER SCORES" on a ready match
   # Enter scores: 21-0, 21-0, 0-0
   # Click "SAVE SCORES"
   # Confirm: Error appears, match doesn't complete
   # Check console: See "Winner registration ID did not match" error
   # Check console: See 500 error from cloud function
   ```

2. **Check Firestore Data:**
   ```bash
   # Open Firebase Console → Firestore
   # Navigate to tournaments/{id}/categories/{catId}/match/0
   # Confirm: Match document exists
   # Navigate to tournaments/{id}/categories/{catId}/participant/
   # Confirm: Participants have id (numeric) and name (registration ID) fields
   ```

---

### Post-Implementation Testing

#### Test 1: Single Match Completion

**Objective:** Verify a single match can be scored and completed successfully

**Steps:**
1. Navigate to Match Control view
2. Find a match with status "ready"
3. Click "ENTER SCORES" button
4. Enter Game 1: 21-0
5. Enter Game 2: 21-0
6. Enter Game 3: 0-0
7. Click "SAVE SCORES"

**Expected Output:**
- No console errors
- Toast shows "Scores saved successfully"
- Match status changes to "completed"
- Winner is correctly determined (player/team with 2 game wins)

**Success Criteria:**
- ✅ No "Winner registration ID did not match" errors
- ✅ No 500 errors from cloud function
- ✅ Match shows as completed in UI
- ✅ Winner is highlighted in match display

#### Test 2: Winner Advances in Bracket

**Objective:** Verify winner advances to next round in bracket visualization

**Steps:**
1. Complete a Round 1 match (as in Test 1)
2. Navigate to Brackets tab
3. Observe the bracket visualization

**Expected Output:**
- Completed match shows winner's name highlighted
- Winner's name appears in the next round match
- Bracket visualization updates automatically (no refresh needed)
- Next round opponent slot is populated

**Success Criteria:**
- ✅ Winner appears in correct next round match
- ✅ Opponent position is correct (seeding maintained)
- ✅ Visual progression lines show advancement
- ✅ No duplicate or missing participants

#### Test 3: Multiple Matches Complete in Sequence

**Objective:** Verify multiple matches can be completed without conflicts

**Steps:**
1. Complete Match 1 (first Round 1 match)
2. Complete Match 2 (second Round 1 match)
3. Complete Match 3 (third Round 1 match)
4. Navigate to Brackets tab

**Expected Output:**
- All three matches complete successfully
- All three winners advance to Round 2
- Round 2 matches show correct pairings
- No overlapping or missing participants

**Success Criteria:**
- ✅ All completions succeed without errors
- ✅ Winners advance to correct Round 2 matches
- ✅ Bracket structure remains valid
- ✅ No double-bookings in next round

#### Test 4: Cloud Function Logs Verification

**Objective:** Verify cloud function executes correctly server-side

**Steps:**
1. Open terminal with Firebase Emulator logs
2. Complete a match in the UI
3. Observe cloud function logs

**Expected Log Output:**
```
[updateMatch] Called with: {
  tournamentId: 'ow4RRspCZgLOuD6Xrice',
  categoryId: '5SYQxZ4yzyteLLFp7W9B',
  matchId: '0',
  winnerId: 'Wa08X2yYAZjyS3fySMi8'
}
[updateMatch] Match found: { id: 0, opponent1: {...}, opponent2: {...} }
[updateMatch] Participant registration IDs: {
  opponent1RegistrationId: 'Wa08X2yYAZjyS3fySMi8',
  opponent2RegistrationId: 'dy1tsj6qKZgBx87WFYdj',
  winnerId: 'Wa08X2yYAZjyS3fySMi8'
}
[updateMatch] Match updated, winner advanced
```

**Success Criteria:**
- ✅ Cloud function receives categoryId
- ✅ Match is found at correct path
- ✅ Registration IDs match correctly
- ✅ Winner advances successfully
- ✅ No errors in cloud function logs

#### Test 5: Double Elimination Tournament

**Objective:** Verify winner/loser bracket advancement in double elimination

**Steps:**
1. Create double elimination tournament
2. Complete a Winners Bracket R1 match
3. Check winner advances to Winners Bracket R2
4. Check loser advances to Losers Bracket R1
5. Navigate to Brackets tab

**Expected Output:**
- Winner goes to Winners Bracket Round 2
- Loser goes to Losers Bracket Round 1
- Both players appear in correct positions
- Bracket visualization shows both brackets correctly

**Success Criteria:**
- ✅ Winner bracket advancement works
- ✅ Loser bracket advancement works
- ✅ No cross-contamination between brackets
- ✅ Seeding is maintained correctly

#### Test 6: Console Remains Clean

**Objective:** Verify no errors during normal operation

**Steps:**
1. Open browser DevTools console
2. Clear console
3. Complete 2-3 matches
4. Observe console output

**Expected Output:**
- Success log messages only
- No errors or warnings
- Clean execution flow

**Success Criteria:**
- ✅ No "Winner registration ID did not match" errors
- ✅ No 500 errors
- ✅ No "Match not found" errors
- ✅ No TypeScript errors
- ✅ No React/Vue warnings

---

## Verification Checklist

After implementation and testing:

### Functionality
- [ ] Matches can be scored and saved
- [ ] Match completion succeeds without errors
- [ ] Winners are correctly determined from scores
- [ ] Winners advance to next round automatically
- [ ] Losers advance to losers bracket (double elimination)
- [ ] Bracket visualization updates in real-time
- [ ] Match status shows as "completed"

### Code Quality
- [ ] Opponent IDs use match.participant1Id/participant2Id
- [ ] Cloud function receives and uses categoryId
- [ ] Cloud function constructs correct Firestore path
- [ ] Numeric/string conversions handled correctly
- [ ] No TypeScript errors in modified files
- [ ] Console shows success messages, no errors

### Data Integrity
- [ ] Registration IDs are used correctly throughout
- [ ] Participant ID architecture from Phase 7b maintained
- [ ] match_scores documents updated with completion status
- [ ] Brackets-manager data updated correctly
- [ ] No data corruption or orphaned records

### Performance
- [ ] Match completion is fast (< 2 seconds)
- [ ] Bracket updates are immediate
- [ ] Cloud function executes quickly (< 1 second)
- [ ] No unnecessary re-fetches

---

## Architecture Documentation

### CRITICAL: Opponent Registration ID Resolution

**This is the #1 mistake to avoid. Read carefully.**

#### The Match Object Structure

When you have a `Match` object in the client code:

```typescript
interface Match {
  id: string;                    // Match ID (numeric as string, like "0", "1")
  tournamentId: string;
  categoryId: string;
  participant1Id?: string;       // ✅ REGISTRATION ID - use this!
  participant2Id?: string;       // ✅ REGISTRATION ID - use this!
  opponent1?: {...};             // ❌ Raw brackets-manager data - don't use!
  opponent2?: {...};             // ❌ Raw brackets-manager data - don't use!
  winnerId?: string;
  status: MatchStatus;
  scores: GameScore[];
  // ...
}
```

#### The Correct Pattern

**✅ ALWAYS do this when you need registration IDs:**

```typescript
const opponent1RegistrationId = match.participant1Id;
const opponent2RegistrationId = match.participant2Id;
```

**❌ NEVER do this:**

```typescript
// Wrong - gets numeric participant ID, not registration ID
const opponent1RegistrationId = match.opponent1?.id;
const opponent2RegistrationId = match.opponent2?.id;
```

#### Why participant1Id/participant2Id Are Correct

The `bracketMatchAdapter.ts` (Phase 7b) already does the correct conversion:

```typescript
// From bracketMatchAdapter.ts lines 92-93
const participant1Id = participant1?.name || bracketsMatch.opponent1?.registrationId || undefined;
const participant2Id = participant2?.name || bracketsMatch.opponent2?.registrationId || undefined;
```

So by the time you have a `Match` object:
- `match.participant1Id` = registration ID (like 'Wa08X2yYAZjyS3fySMi8')
- `match.participant2Id` = registration ID (like 'dy1tsj6qKZgBx87WFYdj')

**These are already correct. Just use them!**

#### The Data Flow

```
1. Firestore: participant document
   {
     id: 1,                                    ← Numeric brackets-manager ID
     name: "Wa08X2yYAZjyS3fySMi8",           ← Registration ID
     tournament_id: "5SYQxZ4yzyteLLFp7W9B"
   }

2. Firestore: match document
   {
     id: "0",
     opponent1: { id: 1 },                   ← References participant.id (numeric)
     opponent2: { id: 8 }
   }

3. bracketMatchAdapter extracts registration ID
   const participant1 = participants.find(p => p.id == match.opponent1.id);
   const participant1Id = participant1.name;  ← Gets "Wa08X2yYAZjyS3fySMi8"

4. Match object created with correct IDs
   {
     id: "0",
     participant1Id: "Wa08X2yYAZjyS3fySMi8",  ← Correct registration ID
     participant2Id: "dy1tsj6qKZgBx87WFYdj",  ← Correct registration ID
     opponent1: { id: 1 },                     ← Raw data (don't use)
     opponent2: { id: 8 }                      ← Raw data (don't use)
   }

5. Your code: Use participant1Id directly
   const winnerId = "Wa08X2yYAZjyS3fySMi8";
   if (winnerId === match.participant1Id) {   ← Works! ✓
     // Winner is opponent 1
   }
```

---

## Rollback Plan

If issues arise after deployment:

### Rollback Client Code

```bash
git checkout HEAD~1 -- src/stores/matches.ts
```

### Rollback Cloud Function

```bash
cd functions
git checkout HEAD~1 -- src/updateMatch.ts
npm run build
firebase deploy --only functions:updateMatch
```

### Verify Rollback

1. Matches should be in previous state (may not complete, but no crashes)
2. Check console for errors
3. Decide whether to debug or stay on previous version

---

## Known Issues and Limitations

### Current Limitations

1. **Match must be in correct status**: Can only complete matches in 'in_progress' or 'ready' status
2. **Scores must be valid**: Must have at least 2 games with scores
3. **Winner must be clear**: Needs 2+ game wins to determine winner
4. **Cloud function timeout**: 60 second timeout (should be plenty for one match)

### Future Improvements

1. **Retry logic**: Add automatic retry if cloud function times out
2. **Optimistic updates**: Show winner advancing immediately, confirm with cloud function
3. **Batch updates**: Allow completing multiple matches in one cloud function call
4. **Rollback mechanism**: If cloud function fails, rollback local match_scores update
5. **Better error messages**: Show specific error reasons to users ("Network error", "Invalid scores", etc.)

---

## Success Criteria

Phase 7c is complete when ALL of the following are true:

### Primary Goals
- ✅ Matches can be scored and completed without errors
- ✅ Winners are correctly determined from scores
- ✅ Winners advance to next round in brackets
- ✅ Cloud function executes successfully with categoryId
- ✅ No "Winner registration ID did not match" errors
- ✅ No 500 errors from cloud function

### Code Quality Goals
- ✅ Opponent IDs extracted correctly from match.participant1Id/participant2Id
- ✅ Cloud function receives and uses categoryId
- ✅ Firestore paths include categories segment
- ✅ Architecture from Phase 7b maintained
- ✅ No TypeScript errors in modified files

### Data Integrity Goals
- ✅ Registration IDs used correctly throughout
- ✅ Brackets-manager updates executed
- ✅ match_scores documents updated with completion status
- ✅ No data corruption or orphaned records

### Documentation Goals
- ✅ This phase document is complete
- ✅ Architecture section explains ID resolution clearly
- ✅ Testing procedures are documented
- ✅ Common mistakes are documented to prevent regression

---

## Appendix A: File Locations

### Files Modified in This Phase

| File | Path | Lines Changed | Purpose |
|------|------|---------------|---------|
| matches.ts | src/stores/ | ~590-595, ~620 | Fix opponent ID extraction, add categoryId to cloud call |
| updateMatch.ts | functions/src/ | Main function | Accept categoryId, use correct path |

### Related Files (Not Modified)

| File | Path | Purpose |
|------|------|---------|
| bracketMatchAdapter.ts | src/stores/ | Already extracts correct registration IDs (Phase 7b) |
| MatchControlView.vue | src/features/tournaments/views/ | Calls submitManualScores (unchanged) |

---

## Appendix B: Common Mistakes to Avoid

### Mistake 1: Using match.opponent1.id

```typescript
// ❌ WRONG - Gets numeric participant ID
const opponent1RegistrationId = String(match.opponent1?.id);

// ✅ CORRECT - Gets registration ID
const opponent1RegistrationId = match.participant1Id;
```

### Mistake 2: Forgetting categoryId

```typescript
// ❌ WRONG - Cloud function can't find match
await updateMatch({
  tournamentId,
  matchId,
  winnerId,
});

// ✅ CORRECT - Cloud function uses correct path
await updateMatch({
  tournamentId,
  categoryId,  // ← Don't forget this!
  matchId,
  winnerId,
});
```

### Mistake 3: Wrong Firestore Path

```typescript
// ❌ WRONG - Missing categories segment
const rootPath = `tournaments/${tournamentId}`;

// ✅ CORRECT - Includes categories segment
const rootPath = `tournaments/${tournamentId}/categories/${categoryId}`;
```

### Mistake 4: String/Number Confusion

```typescript
// ❌ WRONG - brackets-manager expects numbers
await manager.get.match(matchId);  // matchId is string "0"

// ✅ CORRECT - Convert to number
await manager.get.match(Number(matchId));
```

---

## Support and References

### Related Documentation

- [Phase 7b: Match Display and Auto-Schedule Fixes](./Phase7b-Match-Display-And-Auto-Schedule-Fixes.md)
  - See "CRITICAL: Participant ID Resolution Pattern"
  - Explains why `participant.name` = registration ID
- [DATA_MODEL_ARCHITECTURE.md](../architecture/DATA_MODEL_ARCHITECTURE.md)
  - Complete architecture overview
- [brackets-manager Documentation](https://github.com/Drarig29/brackets-manager.js)
  - Understanding brackets-manager data structures

### Questions and Issues

If implementing or maintaining this code:

1. **Check the Match object** - Does it have participant1Id and participant2Id?
2. **Check the cloud function** - Does it receive categoryId?
3. **Check the Firestore path** - Does it include categories segment?
4. **Check console logs** - Any "not found" errors mean path is wrong
5. **Review Phase 7b** - Understand the participant ID architecture

---

**Document Version:** 1.0
**Last Updated:** 2026-02-02
**Author:** Migration Team
**Review Status:** Ready for Implementation

---

## For AI Coders: Quick Implementation Guide

### Step 1: Fix matches.ts completeMatch function

Find this line (around 590-595):
```typescript
const opponent1RegistrationId = String(match.opponent1?.id);
```

Replace with:
```typescript
const opponent1RegistrationId = match.participant1Id;
const opponent2RegistrationId = match.participant2Id;
```

### Step 2: Add categoryId to cloud function call

Find this block (around 620):
```typescript
await updateMatch({
  tournamentId: match.tournamentId,
  matchId: match.id,
  winnerId,
  scores: match.scores,
});
```

Add categoryId:
```typescript
await updateMatch({
  tournamentId: match.tournamentId,
  categoryId: match.categoryId,  // ← ADD THIS
  matchId: match.id,
  winnerId,
  scores: match.scores,
});
```

### Step 3: Update cloud function

In `functions/src/updateMatch.ts`, change:
```typescript
const { tournamentId, matchId, winnerId } = request.data;
const rootPath = `tournaments/${tournamentId}`;
```

To:
```typescript
const { tournamentId, categoryId, matchId, winnerId } = request.data;
const rootPath = `tournaments/${tournamentId}/categories/${categoryId}`;
```

Also convert matchId to number:
```typescript
const match = await manager.get.match(Number(matchId));
```

### Step 4: Test

1. Complete a match
2. Verify no errors in console
3. Verify winner advances in bracket
4. Check cloud function logs

**That's it!** Three small changes fix all the issues.
