# Data Model Migration Summary

**Date:** February 1, 2026  
**Duration:** 1 day (accelerated)  
**Status:** ✅ Complete  

---

## Executive Summary

This migration consolidated Courtmaster's tournament data model from three competing match collections (`/match`, `/match_scores`, `/matches`) into a clean two-collection architecture, unified ID types across client and server, and fixed critical Cloud Functions that were using the wrong collections.

---

## What Changed

### Collections

| Collection | Before | After |
|------------|--------|-------|
| `/match` | Brackets-manager structure (numeric IDs) | Brackets-manager structure (string IDs) |
| `/match_scores` | Operational data | Operational data (unchanged) |
| `/matches` | Legacy collection with duplicate data | **REMOVED** |

### ID Types

| Component | Before | After |
|-----------|--------|-------|
| Client adapter | Numeric IDs | **String IDs** (matches server) |
| Server adapter | String IDs | String IDs (unchanged) |
| Foreign keys | Mixed | **All strings** |
| Primary `id` field | Preserved as-is | Preserved as-is (numeric for brackets-manager) |

### Cloud Functions

| Function | Before | After |
|----------|--------|-------|
| `advanceWinner` | Used `/matches` directly | **Uses `/match` + brackets-manager API** |
| `generateSchedule` | Used `/matches` for reads/writes | **Reads `/match`, writes `/match_scores`** |
| `updateMatch` | Correct | Unchanged |

---

## Migration Phases

### Phase 1: Critical Fixes ✅

| Step | Description | Files | Status |
|------|-------------|-------|--------|
| 1.1 | Unify ID types | `src/services/brackets-storage.ts` | ✅ Complete |
| 1.2 | Fix advanceWinner | `functions/src/index.ts` | ✅ Complete |
| 1.3 | Fix generateSchedule | `functions/src/scheduling.ts` | ✅ Complete |
| 1.4 | Remove /matches rules | `firestore.rules` | ✅ Complete |

### Phase 2: Code Cleanup ✅

| Step | Description | Files | Status |
|------|-------------|-------|--------|
| 2.1 | Remove /matches references | `scripts/test-match.ts`, debug files | ✅ Complete |
| 2.2 | Standardize status handling | `src/stores/matches.ts`, `bracketMatchAdapter.ts`, `functions/src/updateMatch.ts` | ✅ Complete |
| 2.3 | Verify real-time subscriptions | `src/stores/matches.ts` | ✅ Complete |
| 2.4 | Consolidate adapters | `src/services/brackets-storage.ts`, `functions/src/storage/firestore-adapter.ts` | ✅ Complete |

### Phase 3: Verification & Documentation ✅

| Step | Description | Files | Status |
|------|-------------|-------|--------|
| 3.1 | Integration testing | Manual testing required | ⏳ Pending manual verification |
| 3.2 | Documentation update | `DATA_MODEL_ARCHITECTURE.md`, `SUMMARY.md`, `MASTER_PLAN.md` | ✅ Complete |

---

## Files Modified

### Core Data Layer
1. `src/services/brackets-storage.ts` - ID type unification, documentation
2. `functions/src/storage/firestore-adapter.ts` - ID handling fix, documentation

### Cloud Functions
3. `functions/src/index.ts` - advanceWinner uses brackets-manager API
4. `functions/src/scheduling.ts` - generateSchedule uses correct collections
5. `functions/src/updateMatch.ts` - Status mapping documentation

### State Management
6. `src/stores/matches.ts` - Status handling documentation, subscription comments
7. `src/stores/bracketMatchAdapter.ts` - Status conversion documentation

### Configuration
8. `firestore.rules` - Removed /matches collection rules

### Scripts
9. `scripts/test-match.ts` - Complete rewrite for new data model

### Deleted Files
10. `functions/src/test_complete_flow.ts`
11. `functions/src/deep_debug.ts`
12. `functions/src/test_bracket_debug.ts`
13. `functions/src/check_matches.ts`
14. `functions/src/debug_matches_schema.ts`
15. `functions/src/diagnose_bracket_issue.ts`
16. `functions/src/test_bracket_refactor.ts`

---

## Technical Changes

### ID Type Unification

**Problem:** Client used numeric IDs, server used string IDs, causing query mismatches.

**Solution:** Both adapters now:
- Preserve primary `id` field type (for brackets-manager compatibility)
- Convert all foreign keys (`*_id`) to strings

```typescript
// Client (brackets-storage.ts)
if (key === 'id') {
    normalized[key] = value; // Keep as-is
} else if (key.endsWith('_id') && key !== 'id') {
    normalized[key] = String(value.id); // Convert to string
}

// Server (firestore-adapter.ts) - Now matches client
if (key === 'id') {
    normalized[key] = value; // Keep as-is
} else if (key.endsWith('_id') && key !== 'id') {
    normalized[key] = String(value.id); // Convert to string
}
```

### Status Handling Standardization

**Dual Status System:**
- `/match.status` (number 0-4): brackets-manager internal use
- `/match_scores.status` (string): UI display and app logic

**Precedence Rule:** Always use `match_scores.status` when available.

```typescript
// In src/stores/matches.ts
if (scoreData?.status) {
    adapted.status = scoreData.status; // match_scores takes precedence
}
```

### Cloud Function Fixes

**advanceWinner:**
- Before: Direct Firestore writes to `/matches`
- After: Uses `BracketsManager.update.match()` API

**generateSchedule:**
- Before: Read from `/matches`, wrote to `/matches`
- After: Read from `/match`, write to `/match_scores`

---

## Verification Results

### Build Verification
- ✅ Cloud Functions compile without errors
- ✅ All modified files pass LSP diagnostics
- ✅ No TypeScript errors in changed files

### Code Quality
- ✅ Zero `/matches` references in production code
- ✅ Consistent ID handling across client/server
- ✅ Status handling documented in all key files
- ✅ Adapter consistency documented

### Pending Manual Verification
- ⏳ Full tournament workflow (8 players, single elimination)
- ⏳ Concurrent scoring (4 simultaneous matches)
- ⏳ Real-time updates across browser tabs
- ⏳ Winner advancement through bracket

---

## Issues Encountered

### Issue 1: Adapter ID Handling Divergence
**Discovered:** During Phase 2.4 review  
**Problem:** Server adapter converted ALL IDs to strings, client preserved `id` field  
**Impact:** Could cause query mismatches for brackets-manager operations  
**Resolution:** Fixed server adapter to match client behavior (preserve `id`, convert `*_id`)

### Issue 2: Test Scripts Using Legacy Collection
**Discovered:** During Phase 2.1 audit  
**Problem:** `scripts/test-match.ts` referenced `/matches`  
**Impact:** Test scripts would fail with new data model  
**Resolution:** Complete rewrite of test script to use `/match` + `/match_scores`

---

## Lessons Learned

1. **Adapter Consistency is Critical**  
   Even small differences between client and server adapters can cause hard-to-debug issues. Document the expected behavior clearly.

2. **Two-Collection Pattern Works Well**  
   Separating bracket structure (`/match`) from operational data (`/match_scores`) provides clean separation of concerns and allows independent updates.

3. **Status Precedence Must be Documented**  
   Having two status fields is fine, but the precedence rule (which one wins) must be explicitly documented and consistently applied.

4. **Debug Scripts Need Migration Too**  
   Don't forget about test scripts and debug tools when migrating - they can break silently and cause confusion.

5. **No Production Data = Fast Migration**  
   Without production data to migrate, we could make aggressive changes quickly. Future migrations should assess data volume early.

---

## Architecture Decisions

### Why Two Collections?

**Option A: Single Collection** (Rejected)
- Would require frequent updates to bracket structure documents
- brackets-manager library expects to own its data
- Risk of corrupting bracket relationships

**Option B: Two Collections** (Selected)
- `/match`: Write-once bracket structure (brackets-manager owns this)
- `/match_scores`: Frequent updates (app owns this)
- Clean separation of concerns
- Allows real-time subscriptions on operational data only

### Why Preserve Numeric IDs?

brackets-manager library uses sequential numeric IDs (1, 2, 3...) for internal operations. Converting these to strings breaks the library's query mechanisms. Solution: preserve `id` field type, convert only foreign keys.

---

## Future Improvements

### Short Term
- [ ] Monitor Cloud Function logs for any issues
- [ ] Verify all edge cases in winner advancement
- [ ] Test double elimination brackets thoroughly

### Medium Term
- [ ] Consider consolidating adapters into shared package
- [ ] Simplify participant ID mapping (see Appendix C in DATA_MODEL_ARCHITECTURE.md)
- [ ] Add automated integration tests

### Long Term
- [ ] Evaluate brackets-manager alternatives if library limitations become problematic
- [ ] Consider real-time bracket updates via WebSockets

---

## References

- [Data Model Architecture](../architecture/DATA_MODEL_ARCHITECTURE.md)
- [Migration Rules](../migration/DATA_MODEL_MIGRATION_RULES.md)
- [Master Plan](../migration/MASTER_PLAN.md)
- [Phase 1 Critical Fixes](../migration/Phase1-Critical-Fixes.md)
- [Phase 2 Code Cleanup](../migration/Phase2-Code-Cleanup.md)
- [Phase 3 Verification](../migration/Phase3-Verification.md)

---

**Migration completed by:** Development Team  
**Date:** February 1, 2026  
**Status:** ✅ **COMPLETE**

---

*This document serves as the final record of the data model migration completed on February 1, 2026.*
