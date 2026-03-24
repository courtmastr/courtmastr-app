# Test Catalog and Release Verification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a repo-native automated test catalog, generate Markdown and HTML coverage reports, and add a release verification command that reports whether all active E2E tests passed.

**Architecture:** Store authoritative test case metadata in a JSON catalog under `docs/testing`, then generate human-readable reports from it using a Node script. Keep verification explicit through a `verify:release` command that runs tests, captures results, validates release-required catalog entries, and regenerates the reports.

**Tech Stack:** Node.js scripts, npm scripts, Markdown, static HTML, Vitest, Playwright, existing repo structure under `docs/`, `tests/`, and `e2e/`.

---

### Task 1: Create the Catalog Skeleton

**Files:**
- Create: `docs/testing/test-catalog.json`
- Test: `tests/unit/test-catalog.schema.test.ts`

**Step 1: Write the failing test**

Write a unit test that loads `docs/testing/test-catalog.json` and asserts:

- the file exists
- the top-level structure is valid
- at least one seeded entry exists
- each entry includes required fields

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/test-catalog.schema.test.ts`

Expected: FAIL because the catalog file and validation test do not exist yet.

**Step 3: Write minimal implementation**

Create `docs/testing/test-catalog.json` with:

- schema version
- workflow definitions
- seeded entries for the highest-signal workflows already covered
- layer, risk, file, and test-name pattern fields

Seed at least:

- publish to public schedule
- blocked auto-assign skip
- score correction
- auth guard
- leaderboard rendering

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/test-catalog.schema.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add docs/testing/test-catalog.json tests/unit/test-catalog.schema.test.ts
git commit -m "feat: add test catalog schema"
```

### Task 2: Add Catalog Validation Utilities

**Files:**
- Create: `scripts/testing/catalog-utils.mjs`
- Test: `tests/unit/test-catalog.validation.test.ts`

**Step 1: Write the failing test**

Add tests for utility behavior:

- duplicate IDs are rejected
- invalid workflow or layer is rejected
- missing file path is rejected

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/test-catalog.validation.test.ts`

Expected: FAIL because utility functions do not exist yet.

**Step 3: Write minimal implementation**

Implement utilities that:

- load catalog JSON
- validate required fields
- validate allowed enum values
- validate file existence

Return structured errors instead of raw throws where useful.

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/test-catalog.validation.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/testing/catalog-utils.mjs tests/unit/test-catalog.validation.test.ts
git commit -m "feat: add test catalog validation utilities"
```

### Task 3: Add Test Inventory Resolution

**Files:**
- Create: `scripts/testing/resolve-test-inventory.mjs`
- Test: `tests/unit/test-catalog.inventory.test.ts`

**Step 1: Write the failing test**

Write tests that verify:

- catalog entries resolve to real files
- `test_name_pattern` matches a real test title in the target file
- missing matches are reported clearly

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/test-catalog.inventory.test.ts`

Expected: FAIL because inventory resolution does not exist yet.

**Step 3: Write minimal implementation**

Implement inventory resolution that:

- scans `tests/**/*.test.ts` and `e2e/**/*.spec.ts`
- parses test names using pragmatic regex for `test(...)`, `it(...)`, and `describe(...)` chains
- maps catalog entries to resolved real tests

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/test-catalog.inventory.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/testing/resolve-test-inventory.mjs tests/unit/test-catalog.inventory.test.ts
git commit -m "feat: resolve real tests from catalog entries"
```

### Task 4: Generate Markdown Report

**Files:**
- Create: `scripts/testing/generate-test-catalog-report.mjs`
- Create: `docs/testing/TEST_CATALOG.md`
- Test: `tests/unit/test-catalog.report-markdown.test.ts`

**Step 1: Write the failing test**

Write tests that assert generated Markdown includes:

- total automated counts
- total E2E counts
- workflow tables
- release-required section

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/test-catalog.report-markdown.test.ts`

Expected: FAIL because the generator does not exist yet.

**Step 3: Write minimal implementation**

Implement Markdown generation from:

- catalog data
- resolved inventory
- optional run summary payload

Write output to `docs/testing/TEST_CATALOG.md`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/test-catalog.report-markdown.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/testing/generate-test-catalog-report.mjs docs/testing/TEST_CATALOG.md tests/unit/test-catalog.report-markdown.test.ts
git commit -m "feat: generate markdown test catalog report"
```

### Task 5: Generate HTML Visual Report

**Files:**
- Modify: `scripts/testing/generate-test-catalog-report.mjs`
- Create: `docs/testing/TEST_CATALOG.html`
- Test: `tests/unit/test-catalog.report-html.test.ts`

**Step 1: Write the failing test**

Add tests asserting HTML generation includes:

- E2E status summary
- workflow matrix
- color-coded or status-class markers
- links to test files

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/test-catalog.report-html.test.ts`

Expected: FAIL because HTML output does not exist yet.

**Step 3: Write minimal implementation**

Extend the generator to produce a static HTML report with:

- summary cards
- workflow-first matrix
- filters implemented with lightweight client-side JS only if needed
- simple, readable styling

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/test-catalog.report-html.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/testing/generate-test-catalog-report.mjs docs/testing/TEST_CATALOG.html tests/unit/test-catalog.report-html.test.ts
git commit -m "feat: generate html test catalog report"
```

### Task 6: Capture Latest E2E and Vitest Status

**Files:**
- Create: `scripts/testing/write-test-run-summary.mjs`
- Create: `docs/testing/test-run-summary.json`
- Test: `tests/unit/test-run-summary.test.ts`

**Step 1: Write the failing test**

Write tests that verify summary generation can store:

- Vitest totals
- E2E totals
- passed/failed counts
- timestamp

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/test-run-summary.test.ts`

Expected: FAIL because summary writer does not exist yet.

**Step 3: Write minimal implementation**

Implement a summary writer that normalizes test output into a JSON artifact the report generator can read.

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/test-run-summary.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add scripts/testing/write-test-run-summary.mjs docs/testing/test-run-summary.json tests/unit/test-run-summary.test.ts
git commit -m "feat: persist test run summary for reports"
```

### Task 7: Add Release Verification Command

**Files:**
- Modify: `package.json`
- Create: `scripts/testing/verify-release.mjs`
- Test: `tests/unit/verify-release.test.ts`

**Step 1: Write the failing test**

Write tests that assert release verification:

- validates the catalog
- ensures release-required entries resolve to real tests
- records latest test results
- exits non-zero on missing required coverage

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/verify-release.test.ts`

Expected: FAIL because release verification does not exist yet.

**Step 3: Write minimal implementation**

Add:

- `npm run report:tests`
- `npm run verify:release`

Recommended `verify:release` behavior:

- run selected Vitest command
- run selected Playwright command
- write summary JSON
- regenerate Markdown and HTML reports
- fail on missing release-required coverage or failing E2E

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/verify-release.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add package.json scripts/testing/verify-release.mjs tests/unit/verify-release.test.ts
git commit -m "feat: add release verification command"
```

### Task 8: Seed the Catalog with Current High-Signal Coverage

**Files:**
- Modify: `docs/testing/test-catalog.json`
- Test: `tests/unit/test-catalog.seeded-coverage.test.ts`

**Step 1: Write the failing test**

Write a test that asserts the catalog contains release-required entries for core workflows:

- auth guards
- registration
- check-in
- publish
- match control
- scoring
- public schedule/scoring
- leaderboard

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/test-catalog.seeded-coverage.test.ts`

Expected: FAIL until the catalog is populated.

**Step 3: Write minimal implementation**

Seed the catalog using the current real suite rather than placeholders. Prefer the strongest existing tests already proven stable.

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/test-catalog.seeded-coverage.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add docs/testing/test-catalog.json tests/unit/test-catalog.seeded-coverage.test.ts
git commit -m "feat: seed test catalog with release workflows"
```

### Task 9: Document Maintenance Workflow

**Files:**
- Modify: `docs/process/TEST_STRATEGY.md`
- Create: `docs/testing/README.md`
- Test: N/A

**Step 1: Update docs**

Document:

- how to add a new catalog entry
- how to regenerate reports
- how `verify:release` is used before deploy
- what “all E2E passed” means in the report

**Step 2: Run validation**

Run:

- `npm run verify:release`

Expected:

- report files updated
- release summary printed
- command exits zero

**Step 3: Commit**

```bash
git add docs/process/TEST_STRATEGY.md docs/testing/README.md
git commit -m "docs: add test catalog maintenance workflow"
```

### Task 10: Final Verification

**Files:**
- Modify: any touched files as needed

**Step 1: Run targeted unit tests**

Run:

- `npm run test -- --run tests/unit/test-catalog.schema.test.ts tests/unit/test-catalog.validation.test.ts tests/unit/test-catalog.inventory.test.ts tests/unit/test-catalog.report-markdown.test.ts tests/unit/test-catalog.report-html.test.ts tests/unit/test-run-summary.test.ts tests/unit/verify-release.test.ts tests/unit/test-catalog.seeded-coverage.test.ts`

Expected: PASS

**Step 2: Run logged targeted unit tests**

Run:

- `npm run test:log -- --run tests/unit/test-catalog.schema.test.ts tests/unit/test-catalog.validation.test.ts tests/unit/test-catalog.inventory.test.ts tests/unit/test-catalog.report-markdown.test.ts tests/unit/test-catalog.report-html.test.ts tests/unit/test-run-summary.test.ts tests/unit/verify-release.test.ts tests/unit/test-catalog.seeded-coverage.test.ts`

Expected: PASS and log artifact written

**Step 3: Run release verification**

Run:

- `npm run verify:release`

Expected:

- Vitest summary printed
- E2E summary printed
- reports regenerated
- command exits zero

**Step 4: Run build gates**

Run:

- `npm run check:firebase-env`
- `npm run build`
- `npm run build:log`

Expected: PASS

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add automated test catalog and release verification"
```
