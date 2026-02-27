# Overlay And OBS Views

## Basic Rules / Business Logic
- Overlay court/ticker/board states prioritize live over ready, then idle.
- OBS scoreboard and score-bug views map route query params to mode/theme/position.
- Overlay views consume live match/court data without auth barriers.

## Workflow (ASCII)
`[Overlay Route] -> [Subscribe Tournament + Matches] -> [Derive Display State] -> [Render Broadcast Surface]`

## Test Coverage
- Direct: `tests/unit/OverlayCourtView.test.ts`, `tests/unit/OverlayTickerView.test.ts`, `tests/unit/OverlayBoardView.test.ts`, `tests/unit/ObsScoreboardView.test.ts`, `tests/unit/ObsScoreBugView.test.ts`
- Indirect: `e2e/p0-public-views.spec.ts`

## Source References
- `src/features/overlay/views/OverlayCourtView.vue`
- `src/features/overlay/views/OverlayTickerView.vue`
- `src/features/overlay/views/OverlayBoardView.vue`
- `src/features/obs/views/ObsScoreboardView.vue`
- `src/features/obs/views/ObsScoreBugView.vue`
