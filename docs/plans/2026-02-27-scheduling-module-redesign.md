# Scheduling Module Redesign

**Date:** 2026-02-27
**Status:** Design Approved — Ready for Implementation

---

## Context

The CourtMastr v2 scheduling system has a sound algorithm but poor organization:
- `AutoScheduleDialog.vue` is 1,040 lines mixing orchestration + UI
- `matches.ts` store is 1,600 lines mixing scheduling + scoring + brackets
- Scheduling defaults (duration, buffer, rest time) are scattered across 3+ files with no single source of truth
- Legacy `scheduledTime` field coexists with canonical `plannedStartAt`
- `autoScheduleTargets.ts` and `scheduleCapacityGuard.ts` live in `dialogs/` with no clear home
- No first-class timeline grid view for admins; no Excel export

**Goal:** Extract a clean `src/scheduling/` module, centralize all scheduling rules, and add a timeline grid view with Excel download — without touching the working algorithm.

---

## What Does NOT Change

- `src/composables/useTimeScheduler.ts` — pure algorithm, zero modifications
- `src/composables/useMatchScheduler.ts` — kept, only imports updated
- All 26 existing unit tests — must pass unchanged
- Firestore data model — no schema migration required
- Draft/publish workflow — no behavioral changes

---

## Module Structure

### New: `src/scheduling/`

```
src/scheduling/
├── scheduleRules.ts              Single source of truth (defaults, constraints, field names, status values)
├── useScheduleOrchestrator.ts    Extracted from AutoScheduleDialog.vue (orchestration only)
├── useScheduleStore.ts           Extracted from matches.ts (scheduling Firestore ops)
├── autoScheduleTargets.ts        MOVED from src/features/tournaments/dialogs/
├── scheduleCapacityGuard.ts      MOVED from src/features/tournaments/dialogs/
└── index.ts                      Clean public API exports
```

### Modified Existing Files

| File | Change |
|---|---|
| `src/features/tournaments/dialogs/AutoScheduleDialog.vue` | UI only; calls `useScheduleOrchestrator`. Target: ~400 lines (down from 1,040) |
| `src/stores/matches.ts` | Scheduling methods extracted to `useScheduleStore`; target ~1,350 lines |
| `src/composables/useTimeScheduler.ts` | Import defaults from `scheduleRules.ts`; no logic change |
| `src/composables/useMatchScheduler.ts` | Import defaults from `scheduleRules.ts`; no logic change |

### New UI Files

| File | Purpose |
|---|---|
| `src/features/tournaments/components/ScheduleGridView.vue` | Timeline grid: rows = 15-min slots, columns = courts |
| `src/features/tournaments/utils/scheduleExport.ts` | Unified export: Excel (.xlsx via SheetJS) + CSV |

---

## `scheduleRules.ts` Design

```typescript
// src/scheduling/scheduleRules.ts

export const SCHEDULE_DEFAULTS = {
  matchDurationMinutes: 30,
  bufferMinutes: 5,
  minRestTimeMinutes: 15,
  concurrency: 2,
  slotIntervalMinutes: 15,          // grid row height in ScheduleGridView
} as const;

export const SCHEDULE_CONSTRAINTS = {
  matchDuration:  { min: 10, max: 120 },
  buffer:         { min: 0,  max: 30 },
  minRestTime:    { min: 0,  max: 60 },
  concurrency:    { min: 1,  max: 20 },
} as const;

// Canonical Firestore field names — no more scattered string literals
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

export const SCHEDULE_STATUS = {
  draft:     'draft',
  published: 'published',
} as const;

export type ScheduleStatus = typeof SCHEDULE_STATUS[keyof typeof SCHEDULE_STATUS];

// Documented algorithmic invariants (enforced in useTimeScheduler)
export const SCHEDULE_RULES = {
  lockedMatchesArePreserved: true,
  concurrencyCountsAvailableCourtsOnly: true,
  capacityGuardIncludesDraft: true,
} as const;
```

---

## `ScheduleGridView.vue` Design

**Layout:** CSS Grid — rows = 15-minute time slots, columns = courts.

```
         | Court 1          | Court 2          | Court 3
─────────┼──────────────────┼──────────────────┼──────────────────
  09:00  │ Men's S · R1     │ Women's S · R1   │
         │ Ali vs Bob       │ Ana vs Carla      │
  09:15  │  (cont.)         │  (cont.)          │
─────────┼──────────────────┼──────────────────┼──────────────────
  09:30  │ Men's S · R1     │ Women's S · R1   │ Mixed D · R1
         │ Carlos vs Dan    │ Eve vs Farah      │ Team A vs B
  09:45  │  (cont.)         │  (cont.)          │  (cont.)
```

**Features:**
- Match cards span rows via `grid-row: start / start+spans`
- Color by status: draft (gray), published (blue), in-progress (amber), completed (green)
- Filter chip: Draft | Published | Both (default: both, draft dimmed)
- Unscheduled matches listed in collapsed panel below grid
- Excel export button (top-right)
- Sticky time column + sticky court header row

**Data source:** Same `matchStore` subscriptions already active in MatchControlView.

**Route:** Replaces the current "full" table view in MatchControlView at
`/tournaments/:tournamentId/match-control?view=schedule&scheduleLayout=full`

---

## Excel Export Design

Library: `xlsx` (SheetJS community edition — free, browser-native, ~500KB).

**Format:** Flat sorted list (not a merged-cell grid — more useful for sharing/printing):

```
Time  | Match | Category     | Participants      | Court   | Duration | Status
09:00 | M1    | Men's S.     | Ali vs Bob        | Court 1 | 30 min   | Published
09:00 | M2    | Women's S.   | Ana vs Carla      | Court 2 | 30 min   | Draft
09:30 | M3    | Men's S.     | Carlos vs Dan     | Court 1 | 30 min   | Published
```

- Sorted by `plannedStartAt`, then by court name
- Unscheduled matches appended at bottom with blank Time column
- Filename: `schedule-{tournamentName}-{date}.xlsx`
- `scheduleExport.ts` also replaces `ExportScheduleDialog.vue` CSV export (consolidation)

---

## Legacy Field Migration

`scheduledTime` (legacy) → `plannedStartAt` (canonical):

1. Add `migrateLegacyScheduledTime(tournamentId)` utility in `src/scheduling/useScheduleStore.ts`
2. Utility reads all `match_scores` docs, copies `scheduledTime → plannedStartAt` where `plannedStartAt` is missing (non-destructive)
3. All code immediately stops **writing** `scheduledTime`
4. Reads fallback to `scheduledTime` until migration runs (one release)
5. Trigger: admin runs from a migration panel or dev runs as script

---

## Testing Strategy

**Constraint:** All 26 existing unit tests must pass unchanged (no algorithm changes).

### New test files

| File | Coverage |
|---|---|
| `tests/unit/scheduleRules.test.ts` | Constants sanity, constraint min ≤ max, no field name typos |
| `tests/unit/useScheduleOrchestrator.test.ts` | Sequential + partitioned mode, capacity shift — mirrors `AutoScheduleDialog.level-scope.test.ts` |
| `tests/unit/ScheduleGridView.test.ts` | Slot calculation, row-span computation, empty slots, publicState filter, unscheduled panel |
| `tests/unit/scheduleExport.test.ts` | Excel columns, row order, date formatting, empty schedule |

### Regression checks
- Run full unit test suite before and after each step
- Scoped ESLint on all modified files

---

## Critical Files

### To Modify
- [src/composables/useTimeScheduler.ts](src/composables/useTimeScheduler.ts) — import defaults from scheduleRules
- [src/composables/useMatchScheduler.ts](src/composables/useMatchScheduler.ts) — import defaults from scheduleRules
- [src/features/tournaments/dialogs/AutoScheduleDialog.vue](src/features/tournaments/dialogs/AutoScheduleDialog.vue) — UI only, call orchestrator
- [src/stores/matches.ts](src/stores/matches.ts) — extract scheduling methods

### To Create
- `src/scheduling/scheduleRules.ts`
- `src/scheduling/useScheduleOrchestrator.ts`
- `src/scheduling/useScheduleStore.ts`
- `src/scheduling/index.ts`
- `src/features/tournaments/components/ScheduleGridView.vue`
- `src/features/tournaments/utils/scheduleExport.ts`

### To Move
- [src/features/tournaments/dialogs/autoScheduleTargets.ts](src/features/tournaments/dialogs/autoScheduleTargets.ts) → `src/scheduling/autoScheduleTargets.ts`
- [src/features/tournaments/dialogs/scheduleCapacityGuard.ts](src/features/tournaments/dialogs/scheduleCapacityGuard.ts) → `src/scheduling/scheduleCapacityGuard.ts`

### Tests to Create
- `tests/unit/scheduleRules.test.ts`
- `tests/unit/useScheduleOrchestrator.test.ts`
- `tests/unit/ScheduleGridView.test.ts`
- `tests/unit/scheduleExport.test.ts`

---

## Verification

1. `npm run test:unit` — all existing 26 tests pass + all new tests pass
2. `npx eslint src/scheduling/ src/features/tournaments/components/ScheduleGridView.vue` — zero errors
3. Manual: Auto-schedule a tournament category, verify results appear in timeline grid
4. Manual: Export to Excel — verify file opens with correct columns + data
5. Manual: Publish draft → verify timeline shows published state
6. Manual: Run `migrateLegacyScheduledTime` — verify no `scheduledTime`-only docs remain
