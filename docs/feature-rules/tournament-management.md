# Tournament Management

## Basic Rules / Business Logic
- Tournament creation persists required metadata and organizer ownership.
- Update/delete operations preserve consistency and enforce permission checks.
- Dashboard and settings views consume store-backed tournament source-of-truth.

## Workflow (ASCII)
`[Create Tournament] -> [Persist Metadata] -> [View/Update Settings] -> [Operational Use]`

## Test Coverage
- Direct: `tests/unit/tournaments.store.test.ts`, `tests/unit/TournamentCreateView.test.ts`, `tests/integration/tournament-management.integration.test.ts`
- Indirect: `e2e/p0-tournament-settings.spec.ts`

## Source References
- `src/stores/tournaments.ts`
- `src/features/tournaments/views/TournamentCreateView.vue`
- `src/features/tournaments/views/TournamentSettingsView.vue`
