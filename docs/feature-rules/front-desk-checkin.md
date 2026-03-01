# Front Desk Check-In

## Basic Rules / Business Logic
- Rapid mode supports scan/manual input with guardrails for ambiguous participant matches.
- Rapid mode must surface live typed-name suggestions (minimum 2 chars) so operators can select and check in participants directly from search results.
- Bulk mode supports batch check-in and timed undo paths.
- Bib assignment and check-in transitions are coordinated through workflow composables.

## Workflow (ASCII)
`[Scan/Select] -> [Resolve Registration] -> [Check-In + Bib] -> [Toast/Undo Window]`

## Test Coverage
- Direct: `tests/unit/FrontDeskCheckInView.test.ts`, `tests/unit/RapidCheckInPanel.test.ts`, `tests/unit/BulkCheckInPanel.test.ts`, `tests/unit/useFrontDeskCheckInWorkflow.test.ts`, `tests/integration/checkin.integration.test.ts`
- Indirect: `e2e/p0-front-desk-checkin.spec.ts`

## Source References
- `src/features/checkin/views/FrontDeskCheckInView.vue`
- `src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts`
- `src/stores/registrations.ts`
