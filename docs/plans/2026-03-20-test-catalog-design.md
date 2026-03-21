# CourtMastr Test Catalog and Release Verification Design

## Goal

Create a repo-native automated test catalog and generated visual report so the team can:

- check whether a desired test case already exists
- see automated coverage by workflow and layer
- confirm whether all E2E tests passed before deploy
- run a single release verification command that regenerates the report and enforces the gate

## Problem

The current repo has many automated tests, but there is no single source of truth that answers:

- "Do we already test this workflow?"
- "Which layer covers it: unit, integration, or E2E?"
- "Are the E2E tests all passing right now?"
- "What is required before publish/deploy?"

Raw file lists and test titles are not enough. They do not provide stable workflow mapping, release-critical tagging, or a visual coverage view.

## Constraints

- The report must live in the repo, not inside the app UI.
- Scope is automated tests only.
- E2E pass/fail must be visible in the generated output.
- The system must be maintainable and should not depend on guessing from filenames alone.
- The release flow should be explicit and repeatable.

## Recommended Approach

Use a structured catalog file in the repo as the source of truth, then generate both Markdown and HTML outputs from it.

This is a hybrid documentation/reporting approach:

- machine-readable catalog for reliable lookup and validation
- generated Markdown for review in git
- generated HTML for visual browsing
- release verification command that runs required suites and updates the report

This avoids the weakness of inference-only approaches while staying much cheaper than building an in-app dashboard.

## Source of Truth

Primary source file:

- `docs/testing/test-catalog.json`

Each entry represents one automated test case. Recommended fields:

- `id`: stable identifier, for example `match_control.auto_assign.skip_blocked_due_match`
- `title`: human-readable test case name
- `workflow`: one of the top-level workflow buckets
- `feature`: narrower grouping within the workflow
- `risk`: `critical`, `high`, `medium`, or `low`
- `layer`: `unit`, `integration`, or `e2e`
- `automation_status`: `active` or `retired`
- `required_for_release`: boolean
- `test_file`: exact file path
- `test_name_pattern`: exact title or grep-safe pattern
- `notes`: short explanation of what is covered

This structure supports both human search and machine validation.

## Workflow Taxonomy

Recommended primary workflow groups:

- Registration
- Check-in
- Scheduling
- Publish
- Match Control
- Scoring
- Public Views
- Auth and Roles
- Leaderboard

The generated report should group by workflow first because that matches how product owners think about coverage and regression risk.

## Generated Outputs

Generated artifacts:

- `docs/testing/TEST_CATALOG.md`
- `docs/testing/TEST_CATALOG.html`

### Markdown Report

The Markdown report should include:

- totals by layer
- total active automated tests
- total active E2E tests
- latest E2E result summary
- workflow coverage table
- release-required coverage summary
- detailed test case list with links to real test files

### HTML Report

The HTML report should provide a visual view with:

- color-coded workflow matrix
- per-workflow layer coverage
- E2E status card such as `Passed 76/76`
- filters by workflow, layer, risk, and release-critical status
- direct links to test files

## Release Verification

Add an explicit release verification command:

- `npm run verify:release`

Recommended behavior:

1. run required automated suites
2. capture E2E pass/fail summary
3. regenerate Markdown and HTML reports
4. validate that all `required_for_release` catalog entries point to active real tests
5. fail if release-required tests are missing or failing

Recommended initial mode is manual explicit gating before deploy, not implicit deployment coupling. Once stable, deploy can depend on it.

## Data Flow

1. catalog JSON defines expected coverage
2. generator script reads catalog and current test inventory
3. verification command runs test suites and collects results
4. generator embeds latest status into Markdown and HTML
5. release gate fails if required criteria are not met

## Validation Rules

The generator should validate:

- test file exists
- referenced test title or pattern resolves to at least one real test
- no duplicate test case IDs
- no invalid workflow/layer/risk values
- release-required entries are active

## Out of Scope

- manual test case tracking
- in-app reporting UI
- flaky test auto-retry policy changes
- coverage percentage enforcement by line/branch threshold in this phase

## Success Criteria

This design is successful when the team can:

- ask whether a test case already exists and answer it from one report
- visually inspect workflow coverage in the repo
- confirm whether all E2E passed from the report
- run one release verification command before deploy

## Risks

- Catalog drift if entries are not updated alongside tests
- Report noise if workflow taxonomy is too granular
- Release command slowness if it tries to run too much too early

Mitigations:

- make catalog validation strict
- keep workflow buckets coarse
- start with release-critical suites only, then expand

## Recommended Phase Order

1. create catalog schema and seed it with current high-signal tests
2. build report generator and HTML output
3. add release verification command
4. document maintenance workflow
5. expand catalog coverage iteratively
