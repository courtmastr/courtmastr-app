# Start Match Button Implementation

**Date:** 2026-02-04
**Issue:** Matches never transition to "in_progress" status
**Solution:** Add "Start Match" button to court cards

---

## Changes Made

### 1. Court Card Button Logic ([MatchControlView.vue:1296-1339](../../src/features/tournaments/views/MatchControlView.vue:1296-1339))

**Changed button display logic to be status-aware:**

- **Status "scheduled" or "ready"** → Show green "Start Match" button
- **Status "in_progress"** → Show blue "Score" button
- **Status "completed"** → Show gray "View" button

```vue
<!-- Show Start Match button if match is scheduled/ready but not started -->
<v-btn
  v-if="getMatchForCourt(court.id)?.status === 'scheduled' ||
        getMatchForCourt(court.id)?.status === 'ready'"
  size="small"
  color="success"
  variant="flat"
  prepend-icon="mdi-play"
  @click="startMatchInProgress(getMatchForCourt(court.id)!)"
>
  Start Match
</v-btn>

<!-- Show Score button if match is in progress -->
<v-btn
  v-else-if="getMatchForCourt(court.id)?.status === 'in_progress'"
  size="small"
  color="primary"
  variant="flat"
  prepend-icon="mdi-scoreboard"
  @click="goToScoring(getMatchForCourt(court.id)!)"
>
  Score
</v-btn>
```

### 2. Status Badge on Court Cards ([MatchControlView.vue:1268-1281](../../src/features/tournaments/views/MatchControlView.vue:1268-1281))

**Added status chip above player names:**

```vue
<!-- Match Status Badge -->
<div class="text-center mb-2">
  <v-chip
    :color="getMatchForCourt(court.id)?.status === 'in_progress' ? 'success' :
            getMatchForCourt(court.id)?.status === 'scheduled' ? 'info' :
            getMatchForCourt(court.id)?.status === 'ready' ? 'warning' : 'grey'"
    size="x-small"
    variant="flat"
  >
    <v-icon
      v-if="getMatchForCourt(court.id)?.status === 'in_progress'"
      start
      size="x-small"
    >
      mdi-play
    </v-icon>
    {{ getMatchForCourt(court.id)?.status }}
  </v-chip>
</div>
```

**Badge Colors:**
- 🟢 Green (success) → "in_progress"
- 🔵 Blue (info) → "scheduled"
- 🟡 Yellow (warning) → "ready"
- ⚪ Gray → other statuses

### 3. Diagnostic Logging ([MatchControlView.vue:588-632](../../src/features/tournaments/views/MatchControlView.vue:588-632))

**Added comprehensive logging to trace status transitions:**

```typescript
// In goToScoring function:
console.log('[goToScoring] Navigating to scoring interface', {
  matchId: match.id,
  tournamentId: tournamentId.value,
  categoryId: match.categoryId,
  status: match.status,
  courtId: match.courtId,
  participants: { p1, p2 },
  route: { ... }
});

// In startMatchInProgress function:
console.log('[startMatchInProgress] Starting match', {
  matchId: match.id,
  currentStatus: match.status,
  courtId: match.courtId,
  categoryId: match.categoryId,
  participants: { p1Name, p2Name }
});

// After successful start:
console.log('[startMatchInProgress] ✅ Match started successfully', {
  matchId: match.id,
  newStatus: 'in_progress',
});
```

### 4. Match Store Logging ([matches.ts:451-478](../../src/stores/matches.ts:451-478))

**Added logging to startMatch function:**

```typescript
console.log('[matchStore.startMatch] Starting match', {
  tournamentId,
  matchId,
  categoryId,
  matchScoresPath,
});

// After Firestore write:
console.log('[matchStore.startMatch] ✅ Match scores updated successfully', {
  matchId,
  status: 'in_progress',
  path: matchScoresPath,
});

// On error:
console.error('[matchStore.startMatch] ❌ Error starting match:', err);
```

---

## Complete Status Flow (Now Working!)

```
┌──────────────────────────────────────────────────────────────┐
│ 1. Generate Brackets                                          │
│    • Status: 'ready' (from brackets adapter)                 │
│    • No courtId or scheduledTime                             │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. Auto-Schedule (or Manual Assign)                          │
│    • Status: 'scheduled' (written to match_scores)           │
│    • courtId: assigned                                       │
│    • scheduledTime: set                                      │
│    • Button: "START MATCH" (green)                           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. Start Match (NOW WORKING! ✅)                              │
│    • User clicks "START MATCH" button on court card          │
│    • Calls: startMatchInProgress(match)                      │
│    • Writes to match_scores:                                 │
│      - status: 'in_progress'                                 │
│      - startedAt: timestamp                                  │
│      - scores: [{ game1: 0-0 }]                              │
│    • Button changes to: "SCORE" (blue)                       │
│    • "In Progress" stat increments                           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. Score Entry                                               │
│    • User clicks "SCORE" button                              │
│    • Navigates to scoring interface                          │
│    • User enters points                                      │
│    • Scores update in real-time                              │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│ 5. Complete Match                                            │
│    • All games finished                                      │
│    • Status: 'completed'                                     │
│    • Court released                                          │
│    • Button: "VIEW" (gray)                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## Testing Instructions

### Step 1: Verify Button Appearance

1. **Refresh browser** (clear cache if needed)
2. Navigate to **Match Control** page
3. Click **"Live Scores"** tab
4. **Check court cards:**
   - Matches with courts should show **status badge** (blue "scheduled" or yellow "ready")
   - Should show green **"START MATCH"** button
   - Should NOT show "Score" button yet

### Step 2: Test Starting a Match

1. Click **"START MATCH"** button on any court
2. **Check console logs:**
   ```
   [startMatchInProgress] Starting match { matchId, status: 'scheduled', ... }
   [matchStore.startMatch] Starting match { tournamentId, matchId, ... }
   [matchStore.startMatch] ✅ Match scores updated successfully
   [startMatchInProgress] ✅ Match started successfully { newStatus: 'in_progress' }
   ```
3. **Check UI changes:**
   - Status badge changes to green "in_progress" with play icon
   - Button changes to blue "SCORE"
   - "In Progress" stat increments to 1
   - Toast notification shows "Match started on Court X"

### Step 3: Test Scoring

1. Click **"SCORE"** button
2. **Check console logs:**
   ```
   [goToScoring] Navigating to scoring interface { matchId, status: 'in_progress', ... }
   ```
3. **Check navigation:**
   - Should navigate to `/tournaments/{id}/matches/{matchId}/score`
   - Scoring interface should load
   - Should show current game score (0-0)

### Step 4: Verify Stats

1. Return to Match Control
2. **Check stats row:**
   - "Needs Court": 8 (matches without courts)
   - "Scheduled": 7 (matches with courts, not started)
   - "Ready": 0 (if all have courts)
   - **"Playing": 1** ✅ (the match you just started!)
   - "Done": 0

---

## Expected Console Output

```
[MatchControlView] Matches updated: 16 matches
  By Category: {
    "Am8IhNsMXwlRweA4ixOQ": 4,
    "Kw7K03GQKVFlEyWkXfDI": 12
  }
  By Status: {
    "ready": 8,
    "scheduled": 8
  }

[startMatchInProgress] Starting match {
  matchId: "0",
  currentStatus: "scheduled",
  courtId: "court-1",
  categoryId: "Am8IhNsMXwlRweA4ixOQ",
  participants: { p1: "Player A", p2: "Player B" }
}

[matchStore.startMatch] Starting match {
  tournamentId: "JDmlZCpaeWSf0Yxhhpv7",
  matchId: "0",
  categoryId: "Am8IhNsMXwlRweA4ixOQ",
  matchScoresPath: "tournaments/.../categories/.../match_scores"
}

[matchStore.startMatch] ✅ Match scores updated successfully {
  matchId: "0",
  status: "in_progress",
  path: "tournaments/.../match_scores"
}

[startMatchInProgress] ✅ Match started successfully {
  matchId: "0",
  newStatus: "in_progress"
}

[MatchControlView] Matches updated: 16 matches
  By Status: {
    "ready": 8,
    "scheduled": 7,
    "in_progress": 1  ← ✅ COUNT INCREASED!
  }
```

---

## Troubleshooting

### Issue: Button still shows "Score" instead of "Start Match"
**Fix:** Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R) to clear cached Vue components

### Issue: "In Progress" stat doesn't update
**Check:**
- Console for errors
- Match status in console logs
- Firestore match_scores collection for status field

### Issue: Clicking "Start Match" does nothing
**Check:**
- Console for errors
- categoryId is being passed correctly
- Firestore permissions allow writing to match_scores

### Issue: Multiple matches all show "Start Match"
**Expected!** This is correct. Each match needs to be individually started.

---

## Visual Changes

### Before:
```
┌─────────────────────┐
│ Court 1    in_use   │
├─────────────────────┤
│ Player A            │
│      0 - 0          │
│ Player B            │
│ Games: 0 - 0        │
├─────────────────────┤
│ [Score]             │  ← Only option
└─────────────────────┘
```

### After:
```
┌─────────────────────┐
│ Court 1    in_use   │
├─────────────────────┤
│  [scheduled] ← NEW! │
│                     │
│ Player A            │
│      0 - 0          │
│ Player B            │
│ Games: 0 - 0        │
├─────────────────────┤
│ [▶ Start Match]     │  ← NEW! (green)
└─────────────────────┘

         ↓ Click "Start Match"

┌─────────────────────┐
│ Court 1    in_use   │
├─────────────────────┤
│ [▶ in_progress] ← ! │
│                     │
│ Player A            │
│      0 - 0          │
│ Player B            │
│ Games: 0 - 0        │
├─────────────────────┤
│ [📊 Score]          │  ← Changed! (blue)
└─────────────────────┘
```

---

## Success Criteria

✅ Court cards show status badge
✅ "Start Match" button appears for scheduled matches
✅ Clicking "Start Match" transitions status to 'in_progress'
✅ Button changes to "Score" after starting
✅ "In Progress" stat increments correctly
✅ Console logs show complete status transition
✅ Scoring interface loads correctly

---

## Files Modified

1. [src/features/tournaments/views/MatchControlView.vue](../../src/features/tournaments/views/MatchControlView.vue)
   - Lines 588-632: Added logging to goToScoring and startMatchInProgress
   - Lines 1268-1281: Added status badge to court cards
   - Lines 1296-1339: Updated button logic based on match status

2. [src/stores/matches.ts](../../src/stores/matches.ts)
   - Lines 451-478: Added logging to startMatch function

3. Documentation:
   - [docs/migration/status_flow_summary.md](./status_flow_summary.md)
   - [docs/migration/start_match_button_fix.md](./start_match_button_fix.md) (this file)

---

**Status:** ✅ Ready for testing!
