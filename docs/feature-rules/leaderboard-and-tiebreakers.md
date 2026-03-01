# Leaderboard And Tiebreakers

## Basic Rules / Business Logic
- Standings derive only from completed match outcomes in the selected scope.
- `pool_to_elimination` categories support two live scopes:
  - `pool`: only pool-stage matches.
  - `category`: full category journey (pool + elimination continuation).
- Tournament pages always use `tournament` scope across categories.
- Ranking policy is preset-driven only (no arbitrary formulas):
  - `courtmaster_default` (system default)
  - `bwf_strict`
  - `simple_ladder`
- Effective ranking config inheritance is deterministic:
  - category override
  - tournament default
  - system default fallback
- Progression mode metadata is always included in leaderboard output:
  - `carry_forward` (default)
  - `phase_reset`

## Workflow (ASCII)
`[Collect Scoped Results] -> [Resolve Effective Preset] -> [Aggregate Stats] -> [Apply Preset Tie-Breakers] -> [Render Standings]`

## Admin Configuration Rules
- Tournament Settings defines global defaults (`rankingPresetDefault`, `progressionModeDefault`).
- Category Settings can override ranking preset and progression mode per category.
- Disabling category override preserves tournament default behavior and keeps category override history in Firestore fields (`null` means inherit).
- Leaderboard recalculates on every generate/refresh call using latest match data and latest ranking config.

## Test Coverage
- Direct:
  - `tests/unit/leaderboard.test.ts`
  - `tests/unit/leaderboard-resolve.test.ts`
  - `tests/unit/leaderboard-presets.test.ts`
  - `tests/unit/effectiveRankingConfig.test.ts`
  - `tests/integration/leaderboard.integration.test.ts`
  - `tests/integration/leaderboard-pool-history.integration.test.ts`
- Indirect: `e2e/leaderboard.spec.ts`

## Source References
- `src/features/tournaments/views/LeaderboardView.vue`
- `src/composables/useLeaderboard.ts`
- `src/features/leaderboard/rankingPresets.ts`
- `src/features/leaderboard/effectiveRankingConfig.ts`
- `src/features/tournaments/views/TournamentSettingsView.vue`
