# BYE/TBD Slot-State And Schedulability

## Basic Rules / Business Logic
- `useMatchSlotState` is the single source of truth for slot labels and schedulability.
- Slot classification is centralized:
  - `resolved`: slot has a participant registration ID.
  - `bye`: one-sided round-1 structural slot, or finalized one-sided context (`winnerId`, `completed`, `walkover`).
  - `tbd`: unresolved placeholder slot that is not BYE (for example later-round one-sided waiting on upstream result).
- Scheduling behavior is centralized:
  - `BYE` matches are never schedulable.
  - `TBD` matches remain schedulable as placeholder time reservations.
- Match Control schedule parity rule:
  - Compact and full schedule layouts must use the same slot-state resolver (`getSlotLabel`) and schedulability gate (`isSchedulableMatch`).
  - BYE rows must be treated as `Not Scheduled` in schedule state.

## Workflow (ASCII)
`[Bracket Match Shape] -> [useMatchSlotState classify slot] -> [Label BYE/TBD/Resolved] -> [isSchedulableMatch gate] -> [Schedule UI + Time Scheduler]`

## Test Coverage
- Direct: `tests/unit/useMatchSlotState.test.ts`, `tests/unit/useMatchScheduler.bye-filter.test.ts`, `tests/unit/MatchControlView.assignments.test.ts`, `tests/unit/ScheduleGridView.rendering.test.ts`, `tests/unit/BracketSlotStateRendering.test.ts`
- Indirect: `tests/unit/timeScheduler.test.ts`, `tests/unit/assignmentGate.test.ts`

## Source References
- `src/composables/useMatchSlotState.ts`
- `src/composables/useMatchScheduler.ts`
- `src/features/tournaments/views/MatchControlView.vue`
- `src/features/tournaments/components/ScheduleGridView.vue`
- `src/features/brackets/components/BracketView.vue`
- `src/features/brackets/components/DoubleEliminationBracket.vue`
