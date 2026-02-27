# Feature Rules Documentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create code-grounded documentation in `docs/feature-rules/` with one file per implemented feature, including rules/business logic and ASCII workflow diagrams.

**Architecture:** Build a docs-only artifact set using a strict schema across all feature files. Source truth is extracted from `src/stores`, `src/composables`, `src/features/*/views`, and `src/router/index.ts`. Validation is enforced with repeatable `rg` checks for required headings, workflow blocks, and source/test references.

**Tech Stack:** Markdown, Vue 3 + TypeScript codebase references, ripgrep (`rg`), git.

---

### Task 1: Scaffold Feature Rules Folder And Index

**Files:**
- Create: `docs/feature-rules/README.md`

**Step 1: Write the failing structure check**

Run: `test -f docs/feature-rules/README.md`  
Expected: non-zero exit (file missing)

**Step 2: Create folder and index README**

Add `docs/feature-rules/README.md` with:
- purpose
- feature doc index (all 20 files)
- schema summary
- coverage taxonomy (`direct/indirect/missing`)

**Step 3: Re-run structure check**

Run: `test -f docs/feature-rules/README.md`  
Expected: success (exit 0)

**Step 4: Commit**

```bash
git add docs/feature-rules/README.md
git commit -m "docs(feature-rules): add index and structure"
```

### Task 2: Add Auth, Lifecycle, Tournament Management Docs

**Files:**
- Create: `docs/feature-rules/auth-and-route-access.md`
- Create: `docs/feature-rules/tournament-lifecycle-and-state.md`
- Create: `docs/feature-rules/tournament-management.md`

**Step 1: Write failing completeness check**

Run:
```bash
for f in \
  docs/feature-rules/auth-and-route-access.md \
  docs/feature-rules/tournament-lifecycle-and-state.md \
  docs/feature-rules/tournament-management.md; do
  test -f "$f" || echo "missing:$f"
done
```
Expected: all three reported missing

**Step 2: Write docs with full schema and ASCII workflow**

Each file must include:
- `## Basic Rules / Business Logic`
- `## Workflow (ASCII)`
- `## Test Coverage`
- `## Source References`

**Step 3: Run heading validation**

Run:
```bash
for f in docs/feature-rules/auth-and-route-access.md \
         docs/feature-rules/tournament-lifecycle-and-state.md \
         docs/feature-rules/tournament-management.md; do
  rg -q "^## Workflow \\(ASCII\\)$" "$f" || echo "missing-workflow:$f"
  rg -q "^## Basic Rules / Business Logic$" "$f" || echo "missing-rules:$f"
done
```
Expected: no output

**Step 4: Commit**

```bash
git add docs/feature-rules/auth-and-route-access.md \
        docs/feature-rules/tournament-lifecycle-and-state.md \
        docs/feature-rules/tournament-management.md
git commit -m "docs(feature-rules): add auth lifecycle and tournament docs"
```

### Task 3: Add Category, Court, Registration Docs

**Files:**
- Create: `docs/feature-rules/category-management.md`
- Create: `docs/feature-rules/court-management.md`
- Create: `docs/feature-rules/registration-management.md`

**Step 1: Write failing file check**

Run:
```bash
for f in docs/feature-rules/category-management.md \
         docs/feature-rules/court-management.md \
         docs/feature-rules/registration-management.md; do
  test -f "$f" || echo "missing:$f"
done
```
Expected: files reported missing

**Step 2: Write docs with rules, edge cases, and ASCII flow**

Include business rules for status transitions and operational constraints from stores/views.

**Step 3: Validate references and coverage tags**

Run:
```bash
for f in docs/feature-rules/category-management.md \
         docs/feature-rules/court-management.md \
         docs/feature-rules/registration-management.md; do
  rg -q "Direct|Indirect|Missing" "$f" || echo "missing-coverage:$f"
  rg -q "src/" "$f" || echo "missing-source-ref:$f"
done
```
Expected: no output

**Step 4: Commit**

```bash
git add docs/feature-rules/category-management.md \
        docs/feature-rules/court-management.md \
        docs/feature-rules/registration-management.md
git commit -m "docs(feature-rules): add category court and registration docs"
```

### Task 4: Add Check-In Docs

**Files:**
- Create: `docs/feature-rules/front-desk-checkin.md`
- Create: `docs/feature-rules/self-checkin-kiosk.md`

**Step 1: Write failing file check**

Run:
```bash
for f in docs/feature-rules/front-desk-checkin.md \
         docs/feature-rules/self-checkin-kiosk.md; do
  test -f "$f" || echo "missing:$f"
done
```
Expected: files reported missing

**Step 2: Write docs**

Cover:
- typed-name ambiguity behavior
- bib assignment logic
- participant-presence to status derivation
- undo windows and guard paths

**Step 3: Validate workflows present**

Run:
```bash
for f in docs/feature-rules/front-desk-checkin.md \
         docs/feature-rules/self-checkin-kiosk.md; do
  rg -q "^## Workflow \\(ASCII\\)$" "$f" || echo "missing-workflow:$f"
done
```
Expected: no output

**Step 4: Commit**

```bash
git add docs/feature-rules/front-desk-checkin.md \
        docs/feature-rules/self-checkin-kiosk.md
git commit -m "docs(feature-rules): add front desk and self check-in docs"
```

### Task 5: Add Bracket, Pool Leveling, and Time Scheduling Docs

**Files:**
- Create: `docs/feature-rules/bracket-generation.md`
- Create: `docs/feature-rules/pool-leveling.md`
- Create: `docs/feature-rules/time-first-scheduling.md`

**Step 1: Write failing file check**

Run:
```bash
for f in docs/feature-rules/bracket-generation.md \
         docs/feature-rules/pool-leveling.md \
         docs/feature-rules/time-first-scheduling.md; do
  test -f "$f" || echo "missing:$f"
done
```
Expected: files reported missing

**Step 2: Write docs**

Cover:
- bracket format rules and pool->elimination constraints
- leveling mode recommendations
- rest-time, lock-time, and publish/unpublish schedule rules

**Step 3: Validate test-coverage sections**

Run:
```bash
for f in docs/feature-rules/bracket-generation.md \
         docs/feature-rules/pool-leveling.md \
         docs/feature-rules/time-first-scheduling.md; do
  rg -q "^## Test Coverage$" "$f" || echo "missing-test-coverage:$f"
done
```
Expected: no output

**Step 4: Commit**

```bash
git add docs/feature-rules/bracket-generation.md \
        docs/feature-rules/pool-leveling.md \
        docs/feature-rules/time-first-scheduling.md
git commit -m "docs(feature-rules): add bracket leveling and scheduling docs"
```

### Task 6: Add Match Control And Scoring Docs

**Files:**
- Create: `docs/feature-rules/match-control-and-assignment-gates.md`
- Create: `docs/feature-rules/scoring-and-match-completion.md`
- Create: `docs/feature-rules/score-correction.md`

**Step 1: Write failing file check**

Run:
```bash
for f in docs/feature-rules/match-control-and-assignment-gates.md \
         docs/feature-rules/scoring-and-match-completion.md \
         docs/feature-rules/score-correction.md; do
  test -f "$f" || echo "missing:$f"
done
```
Expected: files reported missing

**Step 2: Write docs**

Cover:
- assignment blockers and override rules
- scoring status transitions and completion side effects
- correction history and winner-change reversal path

**Step 3: Validate edge-case sections**

Run:
```bash
for f in docs/feature-rules/match-control-and-assignment-gates.md \
         docs/feature-rules/scoring-and-match-completion.md \
         docs/feature-rules/score-correction.md; do
  rg -q "^## Failure & Edge Cases$" "$f" || echo "missing-edge-cases:$f"
done
```
Expected: no output

**Step 4: Commit**

```bash
git add docs/feature-rules/match-control-and-assignment-gates.md \
        docs/feature-rules/scoring-and-match-completion.md \
        docs/feature-rules/score-correction.md
git commit -m "docs(feature-rules): add match control and scoring docs"
```

### Task 7: Add Leaderboard, Reports, And Public Views Docs

**Files:**
- Create: `docs/feature-rules/leaderboard-and-tiebreakers.md`
- Create: `docs/feature-rules/reports-and-analytics-summary.md`
- Create: `docs/feature-rules/public-views.md`

**Step 1: Write failing file check**

Run:
```bash
for f in docs/feature-rules/leaderboard-and-tiebreakers.md \
         docs/feature-rules/reports-and-analytics-summary.md \
         docs/feature-rules/public-views.md; do
  test -f "$f" || echo "missing:$f"
done
```
Expected: files reported missing

**Step 2: Write docs**

Cover:
- BWF tie-break hierarchy and elimination semantics
- summary report metrics and exclusions
- public route/data visibility constraints

**Step 3: Validate ASCII workflow block exists in all**

Run:
```bash
for f in docs/feature-rules/leaderboard-and-tiebreakers.md \
         docs/feature-rules/reports-and-analytics-summary.md \
         docs/feature-rules/public-views.md; do
  rg -q "^## Workflow \\(ASCII\\)$" "$f" || echo "missing-workflow:$f"
done
```
Expected: no output

**Step 4: Commit**

```bash
git add docs/feature-rules/leaderboard-and-tiebreakers.md \
        docs/feature-rules/reports-and-analytics-summary.md \
        docs/feature-rules/public-views.md
git commit -m "docs(feature-rules): add leaderboard reports and public views docs"
```

### Task 8: Add Overlay/OBS, Ops Stores, And User Management Docs

**Files:**
- Create: `docs/feature-rules/overlay-and-obs-views.md`
- Create: `docs/feature-rules/notifications-activities-alerts-audit.md`
- Create: `docs/feature-rules/user-management.md`

**Step 1: Write failing file check**

Run:
```bash
for f in docs/feature-rules/overlay-and-obs-views.md \
         docs/feature-rules/notifications-activities-alerts-audit.md \
         docs/feature-rules/user-management.md; do
  test -f "$f" || echo "missing:$f"
done
```
Expected: files reported missing

**Step 2: Write docs**

Cover:
- no-auth overlay route behavior
- ops logging/notification/audit side-effect patterns
- user role/profile/activation management behavior and current route exposure

**Step 3: Validate source references**

Run:
```bash
for f in docs/feature-rules/overlay-and-obs-views.md \
         docs/feature-rules/notifications-activities-alerts-audit.md \
         docs/feature-rules/user-management.md; do
  rg -q "^## Source References$" "$f" || echo "missing-sources:$f"
done
```
Expected: no output

**Step 4: Commit**

```bash
git add docs/feature-rules/overlay-and-obs-views.md \
        docs/feature-rules/notifications-activities-alerts-audit.md \
        docs/feature-rules/user-management.md
git commit -m "docs(feature-rules): add overlay ops and user management docs"
```

### Task 9: Final Index Sync And Global Validation

**Files:**
- Modify: `docs/feature-rules/README.md`

**Step 1: Update index links and feature status table**

Ensure README includes links to all 20 feature files.

**Step 2: Run global completeness checks**

Run:
```bash
# 20 feature docs + README expected
find docs/feature-rules -maxdepth 1 -name "*.md" | wc -l

# Required headings in every feature doc
for f in docs/feature-rules/*.md; do
  [ "$(basename "$f")" = "README.md" ] && continue
  rg -q "^## Basic Rules / Business Logic$" "$f" || echo "missing-rules:$f"
  rg -q "^## Workflow \\(ASCII\\)$" "$f" || echo "missing-workflow:$f"
  rg -q "^## Test Coverage$" "$f" || echo "missing-test-coverage:$f"
  rg -q "^## Source References$" "$f" || echo "missing-source-refs:$f"
done
```
Expected:
- file count = `21`
- no missing-* output

**Step 3: Optional markdown lint (if available)**

Run: `npx markdownlint-cli "docs/feature-rules/**/*.md"`  
Expected: no lint errors (or capture/resolve warnings)

**Step 4: Commit**

```bash
git add docs/feature-rules/README.md docs/feature-rules/*.md
git commit -m "docs(feature-rules): finalize feature documentation set"
```

### Task 10: Final Verification Before Completion

**Files:**
- Verify only

**Step 1: Git summary check**

Run: `git log --oneline -n 10`  
Expected: includes recent `docs(feature-rules): ...` commits

**Step 2: Spot-check critical docs**

Run:
```bash
sed -n '1,200p' docs/feature-rules/front-desk-checkin.md
sed -n '1,220p' docs/feature-rules/time-first-scheduling.md
sed -n '1,240p' docs/feature-rules/leaderboard-and-tiebreakers.md
```
Expected: full schema + ASCII workflow + test coverage section present

**Step 3: Completion check**

Run:
```bash
test -f docs/feature-rules/README.md && \
for f in docs/feature-rules/*.md; do
  [ "$(basename "$f")" = "README.md" ] && continue
  rg -q "^## Workflow \\(ASCII\\)$" "$f" || exit 1
done
echo "feature-rules-docs-ready"
```
Expected: prints `feature-rules-docs-ready`

**Step 4: Final handoff note**

Summarize:
- files added
- rules coverage posture
- direct vs indirect test coverage callouts

