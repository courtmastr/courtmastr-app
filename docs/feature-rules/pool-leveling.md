# Pool Leveling

## Basic Rules / Business Logic
- Pool outcomes feed leveling logic and subsequent elimination seeding.
- Leveling must not mix pool/base and level-scoped match datasets.
- Completion checks gate progression to elimination levels.

## Workflow (ASCII)
`[Pool Matches Complete] -> [Compute Standings] -> [Apply Leveling Mode] -> [Generate Level Brackets]`

## Test Coverage
- Direct: `tests/unit/poolLeveling.test.ts`, `tests/unit/poolAssignment.test.ts`, `tests/integration/pool-leveling.integration.test.ts`
- Indirect: `tests/unit/leaderboard-resolve.test.ts`, `e2e/p0-seeding-management.spec.ts`

## Source References
- `src/stores/tournaments.ts`
- `src/features/tournaments/views/CategoriesView.vue`
