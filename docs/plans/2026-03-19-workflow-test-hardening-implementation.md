# Workflow Test Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add deterministic, emulator-backed tests that catch publish/check-in/auto-assign workflow regressions in CourtMastr.

**Architecture:** Reuse the existing Playwright emulator setup, add direct Firestore scenario seed helpers for exact workflow states, and update workflow-facing specs to validate real UI behavior without runtime skips. Keep unit tests for local gate logic and use E2E to verify the full publish and assignment pipeline.

**Tech Stack:** Playwright, Firebase Auth emulator, Firestore emulator, Vue 3, Vitest

---

### Task 1: Add reusable workflow scenario seed helpers

**Files:**
- Create: `e2e/utils/workflow-scenarios.ts`

**Step 1: Write the failing test**

- Add a new E2E spec import that references a helper which does not exist yet.

**Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/p0-match-control-scoring.spec.ts --project=feature-scoring`

Expected: FAIL with missing helper import or missing seeded scenario behavior.

**Step 3: Write minimal implementation**

- Add helper functions that:
  - connect to auth/firestore emulators
  - sign in as admin
  - seed a deterministic tournament/category/courts
  - create doubles registrations with `participantPresence`
  - create category `match` and `match_scores` docs with planned/published states
  - return IDs needed by the tests

**Step 4: Run test to verify helper wiring**

Run: `npx playwright test e2e/p0-match-control-scoring.spec.ts --project=feature-scoring`

Expected: test reaches scenario assertions instead of failing at setup.

### Task 2: Replace weak match-control workflow assertions with deterministic auto-assign coverage

**Files:**
- Modify: `e2e/p0-match-control-scoring.spec.ts`

**Step 1: Write the failing test**

- Add a real workflow test that:
  - seeds one blocked partial-check-in match
  - seeds one blocked unchecked-in match
  - seeds one eligible published due match
  - visits Match Control
  - enables auto-assign if needed
  - asserts blocker reasons and successful assignment behavior

**Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/p0-match-control-scoring.spec.ts --project=feature-scoring`

Expected: FAIL before helper or UI assertions are fully satisfied.

**Step 3: Write minimal implementation**

- Update the spec to use the scenario helper and assert:
  - blocked rows show `Waiting for check-in`
  - blocked rows do not expose green assign affordances
  - the eligible match moves to court/live state
  - alerts explain skipped vs assigned behavior

**Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/p0-match-control-scoring.spec.ts --project=feature-scoring`

Expected: PASS

### Task 3: Add deterministic publish-to-public-schedule coverage

**Files:**
- Modify: `e2e/p0-public-views.spec.ts`
- Possibly modify: `e2e/utils/workflow-scenarios.ts`

**Step 1: Write the failing test**

- Add a test that seeds a scheduled-but-draft level/category match and verifies it does not appear publicly until published.

**Step 2: Run test to verify it fails**

Run: `npx playwright test e2e/p0-public-views.spec.ts --project=feature-public-leaderboard`

Expected: FAIL until deterministic publish flow and assertions are correct.

**Step 3: Write minimal implementation**

- Use the scenario helper to seed the exact state.
- Drive the publish action from Categories or the relevant organizer UI.
- Assert the public schedule view shows the published match after publish.

**Step 4: Run test to verify it passes**

Run: `npx playwright test e2e/p0-public-views.spec.ts --project=feature-public-leaderboard`

Expected: PASS

### Task 4: Tighten supporting unit coverage only where the E2E path still leaves a blind spot

**Files:**
- Modify only if needed: `tests/unit/MatchControlView.auto-assign.test.ts`
- Modify only if needed: `tests/unit/CategoryRegistrationStats.test.ts`

**Step 1: Write the failing test**

- Add targeted assertions only for any uncovered gate or CTA derivation edge exposed by the new E2E work.

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/MatchControlView.auto-assign.test.ts tests/unit/CategoryRegistrationStats.test.ts`

Expected: FAIL on the newly added edge case if a gap exists.

**Step 3: Write minimal implementation**

- Update only the specific test or helper setup needed.

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/MatchControlView.auto-assign.test.ts tests/unit/CategoryRegistrationStats.test.ts`

Expected: PASS

### Task 5: Verify the suite and report residual issues

**Files:**
- Modify: `docs/coding-patterns/CODING_PATTERNS.md`
- Modify if coverage/log failures require it: `docs/debug-kb/index.yml`

**Step 1: Run focused verification**

Run:
- `npx playwright test e2e/p0-match-control-scoring.spec.ts --project=feature-scoring`
- `npx playwright test e2e/p0-public-views.spec.ts --project=feature-public-leaderboard`
- `npm run test -- --run`

Expected: PASS

**Step 2: Run build verification**

Run:
- `npm run build`
- `npm run build:log`

Expected: PASS

**Step 3: Run coverage**

Run:
- `npm run test:coverage`

Expected: Either PASS with a fresh report or a documented existing parser limitation unrelated to the new tests.

**Step 4: Update pattern doc**

- Add or update a coding pattern describing deterministic emulator-backed workflow scenarios for assignment/publish regressions if the work reveals a repeatable anti-pattern.
