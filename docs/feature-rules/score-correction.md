# Score Correction

## Basic Rules / Business Logic
- Score correction is allowed only for authorized roles.
- Corrections preserve history and must reconcile winner-dependent side effects.
- Correction flows must remain idempotent across repeated edit cycles.

## Workflow (ASCII)
`[Open Correction Dialog] -> [Apply Corrected Scores] -> [Recompute Winner/State] -> [Persist History]`

## Test Coverage
- Direct: `tests/unit/matches.correction.store.test.ts`, `tests/integration/scoring-correction.integration.test.ts`
- Indirect: `tests/unit/scoring.test.ts`, `e2e/p0-score-correction.spec.ts`

## Source References
- `src/stores/matches.ts`
- `src/features/scoring/views/ScoringInterfaceView.vue`
