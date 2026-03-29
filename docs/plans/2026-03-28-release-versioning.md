# Release Versioning and Release Notes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add semantic-release documentation and release-note validation so every future production deploy is versioned, verified, and recorded.

**Architecture:** Extend the existing release verification scripts with a small release-notes validator, backfill historical release-note documents from recorded deploy evidence, and update process docs so semantic version bumping and release notes are required before deploy.

**Tech Stack:** Node.js scripts, Vitest, Markdown process docs

---

### Task 1: Add Release Metadata Validation

**Files:**
- Create: `scripts/testing/release-notes-utils.mjs`
- Create: `scripts/testing/release-notes-utils.d.mts`
- Modify: `scripts/testing/verify-release.mjs`
- Modify: `scripts/testing/verify-release.d.mts`
- Modify: `scripts/testing/write-test-run-summary.mjs`
- Modify: `scripts/testing/write-test-run-summary.d.mts`

**Step 1: Add release-note helpers**

Implement utilities that:
- read the package version from `package.json`
- resolve `docs/releases/v<version>.md`
- validate required headings

**Step 2: Extend release verification**

Update `runReleaseVerification()` so it:
- validates release metadata before test execution
- includes release metadata in the generated run summary

**Step 3: Update type declarations**

Keep the `.d.mts` files aligned with the runtime modules.

### Task 2: Add Focused Unit Coverage

**Files:**
- Create: `tests/unit/release-notes-utils.test.ts`
- Modify: `tests/unit/verify-release.test.ts`
- Modify: `tests/unit/test-run-summary.test.ts`

**Step 1: Test release-note validation**

Cover:
- missing release note
- malformed release note
- valid release note

**Step 2: Test release verification integration**

Confirm `runReleaseVerification()` returns release metadata in the run summary.

**Step 3: Test summary shape**

Confirm `buildRunSummary()` preserves release metadata.

### Task 3: Backfill Release History

**Files:**
- Create: `docs/releases/README.md`
- Create: `docs/releases/v1.0.0.md`
- Create: `docs/releases/v1.1.0.md`
- Create: `docs/releases/v1.1.0+deploy.2.md`
- Create: `docs/releases/UNRELEASED.md`
- Modify: `docs/deployment/LAST_DEPLOY.md`

**Step 1: Create release index**

Document the release-history rules and link known releases.

**Step 2: Backfill proven releases**

Create historical notes from:
- `4b5bac8` / 2026-03-14 / package `1.0.0`
- `fa6a733` / 2026-03-15 / package `1.1.0`
- `96ead60` / 2026-03-15 / second deploy on package `1.1.0`

**Step 3: Add unreleased draft**

Summarize the pushed-not-deployed and local-not-pushed work using current repo state.

### Task 4: Update Process Documentation

**Files:**
- Modify: `docs/process/TEST_STRATEGY.md`
- Modify: `docs/testing/README.md`
- Modify: `docs/deployment/DEPLOYMENT_GUIDE.md`

**Step 1: Update release gates**

Require semantic version bumping and matching release notes before deploy.

**Step 2: Document where release evidence lives**

Point operators to `docs/releases/`, `docs/deployment/LAST_DEPLOY.md`, and `docs/testing/test-run-summary.json`.

### Task 5: Verify the Change

**Files:**
- Read: `tests/unit/release-notes-utils.test.ts`
- Read: `tests/unit/verify-release.test.ts`
- Read: `tests/unit/test-run-summary.test.ts`

**Step 1: Run targeted tests**

Run:
- `npm run test -- --run tests/unit/release-notes-utils.test.ts tests/unit/verify-release.test.ts tests/unit/test-run-summary.test.ts`

**Step 2: Run logged targeted tests**

Run:
- `npm run test:log -- --run tests/unit/release-notes-utils.test.ts tests/unit/verify-release.test.ts tests/unit/test-run-summary.test.ts`

**Step 3: Report residual release blockers**

If `npm run verify:release` is still blocked because the next semantic version has not been chosen yet, report that explicitly instead of inventing a version bump.
