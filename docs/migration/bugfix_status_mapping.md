# Bug Fix: Brackets-Manager Status Mapping Issues

**Date:** 2026-02-04
**Issue:** Auto-schedule shows "0 matches ready to schedule" despite matches being visible in UI
**Root Cause:** Incorrect status mapping between brackets-manager (numeric) and legacy system (string)

---

## The Problem

### Observed Symptoms
1. Match Control page shows "0 Needs Court"
2. MATCHES tab shows matches exist with "ready" and "scheduled" status
3. BRACKETS tab shows brackets are generated correctly
4. Auto Schedule dialog shows "0 matches ready to schedule" even with categories selected

### Root Cause Analysis

The `convertBracketsStatus()` function in [bracketMatchAdapter.ts:128-141](../../src/stores/bracketMatchAdapter.ts:128-141) had **incorrect status mapping**:

**BEFORE (Incorrect):**
```typescript
function convertBracketsStatus(bracketsStatus: number): MatchStatus {
    switch (bracketsStatus) {
        case 0:
        case 1:
            return 'scheduled';  // ❌ WRONG - led to confusion
        case 2:
            return 'ready';      // ❌ WRONG - didn't match brackets-manager intent
        case 3:
            return 'in_progress';
        case 4:
            return 'completed';
    }
}
```

**Why This Was Wrong:**

brackets-manager uses these status codes:
- `0` (Locked) = Match exists but no participants assigned yet (TBD)
- `1` (Waiting) = Waiting for previous round to complete
- `2` (Ready) = Both participants present, ready to play
- `3` (Running) = Currently playing
- `4` (Completed) = Match finished

**BUT** brackets-manager doesn't track court assignments! That's separate in our system.

In our legacy system:
- `'ready'` = Has participants, not yet assigned to a court
- `'scheduled'` = Assigned to a court/time (tracked in match_scores collection)
- `'in_progress'` = Currently playing
- `'completed'` = Finished

The old mapping was treating brackets status 0 and 1 as "scheduled", but they should be "ready" (waiting for court assignment).

---

## The Fix

### 1. Corrected Status Mapping

**File:** [src/stores/bracketMatchAdapter.ts](../../src/stores/bracketMatchAdapter.ts)

```typescript
function convertBracketsStatus(bracketsStatus: number): MatchStatus {
    switch (bracketsStatus) {
        case 0:
        case 1:
        case 2:
            return 'ready';          // ✅ All unscheduled matches need court assignment
        case 3:
            return 'in_progress';    // Currently playing
        case 4:
            return 'completed';      // Finished
        default:
            return 'ready';
    }
}
```

**Key Insight:** All brackets-manager statuses 0, 1, 2 represent matches that haven't been assigned to a court yet. Court assignment is a separate operation tracked in the `match_scores` collection with status `'scheduled'`.

### 2. Added Comprehensive Diagnostic Logging

**File:** [src/features/tournaments/views/MatchControlView.vue](../../src/features/tournaments/views/MatchControlView.vue)

Added logging to:
- Watch matches array changes
- Track filter operations in `matchesToScheduleForAuto`
- Show category filtering details
- Display status distribution

**File:** [src/stores/bracketMatchAdapter.ts](../../src/stores/bracketMatchAdapter.ts)

Added logging to:
- Show each match being adapted
- Display status conversion (numeric → string)
- Track skipped matches

---

## How to Verify the Fix

### 1. Check Browser Console

After opening the Match Control page, you should see console output like:

```
[MatchControlView] Matches updated {
  count: 16,
  byCategory: { "cat123": 8, "cat456": 8 },
  byStatus: { "ready": 16 },
  sampleMatches: [...]
}

[matchesToScheduleForAuto] Starting filter {
  totalMatches: 16,
  selectedCategories: ["cat123", "cat456"],
  ...
}

[matchesToScheduleForAuto] After status filter {
  count: 16,
  statuses: ["ready", "ready", ...]
}

[matchesToScheduleForAuto] Final result {
  count: 16,
  matches: [...]
}
```

### 2. Expected Behavior After Fix

✅ **Match Control Stats:**
- "Needs Court" should show the correct count of unscheduled matches
- "Scheduled" should show 0 (no matches assigned to courts yet)
- "Ready" should show matches with participants present

✅ **Auto Schedule Dialog:**
- Should display "Schedule N Matches" where N > 0
- Button should be enabled when categories are selected
- Should successfully schedule matches when clicked

✅ **After Auto-Scheduling:**
- Scheduled matches should have `status = 'scheduled'` (from match_scores)
- They should have `courtId` and `scheduledTime` set
- They should appear in the "Scheduled" section of Match Control

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Bracket Generation                                            │
│    • useBracketGenerator creates matches in Firestore           │
│    • Path: tournaments/{id}/categories/{catId}/match            │
│    • Status: 0, 1, or 2 (brackets-manager numeric)              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Match Store Loading                                           │
│    • subscribeAllMatches() listens to all categories            │
│    • fetchMatches() retrieves data from Firestore               │
│    • Calls adaptBracketsMatchToLegacyMatch() for each match     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. Status Adaptation (THE FIX)                                   │
│    • bracketsStatus 0, 1, 2 → legacyStatus 'ready'              │
│    • bracketsStatus 3 → legacyStatus 'in_progress'              │
│    • bracketsStatus 4 → legacyStatus 'completed'                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. match_scores Merge                                            │
│    • If match_scores/{matchId} exists:                          │
│      - Override status with match_scores.status                 │
│      - Add courtId, scheduledTime, scores                       │
│    • Newly generated matches won't have match_scores yet        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. UI Filtering                                                  │
│    • matchesToScheduleForAuto filters:                          │
│      - status === 'scheduled' OR status === 'ready'             │
│      - !courtId (not yet assigned)                              │
│      - categoryId in selectedCategoryIds                        │
│    • Should now find all newly generated matches!               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. Auto-Schedule                                                 │
│    • useMatchScheduler assigns matches to courts                │
│    • Writes to match_scores with:                               │
│      - status: 'scheduled'                                      │
│      - courtId: assigned court                                  │
│      - scheduledTime: assigned time                             │
│    • Next time matches load, match_scores overrides status      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts

### Two-Collection Pattern

Our system uses two collections for match data:

1. **`/match`** (brackets-manager format)
   - Single source of truth for bracket structure
   - Contains: opponents, round, bracket position, numeric status (0-4)
   - Updated by brackets-manager during score submission

2. **`/match_scores`** (operational data)
   - Contains: court assignments, scheduled times, string status, scores
   - Written by auto-scheduler and match control UI
   - **Always takes precedence** over /match data when present

### Status Precedence Rule

```typescript
// In matches.ts:161
if (scoreData.status) {
  adapted.status = scoreData.status;  // ✅ match_scores overrides brackets status
}
```

This means:
- Newly generated matches use adapted brackets-manager status → `'ready'`
- After scheduling, match_scores.status → `'scheduled'` (overrides 'ready')
- During play, match_scores.status → `'in_progress'` (overrides brackets status)
- After completion, both show `'completed'`

---

## Testing Checklist

### Manual Testing

- [x] Fix status mapping in bracketMatchAdapter.ts
- [x] Add diagnostic logging to MatchControlView.vue
- [x] Add diagnostic logging to bracketMatchAdapter.ts
- [ ] **Run the application and check console output**
- [ ] Open Match Control page
- [ ] Check browser console for diagnostic logs
- [ ] Verify "Needs Court" stat shows correct count
- [ ] Open Auto Schedule dialog
- [ ] Verify "Schedule N Matches" shows correct count (N > 0)
- [ ] Select categories and start time
- [ ] Click "Schedule N Matches" button
- [ ] Verify matches are scheduled successfully
- [ ] Check Firestore for match_scores documents with status='scheduled'

### Automated Testing

Run the full tournament test suite:
```bash
node full-tournament-test.cjs
```

Expected results:
- ✅ Phase 3: Verify Data (Total Matches > 0)
- ✅ Phase 7: Auto Schedule (No timeout, button found and clicked)
- ✅ Phase 8: Verify Queue (Matches visible)

---

## Rollback Plan

If this fix causes issues:

1. **Revert bracketMatchAdapter.ts** to previous status mapping:
   ```typescript
   case 0:
   case 1:
       return 'scheduled';
   case 2:
       return 'ready';
   ```

2. **Remove diagnostic logging** from MatchControlView.vue and bracketMatchAdapter.ts

3. **Git revert:**
   ```bash
   git diff HEAD src/stores/bracketMatchAdapter.ts > status_mapping_fix.patch
   git checkout HEAD -- src/stores/bracketMatchAdapter.ts
   git checkout HEAD -- src/features/tournaments/views/MatchControlView.vue
   ```

---

## Next Steps

1. **Test the fix** by running the application
2. **Check console logs** to verify matches are loading correctly
3. **Try auto-scheduling** to ensure it works end-to-end
4. **Run automated tests** to confirm all phases pass
5. **Remove diagnostic logging** once verified working (keep only critical logs)

---

## Related Files

- [src/stores/bracketMatchAdapter.ts](../../src/stores/bracketMatchAdapter.ts) - Status mapping fix
- [src/features/tournaments/views/MatchControlView.vue](../../src/features/tournaments/views/MatchControlView.vue) - Diagnostic logging
- [src/composables/useMatchScheduler.ts](../../src/composables/useMatchScheduler.ts) - Auto-schedule logic (already has logging)
- [src/stores/matches.ts](../../src/stores/matches.ts) - Match store with status precedence logic
- [docs/migration/bugfix_1.md](./bugfix_1.md) - Original bug report and collection path fixes

---

**Status:** ✅ Ready for testing
