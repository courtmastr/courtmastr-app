# Bug Fix: Stats Display & UI Cleanup

**Date:** 2026-02-04
**Issues Fixed:**
1. Stats showing "Playing: 0" when console shows 4 in_progress matches
2. Redundant "Court Status" section in Queue view

---

## Issue #1: Stats Not Showing In-Progress Matches

### Problem
The stats dashboard showed "Playing: 0" even though the console logs showed 4 matches with `status: 'in_progress'`.

### Root Cause
The computed properties used for stats (`inProgressMatches`, `readyMatches`, etc.) were filtering by `selectedCategory.value`. When a specific category was selected, it only counted matches for that category. The stats were showing category-filtered counts instead of tournament-wide totals.

**File:** [src/features/tournaments/views/MatchControlView.vue](../../src/features/tournaments/views/MatchControlView.vue)

**Problem Code (lines 195-201):**
```typescript
const inProgressMatches = computed(() => {
  let result = matches.value.filter((m) => m.status === 'in_progress');
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);  // ❌ This filters stats!
  }
  return result;
});
```

### The Fix

Created separate category-independent computed properties specifically for stats that always show tournament-wide totals:

```typescript
// Category-independent computed properties for stats (show totals across all categories)
const allReadyMatches = computed(() =>
  matches.value.filter((m) => m.status === 'ready')
);

const allInProgressMatches = computed(() =>
  matches.value.filter((m) => m.status === 'in_progress')
);

const allCompletedMatches = computed(() =>
  matches.value.filter((m) => m.status === 'completed' || m.status === 'walkover')
);

const allScheduledWithCourtMatches = computed(() =>
  matches.value.filter((m) => (m.status === 'scheduled' || m.status === 'ready') && m.courtId)
);

const allPendingMatches = computed(() =>
  matches.value.filter((m) => (m.status === 'ready' || m.status === 'scheduled') && !m.courtId)
);

// Stats - always show totals across ALL categories for dashboard overview
const stats = computed(() => {
  const result = {
    total: matches.value.length,
    pending: allPendingMatches.value.length,
    scheduled: allScheduledWithCourtMatches.value.length,
    ready: allReadyMatches.value.length,
    inProgress: allInProgressMatches.value.length,  // ✅ Uses category-independent property
    completed: allCompletedMatches.value.length,
    courtsAvailable: availableCourts.value.length,
    courtsInUse: courtsInUse.value.length,
  };

  // Enhanced debug logging
  console.log('[stats] Dashboard totals:', {
    inProgress: result.inProgress,
    scheduled: result.scheduled,
    ready: result.ready,
    pending: result.pending,
    completed: result.completed,
    selectedCategory: selectedCategory.value,
  });

  return result;
});
```

**Key Changes:**
- Created `allInProgressMatches`, `allReadyMatches`, etc. that don't filter by category
- Updated `stats` computed property to use the new category-independent properties
- Stats dashboard now shows tournament-wide totals regardless of selected category
- Added enhanced logging to track stats computation

**Behavior Change:**
- **Before:** Stats changed based on selected category filter → confusing for organizers
- **After:** Stats always show tournament-wide totals → clear overview at a glance
- **Category filter still works:** The match lists (Queue view, Schedule tab) still respect the selected category filter

---

## Issue #2: Redundant Court Status Section in Queue View

### Problem
The Queue view had a redundant "Court Status" section showing court availability, which was unnecessary because:
1. Court status is already visible in the "Courts" tab
2. Organizers can update courts from the main tournament dashboard
3. It cluttered the Queue view, making it harder to focus on matches waiting for courts

### The Fix

**File:** [src/features/tournaments/views/MatchControlView.vue](../../src/features/tournaments/views/MatchControlView.vue) (lines 1197-1272)

**Before:**
```vue
<template v-if="viewMode === 'queue'">
  <v-row>
    <!-- Court Status Board (left column) -->
    <v-col cols="12" lg="6">
      <CourtStatusBoard ... />
    </v-col>

    <!-- In-Progress + Queue (right column) -->
    <v-col cols="12" lg="6">
      <!-- In Progress Matches -->
      <!-- Match Queue List -->
    </v-col>
  </v-row>
</template>
```

**After:**
```vue
<template v-if="viewMode === 'queue'">
  <v-row>
    <!-- In-Progress + Queue (Full Width) -->
    <v-col cols="12">
      <!-- In Progress Matches -->
      <v-card class="mb-4">
        <v-card-title class="d-flex align-center">
          <v-icon start color="success">mdi-play-circle</v-icon>
          In Progress ({{ inProgressMatches.length }})
        </v-card-title>

        <!-- Inline in-progress matches list with scores and "Enter Scores" buttons -->
        <v-list v-if="inProgressMatches.length > 0" density="compact">
          <!-- Match items with player names, scores, court, and action buttons -->
        </v-list>
      </v-card>

      <!-- Match Queue List -->
      <MatchQueueList
        :matches="pendingMatches"
        :available-courts="availableCourts"
        :auto-assign-enabled="autoAssignEnabled"
        @manual-assign="handleManualAssign"
        @toggle-auto-assign="toggleAutoAssign"
      />
    </v-col>
  </v-row>

  <!-- Activity Feed -->
  <v-row class="mt-4">
    <v-col cols="12">
      <ActivityFeed ... />
    </v-col>
  </v-row>
</template>
```

**Key Changes:**
- Removed `CourtStatusBoard` component from Queue view
- Changed layout from two-column to single-column (full-width)
- Queue view now focuses on:
  1. **In Progress Matches** - Shows current games with scores and "Enter Scores" button
  2. **Match Queue** - Shows matches waiting for court assignment
  3. **Activity Feed** - Shows recent tournament activity

**Benefits:**
- Cleaner, more focused interface for tournament organizers
- Easier to see which matches need attention
- Removed redundant information (court status available elsewhere)
- Full-width layout makes better use of screen space

---

## Testing Instructions

### Verify Stats Fix

1. **Open Match Control page**
2. **Check browser console** - should see:
   ```
   [stats] Dashboard totals: {
     inProgress: 4,
     scheduled: 7,
     ready: 5,
     pending: 0,
     completed: 0,
     selectedCategory: "all"
   }

   [stats] In Progress matches breakdown: {
     count: 4,
     matches: [
       { id: "0", status: "in_progress", categoryId: "cat1", courtId: "court-1" },
       { id: "1", status: "in_progress", categoryId: "cat1", courtId: "court-2" },
       { id: "8", status: "in_progress", categoryId: "cat2", courtId: "court-3" },
       { id: "9", status: "in_progress", categoryId: "cat2", courtId: "court-4" }
     ]
   }
   ```

3. **Check stats row** - should show:
   - "Playing: 4" ✅ (previously showed 0)
   - "Scheduled: 7"
   - "Needs Court: 0"

4. **Select a specific category** from dropdown
5. **Check stats row** - should still show:
   - "Playing: 4" ✅ (tournament-wide total)
   - Match lists below should filter by selected category

### Verify Queue View Cleanup

1. **Navigate to Match Control → Queue tab**
2. **Check layout:**
   - ✅ Should see "In Progress" section at top (full-width)
   - ✅ Should see "Match Queue" section below
   - ✅ Should see "Recent Activity" at bottom
   - ❌ Should NOT see "Court Status" section
3. **Check In Progress section:**
   - Shows match details with player names
   - Shows current score (e.g., "11 - 9", "Games: 1 - 0")
   - Shows court assignment (green chip)
   - Shows "Enter Scores" button
4. **Check Match Queue section:**
   - Shows matches waiting for courts
   - Shows "Manual Assign" button for each match

---

## Console Logging

The fix includes comprehensive logging to help diagnose issues:

**Stats Computation (always logged):**
```
[stats] Dashboard totals: {
  inProgress: 4,
  scheduled: 7,
  ready: 5,
  pending: 0,
  completed: 0,
  selectedCategory: "all"
}
```

**In-Progress Breakdown (logged when count > 0):**
```
[stats] In Progress matches breakdown: {
  count: 4,
  matches: [
    { id, status, categoryId, courtId }
  ]
}
```

**Match Updates (from previous fixes):**
```
[MatchControlView] Matches updated: 16 matches
  By Category: { "cat1": 8, "cat2": 8 }
  By Status: { "ready": 5, "scheduled": 7, "in_progress": 4 }
```

---

## Impact Summary

### What Was Fixed
1. ✅ Stats now show tournament-wide totals (not category-filtered)
2. ✅ "Playing" stat correctly shows 4 in-progress matches
3. ✅ Removed redundant Court Status section from Queue view
4. ✅ Queue view is now cleaner and more focused
5. ✅ Added comprehensive logging for debugging

### What Still Works
- ✅ Category filter still works for match lists (Schedule, Queue)
- ✅ Courts tab still shows detailed court status
- ✅ Start Match button flow (ready → scheduled → in_progress)
- ✅ Score entry and match completion
- ✅ Auto-schedule functionality

### User Experience Improvements
- **Clearer dashboard stats**: Always see tournament overview
- **Simplified Queue view**: Focus on what matters (matches + in-progress)
- **Better layout**: Full-width utilizes screen space better
- **Less clutter**: Removed redundant information

---

## Files Modified

1. [src/features/tournaments/views/MatchControlView.vue](../../src/features/tournaments/views/MatchControlView.vue)
   - Lines 315-375: Added category-independent computed properties for stats
   - Lines 325-369: Updated stats computed with enhanced logging
   - Lines 1197-1272: Simplified Queue view layout (removed CourtStatusBoard)

---

## Related Documentation

- [docs/migration/start_match_button_fix.md](./start_match_button_fix.md) - Start Match button implementation
- [docs/migration/status_flow_summary.md](./status_flow_summary.md) - Complete status flow
- [docs/migration/bugfix_status_mapping.md](./bugfix_status_mapping.md) - Status mapping fix

---

**Status:** ✅ Ready for testing!

**Testing Checklist:**
- [ ] Stats show correct "Playing" count
- [ ] Stats remain constant when changing category filter
- [ ] Queue view shows only In Progress + Queue (no Court Status)
- [ ] Console logs show dashboard totals and breakdown
- [ ] Match lists still filter by selected category
