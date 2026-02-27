# Time-First Scheduling

## Basic Rules / Business Logic
- Scheduling assigns planned start/end times before publication.
- Rest-time/buffer rules constrain generated court timelines.
- Published state is the public-facing schedule contract.

## Workflow (ASCII)
`[Collect Ready Matches] -> [Compute Time Slots] -> [Assign Planned Times] -> [Publish/Unpublish]`

## Test Coverage
- Direct: `tests/unit/timeScheduler.test.ts`, `tests/integration/match-assignment.integration.test.ts`
- Indirect: `tests/unit/assignmentGate.test.ts`, `e2e/p0-match-control-scoring.spec.ts`

## Source References
- `src/composables/useMatchScheduler.ts`
- `src/features/tournaments/views/MatchControlView.vue`
