# Reports And Analytics Summary

## Basic Rules / Business Logic
- Reports aggregate match, participation, and duration KPIs.
- Duration metrics use observed start/completion timestamps and exclude invalid spans.
- Export surfaces summary rows for operational review.

## Workflow (ASCII)
`[Fetch Tournament Metrics] -> [Aggregate KPIs] -> [Compute Duration Stats] -> [Render/Export]`

## Test Coverage
- Direct: `tests/unit/TournamentSummaryView.test.ts`, `tests/unit/reports.duration-metrics.test.ts`
- Indirect: `e2e/p0-tournament-settings.spec.ts`

## Source References
- `src/features/reports/views/TournamentSummaryView.vue`
- `src/features/reports/components/DurationMetrics.vue`
