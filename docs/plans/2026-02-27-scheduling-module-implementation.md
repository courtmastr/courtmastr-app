# Scheduling Module Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract a clean `src/scheduling/` module with centralized scheduling rules, reduce AutoScheduleDialog to UI-only, and add a timeline grid view with Excel download.

**Architecture:** New `src/scheduling/` directory holds all scheduling concerns (rules, orchestration, Firestore ops). The existing pure algorithm (`useTimeScheduler.ts`) and core scheduler (`useMatchScheduler.ts`) are kept but updated to import from `scheduleRules.ts`. A new `ScheduleGridView.vue` component renders a CSS-grid timeline (time × court) and exports to Excel via SheetJS.

**Tech Stack:** Vue 3 + Vuetify 3, TypeScript, Vitest, Firestore batch writes, SheetJS (`xlsx`)

---

## Context

Read the design doc first: `docs/plans/2026-02-27-scheduling-module-redesign.md`

Key existing files — understand them before touching anything:
- `src/composables/useTimeScheduler.ts` — pure algorithm + Firestore helpers (437 lines)
- `src/composables/useMatchScheduler.ts` — core scheduler composable (476 lines)
- `src/features/tournaments/dialogs/AutoScheduleDialog.vue` — orchestration + UI (1,040 lines)
- `src/features/tournaments/dialogs/autoScheduleTargets.ts` — target resolver (33 lines)
- `src/features/tournaments/dialogs/scheduleCapacityGuard.ts` — capacity helpers (139 lines)
- `src/features/tournaments/views/matchControlScheduleQuery.ts` — query parsers (29 lines)

Test runner: `npm test` (Vitest, watch mode). Run a single test file: `npx vitest run tests/unit/foo.test.ts`.

TypeScript: `npm run type-check`. ESLint: `npx eslint src/scheduling/ --ext .ts,.vue`.

**After every task: run `npm test` and confirm zero new failures.**

---

## Task 1: Create `src/scheduling/scheduleRules.ts`

This is the single source of truth for all scheduling constants. No logic — only exported constants.

**Files:**
- Create: `src/scheduling/scheduleRules.ts`
- Create: `tests/unit/scheduleRules.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/scheduleRules.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  SCHEDULE_DEFAULTS,
  SCHEDULE_CONSTRAINTS,
  SCHEDULE_FIELDS,
  SCHEDULE_STATUS,
} from '@/scheduling/scheduleRules';

describe('scheduleRules', () => {
  it('has sensible default values', () => {
    expect(SCHEDULE_DEFAULTS.matchDurationMinutes).toBeGreaterThan(0);
    expect(SCHEDULE_DEFAULTS.bufferMinutes).toBeGreaterThanOrEqual(0);
    expect(SCHEDULE_DEFAULTS.minRestTimeMinutes).toBeGreaterThanOrEqual(0);
    expect(SCHEDULE_DEFAULTS.concurrency).toBeGreaterThan(0);
    expect(SCHEDULE_DEFAULTS.slotIntervalMinutes).toBeGreaterThan(0);
  });

  it('constraints have min <= max', () => {
    for (const [key, range] of Object.entries(SCHEDULE_CONSTRAINTS)) {
      expect(range.min).toBeLessThanOrEqual(range.max), `${key}: min must be <= max`;
    }
  });

  it('field names are non-empty strings', () => {
    for (const [key, value] of Object.entries(SCHEDULE_FIELDS)) {
      expect(typeof value).toBe('string'), `${key} must be a string`;
      expect(value.length).toBeGreaterThan(0), `${key} must be non-empty`;
    }
  });

  it('status values match expected strings', () => {
    expect(SCHEDULE_STATUS.draft).toBe('draft');
    expect(SCHEDULE_STATUS.published).toBe('published');
  });

  it('plannedStartAt is the canonical time field name', () => {
    expect(SCHEDULE_FIELDS.plannedStartAt).toBe('plannedStartAt');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/scheduleRules.test.ts
```
Expected: FAIL — "Cannot find module '@/scheduling/scheduleRules'"

**Step 3: Create `src/scheduling/scheduleRules.ts`**

```typescript
/**
 * Scheduling Rules — Single Source of Truth
 *
 * All scheduling defaults, constraints, canonical field names, and status
 * values live here. Nothing else in the codebase should hard-code these values.
 */

/** Default values used when the user does not configure a parameter */
export const SCHEDULE_DEFAULTS = {
  matchDurationMinutes: 30,
  bufferMinutes: 5,
  minRestTimeMinutes: 15,
  concurrency: 2,
  slotIntervalMinutes: 15,    // Grid row height in ScheduleGridView
} as const;

/** Hard limits for input validation */
export const SCHEDULE_CONSTRAINTS = {
  matchDuration:  { min: 10, max: 120 },
  buffer:         { min: 0,  max: 30 },
  minRestTime:    { min: 0,  max: 60 },
  concurrency:    { min: 1,  max: 20 },
} as const;

/**
 * Canonical Firestore field names.
 * Use these instead of string literals when referencing schedule fields.
 * `plannedStartAt` is the source of truth; `scheduledTime` is the legacy field.
 */
export const SCHEDULE_FIELDS = {
  plannedStartAt:   'plannedStartAt',
  plannedEndAt:     'plannedEndAt',
  scheduleStatus:   'scheduleStatus',
  scheduleVersion:  'scheduleVersion',
  lockedTime:       'lockedTime',
  courtId:          'courtId',
  publishedAt:      'publishedAt',
  publishedBy:      'publishedBy',
} as const;

/** Canonical schedule status values */
export const SCHEDULE_STATUS = {
  draft:     'draft',
  published: 'published',
} as const;

export type ScheduleStatus = typeof SCHEDULE_STATUS[keyof typeof SCHEDULE_STATUS];

/**
 * Documented algorithmic invariants.
 * These are enforced in useTimeScheduler / useMatchScheduler;
 * the comments here are the authoritative explanation for each rule.
 */
export const SCHEDULE_RULES = {
  /**
   * Matches with lockedTime === true are skipped by the auto-scheduler.
   * Their existing plannedStartAt / plannedEndAt are preserved.
   */
  lockedMatchesArePreserved: true,

  /**
   * Court concurrency is determined by courts with status === 'available'.
   * Courts with status === 'in_use' or 'maintenance' are excluded.
   */
  concurrencyCountsAvailableCourtsOnly: true,

  /**
   * The capacity guard inspects both 'draft' AND 'published' existing windows
   * when checking whether a new schedule would exceed court capacity.
   */
  capacityGuardIncludesDraft: true,
} as const;
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/scheduleRules.test.ts
```
Expected: 5 tests pass.

**Step 5: Commit**

```bash
git add src/scheduling/scheduleRules.ts tests/unit/scheduleRules.test.ts
git commit -m "feat(scheduling): add scheduleRules.ts — single source of truth for scheduling constants"
```

---

## Task 2: Move `autoScheduleTargets.ts` to `src/scheduling/`

**Files:**
- Create: `src/scheduling/autoScheduleTargets.ts`
- Delete: `src/features/tournaments/dialogs/autoScheduleTargets.ts`
- Modify: `src/features/tournaments/dialogs/AutoScheduleDialog.vue` (1 import line)
- Modify: `tests/unit/autoScheduleTargets.test.ts` (1 import line)

**Step 1: Copy the file to its new home**

Create `src/scheduling/autoScheduleTargets.ts` with identical content to the existing file.
The content is 33 lines starting with:
```typescript
import type { Category, Match } from '@/types';

export interface ScheduleTarget {
  categoryId: string;
  levelId?: string;
}
// ... (copy entire file)
```

**Step 2: Update the import in AutoScheduleDialog.vue**

Find in `src/features/tournaments/dialogs/AutoScheduleDialog.vue`:
```typescript
import {
  resolveScheduleTargetsForCategory,
  type ScheduleTarget,
} from './autoScheduleTargets';
```

Replace with:
```typescript
import {
  resolveScheduleTargetsForCategory,
  type ScheduleTarget,
} from '@/scheduling/autoScheduleTargets';
```

**Step 3: Update the import in the test file**

Find in `tests/unit/autoScheduleTargets.test.ts`:
```typescript
import { resolveScheduleTargetsForCategory } from '@/features/tournaments/dialogs/autoScheduleTargets';
```

Replace with:
```typescript
import { resolveScheduleTargetsForCategory } from '@/scheduling/autoScheduleTargets';
```

**Step 4: Delete the old file**

```bash
rm src/features/tournaments/dialogs/autoScheduleTargets.ts
```

**Step 5: Run tests**

```bash
npx vitest run tests/unit/autoScheduleTargets.test.ts
```
Expected: 3 tests pass.

**Step 6: Commit**

```bash
git add src/scheduling/autoScheduleTargets.ts \
  src/features/tournaments/dialogs/AutoScheduleDialog.vue \
  tests/unit/autoScheduleTargets.test.ts
git rm src/features/tournaments/dialogs/autoScheduleTargets.ts
git commit -m "refactor(scheduling): move autoScheduleTargets.ts to src/scheduling/"
```

---

## Task 3: Move `scheduleCapacityGuard.ts` to `src/scheduling/`

Same pattern as Task 2.

**Files:**
- Create: `src/scheduling/scheduleCapacityGuard.ts`
- Delete: `src/features/tournaments/dialogs/scheduleCapacityGuard.ts`
- Modify: `src/features/tournaments/dialogs/AutoScheduleDialog.vue` (1 import)
- Modify: `tests/unit/scheduleCapacityGuard.test.ts` (1 import)

**Step 1: Copy the file**

Create `src/scheduling/scheduleCapacityGuard.ts` with identical content to the existing 139-line file.

Note: the file imports `type { ScheduledMatch } from '@/composables/useMatchScheduler'` — keep this import as-is.

**Step 2: Update AutoScheduleDialog.vue import**

Find:
```typescript
import {
  buildOccupiedWindows,
  extractScheduledWindows,
  findCapacityConflict,
  type OccupiedScheduleWindow,
} from './scheduleCapacityGuard';
```

Replace with:
```typescript
import {
  buildOccupiedWindows,
  extractScheduledWindows,
  findCapacityConflict,
  type OccupiedScheduleWindow,
} from '@/scheduling/scheduleCapacityGuard';
```

**Step 3: Update test file import**

Find in `tests/unit/scheduleCapacityGuard.test.ts`:
```typescript
import {
  buildOccupiedWindows,
  extractScheduledWindows,
  findCapacityConflict,
} from '@/features/tournaments/dialogs/scheduleCapacityGuard';
```

Replace with:
```typescript
import {
  buildOccupiedWindows,
  extractScheduledWindows,
  findCapacityConflict,
} from '@/scheduling/scheduleCapacityGuard';
```

**Step 4: Delete the old file**

```bash
rm src/features/tournaments/dialogs/scheduleCapacityGuard.ts
```

**Step 5: Run tests**

```bash
npx vitest run tests/unit/scheduleCapacityGuard.test.ts
```
Expected: 5 tests pass.

**Step 6: Commit**

```bash
git add src/scheduling/scheduleCapacityGuard.ts \
  src/features/tournaments/dialogs/AutoScheduleDialog.vue \
  tests/unit/scheduleCapacityGuard.test.ts
git rm src/features/tournaments/dialogs/scheduleCapacityGuard.ts
git commit -m "refactor(scheduling): move scheduleCapacityGuard.ts to src/scheduling/"
```

---

## Task 4: Create `src/scheduling/index.ts`

Public re-exports so consumers can import from `@/scheduling` instead of deep paths.

**Files:**
- Create: `src/scheduling/index.ts`

**Step 1: Create the file**

```typescript
// src/scheduling/index.ts
// Public API for the scheduling module.
// Consumers: import from '@/scheduling' rather than deep-pathing into composables.

export * from './scheduleRules';
export * from './autoScheduleTargets';
export * from './scheduleCapacityGuard';
```

No test needed (re-exports only). Run full test suite to confirm nothing broke:

```bash
npm test -- --run
```
Expected: All tests pass.

**Step 2: Commit**

```bash
git add src/scheduling/index.ts
git commit -m "feat(scheduling): add index.ts public API for scheduling module"
```

---

## Task 5: Update `useTimeScheduler.ts` to use `scheduleRules`

Replace the magic numbers `15` (minRestTimeMinutes default) and `'draft'`/`'published'` string literals with imports from `scheduleRules`.

**Files:**
- Modify: `src/composables/useTimeScheduler.ts`

**Step 1: Read the current defaults in the file**

Open `src/composables/useTimeScheduler.ts` and look for any hard-coded scheduling defaults or `'draft'`/`'published'` literals. You'll find:
- `scheduleStatus: 'draft'` at line ~272 (in `saveTimedSchedule`)
- `scheduleStatus !== 'published'` at line ~302 (in `publishSchedule`)
- `scheduleStatus: 'published'` at line ~306 (in `publishSchedule`)
- `data.scheduleStatus === 'published'` in `unpublishSchedule`
- `scheduleStatus: 'draft'` in `unpublishSchedule`

**Step 2: Add import at the top**

After the existing Firebase imports, add:
```typescript
import { SCHEDULE_STATUS } from '@/scheduling/scheduleRules';
```

**Step 3: Replace string literals with constants**

Replace each `'draft'` and `'published'` status literal with `SCHEDULE_STATUS.draft` / `SCHEDULE_STATUS.published`.

Example, in `saveTimedSchedule`:
```typescript
// Before:
scheduleStatus: 'draft',
// After:
scheduleStatus: SCHEDULE_STATUS.draft,
```

Do this for ALL occurrences in the file (search for `'draft'` and `'published'` as string values assigned to `scheduleStatus`).

**Step 4: Run existing tests**

```bash
npx vitest run tests/unit/useTimeScheduler.clearTimedSchedule.test.ts
```
Expected: 2 tests pass.

Run full suite:
```bash
npm test -- --run
```
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/composables/useTimeScheduler.ts
git commit -m "refactor(scheduling): use SCHEDULE_STATUS constants in useTimeScheduler"
```

---

## Task 6: Update `useMatchScheduler.ts` to use `scheduleRules`

**Files:**
- Modify: `src/composables/useMatchScheduler.ts`

**Step 1: Find the magic numbers**

Open `src/composables/useMatchScheduler.ts` and find:
- Line ~119: `matchDurationMinutes: 30` (default in settings fallback)
- Line ~120: `minRestTimeMinutes: 15` (default in settings fallback)
- Line ~314: `options.matchDurationMinutes ?? settings.matchDurationMinutes ?? 30`
- Line ~315: `options.bufferMinutes ?? settings.bufferMinutes ?? 0` (bufferMinutes default 0 — note: `SCHEDULE_DEFAULTS.bufferMinutes` is 5 but the scheduler defaults to 0 here for backward compat; keep as 0)
- Line ~322: `settings.minRestTimeMinutes ?? 15`

**Step 2: Add import**

```typescript
import { SCHEDULE_DEFAULTS, SCHEDULE_STATUS } from '@/scheduling/scheduleRules';
```

**Step 3: Replace magic numbers**

```typescript
// Before:
const settings = tournament?.settings || {
  matchDurationMinutes: 30,
  minRestTimeMinutes: 15,
};

// After:
const settings = tournament?.settings || {
  matchDurationMinutes: SCHEDULE_DEFAULTS.matchDurationMinutes,
  minRestTimeMinutes: SCHEDULE_DEFAULTS.minRestTimeMinutes,
};
```

```typescript
// Before:
options.matchDurationMinutes ?? settings.matchDurationMinutes ?? 30
// After:
options.matchDurationMinutes ?? settings.matchDurationMinutes ?? SCHEDULE_DEFAULTS.matchDurationMinutes
```

```typescript
// Before:
settings.minRestTimeMinutes ?? 15
// After:
settings.minRestTimeMinutes ?? SCHEDULE_DEFAULTS.minRestTimeMinutes
```

Also replace `scheduledTime: null` in `clearSchedule` — this write will be deprecated in Task 11, but for now leave it as-is (we address legacy fields separately).

**Step 4: Run tests**

```bash
npm test -- --run
```
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/composables/useMatchScheduler.ts
git commit -m "refactor(scheduling): use SCHEDULE_DEFAULTS constants in useMatchScheduler"
```

---

## Task 7: Extract `useScheduleOrchestrator.ts`

This extracts the scheduling orchestration logic from `AutoScheduleDialog.vue` into a testable composable. The dialog becomes pure UI.

**Files:**
- Create: `src/scheduling/useScheduleOrchestrator.ts`
- Create: `tests/unit/useScheduleOrchestrator.test.ts`
- Modify: `src/features/tournaments/dialogs/AutoScheduleDialog.vue`

### Step 1: Write failing tests

Create `tests/unit/useScheduleOrchestrator.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the scheduler and capacity guard
const mockScheduleMatches = vi.fn();
const mockClearTimedScheduleScopes = vi.fn();

vi.mock('@/composables/useMatchScheduler', () => ({
  useMatchScheduler: () => ({
    scheduleMatches: mockScheduleMatches,
    loading: { value: false },
    error: { value: null },
    progress: { value: 0 },
  }),
}));

vi.mock('@/composables/useTimeScheduler', () => ({
  clearTimedScheduleScopes: mockClearTimedScheduleScopes,
}));

vi.mock('@/scheduling/scheduleCapacityGuard', () => ({
  buildOccupiedWindows: vi.fn().mockReturnValue([]),
  extractScheduledWindows: vi.fn().mockReturnValue([]),
  findCapacityConflict: vi.fn().mockReturnValue(null),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: vi.fn(),
  }),
}));

describe('useScheduleOrchestrator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockScheduleMatches.mockResolvedValue({
      scheduled: [{ matchId: 'm-1', scheduledTime: new Date('2026-01-01T09:00:00Z'), estimatedEndTime: new Date('2026-01-01T09:30:00Z'), courtId: '', courtNumber: 0, sequence: 1 }],
      unscheduled: [],
      stats: { scheduledCount: 1, unscheduledCount: 0, totalMatches: 1, courtUtilization: 0, estimatedDuration: 30 },
    });
    mockClearTimedScheduleScopes.mockResolvedValue({ clearedCount: 1 });
  });

  it('clears level scopes then schedules for leveled targets', async () => {
    const { useScheduleOrchestrator } = await import('@/scheduling/useScheduleOrchestrator');
    const orchestrator = useScheduleOrchestrator();

    await orchestrator.runSchedule({
      tournamentId: 't-1',
      targets: [
        { categoryId: 'cat-1', levelId: 'level-1' },
        { categoryId: 'cat-1', levelId: 'level-2' },
      ],
      activeCourtIds: ['court-1', 'court-2'],
      concurrency: 2,
      matchDurationMinutes: 30,
      bufferMinutes: 5,
      mode: 'sequential',
      allMatchesForCapacity: [],
    });

    expect(mockClearTimedScheduleScopes).toHaveBeenCalledWith('t-1', [
      { categoryId: 'cat-1', levelId: 'level-1' },
      { categoryId: 'cat-1', levelId: 'level-2' },
    ]);
    expect(mockScheduleMatches).toHaveBeenCalledTimes(2);
    expect(mockScheduleMatches).toHaveBeenCalledWith('t-1', expect.objectContaining({
      categoryId: 'cat-1',
      levelId: 'level-1',
    }));
  });

  it('does not clear when all targets are base (no levelId)', async () => {
    const { useScheduleOrchestrator } = await import('@/scheduling/useScheduleOrchestrator');
    const orchestrator = useScheduleOrchestrator();

    await orchestrator.runSchedule({
      tournamentId: 't-1',
      targets: [{ categoryId: 'cat-1' }],
      activeCourtIds: ['court-1'],
      concurrency: 1,
      matchDurationMinutes: 30,
      bufferMinutes: 5,
      mode: 'sequential',
      allMatchesForCapacity: [],
    });

    expect(mockClearTimedScheduleScopes).not.toHaveBeenCalled();
    expect(mockScheduleMatches).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/useScheduleOrchestrator.test.ts
```
Expected: FAIL — "Cannot find module '@/scheduling/useScheduleOrchestrator'"

**Step 3: Read AutoScheduleDialog.vue carefully**

Read `src/features/tournaments/dialogs/AutoScheduleDialog.vue` lines 356–560 to understand:
- `scheduleCategoryWithConfig()` — wraps `scheduler.scheduleMatches()` with dialog's reactive params
- `runWithCapacityGuard()` — dry-run loop with conflict detection
- `runSequentialSchedule()` — sequential orchestration
- `runParallelPartitionedSchedule()` — partitioned orchestration
- `buildCapacityOccupiedWindows()` — builds occupied windows excluding selected targets

**Step 4: Create `src/scheduling/useScheduleOrchestrator.ts`**

```typescript
/**
 * Schedule Orchestrator
 *
 * Extracts the multi-category scheduling orchestration logic from
 * AutoScheduleDialog into a testable, UI-free composable.
 */

import { useMatchScheduler, type ScheduleResult } from '@/composables/useMatchScheduler';
import { clearTimedScheduleScopes } from '@/composables/useTimeScheduler';
import { buildOccupiedWindows, extractScheduledWindows, findCapacityConflict, type OccupiedScheduleWindow } from './scheduleCapacityGuard';
import type { ScheduleTarget } from './autoScheduleTargets';
import type { Match } from '@/types';

export interface OrchestrationConfig {
  tournamentId: string;
  targets: ScheduleTarget[];
  activeCourtIds: string[];
  concurrency: number;
  matchDurationMinutes: number;
  bufferMinutes: number;
  mode: 'sequential' | 'parallel_partitioned';
  /** For parallel_partitioned: number of courts per categoryId */
  categoryCourtBudgets?: Record<string, number>;
  isReflowContext?: boolean;
  allowPublishedChanges?: boolean;
  allMatchesForCapacity: Match[];
}

export interface OrchestrationResult extends ScheduleResult {
  estimatedEndTime: Date | null;
}

const MAX_CAPACITY_GUARD_ITERATIONS = 24;

export function useScheduleOrchestrator() {
  const scheduler = useMatchScheduler();

  async function scheduleScopeWithConfig(
    target: ScheduleTarget,
    config: OrchestrationConfig,
    scheduleStart: Date,
    courtIds: string[],
    categoryConcurrency: number,
    dryRun = false
  ): Promise<ScheduleResult> {
    return scheduler.scheduleMatches(config.tournamentId, {
      categoryId: target.categoryId,
      levelId: target.levelId,
      courtIds,
      startTime: scheduleStart,
      matchDurationMinutes: config.matchDurationMinutes,
      bufferMinutes: config.bufferMinutes,
      concurrency: categoryConcurrency,
      respectDependencies: false,
      reflowMode: config.isReflowContext ?? false,
      allowPublishedChanges: config.isReflowContext ? (config.allowPublishedChanges ?? false) : false,
      dryRun,
    });
  }

  async function runWithCapacityGuard(
    target: ScheduleTarget,
    config: OrchestrationConfig,
    requestedStart: Date,
    courtIds: string[],
    categoryConcurrency: number,
    availableCapacity: number,
    occupiedWindows: OccupiedScheduleWindow[]
  ): Promise<{ result: ScheduleResult; resolvedStart: Date; shiftedFrom: Date | null }> {
    const originalStart = new Date(requestedStart);
    const scopedCapacity = Math.max(1, Math.floor(availableCapacity));

    if (occupiedWindows.length === 0) {
      const result = await scheduleScopeWithConfig(target, config, originalStart, courtIds, categoryConcurrency);
      return { result, resolvedStart: originalStart, shiftedFrom: null };
    }

    let candidateStart = new Date(originalStart);
    for (let attempt = 0; attempt < MAX_CAPACITY_GUARD_ITERATIONS; attempt += 1) {
      const dryRun = await scheduleScopeWithConfig(target, config, candidateStart, courtIds, categoryConcurrency, true);
      const candidateWindows = extractScheduledWindows(dryRun.scheduled);

      if (candidateWindows.length === 0) {
        const result = await scheduleScopeWithConfig(target, config, candidateStart, courtIds, categoryConcurrency);
        return { result, resolvedStart: candidateStart, shiftedFrom: candidateStart.getTime() === originalStart.getTime() ? null : originalStart };
      }

      const conflict = findCapacityConflict(occupiedWindows, candidateWindows, scopedCapacity);
      if (!conflict) {
        const result = await scheduleScopeWithConfig(target, config, candidateStart, courtIds, categoryConcurrency);
        return { result, resolvedStart: candidateStart, shiftedFrom: candidateStart.getTime() === originalStart.getTime() ? null : originalStart };
      }

      if (conflict.nextBoundaryMs <= candidateStart.getTime()) break;
      candidateStart = new Date(conflict.nextBoundaryMs);
    }

    throw new Error('Unable to find non-conflicting schedule window with current court capacity');
  }

  async function runSchedule(config: OrchestrationConfig, startTime: Date = new Date()): Promise<OrchestrationResult> {
    // 1. Clear level scopes if scheduling leveled categories (prevents stale metadata)
    const leveledTargets = config.targets.filter((t) => Boolean(t.levelId));
    if (leveledTargets.length > 0) {
      await clearTimedScheduleScopes(config.tournamentId, leveledTargets);
    }

    // 2. Build occupied windows (exclude targets we're about to schedule)
    const occupiedWindows = buildOccupiedWindows(config.allMatchesForCapacity, {
      fallbackDurationMinutes: Math.max(1, config.matchDurationMinutes),
      excludeScopes: config.targets,
    });

    // 3. Run the appropriate mode
    if (config.mode === 'parallel_partitioned') {
      return runParallelPartitioned(config, startTime, occupiedWindows);
    }
    return runSequential(config, startTime, occupiedWindows);
  }

  async function runSequential(
    config: OrchestrationConfig,
    start: Date,
    occupiedWindows: OccupiedScheduleWindow[]
  ): Promise<OrchestrationResult> {
    let totalScheduled = 0;
    let totalUnscheduled = 0;
    const allScheduled: ScheduleResult['scheduled'] = [];
    const allUnscheduled: ScheduleResult['unscheduled'] = [];
    let estimatedEndTime: Date | null = null;
    let nextStart = new Date(start);

    for (const target of config.targets) {
      const { result } = await runWithCapacityGuard(
        target, config, nextStart,
        config.activeCourtIds,
        Math.max(1, config.concurrency),
        config.activeCourtIds.length,
        occupiedWindows
      );

      totalScheduled += result.stats.scheduledCount;
      totalUnscheduled += result.stats.unscheduledCount;
      allScheduled.push(...result.scheduled);
      allUnscheduled.push(...result.unscheduled);

      const targetEnd = result.scheduled.reduce<Date | null>((latest, item) => {
        if (!latest || item.estimatedEndTime > latest) return item.estimatedEndTime;
        return latest;
      }, null);

      if (targetEnd && (!estimatedEndTime || targetEnd > estimatedEndTime)) {
        estimatedEndTime = targetEnd;
      }

      if (targetEnd) {
        nextStart = new Date(targetEnd.getTime() + config.bufferMinutes * 60_000);
      }
    }

    return {
      scheduled: allScheduled,
      unscheduled: allUnscheduled,
      estimatedEndTime,
      stats: {
        totalMatches: totalScheduled + totalUnscheduled,
        scheduledCount: totalScheduled,
        unscheduledCount: totalUnscheduled,
        courtUtilization: 0,
        estimatedDuration: estimatedEndTime
          ? Math.ceil((estimatedEndTime.getTime() - start.getTime()) / 60_000)
          : 0,
      },
    };
  }

  async function runParallelPartitioned(
    config: OrchestrationConfig,
    start: Date,
    occupiedWindows: OccupiedScheduleWindow[]
  ): Promise<OrchestrationResult> {
    const allScheduled: ScheduleResult['scheduled'] = [];
    const allUnscheduled: ScheduleResult['unscheduled'] = [];
    let totalScheduled = 0;
    let totalUnscheduled = 0;
    let estimatedEndTime: Date | null = null;
    let courtCursor = 0;

    const categoryTargetMap = new Map<string, ScheduleTarget[]>();
    for (const target of config.targets) {
      const existing = categoryTargetMap.get(target.categoryId) ?? [];
      categoryTargetMap.set(target.categoryId, [...existing, target]);
    }

    for (const [categoryId, targets] of categoryTargetMap.entries()) {
      const budget = config.categoryCourtBudgets?.[categoryId] ?? 1;
      const courtSlice = config.activeCourtIds.slice(courtCursor, courtCursor + budget);
      courtCursor += budget;

      for (const target of targets) {
        const { result } = await runWithCapacityGuard(
          target, config, start,
          courtSlice,
          Math.max(1, courtSlice.length),
          courtSlice.length,
          occupiedWindows
        );

        totalScheduled += result.stats.scheduledCount;
        totalUnscheduled += result.stats.unscheduledCount;
        allScheduled.push(...result.scheduled);
        allUnscheduled.push(...result.unscheduled);

        const targetEnd = result.scheduled.reduce<Date | null>((latest, item) => {
          if (!latest || item.estimatedEndTime > latest) return item.estimatedEndTime;
          return latest;
        }, null);

        if (targetEnd && (!estimatedEndTime || targetEnd > estimatedEndTime)) {
          estimatedEndTime = targetEnd;
        }
      }
    }

    return {
      scheduled: allScheduled,
      unscheduled: allUnscheduled,
      estimatedEndTime,
      stats: {
        totalMatches: totalScheduled + totalUnscheduled,
        scheduledCount: totalScheduled,
        unscheduledCount: totalUnscheduled,
        courtUtilization: 0,
        estimatedDuration: estimatedEndTime
          ? Math.ceil((estimatedEndTime.getTime() - start.getTime()) / 60_000)
          : 0,
      },
    };
  }

  return { runSchedule, loading: scheduler.loading, error: scheduler.error, progress: scheduler.progress };
}
```

**Step 5: Run tests**

```bash
npx vitest run tests/unit/useScheduleOrchestrator.test.ts
```
Expected: 2 tests pass.

**Step 6: Update AutoScheduleDialog.vue to use the orchestrator**

Now that the orchestrator exists, update `AutoScheduleDialog.vue`:

1. Add import:
```typescript
import { useScheduleOrchestrator, type OrchestrationConfig } from '@/scheduling/useScheduleOrchestrator';
```

2. Add composable instance:
```typescript
const orchestrator = useScheduleOrchestrator();
```

3. Find the `runDraft()` function in the dialog (search for `async function runDraft`). It calls `runSequentialSchedule` or `runParallelPartitionedSchedule`. Replace its body to delegate to the orchestrator:

```typescript
async function runDraft(): Promise<void> {
  loading.value = true;
  lastResult.value = null;

  try {
    const startDate = new Date(startTime.value);
    const config: OrchestrationConfig = {
      tournamentId: props.tournamentId,
      targets: scheduleTargets.value,
      activeCourtIds: activeCourtIds.value,
      concurrency: effectiveConcurrency.value,
      matchDurationMinutes: matchDuration.value,
      bufferMinutes: breakTime.value,
      mode: mode.value,
      categoryCourtBudgets: isParallelPartitioned.value ? categoryCourtBudgets.value : undefined,
      isReflowContext: isReflowContext.value,
      allowPublishedChanges: allowPublishedChanges.value,
      allMatchesForCapacity: matchStore.matches,
    };

    const result = await orchestrator.runSchedule(config, startDate);

    lastResult.value = {
      totalScheduled: result.stats.scheduledCount,
      totalUnscheduled: result.stats.unscheduledCount,
      estimatedEndTime: result.estimatedEndTime,
      unscheduledList: result.unscheduled,
      scheduledCategoryIds: selectedCategoryIds.value,
    };

    if (result.stats.scheduledCount === 0) {
      notificationStore.showToast('warning', 'No matches were scheduled. Check that brackets have been generated.');
    }

    emit('scheduled', result);
  } catch (err) {
    notificationStore.showToast('error', err instanceof Error ? err.message : 'Scheduling failed');
  } finally {
    loading.value = false;
  }
}
```

4. Remove the now-unused private functions from AutoScheduleDialog.vue:
   - `scheduleCategoryWithConfig()`
   - `runWithCapacityGuard()`
   - `runSequentialSchedule()`
   - `runParallelPartitionedSchedule()`
   - `buildCapacityOccupiedWindows()`
   - `notifyAdjustedStart()`

Also remove the import of `useMatchScheduler` from the dialog (the orchestrator handles it).

**Step 7: Run full test suite**

```bash
npm test -- --run
```
Expected: All tests pass (including AutoScheduleDialog.level-scope tests — they mock the scheduler, so they should still work once you verify they still import correctly).

If `AutoScheduleDialog.level-scope.test.ts` fails because it called the old internal functions, update it to mock `useScheduleOrchestrator` instead.

**Step 8: Update `src/scheduling/index.ts` to export orchestrator**

```typescript
export * from './scheduleRules';
export * from './autoScheduleTargets';
export * from './scheduleCapacityGuard';
export * from './useScheduleOrchestrator';
```

**Step 9: Commit**

```bash
git add src/scheduling/useScheduleOrchestrator.ts \
  tests/unit/useScheduleOrchestrator.test.ts \
  src/features/tournaments/dialogs/AutoScheduleDialog.vue \
  src/scheduling/index.ts
git commit -m "refactor(scheduling): extract useScheduleOrchestrator from AutoScheduleDialog"
```

---

## Task 8: Extract `useScheduleStore.ts` from `matches.ts`

Extract scheduling-specific Firestore operations out of the large `matches.ts` store.

**Files:**
- Read first: `src/stores/matches.ts` (focus on scheduling methods)
- Create: `src/scheduling/useScheduleStore.ts`
- Modify: `src/stores/matches.ts`

**Step 1: Identify scheduling methods in matches.ts**

Open `src/stores/matches.ts` and search for these methods to identify what to extract:
- `saveManualPlannedTime()` — saves a manually set time for a single match
- Any method that sets `scheduleStatus`, `publishedAt`, `publishedBy` on a match
- Any method that reads `scheduledTime` (legacy field)

Methods that deal with scoring, bracket state, court assignment in real-time should stay in `matches.ts`.

**Step 2: Create `src/scheduling/useScheduleStore.ts`**

```typescript
/**
 * Schedule Store Operations
 *
 * Firestore operations specific to scheduling (not scoring or bracket progression).
 * Extracted from matches.ts to keep the scheduling module self-contained.
 */

import {
  db,
  doc,
  setDoc,
  Timestamp,
  serverTimestamp,
} from '@/services/firebase';
import { SCHEDULE_STATUS, SCHEDULE_FIELDS } from './scheduleRules';

export interface ManualPlannedTimeInput {
  tournamentId: string;
  categoryId: string;
  matchId: string;
  plannedStartAt: Date;
  matchDurationMinutes: number;
  lockedTime?: boolean;
  levelId?: string;
}

function getMatchScoresPath(tournamentId: string, categoryId: string, levelId?: string): string {
  return levelId
    ? `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match_scores`
    : `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;
}

export async function saveManualPlannedTime(input: ManualPlannedTimeInput): Promise<void> {
  const { tournamentId, categoryId, matchId, plannedStartAt, matchDurationMinutes, lockedTime, levelId } = input;
  const plannedEndAt = new Date(plannedStartAt.getTime() + matchDurationMinutes * 60_000);

  const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
  await setDoc(
    doc(db, matchScoresPath, matchId),
    {
      [SCHEDULE_FIELDS.plannedStartAt]: Timestamp.fromDate(plannedStartAt),
      [SCHEDULE_FIELDS.plannedEndAt]: Timestamp.fromDate(plannedEndAt),
      [SCHEDULE_FIELDS.scheduleStatus]: SCHEDULE_STATUS.draft,
      ...(lockedTime !== undefined ? { [SCHEDULE_FIELDS.lockedTime]: lockedTime } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
```

**Step 3: Update `matches.ts` to delegate to `useScheduleStore`**

In `matches.ts`, find the `saveManualPlannedTime` method (or equivalent). Import `saveManualPlannedTime` from `@/scheduling/useScheduleStore` and have the store method delegate to it.

Pattern:
```typescript
// In matches.ts
import { saveManualPlannedTime as savePlannedTimeOp } from '@/scheduling/useScheduleStore';

// Replace the body of the store's saveManualPlannedTime:
async saveManualPlannedTime(input: ManualPlannedTimeInput) {
  await savePlannedTimeOp(input);
}
```

**Step 4: Update index.ts**

```typescript
export * from './useScheduleStore';
```

**Step 5: Run full test suite**

```bash
npm test -- --run
```
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/scheduling/useScheduleStore.ts src/stores/matches.ts src/scheduling/index.ts
git commit -m "refactor(scheduling): extract saveManualPlannedTime to useScheduleStore"
```

---

## Task 9: Install `xlsx` and create `scheduleExport.ts`

**Files:**
- Modify: `package.json` (add dependency)
- Create: `src/features/tournaments/utils/scheduleExport.ts`
- Create: `tests/unit/scheduleExport.test.ts`

**Step 1: Install SheetJS**

```bash
npm install xlsx
```

Verify it was added to `package.json` dependencies.

**Step 2: Write failing tests**

Create `tests/unit/scheduleExport.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildScheduleExportRows, formatExportTime } from '@/features/tournaments/utils/scheduleExport';

const t0 = new Date('2026-01-01T09:00:00.000Z');
const t30 = new Date('2026-01-01T09:30:00.000Z');
const t60 = new Date('2026-01-01T10:00:00.000Z');

const makeMatch = (overrides: Record<string, unknown>) => ({
  id: 'm-1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  participant1Id: 'p1',
  participant2Id: 'p2',
  status: 'scheduled',
  plannedStartAt: t0,
  plannedEndAt: t30,
  scheduleStatus: 'published',
  courtId: 'court-1',
  scores: [],
  ...overrides,
});

describe('buildScheduleExportRows', () => {
  it('returns one row per scheduled match sorted by time', () => {
    const matches = [
      makeMatch({ id: 'm-2', plannedStartAt: t30, plannedEndAt: t60 }),
      makeMatch({ id: 'm-1', plannedStartAt: t0, plannedEndAt: t30 }),
    ];

    const rows = buildScheduleExportRows(
      matches,
      (id) => (id === 'cat-1' ? "Men's Singles" : id),
      (id) => (id === 'p1' ? 'Ali' : 'Bob'),
      (id) => (id === 'court-1' ? 'Court 1' : id)
    );

    expect(rows).toHaveLength(2);
    expect(rows[0].matchId).toBe('m-1');
    expect(rows[1].matchId).toBe('m-2');
  });

  it('appends unscheduled matches at the bottom with empty time', () => {
    const matches = [
      makeMatch({ id: 'm-1', plannedStartAt: t0 }),
      makeMatch({ id: 'm-2', plannedStartAt: undefined }),
    ];

    const rows = buildScheduleExportRows(matches, () => 'Cat', () => 'Player', () => 'Court');

    expect(rows[0].matchId).toBe('m-1');
    expect(rows[1].matchId).toBe('m-2');
    expect(rows[1].plannedStartDisplay).toBe('');
  });

  it('includes duration in minutes', () => {
    const matches = [makeMatch({ plannedStartAt: t0, plannedEndAt: t30 })];
    const rows = buildScheduleExportRows(matches, () => 'Cat', () => 'P', () => 'C');
    expect(rows[0].durationMinutes).toBe(30);
  });
});

describe('formatExportTime', () => {
  it('formats time as HH:MM in local timezone representation', () => {
    // Just verify it returns a non-empty string for a valid date
    expect(formatExportTime(t0)).toBeTruthy();
    expect(typeof formatExportTime(t0)).toBe('string');
  });

  it('returns empty string for undefined', () => {
    expect(formatExportTime(undefined)).toBe('');
  });
});
```

**Step 3: Run test to verify it fails**

```bash
npx vitest run tests/unit/scheduleExport.test.ts
```
Expected: FAIL — "Cannot find module"

**Step 4: Create `src/features/tournaments/utils/scheduleExport.ts`**

```typescript
/**
 * Schedule Export Utilities
 *
 * Builds Excel-exportable rows from match data.
 * Excel download is triggered via the xlsx (SheetJS) library.
 */

import * as XLSX from 'xlsx';
import type { Match } from '@/types';

export interface ScheduleExportRow {
  matchId: string;
  plannedStartDisplay: string;
  plannedEndDisplay: string;
  durationMinutes: number;
  categoryName: string;
  round: number;
  matchNumber: number;
  participant1: string;
  participant2: string;
  courtName: string;
  scheduleStatus: string;
  matchStatus: string;
}

export function formatExportTime(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function buildScheduleExportRows(
  matches: Match[],
  getCategoryName: (id: string) => string,
  getParticipantName: (id: string | undefined) => string,
  getCourtName: (id: string | undefined) => string
): ScheduleExportRow[] {
  const scheduled = matches
    .filter((m) => m.plannedStartAt != null)
    .sort((a, b) => {
      const tA = a.plannedStartAt!.getTime();
      const tB = b.plannedStartAt!.getTime();
      if (tA !== tB) return tA - tB;
      return (getCourtName(a.courtId ?? undefined) ?? '').localeCompare(getCourtName(b.courtId ?? undefined) ?? '');
    });

  const unscheduled = matches.filter((m) => m.plannedStartAt == null);

  const toRow = (m: Match): ScheduleExportRow => {
    const durationMinutes = m.plannedStartAt && m.plannedEndAt
      ? Math.round((m.plannedEndAt.getTime() - m.plannedStartAt.getTime()) / 60_000)
      : 0;

    return {
      matchId: m.id,
      plannedStartDisplay: formatExportTime(m.plannedStartAt ?? undefined),
      plannedEndDisplay: formatExportTime(m.plannedEndAt ?? undefined),
      durationMinutes,
      categoryName: getCategoryName(m.categoryId),
      round: m.round,
      matchNumber: m.matchNumber,
      participant1: getParticipantName(m.participant1Id),
      participant2: getParticipantName(m.participant2Id),
      courtName: getCourtName(m.courtId ?? undefined),
      scheduleStatus: m.scheduleStatus ?? 'not_scheduled',
      matchStatus: m.status ?? '',
    };
  };

  return [...scheduled, ...unscheduled].map(toRow);
}

export function downloadScheduleAsExcel(
  rows: ScheduleExportRow[],
  tournamentName: string
): void {
  const headers = [
    'Time', 'End Time', 'Duration (min)', 'Match #', 'Category',
    'Round', 'Participant 1', 'Participant 2', 'Court',
    'Schedule Status', 'Match Status',
  ];

  const data = rows.map((row) => [
    row.plannedStartDisplay,
    row.plannedEndDisplay,
    row.durationMinutes || '',
    row.matchNumber,
    row.categoryName,
    row.round,
    row.participant1,
    row.participant2,
    row.courtName,
    row.scheduleStatus,
    row.matchStatus,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Column widths
  ws['!cols'] = [
    { wch: 8 },  // Time
    { wch: 8 },  // End
    { wch: 12 }, // Duration
    { wch: 8 },  // Match #
    { wch: 20 }, // Category
    { wch: 6 },  // Round
    { wch: 22 }, // P1
    { wch: 22 }, // P2
    { wch: 12 }, // Court
    { wch: 14 }, // Sched Status
    { wch: 12 }, // Match Status
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Schedule');

  const date = new Date().toISOString().slice(0, 10);
  const safeName = tournamentName.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `schedule-${safeName}-${date}.xlsx`);
}
```

**Step 5: Run tests**

```bash
npx vitest run tests/unit/scheduleExport.test.ts
```
Expected: 4 tests pass.

**Step 6: Run full suite**

```bash
npm test -- --run
```
Expected: All tests pass.

**Step 7: Commit**

```bash
git add package.json package-lock.json \
  src/features/tournaments/utils/scheduleExport.ts \
  tests/unit/scheduleExport.test.ts
git commit -m "feat(scheduling): add scheduleExport.ts with Excel download via SheetJS"
```

---

## Task 10: Build `ScheduleGridView.vue`

The timeline grid: rows = 15-minute time slots, columns = courts, match cards span rows.

**Files:**
- Create: `tests/unit/ScheduleGridView.test.ts`
- Create: `src/features/tournaments/components/ScheduleGridView.vue`

### Step 1: Write failing tests for slot computation logic

Create `tests/unit/ScheduleGridView.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  computeTimeSlots,
  computeMatchRowSpan,
  computeSlotIndex,
  buildGridCellMap,
} from '@/features/tournaments/components/ScheduleGridView';

// 2026-01-01 09:00 UTC
const BASE = new Date('2026-01-01T09:00:00.000Z').getTime();
const MIN15 = 15 * 60_000;

describe('computeTimeSlots', () => {
  it('generates slots at 15-minute intervals', () => {
    const start = new Date(BASE);
    const end = new Date(BASE + MIN15 * 4);
    const slots = computeTimeSlots(start, end, 15);
    expect(slots).toHaveLength(4);
    expect(slots[0].getTime()).toBe(BASE);
    expect(slots[1].getTime()).toBe(BASE + MIN15);
    expect(slots[3].getTime()).toBe(BASE + MIN15 * 3);
  });

  it('returns empty array when start equals end', () => {
    const t = new Date(BASE);
    expect(computeTimeSlots(t, t, 15)).toHaveLength(0);
  });
});

describe('computeMatchRowSpan', () => {
  it('calculates span for a 30-min match on 15-min slots as 2', () => {
    const match = {
      plannedStartAt: new Date(BASE),
      plannedEndAt: new Date(BASE + 30 * 60_000),
    };
    expect(computeMatchRowSpan(match, 15)).toBe(2);
  });

  it('returns 1 for a match shorter than one slot', () => {
    const match = {
      plannedStartAt: new Date(BASE),
      plannedEndAt: new Date(BASE + 10 * 60_000),
    };
    expect(computeMatchRowSpan(match, 15)).toBe(1);
  });
});

describe('computeSlotIndex', () => {
  it('returns 0 for a match starting at grid start', () => {
    expect(computeSlotIndex(BASE, BASE, 15)).toBe(0);
  });

  it('returns 2 for a match starting 30 min after grid start', () => {
    expect(computeSlotIndex(BASE + 30 * 60_000, BASE, 15)).toBe(2);
  });
});

describe('buildGridCellMap', () => {
  it('maps a match to the correct slot and court', () => {
    const gridStart = new Date(BASE);
    const match = {
      id: 'm-1',
      courtId: 'court-1',
      plannedStartAt: new Date(BASE),
      plannedEndAt: new Date(BASE + 30 * 60_000),
      scheduleStatus: 'published',
      categoryId: 'cat-1',
    };

    const map = buildGridCellMap([match as any], gridStart, ['court-1', 'court-2'], 15);

    // Slot 0, court index 0 should have this match
    expect(map.get('0:0')?.id).toBe('m-1');
    // Slot 1 (continuation) should be marked
    expect(map.get('1:0')).toBe('continuation');
  });

  it('marks continuation cells for multi-slot matches', () => {
    const gridStart = new Date(BASE);
    const match = {
      id: 'm-1',
      courtId: 'court-1',
      plannedStartAt: new Date(BASE),
      plannedEndAt: new Date(BASE + 45 * 60_000), // 3 slots
    };

    const map = buildGridCellMap([match as any], gridStart, ['court-1'], 15);

    expect(map.get('0:0')?.id).toBe('m-1');
    expect(map.get('1:0')).toBe('continuation');
    expect(map.get('2:0')).toBe('continuation');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/ScheduleGridView.test.ts
```
Expected: FAIL — "Cannot find module"

**Step 3: Create the logic exports in `src/features/tournaments/components/ScheduleGridView.ts`**

Create a companion `.ts` file (not `.vue`) for the pure logic functions, which are importable in tests without needing Vue/Vuetify:

```typescript
// src/features/tournaments/components/ScheduleGridView.ts
// Pure logic functions — testable without DOM/Vue

export type GridCellValue = { id: string; [key: string]: unknown } | 'continuation' | null;

export function computeTimeSlots(start: Date, end: Date, intervalMinutes: number): Date[] {
  const slots: Date[] = [];
  const intervalMs = intervalMinutes * 60_000;
  for (let t = start.getTime(); t < end.getTime(); t += intervalMs) {
    slots.push(new Date(t));
  }
  return slots;
}

export function computeMatchRowSpan(
  match: { plannedStartAt?: Date; plannedEndAt?: Date },
  intervalMinutes: number
): number {
  if (!match.plannedStartAt || !match.plannedEndAt) return 1;
  const durationMs = match.plannedEndAt.getTime() - match.plannedStartAt.getTime();
  return Math.max(1, Math.ceil(durationMs / (intervalMinutes * 60_000)));
}

export function computeSlotIndex(matchStartMs: number, gridStartMs: number, intervalMinutes: number): number {
  const intervalMs = intervalMinutes * 60_000;
  return Math.round((matchStartMs - gridStartMs) / intervalMs);
}

export function buildGridCellMap(
  matches: Array<{ id: string; courtId?: string | null; plannedStartAt?: Date; plannedEndAt?: Date; [key: string]: unknown }>,
  gridStart: Date,
  courtIds: string[],
  intervalMinutes: number
): Map<string, GridCellValue> {
  const map = new Map<string, GridCellValue>();

  for (const match of matches) {
    if (!match.plannedStartAt || !match.courtId) continue;

    const courtIndex = courtIds.indexOf(match.courtId as string);
    if (courtIndex === -1) continue;

    const slotIndex = computeSlotIndex(match.plannedStartAt.getTime(), gridStart.getTime(), intervalMinutes);
    const rowSpan = computeMatchRowSpan(match, intervalMinutes);

    // Mark the starting cell
    map.set(`${slotIndex}:${courtIndex}`, match);

    // Mark continuation cells
    for (let s = 1; s < rowSpan; s++) {
      map.set(`${slotIndex + s}:${courtIndex}`, 'continuation');
    }
  }

  return map;
}
```

**Step 4: Run logic tests**

```bash
npx vitest run tests/unit/ScheduleGridView.test.ts
```
Expected: All tests pass.

**Step 5: Create `src/features/tournaments/components/ScheduleGridView.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { Match, Court } from '@/types';
import { SCHEDULE_DEFAULTS, SCHEDULE_STATUS } from '@/scheduling/scheduleRules';
import {
  computeTimeSlots,
  computeMatchRowSpan,
  buildGridCellMap,
} from './ScheduleGridView';

const props = defineProps<{
  matches: Match[];
  courts: Court[];
  /** Filter by publicState: 'all' | 'published' | 'draft' */
  publicState?: string;
  getCategoryName: (id: string) => string;
  getParticipantName: (id: string | undefined) => string;
}>();

const SLOT_INTERVAL = SCHEDULE_DEFAULTS.slotIntervalMinutes;
const CELL_HEIGHT_PX = 40;

const filteredMatches = computed(() => {
  const { publicState } = props;
  if (!publicState || publicState === 'all') return props.matches;
  if (publicState === 'published') return props.matches.filter((m) => m.scheduleStatus === SCHEDULE_STATUS.published);
  if (publicState === 'draft') return props.matches.filter((m) => m.scheduleStatus === SCHEDULE_STATUS.draft);
  return props.matches;
});

const scheduledMatches = computed(() =>
  filteredMatches.value.filter((m) => m.plannedStartAt != null)
);

const unscheduledMatches = computed(() =>
  filteredMatches.value.filter((m) => m.plannedStartAt == null)
);

const gridStart = computed((): Date | null => {
  if (scheduledMatches.value.length === 0) return null;
  const earliest = Math.min(...scheduledMatches.value.map((m) => m.plannedStartAt!.getTime()));
  // Round down to nearest slot interval
  const intervalMs = SLOT_INTERVAL * 60_000;
  return new Date(Math.floor(earliest / intervalMs) * intervalMs);
});

const gridEnd = computed((): Date | null => {
  if (scheduledMatches.value.length === 0) return null;
  const latest = Math.max(...scheduledMatches.value.map((m) => (m.plannedEndAt ?? m.plannedStartAt!).getTime()));
  const intervalMs = SLOT_INTERVAL * 60_000;
  return new Date(Math.ceil(latest / intervalMs) * intervalMs);
});

const timeSlots = computed((): Date[] => {
  if (!gridStart.value || !gridEnd.value) return [];
  return computeTimeSlots(gridStart.value, gridEnd.value, SLOT_INTERVAL);
});

const activeCourts = computed(() =>
  props.courts.filter((c) => c.status !== 'maintenance').sort((a, b) => a.number - b.number)
);

const courtIds = computed(() => activeCourts.value.map((c) => c.id));

const cellMap = computed(() => {
  if (!gridStart.value) return new Map();
  return buildGridCellMap(scheduledMatches.value, gridStart.value, courtIds.value, SLOT_INTERVAL);
});

function formatSlotTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function matchRowSpan(match: Match): number {
  return computeMatchRowSpan(match, SLOT_INTERVAL);
}

function statusColor(status: string | undefined): string {
  switch (status) {
    case SCHEDULE_STATUS.published: return 'primary';
    case SCHEDULE_STATUS.draft: return 'grey';
    default: return 'grey-lighten-2';
  }
}

function matchLabel(match: Match): string {
  const p1 = props.getParticipantName(match.participant1Id);
  const p2 = props.getParticipantName(match.participant2Id);
  return `${p1} vs ${p2}`;
}
</script>

<template>
  <div class="schedule-grid-wrapper">
    <!-- Empty state -->
    <v-alert v-if="timeSlots.length === 0" type="info" variant="tonal" class="ma-4">
      No scheduled matches to display.
      <template v-if="unscheduledMatches.length > 0">
        {{ unscheduledMatches.length }} match{{ unscheduledMatches.length !== 1 ? 'es' : '' }} are not yet scheduled.
      </template>
    </v-alert>

    <!-- Timeline grid -->
    <div
      v-else
      class="schedule-grid"
      :style="{
        display: 'grid',
        gridTemplateColumns: `70px repeat(${activeCourts.length}, minmax(140px, 1fr))`,
        gridTemplateRows: `40px repeat(${timeSlots.length}, ${CELL_HEIGHT_PX}px)`,
      }"
    >
      <!-- Corner cell -->
      <div class="grid-header grid-corner" />

      <!-- Court headers -->
      <div
        v-for="court in activeCourts"
        :key="court.id"
        class="grid-header grid-court-header"
      >
        {{ court.name }}
      </div>

      <!-- Time rows -->
      <template v-for="(slot, slotIdx) in timeSlots" :key="slotIdx">
        <!-- Time label -->
        <div class="grid-time-label">
          {{ formatSlotTime(slot) }}
        </div>

        <!-- Court cells for this slot -->
        <template v-for="(court, courtIdx) in activeCourts" :key="court.id">
          <template v-if="cellMap.get(`${slotIdx}:${courtIdx}`) && cellMap.get(`${slotIdx}:${courtIdx}`) !== 'continuation'">
            <div
              class="grid-match-card"
              :style="{
                gridRow: `${slotIdx + 2} / span ${matchRowSpan(cellMap.get(`${slotIdx}:${courtIdx}`) as Match)}`,
                gridColumn: `${courtIdx + 2}`,
              }"
            >
              <v-chip :color="statusColor((cellMap.get(`${slotIdx}:${courtIdx}`) as Match).scheduleStatus)" size="x-small" class="mb-1">
                {{ (cellMap.get(`${slotIdx}:${courtIdx}`) as Match).scheduleStatus ?? 'draft' }}
              </v-chip>
              <div class="match-category text-caption text-grey-darken-1">
                {{ getCategoryName((cellMap.get(`${slotIdx}:${courtIdx}`) as Match).categoryId) }}
              </div>
              <div class="match-participants text-body-2 font-weight-medium">
                {{ matchLabel(cellMap.get(`${slotIdx}:${courtIdx}`) as Match) }}
              </div>
            </div>
          </template>
          <!-- Empty cell (no match, no continuation) -->
          <div
            v-else-if="!cellMap.has(`${slotIdx}:${courtIdx}`)"
            class="grid-empty-cell"
            :style="{ gridRow: slotIdx + 2, gridColumn: courtIdx + 2 }"
          />
        </template>
      </template>
    </div>

    <!-- Unscheduled panel -->
    <v-expansion-panels v-if="unscheduledMatches.length > 0" class="mt-4 mx-4">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon color="warning" class="mr-2">mdi-clock-alert-outline</v-icon>
          {{ unscheduledMatches.length }} match{{ unscheduledMatches.length !== 1 ? 'es' : '' }} not yet scheduled
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-list density="compact">
            <v-list-item
              v-for="match in unscheduledMatches"
              :key="match.id"
              :title="matchLabel(match)"
              :subtitle="getCategoryName(match.categoryId)"
            />
          </v-list>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </div>
</template>

<style scoped>
.schedule-grid-wrapper {
  overflow-x: auto;
}

.schedule-grid {
  min-width: 400px;
}

.grid-header {
  position: sticky;
  top: 0;
  background: white;
  z-index: 2;
  font-weight: 600;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 2px solid #e0e0e0;
  padding: 0 8px;
}

.grid-corner {
  position: sticky;
  left: 0;
  z-index: 3;
}

.grid-time-label {
  position: sticky;
  left: 0;
  background: #f5f5f5;
  z-index: 1;
  font-size: 0.7rem;
  color: #757575;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 4px 8px 0 0;
  border-right: 1px solid #e0e0e0;
  border-bottom: 1px solid #eeeeee;
}

.grid-match-card {
  background: #e3f2fd;
  border: 1px solid #90caf9;
  border-radius: 4px;
  padding: 6px 8px;
  margin: 2px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.75rem;
  z-index: 1;
}

.grid-empty-cell {
  border-bottom: 1px solid #eeeeee;
  border-right: 1px solid #eeeeee;
}
</style>
```

**Step 6: Run all tests**

```bash
npm test -- --run
```
Expected: All tests pass.

**Step 7: Commit**

```bash
git add src/features/tournaments/components/ScheduleGridView.ts \
  src/features/tournaments/components/ScheduleGridView.vue \
  tests/unit/ScheduleGridView.test.ts
git commit -m "feat(scheduling): add ScheduleGridView timeline grid component"
```

---

## Task 11: Wire ScheduleGridView into MatchControlView + add Excel export button

**Files:**
- Read first: `src/features/tournaments/views/MatchControlView.vue`
- Modify: `src/features/tournaments/views/MatchControlView.vue`

**Step 1: Find where the "full" schedule layout is rendered**

In `MatchControlView.vue`, search for `scheduleLayout` (used via `matchControlScheduleQuery.ts`). Find where `scheduleLayout === 'full'` shows the data-table vs compact view.

Look for a conditional like:
```vue
<v-data-table v-if="scheduleLayout === 'full'" ... />
```
or check for the `parseScheduleQueryLayout` call and how its result gates rendering.

**Step 2: Import ScheduleGridView and scheduleExport**

Add to the `<script setup>` imports:

```typescript
import ScheduleGridView from '@/features/tournaments/components/ScheduleGridView.vue';
import { buildScheduleExportRows, downloadScheduleAsExcel } from '@/features/tournaments/utils/scheduleExport';
```

**Step 3: Add Excel export handler**

```typescript
function handleExcelExport(): void {
  const rows = buildScheduleExportRows(
    matchStore.matches.filter((m) => m.tournamentId === tournamentId),
    (id) => tournamentStore.getCategoryName(id) ?? id,
    (id) => matchStore.getParticipantName(id) ?? id,
    (id) => tournamentStore.getCourtName(id) ?? id,
  );
  downloadScheduleAsExcel(rows, tournamentStore.currentTournament?.name ?? 'tournament');
}
```

**Step 4: Replace the "full" layout table with ScheduleGridView**

Find the `v-if` that renders the full layout schedule table and replace it:

```vue
<!-- Full schedule layout: timeline grid -->
<template v-if="scheduleLayout === 'full' && currentView === 'schedule'">
  <div class="d-flex justify-end align-center pa-3">
    <v-btn
      variant="outlined"
      size="small"
      prepend-icon="mdi-microsoft-excel"
      @click="handleExcelExport"
    >
      Download Excel
    </v-btn>
  </div>
  <ScheduleGridView
    :matches="filteredScheduleMatches"
    :courts="tournamentStore.courts"
    :public-state="publicState"
    :get-category-name="(id) => tournamentStore.getCategoryName(id) ?? id"
    :get-participant-name="(id) => matchStore.getParticipantName(id) ?? id"
  />
</template>
```

Note: Adapt prop names and data sources to match what `MatchControlView.vue` actually has. Read the file first — find how it calls participant names and category names.

**Step 5: Run full test suite + type check**

```bash
npm test -- --run
npm run type-check
```
Expected: All tests pass, no TypeScript errors.

If there are TypeScript errors in ScheduleGridView.vue related to the `cellMap.get()` return type, add explicit type assertions with `as Match`.

**Step 6: Commit**

```bash
git add src/features/tournaments/views/MatchControlView.vue
git commit -m "feat(scheduling): wire ScheduleGridView and Excel export into MatchControlView"
```

---

## Task 12: Legacy `scheduledTime` field deprecation

Stop writing the legacy field. Add a one-time migration utility.

**Files:**
- Modify: `src/composables/useMatchScheduler.ts`
- Modify: `src/scheduling/useScheduleStore.ts`
- Add utility function to `src/scheduling/useScheduleStore.ts`

**Step 1: Find all `scheduledTime` writes**

```bash
grep -rn "scheduledTime:" src/ --include="*.ts" --include="*.vue"
```

Inspect each hit. Writes to `scheduledTime` (setting it to a value) should be removed. The `clearSchedule` method in `useMatchScheduler.ts` sets `scheduledTime: null` — keep the null-clear for now (it's harmless cleanup).

**Step 2: Remove `scheduledTime` writes in `useMatchScheduler.ts`**

In `scheduleSingleMatch()`, find:
```typescript
scheduledTime: Timestamp.fromDate(scheduledTime),
```
Remove this line. The canonical field is now `plannedStartAt`.

**Step 3: Add `migrateLegacyScheduledTime` to `useScheduleStore.ts`**

```typescript
import { db, collection, getDocs, writeBatch, Timestamp, serverTimestamp } from '@/services/firebase';

/**
 * One-time migration: copies `scheduledTime` → `plannedStartAt` for any
 * match_scores docs that have `scheduledTime` but no `plannedStartAt`.
 *
 * Non-destructive: only writes to docs missing `plannedStartAt`.
 * Safe to run multiple times.
 */
export async function migrateLegacyScheduledTime(
  tournamentId: string,
  categoryId: string,
  levelId?: string
): Promise<{ migratedCount: number }> {
  const path = levelId
    ? `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match_scores`
    : `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;

  const snap = await getDocs(collection(db, path));
  const batch = writeBatch(db);
  let migratedCount = 0;

  for (const d of snap.docs) {
    const data = d.data();
    if (data.scheduledTime && !data.plannedStartAt) {
      batch.update(d.ref, {
        plannedStartAt: data.scheduledTime,
        updatedAt: serverTimestamp(),
      });
      migratedCount++;
    }
  }

  if (migratedCount > 0) await batch.commit();
  return { migratedCount };
}
```

**Step 4: Export from `src/scheduling/index.ts`**

The `useScheduleStore` exports are already included via `export * from './useScheduleStore'`.

**Step 5: Run all tests**

```bash
npm test -- --run
```
Expected: All tests pass.

**Step 6: Commit**

```bash
git add src/composables/useMatchScheduler.ts src/scheduling/useScheduleStore.ts
git commit -m "refactor(scheduling): deprecate scheduledTime writes; add migrateLegacyScheduledTime utility"
```

---

## Task 13: Final regression + lint verification

**Step 1: Run the full test suite in watch mode, confirm zero failures**

```bash
npm test -- --run
```
Expected output example:
```
✓ tests/unit/scheduleRules.test.ts (5)
✓ tests/unit/autoScheduleTargets.test.ts (3)
✓ tests/unit/scheduleCapacityGuard.test.ts (5)
✓ tests/unit/useTimeScheduler.clearTimedSchedule.test.ts (2)
✓ tests/unit/useScheduleOrchestrator.test.ts (2)
✓ tests/unit/ScheduleGridView.test.ts (5)
✓ tests/unit/scheduleExport.test.ts (4)
✓ tests/unit/AutoScheduleDialog.level-scope.test.ts (4)
✓ tests/unit/CategoriesView.draft-schedule-routing.test.ts (1)
✓ tests/unit/PublicScheduleView.test.ts (2)
✓ ... (all other existing tests)
```
Total: 33+ tests, 0 failures.

**Step 2: TypeScript check**

```bash
npm run type-check
```
Expected: No errors.

**Step 3: Scoped ESLint on new/modified files**

```bash
npx eslint src/scheduling/ src/features/tournaments/components/ScheduleGridView.vue src/features/tournaments/components/ScheduleGridView.ts src/features/tournaments/utils/scheduleExport.ts --ext .ts,.vue
```
Expected: 0 errors, 0 warnings.

**Step 4: Manual smoke test**

1. Start dev server: `npm run dev`
2. Navigate to any tournament → Categories → "Schedule Matches"
3. Run auto-schedule → verify draft schedule appears
4. Navigate to Match Control → `?view=schedule&scheduleLayout=full`
5. Verify timeline grid renders with time slots and court columns
6. Click "Download Excel" → verify file downloads and opens correctly
7. Publish the schedule → verify timeline shows published state

**Step 5: Final commit**

```bash
git add -p  # review any straggler changes
git commit -m "feat(scheduling): production scheduling module with timeline grid and Excel export"
```

---

## Verification Checklist

- [ ] `npm test -- --run` → all tests pass (zero failures)
- [ ] `npm run type-check` → zero TypeScript errors
- [ ] Scoped ESLint on `src/scheduling/` → zero errors
- [ ] Timeline grid renders in MatchControlView with `?view=schedule&scheduleLayout=full`
- [ ] Match cards show correct status colors (draft = gray, published = blue)
- [ ] Unscheduled matches appear in collapsed panel below grid
- [ ] "Download Excel" downloads a valid `.xlsx` file with correct columns
- [ ] Auto-schedule still works end-to-end (run, publish, verify public view)
- [ ] `autoScheduleTargets.ts` import in existing tests points to `@/scheduling/`
- [ ] `scheduleCapacityGuard.ts` import in existing tests points to `@/scheduling/`
- [ ] No code still imports from `@/features/tournaments/dialogs/autoScheduleTargets` or `scheduleCapacityGuard`

```bash
# Check for stale imports to old paths
grep -rn "dialogs/autoScheduleTargets\|dialogs/scheduleCapacityGuard" src/ tests/
# Expected: no output
```
