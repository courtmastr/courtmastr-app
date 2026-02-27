# Scheduling Capacity Guard + Draft Full View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure Categories -> View Draft opens Match Control in full schedule layout, and scheduling respects existing cross-category draft/published court occupancy with automatic start-time shifting and clear operator feedback.

**Architecture:** Keep existing scheduler orchestration and reuse `useMatchScheduler.scheduleMatches` + `scheduleTimes`. Add a small pure capacity-resolver helper that uses dry-run schedule windows against occupied windows from existing draft/published matches, then commits exactly once with a conflict-free start. Keep current hybrid mode semantics (sequential default, partitioned optional).

**Tech Stack:** Vue 3 + TypeScript + Pinia + Vitest + @vue/test-utils + Firebase composables.

---

### Task 1: Add failing tests for draft deep-link full layout

**Files:**
- Modify: `tests/unit/CategoriesView.draft-schedule-routing.test.ts`
- Modify: `tests/unit/MatchControlView.assignments.test.ts`
- Modify: `src/features/tournaments/views/matchControlScheduleQuery.ts` (later)
- Modify: `src/features/tournaments/views/CategoriesView.vue` (later)
- Modify: `src/features/tournaments/views/MatchControlView.vue` (later)

**Step 1: Write failing route test for `scheduleLayout=full`**

```typescript
expect(mockDeps.routerPush).toHaveBeenCalledWith({
  path: '/tournaments/t-1/match-control',
  query: {
    view: 'schedule',
    category: 'cat-1',
    publicState: 'draft',
    scheduleLayout: 'full',
  },
});
```

**Step 2: Write failing Match Control hydration test for layout query**

```typescript
runtimeState.routeQuery = {
  view: 'schedule',
  category: 'cat-1',
  publicState: 'draft',
  scheduleLayout: 'full',
};
expect(vm.scheduleViewMode).toBe('full');
```

**Step 3: Run tests to verify RED**

Run: `npm run test -- tests/unit/CategoriesView.draft-schedule-routing.test.ts tests/unit/MatchControlView.assignments.test.ts --run`  
Expected: FAIL on missing `scheduleLayout` routing/hydration.

**Step 4: Commit failing-test checkpoint**

```bash
git add tests/unit/CategoriesView.draft-schedule-routing.test.ts tests/unit/MatchControlView.assignments.test.ts
git commit -m "test: add failing coverage for draft schedule full-layout deep-link"
```

---

### Task 2: Implement query parser + deep-link full layout wiring

**Files:**
- Modify: `src/features/tournaments/views/matchControlScheduleQuery.ts`
- Modify: `src/features/tournaments/views/CategoriesView.vue`
- Modify: `src/features/tournaments/views/MatchControlView.vue`
- Test: `tests/unit/CategoriesView.draft-schedule-routing.test.ts`
- Test: `tests/unit/MatchControlView.assignments.test.ts`

**Step 1: Add parser for schedule layout query**

```typescript
export type ScheduleLayout = 'compact' | 'full';
export function parseScheduleQueryLayout(value: unknown): ScheduleLayout {
  return value === 'full' || value === 'compact' ? value : 'compact';
}
```

**Step 2: Add `scheduleLayout: 'full'` to `viewDraftSchedule()` route**

```typescript
query: {
  view: 'schedule',
  category: category.id,
  publicState: 'draft',
  scheduleLayout: 'full',
}
```

**Step 3: Hydrate `scheduleViewMode` from query in Match Control**

```typescript
watch(() => route.query.scheduleLayout, (value) => {
  scheduleViewMode.value = parseScheduleQueryLayout(Array.isArray(value) ? value[0] : value);
}, { immediate: true });
```

**Step 4: Run tests to verify GREEN**

Run: `npm run test -- tests/unit/CategoriesView.draft-schedule-routing.test.ts tests/unit/MatchControlView.assignments.test.ts --run`  
Expected: PASS.

**Step 5: Commit implementation checkpoint**

```bash
git add src/features/tournaments/views/matchControlScheduleQuery.ts src/features/tournaments/views/CategoriesView.vue src/features/tournaments/views/MatchControlView.vue tests/unit/CategoriesView.draft-schedule-routing.test.ts tests/unit/MatchControlView.assignments.test.ts
git commit -m "feat: route draft schedule deep-link to full layout in match control"
```

---

### Task 3: Add failing tests for cross-category capacity guard

**Files:**
- Create: `src/features/tournaments/dialogs/scheduleCapacityGuard.ts` (later)
- Create: `tests/unit/scheduleCapacityGuard.test.ts`
- Modify: `tests/unit/AutoScheduleDialog.level-scope.test.ts`

**Step 1: Write failing pure helper tests**

```typescript
it('shifts start when existing draft/published occupancy saturates courts');
it('does not shift when remaining court capacity is sufficient');
it('treats touching boundaries (end==start) as non-overlap');
it('excludes same scope occupancy during reschedule');
it('uses fallback duration when plannedEndAt is missing');
```

**Step 2: Write failing dialog orchestration test for shift warning**

```typescript
expect(mockDeps.showToast).toHaveBeenCalledWith(
  'warning',
  expect.stringContaining('Start adjusted')
);
```

**Step 3: Run tests to verify RED**

Run: `npm run test -- tests/unit/scheduleCapacityGuard.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts --run`  
Expected: FAIL (helper missing and dialog not using it yet).

**Step 4: Commit failing-test checkpoint**

```bash
git add tests/unit/scheduleCapacityGuard.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts
git commit -m "test: add failing coverage for cross-category scheduling capacity guard"
```

---

### Task 4: Implement dry-run scheduler and capacity guard integration

**Files:**
- Modify: `src/composables/useMatchScheduler.ts`
- Create: `src/features/tournaments/dialogs/scheduleCapacityGuard.ts`
- Modify: `src/features/tournaments/dialogs/AutoScheduleDialog.vue`
- Test: `tests/unit/scheduleCapacityGuard.test.ts`
- Test: `tests/unit/AutoScheduleDialog.level-scope.test.ts`

**Step 1: Add `dryRun?: boolean` option in `scheduleMatches`**

```typescript
if (options.dryRun === true) {
  // return mapped ScheduleResult from timeResult without saveTimedSchedule(...)
  return schedule;
}
await saveTimedSchedule(...);
```

**Step 2: Implement capacity helper**

```typescript
export function resolveStartAgainstOccupiedCapacity(args): CapacityResolutionResult {
  // build occupied windows from existing matches (draft/published, planned times)
  // exclude same scope windows
  // detect over-capacity timeline overlap
  // shift to next boundary until conflict-free
}
```

**Step 3: Integrate helper into `AutoScheduleDialog` scheduling path**

```typescript
// before committing each target scope:
// 1) dry run candidate schedule from requested start
// 2) resolve shifted start against occupied windows
// 3) if shifted -> warning toast
// 4) run final scheduleMatches with dryRun=false
```

**Step 4: Ensure sequential + partitioned both pass through guard**

- sequential: propagate prior target windows in current run as additional occupancy.
- partitioned: run per-category capacity based on budget.

**Step 5: Run tests**

Run: `npm run test -- tests/unit/scheduleCapacityGuard.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts tests/unit/autoScheduleTargets.test.ts tests/unit/useTimeScheduler.clearTimedSchedule.test.ts --run`  
Expected: PASS.

**Step 6: Commit implementation checkpoint**

```bash
git add src/composables/useMatchScheduler.ts src/features/tournaments/dialogs/scheduleCapacityGuard.ts src/features/tournaments/dialogs/AutoScheduleDialog.vue tests/unit/scheduleCapacityGuard.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts
git commit -m "feat: enforce court-capacity-aware scheduling against existing draft/published windows"
```

---

### Task 5: Regression verification, coding pattern, and log protocol

**Files:**
- Modify: `docs/coding-patterns/CODING_PATTERNS.md`
- Modify/Create: `docs/debug-kb/<fingerprint>.md`
- Modify: `docs/debug-kb/index.yml`

**Step 1: Add coding pattern for capacity-aware scheduling guard**

Document anti-pattern (blind reschedule collisions) and correct pattern (dry-run + capacity resolution).

**Step 2: Run regression tests**

Run:  
`npm run test -- tests/unit/autoScheduleTargets.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts tests/unit/useTimeScheduler.clearTimedSchedule.test.ts tests/unit/scheduleCapacityGuard.test.ts tests/unit/CategoryRegistrationStats.pool-phase.test.ts tests/unit/CategoriesView.draft-schedule-routing.test.ts tests/unit/MatchControlView.assignments.test.ts --run`

Expected: PASS.

**Step 3: Run required logged verification**

Run:  
`npm run test:log -- tests/unit/autoScheduleTargets.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts tests/unit/useTimeScheduler.clearTimedSchedule.test.ts tests/unit/scheduleCapacityGuard.test.ts tests/unit/CategoryRegistrationStats.pool-phase.test.ts tests/unit/CategoriesView.draft-schedule-routing.test.ts tests/unit/MatchControlView.assignments.test.ts --run`

Run:  
`npm run lint:log -- src/features/tournaments/views/matchControlScheduleQuery.ts src/features/tournaments/views/CategoriesView.vue src/features/tournaments/views/MatchControlView.vue src/composables/useMatchScheduler.ts src/features/tournaments/dialogs/AutoScheduleDialog.vue src/features/tournaments/dialogs/scheduleCapacityGuard.ts tests/unit/scheduleCapacityGuard.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts tests/unit/CategoriesView.draft-schedule-routing.test.ts tests/unit/MatchControlView.assignments.test.ts tests/unit/CategoryRegistrationStats.pool-phase.test.ts`

If lint baseline fails: capture fingerprint, update debug KB entry + index, then run scoped eslint for touched files.

**Step 4: Final commit**

```bash
git add src/features/tournaments/views/matchControlScheduleQuery.ts src/features/tournaments/views/CategoriesView.vue src/features/tournaments/views/MatchControlView.vue src/composables/useMatchScheduler.ts src/features/tournaments/dialogs/AutoScheduleDialog.vue src/features/tournaments/dialogs/scheduleCapacityGuard.ts tests/unit/scheduleCapacityGuard.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts tests/unit/CategoriesView.draft-schedule-routing.test.ts tests/unit/MatchControlView.assignments.test.ts tests/unit/CategoryRegistrationStats.pool-phase.test.ts docs/coding-patterns/CODING_PATTERNS.md docs/debug-kb/index.yml docs/debug-kb/*.md

git commit -m "fix: enforce cross-category court-capacity scheduling and full draft deep-link view"
```

---

## Verification Checklist

- [ ] Categories draft deep-link opens schedule view in full layout.
- [ ] Full-layout override is deep-link-specific (normal defaults preserved).
- [ ] Existing draft/published schedules from other categories block court over-allocation.
- [ ] Scheduler auto-shifts to next available capacity window when needed.
- [ ] User receives warning when start is shifted.
- [ ] Same category/scope reschedule does not self-block.
- [ ] Sequential and partitioned paths both honor capacity constraints.
- [ ] Existing level-scope scheduling behavior remains intact.
