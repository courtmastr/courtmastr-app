# Courtmaster Migration Rollback Plan

**Document Version:** 1.0
**Created:** February 1, 2026
**Status:** Ready for Implementation

---

## Overview

This document provides rollback procedures for each phase of the data model migration.

**CRITICAL SIMPLIFICATION: No Production Data Exists**

Since there is no production data:
- Rollbacks are **code-only** operations
- No data restoration or migration concerns
- Can rollback aggressively without data loss risk
- Fresh test data can be regenerated on-demand

---

## General Rollback Principles

1. **Git-Based Recovery**: All rollbacks use git revert/checkout
2. **Firebase Functions**: Rollback via redeployment of previous version
3. **No Data Rollback Needed**: No existing data to preserve
4. **Estimated Rollback Time**: 5-10 minutes per step
5. **Simplified Timeline**: Entire migration is ~1 week, not 6 weeks

---

## Phase 1 Rollback Procedures

### Step 1.1: Unify ID Types

**Changed File:** `src/services/brackets-storage.ts`

**Symptoms of Failure:**
- Bracket generation fails
- Console errors about ID types
- Firestore writes fail

**Rollback Steps:**
```bash
# 1. Revert the specific file
git checkout HEAD~1 -- src/services/brackets-storage.ts

# 2. Rebuild the app
npm run build

# 3. Verify the revert
grep -n "normalized\[key\] = " src/services/brackets-storage.ts
# Should show original code (keeping as number, not String())

# 4. Test bracket generation works
# Open app, create tournament, generate bracket
```

**Rollback Time:** 5 minutes

**Verification:**
- [ ] Bracket generation works
- [ ] No console errors
- [ ] Matches created in Firestore

---

### Step 1.2: Fix advanceWinner Cloud Function

**Changed File:** `functions/src/index.ts`

**Symptoms of Failure:**
- Bracket progression stops working
- Winners don't advance to next round
- Cloud Function errors in Firebase console

**Rollback Steps:**
```bash
# 1. Revert the Cloud Function file
git checkout HEAD~1 -- functions/src/index.ts

# 2. Rebuild Cloud Functions
cd functions
npm run build

# 3. Deploy reverted function
firebase deploy --only functions:advanceWinner

# 4. Verify deployment
firebase functions:log --only advanceWinner
```

**Rollback Time:** 10 minutes

**Verification:**
- [ ] advanceWinner function deployed successfully
- [ ] Function logs show no errors
- [ ] Test: Complete a match, winner advances

---

### Step 1.3: Fix generateSchedule Cloud Function

**Changed File:** `functions/src/scheduling.ts`

**Symptoms of Failure:**
- Schedule generation fails
- Matches don't get court assignments
- Cloud Function timeout or errors

**Rollback Steps:**
```bash
# 1. Revert the scheduling file
git checkout HEAD~1 -- functions/src/scheduling.ts

# 2. Rebuild Cloud Functions
cd functions
npm run build

# 3. Deploy reverted function
firebase deploy --only functions:generateSchedule

# 4. Verify deployment
firebase functions:log --only generateSchedule
```

**Rollback Time:** 10 minutes

**Verification:**
- [ ] generateSchedule function deployed successfully
- [ ] Function logs show no errors
- [ ] Test: Generate schedule, matches get court assignments

---

### Phase 1 Complete Rollback

If multiple Step 1.x changes need to be reverted together:

```bash
# Revert all Phase 1 changes at once
git log --oneline -10  # Find the commit before Phase 1 started
git revert <phase1-commit-hash>  # Or multiple commits

# Rebuild everything
npm run build
cd functions && npm run build && cd ..

# Deploy all functions
firebase deploy --only functions

# Verify
npm run dev  # Start local dev server and test
```

**Total Rollback Time:** 15 minutes

---

## Phase 2 Rollback Procedures

### Step 2.1: Audit /matches References

**Changed Files:** Multiple (identified during audit)

**Symptoms of Failure:**
- Features that previously worked now fail
- "Collection not found" errors
- Missing data in UI

**Rollback Steps:**
```bash
# 1. Identify all changed files in this step
git diff --name-only HEAD~1

# 2. Revert all changes
git revert HEAD

# 3. Rebuild
npm run build
cd functions && npm run build && cd ..

# 4. If Cloud Functions changed, redeploy
firebase deploy --only functions
```

**Rollback Time:** 10 minutes

---

### Step 2.2: Standardize Status Handling

**Changed Files:**
- `src/stores/bracketMatchAdapter.ts`
- `src/stores/matches.ts`

**Symptoms of Failure:**
- Wrong match status displayed
- Matches show as "scheduled" when they're "in_progress"
- Status filters don't work

**Rollback Steps:**
```bash
# 1. Revert specific files
git checkout HEAD~1 -- src/stores/bracketMatchAdapter.ts src/stores/matches.ts

# 2. Rebuild
npm run build

# 3. Test status display
# Open app, verify match statuses show correctly
```

**Rollback Time:** 5 minutes

---

### Step 2.3: Verify Real-Time Subscriptions

**Changed Files:** `src/stores/matches.ts` (subscription logic)

**Symptoms of Failure:**
- Real-time updates stop working
- UI doesn't refresh when data changes
- Memory leaks (subscriptions not cleaned up)

**Rollback Steps:**
```bash
# 1. Revert matches store
git checkout HEAD~1 -- src/stores/matches.ts

# 2. Rebuild
npm run build

# 3. Test real-time
# Open two browser tabs, make change in one, verify other updates
```

**Rollback Time:** 5 minutes

---

### Phase 2 Complete Rollback

```bash
# Revert entire Phase 2
git log --oneline -10  # Find commit before Phase 2
git revert <phase2-start-commit>..<phase2-end-commit>

# Rebuild and deploy
npm run build
cd functions && npm run build && cd ..
firebase deploy --only functions
```

**Total Rollback Time:** 15 minutes

---

## Phase 3 Rollback Procedures

### Step 3.1: Remove /matches Collection

**Changed Files:**
- Firestore security rules (`firestore.rules`)
- Any remaining code references

**Symptoms of Failure:**
- Security rule errors
- Permission denied errors

**Rollback Steps:**
```bash
# 1. Revert firestore rules
git checkout HEAD~1 -- firestore.rules

# 2. Deploy rules
firebase deploy --only firestore:rules

# 3. Verify
# Test operations that were failing
```

**Rollback Time:** 5 minutes

**Note:** Since there's no data, we don't need to recreate the /matches collection.

---

### Step 3.2: Consolidate Adapters

**Changed Files:**
- `src/services/brackets-storage.ts`
- `functions/src/storage/firestore-adapter.ts`

**Symptoms of Failure:**
- Client and server produce incompatible data
- ID mismatches return

**Rollback Steps:**
```bash
# 1. Revert both adapter files
git checkout HEAD~1 -- src/services/brackets-storage.ts functions/src/storage/firestore-adapter.ts

# 2. Rebuild
npm run build
cd functions && npm run build && cd ..

# 3. Deploy functions
firebase deploy --only functions
```

**Rollback Time:** 10 minutes

---

### Phase 3 Complete Rollback

```bash
# Revert entire Phase 3
git revert <phase3-commits>

# Deploy everything
npm run build
cd functions && npm run build && cd ..
firebase deploy
```

**Total Rollback Time:** 15 minutes

---

## Emergency Procedures

### Complete Migration Rollback

If the entire migration needs to be reverted:

```bash
# 1. Find the commit hash before migration started
git log --oneline -20
# Look for commit message like "Pre-migration state" or last stable commit

# 2. Create a rollback branch
git checkout -b rollback-migration <pre-migration-commit>

# 3. Force deploy (CAUTION: destructive in production)
npm run build
cd functions && npm run build && cd ..
firebase deploy

# 4. Switch main branch back
git checkout main
git reset --hard <pre-migration-commit>
git push --force-with-lease origin main
```

**Total Rollback Time:** 20 minutes

---

### Communication Template

When initiating a rollback, notify stakeholders:

```
SUBJECT: [ROLLBACK] Courtmaster Data Model Migration - Phase X

STATUS: Rollback in progress

ISSUE: [Brief description of what failed]

IMPACT: [What features are affected]

ACTION: Rolling back Phase X changes
- Step X.Y being reverted
- Estimated completion: [time]

NEXT STEPS:
1. Investigate root cause
2. Fix issue in development
3. Re-attempt migration with fix

ETA FOR RESOLUTION: [estimate]
```

---

## Rollback Decision Tree

```
Is the app completely broken?
├── YES → Complete Migration Rollback
└── NO
    └── Is it a Cloud Function issue?
        ├── YES → Rollback specific function
        └── NO
            └── Is it a client-side issue?
                ├── YES → Rollback specific client file
                └── NO
                    └── Is it a Firestore rules issue?
                        ├── YES → Rollback firestore.rules
                        └── NO → Investigate further before rollback
```

---

## Prevention Checklist

Before each phase deployment:

- [ ] All tests passed locally
- [ ] Changes committed with clear message
- [ ] Commit hash recorded for rollback reference
- [ ] Firebase emulator tested
- [ ] Team notified of deployment
- [ ] Monitoring dashboards open

---

## Commit Reference Log

Track commit hashes for quick rollback:

| Phase | Step | Commit Hash | Date | Deployed By |
|-------|------|-------------|------|-------------|
| Pre-migration | - | __________ | ___/___/___ | __________ |
| 1 | 1.1 | __________ | ___/___/___ | __________ |
| 1 | 1.2 | __________ | ___/___/___ | __________ |
| 1 | 1.3 | __________ | ___/___/___ | __________ |
| 2 | 2.1 | __________ | ___/___/___ | __________ |
| 2 | 2.2 | __________ | ___/___/___ | __________ |
| 2 | 2.3 | __________ | ___/___/___ | __________ |
| 3 | 3.1 | __________ | ___/___/___ | __________ |
| 3 | 3.2 | __________ | ___/___/___ | __________ |
| 3 | 3.3 | __________ | ___/___/___ | __________ |

---

**Document maintained by:** Development Team
**Last updated:** February 1, 2026
