# Scheduling Capacity Guard + Draft Full View Design

**Date:** 2026-02-27
**Owner:** Codex
**Status:** Approved

## Problem Statement

Two issues were observed:

1. Categories -> `View Draft Schedule` opens Match Control schedule view, but lands in compact mode. Operators need full table mode for draft review from that entry point.
2. Scheduling does not consistently protect court capacity against already scheduled (draft/published) matches in other categories. New schedules can collide in time instead of shifting to the next available window.

## Goals

1. Deep-link from Categories opens Match Control with:
- `view=schedule`
- category pre-filter
- `publicState=draft`
- schedule layout pre-set to `full`

2. Capacity-aware scheduling behavior:
- Existing draft/published schedules in other categories consume courts.
- Re-scheduling current category scope can replace its own schedule (self windows excluded).
- If requested start causes capacity conflict, auto-shift to next available time.
- Notify operator when start is adjusted.

3. Preserve existing hybrid scheduling model:
- sequential default
- parallel partitioned when explicitly chosen

## Non-Goals

1. No change to assign-to-court runtime operations.
2. No forced global full view for all draft filters; only deep-link override.
3. No persistent planned-court-id reservation model.

## Existing Architecture Summary

1. `CategoriesView` routes category menu actions to public/match control views.
2. `MatchControlView` hydrates schedule filters from query and manages compact/full layout state.
3. `AutoScheduleDialog` orchestrates schedule runs (sequential or partitioned) using `useMatchScheduler.scheduleMatches`.
4. `useMatchScheduler` loads scoped matches and delegates timing to `scheduleTimes` in `useTimeScheduler`, then persists draft schedule.

## Proposed Design

### 1) Draft deep-link forces full layout

Add query support for `scheduleLayout` (`compact|full`) in Match Control query parser and hydration logic.

Routing update from category card action:
- `path: /tournaments/:id/match-control`
- `query: { view: 'schedule', category: '<id>', publicState: 'draft', scheduleLayout: 'full' }`

Hydration rule:
- If query includes valid `scheduleLayout`, set `scheduleViewMode` accordingly.
- Applies on first load and query changes.

### 2) Capacity-aware occupancy guard for scheduling

Introduce a scheduling helper module that reuses current scheduler output and computes safe start time by considering occupied court capacity.

Core model:
- Occupied window = existing match with planned start/end and state draft or published.
- Candidate window = simulated schedule results for current target scope.
- Conflict when at any instant: `occupiedCount + candidateCount > totalActiveCourts`.

Algorithm (reuse-first):
1. Build occupied windows from `matchStore.matches`.
2. Exclude windows from currently scheduled scope (same category + same level scope being rescheduled).
3. Run `scheduleMatches(..., dryRun: true)` to simulate candidate windows from requested start.
4. Detect conflicts against occupied capacity timeline.
5. If conflict, advance start to earliest boundary that resolves conflict and re-simulate.
6. Repeat until no conflict (or guard threshold reached).
7. Run one non-dry schedule commit with resolved start.

Notification:
- If adjusted, show warning toast with original and shifted start times.

### 3) Sequential and partitioned compatibility

Sequential mode:
- Resolve each target start using occupancy + prior target results in same run.

Parallel partitioned mode:
- Use explicit category court budgets.
- Effective available courts for each partition = category budget.
- Conflict check uses per-partition capacity against occupied windows.

## Data/Type Additions

1. Query parser type:
- `ScheduleLayout = 'compact' | 'full'`
- `parseScheduleQueryLayout(value)`

2. Scheduler options:
- `dryRun?: boolean` in `useMatchScheduler.scheduleMatches`

3. New helper types (proposed module):
- `ScheduleWindow { startMs, endMs }`
- `OccupiedWindow { startMs, endMs, capacity, categoryId, levelId? }`
- `CapacityResolutionResult { resolvedStart: Date, shifted: boolean, shiftMinutes: number }`

## Error Handling

1. If no valid schedule could be resolved within guard iterations, throw explicit error:
- `Unable to find non-conflicting schedule window with current court capacity`
2. Keep current scheduling failure handling/toasts.
3. If parser gets invalid `scheduleLayout`, fall back to existing default (`compact`).

## Testing Strategy

### Unit tests

1. Match Control query parsing and hydration
- valid `scheduleLayout=full` maps to full
- invalid values fall back to compact default

2. Capacity guard helper
- existing draft blocks capacity
- existing published blocks capacity
- boundary (end == start) is non-conflict
- same-scope windows excluded on re-schedule
- missing `plannedEndAt` uses duration fallback
- no-shift case keeps original start

### Component/dialog tests

1. Categories deep-link contains `scheduleLayout=full`.
2. Match Control starts in full when deep-link query provided.
3. AutoScheduleDialog shifts start and shows warning toast when occupancy conflicts.
4. Multi-category edge case coverage with mixed existing occupancy and per-category court budgets.

## Risks and Mitigations

1. Risk: extra dry-run calls increase scheduling time.
- Mitigation: limit iterations and only dry-run when occupancy exists.

2. Risk: occupancy conflict logic over-blocks.
- Mitigation: boundary-focused tests and self-scope exclusion tests.

3. Risk: regression in existing level-scope scheduling.
- Mitigation: re-run existing level-scope and clear-scope test suites.

## Rollout Plan

1. Implement parser + deep-link full-view support.
2. Add capacity helper and dry-run support.
3. Wire AutoScheduleDialog orchestration.
4. Add tests (unit + dialog + query hydration).
5. Verify with targeted `test` and required `test:log` + `lint:log` protocol.
