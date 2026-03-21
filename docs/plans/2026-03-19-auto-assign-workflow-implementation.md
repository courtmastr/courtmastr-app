# Auto-Assign Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the publish CTA and live auto-assign workflow so Match Control skips blocked matches, assigns the next eligible due match, and explains skipped reasons to organizers.

**Architecture:** First reproduce the real organizer flow in-browser to capture exact broken state for one blocked doubles match. Then align category CTA phase logic with publish state, split Match Control queue derivations into assignable vs blocked due matches, and surface skip reasons through alerts/activity using the same match-level gate used by assignment.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vuetify, Vitest, browser reproduction with `agent-browser`

---

### Task 1: Capture Reproduction Evidence

**Files:**
- Read: `src/features/tournaments/components/CategoryRegistrationStats.vue`
- Read: `src/features/tournaments/views/MatchControlView.vue`
- Read: `src/stores/matches.ts`
- Test/Inspect: running app in browser via `agent-browser`

**Step 1: Open the affected organizer pages in the browser**

Run:
```bash
infsh app run agent-browser --function open --session new --input '{"url":"http://localhost:3000/tournaments/<id>/categories"}'
```

**Step 2: Capture category CTA state**

Expected:
- The category card CTA and status chips are visible
- The category is identifiable as the same one from the screenshots

**Step 3: Navigate to Match Control and inspect one blocked queue match**

Expected:
- At least one queued match is visible
- Court availability and alerts are visible

**Step 4: Record the concrete mismatch**

Expected:
- One note listing:
  - category/level
  - queue match display code
  - published state shown in UI
  - checked-in state shown in UI
  - blocker text shown in UI

**Step 5: Commit**

```bash
git add docs/plans/2026-03-19-auto-assign-workflow-design.md docs/plans/2026-03-19-auto-assign-workflow-implementation.md
git commit -m "docs: capture auto-assign workflow plan"
```

### Task 2: Lock CTA Publish Behavior With Tests

**Files:**
- Modify: `tests/unit/CategoryRegistrationStats.test.ts`
- Modify: `src/features/tournaments/components/CategoryRegistrationStats.vue`

**Step 1: Write/extend failing tests for publish-phase CTAs**

Include assertions that:
```ts
expect(wrapper.emitted('publish-schedule')?.[0]?.[0]).toMatchObject({ id: 'cat-1' });
```

for:
- single-elimination publish
- pool publish
- level publish

**Step 2: Run the targeted test to verify failure if behavior regresses**

Run:
```bash
npm run test -- --run tests/unit/CategoryRegistrationStats.test.ts
```

Expected:
- Fails before fix if CTA is wired to `schedule-times`

**Step 3: Implement minimal CTA mapping fix**

Ensure:
```ts
type PrimaryActionEvent =
  | 'schedule-times'
  | 'publish-schedule';
```

and publish phases emit `publish-schedule`.

**Step 4: Re-run the test**

Run:
```bash
npm run test -- --run tests/unit/CategoryRegistrationStats.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add tests/unit/CategoryRegistrationStats.test.ts src/features/tournaments/components/CategoryRegistrationStats.vue
git commit -m "fix: route publish ctas to publish action"
```

### Task 3: Add Match-Level Due/Blocked Queue Derivations

**Files:**
- Modify: `src/features/tournaments/views/MatchControlView.vue`
- Modify: `src/stores/matches.ts`

**Step 1: Write a failing test for skip-blocked/assign-next behavior**

Create or extend a Match Control unit test that sets:
- match A due within 10 minutes but blocked by check-in
- match B due within 10 minutes and fully eligible
- one free court

Expected assertion:
```ts
expect(assignCourtMock).toHaveBeenCalledWith('t1', 'match-b', 'court-1', 'cat-1', undefined);
```

**Step 2: Run the targeted test**

Run:
```bash
npm run test -- --run tests/unit/MatchControlView.auto-assign.test.ts
```

Expected:
- FAIL before fix or before full blocked-reason handling is added

**Step 3: Implement derived eligibility lists**

Add computed lists for:
- assignable due matches
- blocked due matches with reasons

Use shared gate logic so the UI and assignment path agree.

**Step 4: Update watcher to consume assignable list**

Use the first eligible due match only:
```ts
const match = dueAssignableMatches.value[0];
```

**Step 5: Re-run the targeted test**

Run:
```bash
npm run test -- --run tests/unit/MatchControlView.auto-assign.test.ts
```

Expected:
- PASS

**Step 6: Commit**

```bash
git add src/features/tournaments/views/MatchControlView.vue src/stores/matches.ts tests/unit/MatchControlView.auto-assign.test.ts
git commit -m "fix: auto-assign next eligible due match"
```

### Task 4: Surface Skip Reasons To Organizers

**Files:**
- Modify: `src/features/tournaments/views/MatchControlView.vue`
- Modify: `src/features/tournaments/components/AlertsPanel.vue`
- Test: `tests/unit/MatchControlView.auto-assign.test.ts`

**Step 1: Add failing assertions for organizer-visible skip reason**

Assert on one of:
- alert payload text
- toast text
- activity log text

Example:
```ts
expect(showToastMock).toHaveBeenCalledWith(
  'warning',
  expect.stringContaining('Skipped')
);
```

**Step 2: Implement minimal organizer feedback**

When a blocked due match exists ahead of an assigned match, emit explicit reason text such as:
```ts
`Skipped ${code}: players not checked in`
```

**Step 3: Re-run targeted test**

Run:
```bash
npm run test -- --run tests/unit/MatchControlView.auto-assign.test.ts
```

Expected:
- PASS

**Step 4: Commit**

```bash
git add src/features/tournaments/views/MatchControlView.vue src/features/tournaments/components/AlertsPanel.vue tests/unit/MatchControlView.auto-assign.test.ts
git commit -m "fix: show why queued matches are skipped"
```

### Task 5: Verify Match-Level Check-In Resolution

**Files:**
- Modify: `tests/integration/match-assignment.integration.test.ts`
- Modify: `src/stores/matches.ts` if needed

**Step 1: Add failing integration coverage for doubles registration resolution**

Test that only the registrations attached to the match are checked, and that assignment is blocked only when one of those registrations is not checked in.

**Step 2: Run the integration test**

Run:
```bash
npm run test -- --run tests/integration/match-assignment.integration.test.ts
```

Expected:
- FAIL if the store uses stale or incorrect registration resolution

**Step 3: Implement minimal store fix if needed**

Keep the gate strictly match-scoped and registration-based.

**Step 4: Re-run the integration test**

Run:
```bash
npm run test -- --run tests/integration/match-assignment.integration.test.ts
```

Expected:
- PASS

**Step 5: Commit**

```bash
git add tests/integration/match-assignment.integration.test.ts src/stores/matches.ts
git commit -m "fix: keep check-in assignment gates match-scoped"
```

### Task 6: Final Verification

**Files:**
- Verify only

**Step 1: Run targeted workflow tests**

Run:
```bash
npm run test -- --run tests/unit/CategoryRegistrationStats.test.ts tests/unit/MatchControlView.auto-assign.test.ts tests/integration/match-assignment.integration.test.ts
```

Expected:
- PASS

**Step 2: Run logged targeted workflow tests**

Run:
```bash
npm run test:log -- --run tests/unit/CategoryRegistrationStats.test.ts tests/unit/CategoryRegistrationStats.pool-phase.test.ts tests/unit/MatchControlView.auto-assign.test.ts tests/integration/match-assignment.integration.test.ts
```

Expected:
- PASS and save log artifact

**Step 3: Run required env/build gates**

Run:
```bash
npm run check:firebase-env
npm run build
npm run build:log
```

Expected:
- All PASS

**Step 4: Run coding-pattern detection commands**

Run:
```bash
rg -n "case 'publish'|case 'pool_publish'" src/features/tournaments/components/CategoryRegistrationStats.vue
rg -n "event: 'schedule-times'" src/features/tournaments/components/CategoryRegistrationStats.vue
rg -n "pendingMatches.value|autoAssignableDueMatches" src/features/tournaments/views/MatchControlView.vue
```

Expected:
- Publish phases map to `publish-schedule`
- Match Control includes `autoAssignableDueMatches`

**Step 5: Commit**

```bash
git add docs/coding-patterns/CODING_PATTERNS.md docs/debug-kb/index.yml docs/debug-kb/*.md
git commit -m "test: verify auto-assign workflow fix"
```
