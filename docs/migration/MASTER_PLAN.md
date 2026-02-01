# Courtmaster Data Model Migration - Master Plan

**Created:** February 1, 2026
**Status:** 🔄 In Progress
**Estimated Duration:** 5-6 days (no production data)

---

## Quick Links

- [Phase 1: Critical Fixes](Phase1-Critical-Fixes.md) - Days 1-3
- [Phase 2: Code Cleanup](Phase2-Code-Cleanup.md) - Days 4-5
- [Phase 3: Verification](Phase3-Verification.md) - Day 6
- [Architecture Documentation](../architecture/DATA_MODEL_ARCHITECTURE.md)
- [Rollback Plan](../architecture/ROLLBACK_PLAN.md)

---

## Migration Overview

This migration resolves critical data inconsistencies by:
- **Consolidating** three match collections (`/match`, `/match_scores`, `/matches`) into two
- **Unifying** ID types (numeric → string) across client and server
- **Eliminating** the legacy `/matches` collection entirely
- **Fixing** 4 critical bugs that break core functionality

---

## Progress Tracking

### Phase 1: Critical Fixes ⏱️ Days 1-3
- [ ] **Step 1.1:** Unify ID Types (2 hours)
- [ ] **Step 1.2:** Fix advanceWinner Cloud Function (4 hours)
- [ ] **Step 1.3:** Fix generateSchedule Cloud Function (4 hours)
- [ ] **Step 1.4:** Delete /matches Collection Rules (30 min)

**Status:** Not Started | **Target Completion:** Day 3

---

### Phase 2: Code Cleanup ⏱️ Days 4-5
- [ ] **Step 2.1:** Audit /matches References (2 hours)
- [ ] **Step 2.2:** Standardize Status Handling (2 hours)
- [ ] **Step 2.3:** Verify Real-Time Subscriptions (1 hour)
- [ ] **Step 2.4:** Consolidate Adapters (2 hours)

**Status:** Not Started | **Target Completion:** Day 5

---

### Phase 3: Verification ⏱️ Day 6
- [ ] **Step 3.1:** Integration Testing (2 hours)
- [ ] **Step 3.2:** Documentation Update (1 hour)

**Status:** Not Started | **Target Completion:** Day 6

---

## Critical Files

| File | Issue | Phase | Priority |
|------|-------|-------|----------|
| [src/services/brackets-storage.ts](../../src/services/brackets-storage.ts) | Numeric IDs → String IDs | 1.1 | HIGH |
| [functions/src/index.ts](../../functions/src/index.ts) | Uses `/matches` collection | 1.2 | CRITICAL |
| [functions/src/scheduling.ts](../../functions/src/scheduling.ts) | Uses `/matches` collection | 1.3 | CRITICAL |
| [firestore.rules](../../firestore.rules) | Has `/matches` rules | 1.4 | MEDIUM |

---

## Success Criteria

Migration is complete when:

- [  ] All 4 critical bugs fixed
- [ ] All code references to `/matches` removed
- [ ] Full tournament workflow test passes
- [ ] Concurrent scoring test passes
- [ ] Documentation updated
- [ ] No regression in existing features

---

## Rollback Strategy

If anything goes wrong:

```bash
# Quick rollback to previous commit
git revert <commit-hash>

# Full rollback procedure
See docs/architecture/ROLLBACK_PLAN.md
```

---

## Commit Log

Track commits for easy rollback:

| Phase | Step | Commit Hash | Date | Status |
|-------|------|-------------|------|--------|
| Pre-migration | - | __________ | ___/___/___ | ✅ |
| 1 | 1.1 | __________ | ___/___/___ | ⏳ |
| 1 | 1.2 | __________ | ___/___/___ | ⏳ |
| 1 | 1.3 | __________ | ___/___/___ | ⏳ |
| 1 | 1.4 | __________ | ___/___/___ | ⏳ |
| 2 | 2.1 | __________ | ___/___/___ | ⏳ |
| 2 | 2.2 | __________ | ___/___/___ | ⏳ |
| 2 | 2.3 | __________ | ___/___/___ | ⏳ |
| 2 | 2.4 | __________ | ___/___/___ | ⏳ |
| 3 | 3.1 | __________ | ___/___/___ | ⏳ |
| 3 | 3.2 | __________ | ___/___/___ | ⏳ |

---

## Current Status

**Last Updated:** February 1, 2026
**Current Phase:** Phase 1 - Step 1.1
**Blocker:** None
**Next Action:** Create phase documentation files

---

**Document Maintained By:** Development Team
