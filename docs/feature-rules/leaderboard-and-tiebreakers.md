# Leaderboard And Tiebreakers

## Basic Rules / Business Logic
- Standings derive from completed match outcomes in scope.
- Tie-breakers apply deterministic ordering when records are equal.
- Leaderboard views must handle tournament-wide and category-scoped contexts.

## Workflow (ASCII)
`[Collect Results] -> [Aggregate Stats] -> [Apply Tie-Breakers] -> [Render Standings]`

## Test Coverage
- Direct: `tests/unit/leaderboard.test.ts`, `tests/unit/leaderboard-resolve.test.ts`, `tests/integration/leaderboard.integration.test.ts`
- Indirect: `e2e/leaderboard.spec.ts`

## Source References
- `src/features/tournaments/views/LeaderboardView.vue`
- `src/composables/useLeaderboard.ts`
