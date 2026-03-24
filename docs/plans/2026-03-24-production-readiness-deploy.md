# Production Readiness Deploy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Verify the current feature branch is production-ready, fix any release blockers, and deploy the validated result to production.

**Architecture:** Start with environment/tooling verification so release gates can run in this checkout. Then run the repo's required release checks, fix only confirmed blockers, re-run verification, and deploy from a validated branch state. Record production evidence in the deploy log document after release.

**Tech Stack:** Vue 3, TypeScript, Vite, Vitest, Playwright, Firebase Hosting/Functions, npm

---

### Task 1: Restore Local Release Gate Execution

**Files:**
- Modify: `docs/plans/2026-03-24-production-readiness-deploy.md`

**Step 1: Confirm root cause**

Run: `which node && which npm`
Expected: current shell cannot resolve Node/npm from `PATH`

**Step 2: Verify installed binaries**

Run: `ls /opt/homebrew/bin/{node,npm,npx}`
Expected: Homebrew binaries exist

**Step 3: Use absolute binaries for release commands**

Run: `/opt/homebrew/bin/npm --version`
Expected: npm prints a version successfully

### Task 2: Run Fresh Release Gates

**Files:**
- Read: `docs/process/TEST_STRATEGY.md`
- Read: `docs/deployment/LAST_DEPLOY.md`

**Step 1: Run release verification**

Run: `/opt/homebrew/bin/npm run verify:release`
Expected: Vitest and Playwright release catalog verification pass

**Step 2: Run build gate**

Run: `/opt/homebrew/bin/npm run build`
Expected: production build completes successfully

**Step 3: Run logged build gate**

Run: `/opt/homebrew/bin/npm run build:log`
Expected: logged production build completes successfully

### Task 3: Fix Confirmed Release Blockers Only If Gates Fail

**Files:**
- Modify only the minimal affected sources/tests/docs identified by failing commands

**Step 1: Capture failure details**

Run the failing command once and record any fingerprint/log artifact

**Step 2: Check Debug KB**

Inspect: `docs/debug-kb/index.yml` and matching fingerprint doc

**Step 3: Apply minimal fix**

Make the smallest scoped change that addresses the verified root cause

**Step 4: Re-run only the relevant failed gate**

Expected: original failure is resolved

### Task 4: Deploy and Record Evidence

**Files:**
- Modify: `docs/deployment/LAST_DEPLOY.md`

**Step 1: Deploy validated branch state**

Run: `/opt/homebrew/bin/npm run deploy`
Run: `/opt/homebrew/bin/npm run deploy:log`
Expected: Firebase deploy succeeds

**Step 2: Record deploy evidence**

Update `docs/deployment/LAST_DEPLOY.md` with date, branch, commit, commands, Firebase target, and result details

**Step 3: Final verification summary**

Report exact commands run, files changed, deploy evidence, and any fingerprints handled
