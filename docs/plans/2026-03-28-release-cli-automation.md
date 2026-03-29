# CLI Release Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a repo-native CLI release workflow that classifies semantic version bumps, generates release notes, runs release guardrails, and deploys through one command.

**Architecture:** Create release utilities for deploy-record parsing, version classification, release-note generation, and deploy-record updates. Wrap them in a CLI with `plan` and `deploy` modes, then wire the commands into `package.json` and update the operator docs.

**Tech Stack:** Node.js scripts, npm scripts, Vitest, Markdown docs

---

### Task 1: Build Release Utilities

**Files:**
- Create: `scripts/release/release-utils.mjs`
- Create: `scripts/release/release-utils.d.mts`

**Step 1: Parse existing deploy metadata**

Add helpers to read:
- latest deployed version
- latest deployed commit
- latest release ID

from `docs/deployment/LAST_DEPLOY.md`.

**Step 2: Classify release size**

Implement:
- touched-area detection
- patch/minor/major heuristics
- semantic version incrementing

**Step 3: Generate release-note markdown**

Produce markdown with required sections and computed highlights.

### Task 2: Build the CLI Orchestrator

**Files:**
- Create: `scripts/release/release-cli.mjs`
- Modify: `package.json`

**Step 1: Add plan mode**

`npm run release:plan` should:
- preview unreleased range
- preview release type
- preview next version
- preview draft note path

**Step 2: Add deploy mode**

`npm run release:deploy` should:
- require clean worktree at start
- auto-bump version
- write release note
- run release guardrails
- update `LAST_DEPLOY.md` after success
- restore generated file changes on failure

### Task 3: Add Unit Coverage

**Files:**
- Create: `tests/unit/release-utils.test.ts`

**Step 1: Test deploy-record parsing**

Verify latest deployed version and commit extraction.

**Step 2: Test version classification**

Verify patch/minor/major heuristics with representative file sets and commit subjects.

**Step 3: Test release-note generation**

Verify generated note structure includes required sections and commit range metadata.

### Task 4: Update Process Docs

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/process/TEST_STRATEGY.md`
- Modify: `docs/deployment/DEPLOYMENT_GUIDE.md`
- Modify: `docs/testing/README.md`
- Modify: `docs/releases/README.md`

**Step 1: Add command docs**

Document:
- `npm run release:plan`
- `npm run release:deploy`

**Step 2: Update deploy instructions**

Make the new CLI release path the default local deploy process.

### Task 5: Verify the Workflow

**Files:**
- Read: `tests/unit/release-utils.test.ts`
- Read: `scripts/release/release-cli.mjs`

**Step 1: Run targeted tests**

Run:
- `npm run test -- --run tests/unit/release-utils.test.ts tests/unit/release-notes-utils.test.ts tests/unit/verify-release.test.ts tests/unit/test-run-summary.test.ts`

**Step 2: Run logged targeted tests**

Run:
- `npm run test:log -- --run tests/unit/release-utils.test.ts tests/unit/release-notes-utils.test.ts tests/unit/verify-release.test.ts tests/unit/test-run-summary.test.ts`

**Step 3: Run release preview**

Run:
- `npm run release:plan`

**Step 4: Run build verification**

Run:
- `npm run build`
- `npm run build:log`
