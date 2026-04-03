# CourtMastr Automated Test Catalog

This directory is the repo-native source of truth for automated test coverage reporting.

## Files

- `test-catalog.json`
  - machine-readable catalog of automated test cases
- `TEST_CATALOG.md`
  - generated Markdown summary with workflow coverage and discovered test inventory
- `TEST_CATALOG.html`
  - generated visual report with latest E2E status and discovered library tables
- `test-run-summary.json`
  - latest recorded automated run summary
  - includes the release version and release-note path verified for the run

## Commands

- `npm run report:tests`
  - validate the catalog
  - resolve catalog entries against real tests
  - regenerate Markdown and HTML reports

- `npm run verify:release`
  - run release verification
  - validate the current package version has a matching release note in `docs/releases/`
  - record latest Vitest and E2E status
  - regenerate reports
  - fail if release-required catalog entries are missing from the active suite

- `npm run release:plan`
  - preview the next semantic version and release-note path without changing files
  - use for release inspection/debugging only; CI owns production rollout

- `npm run release:deploy`
  - CI-owned command used by the `master` workflow
  - do not use as a manual production deploy path

## Adding a New Test Case

When you add a meaningful automated test:

1. add the real test first
2. add a catalog entry in `test-catalog.json`
3. set:
   - `workflow`
   - `feature`
   - `risk`
   - `layer`
   - `required_for_release`
   - `test_file`
   - `test_name_pattern`
4. run `npm run report:tests`

## How to Use It

If you want to know whether CourtMastr already covers a workflow:

1. search `test-catalog.json` by workflow or feature
2. open `TEST_CATALOG.md` for a readable summary
3. open `TEST_CATALOG.html` for the visual workflow matrix and full discovered E2E inventory

If you want to know whether all E2E passed before deploy:

1. run `npm run verify:release`
2. check `docs/testing/test-run-summary.json`
3. open `docs/testing/TEST_CATALOG.html`
4. open `docs/releases/v<version>.md` for the human release summary
5. confirm the PR merged to `master` and inspect the `CI-CD` workflow run for the actual deploy result
