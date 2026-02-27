# Court Management

## Basic Rules / Business Logic
- Courts carry availability/status used by assignment and live operation flows.
- Maintenance and availability transitions must be explicit.
- Court metadata drives queueing, overlays, and operational dashboards.

## Workflow (ASCII)
`[Create Court] -> [Assign Status] -> [Use In Match Ops] -> [Release/Maintenance]`

## Test Coverage
- Direct: `tests/unit/CourtManagement.test.ts`, `tests/integration/court-management.integration.test.ts`
- Indirect: `e2e/p0-court-management.spec.ts`, `tests/integration/match-assignment.integration.test.ts`

## Source References
- `src/features/tournaments/views/CourtsView.vue`
- `src/stores/tournaments.ts`
- `src/features/tournaments/views/MatchControlView.vue`
