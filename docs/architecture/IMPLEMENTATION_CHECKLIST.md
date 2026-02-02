# Courtmaster Migration Implementation Checklist

**Document Version:** 1.0
**Created:** February 1, 2026
**Status:** Ready for Implementation

---

## Overview

This checklist tracks progress through the data model migration. Check off each item as completed.

**IMPORTANT: No Production Data Exists**

This significantly simplifies and accelerates the migration:
- No data migration or archiving needed
- No backward compatibility period required
- Can delete `/matches` collection immediately after code changes
- Testing uses fresh data generated on-demand
- **Estimated total time: 1 week (not 6 weeks)**

---

## Pre-Migration Setup

### Environment Preparation
- [ ] Firebase emulator installed and configured
- [ ] All team members have access to repository
- [ ] Pre-migration commit hash recorded: `_______________`
- [ ] Backup branch created: `git checkout -b pre-migration-backup`

### Documentation Review
- [ ] DATA_MODEL_ARCHITECTURE.md reviewed by team
- [ ] TESTING_STRATEGY.md reviewed by team
- [ ] ROLLBACK_PLAN.md reviewed by team
- [ ] All team members understand the changes

---

## Phase 1: Critical Fixes
**Target Duration:** Days 1-3
**Start Date:** ___/___/___

### Step 1.1: Unify ID Types
**Estimated Time:** 2 hours
**Risk Level:** MEDIUM
**Assignee:** _______________

#### Code Changes
- [ ] Open `src/services/brackets-storage.ts`
- [ ] Locate `normalizeReferences` method (~line 46-68)
- [ ] Change line 55-56 from:
  ```typescript
  normalized[key] = value.id; // Keep as is (number)
  ```
  to:
  ```typescript
  normalized[key] = String(value.id); // Convert to string
  ```
- [ ] Also update line 57 for primitive values:
  ```typescript
  normalized[key] = String(value); // Convert to string
  ```

#### Testing
- [ ] Run Test 1.1.1: Client bracket generation produces string IDs
- [ ] Run Test 1.1.2: Client generation + server update compatibility
- [ ] Run Test 1.1.3: ID comparison edge cases

#### Deployment
- [ ] Commit changes: `git commit -m "fix: unify ID types to strings in client adapter"`
- [ ] Record commit hash: `_______________`
- [ ] Deploy to staging (if applicable)
- [ ] Verify in emulator

#### Sign-off
- [ ] **Step 1.1 Complete** - Signed: _______________ Date: ___/___/___

---

### Step 1.2: Fix advanceWinner Cloud Function
**Estimated Time:** 4 hours
**Risk Level:** HIGH
**Assignee:** _______________

#### Code Changes
- [ ] Open `functions/src/index.ts`
- [ ] Locate `advanceWinner` function (~line 110-200)
- [ ] Change collection reference from `/matches` to `/match`:
  ```typescript
  // BEFORE (line ~131-135):
  const matchDoc = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('matches')  // WRONG
    .doc(matchId)
    .get();

  // AFTER:
  const matchDoc = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('match')  // CORRECT
    .doc(matchId)
    .get();
  ```
- [ ] Update match data access to use brackets-manager format:
  ```typescript
  // BEFORE:
  if (match?.nextMatchId && match?.nextMatchSlot) {
    await db.collection('matches').doc(match.nextMatchId).update(...)

  // AFTER - Use brackets-manager API or update /match collection:
  // Option A: Direct /match update
  // Option B: Use BracketsManager instance
  ```
- [ ] Update loser advancement for double elimination (same pattern)
- [ ] Update court release to use correct collection

#### Testing
- [ ] Run Test 1.2.1: Basic winner advancement
- [ ] Run Test 1.2.2: Double elimination loser advancement
- [ ] Run Test 1.2.3: Grand finals handling
- [ ] Verify CF logs show /match reads (not /matches)

#### Deployment
- [ ] Build functions: `cd functions && npm run build`
- [ ] Commit changes: `git commit -m "fix: advanceWinner CF uses /match collection"`
- [ ] Record commit hash: `_______________`
- [ ] Deploy function: `firebase deploy --only functions:advanceWinner`
- [ ] Verify deployment: `firebase functions:log --only advanceWinner`

#### Sign-off
- [ ] **Step 1.2 Complete** - Signed: _______________ Date: ___/___/___

---

### Step 1.3: Fix generateSchedule Cloud Function
**Estimated Time:** 4 hours
**Risk Level:** HIGH
**Assignee:** _______________

#### Code Changes
- [ ] Open `functions/src/scheduling.ts`
- [ ] Locate match query (~line 67-79):
  ```typescript
  // BEFORE:
  const matchesSnapshot = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('matches')  // WRONG
    .where('status', 'in', ['scheduled', 'ready'])

  // AFTER:
  const matchesSnapshot = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('match')  // CORRECT
    .where('status', 'in', [0, 1, 2])  // brackets-manager numeric status
  ```
- [ ] Update schedule write to use `/match_scores` (~line 98-115):
  ```typescript
  // BEFORE:
  const matchRef = db.collection('matches').doc(slot.matchId);
  batch.update(matchRef, {
    courtId: slot.courtId,
    scheduledTime: ...,
    status: 'scheduled',
  });

  // AFTER:
  const scoreRef = db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('match_scores')
    .doc(slot.matchId);
  batch.set(scoreRef, {
    courtId: slot.courtId,
    scheduledTime: ...,
  }, { merge: true });
  ```
- [ ] Update type imports if needed (Match type changes)

#### Testing
- [ ] Run Test 1.3.1: Basic schedule generation
- [ ] Run Test 1.3.2: Schedule respects match dependencies
- [ ] Run Test 1.3.3: Client + server scheduling alignment
- [ ] Verify /match_scores documents have scheduling data
- [ ] Verify NO writes to /matches collection

#### Deployment
- [ ] Build functions: `cd functions && npm run build`
- [ ] Commit changes: `git commit -m "fix: generateSchedule CF uses /match and /match_scores"`
- [ ] Record commit hash: `_______________`
- [ ] Deploy function: `firebase deploy --only functions:generateSchedule`
- [ ] Verify deployment: `firebase functions:log --only generateSchedule`

#### Sign-off
- [ ] **Step 1.3 Complete** - Signed: _______________ Date: ___/___/___

---

### Step 1.4: Delete /matches Collection (Immediate!)
**Estimated Time:** 30 minutes
**Risk Level:** LOW (no data exists!)
**Assignee:** _______________

Since there's no production data, we can delete immediately after code changes.

#### Firestore Rules
- [ ] Open `firestore.rules`
- [ ] Remove /matches rules section entirely
- [ ] Deploy: `firebase deploy --only firestore:rules`

#### Sign-off
- [ ] **Step 1.4 Complete** - Signed: _______________ Date: ___/___/___

---

### Phase 1 Complete
- [ ] All Step 1.x items checked
- [ ] All Phase 1 tests passed
- [ ] /matches collection removed
- [ ] **Phase 1 Approved** - Signed: _______________ Date: ___/___/___

---

## Phase 2: Code Cleanup
**Target Duration:** Days 4-5
**Start Date:** ___/___/___

### Step 2.1: Audit /matches References
**Estimated Time:** 2 hours
**Risk Level:** LOW
**Assignee:** _______________

#### Code Audit
- [ ] Run audit commands:
  ```bash
  grep -rn "collection('matches')" --include="*.ts" . > /tmp/matches-audit.txt
  grep -rn "collection.*matches" --include="*.ts" . >> /tmp/matches-audit.txt
  grep -rn "/matches" --include="*.ts" . >> /tmp/matches-audit.txt
  ```
- [ ] Review `/tmp/matches-audit.txt`
- [ ] Document all remaining references:

| File | Line | Reference | Action Needed |
|------|------|-----------|---------------|
| | | | |
| | | | |
| | | | |

#### Code Changes
- [ ] Update each identified reference
- [ ] Remove or update imports
- [ ] Fix type references

#### Testing
- [ ] Run Test 2.1.1: Code search verification (zero results)
- [ ] Run Test 2.1.2: Runtime verification (no /matches operations)

#### Deployment
- [ ] Commit changes: `git commit -m "refactor: remove all /matches collection references"`
- [ ] Record commit hash: `_______________`
- [ ] Deploy if functions changed

#### Sign-off
- [ ] **Step 2.1 Complete** - Signed: _______________ Date: ___/___/___

---

### Step 2.2: Standardize Status Handling
**Estimated Time:** 3 hours
**Risk Level:** MEDIUM
**Assignee:** _______________

#### Code Changes
- [ ] Review `src/stores/bracketMatchAdapter.ts`
- [ ] Ensure `convertBracketsStatus` only used for initial mapping
- [ ] Review `src/stores/matches.ts` merge logic (~line 118-126)
- [ ] Confirm `/match_scores.status` takes precedence:
  ```typescript
  if (scoreData) {
    if (scoreData.status) adapted.status = scoreData.status;  // This should override
    // ...
  }
  ```
- [ ] Add comment documenting status source of truth

#### Testing
- [ ] Run Test 2.2.1: Status source of truth
- [ ] Run Test 2.2.2: Status updates flow correctly

#### Deployment
- [ ] Commit changes: `git commit -m "refactor: standardize status handling, match_scores is source of truth"`
- [ ] Record commit hash: `_______________`

#### Sign-off
- [ ] **Step 2.2 Complete** - Signed: _______________ Date: ___/___/___

---

### Step 2.3: Verify Real-Time Subscriptions
**Estimated Time:** 1 hour
**Risk Level:** LOW
**Assignee:** _______________

#### Code Review
- [ ] Review `src/stores/matches.ts` subscriptions (~line 146-168)
- [ ] Confirm subscription to `/match`:
  ```typescript
  const qMatch = collection(db, `tournaments/${tournamentId}/match`);
  const unsubMatch = onSnapshot(qMatch, () => refresh());
  ```
- [ ] Confirm subscription to `/match_scores`:
  ```typescript
  const qScores = collection(db, `tournaments/${tournamentId}/match_scores`);
  const unsubScores = onSnapshot(qScores, () => refresh());
  ```
- [ ] Verify cleanup in `unsubscribeAll()` function

#### Testing
- [ ] Run Test 2.3.1: Score updates propagate (two browser tabs)
- [ ] Run Test 2.3.2: Public view updates

#### Sign-off
- [ ] **Step 2.3 Complete** - Signed: _______________ Date: ___/___/___

---

### Step 2.4: Consolidate Adapters
**Estimated Time:** 2 hours
**Risk Level:** LOW
**Assignee:** _______________

#### Code Review
- [ ] Compare `src/services/brackets-storage.ts` with `functions/src/storage/firestore-adapter.ts`
- [ ] Document any remaining differences:

| Aspect | Client Adapter | Server Adapter | Aligned? |
|--------|---------------|----------------|----------|
| ID handling | | | [ ] |
| normalizeReferences | | | [ ] |
| removeUndefined | | | [ ] |
| Batch handling | | | [ ] |

#### Code Changes (if needed)
- [ ] Align any remaining differences
- [ ] Add comments explaining any intentional differences

#### Testing
- [ ] Run Test: Client and server generate identical data structures

#### Deployment
- [ ] Commit changes: `git commit -m "refactor: consolidate client and server Firestore adapters"`
- [ ] Record commit hash: `_______________`
- [ ] Deploy functions: `firebase deploy --only functions`

#### Sign-off
- [ ] **Step 2.4 Complete** - Signed: _______________ Date: ___/___/___

---

### Phase 2 Complete
- [ ] All Step 2.x items checked
- [ ] All /matches references removed from code
- [ ] Adapters consolidated
- [ ] **Phase 2 Approved** - Signed: _______________ Date: ___/___/___

---

## Phase 3: Verification & Documentation
**Target Duration:** Day 6
**Start Date:** ___/___/___

### Step 3.1: Integration Testing
**Estimated Time:** 2 hours
**Risk Level:** LOW
**Assignee:** _______________

#### Full Workflow Test
- [ ] Create tournament with 2 categories
- [ ] Register 8 players per category
- [ ] Generate brackets for both categories
- [ ] Schedule all matches
- [ ] Complete all matches with scores
- [ ] Verify final standings correct

#### Concurrent Scoring Test
- [ ] Open 4 different scoring sessions
- [ ] Score matches simultaneously
- [ ] Verify no data conflicts

#### Sign-off
- [ ] **Step 3.1 Complete** - Signed: _______________ Date: ___/___/___

---

### Step 3.2: Documentation Update
**Estimated Time:** 1 hour
**Risk Level:** LOW
**Assignee:** _______________

#### Documentation Updates
- [ ] Update DATA_MODEL_ARCHITECTURE.md to mark migration complete
- [ ] Update AGENTS.md if relevant
- [ ] Update README.md if needed

#### Deployment
- [ ] Commit documentation: `git commit -m "docs: update architecture documentation post-migration"`
- [ ] Record commit hash: `_______________`

#### Sign-off
- [ ] **Step 3.2 Complete** - Signed: _______________ Date: ___/___/___

---

### Phase 3 Complete
- [ ] All Step 3.x items checked
- [ ] All Phase 3 tests passed
- [ ] Integration tests passed
- [ ] Load tests passed
- [ ] Team notified of Phase 3 completion
- [ ] **Phase 3 Approved** - Signed: _______________ Date: ___/___/___

---

## Migration Complete

### Final Checklist
- [ ] All phases completed and signed off
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Team trained on new architecture
- [ ] Monitoring in place

### Summary

| Phase | Start Date | End Date | Duration | Issues |
|-------|------------|----------|----------|--------|
| Phase 1 | ___/___/___ | ___/___/___ | ___ days | |
| Phase 2 | ___/___/___ | ___/___/___ | ___ days | |
| Phase 3 | ___/___/___ | ___/___/___ | ___ days | |
| **Total** | | | **___ days** | |

### Lessons Learned
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

**Migration Completed By:** _______________
**Date:** ___/___/___
**Final Approval:** _______________

---

**Document maintained by:** Development Team
**Last updated:** February 1, 2026
