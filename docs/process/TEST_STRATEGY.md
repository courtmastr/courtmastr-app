# CourtMastr Test Strategy

This strategy keeps product velocity high while protecting tournament-day reliability.

## Test Layers

1. Unit tests (`tests/unit`)
   - Primary safety net for views, composables, stores, and services.
   - Mock external systems (Firebase, router, browser APIs) when possible.

2. Integration tests (`tests/integration`)
   - Validate feature flows spanning multiple stores/components.
   - Use realistic fixtures for public pages, check-in, and scoring workflows.

3. E2E tests (`e2e`)
   - Validate critical user journeys in browser context.
   - Prioritize organizer setup, scoring, public schedule/scoring, and auth guards.

## Required Verification Gates

For every feature branch before merge:

1. Targeted test run
   - `npm run test -- --run <changed-test-files>`
2. Logged targeted test run
   - `npm run test:log -- --run <same-files>`
3. Firebase env gate
   - `npm run check:firebase-env`
4. Build gate
   - `npm run build`
5. Logged build gate
   - `npm run build:log`
6. Optional lint confirmation when touching shared UI/system files
   - `npm run lint:log`

For release/deploy:

1. Confirm `master` contains merged changes.
2. Enable checkout guard once (per local repo): `npm run hooks:enable`.
3. Run `npm run verify:release` to confirm the automated release catalog is covered and the latest E2E summary is recorded.
4. Run `npm run deploy` and `npm run deploy:log` from a clean `master` context.
5. Record deploy output (project, URL, and functions updated) in `docs/deployment/LAST_DEPLOY.md`.

## Test Catalog

CourtMastr now keeps an automated test catalog in `docs/testing/test-catalog.json`.

Generated outputs:

- `docs/testing/TEST_CATALOG.md`
- `docs/testing/TEST_CATALOG.html`
- `docs/testing/test-run-summary.json`

Commands:

1. `npm run report:tests`
   - validates the catalog against the real suite
   - regenerates Markdown and HTML reports
2. `npm run verify:release`
   - runs the release verification command
   - records latest Vitest and E2E results
   - regenerates the test catalog reports
   - fails if release-required catalog entries are missing from the real suite

## UI Change Coverage

For homepage/public-shell/review UX updates:

1. Add or update unit tests for rendering states.
2. Validate accessibility paths:
   - no motion-only dependency (`prefers-reduced-motion` support)
   - keyboard-focus visibility on actionable controls
3. Perform manual smoke checks on:
   - `/`
   - public tournament schedule/scoring pages
   - legal/marketing pages touched by the change

## Failure Handling

1. If a `:log` command fails, capture the fingerprint from output.
2. Check `docs/debug-kb/index.yml` and matching fingerprint doc.
3. Apply known fix first; if none exists, create a new KB entry from template.
