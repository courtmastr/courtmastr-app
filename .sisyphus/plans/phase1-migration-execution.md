# Phase 1: Critical Fixes - Migration Execution Plan

## TL;DR

> **Quick Summary**: Fix 4 critical data model bugs by updating ID normalization, migrating Cloud Functions to use `/match` collection with brackets-manager API, and removing legacy `/matches` Firestore rules.
> 
> **Deliverables**:
> - ID type unification in `brackets-storage.ts` (lines 55-57, 64)
> - `advanceWinner` Cloud Function refactored to use brackets-manager API
> - `generateSchedule` Cloud Function collection references updated
> - Legacy `/matches` Firestore rules removed (lines 76-84)
> 
> **Estimated Effort**: Short (4-6 hours total)
> **Parallel Execution**: YES - 4 waves, all tasks in Wave 1 run in parallel
> **Critical Path**: All tasks independent → Any can complete in any order

---

## Context

### Original Request
Implement Phase 1 of critical data model migration with 4 independent steps:
1. Unify ID types to strings in client adapter
2. Fix advanceWinner Cloud Function to use `/match` collection
3. Fix generateSchedule Cloud Function collection references  
4. Delete legacy `/matches` Firestore rules

### Research Findings

**From Explore Agent (bg_5cb33493)**:
- Current architecture uses two-collection system: `/match` (brackets-manager structure) and `/match_scores` (operational data)
- Client adapter (`brackets-storage.ts`) keeps numeric IDs, server adapter (`firestore-adapter.ts`) converts to strings
- `advanceWinner` (lines 110-201 in `functions/src/index.ts`) uses legacy `/matches` collection - needs complete refactor
- `generateSchedule` already reads from correct collection but may have status value issues
- Test infrastructure exists (Vitest) with 2 unit test files
- No integration tests for Cloud Functions currently exist

**From Librarian Agent (bg_2fc20b69)**:
- BracketsManager API: `manager.update.match()` handles winner advancement automatically
- `manager.storage.select()` for reading match data with filter support
- Status enum: 0=Locked, 1=Waiting, 2=Ready, 3=Running, 4=Completed
- Error handling: Check for locked matches, missing matches, draw constraints
- FirestoreStorage adapter must implement CrudInterface (insert, select, update, delete)
- Single vs double elimination: Library handles loser bracket propagation automatically

**Key Architecture Insight**:
The server already has a working `FirestoreStorage` adapter at `functions/src/storage/firestore-adapter.ts` that properly converts IDs to strings. The `updateMatch` Cloud Function demonstrates the correct pattern:
```typescript
const manager = new BracketsManager(new FirestoreStorage(db, rootPath));
await manager.update.match({ ... });
```

---

## Work Objectives

### Core Objective
Eliminate the 4 critical bugs blocking proper bracket tournament functionality by aligning all code to use the post-Feb 2026 two-collection data model.

### Concrete Deliverables
- `src/services/brackets-storage.ts` with string ID normalization (2 line changes)
- `functions/src/index.ts` with refactored `advanceWinner` using brackets-manager API (~60 line replacement)
- `functions/src/scheduling.ts` with corrected collection references and status values (2 section changes)
- `firestore.rules` with `/matches` rules block removed (9 lines deleted)

### Definition of Done
- [ ] All 4 files modified and committed separately
- [ ] `npm run build:log` passes
- [ ] `cd functions && npm run build` passes
- [ ] Firebase emulator starts without errors
- [ ] Integration test: Generate bracket → Schedule → Complete match → Winner advances
- [ ] No references to `/matches` collection in running code
- [ ] All changes follow AGENTS.md constraints

### Must Have
- String ID types in both client and server adapters
- advanceWinner uses BracketsManager API (not direct Firestore access)
- generateSchedule reads from `/match`, writes to `/match_scores`
- No Firestore rules for `/matches` collection

### Must NOT Have (Guardrails)
- No package.json changes (per AGENTS.md Rule 2)
- No refactoring of unrelated code (per AGENTS.md Rule 10)
- No weakening of security rules (per AGENTS.md Rule 7)
- No changes to test infrastructure setup
- No changes to Firestore schema beyond removing `/matches` rules

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (Vitest framework)
- **User wants tests**: Manual verification + Debug KB logging (per AGENTS.md Rule 4)
- **Framework**: Vitest (existing)
- **QA approach**: Manual verification with `:log` commands + Evidence collection

### Automated Verification Procedures

Each task includes EXECUTABLE verification that agents/executors can run:

**For Client-Side Changes (Step 1.1)**:
```bash
# Build verification
npm run build:log
# Expected: Clean build with no type errors

# Runtime verification (Firebase emulator)
npm run emulators:log
# Navigate to: http://localhost:4000/firestore
# Generate bracket via UI
# Inspect /tournaments/{id}/categories/{id}/_data/match documents
# Expected: stage_id, round_id, group_id are strings ("0" not 0)
```

**For Cloud Functions Changes (Steps 1.2, 1.3)**:
```bash
# Build verification
cd functions && npm run build
# Expected: TypeScript compilation succeeds

# Deploy to emulator
npm run emulators:log
# Expected: Functions deploy without errors

# Functional verification
# 1. Generate bracket (creates matches in /match)
# 2. Create 2 courts
# 3. Call generateSchedule (should write to /match_scores)
# 4. Complete Match 1 with winner
# 5. Call advanceWinner or UI complete match
# 6. Check Firestore: Winner appears in next round match

# Log verification
firebase functions:log --only advanceWinner
# Expected: Logs show /match reads, NOT /matches
```

**For Firestore Rules Changes (Step 1.4)**:
```bash
# Deploy rules
firebase deploy --only firestore:rules
# Expected: Deployment succeeds

# Verify rules work
npm run emulators:log
# Test app: Generate bracket, schedule, complete match
# Expected: All operations succeed, no permission errors
```

**Evidence to Capture** (per AGENTS.md Debug KB Protocol):
- Fingerprints from any failed `:log` commands
- Screenshot or JSON export of Firestore data showing string IDs
- Cloud Function logs showing correct collection usage
- Terminal output from all verification commands

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - ALL PARALLEL):
├── Task 1.1: Unify ID Types [no dependencies]
├── Task 1.2: Fix advanceWinner [no dependencies]
├── Task 1.3: Fix generateSchedule [no dependencies]
└── Task 1.4: Delete /matches Rules [no dependencies]

Critical Path: N/A (all independent)
Parallel Speedup: ~75% faster than sequential (4 tasks in 1 wave vs 4 sequential)
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1.1 | None | None | 1.2, 1.3, 1.4 |
| 1.2 | None | None | 1.1, 1.3, 1.4 |
| 1.3 | None | None | 1.1, 1.2, 1.4 |
| 1.4 | None | None | 1.1, 1.2, 1.3 |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents | Execution Pattern |
|------|-------|-------------------|-------------------|
| 1 | 1.1, 1.2, 1.3, 1.4 | All use `category="quick"` with TypeScript/Firebase skills | Launch all 4 in parallel via Task tool with `run_in_background=true` |

---

## TODOs

- [ ] 1.1. Unify ID Types in Client Adapter

  **What to do**:
  - Open `src/services/brackets-storage.ts`
  - Locate `normalizeReferences` method (lines 46-68)
  - Change line 55 from `normalized[key] = value.id;` to `normalized[key] = String(value.id);`
  - Change line 57 (inside same if-block) to ensure any assignment there also uses `String()`
  - Change line 64 from `normalized[key] = value;` to `normalized[key] = String(value);`

  **Must NOT do**:
  - Change any other methods in the class
  - Modify the insert, select, update, or delete methods
  - Change the class constructor or private methods
  - Add new dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple 2-line type conversion change in one function, no architectural impact
  - **Skills**: None needed (TypeScript knowledge is default)
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed - single atomic commit, no history search required
    - `frontend-ui-ux`: Not needed - backend data layer, no UI changes

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1.2, 1.3, 1.4)
  - **Blocks**: None
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References** (existing code to follow):
  - `functions/src/storage/firestore-adapter.ts:50-79` - Server-side normalizeReferences() that converts all IDs to strings (TARGET PATTERN to match)
  - `src/services/brackets-storage.ts:46-68` - Current client normalizeReferences() implementation (FILE TO MODIFY)

  **Type References** (contracts to understand):
  - `node_modules/brackets-manager/dist/types.d.ts` - CrudInterface definition and DataTypes
  - Understanding: IDs can be stored as strings or numbers, but Firestore document IDs are always strings

  **Migration Documentation** (requirements source):
  - `docs/migration/Phase1-Critical-Fixes.md:26-115` - Step 1.1 specification with exact line numbers and expected changes
  - `docs/migration/DATA_MODEL_MIGRATION_RULES.md:50-55` - Rule: "All IDs stored as strings; both adapters normalize to strings"

  **Test References** (patterns for verification):
  - `tests/unit/bracket.test.ts` - Existing bracket test structure (for understanding test patterns if adding tests)

  **WHY Each Reference Matters**:
  - Server adapter shows the target pattern: `String(value.id)` conversion for consistency
  - Migration doc provides exact line numbers (55-57, 64) and before/after code
  - Current client code shows context of where changes go (inside normalizeReferences recursive function)
  - Type definitions clarify that brackets-manager accepts both string and numeric IDs, but Firestore needs strings

  **Acceptance Criteria**:

  **Build Verification**:
  - [ ] Command: `npm run build:log`
  - [ ] Expected: Clean build, no TypeScript errors, output shows "✓ built in Xms"

  **Firestore Data Verification** (via Firebase emulator):
  - [ ] Start emulator: `npm run emulators:log`
  - [ ] Navigate to: http://localhost:4000/firestore
  - [ ] Generate a bracket via UI (any tournament, any number of participants)
  - [ ] Inspect a match document at path: `/tournaments/{id}/categories/{id}/_data/match/{match-doc}`
  - [ ] Assert: `stage_id` field type is string (shows as `"0"` not `0` in Firestore UI)
  - [ ] Assert: `round_id` field type is string
  - [ ] Assert: `group_id` field type is string
  - [ ] Assert: `id` field type is string

  **Evidence to Capture**:
  - [ ] Screenshot of Firestore emulator showing match document with string IDs
  - [ ] Terminal output from `npm run build:log` showing successful build
  - [ ] Save to: `docs/debug-kb/_artifacts/step-1.1-verification-<timestamp>.png`

  **Commit**: YES (atomic)
  - Message: `fix: unify ID types to strings in client adapter`
  - Files: `src/services/brackets-storage.ts`
  - Pre-commit: `npm run build:log` (must pass)

---

- [ ] 1.2. Fix advanceWinner Cloud Function

  **What to do**:
  - Open `functions/src/index.ts`
  - Locate `advanceWinner` function (lines 110-201)
  - Replace entire function implementation with brackets-manager API approach
  - Use pattern from `functions/src/updateMatch.ts` as reference
  - Initialize BracketsManager with FirestoreStorage adapter
  - Use `manager.storage.select('match', matchId)` to fetch match
  - Use `manager.update.match()` with winner result to advance bracket
  - Handle errors: match not found, locked match, invalid result

  **Must NOT do**:
  - Change function signature or exports
  - Modify other Cloud Functions in the file
  - Add new npm dependencies
  - Change Firebase Functions runtime version
  - Weaken authentication checks (keep `if (!request.auth)` guard)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward refactor following existing pattern (updateMatch.ts), ~60 line replacement, well-documented API
  - **Skills**: None needed (TypeScript + Firebase knowledge is default)
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed - single function refactor, atomic commit
    - `backend-architect`: Not needed - following existing architecture pattern, not designing new

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1.1, 1.3, 1.4)
  - **Blocks**: None
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References** (existing code to follow):
  - `functions/src/updateMatch.ts:12-120` - Demonstrates correct pattern: BracketsManager initialization, error handling, status mapping
  - `functions/src/storage/firestore-adapter.ts:1-200` - FirestoreStorage adapter implementation to use with BracketsManager
  - `functions/src/index.ts:110-201` - Current advanceWinner implementation (FILE TO REPLACE)

  **API References** (brackets-manager usage):
  - Librarian research (bg_2fc20b69): BracketsManager constructor, manager.storage.select(), manager.update.match() API
  - Example from research: 
    ```typescript
    const manager = new BracketsManager(new FirestoreStorage(rootPath));
    const match = await manager.storage.select('match', matchId);
    await manager.update.match({
      id: matchId,
      opponent1: { result: 'win' },
      opponent2: { result: 'loss' }
    });
    ```

  **Migration Documentation** (requirements source):
  - `docs/migration/Phase1-Critical-Fixes.md:118-283` - Step 1.2 specification with Option A (recommended) full code example
  - `docs/migration/DATA_MODEL_MIGRATION_RULES.md:1-90` - Architecture rules: use /match collection, brackets-manager owns structure

  **Error Handling Patterns**:
  - From librarian research: Check for `Match not found`, `The match is locked`, `draw is forbidden` errors
  - Pre-validate match status before updates (Status.Locked, Status.Waiting cannot be edited)

  **WHY Each Reference Matters**:
  - updateMatch.ts shows the exact pattern to follow (same FirestoreStorage initialization, same API calls)
  - Migration doc provides complete replacement code with error handling and logging
  - Librarian research explains why manager.update.match() handles winner advancement automatically (no manual nextMatchId logic needed)
  - FirestoreStorage adapter reference shows rootPath construction pattern

  **Acceptance Criteria**:

  **Build Verification**:
  - [ ] Command: `cd functions && npm run build`
  - [ ] Expected: TypeScript compilation succeeds, no errors in terminal

  **Deployment Verification**:
  - [ ] Command: `npm run emulators:log`
  - [ ] Expected: Functions deploy to emulator, "advanceWinner" appears in functions list

  **Functional Verification** (via Firebase emulator):
  - [ ] Generate a bracket (4+ participants, single elimination)
  - [ ] Complete Match 1 (Round 1) via UI or direct function call:
    ```bash
    # Option 1: Use UI to complete match and select winner
    # Option 2: Call function directly (if you have test harness)
    ```
  - [ ] Check Firestore at path: `/tournaments/{id}/match` collection
  - [ ] Assert: Round 2 Match 1 has `opponent1.id` or `opponent2.id` equal to winner from Round 1 Match 1
  - [ ] Check Cloud Function logs: `firebase functions:log --only advanceWinner`
  - [ ] Assert: Logs show "Match updated successfully, winner advanced"
  - [ ] Assert: NO logs mention `/matches` collection (only `/match`)

  **Error Handling Verification**:
  - [ ] Test case: Call advanceWinner with invalid matchId
  - [ ] Expected: Returns error "Match {id} not found"
  - [ ] Test case: Call advanceWinner on locked match (previous matches incomplete)
  - [ ] Expected: Returns error or gracefully handles locked state

  **Evidence to Capture**:
  - [ ] Screenshot of Firestore showing winner propagated to next round
  - [ ] Cloud Function logs showing successful execution
  - [ ] Terminal output from build command
  - [ ] Save to: `docs/debug-kb/_artifacts/step-1.2-verification-<timestamp>.log`

  **Commit**: YES (atomic)
  - Message: `fix: advanceWinner uses /match collection and brackets-manager API`
  - Files: `functions/src/index.ts`, `functions/lib/` (compiled output)
  - Pre-commit: `cd functions && npm run build` (must pass)

---

- [ ] 1.3. Fix generateSchedule Cloud Function

  **What to do**:
  - Open `functions/src/scheduling.ts`
  - Update read operations (lines 67-74):
    - Change `.collection('matches')` to `.collection('match')`
    - Change `.where('status', 'in', ['scheduled', 'ready'])` to `.where('status', 'in', [0, 1, 2])`
    - Remove `.orderBy()` clauses if they cause issues (match collection may not have indexes)
  - Update write operations (lines 101-112):
    - Change `.collection('matches')` to `.collection('match_scores')`
    - Change `batch.update()` to `batch.set()` with `{ merge: true }`
    - Remove `status: 'scheduled'` write (don't write status to /match_scores)
    - Keep `courtId`, `scheduledTime`, `updatedAt` writes

  **Must NOT do**:
  - Change the scheduling algorithm logic (lines 118-319)
  - Modify the function signature or exports
  - Add new npm dependencies
  - Change the ScheduleConfig interface
  - Modify court availability logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Two focused changes in specific line ranges, no algorithm modifications, following clear spec
  - **Skills**: None needed (TypeScript + Firestore knowledge is default)
  - **Skills Evaluated but Omitted**:
    - `git-master`: Not needed - straightforward collection reference updates
    - `database-optimizer`: Not needed - not optimizing queries, just correcting collection names

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1.1, 1.2, 1.4)
  - **Blocks**: None
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References** (existing code to follow):
  - `functions/src/updateMatch.ts:89-110` - Demonstrates writing to /match_scores with batch.set() merge pattern
  - `functions/src/scheduling.ts:67-74` - Current read location (LINES TO MODIFY)
  - `functions/src/scheduling.ts:101-112` - Current write location (LINES TO MODIFY)

  **API References** (Firestore batch operations):
  - `batch.set(docRef, data, { merge: true })` - Correct pattern for /match_scores writes
  - Firestore numeric status values: 0=Locked, 1=Waiting, 2=Ready (from brackets-manager Status enum)

  **Migration Documentation** (requirements source):
  - `docs/migration/Phase1-Critical-Fixes.md:287-428` - Step 1.3 specification with exact before/after code for both sections
  - `docs/migration/DATA_MODEL_MIGRATION_RULES.md:20-30` - Rule: "Read from /match, write to /match_scores"

  **Data Model References**:
  - `docs/migration/DATA_MODEL_MIGRATION_RULES.md:50-70` - Explains why /match uses numeric status (brackets-manager) and /match_scores uses string status (UI)

  **WHY Each Reference Matters**:
  - updateMatch.ts shows the correct batch.set() with merge pattern for /match_scores
  - Migration doc provides exact line numbers and before/after code for both read and write sections
  - Data model rules clarify the two-collection separation: /match (structure) vs /match_scores (operational)
  - Status enum understanding prevents confusion about numeric vs string status values

  **Acceptance Criteria**:

  **Build Verification**:
  - [ ] Command: `cd functions && npm run build`
  - [ ] Expected: TypeScript compilation succeeds

  **Deployment Verification**:
  - [ ] Command: `npm run emulators:log`
  - [ ] Expected: Functions deploy, "generateSchedule" listed

  **Functional Verification** (via Firebase emulator):
  - [ ] Generate a bracket (4+ participants)
  - [ ] Create 2 courts via UI
  - [ ] Call generateSchedule function (via UI or direct call)
  - [ ] Check Firestore `/match_scores` collection
  - [ ] Assert: Each match_scores document has `courtId` field (e.g., "court1")
  - [ ] Assert: Each match_scores document has `scheduledTime` Timestamp field
  - [ ] Assert: Each match_scores document has `updatedAt` Timestamp field
  - [ ] Check Firestore `/matches` collection
  - [ ] Assert: Collection does NOT exist or is empty (no writes to legacy collection)
  - [ ] Check UI: Matches display with court assignments and scheduled times

  **Log Verification**:
  - [ ] Check Cloud Function logs
  - [ ] Assert: No errors about missing `/matches` collection
  - [ ] Assert: Logs show reads from `/match` collection
  - [ ] Assert: Logs show writes to `/match_scores` collection

  **Evidence to Capture**:
  - [ ] Screenshot of Firestore /match_scores showing courtId and scheduledTime
  - [ ] Screenshot of Firestore showing NO /matches collection
  - [ ] Cloud Function logs
  - [ ] UI screenshot showing scheduled matches with courts
  - [ ] Save to: `docs/debug-kb/_artifacts/step-1.3-verification-<timestamp>.png`

  **Commit**: YES (atomic)
  - Message: `fix: generateSchedule reads /match and writes /match_scores`
  - Files: `functions/src/scheduling.ts`, `functions/lib/` (compiled output)
  - Pre-commit: `cd functions && npm run build` (must pass)

---

- [ ] 1.4. Delete /matches Collection Rules

  **What to do**:
  - Open `firestore.rules`
  - Locate `/matches` rules block (lines 76-84)
  - Delete the entire section:
    ```javascript
    // Matches subcollection
    match /matches/{matchId} {
      allow read: if true;
      allow create: if isAuthenticated();
      allow update: if isScorekeeper() || isAdmin();
      allow delete: if isAdmin();
    }
    ```
  - Verify no other references to `/matches` exist in the file

  **Must NOT do**:
  - Delete `/match` collection rules (lines 96-138)
  - Delete `/match_scores` collection rules (lines 134-138)
  - Modify any other security rules
  - Change helper functions (isAdmin, isAuthenticated, etc.)
  - Weaken security rules

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple deletion of 9-line rules block, no logic changes, clear specification
  - **Skills**: None needed (Firestore rules knowledge is default)
  - **Skills Evaluated but Omitted**:
    - `security-auditor`: Not needed - removing unused rules, not modifying security logic
    - `git-master`: Not needed - straightforward deletion, atomic commit

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1.1, 1.2, 1.3)
  - **Blocks**: None
  - **Blocked By**: None (can start immediately)

  **References**:

  **File References** (location to modify):
  - `firestore.rules:76-84` - Legacy /matches rules block (LINES TO DELETE)
  - `firestore.rules:96-138` - Correct /match rules (DO NOT TOUCH)
  - `firestore.rules:134-138` - Correct /match_scores rules (DO NOT TOUCH)

  **Migration Documentation** (requirements source):
  - `docs/migration/Phase1-Critical-Fixes.md:432-491` - Step 1.4 specification with exact lines to remove
  - `docs/migration/DATA_MODEL_MIGRATION_RULES.md:1-20` - Confirms /matches collection is completely removed, no longer used

  **Security Context** (why this is safe):
  - No production data exists in /matches collection (per migration doc line 461: "no production data exists")
  - All app code uses /match and /match_scores collections
  - Rules for correct collections (/match, /match_scores) remain intact

  **WHY Each Reference Matters**:
  - Migration doc confirms exact line numbers and safe deletion (no data migration needed)
  - Surrounding rules context shows what NOT to delete (/match and /match_scores rules must stay)
  - Data model rules confirm /matches is legacy and fully replaced

  **Acceptance Criteria**:

  **Deployment Verification**:
  - [ ] Command: `firebase deploy --only firestore:rules`
  - [ ] Expected: Deployment succeeds with message "Firestore rules deployed successfully"
  - [ ] Expected: No errors about invalid rule syntax

  **Functional Verification** (via Firebase emulator):
  - [ ] Command: `npm run emulators:log`
  - [ ] Expected: Emulator starts without rule errors
  - [ ] Generate a bracket via UI
  - [ ] Expected: Bracket creation succeeds (writes to /match)
  - [ ] Complete a match via UI
  - [ ] Expected: Match update succeeds (writes to /match_scores)
  - [ ] Schedule matches via UI
  - [ ] Expected: Scheduling succeeds (reads /match, writes /match_scores)

  **Security Verification**:
  - [ ] Verify authenticated users can still read/write matches
  - [ ] Verify unauthenticated users can read matches (if intended)
  - [ ] Verify no permission errors in browser console

  **Evidence to Capture**:
  - [ ] Terminal output from `firebase deploy --only firestore:rules` showing success
  - [ ] Screenshot of app working (bracket generation, match completion, scheduling)
  - [ ] Browser console showing no permission errors
  - [ ] Save to: `docs/debug-kb/_artifacts/step-1.4-verification-<timestamp>.log`

  **Commit**: YES (atomic)
  - Message: `fix: remove /matches collection security rules`
  - Files: `firestore.rules`
  - Pre-commit: `firebase deploy --only firestore:rules` (must succeed in emulator context)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1.1 | `fix: unify ID types to strings in client adapter` | `src/services/brackets-storage.ts` | `npm run build:log` |
| 1.2 | `fix: advanceWinner uses /match collection and brackets-manager API` | `functions/src/index.ts`, `functions/lib/` | `cd functions && npm run build` |
| 1.3 | `fix: generateSchedule reads /match and writes /match_scores` | `functions/src/scheduling.ts`, `functions/lib/` | `cd functions && npm run build` |
| 1.4 | `fix: remove /matches collection security rules` | `firestore.rules` | `firebase deploy --only firestore:rules` |

**All commits include**:
```
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

---

## Success Criteria

### Verification Commands
```bash
# Build all code
npm run build:log
cd functions && npm run build && cd ..

# Start emulator
npm run emulators:log

# Integration test (manual via UI or test script)
# 1. Generate bracket (4 participants, single elimination)
# 2. Create 2 courts
# 3. Call generateSchedule
# 4. Complete Match 1 with winner
# 5. Verify winner appears in Match 3 (Round 2)
```

### Final Checklist
- [ ] Step 1.1: ID types unified ✅
- [ ] Step 1.2: advanceWinner fixed ✅
- [ ] Step 1.3: generateSchedule fixed ✅
- [ ] Step 1.4: /matches rules removed ✅
- [ ] All functions deployed successfully
- [ ] Integration test passed: Generate → Schedule → Complete → Winner advances
- [ ] No errors in Cloud Function logs
- [ ] No references to `/matches` in running code
- [ ] All 4 commits pushed to repository

---

## Rollback Procedures

### Individual Task Rollback

**Rollback Task 1.1** (Client adapter):
```bash
git checkout HEAD~1 -- src/services/brackets-storage.ts
npm run build
```

**Rollback Task 1.2** (advanceWinner):
```bash
git checkout HEAD~1 -- functions/src/index.ts
cd functions && npm run build
firebase deploy --only functions:advanceWinner
```

**Rollback Task 1.3** (generateSchedule):
```bash
git checkout HEAD~1 -- functions/src/scheduling.ts
cd functions && npm run build
firebase deploy --only functions:generateSchedule
```

**Rollback Task 1.4** (Firestore rules):
```bash
git checkout HEAD~1 -- firestore.rules
firebase deploy --only firestore:rules
```

### Full Phase 1 Rollback

If entire phase needs revert:

```bash
# Find all Phase 1 commits
git log --oneline -10

# Revert in reverse order (last to first)
git revert <commit-1.4-hash>
git revert <commit-1.3-hash>
git revert <commit-1.2-hash>
git revert <commit-1.1-hash>

# Rebuild everything
npm run build
cd functions && npm run build && cd ..

# Redeploy
firebase deploy
```

**Verification after rollback**:
```bash
npm run emulators:log
# Test that app still works with pre-migration code
```

---

## Next Steps

**When Phase 1 is complete:**
1. Update `docs/migration/MASTER_PLAN.md` progress tracking
2. Proceed to Phase 2: Code Cleanup (if documented)
3. Run full regression test suite (if available)
4. Consider adding integration tests for Cloud Functions

**If issues encountered:**
1. Capture fingerprint from `:log` command failures
2. Search `docs/debug-kb/` for similar issues
3. Create new KB entry following `docs/debug-kb/TEMPLATE.md`
4. Link artifact logs and document root cause

---

## Agent Delegation Instructions

### How to Execute This Plan

**Option 1: Parallel Execution (FASTEST - ~75% time savings)**

Launch all 4 tasks simultaneously using the Task tool:

```typescript
// Task 1.1
delegate_task({
  subagent_type: "general",
  description: "Step 1.1: Unify ID types in brackets-storage.ts",
  prompt: "Execute Step 1.1 from .sisyphus/plans/phase1-migration-execution.md: Modify src/services/brackets-storage.ts lines 55-57 and 64 to convert IDs to strings using String(). Follow all references, verification steps, and commit strategy in the plan.",
  run_in_background: true
});

// Task 1.2
delegate_task({
  subagent_type: "general",
  description: "Step 1.2: Fix advanceWinner Cloud Function",
  prompt: "Execute Step 1.2 from .sisyphus/plans/phase1-migration-execution.md: Refactor functions/src/index.ts advanceWinner function (lines 110-201) to use brackets-manager API. Follow updateMatch.ts pattern. Complete all verification and commit.",
  run_in_background: true
});

// Task 1.3
delegate_task({
  subagent_type: "general",
  description: "Step 1.3: Fix generateSchedule Cloud Function",
  prompt: "Execute Step 1.3 from .sisyphus/plans/phase1-migration-execution.md: Update functions/src/scheduling.ts lines 67-74 (read) and 101-112 (write) to use /match and /match_scores collections. Follow all verification and commit.",
  run_in_background: true
});

// Task 1.4
delegate_task({
  subagent_type: "general",
  description: "Step 1.4: Delete /matches Firestore rules",
  prompt: "Execute Step 1.4 from .sisyphus/plans/phase1-migration-execution.md: Delete lines 76-84 in firestore.rules (legacy /matches rules block). Verify deployment and commit.",
  run_in_background: true
});

// Wait for all to complete, then run integration test
```

**Option 2: Sequential Execution (SAFER - easier debugging)**

Execute tasks one at a time, verify each before proceeding:

```bash
# Task 1.1
execute_step("1.1")
verify_step("1.1")
commit_step("1.1")

# Task 1.2
execute_step("1.2")
verify_step("1.2")
commit_step("1.2")

# Task 1.3
execute_step("1.3")
verify_step("1.3")
commit_step("1.3")

# Task 1.4
execute_step("1.4")
verify_step("1.4")
commit_step("1.4")

# Final integration test
run_integration_test()
```

**Option 3: Boulder/Start-Work Pattern (RECOMMENDED per AGENTS.md)**

```bash
# Register this plan as active boulder
/start-work

# Sisyphus will:
# 1. Read this plan
# 2. Execute tasks according to parallelization strategy
# 3. Track progress
# 4. Handle continuation across sessions
# 5. Run verification and commits per plan specs
```

---

## Plan Metadata

- **Created**: 2026-02-01
- **Plan Type**: Migration (Critical Fixes)
- **Complexity**: Medium (4 independent tasks, well-documented)
- **Risk Level**: Low (all tasks reversible, no data migration, no production impact)
- **Estimated Duration**: 4-6 hours (1-1.5 hours per task)
- **Prerequisites Met**: ✅ Research complete, architecture understood, patterns identified
