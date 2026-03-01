# Pool Leveling

## Basic Rules / Business Logic
- Pool outcomes feed leveling logic and subsequent elimination seeding.
- Leveling must not mix pool/base and level-scoped match datasets.
- Completion checks gate progression to elimination levels.
- Pool standings are preserved as a first-class scope (`phaseScope: pool`) and must remain viewable after elimination begins.
- Full category continuation (`phaseScope: category`) includes pool + elimination results when progression is `carry_forward`.

## Ranking/Progression Interaction
- Tournament default progression mode is `carry_forward` unless admin changes it.
- Category can override progression mode to `phase_reset` for leaderboard interpretation.
- Ranking preset inheritance follows: category override -> tournament default -> system default.

## Workflow (ASCII)
`[Pool Matches Complete] -> [Pool Scope Standings (History)] -> [Apply Leveling Mode] -> [Generate Elimination/Levels] -> [Category Scope Continuation]`

## Test Coverage
- Direct:
  - `tests/unit/poolLeveling.test.ts`
  - `tests/unit/poolAssignment.test.ts`
  - `tests/integration/pool-leveling.integration.test.ts`
  - `tests/integration/leaderboard-pool-history.integration.test.ts`
- Indirect:
  - `tests/unit/leaderboard-resolve.test.ts`
  - `tests/unit/leaderboard.test.ts`
  - `e2e/p0-seeding-management.spec.ts`

## Source References
- `src/stores/tournaments.ts`
- `src/features/tournaments/views/CategoriesView.vue`
- `src/features/tournaments/views/LeaderboardView.vue`
- `src/composables/useLeaderboard.ts`
