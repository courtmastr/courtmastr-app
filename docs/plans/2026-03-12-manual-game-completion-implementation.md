# Manual Game Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change live point-by-point scoring so a legal winning score does not auto-complete a game; the scorer must explicitly tap `Complete Game`, with only `Undo Point` or confirmation allowed while completion is pending.

**Architecture:** Keep the existing scorer, score validation rules, and persisted `GameScore` shape. Move game finalization out of `updateScore()` and into a new explicit store action that confirms the current game, while the UI derives a pending-completion state from the current score and locks further point entry until the scorer confirms or undoes.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Vuetify 3, Pinia, TypeScript, Vitest, Playwright.

---

## Guardrails

1. Read `docs/coding-patterns/CODING_PATTERNS.md` before each coding task.
2. Apply `test-driven-development` on every behavior change.
3. Follow `systematic-debugging` if any test or live verification fails.
4. Keep the fix scoped to scoring behavior. Do not refactor unrelated tournament logic.
5. Run `npm run build:log` after each code task, and record baseline fingerprints if they remain unchanged.

---

### Task 1: Lock The Store Behavior With Failing Tests

**Files:**
- Modify: `tests/unit/matches.scoring.store.test.ts`
- Modify: `tests/unit/ScoringInterfaceView.volunteerMode.test.ts`

**Step 1: Write the failing store test for pending completion**

Add a focused test that proves `updateScore()` no longer auto-completes the current game when the score reaches a valid finish:

```typescript
it('does not auto-complete a game when point scoring reaches a legal finish', async () => {
  // arrange currentMatch with game 1 at 20-19
  // call updateScore(..., 'participant1')
  // assert current game remains isComplete === false
  // assert match status remains in_progress
});
```

**Step 2: Write the failing store test for explicit completion**

```typescript
it('completes the current game only when completeCurrentGame is called', async () => {
  // arrange currentMatch with game 1 at 21-19 and isComplete false
  // call completeCurrentGame(...)
  // assert winnerId and isComplete are set for the current game
  // assert next game exists or match completes, depending on fixture
});
```

**Step 3: Write the failing UI test for locked taps at game point**

In `tests/unit/ScoringInterfaceView.volunteerMode.test.ts`, add a test that mounts the scorer with a current game already at a legal winning score and asserts:

1. `Complete Game` is visible
2. point taps are locked
3. `Undo Point` remains available

Use a minimal mocked store surface rather than broad integration.

**Step 4: Run tests to verify red**

Run: `npm run test:log -- --run tests/unit/matches.scoring.store.test.ts tests/unit/ScoringInterfaceView.volunteerMode.test.ts`  
Expected: FAIL because the store still auto-completes games and the UI has no explicit completion state.

**Step 5: Commit the red tests**

```bash
git add tests/unit/matches.scoring.store.test.ts tests/unit/ScoringInterfaceView.volunteerMode.test.ts
git commit -m "test(scoring): capture explicit game completion behavior"
```

---

### Task 2: Move Game Finalization Out Of `updateScore()`

**Files:**
- Modify: `src/stores/matches.ts`
- Test: `tests/unit/matches.scoring.store.test.ts`

**Step 1: Add a pure helper for current-game completion readiness**

Inside `src/stores/matches.ts`, add a small helper that derives whether the current game is legally finishable:

```typescript
function getPendingGameResult(
  game: GameScore,
  participant1Id: string,
  participant2Id: string,
  config: ScoringConfig,
): { canComplete: boolean; winnerId?: string } {
  const validation = validateCompletedGameScore(game.score1, game.score2, config);
  if (!validation.isValid) return { canComplete: false };

  return {
    canComplete: true,
    winnerId: game.score1 > game.score2 ? participant1Id : participant2Id,
  };
}
```

**Step 2: Change `updateScore()` to stop auto-completing games**

In [matches.ts](/Users/ramc/Documents/Code/courtmaster-v2/src/stores/matches.ts), remove the branch that currently sets:

```typescript
currentGame.isComplete = true;
currentGame.winnerId = ...
```

Instead:

1. increment the score
2. persist the updated live scores as `in_progress`
3. leave the current game incomplete

**Step 3: Add `completeCurrentGame()`**

Add a new store action:

```typescript
async function completeCurrentGame(
  tournamentId: string,
  matchId: string,
  categoryId?: string,
  levelId?: string,
): Promise<void> {
  // fetch/resolve current match
  // validate current game has a legal winning score
  // mark current game complete and set winnerId
  // determine whether the match is now complete
  // if match complete -> existing completeMatch path
  // else persist scores as in_progress and keep match live
}
```

**Step 4: Ensure extra point taps are blocked by store logic**

If the current game is in a legal finish state but not complete yet, `updateScore()` should no-op or throw a controlled error instead of adding another point.

**Step 5: Run tests to verify green**

Run: `npm run test:log -- --run tests/unit/matches.scoring.store.test.ts`  
Expected: PASS.

Run: `npm run build:log`  
Expected: existing baseline `20d5d4c3` only.

**Step 6: Commit**

```bash
git add src/stores/matches.ts tests/unit/matches.scoring.store.test.ts docs/debug-kb/20d5d4c3.md
git commit -m "fix(scoring): require explicit game completion"
```

---

### Task 3: Add The Pending-Completion UI To The Scoring Screen

**Files:**
- Modify: `src/features/scoring/views/ScoringInterfaceView.vue`
- Test: `tests/unit/ScoringInterfaceView.volunteerMode.test.ts`

**Step 1: Add computed pending-completion state**

In [ScoringInterfaceView.vue](/Users/ramc/Documents/Code/courtmaster-v2/src/features/scoring/views/ScoringInterfaceView.vue), derive:

```typescript
const currentGamePendingCompletion = computed(() => {
  // use currentGame + scoring config + validateCompletedGameScore
});

const scoreEntryLocked = computed(() => currentGamePendingCompletion.value.canComplete);
```

**Step 2: Gate tap handlers**

Update `addPoint()` so it returns early when `scoreEntryLocked` is true.

**Step 3: Add explicit `Complete Game` action**

Render a large primary button below the score cards:

```vue
<v-btn
  v-if="currentGamePendingCompletion.canComplete"
  color="primary"
  block
  size="x-large"
  @click="completeCurrentGame"
>
  Complete Game
</v-btn>
```

Wire it to the new store action.

**Step 4: Add helper copy**

Add short status text under the score cards:

```vue
<p v-if="currentGamePendingCompletion.canComplete" class="text-body-2 text-warning">
  Game point reached. Confirm to complete the game, or undo the last point.
</p>
```

**Step 5: Preserve mobile-first behavior**

Keep:

1. stacked mobile cards
2. large undo buttons
3. manual fallback secondary

Ensure the new `Complete Game` CTA is visually separated from the tap targets.

**Step 6: Run tests**

Run: `npm run test:log -- --run tests/unit/ScoringInterfaceView.volunteerMode.test.ts`  
Expected: PASS.

Run: `npm run build:log`  
Expected: existing baseline `20d5d4c3` only.

**Step 7: Commit**

```bash
git add src/features/scoring/views/ScoringInterfaceView.vue tests/unit/ScoringInterfaceView.volunteerMode.test.ts docs/debug-kb/20d5d4c3.md
git commit -m "feat(scoring): add explicit complete-game confirmation"
```

---

### Task 4: Verify Volunteer/Mobile Flow End To End

**Files:**
- Modify: `tests/unit/MatchListView.volunteerMode.test.ts` if navigation assertions need adjustment
- Optional test note only: no production-file changes unless defects are found

**Step 1: Run focused unit coverage**

Run:

```bash
npm run test:log -- --run \
  tests/unit/matches.scoring.store.test.ts \
  tests/unit/ScoringInterfaceView.volunteerMode.test.ts \
  tests/unit/MatchListView.volunteerMode.test.ts \
  tests/unit/router-guards-auth.test.ts
```

Expected: PASS.

**Step 2: Run live browser verification on localhost**

Use Playwright against `http://localhost:3000` and verify:

1. volunteer PIN entry reaches `/scoring-kiosk`
2. `Score` opens the volunteer scoring screen
3. a score can reach game point without auto-finishing
4. extra point taps are blocked at game point
5. `Undo Point` unlocks scoring again
6. `Complete Game` explicitly advances the game
7. final-game completion still returns to `/scoring-kiosk`

Capture a mobile-width screenshot during the pending-completion state.

**Step 3: Run final required checks**

Run:

```bash
npm --prefix functions run build:log
npm run build:log
npm run lint:log
```

Expected:

1. functions build PASS
2. app build returns only baseline `20d5d4c3` unless separately fixed
3. lint returns only baseline `41fece39` unless separately fixed

**Step 4: Update docs**

If a new bug pattern is discovered during implementation, add it to:

- `docs/coding-patterns/CODING_PATTERNS.md`
- `docs/debug-kb/<fingerprint>.md`

**Step 5: Commit**

```bash
git add docs/coding-patterns/CODING_PATTERNS.md docs/debug-kb/*.md docs/debug-kb/index.yml
git commit -m "test(scoring): verify explicit game completion flow"
```

---

### Task 5: Final Review And Handoff

**Files:**
- No new files unless verification uncovers defects

**Step 1: Review for accidental scope creep**

Check that only these areas changed:

1. scoring store behavior
2. scoring screen UI
3. related unit tests
4. required KB/pattern docs

**Step 2: Prepare summary**

Include:

1. files changed
2. commands run
3. fingerprints handled
4. live verification evidence
5. any remaining baseline blockers

**Step 3: Commit final cleanup if needed**

```bash
git add <scoped-files>
git commit -m "chore(scoring): finalize explicit game completion flow"
```
