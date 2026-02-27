# Scoring And Match Completion

## Basic Rules / Business Logic
- Scoring updates progress game state and determines match completion.
- Completion triggers winner, court release, and downstream activity updates.
- Ready matches may auto-start before first point update in public/operational contexts.

## Workflow (ASCII)
`[Select Match] -> [Apply Score Events] -> [Evaluate Win Conditions] -> [Complete + Side Effects]`

## Test Coverage
- Direct: `tests/unit/scoring.test.ts`, `tests/unit/matches.scoring.store.test.ts`, `tests/integration/scoring-correction.integration.test.ts`
- Indirect: `e2e/p0-match-control-scoring.spec.ts`, `e2e/scorekeeper-flow.spec.ts`

## Source References
- `src/stores/matches.ts`
- `src/features/scoring/views/ScoringInterfaceView.vue`
- `src/features/public/views/PublicScoringView.vue`
