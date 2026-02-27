# Feature Test Closure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add direct automated test coverage (including edge cases) for all 20 documented features using a risk-tiered max-confidence strategy.

**Architecture:** Build a layered test suite where every feature gets unit + component + emulator/integration validation, then add Playwright only for high-risk user journeys. Reuse existing test utilities where possible, and introduce shared emulator helpers to keep tests deterministic. Execute in small TDD steps with frequent commits and update `docs/feature-rules/*.md` coverage status at the end.

**Tech Stack:** Vitest, @vue/test-utils, happy-dom, Firebase Emulator Suite, Playwright, Vue 3 + TypeScript + Pinia.

---

### Task 1: Create Shared Test Infrastructure

**Files:**
- Create: `tests/integration/setup/emulator.ts`
- Create: `tests/integration/setup/firestore-fixtures.ts`
- Create: `tests/integration/setup/auth-fixtures.ts`
- Create: `tests/unit/helpers/store-mocks.ts`
- Modify: `vitest.config.ts`

**Step 1: Write the failing test**

```ts
// tests/integration/setup/emulator.test.ts
import { describe, it, expect } from 'vitest';
import { getEmulatorApp } from './emulator';

describe('emulator harness', () => {
  it('returns initialized app/services', () => {
    const ctx = getEmulatorApp();
    expect(ctx.db).toBeDefined();
    expect(ctx.auth).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/integration/setup/emulator.test.ts`
Expected: FAIL with module-not-found for `./emulator`.

**Step 3: Write minimal implementation**

```ts
// tests/integration/setup/emulator.ts
export const getEmulatorApp = () => ({ db: {}, auth: {} });
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/integration/setup/emulator.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/integration/setup/emulator.ts tests/integration/setup/firestore-fixtures.ts tests/integration/setup/auth-fixtures.ts tests/unit/helpers/store-mocks.ts vitest.config.ts
git commit -m "test(infra): add shared unit and emulator test harness"
```

### Task 2: Cover Auth And Route Access

**Files:**
- Create: `tests/unit/router-guards-auth.test.ts`
- Modify: `tests/unit/frontDeskRoute.test.ts`
- Modify: `tests/unit/selfCheckInRoute.test.ts`

**Step 1: Write the failing test**

```ts
it('bypasses auth for overlay and obs routes', async () => {
  const result = await runGuard('/overlay/t1/court/c1', { isAuthenticated: false });
  expect(result.type).toBe('allow');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/router-guards-auth.test.ts`
Expected: FAIL (missing helper or incorrect guard behavior assertion).

**Step 3: Write minimal implementation**

```ts
const runGuard = async (path: string, auth: { isAuthenticated: boolean }) => {
  // mount router + mocked auth store, navigate to path, capture redirect/allow
};
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/router-guards-auth.test.ts tests/unit/frontDeskRoute.test.ts tests/unit/selfCheckInRoute.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/router-guards-auth.test.ts tests/unit/frontDeskRoute.test.ts tests/unit/selfCheckInRoute.test.ts
git commit -m "test(auth): cover router guard role and bypass edge cases"
```

### Task 3: Cover Tournament Lifecycle And State

**Files:**
- Create: `tests/unit/tournamentState.test.ts`
- Create: `tests/unit/useTournamentStateAdvance.test.ts`

**Step 1: Write the failing test**

```ts
it('allows emergency unlock BRACKET_LOCKED -> BRACKET_GENERATED only', () => {
  expect(canTransitionTournamentState('BRACKET_LOCKED', 'BRACKET_GENERATED')).toBe(true);
  expect(canTransitionTournamentState('LIVE', 'BRACKET_GENERATED')).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/tournamentState.test.ts`
Expected: FAIL until assertions and imports are wired.

**Step 3: Write minimal implementation**

```ts
// add missing test adapters/mocks only; production logic already exists.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/tournamentState.test.ts tests/unit/useTournamentStateAdvance.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/tournamentState.test.ts tests/unit/useTournamentStateAdvance.test.ts
git commit -m "test(lifecycle): add transition and lock semantics coverage"
```

### Task 4: Cover Tournament Management (Store + Views)

**Files:**
- Create: `tests/unit/tournaments.store.test.ts`
- Create: `tests/unit/TournamentCreateView.test.ts`
- Create: `tests/integration/tournament-management.integration.test.ts`

**Step 1: Write the failing test**

```ts
it('defaults organizerIds to current user when creating tournament', async () => {
  await store.createTournament(basePayloadWithoutOrganizers);
  expect(addDocMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    organizerIds: ['user-1'],
  }));
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/tournaments.store.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// mocking setup for firebase addDoc/getDocs/query and authStore currentUser.id
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/tournaments.store.test.ts tests/unit/TournamentCreateView.test.ts tests/integration/tournament-management.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/tournaments.store.test.ts tests/unit/TournamentCreateView.test.ts tests/integration/tournament-management.integration.test.ts
git commit -m "test(tournament): cover creation defaults, validation, and integration writes"
```

### Task 5: Cover Category Management

**Files:**
- Create: `tests/unit/CategoryManagement.test.ts`
- Create: `tests/integration/category-management.integration.test.ts`

**Step 1: Write the failing test**

```ts
it('stamps checkInClosedAt when check-in is closed', async () => {
  await store.toggleCategoryCheckin('t1', 'cat1', false);
  expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    checkInOpen: false,
    checkInClosedAt: expect.anything(),
  }));
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/CategoryManagement.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// add component/store mocks and assertions for format-specific form behavior.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/CategoryManagement.test.ts tests/integration/category-management.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/CategoryManagement.test.ts tests/integration/category-management.integration.test.ts
git commit -m "test(category): cover check-in toggle, format fields, and persistence"
```

### Task 6: Cover Court Management

**Files:**
- Create: `tests/unit/CourtManagement.test.ts`
- Create: `tests/integration/court-management.integration.test.ts`

**Step 1: Write the failing test**

```ts
it('unassigns court-bound matches when no replacement court exists', async () => {
  const result = await store.setCourtMaintenance('t1', 'court-1');
  expect(result.reassignedMatches[0].newCourtId).toBe('');
  expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ courtId: null }));
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/CourtManagement.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// test fixtures for available courts vs no-court scenarios.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/CourtManagement.test.ts tests/integration/court-management.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/CourtManagement.test.ts tests/integration/court-management.integration.test.ts
git commit -m "test(court): cover maintenance reassignment and restore edge cases"
```

### Task 7: Cover Registration Management

**Files:**
- Create: `tests/unit/registrations.store.test.ts`
- Create: `tests/unit/RegistrationManagementView.test.ts`
- Create: `tests/unit/SelfRegistrationView.test.ts`
- Create: `tests/integration/registration-management.integration.test.ts`

**Step 1: Write the failing test**

```ts
it('rejects duplicate email against local cache and remote snapshot', async () => {
  await expect(store.addPlayer('t1', playerWithExistingEmail)).rejects.toThrow(/already exists/i);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/registrations.store.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// build mocks for local players + getDocs remote check and registration status transitions.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/registrations.store.test.ts tests/unit/RegistrationManagementView.test.ts tests/unit/SelfRegistrationView.test.ts tests/integration/registration-management.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/registrations.store.test.ts tests/unit/RegistrationManagementView.test.ts tests/unit/SelfRegistrationView.test.ts tests/integration/registration-management.integration.test.ts
git commit -m "test(registration): cover duplicate guard, status transitions, and self-registration branches"
```

### Task 8: Cover Front Desk And Self Check-In

**Files:**
- Modify: `tests/unit/useFrontDeskCheckInWorkflow.test.ts`
- Create: `tests/unit/FrontDeskCheckInView.test.ts`
- Create: `tests/unit/SelfCheckInView.test.ts`
- Create: `tests/integration/checkin.integration.test.ts`

**Step 1: Write the failing test**

```ts
it('expires item undo after 5s', async () => {
  vi.useFakeTimers();
  // check in, advance timers >5s, expect undo to throw
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/SelfCheckInView.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// add fake timer based tests and callable mocks for waitingForPartner responses.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/FrontDeskCheckInView.test.ts tests/unit/useSelfCheckIn.test.ts tests/unit/selfCheckInDomain.test.ts tests/unit/SelfCheckInView.test.ts tests/integration/checkin.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/FrontDeskCheckInView.test.ts tests/unit/SelfCheckInView.test.ts tests/integration/checkin.integration.test.ts
git commit -m "test(checkin): cover undo expiries, ambiguity, and kiosk partner flows"
```

### Task 9: Cover Bracket Generation And Pool Leveling

**Files:**
- Create: `tests/unit/useBracketGenerator.logic.test.ts`
- Create: `tests/integration/bracket-generation.integration.test.ts`
- Modify: `tests/unit/poolLeveling.test.ts`
- Create: `tests/integration/pool-leveling.integration.test.ts`

**Step 1: Write the failing test**

```ts
it('blocks elimination generation when pool matches are pending', async () => {
  await expect(generator.generateEliminationFromPool('t1', 'cat1')).rejects.toThrow(/still pending/i);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/useBracketGenerator.logic.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// add storage mocks for stage/match/match_scores and pending pool fixtures.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/useBracketGenerator.logic.test.ts tests/unit/useBracketGenerator.test.ts tests/unit/poolLeveling.test.ts tests/integration/bracket-generation.integration.test.ts tests/integration/pool-leveling.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/useBracketGenerator.logic.test.ts tests/unit/poolLeveling.test.ts tests/integration/bracket-generation.integration.test.ts tests/integration/pool-leveling.integration.test.ts
git commit -m "test(brackets): cover pool pending gate, generation paths, and leveling previews"
```

### Task 10: Cover Time Scheduling And Assignment Gates

**Files:**
- Modify: `tests/unit/timeScheduler.test.ts`
- Modify: `tests/unit/assignmentGate.test.ts`
- Create: `tests/unit/MatchControlView.assignments.test.ts`
- Create: `tests/integration/match-assignment.integration.test.ts`

**Step 1: Write the failing test**

```ts
it('rejects assign-anyway for non-admin', async () => {
  await expect(store.assignMatchToCourt('t1', 'm1', 'c1', 'cat1', undefined, { ignoreCheckInGate: true }))
    .rejects.toThrow(/Only admins/i);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/assignmentGate.test.ts tests/unit/MatchControlView.assignments.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// add auth mock permutations and court maintenance/in-use scenarios.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/timeScheduler.test.ts tests/unit/assignmentGate.test.ts tests/unit/MatchControlView.assignments.test.ts tests/integration/match-assignment.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/timeScheduler.test.ts tests/unit/assignmentGate.test.ts tests/unit/MatchControlView.assignments.test.ts tests/integration/match-assignment.integration.test.ts
git commit -m "test(schedule): cover publish gates, admin override constraints, and assignment side effects"
```

### Task 11: Cover Scoring, Completion, And Correction

**Files:**
- Create: `tests/unit/matches.scoring.store.test.ts`
- Create: `tests/unit/matches.correction.store.test.ts`
- Modify: `tests/unit/scoring.test.ts`
- Create: `tests/integration/scoring-correction.integration.test.ts`

**Step 1: Write the failing test**

```ts
it('releases court when completeMatch succeeds', async () => {
  await store.completeMatch('t1', 'm1', scores, 'reg-1', 'cat1');
  expect(updateDocMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    status: 'available',
    currentMatchId: null,
  }));
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/matches.scoring.store.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// mock fetchMatch, match_scores docs, courts docs, and bracket advancer errors.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/scoring.test.ts tests/unit/matches.scoring.store.test.ts tests/unit/matches.correction.store.test.ts tests/integration/scoring-correction.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/matches.scoring.store.test.ts tests/unit/matches.correction.store.test.ts tests/unit/scoring.test.ts tests/integration/scoring-correction.integration.test.ts
git commit -m "test(scoring): cover completion side effects and correction history/reversal paths"
```

### Task 12: Cover Leaderboard And Tie-Breakers End-To-End

**Files:**
- Modify: `tests/unit/leaderboard.test.ts`
- Modify: `tests/unit/leaderboard-resolve.test.ts`
- Create: `tests/integration/leaderboard.integration.test.ts`

**Step 1: Write the failing test**

```ts
it('applies equal-standing rank sharing when all tie-breakers exhausted', () => {
  const { sorted } = sortWithBWFTiebreaker([a, b, c], []);
  expect(sorted.every((row) => row.rank === 1)).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/leaderboard.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// extend fixtures for head-to-head, normalized GD/PD, equal-standing scenarios.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/leaderboard.test.ts tests/unit/leaderboard-resolve.test.ts tests/integration/leaderboard.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/leaderboard.test.ts tests/unit/leaderboard-resolve.test.ts tests/integration/leaderboard.integration.test.ts
git commit -m "test(leaderboard): close tiebreaker and integration coverage gaps"
```

### Task 13: Cover Reports And Analytics

**Files:**
- Create: `tests/unit/TournamentSummaryView.test.ts`
- Create: `tests/unit/reports.duration-metrics.test.ts`

**Step 1: Write the failing test**

```ts
it('excludes invalid or >720min durations from metrics', () => {
  const stats = buildDurationStats(fixtures);
  expect(stats.excludedCount).toBe(2);
  expect(stats.observedCount).toBe(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/TournamentSummaryView.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// extract small helper for duration stats if needed; assert csv lines from export action.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/TournamentSummaryView.test.ts tests/unit/reports.duration-metrics.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/TournamentSummaryView.test.ts tests/unit/reports.duration-metrics.test.ts
git commit -m "test(reports): add KPI and duration edge-case coverage"
```

### Task 14: Cover Public Views

**Files:**
- Create: `tests/unit/PublicBracketView.test.ts`
- Create: `tests/unit/PublicScheduleView.test.ts`
- Create: `tests/unit/PublicScoringView.test.ts`
- Create: `tests/integration/public-views.integration.test.ts`

**Step 1: Write the failing test**

```ts
it('marks notFound when tournament fetch fails in public bracket view', async () => {
  fetchTournamentMock.mockRejectedValueOnce(new Error('missing'));
  const wrapper = mount(PublicBracketView);
  await flushPromises();
  expect(wrapper.text()).toContain('Tournament not found');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/PublicBracketView.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// add store stubs for schedule publish filtering and public scoring ready->auto-start guard.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/PublicBracketView.test.ts tests/unit/PublicScheduleView.test.ts tests/unit/PublicScoringView.test.ts tests/integration/public-views.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/PublicBracketView.test.ts tests/unit/PublicScheduleView.test.ts tests/unit/PublicScoringView.test.ts tests/integration/public-views.integration.test.ts
git commit -m "test(public): add not-found, publish filter, and scoring edge-case coverage"
```

### Task 15: Cover Overlay And OBS Views

**Files:**
- Create: `tests/unit/OverlayCourtView.test.ts`
- Create: `tests/unit/OverlayTickerView.test.ts`
- Create: `tests/unit/OverlayBoardView.test.ts`
- Create: `tests/unit/ObsScoreboardView.test.ts`
- Create: `tests/unit/ObsScoreBugView.test.ts`

**Step 1: Write the failing test**

```ts
it('prioritizes live over ready state for a court tile', () => {
  const state = resolveCourtDisplayState({ liveMatch, readyMatch });
  expect(state).toBe('live');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/OverlayCourtView.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// isolate and assert state derivation for live/ready/idle and ticker duplication.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/OverlayCourtView.test.ts tests/unit/OverlayTickerView.test.ts tests/unit/OverlayBoardView.test.ts tests/unit/ObsScoreboardView.test.ts tests/unit/ObsScoreBugView.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/OverlayCourtView.test.ts tests/unit/OverlayTickerView.test.ts tests/unit/OverlayBoardView.test.ts tests/unit/ObsScoreboardView.test.ts tests/unit/ObsScoreBugView.test.ts
git commit -m "test(overlay): cover overlay and OBS state/render edge cases"
```

### Task 16: Cover Notifications, Activities, Alerts, And Audit

**Files:**
- Create: `tests/unit/notifications.store.test.ts`
- Create: `tests/unit/activities.store.test.ts`
- Create: `tests/unit/alerts.store.test.ts`
- Create: `tests/unit/audit.store.test.ts`
- Create: `tests/integration/ops-stores.integration.test.ts`

**Step 1: Write the failing test**

```ts
it('shows toast when unread notification arrives in subscription', async () => {
  triggerNotificationSnapshot([{ read: false, message: 'hello' }]);
  expect(showToastSpy).toHaveBeenCalledWith('info', 'hello');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/notifications.store.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// create onSnapshot harness and actor-missing audit assertions.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/notifications.store.test.ts tests/unit/activities.store.test.ts tests/unit/alerts.store.test.ts tests/unit/audit.store.test.ts tests/integration/ops-stores.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/notifications.store.test.ts tests/unit/activities.store.test.ts tests/unit/alerts.store.test.ts tests/unit/audit.store.test.ts tests/integration/ops-stores.integration.test.ts
git commit -m "test(ops): cover notification/activity/alert/audit edge behavior"
```

### Task 17: Cover User Management

**Files:**
- Create: `tests/unit/users.store.test.ts`
- Create: `tests/unit/UserManagementView.test.ts`
- Create: `tests/integration/user-management.integration.test.ts`

**Step 1: Write the failing test**

```ts
it('blocks self-admin-demotion in user management UI', async () => {
  await triggerRoleChange(currentUserId, 'viewer');
  expect(showToastSpy).toHaveBeenCalledWith('error', expect.stringMatching(/cannot remove your own admin role/i));
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/UserManagementView.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// mock authStore.currentUser and assert setUserActive metadata payloads.
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/users.store.test.ts tests/unit/UserManagementView.test.ts tests/integration/user-management.integration.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/users.store.test.ts tests/unit/UserManagementView.test.ts tests/integration/user-management.integration.test.ts
git commit -m "test(users): cover self-protection rules and activation metadata"
```

### Task 18: Add Risk-Tiered Playwright Journeys

**Files:**
- Create: `e2e/p0-auth-and-role-guards.spec.ts`
- Create: `e2e/p0-front-desk-checkin.spec.ts`
- Create: `e2e/p0-self-checkin-kiosk.spec.ts`
- Create: `e2e/p0-match-control-scoring.spec.ts`
- Create: `e2e/p0-score-correction.spec.ts`
- Create: `e2e/p0-public-views.spec.ts`
- Create: `e2e/p0-user-management.spec.ts`

**Step 1: Write the failing test**

```ts
test('non-admin cannot use assign-anyway path', async ({ page }) => {
  await loginAsScorekeeper(page);
  await page.goto('/tournaments/.../match-control');
  await expect(page.getByText('Assign Anyway')).toHaveCount(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/p0-auth-and-role-guards.spec.ts --project=chromium`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
// use existing e2e fixtures/models and seed helpers; add deterministic seed data per scenario.
```

**Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/p0-auth-and-role-guards.spec.ts e2e/p0-front-desk-checkin.spec.ts e2e/p0-self-checkin-kiosk.spec.ts e2e/p0-match-control-scoring.spec.ts e2e/p0-score-correction.spec.ts e2e/p0-public-views.spec.ts e2e/p0-user-management.spec.ts --project=chromium`
Expected: PASS.

**Step 5: Commit**

```bash
git add e2e/p0-auth-and-role-guards.spec.ts e2e/p0-front-desk-checkin.spec.ts e2e/p0-self-checkin-kiosk.spec.ts e2e/p0-match-control-scoring.spec.ts e2e/p0-score-correction.spec.ts e2e/p0-public-views.spec.ts e2e/p0-user-management.spec.ts
git commit -m "test(e2e): add risk-tiered high-confidence user journeys"
```

### Task 19: Update Feature Rule Docs With Final Coverage Status

**Files:**
- Modify: `docs/feature-rules/auth-and-route-access.md`
- Modify: `docs/feature-rules/tournament-lifecycle-and-state.md`
- Modify: `docs/feature-rules/tournament-management.md`
- Modify: `docs/feature-rules/category-management.md`
- Modify: `docs/feature-rules/court-management.md`
- Modify: `docs/feature-rules/registration-management.md`
- Modify: `docs/feature-rules/front-desk-checkin.md`
- Modify: `docs/feature-rules/self-checkin-kiosk.md`
- Modify: `docs/feature-rules/bracket-generation.md`
- Modify: `docs/feature-rules/pool-leveling.md`
- Modify: `docs/feature-rules/time-first-scheduling.md`
- Modify: `docs/feature-rules/match-control-and-assignment-gates.md`
- Modify: `docs/feature-rules/scoring-and-match-completion.md`
- Modify: `docs/feature-rules/score-correction.md`
- Modify: `docs/feature-rules/leaderboard-and-tiebreakers.md`
- Modify: `docs/feature-rules/reports-and-analytics-summary.md`
- Modify: `docs/feature-rules/public-views.md`
- Modify: `docs/feature-rules/overlay-and-obs-views.md`
- Modify: `docs/feature-rules/notifications-activities-alerts-audit.md`
- Modify: `docs/feature-rules/user-management.md`

**Step 1: Write the failing completeness check**

Run:
```bash
for f in docs/feature-rules/*.md; do
  [ "$(basename "$f")" = "README.md" ] && continue
  rg -q "^- Missing:" "$f" && echo "has-missing:$f"
done
```
Expected: output contains files with `has-missing:*`.

**Step 2: Update coverage sections**
- Replace outdated `Missing` lines with direct test references introduced in Tasks 2-18.
- Keep `Direct` and `Indirect` distinctions accurate.

**Step 3: Run completeness check again**

Run:
```bash
for f in docs/feature-rules/*.md; do
  [ "$(basename "$f")" = "README.md" ] && continue
  rg -q "^- Missing:" "$f" && echo "has-missing:$f"
done
```
Expected: no output.

**Step 4: Commit**

```bash
git add docs/feature-rules/*.md
git commit -m "docs(feature-rules): update coverage status with full test closure evidence"
```

### Task 20: Final Verification And Log Evidence

**Files:**
- Verify only.

**Step 1: Run targeted unit + integration suite in log mode**

Run: `npm run test:log -- --run tests/unit tests/integration`
Expected: PASS with log artifact path printed.

**Step 2: Run E2E risk-tier suite**

Run: `npx playwright test e2e/p0-auth-and-role-guards.spec.ts e2e/p0-front-desk-checkin.spec.ts e2e/p0-self-checkin-kiosk.spec.ts e2e/p0-match-control-scoring.spec.ts e2e/p0-score-correction.spec.ts e2e/p0-public-views.spec.ts e2e/p0-user-management.spec.ts --project=chromium`
Expected: PASS.

**Step 3: Run lint/type checks in log mode**

Run:
```bash
npm run lint:log
npm run type-check
```
Expected: PASS.

**Step 4: Completion checks**

Run:
```bash
find docs/feature-rules -maxdepth 1 -name "*.md" | wc -l
for f in docs/feature-rules/*.md; do
  [ "$(basename "$f")" = "README.md" ] && continue
  rg -q "^- Missing:" "$f" && exit 1
  rg -q "^## Test Coverage$" "$f" || exit 1
done
echo "feature-test-closure-ready"
```
Expected: prints `feature-test-closure-ready`.

**Step 5: Commit final verification snapshot**

```bash
git add -A
git commit -m "chore(test): finalize full feature and edge-case coverage verification"
```

### Implementation Notes
- Use @superpowers:test-driven-development before touching production code for each task.
- Use @superpowers:systematic-debugging when any test fails unexpectedly.
- Use @superpowers:verification-before-completion before claiming closure.
- Keep production behavior changes minimal; prefer test-only additions unless a defect is discovered.
