# Phase 4: Fix Matches Display

**Duration:** 2-3 hours | **Status:** 🔄 In Progress

---

## Overview

Fix the "No data available" issue in the MATCHES tab by updating remaining match store functions to use category-level paths where brackets are storing data.

**Root Cause:** Bracket generator stores data at `tournaments/{id}/categories/{catId}/_data/match`, but some match store functions still query at `tournaments/{id}/match`.

**Solution:** Update remaining match store functions to accept optional categoryId and use category-level paths with `/_data/` subdirectory.

---

## Current Status (What's Already Done)

### ✅ Already Completed

**Helper functions added** (lines 34-44 in matches.ts):
- `getMatchScoresPath(tournamentId, categoryId?)` - Returns correct path with `/_data/`
- `getMatchPath(tournamentId, categoryId?)` - Returns correct path with `/_data/`

**Functions updated with optional categoryId parameter:**
- ✅ `fetchMatches()` - Using `/_data/` paths
- ✅ `subscribeMatches()` - Using `/_data/` paths
- ✅ `startMatch()` - Optional categoryId parameter
- ✅ `updateScore()` - Optional categoryId parameter
- ✅ `decrementScore()` - Optional categoryId parameter
- ✅ `completeMatch()` - Optional categoryId parameter (assumed)
- ✅ `resetMatch()` - Optional categoryId parameter (assumed)
- ✅ `assignMatchToCourt()` - Optional categoryId parameter (assumed)

### ❌ Remaining Work (5 Functions + Components)

**Functions that still need categoryId parameter:**
1. `fetchMatch()` (line 209-252) - 3 hardcoded paths
2. `subscribeMatch()` (line 255-271) - 1 hardcoded path
3. `markMatchReady()` (line 510-533) - 3 hardcoded paths
4. `calculateWinner()` (line 535-571) - calls fetchMatch and completeMatch
5. `submitManualScores()` (line 573-617) - 1 hardcoded path

**Components that need categoryId passed:**
- `TournamentDashboardView.vue` - subscribeMatches call (line 109)
- 8+ other components using match store functions

---

## Path Convention

The codebase uses `/_data/` subdirectory for category-level bracket storage:

### Category-Level Paths (Used by bracket generator):
```
tournaments/{tournamentId}/categories/{categoryId}/_data/stage
tournaments/{tournamentId}/categories/{categoryId}/_data/match
tournaments/{tournamentId}/categories/{categoryId}/_data/match_scores
```

### Tournament-Level Paths (Fallback):
```
tournaments/{tournamentId}/stage
tournaments/{tournamentId}/match
tournaments/{tournamentId}/match_scores
```

### Helper Functions (Already in code):
```typescript
// lines 34-44 in matches.ts
function getMatchScoresPath(tournamentId: string, categoryId?: string): string {
  return categoryId
    ? `tournaments/${tournamentId}/categories/${categoryId}/_data/match_scores`
    : `tournaments/${tournamentId}/match_scores`;
}

function getMatchPath(tournamentId: string, categoryId?: string): string {
  return categoryId
    ? `tournaments/${tournamentId}/categories/${categoryId}/_data/match`
    : `tournaments/${tournamentId}/match`;
}
```

---

## Prerequisites

- [x] Phase 1, 2, and 3 complete
- [x] Brackets are generating successfully
- [x] Data exists in Firestore at category level with `/_data/` paths
- [x] Helper functions `getMatchPath()` and `getMatchScoresPath()` exist
- [ ] Identify categoryId being used in current tournament: _______________

---

## Step 4.1: Update fetchMatch() ⏱️ 15 min

**Goal:** Add optional categoryId parameter and update 3 hardcoded paths

**File:** [src/stores/matches.ts](../../src/stores/matches.ts) (lines 209-252)

### Current Signature
```typescript
async function fetchMatch(tournamentId: string, matchId: string): Promise<void>
```

### Hardcoded Paths to Fix
- Line 214: `tournaments/${tournamentId}/match`
- Line 219: `tournaments/${tournamentId}/stage`
- Line 234: `tournaments/${tournamentId}/match_scores`

### Implementation

<details>
<summary><strong>📝 Complete Implementation</strong></summary>

Replace the entire `fetchMatch` function with:

```typescript
async function fetchMatch(
  tournamentId: string,
  matchId: string,
  categoryId?: string
): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    // Use helper functions for paths
    const matchPath = getMatchPath(tournamentId, categoryId);
    const matchDoc = await getDoc(doc(db, matchPath, matchId));
    if (!matchDoc.exists()) throw new Error('Match not found');

    const bMatch = { ...matchDoc.data(), id: matchDoc.id } as BracketsMatch;

    // Stage path with /_data/
    const stagePath = categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}/_data/stage`
      : `tournaments/${tournamentId}/stage`;
    const stageDoc = await getDoc(doc(db, stagePath, bMatch.stage_id));

    // Registrations stay at tournament level (not category-specific)
    const registrationSnap = await getDocs(
      collection(db, `tournaments/${tournamentId}/registrations`)
    );
    const registrations = registrationSnap.docs.map(d =>
      ({ id: d.id, ...d.data() })
    ) as Registration[];

    const stage = stageDoc.data() as any;
    const matchCategoryId = stage ? stage.tournament_id : categoryId || '';

    const adapted = adaptBracketsMatchToLegacyMatch(
      bMatch,
      registrations,
      matchCategoryId,
      tournamentId
    );

    if (adapted) {
      // Use helper for match_scores path
      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId);
      const scoreDoc = await getDoc(doc(db, matchScoresPath, matchId));
      if (scoreDoc.exists()) {
        const scoreData = scoreDoc.data();
        adapted.scores = scoreData.scores || [];
        if (scoreData.courtId) adapted.courtId = scoreData.courtId;
        if (scoreData.scheduledTime) {
          adapted.scheduledTime = scoreData.scheduledTime instanceof Timestamp
            ? scoreData.scheduledTime.toDate()
            : scoreData.scheduledTime;
        }
      }

      currentMatch.value = adapted;
    } else {
      throw new Error('Match found but invalid or empty');
    }

  } catch (err) {
    console.error('Error fetching match:', err);
    error.value = 'Failed to load match';
    throw err;
  } finally {
    loading.value = false;
  }
}
```

</details>

### Verification
- [ ] Save file
- [ ] No TypeScript errors
- [ ] `npm run build` succeeds

### Commit
```bash
git add src/stores/matches.ts
git commit -m "feat(phase4): add categoryId to fetchMatch function

- Add optional categoryId parameter
- Use helper functions for paths
- Support category-level /_data/ paths
- Part of Phase 4: Fix Matches Display

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

---

## Step 4.2: Update subscribeMatch() ⏱️ 10 min

**Goal:** Add optional categoryId parameter and update path

**File:** [src/stores/matches.ts](../../src/stores/matches.ts) (lines 255-271)

### Current Signature
```typescript
function subscribeMatch(tournamentId: string, matchId: string): void
```

### Hardcoded Path to Fix
- Line 262: `tournaments/${tournamentId}/match`

### Implementation

<details>
<summary><strong>📝 Complete Implementation</strong></summary>

Replace the entire `subscribeMatch` function with:

```typescript
function subscribeMatch(
  tournamentId: string,
  matchId: string,
  categoryId?: string
): void {
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

</details>

### Verification
- [ ] Save file
- [ ] No TypeScript errors

### Commit
```bash
git add src/stores/matches.ts
git commit -m "feat(phase4): add categoryId to subscribeMatch function

- Add optional categoryId parameter
- Use getMatchPath helper
- Pass categoryId to fetchMatch
- Part of Phase 4: Fix Matches Display

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

---

## Step 4.3: Update markMatchReady() ⏱️ 15 min

**Goal:** Add optional categoryId parameter and update 3 hardcoded paths

**File:** [src/stores/matches.ts](../../src/stores/matches.ts) (lines 510-533)

### Current Signature
```typescript
async function markMatchReady(tournamentId: string, matchId: string): Promise<void>
```

### Hardcoded Paths to Fix
- Line 513: `tournaments/${tournamentId}/match_scores`
- Line 521: `tournaments/${tournamentId}/match_scores`
- Line 524: `tournaments/${tournamentId}/courts` (stays tournament-level)

### Implementation

<details>
<summary><strong>📝 Complete Implementation</strong></summary>

Replace the entire `markMatchReady` function with:

```typescript
async function markMatchReady(
  tournamentId: string,
  matchId: string,
  categoryId?: string
): Promise<void> {
  try {
    const matchScoresPath = getMatchScoresPath(tournamentId, categoryId);

    await setDoc(
      doc(db, matchScoresPath, matchId),
      {
        status: 'ready',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Get court assignment
    const courtSnap = await getDoc(doc(db, matchScoresPath, matchId));
    const courtId = courtSnap.data()?.courtId;

    // Courts remain at tournament level (not category-specific)
    if (courtId) {
      await updateDoc(doc(db, `tournaments/${tournamentId}/courts`, courtId), {
        currentMatchId: matchId,
        status: 'in_use',
      });
    }
  } catch (err) {
    console.error('Error marking match ready:', err);
    throw err;
  }
}
```

</details>

### Verification
- [ ] Save file
- [ ] No TypeScript errors

### Commit
```bash
git add src/stores/matches.ts
git commit -m "feat(phase4): add categoryId to markMatchReady function

- Add optional categoryId parameter
- Use getMatchScoresPath helper
- Courts remain at tournament level
- Part of Phase 4: Fix Matches Display

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

---

## Step 4.4: Update calculateWinner() ⏱️ 10 min

**Goal:** Add optional categoryId parameter and pass to sub-functions

**File:** [src/stores/matches.ts](../../src/stores/matches.ts) (lines 535-571)

### Current Signature
```typescript
async function calculateWinner(tournamentId: string, matchId: string): Promise<void>
```

### Changes Needed
- Add categoryId parameter
- Pass categoryId to `fetchMatch()` (line 537)
- Pass categoryId to `completeMatch()` (line 566)

### Implementation

<details>
<summary><strong>📝 Complete Implementation</strong></summary>

Replace the entire `calculateWinner` function with:

```typescript
async function calculateWinner(
  tournamentId: string,
  matchId: string,
  categoryId?: string
): Promise<void> {
  try {
    await fetchMatch(tournamentId, matchId, categoryId);

    const matchData = currentMatch.value;
    if (!matchData) throw new Error('Match not found');

    const participant1Id = matchData.participant1Id;
    const participant2Id = matchData.participant2Id;

    if (!participant1Id || !participant2Id) {
      throw new Error('Match is missing participants');
    }

    const games = matchData.scores;
    const gamesNeeded = Math.ceil(games.length / 2);

    let p1Wins = 0;
    let p2Wins = 0;

    for (const game of games) {
      if (game.winnerId === participant1Id) p1Wins++;
      else if (game.winnerId === participant2Id) p2Wins++;
    }

    const winnerId = p1Wins >= gamesNeeded
      ? participant1Id
      : (p2Wins >= gamesNeeded ? participant2Id : null);

    if (!winnerId) {
      throw new Error('Could not determine winner from scores');
    }

    await completeMatch(tournamentId, matchId, games, winnerId, categoryId);
  } catch (err) {
    console.error('Error calculating winner:', err);
    throw err;
  }
}
```

</details>

### Verification
- [ ] Save file
- [ ] No TypeScript errors

### Commit
```bash
git add src/stores/matches.ts
git commit -m "feat(phase4): add categoryId to calculateWinner function

- Add optional categoryId parameter
- Pass categoryId to fetchMatch and completeMatch
- Part of Phase 4: Fix Matches Display

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

---

## Step 4.5: Update submitManualScores() ⏱️ 10 min

**Goal:** Add optional categoryId parameter and update hardcoded path

**File:** [src/stores/matches.ts](../../src/stores/matches.ts) (lines 573-617)

### Current Signature
```typescript
async function submitManualScores(
  tournamentId: string,
  matchId: string,
  games: GameScore[]
): Promise<void>
```

### Hardcoded Path to Fix
- Line 605: `tournaments/${tournamentId}/match_scores`

### Changes Needed
- Add categoryId parameter
- Pass categoryId to `fetchMatch()` (line 579)
- Pass categoryId to `completeMatch()` (line 602)
- Use helper for path on line 605

### Implementation

<details>
<summary><strong>📝 Complete Implementation</strong></summary>

Replace the entire `submitManualScores` function with:

```typescript
async function submitManualScores(
  tournamentId: string,
  matchId: string,
  games: GameScore[],
  categoryId?: string
): Promise<void> {
  try {
    await fetchMatch(tournamentId, matchId, categoryId);
    if (!currentMatch.value) throw new Error('Match not found');

    const matchData = currentMatch.value;
    const participant1Id = matchData.participant1Id;
    const participant2Id = matchData.participant2Id;

    if (!participant1Id || !participant2Id) {
      throw new Error('Match is missing participants');
    }

    let p1Wins = 0;
    let p2Wins = 0;
    for (const game of games) {
      if (game.winnerId === participant1Id) p1Wins++;
      else if (game.winnerId === participant2Id) p2Wins++;
    }

    const gamesNeeded = Math.ceil(BADMINTON_CONFIG.gamesPerMatch / 2);
    const isMatchComplete = p1Wins >= gamesNeeded || p2Wins >= gamesNeeded;
    const winnerId = p1Wins >= gamesNeeded
      ? participant1Id
      : (p2Wins >= gamesNeeded ? participant2Id : null);

    if (isMatchComplete && winnerId) {
      await completeMatch(tournamentId, matchId, games, winnerId, categoryId);
    } else {
      const matchScoresPath = getMatchScoresPath(tournamentId, categoryId);
      await setDoc(
        doc(db, matchScoresPath, matchId),
        {
          scores: games,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.error('Error submitting manual scores:', err);
    throw err;
  }
}
```

</details>

### Verification
- [ ] Save file
- [ ] No TypeScript errors
- [ ] `npm run build` succeeds

### Commit
```bash
git add src/stores/matches.ts
git commit -m "feat(phase4): add categoryId to submitManualScores function

- Add optional categoryId parameter
- Use getMatchScoresPath helper
- Pass categoryId to fetchMatch and completeMatch
- Part of Phase 4: Fix Matches Display

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

---

## Step 4.6: Update TournamentDashboardView.vue ⏱️ 20 min

**Goal:** Pass categoryId to subscribeMatches

**File:** [src/features/tournaments/views/TournamentDashboardView.vue](../../src/features/tournaments/views/TournamentDashboardView.vue)

### Current Code (line 109)
```typescript
matchStore.subscribeMatches(tournamentId.value);
```

### Changes Needed
1. Add `activeCategory` computed property
2. Watch for category changes
3. Pass categoryId to subscribeMatches

### Implementation

<details>
<summary><strong>📝 Code Changes</strong></summary>

**1. Add activeCategory computed** (add after `selectedCategory` ref, around line 50-60):

```typescript
// Track active category for match data queries
const activeCategory = computed(() => {
  // Use selectedCategory if available, otherwise check route query
  if (selectedCategory.value) {
    return selectedCategory.value;
  }
  const categoryQuery = route.query.category;
  return typeof categoryQuery === 'string' ? categoryQuery : null;
});
```

**2. Replace subscribeMatches call in onMounted** (around line 106-116):

```typescript
onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);

  // Subscribe to matches for active category
  watch(
    [tournamentId, activeCategory],
    ([tid, catId]) => {
      if (tid && catId) {
        matchStore.subscribeMatches(tid, catId);
      }
    },
    { immediate: true }
  );

  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);

  if (categories.value.length > 0) {
    selectedCategory.value = categories.value[0].id;
  }
});
```

</details>

### Verification
- [ ] Save file
- [ ] No TypeScript errors
- [ ] App runs: `npm run dev`
- [ ] No console errors

### Commit
```bash
git add src/features/tournaments/views/TournamentDashboardView.vue
git commit -m "feat(phase4): pass categoryId to matches store in dashboard

- Add activeCategory computed from selectedCategory/route
- Watch for category changes and resubscribe
- Pass categoryId to subscribeMatches
- Part of Phase 4: Fix Matches Display

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

---

## Step 4.7: Update All Component Callers ⏱️ 45 min

**Goal:** Find and update all components calling match store functions

### Strategy

1. Search for all components using match store functions
2. Identify where categoryId is available in each component
3. Pass categoryId to each function call

### Files to Check

Run grep to find all callers:
```bash
grep -rn "fetchMatch\|subscribeMatch\|startMatch\|updateScore\|completeMatch\|markMatchReady\|calculateWinner\|submitManualScores" src/features/ src/components/ --include="*.vue"
```

**Known files from grep results:**
- `src/features/brackets/components/DoubleEliminationBracket.vue`
- `src/features/scoring/views/MatchListView.vue`
- `src/features/tournaments/views/MatchControlView.vue`
- `src/features/scoring/views/ScoringInterfaceView.vue`
- `src/features/public/views/PublicLiveScoresView.vue`
- `src/features/brackets/components/BracketView.vue`
- `src/features/public/views/PublicScoringView.vue`
- `src/features/brackets/components/RoundRobinStandings.vue`

### For Each Component

**a. Identify categoryId source:**
- From route params: `route.params.categoryId`
- From route query: `route.query.category`
- From component props
- From match object: `match.categoryId`
- From parent computed/ref

**b. Add categoryId computed if needed:**
```typescript
const categoryId = computed(() => {
  return route.query.category as string ||
         route.params.categoryId as string ||
         currentMatch.value?.categoryId ||
         null;
});
```

**c. Update all function calls:**
```typescript
// Example patterns:
await matchStore.fetchMatch(tournamentId, matchId, categoryId.value);
matchStore.subscribeMatch(tournamentId, matchId, categoryId.value);
await matchStore.startMatch(tournamentId, matchId, categoryId.value);
await matchStore.updateScore(tournamentId, matchId, participant, categoryId.value);
await matchStore.completeMatch(tournamentId, matchId, scores, winnerId, categoryId.value);
await matchStore.markMatchReady(tournamentId, matchId, categoryId.value);
await matchStore.calculateWinner(tournamentId, matchId, categoryId.value);
await matchStore.submitManualScores(tournamentId, matchId, games, categoryId.value);
```

### Component Update Checklist

| File | categoryId Source | Functions Updated | Status |
|------|------------------|-------------------|--------|
| DoubleEliminationBracket.vue | | | [ ] |
| MatchListView.vue | | | [ ] |
| MatchControlView.vue | | | [ ] |
| ScoringInterfaceView.vue | | | [ ] |
| PublicLiveScoresView.vue | | | [ ] |
| BracketView.vue | | | [ ] |
| PublicScoringView.vue | | | [ ] |
| RoundRobinStandings.vue | | | [ ] |

### Verification
- [ ] All components updated
- [ ] No TypeScript errors
- [ ] `npm run build` succeeds

### Commit
```bash
git add src/features/ src/components/
git commit -m "feat(phase4): update all match store callers with categoryId

- Updated 8 components to pass categoryId
- Added categoryId computed where needed
- Ensured all match operations have category context
- Part of Phase 4: Fix Matches Display

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

- [ ] Commit hash: _______________

---

## Phase 4 Complete Checklist

### Code Implementation

- [ ] **Step 4.1:** fetchMatch updated ✅
- [ ] **Step 4.2:** subscribeMatch updated ✅
- [ ] **Step 4.3:** markMatchReady updated ✅
- [ ] **Step 4.4:** calculateWinner updated ✅
- [ ] **Step 4.5:** submitManualScores updated ✅
- [ ] **Step 4.6:** TournamentDashboardView updated ✅
- [ ] **Step 4.7:** All component callers updated ✅
- [ ] All changes built successfully
- [ ] No TypeScript errors

---

## Verification & Testing

### 1. Code Compilation
```bash
npm run build
```
- [ ] No TypeScript errors
- [ ] Build succeeds

### 2. Check Firestore Data Structure
- [ ] Open Firestore emulator: http://localhost:4000
- [ ] Navigate to `tournaments/{id}/categories/{categoryId}/_data/`
- [ ] Verify collections exist: `match`, `match_scores`, `stage`
- [ ] Note categoryId for testing: _______________

### 3. Test Matches Display
- [ ] Start application: `npm run dev`
- [ ] Navigate to tournament dashboard
- [ ] Click MATCHES tab
- [ ] ✅ **Expected:** Matches appear in table (not "No data available")
- [ ] ✅ **Verify:** All columns populated: Match #, Category, Round, Participants, Score, Court, Status

### 4. Test Match Operations

**Assign Court:**
- [ ] Click "Assign Court" on a match
- [ ] Select a court
- [ ] ✅ Verify court assignment saves and displays immediately

**Start Match:**
- [ ] Click "Start Match"
- [ ] ✅ Verify status changes to "In Progress"

**Update Score:**
- [ ] Use scoring interface to update score
- [ ] ✅ Verify score updates in real-time

**Complete Match:**
- [ ] Finish scoring a match
- [ ] ✅ Verify status changes to "Completed"
- [ ] ✅ Verify winner is recorded
- [ ] ✅ Verify winner advances to next match (if applicable)

### 5. Test Real-Time Updates
- [ ] Open two browser windows side-by-side
- [ ] In window 1: Update a match score
- [ ] ✅ In window 2: Verify change appears immediately
- [ ] **Expected:** Real-time synchronization works

### 6. Test Multi-Category
- [ ] Generate brackets for 2+ categories
- [ ] Switch between category tabs/filters
- [ ] ✅ **Expected:** Correct matches display for each category
- [ ] ✅ **Verify:** No cross-category data leakage
- [ ] ✅ **Verify:** Each category shows only its matches

### 7. Console & Network Check
- [ ] Open browser DevTools console
- [ ] Perform match operations
- [ ] ✅ **Check:** No JavaScript errors
- [ ] ✅ **Check:** Network tab shows correct Firestore paths with `/_data/`
- [ ] ✅ **Check:** No 404s or failed requests
- [ ] ✅ **Check:** All queries go to category-level paths

---

## Troubleshooting

### Issue 1: Matches Still Not Showing

**Debug Steps:**
1. Open browser console - look for errors
2. Check Network tab for Firestore requests
3. Verify paths include `/_data/` subdirectory
4. Check if categoryId is null/undefined

**Common Causes:**
- categoryId not being passed from component
- Brackets not generated yet
- Data in wrong Firestore location

**Fix:**
```typescript
// Add debug logging
console.log('Fetching matches for:', { tournamentId, categoryId });
```

### Issue 2: CategoryId Not Available

**Symptom:** Components can't get categoryId

**Solution:**
```typescript
// Try multiple sources
const categoryId = computed(() => {
  return route.query.category as string ||
         route.params.categoryId as string ||
         currentMatch.value?.categoryId ||
         props.categoryId ||
         null;
});
```

### Issue 3: Real-Time Updates Not Working

**Check:**
1. Firestore subscription paths include categoryId
2. categoryId passed to subscribeMatches
3. Unsubscribe isn't called too early
4. Browser console for subscription errors

**Fix:**
```typescript
// Ensure categoryId is passed
matchStore.subscribeMatches(tournamentId.value, categoryId.value);
```

### Issue 4: Wrong Data Showing

**Symptom:** Seeing matches from wrong category

**Debug:**
```typescript
// Add logging in fetchMatches
console.log('Query paths:', { stagePath, matchPath, matchScoresPath });
```

**Solution:**
- Verify activeCategory computed is correct
- Check if categoryId changes trigger re-fetch
- Ensure watcher has `immediate: true`

---

## Rollback Plan

If Phase 4 needs to be rolled back:

```bash
# View Phase 4 commits
git log --oneline --grep="phase4" -10

# Revert specific steps (replace with actual hashes)
git revert <step-4.7-hash>
git revert <step-4.6-hash>
git revert <step-4.5-hash>
git revert <step-4.4-hash>
git revert <step-4.3-hash>
git revert <step-4.2-hash>
git revert <step-4.1-hash>

# Or revert entire phase at once
git revert <first-hash>..<last-hash>

# Rebuild
npm run build
cd functions && npm run build
```

---

## Success Criteria

Phase 4 is complete when:

- [ ] All match store functions accept optional categoryId
- [ ] All components pass categoryId to match store functions
- [ ] MATCHES tab displays matches correctly (no "No data available")
- [ ] All CRUD operations work (assign court, start, score, complete)
- [ ] Real-time updates work across browser windows
- [ ] Multi-category isolation maintained (no data leakage)
- [ ] No console errors
- [ ] No TypeScript compilation errors
- [ ] No failed Firestore requests (404s)

---

## Estimated Time

| Step | Time | Status |
|------|------|--------|
| Step 4.1: fetchMatch | 15 min | ⏳ |
| Step 4.2: subscribeMatch | 10 min | ⏳ |
| Step 4.3: markMatchReady | 15 min | ⏳ |
| Step 4.4: calculateWinner | 10 min | ⏳ |
| Step 4.5: submitManualScores | 10 min | ⏳ |
| Step 4.6: TournamentDashboardView | 20 min | ⏳ |
| Step 4.7: Update all callers | 45 min | ⏳ |
| Testing & Verification | 30 min | ⏳ |
| **Total** | **~2.5 hours** | |

---

## Next Steps After Phase 4

1. Update [MASTER_PLAN.md](MASTER_PLAN.md) with Phase 4 completion
2. Commit all Phase 4 changes with proper messages
3. Test full tournament workflow end-to-end
4. Update architecture documentation if needed
5. Consider adding automated tests for category-level paths
6. Document any lessons learned or edge cases found

---

**Phase 4 Sign-Off**

- Completed By: _______________
- Date: _______________
- Issues Encountered: _______________
- Commits: _______________
- Verification Complete: [ ]

---
