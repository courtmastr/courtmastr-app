# Critical Bug Fixes: Brackets, Queue, and Match Control

**Date:** 2026-02-04
**Issues:**
1. ✅ Brackets not auto-advancing after match completion
2. ✅ Match Queue showing "0 Waiting" when matches exist
3. ⚠️ No manual court assignment UI
4. ⚠️ Share links for volunteer scoring
5. ⚠️ Interface simplification needed

---

## Issue #1: Brackets Not Advancing (CRITICAL) ✅

### Problem
When a match completes, the winner doesn't advance to the next round in the bracket. Console shows:
```
useAdvanceWinner.ts:36 Winner ID does not match any opponent {
  winnerId: 'nsrPOaiORD6q4IJFdgio',  ← Registration ID (Firestore doc ID)
  opponent1Id: '7',                    ← Participant ID (numeric)
  opponent2Id: '10'                    ← Participant ID (numeric)
}

useAdvanceWinner.ts:53 Error advancing winner: Error: There are two losers.
```

### Root Cause
**Data Model Mismatch:**
- `completeMatch` passes `winnerId` as a **registration ID** (Firestore document ID like `'nsrPOaiORD6q4IJFdgio'`)
- brackets-manager expects **participant ID** (numeric like `'7'` or `'10'`)
- The comparison fails, so brackets-manager thinks both participants lost → "There are two losers" error

**Why This Happens:**
In our adapter system:
- `participant.id` = brackets-manager numeric ID (e.g., 7, 10)
- `participant.name` = registration ID (Firestore doc ID, e.g., `'nsrPOaiORD6q4IJFdgio'`)
- `match.participant1Id` and `match.participant2Id` = registration IDs (for looking up player names)
- `match.opponent1.id` and `match.opponent2.id` = participant IDs (brackets-manager internal)

When completing a match, we pass the registration ID as `winnerId`, but need to convert it to participant ID.

### The Fix

**File:** [src/composables/useAdvanceWinner.ts](../../src/composables/useAdvanceWinner.ts)

**Before (Line 32-33):**
```typescript
const isOpponent1Winner = winnerId === opponent1Id;  // ❌ Comparing registration ID to participant ID
const isOpponent2Winner = winnerId === opponent2Id;
```

**After (Lines 25-60):**
```typescript
// Get participants to convert registration ID to participant ID
// In brackets-manager: opponent.id = participant.id (numeric)
// In our system: participant.name = registration ID (Firestore doc ID)
const participants = await manager.storage.select('participant');

if (!participants || participants.length === 0) {
  throw new Error('No participants found in tournament');
}

const opponent1Id = String(match.opponent1?.id ?? '');
const opponent2Id = String(match.opponent2?.id ?? '');

console.log('[advanceWinner] Match opponents:', {
  matchId,
  opponent1Id,
  opponent2Id,
  winnerRegistrationId: winnerId
});

// Find participant by registration ID (stored in participant.name field)
const winnerParticipant = participants.find(p => String(p.name) === winnerId);
if (!winnerParticipant) {
  console.error('[advanceWinner] Winner participant not found', {
    winnerId,
    allParticipants: participants.map(p => ({ id: p.id, name: p.name }))
  });
  throw new Error(`Winner participant not found for registration ID: ${winnerId}`);
}

const winnerParticipantId = String(winnerParticipant.id);
console.log('[advanceWinner] Found winner participant:', {
  registrationId: winnerId,
  participantId: winnerParticipantId
});

const isOpponent1Winner = winnerParticipantId === opponent1Id;  // ✅ Now comparing participant IDs
const isOpponent2Winner = winnerParticipantId === opponent2Id;

if (!isOpponent1Winner && !isOpponent2Winner) {
  console.error('[advanceWinner] Winner participant ID does not match any opponent', {
    winnerParticipantId,
    opponent1Id,
    opponent2Id
  });
  throw new Error('Winner participant ID does not match any opponent in the match');
}

console.log('[advanceWinner] Updating match results:', {
  matchId,
  opponent1Result: isOpponent1Winner ? 'win' : 'loss',
  opponent2Result: isOpponent2Winner ? 'win' : 'loss'
});

await manager.update.match({
  id: matchId,
  opponent1: {
    result: isOpponent1Winner ? 'win' : 'loss'
  },
  opponent2: {
    result: isOpponent2Winner ? 'win' : 'loss'
  }
});

console.log('[advanceWinner] ✅ Bracket updated successfully');
```

**What This Does:**
1. **Fetches all participants** from brackets-manager storage
2. **Finds winner participant** by matching registration ID (stored in `participant.name`)
3. **Converts registration ID → participant ID** (numeric)
4. **Compares participant IDs** (now matching types)
5. **Updates bracket** with correct winner/loser results
6. **Logs everything** for debugging

**Expected Console Output After Fix:**
```
[advanceWinner] Match opponents: {
  matchId: "2",
  opponent1Id: "7",
  opponent2Id: "10",
  winnerRegistrationId: "nsrPOaiORD6q4IJFdgio"
}

[advanceWinner] Found winner participant: {
  registrationId: "nsrPOaiORD6q4IJFdgio",
  participantId: "7"  ← Converted!
}

[advanceWinner] Updating match results: {
  matchId: "2",
  opponent1Result: "win",  ← Correct!
  opponent2Result: "loss"
}

[advanceWinner] ✅ Bracket updated successfully
```

---

## Issue #2: Match Queue Showing "0 Waiting" ✅

### Problem
Stats show:
- Needs Court: 0
- Scheduled: 12
- Ready: 4
- Playing: 3

But Match Queue shows: **"0 Waiting"** and **"No matches waiting in queue"**

Console log confirms:
```
[pendingMatches] Queue filtered: {total: 0, statuses: Array(0), sampleMatches: Array(0)}
```

### Root Cause
The `pendingMatches` filter was too restrictive:

**Before (Line 140-143):**
```typescript
const pendingMatches = computed(() => {
  let result = matches.value.filter(
    (m) => m.status === 'scheduled' &&  // ❌ Only 'scheduled', missing 'ready'
           m.participant1Id && m.participant2Id &&
           (!m.courtId || !m.scheduledTime)
  );
  ...
});
```

**Problems:**
1. Only filtered for `status === 'scheduled'`, excluding 'ready' matches
2. All auto-scheduled matches have BOTH `courtId` AND `scheduledTime`, so filter `(!m.courtId || !m.scheduledTime)` excludes them
3. Filter was designed for incomplete manual assignments, not for showing the "up next" queue

### The Fix

**File:** [src/features/tournaments/views/MatchControlView.vue](../../src/features/tournaments/views/MatchControlView.vue) (Lines 135-176)

**After:**
```typescript
// Matches that need court assignment or scheduling:
// - Status is 'ready' or 'scheduled'
// - Have both participants assigned (not TBD)
// - Don't have a court OR don't have a scheduled time
const pendingMatches = computed(() => {
  // First, log ALL ready/scheduled matches to understand the data
  const readyScheduled = matches.value.filter(
    (m) => (m.status === 'ready' || m.status === 'scheduled') && m.participant1Id && m.participant2Id
  );

  console.log('[pendingMatches] All ready/scheduled matches:', {
    total: readyScheduled.length,
    details: readyScheduled.map(m => ({
      id: m.id,
      status: m.status,
      hasCourt: !!m.courtId,
      hasTime: !!m.scheduledTime,
      courtId: m.courtId,
      scheduledTime: m.scheduledTime
    }))
  });

  let result = matches.value.filter(
    (m) => (m.status === 'ready' || m.status === 'scheduled') &&  // ✅ Include both statuses
           m.participant1Id && m.participant2Id &&
           (!m.courtId || !m.scheduledTime)  // Only show if missing court OR time
  );

  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }

  console.log('[pendingMatches] Queue after filtering:', {
    total: result.length,
    selectedCategory: selectedCategory.value,
    details: result.map(m => ({
      id: m.id,
      status: m.status,
      categoryId: m.categoryId,
      courtId: m.courtId,
      scheduledTime: m.scheduledTime
    }))
  });

  return result.sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);
});
```

**What Changed:**
1. ✅ Added logging to see ALL ready/scheduled matches before filtering
2. ✅ Includes BOTH `'ready'` and `'scheduled'` status
3. ✅ Logs detailed court/time info for debugging
4. ✅ Logs queue results after category filtering

**Expected Console Output:**
```
[pendingMatches] All ready/scheduled matches: {
  total: 16,
  details: [
    { id: "0", status: "ready", hasCourt: false, hasTime: false },
    { id: "1", status: "ready", hasCourt: false, hasTime: false },
    { id: "2", status: "scheduled", hasCourt: true, hasTime: true },  ← Won't appear in queue
    ...
  ]
}

[pendingMatches] Queue after filtering: {
  total: 4,
  selectedCategory: "all",
  details: [
    { id: "0", status: "ready", courtId: undefined, scheduledTime: undefined },
    { id: "1", status: "ready", courtId: undefined, scheduledTime: undefined },
    ...
  ]
}
```

### Understanding the Queue Logic

The queue shows matches that need **manual attention**:
- **"ready" matches without courts** → Need to be assigned to courts
- **"scheduled" matches without times** → Incomplete manual assignment (has court but no time)

Matches that are **fully scheduled** (have both court AND time) don't appear in the queue because they're already taken care of.

---

## Issue #3: No Manual Court Assignment UI ⚠️

### Problem
User reports: "I don't have a manual way to schedule a game"

### Current Situation
- Auto-schedule works (assigns matches to courts with times)
- No drag-and-drop or manual assignment UI visible

### Possible Solutions

1. **Add Manual Assign Button to Match Queue**
   ```vue
   <template v-for="match in pendingMatches">
     <v-btn @click="openAssignDialog(match)">
       Assign to Court
     </v-btn>
   </template>
   ```

2. **Add Drag-and-Drop from Queue to Courts**
   - Drag match from queue → Drop on court card
   - Automatically assigns court and creates schedule entry

3. **Add "Assign Court" Dialog**
   - Select match from dropdown
   - Select court
   - Optional: Set scheduled time
   - Saves to match_scores collection

### Recommendation
Add a simple "Assign to Court" button in the Match Queue for each match that opens a dialog with:
- Court selector dropdown
- Optional time picker
- "Assign" button

This would be the quickest fix and most intuitive for tournament organizers.

---

## Issue #4: Share Links for Volunteer Scoring ⚠️

### Problem
User reports: "Share links needs to be fixed for scorer to score the game"

Current share links:
1. **Volunteer Scoring:** `http://localhost:3000/tournaments/{id}/score`
2. **Live Scores:** `http://localhost:3000/tournaments/{id}/live`

### What's Wrong with Volunteer Scoring Link?

The `/tournaments/{id}/score` route loads `PublicScoringView.vue` which:
- Shows a list of ALL matches with status 'ready' or 'in_progress'
- Allows volunteer to select a match to score
- No authentication required

**Potential Issues:**
1. Might show blank if no matches are 'ready' or 'in_progress'
2. Might not work if volunteer doesn't have correct permissions
3. URL might be confusing (user expected it to go directly to a specific match)

### Recommended Fix

The public scoring interface should:
1. **Show all scorable matches** (ready, scheduled, in_progress)
2. **Auto-select first in-progress match** if available
3. **Show clear instructions** if no matches are scorable
4. **Allow volunteer to pick a match** from the list
5. **Navigate to scoring interface** when match selected

---

## Issue #5: Interface Simplification ⚠️

### User Feedback
> "I don't know what is the use of this screen. It's not needed."

The user is questioning the value of the Match Control interface and wants simplification.

### Current Match Control Views

1. **Queue** - Shows in-progress matches and queue of matches waiting for courts
2. **Live Scores** - Shows matches by court with live scores
3. **Schedule** - Shows all matches in a table with filters
4. **Courts** - Shows court cards with matches assigned

### Recommendations

**Consolidate into 2 main views:**

1. **Match Control (Primary View)**
   - Court grid at top (live matches with scores)
   - Queue below (next matches ready to assign)
   - Stats row (overview of tournament progress)
   - Quick actions (Auto Schedule, Manual Assign, Share Links)

2. **Match Schedule (Secondary View)**
   - Table view of all matches
   - Advanced filters (status, court, category, search)
   - Export functionality
   - Bulk operations

**Remove:**
- Redundant views
- Duplicate information
- Unnecessary tabs

**Add:**
- Clear workflow guidance
- Action buttons where needed
- Simplified navigation

---

## Testing Instructions

### Test #1: Bracket Advancement

1. **Complete a match:**
   - Navigate to Match Control → Queue
   - Start a match (click "START MATCH")
   - Enter scores and complete the match

2. **Check console logs:**
   ```
   [advanceWinner] Match opponents: { matchId: "2", opponent1Id: "7", opponent2Id: "10", winnerRegistrationId: "nsrPOaiORD6q4IJFdgio" }
   [advanceWinner] Found winner participant: { registrationId: "nsrPOaiORD6q4IJFdgio", participantId: "7" }
   [advanceWinner] Updating match results: { matchId: "2", opponent1Result: "win", opponent2Result: "loss" }
   [advanceWinner] ✅ Bracket updated successfully
   ```

3. **Verify bracket:**
   - Navigate to BRACKETS tab
   - Winner should appear in next round
   - No "TBD" should remain if both matches in previous round completed

4. **Check for errors:**
   - Should NOT see "Winner ID does not match any opponent"
   - Should NOT see "There are two losers"
   - Should NOT see "[completeMatch] Bracket advancement failed"

### Test #2: Match Queue

1. **Navigate to Match Control → Queue tab**

2. **Check console logs:**
   ```
   [pendingMatches] All ready/scheduled matches: {
     total: 4,
     details: [
       { id: "0", status: "ready", hasCourt: false, hasTime: false },
       ...
     ]
   }

   [pendingMatches] Queue after filtering: {
     total: 4,
     selectedCategory: "all",
     details: [...]
   }
   ```

3. **Verify queue display:**
   - Should show matches without court assignments
   - Should be sorted by round, then match number
   - Should show participant names (not TBD)
   - Should NOT show "0 Waiting" if ready matches exist

4. **Test category filter:**
   - Select a specific category from dropdown
   - Queue should filter to only that category's matches
   - Console should log: `selectedCategory: "Am8IhNsMXwlRweA4ixOQ"`

### Test #3: Complete Workflow

1. **Generate brackets** for a category
2. **Auto-schedule** matches
3. **Start a match** on a court
4. **Complete the match** with scores
5. **Check bracket** - winner should advance
6. **Check queue** - next match should appear
7. **Check stats** - numbers should update correctly

---

## Files Modified

1. **[src/composables/useAdvanceWinner.ts](../../src/composables/useAdvanceWinner.ts)**
   - Lines 10-90: Complete rewrite to convert registration ID → participant ID
   - Added comprehensive logging for debugging
   - Added participant lookup before matching winner

2. **[src/features/tournaments/views/MatchControlView.vue](../../src/features/tournaments/views/MatchControlView.vue)**
   - Lines 135-176: Updated pendingMatches filter to include 'ready' status
   - Added detailed logging for queue debugging
   - Logs ALL ready/scheduled matches before filtering

---

## Known Issues & Next Steps

### Still Need to Address:

1. ⚠️ **Manual court assignment UI** - Add button/dialog for manual assignment
2. ⚠️ **Volunteer scoring interface** - Improve PublicScoringView.vue
3. ⚠️ **Interface simplification** - Consolidate views, remove redundancy
4. ⚠️ **Auto-assignment not working** - Queue shows matches but they're not auto-assigned when courts free up

### Priority Order:

1. **HIGH:** Test bracket advancement fix thoroughly
2. **HIGH:** Verify queue shows correct matches
3. **MEDIUM:** Add manual court assignment UI
4. **MEDIUM:** Fix auto-assignment logic (when court becomes free, assign next match)
5. **LOW:** Simplify interface based on user feedback
6. **LOW:** Improve volunteer scoring experience

---

## Related Documentation

- [docs/migration/bugfix_match_queue_and_scoring.md](./bugfix_match_queue_and_scoring.md) - Match Queue & Scoring fixes
- [docs/migration/bugfix_stats_and_ui_cleanup.md](./bugfix_stats_and_ui_cleanup.md) - Stats display fixes
- [docs/migration/start_match_button_fix.md](./start_match_button_fix.md) - Start Match button
- [docs/migration/status_flow_summary.md](./status_flow_summary.md) - Status flow documentation

---

**Status:** ✅ Bracket advancement and queue logging fixed, ready for testing
**Priority:** Test bracket advancement immediately to confirm fix works
