# Level Scheduling Scope Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure `Schedule Level Matches` for leveled `pool_to_elimination` categories schedules level scopes (not base pool scope), supports category-level level-schedule replacement on rerun, and preserves publish/reschedule safety semantics.

**Architecture:** Keep scheduler engine generic and implement scope routing in `AutoScheduleDialog`. Add a small pure helper to resolve per-category schedule targets from live match data (`levelId` presence), then orchestrate scheduling by target scope. Add a focused time-schedule clearing helper that only clears schedule metadata for selected level scopes before rerun.

**Tech Stack:** Vue 3 + TypeScript + Pinia + Vitest + @vue/test-utils + Firebase Firestore composables.

---

### Task 1: Add failing tests for scope resolution and dialog scheduling calls

**Files:**
- Create: `tests/unit/autoScheduleTargets.test.ts`
- Create: `tests/unit/AutoScheduleDialog.level-scope.test.ts`
- Reference: `src/features/tournaments/dialogs/AutoScheduleDialog.vue`

**Step 1: Write failing tests for target resolution helper**

```typescript
import { describe, expect, it } from 'vitest';
import { resolveScheduleTargetsForCategory } from '@/features/tournaments/dialogs/autoScheduleTargets';

it('returns level targets for generated pool_to_elimination category with level matches', () => {
  const targets = resolveScheduleTargetsForCategory(
    { id: 'cat-1', format: 'pool_to_elimination', levelingStatus: 'generated' } as any,
    [
      { id: 'm-base', categoryId: 'cat-1', levelId: undefined },
      { id: 'm-l1', categoryId: 'cat-1', levelId: 'level-1' },
      { id: 'm-l2', categoryId: 'cat-1', levelId: 'level-2' },
    ] as any
  );

  expect(targets).toEqual([
    { categoryId: 'cat-1', levelId: 'level-1' },
    { categoryId: 'cat-1', levelId: 'level-2' },
  ]);
});
```

**Step 2: Write failing dialog test that asserts scheduler is called with `levelId` targets**

```typescript
it('schedules all level scopes (not base) for leveled pool_to_elimination category', async () => {
  // mount dialog with selected category, mock matchStore.matches containing level-1/2/3
  // click run draft
  // assert scheduleMatches called with { categoryId, levelId: 'level-1' } ... level-3
  // assert no call with missing levelId for this category
});
```

**Step 3: Run tests to verify failures**

Run: `npm run test -- tests/unit/autoScheduleTargets.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts --run`  
Expected: FAIL (helper missing and/or dialog still scheduling base scope).

**Step 4: Commit failing-test checkpoint**

```bash
git add tests/unit/autoScheduleTargets.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts
git commit -m "test: add failing coverage for leveled category schedule scope routing"
```

---

### Task 2: Implement schedule target resolver and wire dialog orchestration

**Files:**
- Create: `src/features/tournaments/dialogs/autoScheduleTargets.ts`
- Modify: `src/features/tournaments/dialogs/AutoScheduleDialog.vue`
- Test: `tests/unit/autoScheduleTargets.test.ts`
- Test: `tests/unit/AutoScheduleDialog.level-scope.test.ts`

**Step 1: Add pure target resolver implementation**

```typescript
// src/features/tournaments/dialogs/autoScheduleTargets.ts
import type { Category, Match } from '@/types';

export interface ScheduleTarget {
  categoryId: string;
  levelId?: string;
}

export const resolveScheduleTargetsForCategory = (
  category: Category,
  matches: Match[]
): ScheduleTarget[] => {
  const categoryMatches = matches.filter((m) => m.categoryId === category.id);
  const levelIds = [...new Set(categoryMatches.map((m) => m.levelId).filter(Boolean) as string[])].sort();

  const isLeveledPoolToElim =
    category.format === 'pool_to_elimination'
    && category.levelingStatus === 'generated'
    && levelIds.length > 0;

  if (isLeveledPoolToElim) {
    return levelIds.map((levelId) => ({ categoryId: category.id, levelId }));
  }

  return [{ categoryId: category.id }];
};
```

**Step 2: Update dialog to schedule resolved targets**

```typescript
// AutoScheduleDialog.vue (script)
const scheduleTargets = computed(() =>
  selectedCategories.value.flatMap((category) =>
    resolveScheduleTargetsForCategory(category, matchStore.matches)
  )
);

// runSequentialSchedule / runParallelPartitionedSchedule iterate targets
// and pass target.levelId into scheduleCategoryWithConfig(...)
```

**Step 3: Add warning state for replacement when target list includes level scopes**

```typescript
const replacesLevelSchedules = computed(() =>
  scheduleTargets.value.some((target) => Boolean(target.levelId))
);
```

```vue
<v-alert v-if="replacesLevelSchedules" type="warning" variant="tonal">
  Existing level schedule for selected categories will be replaced.
  Pool/base schedule is unchanged.
</v-alert>
```

**Step 4: Run targeted tests**

Run: `npm run test -- tests/unit/autoScheduleTargets.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts --run`  
Expected: PASS.

**Step 5: Commit implementation checkpoint**

```bash
git add src/features/tournaments/dialogs/autoScheduleTargets.ts src/features/tournaments/dialogs/AutoScheduleDialog.vue tests/unit/autoScheduleTargets.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts
git commit -m "feat: route leveled category scheduling to level scopes"
```

---

### Task 3: Add replace-schedule clearing for selected level scopes only

**Files:**
- Modify: `src/composables/useTimeScheduler.ts`
- Modify: `src/features/tournaments/dialogs/AutoScheduleDialog.vue`
- Create: `tests/unit/useTimeScheduler.clearTimedSchedule.test.ts`
- Test: `tests/unit/AutoScheduleDialog.level-scope.test.ts`

**Step 1: Write failing test for clearing helper**

```typescript
it('clears planned fields for one category + one level scope only', async () => {
  // mock getDocs(collection(match_scores path)) with docs for level-1
  // call clearTimedSchedule(tid, [{ categoryId: 'cat-1', levelId: 'level-1' }])
  // expect batch.update to null plannedStartAt/plannedEndAt/scheduledTime/scheduleStatus/publishedAt/publishedBy
  // expect no writes to base category path or other level paths
});
```

**Step 2: Implement helper in time scheduler composable**

```typescript
export async function clearTimedScheduleScopes(
  tournamentId: string,
  targets: Array<{ categoryId: string; levelId?: string }>
): Promise<{ clearedCount: number }> {
  // for each target, read match_scores collection at resolved path
  // clear schedule metadata only (preserve scores/status)
  // batch commit; return clearedCount
}
```

**Step 3: Call clear helper before schedule run in dialog when level targets exist**

```typescript
if (scheduleTargets.value.some((target) => target.levelId)) {
  await clearTimedScheduleScopes(props.tournamentId, scheduleTargets.value.filter((t) => t.levelId));
}
```

**Step 4: Add dialog test edge cases**

```typescript
it('re-run clears existing level schedule then reschedules level scopes');
it('does not clear base/pool scope when replacing level schedule');
it('falls back to base schedule for non-leveled categories');
```

**Step 5: Run tests**

Run: `npm run test -- tests/unit/useTimeScheduler.clearTimedSchedule.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts tests/unit/autoScheduleTargets.test.ts --run`  
Expected: PASS.

**Step 6: Commit replace behavior checkpoint**

```bash
git add src/composables/useTimeScheduler.ts src/features/tournaments/dialogs/AutoScheduleDialog.vue tests/unit/useTimeScheduler.clearTimedSchedule.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts
git commit -m "feat: replace existing level schedule before rerun for selected category scopes"
```

---

### Task 4: Regression verification and guardrail checks

**Files:**
- Modify: `tests/unit/CategoryRegistrationStats.pool-phase.test.ts` (only if new assertion needed)
- Modify: `docs/coding-patterns/CODING_PATTERNS.md`
- Modify/Create: `docs/debug-kb/<fingerprint>.md`, `docs/debug-kb/index.yml` (if `:log` command fails)

**Step 1: Add/confirm regression for CTA + schedule routing interaction**

```typescript
it('level_schedule CTA path results in level-scoped scheduler calls when levels exist');
```

**Step 2: Run logged tests (required evidence)**

Run: `npm run test:log -- tests/unit/autoScheduleTargets.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts tests/unit/useTimeScheduler.clearTimedSchedule.test.ts tests/unit/CategoryRegistrationStats.pool-phase.test.ts --run`  
Expected: PASS; artifact path captured.

**Step 3: Run lint checks for touched files**

Run: `npm run lint:log -- src/features/tournaments/dialogs/AutoScheduleDialog.vue src/features/tournaments/dialogs/autoScheduleTargets.ts src/composables/useTimeScheduler.ts tests/unit/autoScheduleTargets.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts tests/unit/useTimeScheduler.clearTimedSchedule.test.ts`  
Expected: if repository baseline fails, capture fingerprint and follow Debug KB protocol; otherwise PASS.

Fallback scoped lint evidence (if baseline blocks):

Run: `ESLINT_USE_FLAT_CONFIG=false npx eslint src/features/tournaments/dialogs/AutoScheduleDialog.vue src/features/tournaments/dialogs/autoScheduleTargets.ts src/composables/useTimeScheduler.ts tests/unit/autoScheduleTargets.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts tests/unit/useTimeScheduler.clearTimedSchedule.test.ts --ext .vue,.ts --ignore-path .gitignore`

**Step 4: Update coding pattern for this bug class**

Add/Update pattern in `docs/coding-patterns/CODING_PATTERNS.md` for:
- schedule CTA context must resolve level scopes for generated leveled categories
- avoid base-scope scheduling for leveled categories

**Step 5: Final commit**

```bash
git add src/features/tournaments/dialogs/AutoScheduleDialog.vue src/features/tournaments/dialogs/autoScheduleTargets.ts src/composables/useTimeScheduler.ts tests/unit/autoScheduleTargets.test.ts tests/unit/AutoScheduleDialog.level-scope.test.ts tests/unit/useTimeScheduler.clearTimedSchedule.test.ts docs/coding-patterns/CODING_PATTERNS.md docs/debug-kb/index.yml docs/debug-kb/*.md
git commit -m "fix: schedule leveled categories using level scopes and replace level draft safely"
```

---

## Verification Checklist

- [ ] Scheduling leveled pool-to-elimination category no longer returns false `0 scheduled` when level matches are ready.
- [ ] Rerun replaces only selected category’s level schedules.
- [ ] Base/pool schedule data remains unchanged.
- [ ] Non-leveled categories still schedule correctly.
- [ ] Publish remains explicit; no auto-publish side effects.
- [ ] Tests and logged evidence recorded.

