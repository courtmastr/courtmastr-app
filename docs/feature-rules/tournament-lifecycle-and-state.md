# Tournament Lifecycle And State

## Basic Rules / Business Logic
- Tournament state advances only when prerequisite data exists.
- Lifecycle transitions are constrained by registration, bracket, and live operation readiness.
- State calculations are derived from tournament, category, and match snapshots.

## Workflow (ASCII)
`[Draft] -> [Registration] -> [Bracket Ready] -> [Live] -> [Completed]`

## Test Coverage
- Direct: `tests/unit/tournamentState.test.ts`, `tests/unit/useTournamentStateAdvance.test.ts`
- Indirect: `e2e/tournament-lifecycle.spec.ts`, `tests/unit/tournaments.store.test.ts`

## Source References
- `src/composables/useTournamentStateAdvance.ts`
- `src/stores/tournaments.ts`
- `src/features/tournaments/views/TournamentDashboardView.vue`
