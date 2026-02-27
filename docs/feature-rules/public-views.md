# Public Views

## Basic Rules / Business Logic
- Public bracket/schedule/scoring routes must load without auth.
- Public schedule surfaces published planned matches only.
- Public scoring auto-start behavior is guarded to avoid duplicate starts.

## Workflow (ASCII)
`[Public Route] -> [Fetch Tournament] -> [Apply View-Specific Filters] -> [Render Live/Public State]`

## Test Coverage
- Direct: `tests/unit/PublicBracketView.test.ts`, `tests/unit/PublicScheduleView.test.ts`, `tests/unit/PublicScoringView.test.ts`, `tests/integration/public-views.integration.test.ts`
- Indirect: `e2e/p0-public-views.spec.ts`

## Source References
- `src/features/public/views/PublicBracketView.vue`
- `src/features/public/views/PublicScheduleView.vue`
- `src/features/public/views/PublicScoringView.vue`
