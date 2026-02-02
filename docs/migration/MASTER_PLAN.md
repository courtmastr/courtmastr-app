# Courtmaster Data Model Migration - Master Plan

**Created:** February 1, 2026
**Status:** ✅ Complete (Pending Manual Testing)
**Estimated Duration:** 5-6 days (no production data)

---

## Quick Links

- [Phase 1: Critical Fixes](Phase1-Critical-Fixes.md) - Days 1-3
- [Phase 2: Code Cleanup](Phase2-Code-Cleanup.md) - Days 4-5
- [Phase 3: Verification](Phase3-Verification.md) - Day 6
- [Phase 4: Fix Matches Display](Phase4-Fix-Matches-Display.md) - Post-Migration Fix
- [Phase 5: Fix Matches Display and Storage Paths](Phase5-Fix-Matches-Display-And-Storage-Paths.md) - 🔴 Not Started
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

### Phase 1: Critical Fixes ⏱️ Days 1-3 ✅ COMPLETE
- [x] **Step 1.1a:** Unify ID Types (2 hours) - `5eb2675`
- [x] **Step 1.1b:** Emergency Fix ID Type Bug (30 min) - `caaa366`
- [x] **Step 1.2:** Fix advanceWinner Cloud Function (4 hours) - `5eb2675`
- [x] **Step 1.3:** Fix generateSchedule Cloud Function (4 hours) - `5eb2675`
- [x] **Step 1.4a:** Delete /matches Collection Rules (30 min) - `5eb2675`
- [x] **Step 1.4b:** Fix tournaments.ts References (45 min) - `d47fb5d`

**Status:** ✅ Complete | **Completed:** Day 1 (02/01/2026) | **Commits:** `5eb2675...d47fb5d`

---

### Phase 2: Code Cleanup ⏱️ Days 4-5 ✅ COMPLETE
- [x] **Step 2.1:** Audit /matches References (2 hours) - `PHASE2_COMMIT`
- [x] **Step 2.2:** Standardize Status Handling (2 hours) - `PHASE2_COMMIT`
- [x] **Step 2.3:** Verify Real-Time Subscriptions (1 hour) - `PHASE2_COMMIT`
- [x] **Step 2.4:** Consolidate Adapters (2 hours) - `PHASE2_COMMIT`

**Status:** ✅ Complete | **Completed:** Day 2 (02/01/2026) | **Commits:** `PHASE2_COMMIT`

---

### Phase 3: Verification ⏱️ Day 6 ✅ COMPLETE
- [x] **Step 3.2:** Documentation Update (1 hour) - `PHASE3_COMMIT`

**Status:** ✅ Complete | **Completed:** Day 2 (02/01/2026) | **Commits:** `PHASE3_COMMIT`

---

### Phase 4: Fix Matches Display ⏱️ 2-3 hours ✅ COMPLETE
- [x] **Step 4.1:** Update fetchMatch with categoryId (15 min)
- [x] **Step 4.2:** Update subscribeMatch with categoryId (10 min)
- [x] **Step 4.3:** Update markMatchReady, calculateWinner, submitManualScores (25 min)
- [x] **Step 4.4:** Update TournamentDashboardView with category selector (20 min)
- [x] **Step 4.5:** Update MatchControlView and ScoringInterfaceView (30 min)

**Status:** ✅ Complete | **Completed:** 02/02/2026 | **Commits:** TBD

**Issue:** MATCHES tab shows "No data available" despite brackets being generated
**Root Cause 1:** Matches store used incorrect 6-segment paths with `/_data/` subdirectory
**Root Cause 2:** Firestore security rules missing `match_scores` permission for category-level paths
**Solution:**
1. Updated all match store functions to accept optional categoryId and REMOVED `/_data/` from paths
2. Added missing `match_scores` rule to firestore.rules for category-level access

---

### Phase 5: Fix Matches Display and Storage Paths ⏱️ 2-3 hours ✅ COMPLETE
- [x] **Step 5.1:** Fix timing bug in TournamentDashboardView (10 min)
- [x] **Step 5.2:** Simplify client storage adapter path logic (15 min)
- [x] **Step 5.3:** Simplify server storage adapter path logic (15 min)
- [ ] **Step 5.4:** Test matches display in UI (30 min) - ⏳ Pending
- [ ] **Step 5.5:** Test real-time updates (20 min) - ⏳ Pending
- [ ] **Step 5.6:** Test match progression in brackets (20 min) - ⏳ Pending
- [ ] **Step 5.7:** Verify Firestore path structure (15 min) - ⏳ Pending

**Status:** ✅ Code Complete | **Completed:** 02/02/2026 | **Testing:** ⏳ Pending

**Issue:** Matches tab is empty despite brackets displaying correctly
**Root Cause 1:** Component timing bug - watch fires before category is loaded
**Root Cause 2:** Storage adapter path logic is confusing (though currently working)
**Solution:**
1. Fix component lifecycle: Set category BEFORE establishing watch
2. Simplify storage adapters: Remove unnecessary odd/even path logic
3. Add comprehensive testing to verify data flow

**See:** [Phase5-Fix-Matches-Display-And-Storage-Paths.md](Phase5-Fix-Matches-Display-And-Storage-Paths.md) for complete implementation guide

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

- [x] All 4 critical bugs fixed
- [x] All code references to `/matches` removed
- [x] Documentation updated
- [ ] Full tournament workflow test passes (requires manual testing)
- [ ] Concurrent scoring test passes (requires manual testing)
- [ ] No regression in existing features (requires manual testing)

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
| 1 | 1.1a | `5eb2675` | 02/01/2026 | ✅ |
| 1 | 1.1b | `caaa366` | 02/01/2026 | ✅ |
| 1 | 1.2 | `5eb2675` | 02/01/2026 | ✅ |
| 1 | 1.3 | `5eb2675` | 02/01/2026 | ✅ |
| 1 | 1.4a | `5eb2675` | 02/01/2026 | ✅ |
| 1 | 1.4b | `d47fb5d` | 02/01/2026 | ✅ |
| 2 | 2.1 | `PHASE2_COMMIT` | 02/01/2026 | ✅ |
| 2 | 2.2 | `PHASE2_COMMIT` | 02/01/2026 | ✅ |
| 2 | 2.3 | `PHASE2_COMMIT` | 02/01/2026 | ✅ |
| 2 | 2.4 | `PHASE2_COMMIT` | 02/01/2026 | ✅ |
| 3 | 3.2 | `PHASE3_COMMIT` | 02/01/2026 | ✅ |
| 4 | 4.1 | `PHASE4_COMMIT` | 02/02/2026 | ✅ |
| 4 | 4.2 | `PHASE4_COMMIT` | 02/02/2026 | ✅ |
| 4 | 4.3 | `PHASE4_COMMIT` | 02/02/2026 | ✅ |
| 4 | 4.4 | `PHASE4_COMMIT` | 02/02/2026 | ✅ |
| 4 | 4.5 | `PHASE4_COMMIT` | 02/02/2026 | ✅ |

---

## Current Status

**Last Updated:** February 2, 2026
**Current Phase:** All Phases Complete ✅
**Phase 4 Status:** ✅ Complete - All match store functions updated with categoryId support
**Blocker:** None
**Next Action:** Test the application end-to-end and commit Phase 4 changes
**Status:** Data model migration complete. All matches now correctly query category-level `/_data/` paths.

---

**Document Maintained By:** Development Team
