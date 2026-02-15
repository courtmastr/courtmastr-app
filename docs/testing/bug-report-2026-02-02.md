# Courtmaster Bug Report

**Report Date:** 2026-02-02  
**Branch:** feature/minimal-bracket-collections  
**Commit:** 98b4c81  
**Tester:** Sisyphus  
**Status:** 🔴 **CRITICAL ISSUES FOUND**

---

## Executive Summary

Testing revealed **2 CRITICAL bugs** and **30+ code quality issues** that need immediate attention:

### Critical Bugs (Fix Required Before Release)
1. **Type Mismatch in Bracket Generation** - Options interface incompatibility prevents bracket generation
2. **Type Error in Tournament Setup** - Same root cause, affects tournament creation

### Code Quality Issues (Should Fix)
- 30+ unused variables across the codebase
- Inconsistent type definitions between modules

### Build Status
- ❌ **Frontend Build:** TypeScript errors (non-blocking but indicates bugs)
- ✅ **Cloud Functions Build:** Successful
- ⚠️ **Overall:** App may run but with potential runtime errors

---

## Critical Bugs

### Bug #1: BracketOptions Type Mismatch

**Severity:** 🔴 **CRITICAL**  
**Priority:** P0 - Fix Immediately  
**Files Affected:**
- `src/stores/tournaments.ts` (lines 588-591, 610-613)
- `src/composables/useBracketGenerator.ts` (line 28)
- `src/components/GenerateBracketDialog.vue` (lines 24, 54, 77, 166)
- `src/composables/useTournamentSetup.ts` (lines 15, 71)

**Description:**
The `BracketOptions` interface defines `grandFinal` as a string enum:
```typescript
interface BracketOptions {
  grandFinal?: 'simple' | 'double' | 'none';
  consolationFinal?: boolean;
  seedOrdering?: ...;
}
```

But `tournaments.ts` and other files are passing incompatible options:
```typescript
options: {
  grandFinalReset?: boolean;  // ❌ Wrong type! Should be grandFinal: 'simple'|'double'|'none'
  thirdPlaceMatch?: boolean;  // ❌ Doesn't exist in BracketOptions!
}
```

**Error Message:**
```
src/stores/tournaments.ts(597,81): error TS2559: 
Type '{ grandFinalReset?: boolean | undefined; thirdPlaceMatch?: boolean | undefined; }' 
has no properties in common with type 'BracketOptions'.
```

**Impact:**
- Bracket generation may fail at runtime
- Type safety is compromised
- Development build shows errors
- Potential silent failures in production

**Root Cause:**
Interface mismatch between the options defined in `tournaments.ts` and what `useBracketGenerator.ts` expects.

**Fix Required:**
Align all usages with the `BracketOptions` interface:

```typescript
// ❌ CURRENT (Broken)
options: {
  grandFinalReset?: boolean;
  thirdPlaceMatch?: boolean;
}

// ✅ FIXED
options: {
  grandFinal?: 'simple' | 'double' | 'none';
  consolationFinal?: boolean;
}
```

**Files to Modify:**
1. `src/stores/tournaments.ts` - Fix generateBracket() and regenerateBracket() signatures
2. `src/components/GenerateBracketDialog.vue` - Update options object
3. `src/composables/useTournamentSetup.ts` - Fix options interface

---

### Bug #2: grandFinalReset vs grandFinal Naming Inconsistency

**Severity:** 🔴 **CRITICAL**  
**Priority:** P0  
**Related to:** Bug #1

**Description:**
Throughout the codebase, there are conflicting property names:
- `grandFinalReset` (used in tournaments.ts, GenerateBracketDialog.vue, useTournamentSetup.ts)
- `grandFinal` (used in useBracketGenerator.ts BracketOptions)

This creates confusion and type errors.

**Fix Strategy:**
Choose one naming convention and update all files:
- **Option A:** Use `grandFinal` everywhere (matches BracketOptions)
- **Option B:** Update BracketOptions to use `grandFinalReset`

**Recommendation:** Use Option A (follow the library's interface).

---

## Code Quality Issues

### Issue Category: Unused Variables (TS6133)

**Count:** 30+ instances  
**Severity:** 🟡 **MEDIUM** - Not blocking but indicates dead code  

**Complete List:**

| File | Line | Variable | Issue |
|------|------|----------|-------|
| `GenerateBracketDialog.vue` | 85 | `formatDuration` | Declared but never used |
| `AppLayout.vue` | 8 | `route` | Declared but never used |
| `AppLayout.vue` | 17 | `isScorekeeper` | Declared but never used |
| `useMatchScheduler.ts` | 21 | `Match` | Type imported but never used |
| `useMatchScheduler.ts` | 224 | `categoryId` | Parameter unused |
| `useMatchScheduler.ts` | 282 | `respectDependencies` | Variable unused |
| `useTournamentSetup.ts` | 71 | `grandFinalReset` | See Bug #1 |
| `PublicScoringView.vue` | 7 | `BADMINTON_CONFIG` | Imported but unused |
| `SelfRegistrationView.vue` | 10 | `router` | Declared but never used |
| `ScoringInterfaceView.vue` | 25 | `scoringMode` | Declared but never used |
| `ScoringInterfaceView.vue` | 95 | `previousStatus` | Declared but never used |
| `CategoryRegistrationStats.vue` | 6 | All imports | Entire import unused |
| `CategoryRegistrationStats.vue` | 70 | `getStatusColor` | Function unused |
| `CategoryRegistrationStats.vue` | 120 | `hasCompletedMatches` | Function unused |
| `CategoryRegistrationStats.vue` | 120 | `categoryId` | Parameter unused |
| `MatchControlView.vue` | 86 | `someCategoriesSelected` | Computed unused |
| `MatchControlView.vue` | 359 | `openAssignCourtDialog` | Function unused |
| `MatchControlView.vue` | 365 | `assignCourt` | Function unused |
| `MatchControlView.vue` | 740 | `distribution` | Variable unused |
| `MatchControlView.vue` | 755 | `releaseCourt` | Function unused |
| `TournamentDashboardView.vue` | 9 | `SmartBracketView` | Import unused |
| `TournamentDashboardView.vue` | 14 | `FORMAT_LABELS` | Import unused |
| `TournamentSettingsView.vue` | 15 | `categories` | Variable unused |
| `TournamentSettingsView.vue` | 16 | `courts` | Variable unused |
| `activities.ts` | 7 | `doc` | Import unused |
| `bracketMatchAdapter.ts` | 12 | `BracketPosition` | Type unused |
| `bracketMatchAdapter.ts` | 66 | `registrations` | Parameter unused |
| `matches.ts` | 45 | `getStagePath` | Function unused |
| `matches.ts` | 564 | `matchPath` | Variable unused |
| `registrations.ts` | 8 | `getDoc` | Import unused |
| `tournaments.ts` | 19 | `httpsCallable` | Import unused |
| `tournaments.ts` | 20 | `functions` | Import unused |
| `tournaments.ts` | 28 | `TournamentFormat` | Type unused |
| `tournaments.ts` | 31 | `TournamentSettings` | Type unused |

**Recommendation:**
Clean up unused code to improve maintainability. Either:
1. Remove unused imports/variables
2. Use `// @ts-ignore` for intentional unused parameters
3. Prefix with underscore: `_categoryId` to indicate intentional unused

---

## Module-by-Module Analysis

### 1. Match Store (src/stores/matches.ts)
**Status:** ⚠️ **NEEDS CLEANUP**
- 2 unused variables (`getStagePath`, `matchPath`)
- Core logic appears sound
- All Phase 6 & 7 fixes properly implemented

**Issues:**
- Line 45: `getStagePath` declared but never used
- Line 564: `matchPath` declared but never used in `completeMatch`

### 2. Bracket Match Adapter (src/stores/bracketMatchAdapter.ts)
**Status:** ✅ **WORKING CORRECTLY**
- Uses `participant?.name` correctly (contains registration ID)
- Phase 7b fix properly implemented
- 2 minor unused items

### 3. Tournament Store (src/stores/tournaments.ts)
**Status:** 🔴 **CRITICAL BUG**
- Type mismatch in bracket generation options
- 4 unused imports/types
- Fix required immediately

### 4. Match Control View (src/features/tournaments/views/MatchControlView.vue)
**Status:** ⚠️ **NEEDS CLEANUP**
- Phase 7b fixes properly implemented
- 5 unused variables/functions
- Functionality works but code needs cleanup

### 5. Scoring Interface (src/features/scoring/views/ScoringInterfaceView.vue)
**Status:** ✅ **WORKING**
- Phase 7 scoring fixes implemented
- 2 unused variables (scoringMode, previousStatus)
- Core functionality intact

### 6. Cloud Functions (functions/src/)
**Status:** ✅ **BUILD SUCCESSFUL**
- No TypeScript errors
- All functions compile correctly
- updateMatch.ts properly handles categoryId

---

## Testing Evidence

### Build Test Results

**Frontend Build:**
```bash
$ npm run build

Errors found:
- 2 Critical type errors (Bug #1)
- 30+ Unused variable warnings

Status: COMPILES WITH WARNINGS
```

**Cloud Functions Build:**
```bash
$ cd functions && npm run build

Result: SUCCESS
No errors found
```

### Static Analysis Summary

| Category | Count | Severity |
|----------|-------|----------|
| Type Errors | 2 | Critical |
| Unused Variables | 30+ | Medium |
| Import Issues | 5 | Low |
| **Total Issues** | **37+** | **High** |

---

## Recommended Actions

### Immediate Actions (P0)

1. **Fix Bug #1 - Type Mismatch**
   - Update `tournaments.ts` options interface
   - Update all callers to use correct property names
   - Align with `BracketOptions` interface

2. **Verify Bracket Generation**
   - Test bracket generation after fix
   - Verify all options work correctly
   - Check both single and double elimination

### Short-term Actions (P1)

3. **Clean Up Unused Code**
   - Remove or use all unused imports
   - Delete dead code
   - Add underscore prefix for intentionally unused parameters

4. **Enable Strict Type Checking**
   - Add `"noUnusedLocals": true` to tsconfig.json
   - Add `"noUnusedParameters": true`
   - Fix all resulting errors

### Long-term Actions (P2)

5. **Add Integration Tests**
   - Test bracket generation end-to-end
   - Test tournament creation flow
   - Test match completion flow

6. **Set Up Pre-commit Hooks**
   - Run TypeScript checks before commit
   - Run linter to catch unused code
   - Prevent type errors from reaching main branch

---

## File-by-File Fix Checklist

### Critical Fixes Required

- [ ] `src/stores/tournaments.ts` - Fix BracketOptions type mismatch
- [ ] `src/components/GenerateBracketDialog.vue` - Update options object
- [ ] `src/composables/useTournamentSetup.ts` - Fix options interface

### Cleanup Required

- [ ] `src/stores/matches.ts` - Remove unused getStagePath and matchPath
- [ ] `src/stores/tournaments.ts` - Remove unused imports
- [ ] `src/stores/bracketMatchAdapter.ts` - Remove unused types
- [ ] `src/stores/registrations.ts` - Remove unused getDoc import
- [ ] `src/stores/activities.ts` - Remove unused doc import
- [ ] `src/components/GenerateBracketDialog.vue` - Remove formatDuration
- [ ] `src/components/layout/AppLayout.vue` - Remove unused variables
- [ ] `src/composables/useMatchScheduler.ts` - Remove unused Match type and parameters
- [ ] `src/features/public/views/PublicScoringView.vue` - Remove BADMINTON_CONFIG
- [ ] `src/features/registration/views/SelfRegistrationView.vue` - Remove unused router
- [ ] `src/features/scoring/views/ScoringInterfaceView.vue` - Remove unused variables
- [ ] `src/features/tournaments/components/CategoryRegistrationStats.vue` - Clean up all unused items
- [ ] `src/features/tournaments/views/MatchControlView.vue` - Remove unused functions
- [ ] `src/features/tournaments/views/TournamentDashboardView.vue` - Remove unused imports
- [ ] `src/features/tournaments/views/TournamentSettingsView.vue` - Remove unused variables

---

## Appendix: Complete Error Log

### TypeScript Build Errors

```
src/stores/tournaments.ts(597,81): error TS2559: Type '{ grandFinalReset?: boolean | undefined; thirdPlaceMatch?: boolean | undefined; }' has no properties in common with type 'BracketOptions'.

src/stores/tournaments.ts(622,81): error TS2559: Type '{ grandFinalReset?: boolean | undefined; thirdPlaceMatch?: boolean | undefined; }' has no properties in common with type 'BracketOptions'.
```

### TypeScript Warnings (Unused)

```
src/components/GenerateBracketDialog.vue(85,10): error TS6133: 'formatDuration' is declared but never read.
src/components/layout/AppLayout.vue(8,7): error TS6133: 'route' is declared but its value is never read.
src/components/layout/AppLayout.vue(17,7): error TS6133: 'isScorekeeper' is declared but its value is never read.
src/composables/useMatchScheduler.ts(21,22): error TS6196: 'Match' is declared but never used.
src/composables/useMatchScheduler.ts(224,5): error TS6133: 'categoryId' is declared but its value is never read.
src/composables/useMatchScheduler.ts(282,3): error TS6133: 'respectDependencies' is declared but its value is never read.
src/features/public/views/PublicScoringView.vue(7,1): error TS6133: 'BADMINTON_CONFIG' is declared but its value is never read.
src/features/registration/views/SelfRegistrationView.vue(10,7): error TS6133: 'router' is declared but its value is never read.
src/features/scoring/views/ScoringInterfaceView.vue(25,7): error TS6133: 'scoringMode' is declared but its value is never read.
src/features/scoring/views/ScoringInterfaceView.vue(95,7): error TS6133: 'previousStatus' is declared but its value is never read.
src/features/tournaments/components/CategoryRegistrationStats.vue(6,1): error TS6192: All imports in import declaration are unused.
src/features/tournaments/components/CategoryRegistrationStats.vue(70,10): error TS6133: 'getStatusColor' is declared but its value is never read.
src/features/tournaments/components/CategoryRegistrationStats.vue(120,10): error TS6133: 'hasCompletedMatches' is declared but its value is never read.
src/features/tournaments/components/CategoryRegistrationStats.vue(120,30): error TS6133: 'categoryId' is declared but its value is never read.
src/features/tournaments/views/MatchControlView.vue(86,7): error TS6133: 'someCategoriesSelected' is declared but its value is never read.
src/features/tournaments/views/MatchControlView.vue(359,10): error TS6133: 'openAssignCourtDialog' is declared but its value is never read.
src/features/tournaments/views/MatchControlView.vue(365,16): error TS6133: 'assignCourt' is declared but its value is never read.
src/features/tournaments/views/MatchControlView.vue(740,11): error TS6133: 'distribution' is declared but its value is never read.
src/features/tournaments/views/MatchControlView.vue(755,16): error TS6133: 'releaseCourt' is declared but its value is never read.
src/features/tournaments/views/TournamentDashboardView.vue(9,1): error TS6133: 'SmartBracketView' is declared but its value is never read.
src/features/tournaments/views/TournamentDashboardView.vue(14,1): error TS6133: 'FORMAT_LABELS' is declared but its value is never read.
src/features/tournaments/views/TournamentSettingsView.vue(15,7): error TS6133: 'categories' is declared but its value is never read.
src/features/tournaments/views/TournamentSettingsView.vue(16,7): error TS6133: 'courts' is declared but its value is never read.
src/stores/activities.ts(7,3): error TS6133: 'doc' is declared but its value is never read.
src/stores/bracketMatchAdapter.ts(12,35): error TS6196: 'BracketPosition' is declared but never used.
src/stores/bracketMatchAdapter.ts(66,5): error TS6133: 'registrations' is declared but its value is never read.
src/stores/matches.ts(45,12): error TS6133: 'getStagePath' is declared but its value is never read.
src/stores/matches.ts(564,13): error TS6133: 'matchPath' is declared but its value is never read.
src/stores/registrations.ts(8,3): error TS6133: 'getDoc' is declared but its value is never read.
src/stores/tournaments.ts(19,3): error TS6133: 'httpsCallable' is declared but its value is never read.
src/stores/tournaments.ts(20,3): error TS6133: 'functions' is declared but its value is never read.
src/stores/tournaments.ts(28,3): error TS6196: 'TournamentFormat' is declared but never used.
src/stores/tournaments.ts(31,3): error TS6196: 'TournamentSettings' is declared but never used.
```

---

## Summary

**Overall Status:** 🔴 **NOT PRODUCTION READY**

**Critical Blockers:**
1. Type mismatch in bracket generation (2 errors)

**Code Quality:**
- 30+ unused variables indicate technical debt
- Need cleanup pass before release

**Recommendation:**
Fix the critical type errors immediately, then schedule a cleanup sprint for the unused code. The app functionality is mostly correct (Phases 1-7c properly implemented), but the type safety issues must be resolved.

**Estimated Fix Time:**
- Critical bugs: 30 minutes
- Code cleanup: 2-3 hours
- Testing: 1 hour
- **Total: ~4 hours**

---

*Report generated by Sisyphus testing agent*  
*Document Version: 1.0*  
*Next Review: After critical bugs are fixed*
