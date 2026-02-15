# Phase 7b: Match Display and Auto-Schedule Fixes

**Status:** ✅ **COMPLETE**
**Priority:** CRITICAL - TBD display and auto-schedule blocking features
**Complexity:** LOW - Simple fixes with clear root causes
**Actual Time:** ~45 minutes
**Created:** 2026-02-02
**Completed:** 2026-02-02

---

## Executive Summary

Phase 7b fixes two critical issues discovered after Phase 6 implementation:

1. **Match Display Issue**: Matches showing "TBD vs TBD" instead of participant names
2. **Auto-Schedule Issue**: Dialog showing "0 matches ready to schedule" despite matches existing

Both issues stem from incorrect data field usage and missing initialization logic.

**Impact:**
- Match lists were unusable (no participant names) ❌
- Auto-scheduling feature was broken ❌
- Tournament organizers couldn't schedule matches ❌

**Solution:**
- 2-line fix in bracketMatchAdapter.ts for participant ID resolution
- 3 small additions in MatchControlView.vue for category pre-selection
- Added comprehensive documentation to prevent regression

---

## Problem Statement

### Issue 1: Matches Display "TBD vs TBD" Instead of Participant Names

**Files Affected:**
- `src/stores/bracketMatchAdapter.ts` lines 90-93
- All views displaying match participants (TournamentDashboardView, MatchControlView, etc.)

**User Impact:**
- Navigate to Matches tab in Tournament Dashboard
- All matches show "TBD vs TBD" instead of player/team names
- Cannot identify which players are in which matches
- Manual scheduling becomes impossible

**Root Cause:**

The `bracketMatchAdapter.ts` was using `participant?.id` to populate `participant1Id` and `participant2Id`:

```typescript
// BUGGY CODE (before fix):
const participant1Id = participant1?.id || bracketsMatch.opponent1?.registrationId || undefined;
const participant2Id = participant2?.id || bracketsMatch.opponent2?.registrationId || undefined;
```

**The Critical Architecture Detail:**

In the brackets-manager/Firestore integration, the `participant` document structure is:

```typescript
{
  id: 1,                              // ← Numeric brackets-manager ID (1, 2, 3, 4...)
  name: "uXypPnObpFxwiBoNCmqV",      // ← ACTUAL registration ID (Firestore doc ID)
  tournament_id: "bOGZRGvHkHSE5pXRdyes"
}
```

**Key Points:**
- `participant.id` = Numeric ID used internally by brackets-manager (1, 2, 3...)
- `participant.name` = Registration ID (Firestore document ID like "uXypPnObpFxwiBoNCmqV")
- The UI lookup functions expect registration IDs, NOT numeric IDs

**Why It Broke:**

1. Adapter returned `participant1Id: 1` (numeric)
2. `getParticipantName(registrationId)` in TournamentDashboardView.vue looked for registration with `id === 1`
3. No registration found with ID "1" (registrations have IDs like "uXypPnObpFxwiBoNCmqV")
4. Function returned "TBD" as fallback

**How Flow Should Work:**

```
brackets-manager participant (id: 1, name: "reg_abc123")
  ↓
bracketMatchAdapter extracts: participant1Id = "reg_abc123" (from .name field)
  ↓
Match object: { participant1Id: "reg_abc123", participant2Id: "reg_def456" }
  ↓
getParticipantName("reg_abc123") finds registration by ID
  ↓
Looks up player data
  ↓
Displays: "John Doe vs Jane Smith"
```

---

### Issue 2: Auto-Schedule Shows "0 Matches Ready to Schedule"

**File Affected:**
- `src/features/tournaments/views/MatchControlView.vue` lines 62-71, 547-559, 773

**User Impact:**
- Tournament organizer clicks "Auto Schedule Matches" button
- Dialog opens with categories visible and checkboxes available
- Message shows "0 matches ready to schedule"
- SCHEDULE button is disabled
- Cannot use auto-scheduling feature

**Root Cause:**

The `selectedCategoryIds` ref is initialized as empty array and never populated when dialog opens:

```typescript
const selectedCategoryIds = ref<string[]>([]); // Line 62 - always starts empty
```

The button directly toggles dialog visibility without initialization:

```vue
<!-- Line 773 - no initialization -->
<v-btn @click="showAutoScheduleDialog = true">Auto Schedule</v-btn>
```

**Why It Breaks:**

The computed property `matchesToScheduleForAuto` (lines 547-559) has this logic:

```typescript
const matchesToScheduleForAuto = computed(() => {
  let result = matches.value.filter(
    (m) => m.status === 'scheduled' && m.participant1Id && m.participant2Id && !m.courtId
  );

  if (selectedCategoryIds.value.length > 0) {
    result = result.filter((m) => selectedCategoryIds.value.includes(m.categoryId));
  } else {
    return []; // ← RETURNS EMPTY if no categories selected!
  }

  return result.sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);
});
```

**The Problem Flow:**

1. User clicks "Auto Schedule" button
2. Dialog opens, `selectedCategoryIds` is still `[]`
3. Checkboxes render but nothing is pre-selected
4. `matchesToScheduleForAuto` returns `[]` because `selectedCategoryIds.value.length === 0`
5. UI shows "0 matches ready to schedule"
6. User must manually check all categories to see matches

---

## Implementation Plan

### Fix 1: Correct Participant ID Resolution

**File:** `src/stores/bracketMatchAdapter.ts`

**Lines to Modify:** 90-93

**Current Code:**
```typescript
const participant1Id = participant1?.id || bracketsMatch.opponent1?.registrationId || undefined;
const participant2Id = participant2?.id || bracketsMatch.opponent2?.registrationId || undefined;
```

**New Code:**
```typescript
// participant.name contains the registration ID (Firestore document ID)
// participant.id is just the numeric brackets-manager ID
const participant1Id = participant1?.name || bracketsMatch.opponent1?.registrationId || undefined;
const participant2Id = participant2?.name || bracketsMatch.opponent2?.registrationId || undefined;
```

**Why This Works:**
- Uses `participant.name` which contains the actual registration ID
- Fallback to `bracketsMatch.opponent1?.registrationId` if participant not found
- `getParticipantName()` can now find registrations and return actual player names

**CRITICAL: Never Change This Back!**

This is the correct implementation. If you see "TBD vs TBD" in the future, the problem is NOT here. Check:
- Registrations are being loaded (`registrationStore.fetchRegistrations`)
- Players are being loaded (`registrationStore.fetchPlayers`)
- The `participants` collection is populated correctly in Firestore
- The `getParticipantName()` function is working correctly

---

### Fix 2: Auto-Select Categories on Dialog Open

**File:** `src/features/tournaments/views/MatchControlView.vue`

#### Change 2a: Add Dialog Initialization Function

**Location:** After line 71 (after `deselectAllCategories` function)

**Add:**
```typescript
// Open auto-schedule dialog with all categories pre-selected
function openAutoScheduleDialog() {
  // Auto-select all categories for better UX
  if (categories.value.length > 0) {
    selectedCategoryIds.value = categories.value.map(c => c.id);
  }
  showAutoScheduleDialog.value = true;
}
```

**Why:**
- Pre-selects all categories before opening dialog
- Provides immediate feedback on match count
- Better UX - no manual category selection needed for common case
- Guard check prevents errors if categories not loaded

#### Change 2b: Update Button Click Handler

**Location:** Line 773

**Current:**
```vue
@click="showAutoScheduleDialog = true"
```

**Replace with:**
```vue
@click="openAutoScheduleDialog"
```

**Why:**
- Calls initialization function instead of directly toggling dialog
- Ensures categories are selected before dialog renders

#### Change 2c: Add State Cleanup on Dialog Close

**Location:** After `openAutoScheduleDialog` function (after Change 2a)

**Add:**
```typescript
// Reset selected categories when dialog closes
watch(showAutoScheduleDialog, (newValue) => {
  if (!newValue) {
    // Dialog closed - reset selection for next time
    selectedCategoryIds.value = [];
  }
});
```

**Why:**
- Cleans up state when dialog closes
- Ensures fresh initialization next time dialog opens
- Prevents stale selections from previous sessions

#### Change 2d: Add Debug Logging (Optional but Recommended)

**Location:** After the dialog close watcher (after Change 2c)

**Add:**
```typescript
// Debug: Log category selection changes (can remove after verification)
watch(selectedCategoryIds, (newValue) => {
  console.log('[Auto-Schedule] Selected category IDs:', newValue);
  console.log('[Auto-Schedule] Matches to schedule:', matchesToScheduleForAuto.value.length);
}, { deep: true });
```

**Why:**
- Provides runtime verification that categories are being selected
- Helps debug if issue reappears
- Can be removed after confirming fix works

---

## Testing Strategy

### Pre-Implementation Verification

Before making changes, verify the issues exist:

1. **Verify TBD Issue:**
   ```bash
   # Open the app
   # Navigate to Tournament Dashboard → Matches tab
   # Confirm: All matches show "TBD vs TBD"
   # Open browser console
   # Check: No errors, but participant names not resolved
   ```

2. **Verify Auto-Schedule Issue:**
   ```bash
   # Navigate to Match Control view
   # Click "Auto Schedule Matches" button
   # Confirm: Dialog shows "0 matches ready to schedule"
   # Confirm: SCHEDULE button is disabled
   # Confirm: Checkboxes are present but unchecked
   ```

### Post-Implementation Testing

After making all changes:

#### Test 1: Participant Names Display Correctly

**Objective:** Verify matches show actual participant names, not "TBD vs TBD"

**Steps:**
1. Refresh browser (Ctrl+R / Cmd+R)
2. Navigate to Tournament Dashboard
3. Click "Matches" tab
4. Observe match list

**Expected Output:**
- Match 1: "Thomas Harris vs Christopher Jones" (actual names)
- Match 2: "David Evans vs Anthony Lopez" (actual names)
- NO matches showing "TBD vs TBD"
- Team names displayed for doubles matches

**Success Criteria:**
- ✅ All matches show actual participant names
- ✅ Singles matches show "FirstName LastName vs FirstName LastName"
- ✅ Doubles matches show team names
- ✅ No "TBD" or "Unknown" text visible

#### Test 2: Auto-Schedule Categories Pre-Selected

**Objective:** Verify categories are auto-selected when dialog opens

**Steps:**
1. Navigate to Match Control view
2. Click "Auto Schedule Matches" button
3. Observe dialog state immediately

**Expected Output:**
- All categories are checked (✓ Men's Singles, ✓ Mixed Doubles)
- Match count shows correct number: "X matches ready to schedule"
- SCHEDULE button is enabled (blue, clickable)
- Console logs show selected category IDs

**Success Criteria:**
- ✅ All categories checked automatically
- ✅ Match count > 0 (if unscheduled matches exist)
- ✅ SCHEDULE button enabled
- ✅ No manual checkbox clicking required

#### Test 3: Category Selection/Deselection

**Objective:** Verify manual category selection still works

**Steps:**
1. Open Auto Schedule dialog (categories pre-selected)
2. Click "Deselect All" button
3. Observe changes
4. Manually check one category
5. Observe changes
6. Click "Select All" button
7. Observe changes

**Expected Output:**
- Step 2: All checkboxes unchecked, "0 matches ready to schedule"
- Step 4: One checkbox checked, match count updates
- Step 6: All checkboxes checked, full match count restored

**Success Criteria:**
- ✅ Deselect All clears all checkboxes
- ✅ Match count updates immediately on selection change
- ✅ Select All checks all checkboxes
- ✅ SCHEDULE button enables/disables correctly

#### Test 4: State Cleanup on Dialog Close

**Objective:** Verify state resets when dialog closes

**Steps:**
1. Open Auto Schedule dialog
2. Click "Deselect All" (or manually deselect some categories)
3. Click "Cancel" to close dialog
4. Re-open Auto Schedule dialog
5. Observe initial state

**Expected Output:**
- Step 5: All categories are checked again (fresh state)
- Match count shows full count
- No memory of previous deselections

**Success Criteria:**
- ✅ Dialog opens with all categories selected each time
- ✅ Previous session selections don't persist
- ✅ Consistent behavior on every open

#### Test 5: Full Auto-Schedule Flow

**Objective:** Verify entire auto-schedule feature works end-to-end

**Steps:**
1. Open Auto Schedule dialog
2. Verify categories pre-selected and match count > 0
3. Set start time (e.g., 04:00 PM)
4. Set match duration (e.g., 20 minutes)
5. Set break between matches (e.g., 5 minutes)
6. Verify courts are available (4 courts shown)
7. Click "SCHEDULE X MATCHES" button
8. Wait for scheduling to complete
9. Close dialog
10. Check Match Control view main list

**Expected Output:**
- Matches assigned to courts (Court 1, Court 2, etc.)
- Matches have scheduled times (04:00 PM, 04:25 PM, etc.)
- Round 1 matches scheduled before Round 2
- Load balanced across available courts
- No scheduling errors in console

**Success Criteria:**
- ✅ All selected matches assigned to courts
- ✅ Times calculated correctly (duration + break)
- ✅ No double-bookings (same court, overlapping time)
- ✅ Matches maintain round order
- ✅ Previously scheduled matches not affected

#### Test 6: Console Verification (If Debug Logging Added)

**Objective:** Verify debug logging provides useful information

**Steps:**
1. Open browser DevTools console
2. Open Auto Schedule dialog
3. Observe console logs
4. Check/uncheck categories
5. Observe console log updates

**Expected Console Output:**
```
[Auto-Schedule] Selected category IDs: ["bOGZRGvHkHSE5pXRdyes", "wX7HzstJXJaSd2jgOGkl"]
[Auto-Schedule] Matches to schedule: 12
[Auto-Schedule] Selected category IDs: ["bOGZRGvHkHSE5pXRdyes"]
[Auto-Schedule] Matches to schedule: 7
```

**Success Criteria:**
- ✅ Logs show category IDs when selection changes
- ✅ Match count updates correctly
- ✅ No errors or warnings
- ✅ Logs provide useful debugging info

---

## Verification Checklist

After implementation and testing, verify:

### Functionality
- [x] Matches show actual participant names (not "TBD vs TBD")
- [x] Singles matches show "FirstName LastName vs FirstName LastName"
- [x] Doubles matches show team names
- [x] Auto-Schedule dialog opens with categories pre-selected
- [x] Match count shows correct number immediately
- [x] Manual category selection/deselection works
- [x] State resets when dialog closes and reopens
- [x] Full auto-schedule flow completes successfully

### Code Quality
- [x] Comments explain why `participant.name` is used (not `.id`)
- [x] Console logs help with debugging (optional, can remove)
- [x] No TypeScript errors in modified files
- [x] No runtime errors in browser console

### Data Integrity
- [x] Participant IDs are registration IDs (not numeric)
- [x] Matches correctly link to registrations
- [x] Player/team name lookups succeed
- [x] Category selections persist during dialog session

### Performance
- [x] Match list loads quickly (< 1 second)
- [x] Auto-Schedule dialog opens instantly
- [x] Category selection is responsive
- [x] No unnecessary re-renders

---

## Architecture Documentation

### CRITICAL: Participant ID Resolution Pattern

**This section is the most important part of this document. Read carefully.**

#### The Participant Document Structure

In Firestore, under `tournaments/{tournamentId}/categories/{categoryId}/participant/`:

```typescript
{
  id: 1,                              // Numeric brackets-manager ID
  name: "uXypPnObpFxwiBoNCmqV",      // REGISTRATION ID (Firestore doc ID)
  tournament_id: "bOGZRGvHkHSE5pXRdyes"
}
```

#### Why This Structure Exists

1. **brackets-manager** requires numeric IDs (1, 2, 3...) for its internal algorithms
2. **CourtMaster** uses Firestore document IDs (UUIDs) for registrations
3. The `participant.name` field bridges these two systems

#### The Correct Pattern

**ALWAYS use `participant.name` when you need the registration ID:**

```typescript
// ✅ CORRECT - Gets registration ID for UI lookup
const registrationId = participant.name;

// ❌ WRONG - Gets numeric brackets-manager ID
const registrationId = participant.id;
```

#### Where This Pattern Applies

1. **bracketMatchAdapter.ts** (lines 90-93):
   ```typescript
   const participant1Id = participant1?.name; // Registration ID
   ```

2. **Any code that needs to:**
   - Display participant names in UI
   - Look up registration data
   - Link matches to players/teams
   - Pass participant identifiers to components

3. **When `participant.id` IS correct:**
   - Calling brackets-manager API functions
   - Seeding algorithms
   - Internal bracket structure operations
   - Never for UI display or registration lookup

#### How to Verify the Pattern

If you're unsure whether to use `.id` or `.name`, ask:

**"Do I need to display this to users or look up registration data?"**
- YES → Use `participant.name` (registration ID)
- NO → Use `participant.id` (numeric ID for algorithms)

#### Common Mistakes to Avoid

**Mistake 1: Using `.id` for UI display**
```typescript
// ❌ WRONG - Will show "TBD vs TBD"
const participant1Id = participant1?.id;

// ✅ CORRECT
const participant1Id = participant1?.name;
```

**Mistake 2: Using `.name` for brackets-manager API calls**
```typescript
// ❌ WRONG - brackets-manager expects numeric IDs
await manager.update.match({
  id: matchId,
  opponent1: { id: participant.name } // String, not number!
});

// ✅ CORRECT
await manager.update.match({
  id: matchId,
  opponent1: { id: participant.id } // Numeric ID
});
```

**Mistake 3: Assuming `.name` contains actual names**
```typescript
// ❌ WRONG - .name is a registration ID, not player name
console.log(`Player: ${participant.name}`); // "Player: uXypPnObpFxwiBoNCmqV"

// ✅ CORRECT - Look up registration, then player
const registration = registrations.find(r => r.id === participant.name);
const player = players.find(p => p.id === registration.playerId);
console.log(`Player: ${player.firstName} ${player.lastName}`);
```

---

## Rollback Plan

If issues arise after deployment:

### Rollback Fix 1 (Participant ID Resolution)

**Only rollback if:** Participant names display correctly but something else breaks (very unlikely)

```bash
# Revert bracketMatchAdapter.ts
git diff src/stores/bracketMatchAdapter.ts
git checkout HEAD~1 -- src/stores/bracketMatchAdapter.ts
```

**Note:** This will bring back "TBD vs TBD" issue. Only do this if there's a critical error.

### Rollback Fix 2 (Auto-Schedule)

**Only rollback if:** Auto-schedule behavior is worse than before

```bash
# Revert MatchControlView.vue
git diff src/features/tournaments/views/MatchControlView.vue
git checkout HEAD~1 -- src/features/tournaments/views/MatchControlView.vue
```

**Note:** This will bring back "0 matches ready to schedule" issue, but manual category selection will still work.

### Partial Rollback (Remove Debug Logging Only)

If debug logging is too verbose:

**File:** `src/features/tournaments/views/MatchControlView.vue`

**Remove:**
```typescript
// Debug: Log category selection changes
watch(selectedCategoryIds, (newValue) => {
  console.log('[Auto-Schedule] Selected category IDs:', newValue);
  console.log('[Auto-Schedule] Matches to schedule:', matchesToScheduleForAuto.value.length);
}, { deep: true });
```

This keeps the fixes but removes console output.

---

## Known Issues and Limitations

### Current Limitations

1. **All Categories Auto-Selected:**
   - Dialog always opens with all categories selected
   - Users must manually deselect if they want subset scheduling
   - Could add "Remember Last Selection" feature in future

2. **No Per-Category Match Count:**
   - Dialog shows total match count
   - Doesn't show how many matches per category
   - Could add "Men's Singles (5), Mixed Doubles (3)" labels

3. **Debug Logging in Production:**
   - If debug logging is kept, it runs in production
   - Minimal performance impact
   - Consider removing or wrapping in `if (import.meta.env.DEV)` check

### Future Improvements

These are NOT part of Phase 7b, but could be addressed later:

1. **Smart Category Selection:**
   - Auto-select only categories with unscheduled matches
   - Gray out categories with no matches to schedule

2. **Persist User Preferences:**
   - Remember which categories user selected last time
   - Use localStorage to persist across sessions

3. **Category-Specific Controls:**
   - Allow different start times per category
   - Support category-specific court assignments

4. **Bulk Operations:**
   - "Schedule All" button (skip dialog)
   - "Clear All Schedules" button with confirmation

---

## Success Criteria

Phase 7b is complete when ALL of the following are true:

### Primary Goals
- ✅ Matches display actual participant names (not "TBD vs TBD")
- ✅ Auto-Schedule dialog shows correct match count on open
- ✅ Categories are pre-selected when dialog opens
- ✅ Manual category selection/deselection works correctly
- ✅ Full auto-schedule flow completes successfully

### Code Quality Goals
- ✅ Comments explain `participant.name` vs `participant.id` usage
- ✅ Architecture documentation prevents future regressions
- ✅ No TypeScript errors in modified files
- ✅ Console logs are helpful (or removed if not needed)

### Data Integrity Goals
- ✅ Participant IDs are registration IDs throughout the system
- ✅ Player/team name lookups succeed consistently
- ✅ No data corruption from incorrect ID usage

### Documentation Goals
- ✅ This phase document is complete
- ✅ Architecture section explains the participant ID pattern
- ✅ Testing procedures are documented
- ✅ Common mistakes are documented to prevent regression

---

## Appendix A: File Locations

### Files Modified in This Phase

| File | Path | Lines Changed | Purpose |
|------|------|---------------|---------|
| bracketMatchAdapter.ts | src/stores/ | 90-93 | Fix participant ID resolution |
| MatchControlView.vue | src/features/tournaments/views/ | 62-71, 773, +watchers | Add category auto-selection |

### Related Files (Not Modified)

| File | Path | Purpose |
|------|------|---------|
| TournamentDashboardView.vue | src/features/tournaments/views/ | Contains `getParticipantName()` lookup function |
| matches.ts | src/stores/ | Match store (uses adapted matches) |
| useBracketGenerator.ts | src/composables/ | Creates participant documents (sets .name field) |

---

## Appendix B: Participant Data Flow

### Data Flow Diagram

```
1. User Registration
   ↓
   Registration Document Created
   id: "uXypPnObpFxwiBoNCmqV"
   playerId: "player_123"
   categoryId: "bOGZRGvHkHSE5pXRdyes"

2. Bracket Generation (useBracketGenerator.ts)
   ↓
   Participant Document Created
   id: 1                           ← brackets-manager numeric ID
   name: "uXypPnObpFxwiBoNCmqV"   ← registration ID stored in .name
   tournament_id: "bOGZRGvHkHSE5pXRdyes"

3. brackets-manager Creates Match
   ↓
   Match Document Created
   id: 0
   opponent1: { id: 1 }            ← references participant.id
   opponent2: { id: 2 }

4. bracketMatchAdapter Reads Match
   ↓
   Looks up participant by numeric ID: participant.id === 1
   ↓
   Extracts registration ID: participant.name = "uXypPnObpFxwiBoNCmqV"
   ↓
   Creates Match object
   participant1Id: "uXypPnObpFxwiBoNCmqV"  ← registration ID for UI
   participant2Id: "def456xyz..."

5. UI Component (TournamentDashboardView)
   ↓
   Calls getParticipantName("uXypPnObpFxwiBoNCmqV")
   ↓
   Finds registration by ID
   ↓
   Finds player by playerId
   ↓
   Displays: "Thomas Harris vs Christopher Jones"
```

### Why This Architecture?

**Problem:** brackets-manager requires numeric IDs, but Firestore uses document ID strings

**Solution:** Store registration ID in `participant.name` field to bridge the gap

**Benefits:**
- brackets-manager algorithms work with numeric IDs
- UI can look up actual registration data
- No need to maintain separate mapping tables
- Single source of truth in Firestore

**Trade-offs:**
- Slightly confusing that `.name` doesn't contain actual names
- Requires clear documentation (this document!)
- Easy to make mistakes if pattern not understood

---

## Appendix C: Console Log Reference

### Expected Console Logs (If Debug Logging Added)

**On Dialog Open:**
```
[Auto-Schedule] Selected category IDs: ["bOGZRGvHkHSE5pXRdyes", "wX7HzstJXJaSd2jgOGkl"]
[Auto-Schedule] Matches to schedule: 12
```

**On Category Deselect:**
```
[Auto-Schedule] Selected category IDs: ["bOGZRGvHkHSE5pXRdyes"]
[Auto-Schedule] Matches to schedule: 7
```

**On Deselect All:**
```
[Auto-Schedule] Selected category IDs: []
[Auto-Schedule] Matches to schedule: 0
```

**On Dialog Close:**
```
[Auto-Schedule] Selected category IDs: []
[Auto-Schedule] Matches to schedule: 0
```

### Error Logs to Watch For

**Participant Lookup Failure:**
```
⚠️ [bracketMatchAdapter] Participant not found for opponent ID: 1
⚠️ [getParticipantName] Registration not found: undefined
```
*Cause:* Participants collection not populated or corrupted

**Category Loading Issue:**
```
⚠️ [MatchControlView] Categories not loaded when dialog opened
⚠️ [Auto-Schedule] Selected category IDs: []
```
*Cause:* Timing issue - dialog opened before categories fetched

**No Matches to Schedule:**
```
ℹ️ [Auto-Schedule] Matches to schedule: 0
```
*Cause:* All matches already scheduled, or no matches exist (valid state)

---

## Support and References

### Related Documentation

- [DATA_MODEL_ARCHITECTURE.md](./DATA_MODEL_ARCHITECTURE.md) - Complete architecture overview
- [Phase5-Fix-Matches-Display-And-Storage-Paths.md](./Phase5-Fix-Matches-Display-And-Storage-Paths.md) - Previous fixes
- [Phase6-Multi-Category-Subscription.md](./Phase6-Multi-Category-Subscription.md) - Multi-category support
- [Phase7-Auto-Schedule-And-Scoring-Fixes.md](./Phase7-Auto-Schedule-And-Scoring-Fixes.md) - Original Phase 7 plan

### External Resources

- [brackets-manager Documentation](https://github.com/Drarig29/brackets-manager.js)
- [Vuetify Checkbox Documentation](https://vuetifyjs.com/en/components/checkboxes/)
- [Vue Watchers Documentation](https://vuejs.org/guide/essentials/watchers.html)

### Questions and Issues

If you encounter issues during implementation or maintenance:

1. **Check participant ID usage** - Are you using `.name` or `.id`?
2. **Verify data exists** - Are participants and registrations loaded?
3. **Check console logs** - Any errors or warnings?
4. **Review this document's Appendix B** - Understand the data flow
5. **Test with actual data** - Create a tournament, add registrations, generate bracket

---

**Document Version:** 1.0
**Last Updated:** 2026-02-02
**Author:** Migration Team
**Review Status:** Ready for Any AI Coder

---

## For AI Coders: Quick Start Guide

If you're implementing or maintaining this code, here's what you need to know:

### The Golden Rule

**ALWAYS use `participant.name` when displaying matches to users or looking up registrations.**

### The 3 Critical Lines of Code

1. **bracketMatchAdapter.ts line 92-93:**
   ```typescript
   const participant1Id = participant1?.name; // ← MUST be .name, not .id
   ```

2. **MatchControlView.vue line 73-76 (after changes):**
   ```typescript
   function openAutoScheduleDialog() {
     if (categories.value.length > 0) {
       selectedCategoryIds.value = categories.value.map(c => c.id);
     }
     showAutoScheduleDialog.value = true;
   }
   ```

3. **MatchControlView.vue line 773:**
   ```vue
   @click="openAutoScheduleDialog" <!-- NOT showAutoScheduleDialog = true -->
   ```

### If You See "TBD vs TBD"

1. Check line 92-93 of bracketMatchAdapter.ts - must use `.name`
2. Check that registrations are being loaded
3. Check that participants collection exists in Firestore
4. DO NOT use `.id` - that's the wrong field!

### If Auto-Schedule Shows "0 Matches"

1. Check that `openAutoScheduleDialog()` function exists and is called
2. Check that categories are loaded (`categories.value.length > 0`)
3. Check that matches have `status === 'scheduled'` and no `courtId`
4. Check console logs for category selection

### Testing Your Changes

Run all tests in "Testing Strategy" section. Most important:
1. Match names display correctly (not "TBD")
2. Auto-schedule shows match count on open
3. Can schedule matches successfully

### Need Help?

Read:
1. Appendix B: Participant Data Flow
2. Architecture Documentation section
3. Common Mistakes to Avoid

---

**End of Document**
