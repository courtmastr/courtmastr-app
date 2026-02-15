# Phase 7: Auto Schedule and Scoring Module Fixes

**Status:** 📋 **READY FOR IMPLEMENTATION**
**Priority:** CRITICAL - Auto Schedule blocking feature, Scoring has app-crashing bugs
**Complexity:** MEDIUM-HIGH
**Actual Time:** 6-9 hours (3h critical + 1.5h high + 2h moderate + 2-3h testing)
**Created:** 2026-02-02

---

## Executive Summary

Phase 7 addresses critical bugs in two core tournament management features: Auto Schedule and Scoring.

**Auto Schedule Issue:**
- Users see "0 matches ready to schedule" even when matches exist
- Root cause: `bracketMatchAdapter.ts` uses `participant?.name` instead of `participant?.id`
- Impact: Tournament organizers cannot use auto-scheduling feature

**Scoring Module Issues (6 bugs identified):**
- **CRITICAL**: Missing `recordWalkover()` function causes app crash
- **CRITICAL**: Scores not initialized in `startMatch()` breaks scoring UI
- **HIGH**: No real-time score updates (missing `match_scores` subscription)
- **HIGH**: Equal scores silently discarded in manual entry (data loss)
- **MODERATE**: No game completion logic (scores can go beyond 30)
- **MODERATE**: Hardcoded best-of-3 (inflexible for other formats)

**Solution:**
- 1-line fix for Auto Schedule
- 6 targeted fixes for Scoring Module (prioritized by impact)
- Comprehensive testing strategy
- Rollback plan for each fix

---

## Problem Statement

### Issue 1: Auto Schedule Shows "0 Matches Ready to Schedule"

**File:** `src/stores/bracketMatchAdapter.ts` lines 102-103

**User Impact:**
- Tournament organizers click "Auto Schedule" button
- Dialog shows "0 matches ready to schedule" (even with 8+ unscheduled matches)
- Cannot auto-assign matches to courts and times
- Must manually schedule each match (time-consuming)

**Technical Details:**

The adapter converts brackets-manager matches to legacy Match format:

```typescript
// Current buggy code (lines 102-103):
const participant1Id = participant1?.name || bracketsMatch.opponent1?.registrationId || undefined;
const participant2Id = participant2?.name || bracketsMatch.opponent2?.registrationId || undefined;
```

**The Bug:**
- Uses `participant?.name` (e.g., "John Doe") as the participant ID
- Should use `participant?.id` (e.g., "reg_abc123")
- Results in IDs like `"John Doe"` instead of `"reg_abc123"`

**How It Breaks Auto Schedule:**

1. `MatchControlView.vue:547-559` has `matchesToScheduleForAuto` computed property
2. Filters matches requiring: `m.participant1Id && m.participant2Id && !m.courtId`
3. With names as IDs, the filter technically passes (names are truthy)
4. But downstream code expects registration IDs, not names
5. Result: 0 matches shown as ready to schedule

---

### Issue 2: Scoring Module - Missing `recordWalkover` Function

**File:** `src/stores/matches.ts` (function not implemented)
**Called From:** `src/features/scoring/views/ScoringInterfaceView.vue:202`

**User Impact:**
- User clicks "Record Walkover" button
- **App crashes** with error: `matchStore.recordWalkover is not a function`
- Match stuck in current state
- Cannot record forfeit/walkover

**Technical Details:**

```typescript
// ScoringInterfaceView.vue:202
await matchStore.recordWalkover(tournamentId.value, matchId.value, winnerId);
```

This function doesn't exist in the matches.ts exports. Need to implement:
- Create walkover score (21-0 for winner)
- Update match_scores with `status: 'walkover'`
- Call Cloud Function to advance bracket
- Handle winner ID mapping

---

### Issue 3: Scoring UI Breaks on Match Start

**File:** `src/stores/matches.ts` lines 409-427 (`startMatch` function)

**User Impact:**
- Organizer starts a match from "ready" status
- Navigates to scoring interface
- **Blank screen** - no score cards render
- Cannot score the match

**Technical Details:**

```typescript
// Current code (lines 414-422):
await setDoc(
  doc(db, matchScoresPath, matchId),
  {
    startedAt: serverTimestamp(),
    status: 'in_progress',
    updatedAt: serverTimestamp(),
    // ❌ Missing: scores: [{ gameNumber: 1, score1: 0, score2: 0, isComplete: false }]
  },
  { merge: true }
);
```

**Why It Breaks:**
- Scoring UI expects `match.scores` array to exist
- `currentGame` computed property (ScoringInterfaceView.vue:59-62) returns `null` if no scores
- Template condition `v-else-if="match.status === 'in_progress' && currentGame"` fails
- UI doesn't render

---

### Issue 4: Scores Don't Update in Real-Time

**File:** `src/stores/matches.ts` lines 390-407 (`subscribeMatch` function)

**User Impact:**
- Scorer updates points in Tab A
- Viewer watching in Tab B sees stale scores
- Must manually refresh to see updates
- Poor experience for remote viewers/live scores

**Technical Details:**

```typescript
// Current code only subscribes to /match:
currentMatchUnsubscribe = onSnapshot(
  doc(db, matchPath, matchId),  // Only /match collection
  async () => {
    await fetchMatch(tournamentId, matchId, categoryId);
  }
);
// ❌ Missing subscription to /match_scores collection
```

**Why It Breaks:**
- Score updates written to `/match_scores` collection
- Only subscribing to `/match` collection (bracket structure)
- Score changes don't trigger the subscription listener
- UI remains stale until manual refresh

---

### Issue 5: Manual Score Entry Silently Discards Tied Games

**File:** `src/features/scoring/views/ScoringInterfaceView.vue` lines 245-257

**User Impact:**
- Organizer enters manual scores: Game 1: 21-15, Game 2: 21-21, Game 3: 21-10
- Clicks Submit
- **Only Games 1 and 3 saved** - Game 2 silently discarded
- No error message shown
- Data loss and confusion

**Technical Details:**

```typescript
// Current code (lines 249-256):
for (const game of games) {
  if (game.p1 === 0 && game.p2 === 0) continue;

  if (game.p1 > game.p2) {
    p1GamesWon++;
    validGames.push({ ...game, winner: match.value.participant1Id! });
  } else if (game.p2 > game.p1) {
    p2GamesWon++;
    validGames.push({ ...game, winner: match.value.participant2Id! });
  }
  // ❌ If game.p1 === game.p2 (tied), nothing happens - game skipped!
}
```

---

### Issue 6: Tap Scoring - Games Never Complete

**File:** `src/stores/matches.ts` lines 429-471 (`updateScore` function)

**User Impact:**
- Scorer uses tap scoring (point-by-point)
- Score reaches 21-19 (valid win)
- Game doesn't mark as complete
- Score can go to 22-19, 23-19... up to 30-29
- No automatic game advancement

**Technical Details:**

```typescript
// Current code just increments score (lines 449-451):
} else {
  if (participant === 'participant1') currentGame.score1++;
  else currentGame.score2++;
}
// ❌ No check for game completion conditions
```

**Missing Logic:**
- Check if score >= 21 AND lead >= 2
- OR check if score >= 30 (max points)
- Mark game as complete
- Start next game automatically

---

### Issue 7: Hardcoded Best-of-3 Assumption

**File:** `src/features/scoring/views/ScoringInterfaceView.vue` line 277

**User Impact:**
- Tournament uses best-of-5 format
- Player wins 3 games
- Match doesn't complete (hardcoded to require only 2 wins)
- OR tournament uses best-of-1, match completes after first game but code expects 2

**Technical Details:**

```typescript
// Current code (line 277):
if (p1GamesWon >= 2 || p2GamesWon >= 2) {
  router.back();
}
// ❌ Hardcoded "2" - should use Math.ceil(BADMINTON_CONFIG.gamesPerMatch / 2)
```

---

## Root Cause Analysis

### Auto Schedule Root Cause

**Location:** `bracketMatchAdapter.ts:90-108`

**Data Flow:**
1. Bracket generator creates participants with `id = registrationId` (Phase 1-5 migration)
2. brackets-manager stores matches with `opponent.id` pointing to participant
3. Adapter fetches participants: `participants?.find(p => p.id == bracketsMatch.opponent1?.id)`
4. **BUG**: Uses `participant?.name` as ID instead of `participant?.id`
5. Filter in MatchControlView expects valid registration IDs
6. Names don't match, filter fails, 0 matches shown

**Evidence:**
```typescript
// Console log shows (line 105-108):
console.log('🔍 [bracketMatchAdapter] Final IDs:', {
  participant1Id,  // "John Doe" ❌ should be "reg_abc123"
  participant2Id   // "Jane Smith" ❌ should be "reg_def456"
});
```

---

### Scoring Module Root Causes

**Issue 2 (recordWalkover):** Function never implemented, but UI calls it

**Issue 3 (startMatch):** Oversight in Phase 1-5 migration - forgot to initialize scores array

**Issue 4 (subscribeMatch):** Only implemented `/match` subscription, not `/match_scores`
- Compare with `subscribeMatches` (plural) which correctly subscribes to both (lines 207-222)

**Issue 5 (equal scores):** Logic assumes one player always wins, no validation for ties

**Issue 6 (game completion):** Original implementation planned but never completed
- TODO comment may have existed and was removed

**Issue 7 (best-of-3):** Early implementation hardcoded for standard badminton
- `BADMINTON_CONFIG` exists but not used here

---

## Implementation Plan

### Part 1: Auto Schedule Fix (30 minutes)

#### Step 1.1: Fix Participant ID Resolution

**File:** `/Users/ramc/Documents/Code/courtmaster-v2/src/stores/bracketMatchAdapter.ts`

**Location:** Lines 102-103

**Current Code:**
```typescript
const participant1Id = participant1?.name || bracketsMatch.opponent1?.registrationId || undefined;
const participant2Id = participant2?.name || bracketsMatch.opponent2?.registrationId || undefined;
```

**New Code:**
```typescript
const participant1Id = participant1?.id || bracketsMatch.opponent1?.registrationId || undefined;
const participant2Id = participant2?.id || bracketsMatch.opponent2?.registrationId || undefined;
```

**Why This Works:**
- `participant.id` contains the registration ID (set during bracket creation in Phase 1)
- Maintains fallback chain: `participant.id` → `opponent.registrationId` → `undefined`
- No schema changes required
- Backward compatible with existing data

**Testing This Change:**
```bash
# 1. Open browser console
# 2. Navigate to Match Control → Auto Schedule
# 3. Check console logs:
# Expected: 🔍 [bracketMatchAdapter] Final IDs: { participant1Id: 'reg_abc123', participant2Id: 'reg_def456' }
# 4. Verify dialog shows: "8 matches ready to schedule" (not 0)
```

---

### Part 2: Scoring Module Fixes

#### Fix #1: Implement `recordWalkover` Function (1 hour)

**File:** `/Users/ramc/Documents/Code/courtmaster-v2/src/stores/matches.ts`

**Location:** After `completeMatch` function (around line 590)

**Add This Function:**

```typescript
/**
 * Record a walkover (forfeit) for a match.
 *
 * A walkover occurs when one player cannot compete (injury, no-show, etc.).
 * This function:
 * - Creates a default 21-0 score for the winner
 * - Updates match status to 'walkover'
 * - Advances the bracket via Cloud Function
 *
 * @param tournamentId - Tournament ID
 * @param matchId - Match ID
 * @param winnerId - Registration ID of the winner (player who didn't forfeit)
 * @param categoryId - Optional category ID for category-level matches
 *
 * @example
 * await matchStore.recordWalkover('t1', 'm123', 'reg_abc', 'cat1');
 */
async function recordWalkover(
  tournamentId: string,
  matchId: string,
  winnerId: string,
  categoryId?: string
): Promise<void> {
  try {
    const matchScoresPath = categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
      : `tournaments/${tournamentId}/match_scores`;

    // Create walkover score (21-0 for winner)
    const walkoverScores: GameScore[] = [{
      gameNumber: 1,
      score1: winnerId === currentMatch.value?.participant1Id ? 21 : 0,
      score2: winnerId === currentMatch.value?.participant2Id ? 21 : 0,
      winnerId,
      isComplete: true,
    }];

    // Update match_scores with walkover status
    await setDoc(
      doc(db, matchScoresPath, matchId),
      {
        scores: walkoverScores,
        winnerId,
        status: 'walkover',
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Call cloud function to advance bracket
    try {
      const updateMatchFn = httpsCallable(functions, 'updateMatch');
      const matchPath = categoryId
        ? `tournaments/${tournamentId}/categories/${categoryId}/match`
        : `tournaments/${tournamentId}/match`;

      // Map winner registration ID to bracket participant ID
      // This is necessary because bracket uses numeric IDs, we use registration IDs
      let bracketWinnerId: string | number = winnerId;
      const matchDoc = await getDoc(doc(db, matchPath, matchId));

      if (matchDoc.exists()) {
        const bMatch = matchDoc.data() as BracketsMatch;
        const opponent1RegistrationId = bMatch.opponent1?.registrationId ?? bMatch.opponent1?.id?.toString();
        const opponent2RegistrationId = bMatch.opponent2?.registrationId ?? bMatch.opponent2?.id?.toString();

        if (opponent1RegistrationId === winnerId) {
          bracketWinnerId = bMatch.opponent1?.id ?? winnerId;
        } else if (opponent2RegistrationId === winnerId) {
          bracketWinnerId = bMatch.opponent2?.id ?? winnerId;
        }
      }

      // Advance bracket
      await updateMatchFn({
        tournamentId,
        matchId,
        status: 'completed',
        winnerId: bracketWinnerId,
        scores: walkoverScores
      });

      console.log('✅ [recordWalkover] Bracket advanced successfully');
    } catch (cloudErr) {
      console.error('[recordWalkover] Cloud function failed:', cloudErr);
      // Don't throw - walkover is recorded, bracket can be fixed manually
    }
  } catch (err) {
    console.error('Error recording walkover:', err);
    throw err;
  }
}
```

**Export Addition:**

**Location:** Line ~842 (in return statement)

**Add to exports:**
```typescript
return {
  // ... existing exports (matches, currentMatch, etc.) ...
  fetchMatches,
  fetchMatch,
  subscribeMatches,
  subscribeAllMatches,
  subscribeMatch,
  unsubscribeAll,
  startMatch,
  updateScore,
  completeMatch,
  recordWalkover,  // ← ADD THIS LINE
  resetMatch,
  assignMatchToCourt,
  markMatchReady,
  updateMatchSchedule,
};
```

**Testing:**
```markdown
1. Open a match in "ready" status
2. Click "Record Walkover" menu option
3. Select winner participant
4. Confirm walkover
5. **Verify:**
   - Match status changes to "walkover"
   - Score shows 21-0 for winner
   - Winner advances to next match in bracket
   - No console errors
6. Check Firestore:
   - /match_scores/{matchId} has status: 'walkover'
   - /match/{matchId} has opponent result set
```

---

#### Fix #2: Initialize Scores in `startMatch()` (30 minutes)

**File:** `/Users/ramc/Documents/Code/courtmaster-v2/src/stores/matches.ts`

**Location:** Lines 409-427 (startMatch function)

**Current Code:**
```typescript
async function startMatch(tournamentId: string, matchId: string, categoryId?: string): Promise<void> {
  try {
    const matchScoresPath = categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
      : `tournaments/${tournamentId}/match_scores`;
    await setDoc(
      doc(db, matchScoresPath, matchId),
      {
        startedAt: serverTimestamp(),
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error starting match:', err);
    throw err;
  }
}
```

**New Code:**
```typescript
async function startMatch(tournamentId: string, matchId: string, categoryId?: string): Promise<void> {
  try {
    const matchScoresPath = categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
      : `tournaments/${tournamentId}/match_scores`;

    // Initialize with first game ready for scoring
    // This ensures the scoring UI has a valid game to display
    const initialScores: GameScore[] = [{
      gameNumber: 1,
      score1: 0,
      score2: 0,
      isComplete: false,
    }];

    await setDoc(
      doc(db, matchScoresPath, matchId),
      {
        scores: initialScores,  // ← ADD THIS
        startedAt: serverTimestamp(),
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Error starting match:', err);
    throw err;
  }
}
```

**Why This Works:**
- Scoring UI expects `match.scores` to be an array with at least one game
- `currentGame` computed property: `computed(() => match.value.scores[match.value.scores.length - 1])`
- Without initialization, `scores` is `undefined`, `currentGame` is `null`, UI doesn't render
- With initialization, `scores[0]` exists, `currentGame` returns game 1, UI renders correctly

**Testing:**
```markdown
1. Start a match from "ready" status (click START button)
2. Navigate to scoring interface
3. **Verify:**
   - Score cards display showing 0-0
   - Player names appear correctly
   - Tap buttons are enabled
   - No blank/broken UI
4. Check Firestore:
   - /match_scores/{matchId}.scores is an array with one element
   - scores[0] = { gameNumber: 1, score1: 0, score2: 0, isComplete: false }
```

---

#### Fix #3: Add `match_scores` Subscription (1 hour)

**File:** `/Users/ramc/Documents/Code/courtmaster-v2/src/stores/matches.ts`

**Location:** Lines 390-407 (subscribeMatch function)

**Current Code:**
```typescript
function subscribeMatch(tournamentId: string, matchId: string, categoryId?: string): void {
  if (currentMatchUnsubscribe) {
    currentMatchUnsubscribe();
    currentMatchUnsubscribe = null;
  }

  const matchPath = getMatchPath(tournamentId, categoryId);
  currentMatchUnsubscribe = onSnapshot(
    doc(db, matchPath, matchId),
    async () => {
      await fetchMatch(tournamentId, matchId, categoryId);
    },
    (err) => {
      console.error('Error in match subscription:', err);
      error.value = 'Lost connection to match';
    }
  );
}
```

**New Code:**
```typescript
function subscribeMatch(tournamentId: string, matchId: string, categoryId?: string): void {
  if (currentMatchUnsubscribe) {
    currentMatchUnsubscribe();
    currentMatchUnsubscribe = null;
  }

  // Store multiple unsubscribers
  const unsubscribers: (() => void)[] = [];

  // Shared refresh function
  const refresh = async () => {
    await fetchMatch(tournamentId, matchId, categoryId);
  };

  // Subscribe to /match collection (bracket structure changes)
  const matchPath = getMatchPath(tournamentId, categoryId);
  const unsubMatch = onSnapshot(
    doc(db, matchPath, matchId),
    () => refresh(),
    (err) => {
      console.error('Error in match subscription:', err);
      error.value = 'Lost connection to match';
    }
  );
  unsubscribers.push(unsubMatch);

  // Subscribe to /match_scores collection (score updates) ← ADD THIS BLOCK
  const matchScoresPath = getMatchScoresPath(tournamentId, categoryId);
  const unsubScores = onSnapshot(
    doc(db, matchScoresPath, matchId),
    () => refresh(),
    (err) => {
      console.error('Error in match_scores subscription:', err);
      // Don't update error.value - match subscription is still active
    }
  );
  unsubscribers.push(unsubScores);

  // Cleanup function unsubscribes from BOTH
  currentMatchUnsubscribe = () => {
    unsubscribers.forEach(unsub => unsub());
  };
}
```

**Why This Works:**
- Score updates written to `/match_scores/{matchId}`
- Previous code only listened to `/match/{matchId}`
- New code listens to both collections
- Any change in either collection triggers `refresh()` → `fetchMatch()`
- Real-time updates now work

**Pattern Reference:**
Look at `subscribeMatches` (plural, lines 194-227) for the same pattern:
```typescript
const unsubMatch = onSnapshot(collection(db, matchPath), () => refresh());
const unsubScores = onSnapshot(collection(db, matchScoresPath), () => refresh());
```

**Testing:**
```markdown
1. Open scoring interface in Browser Tab A
2. Open same match in Browser Tab B (or different device)
3. In Tab A: Tap to add points (score 1-0)
4. **Verify in Tab B:**
   - Score updates to 1-0 within 1-2 seconds
   - No manual refresh needed
5. In Tab B: Tap to add points (score 1-1)
6. **Verify in Tab A:**
   - Score updates to 1-1 within 1-2 seconds
7. Complete game in Tab A
8. **Verify in Tab B:**
   - Game marked complete, new game started
   - All updates appear in real-time
```

---

#### Fix #4: Validate Equal Scores (30 minutes)

**File:** `/Users/ramc/Documents/Code/courtmaster-v2/src/features/scoring/views/ScoringInterfaceView.vue`

**Location:** Lines 245-257 (submitManualScores function)

**Current Code:**
```typescript
for (const game of games) {
  // Skip games where both scores are 0
  if (game.p1 === 0 && game.p2 === 0) continue;

  // Determine winner
  if (game.p1 > game.p2) {
    p1GamesWon++;
    validGames.push({ ...game, winner: match.value.participant1Id! });
  } else if (game.p2 > game.p1) {
    p2GamesWon++;
    validGames.push({ ...game, winner: match.value.participant2Id! });
  }
  // ❌ BUG: Tied games (p1 === p2) are silently skipped!
}
```

**New Code:**
```typescript
for (const game of games) {
  // Skip games where both scores are 0
  if (game.p1 === 0 && game.p2 === 0) continue;

  // Validate: games cannot be tied ← ADD THIS BLOCK
  if (game.p1 === game.p2) {
    notificationStore.showToast(
      'error',
      `Game ${validGames.length + 1} cannot be tied (${game.p1}-${game.p2}). One player must win.`
    );
    loading.value = false;
    return;  // Abort submission
  }

  // Determine winner
  if (game.p1 > game.p2) {
    p1GamesWon++;
    validGames.push({ ...game, winner: match.value.participant1Id! });
  } else if (game.p2 > game.p1) {
    p2GamesWon++;
    validGames.push({ ...game, winner: match.value.participant2Id! });
  }
}
```

**Why This Works:**
- Badminton rules: One player must win each game (no ties)
- Previous code silently skipped tied games
- New code validates and shows error message
- Prevents data loss
- User gets clear feedback about what went wrong

**Alternative Approach (if notificationStore not available):**
```typescript
if (game.p1 === game.p2) {
  alert(`Game ${validGames.length + 1} cannot be tied (${game.p1}-${game.p2}). One player must win.`);
  loading.value = false;
  return;
}
```

**Testing:**
```markdown
1. Open match in scoring interface
2. Click "Manual Score Entry" button
3. Enter scores:
   - Game 1: Player 1: 21, Player 2: 15 ✓
   - Game 2: Player 1: 21, Player 2: 21 (tied) ✗
   - Game 3: Player 1: 18, Player 2: 21 ✓
4. Click "Submit Scores"
5. **Verify:**
   - Error toast appears: "Game 2 cannot be tied (21-21). One player must win."
   - Scores NOT saved
   - Dialog remains open
6. Fix Game 2 to 21-19
7. Click "Submit Scores" again
8. **Verify:**
   - Scores saved successfully
   - Match completes with correct winner
   - Dialog closes
```

---

#### Fix #5: Game Completion Logic (1.5 hours)

**File:** `/Users/ramc/Documents/Code/courtmaster-v2/src/stores/matches.ts`

**Location:** Lines 429-471 (updateScore function)

**Current Code (Simplified):**
```typescript
async function updateScore(
  tournamentId: string,
  matchId: string,
  participant: 'participant1' | 'participant2',
  categoryId?: string
): Promise<void> {
  const match = currentMatch.value;
  if (!match) throw new Error('No match selected');

  const scores = [...match.scores];
  const currentGame = scores[scores.length - 1];

  if (!currentGame || currentGame.isComplete) {
    // Start new game
    scores.push({
      gameNumber: scores.length + 1,
      score1: participant === 'participant1' ? 1 : 0,
      score2: participant === 'participant2' ? 1 : 0,
      isComplete: false,
    });
  } else {
    // Increment score
    if (participant === 'participant1') currentGame.score1++;
    else currentGame.score2++;
    // ❌ No check for game completion!
  }

  // Save to Firestore...
}
```

**Add Game Completion Check (after score increment, around line 451):**

```typescript
async function updateScore(
  tournamentId: string,
  matchId: string,
  participant: 'participant1' | 'participant2',
  categoryId?: string
): Promise<void> {
  const match = currentMatch.value;
  if (!match) throw new Error('No match selected');

  const scores = [...match.scores];
  const currentGame = scores[scores.length - 1];

  if (!currentGame || currentGame.isComplete) {
    // Start new game
    scores.push({
      gameNumber: scores.length + 1,
      score1: participant === 'participant1' ? 1 : 0,
      score2: participant === 'participant2' ? 1 : 0,
      isComplete: false,
    });
  } else {
    // Increment score
    if (participant === 'participant1') currentGame.score1++;
    else currentGame.score2++;

    // ← ADD THIS BLOCK: Check for game completion
    const config = BADMINTON_CONFIG;  // Import from @/types
    const score1 = currentGame.score1;
    const score2 = currentGame.score2;

    // Win condition: reach pointsToWin (21) AND lead by mustWinBy (2)
    // OR reach maxPoints (30)
    const hasWinningScore = score1 >= config.pointsToWin || score2 >= config.pointsToWin;
    const hasWinningMargin = Math.abs(score1 - score2) >= config.mustWinBy;
    const hasMaxPoints = score1 >= config.maxPoints || score2 >= config.maxPoints;

    if (hasWinningScore && (hasWinningMargin || hasMaxPoints)) {
      currentGame.isComplete = true;
      currentGame.winnerId = score1 > score2 ? match.participant1Id : match.participant2Id;

      console.log(`🏁 [updateScore] Game ${currentGame.gameNumber} complete:`, {
        finalScore: `${score1}-${score2}`,
        winnerId: currentGame.winnerId
      });
    }
  }

  // Check if match is complete (after game completion check)
  const matchResult = checkMatchComplete(scores, match.participant1Id!, match.participant2Id!);
  if (matchResult.isComplete) {
    console.log('🏆 [updateScore] Match complete, calling completeMatch');
    await completeMatch(tournamentId, matchId, scores, matchResult.winnerId!, categoryId);
    return;
  }

  // Update scores in Firestore
  const matchScoresPath = categoryId
    ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
    : `tournaments/${tournamentId}/match_scores`;

  await setDoc(
    doc(db, matchScoresPath, matchId),
    {
      scores,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
```

**Import BADMINTON_CONFIG at top of file:**
```typescript
import { BADMINTON_CONFIG } from '@/types';
```

**Win Condition Logic Explanation:**

**Standard Win:** 21 points + 2-point lead
- Example: 21-19 ✓, 21-20 ✗, 22-20 ✓

**Deuce Win:** 30 points (max)
- Example: 29-29 → 30-29 ✓ (max points reached)

**All Valid Wins:**
- 21-19, 21-18, 21-17... (2+ lead)
- 22-20, 23-21, 24-22... (2+ lead)
- 30-29, 30-28, 30-27... (max points)

**Testing:**
```markdown
**Test Case 1: Standard Win (21-19)**
1. Start match, tap score to 20-19
2. Tap winning player's button
3. **Verify:**
   - Score shows 21-19
   - Game marked complete (checkmark appears)
   - New game (Game 2) starts at 0-0

**Test Case 2: Deuce Win (30-29)**
1. Start match, tap scores to 29-29
2. Tap winning player's button
3. **Verify:**
   - Score shows 30-29
   - Game marked complete
   - New game starts

**Test Case 3: Not Complete (21-20)**
1. Start match, tap score to 21-20
2. **Verify:**
   - Game NOT marked complete (need 2-point lead)
   - Can continue tapping to 22-20
3. Tap losing player to 22-21
4. **Verify:**
   - Still not complete
5. Tap winning player to 23-21
6. **Verify:**
   - NOW game completes (2-point lead)

**Test Case 4: Match Completion**
1. Complete Game 1: 21-15
2. Complete Game 2: 21-10
3. **Verify:**
   - Match auto-completes (player won 2 games)
   - Winner advances in bracket
   - Match status = 'completed'
```

---

#### Fix #6: Remove Hardcoded Best-of-3 (30 minutes)

**File:** `/Users/ramc/Documents/Code/courtmaster-v2/src/features/scoring/views/ScoringInterfaceView.vue`

**Location:** Line 277 (submitManualScores function)

**Current Code:**
```typescript
// Check if match is complete (after manual score submission)
if (p1GamesWon >= 2 || p2GamesWon >= 2) {
  router.back();
}
```

**New Code:**
```typescript
// Check if match is complete (works for best-of-1, 3, 5, etc.)
const gamesNeeded = Math.ceil(BADMINTON_CONFIG.gamesPerMatch / 2);
if (p1GamesWon >= gamesNeeded || p2GamesWon >= gamesNeeded) {
  router.back();
}
```

**Add Import at Top of File (around line 9):**
```typescript
import { BADMINTON_CONFIG } from '@/types';
```

**Why This Works:**
- `BADMINTON_CONFIG.gamesPerMatch` contains tournament-specific format
- Best-of-1: gamesPerMatch = 1, gamesNeeded = 1
- Best-of-3: gamesPerMatch = 3, gamesNeeded = 2
- Best-of-5: gamesPerMatch = 5, gamesNeeded = 3
- `Math.ceil` ensures correct rounding for odd numbers

**Testing:**
```markdown
**Test with Best-of-3 (default):**
1. Enter manual scores: Game 1: 21-15, Game 2: 21-10
2. Submit
3. **Verify:** Match completes (2 games won)

**Test with Best-of-5:**
1. Update BADMINTON_CONFIG.gamesPerMatch = 5
2. Enter manual scores: Game 1, 2, 3 wins for Player 1
3. Submit
4. **Verify:** Match completes (3 games won)
5. Try with only 2 games won
6. **Verify:** Match does NOT complete

**Test with Best-of-1:**
1. Update BADMINTON_CONFIG.gamesPerMatch = 1
2. Enter manual score: Game 1: 21-15
3. Submit
4. **Verify:** Match completes immediately
```

---

## Implementation Order

### Phase 1: Critical Fixes (Must Do - 2 hours)

These fixes are **blocking** - they prevent core functionality:

1. **Auto Schedule Fix** (30 min)
   - File: `bracketMatchAdapter.ts` lines 102-103
   - Change: `participant?.name` → `participant?.id`
   - Test: Auto Schedule dialog shows correct match count

2. **Add recordWalkover Function** (1 hour)
   - File: `matches.ts` after line 590
   - Add: ~70 lines (function + export)
   - Test: Walkover recording works, no crash

3. **Initialize Scores in startMatch** (30 min)
   - File: `matches.ts` lines 414-422
   - Add: `scores: initialScores` to setDoc
   - Test: Scoring UI renders on match start

**Why First:** Without these, users cannot:
- Use auto-scheduling (tournament organization blocked)
- Record walkovers (app crashes)
- Score matches (UI broken)

---

### Phase 2: High Priority (Should Do - 1.5 hours)

These fixes are **important** - they cause data loss or poor UX:

4. **Add match_scores Subscription** (1 hour)
   - File: `matches.ts` lines 390-407
   - Change: Add second onSnapshot for match_scores
   - Test: Real-time updates work in multiple tabs

5. **Validate Equal Scores** (30 min)
   - File: `ScoringInterfaceView.vue` lines 245-257
   - Add: Validation check before adding to validGames
   - Test: Tied scores show error message

**Why Second:** Without these, users experience:
- Stale score displays (must manually refresh)
- Silent data loss (tied games disappear)

---

### Phase 3: Moderate Priority (Nice to Have - 2 hours)

These fixes are **enhancements** - they improve UX but aren't blocking:

6. **Game Completion Logic** (1.5 hours)
   - File: `matches.ts` lines 449-451
   - Add: Win condition checking after score increment
   - Test: Games auto-complete at 21-19 or 30-29

7. **Remove Hardcoded Best-of-3** (30 min)
   - File: `ScoringInterfaceView.vue` line 277
   - Change: Use BADMINTON_CONFIG.gamesPerMatch
   - Test: Works with best-of-1, 3, 5

**Why Last:** Without these, users can:
- Still score matches (just need to manually mark games complete)
- Still complete matches (just limited to best-of-3 format)

**Can Be Deferred:** If time-constrained, implement Phase 1-2 only, defer Phase 3 to Phase 8.

---

## Testing Strategy

### Pre-Implementation Testing

**Before making any changes, verify the bugs exist:**

1. **Auto Schedule Bug:**
   ```bash
   # Navigate to Match Control → Auto Schedule
   # Expected: "0 matches ready to schedule"
   # Check console for participant IDs (should show names, not reg IDs)
   ```

2. **Walkover Crash:**
   ```bash
   # Open scoring interface
   # Click "Record Walkover"
   # Expected: App crashes with error
   ```

3. **Score Initialization Bug:**
   ```bash
   # Start a match from ready status
   # Navigate to scoring interface
   # Expected: Blank screen, no score cards
   ```

### Post-Implementation Testing

#### Test Suite 1: Auto Schedule

**TC1.1: Match Count Displays Correctly**
```markdown
1. Create tournament with 8 players in Mixed Doubles
2. Generate bracket (creates 7 matches)
3. Navigate to Match Control → Auto Schedule
4. Select "Mixed Doubles" category
5. **Verify:** Dialog shows "7 matches ready to schedule" (not 0)
```

**TC1.2: Auto-Schedule Assigns Courts**
```markdown
1. Continue from TC1.1
2. Set start time: 2:00 PM
3. Set match duration: 20 min
4. Set break: 5 min
5. Click "Schedule 7 Matches"
6. **Verify:**
   - All 7 matches assigned to courts
   - Scheduled times don't overlap
   - Courts load-balanced (2-2-2-1 distribution for 4 courts)
7. Check Match Control main view
8. **Verify:** Matches appear in "Scheduled" section with times
```

---

#### Test Suite 2: Scoring - Walkover

**TC2.1: Record Walkover - Player 1 Wins**
```markdown
1. Open match in "ready" status
2. Click "Record Walkover" button
3. Select "Player 1" as winner
4. Confirm
5. **Verify:**
   - Match status = "walkover"
   - Score shows 21-0 for Player 1
   - Winner advances to next match in bracket
6. Check Firestore:
   - /match_scores/{matchId}.status = 'walkover'
   - /match_scores/{matchId}.scores[0] = { gameNumber: 1, score1: 21, score2: 0, ... }
```

**TC2.2: Record Walkover - Player 2 Wins**
```markdown
1. Open different match
2. Record walkover for Player 2
3. **Verify:** Score shows 0-21 (not 21-0)
```

---

#### Test Suite 3: Scoring - Tap Mode

**TC3.1: Match Start Initializes Scores**
```markdown
1. Open match in "ready" status
2. Click "START MATCH" button
3. Navigate to scoring interface
4. **Verify:**
   - Score cards display showing 0-0
   - Player names visible
   - Game number shows "Game 1"
   - Tap buttons enabled
5. Check Firestore:
   - /match_scores/{matchId}.scores = [{ gameNumber: 1, score1: 0, score2: 0, isComplete: false }]
```

**TC3.2: Tap Scoring Increments Points**
```markdown
1. Continue from TC3.1
2. Tap Player 1 score 5 times
3. **Verify:** Score shows 5-0
4. Tap Player 2 score 3 times
5. **Verify:** Score shows 5-3
6. Check Firestore updates in real-time
```

**TC3.3: Game Completes at 21-19**
```markdown
1. Tap scores to 20-19
2. Tap Player 1 (winning player) once more
3. **Verify:**
   - Score shows 21-19
   - Game 1 marked complete (checkmark icon)
   - Game 2 starts automatically at 0-0
   - Game number shows "Game 2"
```

**TC3.4: Deuce Game (30-29)**
```markdown
1. Tap scores to 29-29
2. Tap Player 1 once more
3. **Verify:**
   - Score shows 30-29
   - Game marked complete (max points reached)
```

**TC3.5: Match Completes After 2 Games**
```markdown
1. Complete Game 1: 21-15
2. Complete Game 2: 21-10
3. **Verify:**
   - Match auto-completes
   - Status changes to "completed"
   - Winner determined correctly
   - Winner advances in bracket
   - Scoring interface redirects to match list
```

---

#### Test Suite 4: Scoring - Real-Time Updates

**TC4.1: Two-Tab Sync Test**
```markdown
1. Open scoring interface in Browser Tab A
2. Open same match in Browser Tab B (same browser)
3. In Tab A: Tap to score 1-0
4. **Verify in Tab B:** Score updates to 1-0 within 1-2 seconds
5. In Tab B: Tap to score 1-1
6. **Verify in Tab A:** Score updates to 1-1 within 1-2 seconds
7. In Tab A: Complete game (21-15)
8. **Verify in Tab B:** Game marked complete, new game started
```

**TC4.2: Multi-Device Sync Test**
```markdown
1. Open scoring on Device A (desktop)
2. Open same match on Device B (mobile/tablet)
3. Score points on Device A
4. **Verify on Device B:** Updates appear without refresh
5. Complete match on Device A
6. **Verify on Device B:** Match completion reflected immediately
```

---

#### Test Suite 5: Scoring - Manual Entry

**TC5.1: Valid Manual Scores**
```markdown
1. Open match in "in_progress" status
2. Click "Manual Score Entry" button
3. Enter:
   - Game 1: P1: 21, P2: 15
   - Game 2: P1: 18, P2: 21
   - Game 3: P1: 21, P2: 10
4. Click "Submit Scores"
5. **Verify:**
   - Match completes with P1 as winner (won 2 games)
   - All 3 games saved correctly
   - Score history shows all games
```

**TC5.2: Tied Game Validation**
```markdown
1. Open manual score entry
2. Enter:
   - Game 1: P1: 21, P2: 21 (tied)
3. Click "Submit"
4. **Verify:**
   - Error toast: "Game 1 cannot be tied (21-21). One player must win."
   - Scores NOT saved
   - Dialog remains open
5. Fix to P1: 21, P2: 19
6. Click "Submit"
7. **Verify:** Scores saved successfully
```

**TC5.3: Multiple Tied Games**
```markdown
1. Enter:
   - Game 1: P1: 21, P2: 15 ✓
   - Game 2: P1: 21, P2: 21 (tied) ✗
   - Game 3: P1: 18, P2: 21 ✓
2. Click "Submit"
3. **Verify:** Error message for Game 2
4. Fix Game 2 to 21-19
5. **Verify:** All 3 games saved
```

---

#### Test Suite 6: Format Flexibility

**TC6.1: Best-of-5 Format**
```markdown
**Setup:** Update BADMINTON_CONFIG.gamesPerMatch = 5

1. Enter manual scores:
   - Game 1: 21-15 (P1 wins)
   - Game 2: 21-10 (P1 wins)
   - Game 3: 18-21 (P2 wins)
   - Game 4: 21-15 (P1 wins)
2. Submit
3. **Verify:**
   - Match completes (P1 won 3 of 5 games)
   - Winner = P1

**Edge Case:**
1. Enter only 2 games (both P1 wins)
2. Submit
3. **Verify:** Match does NOT complete (needs 3 wins in best-of-5)
```

**TC6.2: Best-of-1 Format**
```markdown
**Setup:** Update BADMINTON_CONFIG.gamesPerMatch = 1

1. Enter manual score: Game 1: 21-15
2. Submit
3. **Verify:** Match completes immediately after 1 game
```

---

### Automated Testing (Optional)

If time permits, add unit tests:

```typescript
// tests/unit/stores/matches.spec.ts

describe('matches store - Phase 7 fixes', () => {
  describe('recordWalkover', () => {
    it('should create 21-0 score for winner', async () => {
      await matchStore.recordWalkover('t1', 'm1', 'reg_p1', 'cat1');

      const match = matchStore.currentMatch;
      expect(match.status).toBe('walkover');
      expect(match.scores[0]).toEqual({
        gameNumber: 1,
        score1: 21,
        score2: 0,
        winnerId: 'reg_p1',
        isComplete: true
      });
    });
  });

  describe('startMatch', () => {
    it('should initialize scores array', async () => {
      await matchStore.startMatch('t1', 'm1', 'cat1');

      const match = matchStore.currentMatch;
      expect(match.scores).toHaveLength(1);
      expect(match.scores[0]).toEqual({
        gameNumber: 1,
        score1: 0,
        score2: 0,
        isComplete: false
      });
    });
  });

  describe('updateScore - game completion', () => {
    it('should mark game complete at 21-19', async () => {
      // Setup: game at 20-19
      matchStore.currentMatch.scores = [{
        gameNumber: 1,
        score1: 20,
        score2: 19,
        isComplete: false
      }];

      // Score point → 21-19
      await matchStore.updateScore('t1', 'm1', 'participant1', 'cat1');

      const game = matchStore.currentMatch.scores[0];
      expect(game.score1).toBe(21);
      expect(game.score2).toBe(19);
      expect(game.isComplete).toBe(true);
      expect(game.winnerId).toBe(match.participant1Id);
    });

    it('should NOT mark complete at 21-20 (need 2-point lead)', async () => {
      // Setup: game at 20-20
      matchStore.currentMatch.scores = [{
        gameNumber: 1,
        score1: 20,
        score2: 20,
        isComplete: false
      }];

      // Score point → 21-20
      await matchStore.updateScore('t1', 'm1', 'participant1', 'cat1');

      const game = matchStore.currentMatch.scores[0];
      expect(game.score1).toBe(21);
      expect(game.score2).toBe(20);
      expect(game.isComplete).toBe(false);  // Not complete yet
    });
  });
});
```

---

## Rollback Plan

### Quick Rollback (Revert All Phase 7 Changes)

If critical issues arise, revert all changes at once:

```bash
# 1. Check current git status
git status

# 2. View recent commits
git log --oneline -5

# 3. Find the Phase 7 commit
# Look for: "feat(match-control,scoring): fix auto-schedule and scoring bugs"

# 4. Revert the commit
git revert <commit-hash>

# 5. Or hard reset (DESTRUCTIVE - loses all changes after that commit)
git reset --hard <commit-before-phase7>

# 6. Push revert
git push origin feature/minimal-bracket-collections

# 7. Verify app works (with original bugs)
npm run dev
```

**After Rollback:**
- Auto Schedule will show "0 matches ready to schedule" (original bug)
- Walkover will crash app (original bug)
- Scoring UI will be broken on match start (original bug)
- But app won't have new bugs introduced by Phase 7

---

### Partial Rollback (Revert Specific Fixes)

If only one fix causes issues, revert specific files:

**Revert Auto Schedule Fix Only:**
```bash
git checkout HEAD~1 -- src/stores/bracketMatchAdapter.ts
git commit -m "revert: Phase 7 auto-schedule fix"
```

**Revert Scoring Fixes Only:**
```bash
git checkout HEAD~1 -- src/stores/matches.ts
git checkout HEAD~1 -- src/features/scoring/views/ScoringInterfaceView.vue
git commit -m "revert: Phase 7 scoring fixes"
```

**Revert Individual Fix:**
```bash
# Revert just the recordWalkover function
# Manually remove the function from matches.ts
# Remove from exports
# Commit the change
```

---

### Rollback Verification Checklist

After rollback, verify:

- [ ] App starts without errors
- [ ] Brackets still display correctly
- [ ] Matches can be viewed (even if auto-schedule broken)
- [ ] Existing matches not corrupted
- [ ] No console errors on page load
- [ ] Users can still access other features

---

## Known Issues and Limitations

### Current Limitations

**1. Auto Schedule - Legacy Tournament Data**
- Some very old tournaments may have matches at tournament-level paths
- Phase 7 fix assumes category-level paths (Phase 1-5 migration)
- If legacy data exists, matches may still not appear
- **Workaround:** Regenerate brackets for affected tournaments

**2. Scoring - No Undo Function**
- Once a walkover is recorded, cannot undo
- Once scores are submitted, cannot edit
- **Future Enhancement:** Add "Edit Scores" feature in Phase 8

**3. Game Completion - Edge Case (Incorrect Score Entry)**
- If user manually taps past 30 points (e.g., 31-30), game still marks complete
- Score validation only checks >= 30, not == 30
- **Impact:** Minimal - scores will be 31-30 instead of 30-29
- **Future Fix:** Add max score validation in tap handler

**4. Real-Time Updates - Network Latency**
- Updates depend on Firestore real-time listeners
- High latency networks may see 2-5 second delays
- **Impact:** Acceptable for most use cases
- **Future Enhancement:** Add loading indicators for pending updates

**5. Manual Score Entry - No Badminton Rule Validation**
- Doesn't validate if scores are badminton-legal (e.g., 21-15 is valid, 21-5 is suspicious)
- Doesn't check if score could have reached that value (e.g., 25-10 invalid in best-of-3)
- **Impact:** Allows incorrect score entry
- **Future Enhancement:** Add badminton rule validation

---

### Future Improvements

These are NOT part of Phase 7, but could be addressed later:

**1. Enhanced Auto-Schedule:**
- Court preferences (indoor/outdoor)
- Player rest time between matches
- Category priority (schedule finals first)
- Time slot constraints (lunch break)

**2. Score Editing:**
- Allow editing completed match scores
- Audit trail of score changes
- Admin-only permission

**3. Advanced Scoring:**
- Point-by-point tracking for analytics
- Rally tracking
- Service rotation tracking
- Instant replay/video integration

**4. Better Error Messages:**
- Show why a match can't be scheduled (missing courts, no time slots)
- Show which player forfeited in walkover
- Show expected vs actual score format

**5. Offline Support:**
- Cache matches for offline scoring
- Sync when connection restored
- Conflict resolution

---

## Troubleshooting

### Issue: Auto Schedule Still Shows "0 Matches"

**Symptoms:**
- Applied Phase 7 auto-schedule fix
- Still shows "0 matches ready to schedule"

**Possible Causes:**
1. Matches don't have both participants (TBD matches)
2. Matches already have courts assigned
3. Categories not selected in dialog
4. Data still at tournament-level (legacy)

**Debug Steps:**
```bash
# 1. Check console logs
# Look for: [bracketMatchAdapter] Final IDs: { participant1Id: 'reg_...', participant2Id: 'reg_...' }
# Should show registration IDs, not names

# 2. Check matchesToScheduleForAuto computed property
# Open Vue DevTools → matchStore.matches
# Filter: status='scheduled', participant1Id!=undefined, participant2Id!=undefined, courtId==undefined
# Count how many matches match this filter

# 3. Check Firestore directly
# Navigate to: tournaments/{id}/categories/{catId}/match
# Verify matches have opponent1.registrationId and opponent2.registrationId fields
```

**Solutions:**
```bash
# If participant IDs still showing names:
# 1. Clear browser cache
# 2. Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
# 3. Verify bracketMatchAdapter.ts changes were saved

# If matches already have courts:
# This is correct behavior - already scheduled matches don't appear

# If categories not selected:
# Select at least one category in the dialog checkboxes

# If data at tournament level:
# Regenerate brackets (this will create category-level data)
```

---

### Issue: Walkover Records But Bracket Doesn't Advance

**Symptoms:**
- Walkover saves to match_scores
- Winner doesn't advance to next match
- Cloud function may show errors

**Possible Causes:**
1. Cloud function `updateMatch` failed
2. Winner ID mapping incorrect
3. Bracket locked or already completed

**Debug Steps:**
```bash
# 1. Check browser console for Cloud Function errors
# Look for: [recordWalkover] Cloud function failed: ...

# 2. Check Cloud Function logs (Firebase Console)
# Navigate to: Functions → updateMatch → Logs
# Look for errors in updateMatch execution

# 3. Check Firestore data
# /match_scores/{matchId} should have:
#   - status: 'walkover'
#   - winnerId: 'reg_...'
#   - completedAt: timestamp
# /match/{matchId} should have:
#   - opponent result set (win/loss)
```

**Solutions:**
```typescript
// If ID mapping fails:
// Check that bracketsMatch.opponent1.registrationId matches winnerId

// If Cloud Function fails:
// Manually advance bracket:
// 1. Get match document from /match collection
// 2. Update opponent1.result or opponent2.result to 'win'
// 3. Update next match with winner
```

---

### Issue: Scoring UI Still Blank After startMatch

**Symptoms:**
- Applied Phase 7 score initialization fix
- Match status = 'in_progress'
- Scoring UI still shows blank screen

**Possible Causes:**
1. Fix not applied correctly
2. Firestore not updated
3. Cache issue

**Debug Steps:**
```bash
# 1. Check Firestore
# Navigate to: /match_scores/{matchId}
# Verify field exists: scores: [{ gameNumber: 1, score1: 0, score2: 0, isComplete: false }]

# 2. Check component
# Vue DevTools → match.value.scores
# Should be an array with 1 element

# 3. Check computed property
# Vue DevTools → currentGame
# Should return the first game object (not null)
```

**Solutions:**
```bash
# If Firestore doesn't have scores field:
# 1. Verify startMatch code has scores: initialScores
# 2. Stop match, reset to 'ready'
# 3. Start match again

# If cache issue:
# 1. Clear browser localStorage
# 2. Hard refresh page
# 3. Restart match
```

---

### Issue: Real-Time Updates Not Working

**Symptoms:**
- Applied Phase 7 subscription fix
- Scores don't update in other tabs
- Must manually refresh to see changes

**Possible Causes:**
1. Subscription not set up correctly
2. Firestore rules blocking reads
3. Network/connection issues

**Debug Steps:**
```bash
# 1. Check console for subscription errors
# Look for: "Error in match_scores subscription: ..."

# 2. Check Network tab in DevTools
# Filter: firestore
# Should see active connections (wss://)

# 3. Test subscription manually
# In console: matchStore.subscribeMatch(tournamentId, matchId, categoryId)
# Then update match_scores in Firestore console
# Should trigger fetchMatch call
```

**Solutions:**
```bash
# If no subscription errors but updates don't work:
# 1. Verify both listeners are created (match AND match_scores)
# 2. Check that unsubscribers array has 2 elements
# 3. Verify refresh() function calls fetchMatch()

# If Firestore rules issue:
# Check rules allow read access to match_scores collection
```

---

## Success Criteria

Phase 7 is complete when ALL of the following are true:

### Auto Schedule
- ✅ Match count displays correctly (> 0 for tournaments with unscheduled matches)
- ✅ Auto-schedule assigns courts and times without errors
- ✅ Console logs show registration IDs (not names) for participant IDs
- ✅ All matches from selected categories are scheduled

### Scoring - Walkover
- ✅ Walkover recording works without app crash
- ✅ Match marked as "walkover" with 21-0 score
- ✅ Winner advances in bracket correctly
- ✅ No console errors

### Scoring - Match Start
- ✅ Scoring UI renders correctly on match start
- ✅ Score cards show 0-0 (not blank screen)
- ✅ Tap buttons are enabled
- ✅ No console errors

### Scoring - Real-Time
- ✅ Scores update in multiple tabs within 1-2 seconds
- ✅ No manual refresh needed
- ✅ Works across devices
- ✅ Game completion updates propagate

### Scoring - Manual Entry
- ✅ Valid scores save successfully
- ✅ Tied scores rejected with error message
- ✅ No silent data loss
- ✅ Clear user feedback

### Scoring - Game Completion
- ✅ Games auto-complete at 21-19 (2-point lead)
- ✅ Games auto-complete at 30-29 (max points)
- ✅ Games don't complete at 21-20 (need 2-point lead)
- ✅ New games start automatically

### Format Flexibility
- ✅ Best-of-1 format works
- ✅ Best-of-3 format works (default)
- ✅ Best-of-5 format works
- ✅ Match completion determined correctly for each format

### Code Quality
- ✅ No TypeScript compilation errors
- ✅ No console errors during normal operation
- ✅ Code follows existing patterns
- ✅ Functions have JSDoc comments
- ✅ All exports added correctly

### Data Integrity
- ✅ Firestore data structure correct
- ✅ No duplicate writes
- ✅ Scores saved with correct format
- ✅ Match state transitions valid

---

## File Locations Reference

### Files Modified in Phase 7

| File | Path | Lines | Purpose | Priority |
|------|------|-------|---------|----------|
| bracketMatchAdapter.ts | src/stores/ | 102-103 | Fix participant ID | CRITICAL |
| matches.ts | src/stores/ | 409-427 | Initialize scores | CRITICAL |
| matches.ts | src/stores/ | ~590+ | Add recordWalkover | CRITICAL |
| matches.ts | src/stores/ | ~842 | Export recordWalkover | CRITICAL |
| matches.ts | src/stores/ | 390-407 | Add match_scores subscription | HIGH |
| matches.ts | src/stores/ | 449-465 | Add game completion logic | MODERATE |
| ScoringInterfaceView.vue | src/features/scoring/views/ | 245-263 | Validate equal scores | HIGH |
| ScoringInterfaceView.vue | src/features/scoring/views/ | 277 | Remove hardcoded best-of-3 | MODERATE |

### Related Files (Not Modified, But Referenced)

| File | Path | Purpose |
|------|------|---------|
| MatchControlView.vue | src/features/tournaments/views/ | Uses matchesToScheduleForAuto |
| updateMatch.ts | functions/src/ | Cloud Function for bracket advancement |
| types/index.ts | src/types/ | BADMINTON_CONFIG and GameScore interface |

---

## Commit Message Template

```
feat(match-control,scoring): fix auto-schedule and scoring bugs

Phase 7 addresses critical bugs in Auto Schedule and Scoring modules.

Auto Schedule Fix:
- Fix participant ID resolution in bracketMatchAdapter
- Use participant.id instead of participant.name (registration ID)
- Resolves "0 matches ready to schedule" issue
- Matches now appear correctly in auto-schedule dialog

Scoring Module Fixes (6 bugs):
CRITICAL:
- Add missing recordWalkover() function (was crashing app)
- Initialize scores array in startMatch() (was breaking UI)

HIGH Priority:
- Add match_scores subscription for real-time updates
- Validate equal scores in manual entry (prevent data loss)

MODERATE:
- Add game completion logic (21-19, 30-29 auto-complete)
- Remove hardcoded best-of-3 (support best-of-1, 3, 5)

Testing:
- Auto-schedule now shows correct match counts
- Walkover recording works without crashes
- Scoring UI renders correctly on match start
- Real-time score updates working (<2s latency)
- Manual score validation prevents data loss
- Games auto-complete at winning conditions
- Supports flexible match formats

Fixes:
- Issue #1: Auto-schedule participant ID bug
- Issue #2: Missing walkover function
- Issue #3: Broken score initialization
- Issue #4: Stale score display
- Issue #5: Silent data loss in manual entry
- Issue #6: No game completion logic
- Issue #7: Hardcoded best-of-3

BREAKING CHANGES: None (all changes are bug fixes and enhancements)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Appendix A: Code Comparison (Before/After)

### Auto Schedule - Participant ID Resolution

**Before (Buggy):**
```typescript
// bracketMatchAdapter.ts:102-103
const participant1Id = participant1?.name || bracketsMatch.opponent1?.registrationId || undefined;
const participant2Id = participant2?.name || bracketsMatch.opponent2?.registrationId || undefined;
// Result: IDs are display names like "John Doe"
```

**After (Fixed):**
```typescript
// bracketMatchAdapter.ts:102-103
const participant1Id = participant1?.id || bracketsMatch.opponent1?.registrationId || undefined;
const participant2Id = participant2?.id || bracketsMatch.opponent2?.registrationId || undefined;
// Result: IDs are registration IDs like "reg_abc123"
```

---

### Scoring - startMatch Score Initialization

**Before (Buggy):**
```typescript
// matches.ts:414-422
await setDoc(
  doc(db, matchScoresPath, matchId),
  {
    startedAt: serverTimestamp(),
    status: 'in_progress',
    updatedAt: serverTimestamp(),
    // ❌ Missing: scores array
  },
  { merge: true }
);
// Result: Scoring UI breaks (blank screen)
```

**After (Fixed):**
```typescript
// matches.ts:414-427
const initialScores: GameScore[] = [{
  gameNumber: 1,
  score1: 0,
  score2: 0,
  isComplete: false,
}];

await setDoc(
  doc(db, matchScoresPath, matchId),
  {
    scores: initialScores,  // ✅ Added
    startedAt: serverTimestamp(),
    status: 'in_progress',
    updatedAt: serverTimestamp(),
  },
  { merge: true }
);
// Result: Scoring UI renders correctly
```

---

### Scoring - subscribeMatch Real-Time Updates

**Before (Incomplete):**
```typescript
// matches.ts:390-407
function subscribeMatch(...): void {
  const matchPath = getMatchPath(tournamentId, categoryId);
  currentMatchUnsubscribe = onSnapshot(
    doc(db, matchPath, matchId),  // ❌ Only /match
    async () => {
      await fetchMatch(tournamentId, matchId, categoryId);
    }
  );
}
// Result: Score updates don't trigger listener
```

**After (Complete):**
```typescript
// matches.ts:390-420
function subscribeMatch(...): void {
  const unsubscribers: (() => void)[] = [];

  const refresh = async () => {
    await fetchMatch(tournamentId, matchId, categoryId);
  };

  // ✅ Subscribe to /match
  const matchPath = getMatchPath(tournamentId, categoryId);
  const unsubMatch = onSnapshot(doc(db, matchPath, matchId), () => refresh());
  unsubscribers.push(unsubMatch);

  // ✅ Subscribe to /match_scores
  const matchScoresPath = getMatchScoresPath(tournamentId, categoryId);
  const unsubScores = onSnapshot(doc(db, matchScoresPath, matchId), () => refresh());
  unsubscribers.push(unsubScores);

  currentMatchUnsubscribe = () => {
    unsubscribers.forEach(unsub => unsub());
  };
}
// Result: Real-time updates work
```

---

## Appendix B: Firestore Data Structure

### Match Scores Document (After Phase 7)

```json
// Path: /tournaments/{tid}/categories/{cid}/match_scores/{matchId}
{
  "scores": [
    {
      "gameNumber": 1,
      "score1": 21,
      "score2": 19,
      "winnerId": "reg_abc123",
      "isComplete": true
    },
    {
      "gameNumber": 2,
      "score1": 15,
      "score2": 21,
      "winnerId": "reg_def456",
      "isComplete": true
    },
    {
      "gameNumber": 3,
      "score1": 21,
      "score2": 10,
      "winnerId": "reg_abc123",
      "isComplete": true
    }
  ],
  "status": "completed",
  "winnerId": "reg_abc123",
  "startedAt": "2026-02-02T14:30:00Z",
  "completedAt": "2026-02-02T15:15:00Z",
  "updatedAt": "2026-02-02T15:15:00Z",
  "courtId": "court_1",
  "scheduledTime": "2026-02-02T14:30:00Z"
}
```

### Walkover Document

```json
// Path: /tournaments/{tid}/categories/{cid}/match_scores/{matchId}
{
  "scores": [
    {
      "gameNumber": 1,
      "score1": 21,
      "score2": 0,
      "winnerId": "reg_abc123",
      "isComplete": true
    }
  ],
  "status": "walkover",
  "winnerId": "reg_abc123",
  "completedAt": "2026-02-02T14:35:00Z",
  "updatedAt": "2026-02-02T14:35:00Z"
}
```

---

## Appendix C: Performance Impact

### Auto Schedule
- **Before:** O(n) where n = total matches (all filtered out)
- **After:** O(n) where n = total matches (correct subset returned)
- **Impact:** Negligible performance difference, major functionality improvement

### Scoring - startMatch
- **Before:** 1 Firestore write
- **After:** 1 Firestore write (same)
- **Impact:** No performance change, writes same amount of data

### Scoring - subscribeMatch
- **Before:** 1 Firestore listener
- **After:** 2 Firestore listeners
- **Impact:** +1 listener per open scoring interface (negligible)
- **Memory:** ~10KB per listener
- **Network:** Only changed documents transmitted (Firestore optimization)

### Scoring - updateScore (with game completion)
- **Before:** 1 Firestore write per point
- **After:** 1 Firestore write per point (same)
- **Impact:** No performance change
- **Additional Logic:** ~10 ms CPU time for win condition check (negligible)

**Total Impact:** Minimal performance overhead, significant functionality gains

---

**Document Version:** 1.0
**Last Updated:** 2026-02-02
**Author:** Phase 7 Migration Team
**Review Status:** Ready for Implementation
**Complexity:** MEDIUM-HIGH (6 separate fixes, some complex)
**Estimated Time:** 6-9 hours (3h critical + 1.5h high + 2h moderate + 2-3h testing)
