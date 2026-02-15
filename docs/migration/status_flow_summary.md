# Status Flow Summary & Diagnostic Report

**Date:** 2026-02-04
**Author:** Claude Sonnet 4.5

---

## Current Console Output Analysis

```
By Status: {
  "ready": 8,      // ✅ Matches from brackets adapter (status 0, 1, 2 → 'ready')
  "scheduled": 8   // ✅ Matches with court assignments (from auto-schedule)
}
```

**Good news:** The status mapping fix is working! Matches are correctly being mapped to 'ready' status from brackets-manager.

---

## Issues Identified

### Issue #1: Status Confusion in Match Schedule Tab
**Symptom:** Some matches show "ready" (yellow badge) even though they have court assignments
**Root Cause:** The Match Schedule tab displays the underlying brackets-manager status, not the merged match_scores status
**Expected:** All 16 matches should show "scheduled" status since they all have court assignments

### Issue #2: "In Progress" Always Shows 0
**Symptom:** Matches assigned to courts never show as "in_progress"
**Root Cause:** Matches need explicit "Start Match" action to transition from "scheduled" → "in_progress"
**Current Flow:**
1. Match created → status "ready" (brackets adapter)
2. Auto-schedule assigns court → status "scheduled" (match_scores)
3. **MISSING STEP:** User must click "Start Match" → status "in_progress"
4. User enters scores → match completes

**Problem:** The court cards show a "SCORE" button but NO "Start Match" button!

### Issue #3: Scoring Interface Opens Blank
**Symptom:** Clicking "SCORE" button on court card navigates to scoring interface but shows blank/loading page
**Likely Causes:**
- Match data not loading correctly
- categoryId not being passed to scoring interface
- Routing issue with match ID

---

## Expected Status Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Bracket Generation                                     │
│ • brackets-manager creates matches with numeric status 0, 1, 2  │
│ • Adapter converts to status: 'ready'                           │
│ • Matches have NO courtId or scheduledTime yet                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Auto-Schedule (or Manual Assignment)                   │
│ • Scheduler writes to match_scores collection:                  │
│   - status: 'scheduled'                                         │
│   - courtId: assigned court                                     │
│   - scheduledTime: assigned time                                │
│ • Match store merges: match_scores.status overrides 'ready'     │
│ • Result: Match shows status 'scheduled' with court assignment  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: Start Match (MISSING!)                                 │
│ • User clicks "Start Match" button on court card OR              │
│ • User clicks "SCORE" → scoring interface shows "Start Match"   │
│ • matchStore.startMatch() writes to match_scores:               │
│   - status: 'in_progress'                                       │
│   - startedAt: timestamp                                        │
│   - scores: initialized empty array                             │
│ • Result: Match shows status 'in_progress'                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 4: Score Entry                                            │
│ • User enters scores via scoring interface                      │
│ • Scores written to match_scores.scores array                   │
│ • Match remains 'in_progress'                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 5: Complete Match                                         │
│ • All games completed                                           │
│ • matchStore.completeMatch() writes:                            │
│   - status: 'completed'                                         │
│   - winnerId: determined from scores                            │
│   - completedAt: timestamp                                      │
│ • Result: Match shows status 'completed', bracket advances      │
└─────────────────────────────────────────────────────────────────┘
```

---

## What's Working ✅

1. **Brackets Generation:** Creates matches successfully
2. **Status Adapter:** Correctly maps brackets-manager status 0, 1, 2 → 'ready'
3. **Auto-Schedule:** Assigns matches to courts and writes status 'scheduled'
4. **Match Loading:** All 16 matches load correctly in Match Control
5. **Court Display:** Matches show on court cards with player names and scores

---

## What's Broken ❌

1. **No "Start Match" button on court cards**
   - Court cards only show "SCORE" button
   - Missing the critical step to transition status to 'in_progress'

2. **Scoring interface navigation issue**
   - Clicking "SCORE" should navigate to `/tournaments/{id}/matches/{matchId}/score`
   - But user reports it opens blank

3. **Status display inconsistency**
   - Match Schedule tab shows some matches as "ready" (yellow) when they have courts
   - Should show all scheduled matches as "scheduled" (gray)

---

## Recommended Fixes

### Fix #1: Add "Start Match" Button to Court Cards

**File:** [src/features/tournaments/views/MatchControlView.vue](../../src/features/tournaments/views/MatchControlView.vue:1296-1316)

**Current Code (lines 1296-1305):**
```vue
<v-card-actions v-if="court.status !== 'maintenance'">
  <template v-if="getMatchForCourt(court.id)">
    <v-btn
      size="small"
      variant="text"
      @click="goToScoring(getMatchForCourt(court.id)!)"
    >
      Score
    </v-btn>
  </template>
</v-card-actions>
```

**Recommended Change:**
```vue
<v-card-actions v-if="court.status !== 'maintenance'">
  <template v-if="getMatchForCourt(court.id)">
    <!-- Show Start Match button if match is scheduled but not started -->
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
  </template>
</v-card-actions>
```

### Fix #2: Add Diagnostic Logging to goToScoring

**File:** [src/features/tournaments/views/MatchControlView.vue](../../src/features/tournaments/views/MatchControlView.vue:588-596)

**Add logging:**
```typescript
function goToScoring(match: Match) {
  console.log('[goToScoring] Navigating to scoring interface', {
    matchId: match.id,
    tournamentId: tournamentId.value,
    categoryId: match.categoryId,
    status: match.status,
    route: {
      name: 'scoring-interface',
      params: {
        tournamentId: tournamentId.value,
        matchId: match.id,
      }
    }
  });

  router.push({
    name: 'scoring-interface',
    params: {
      tournamentId: tournamentId.value,
      matchId: match.id,
    },
  });
}
```

### Fix #3: Add Status Badge to Court Cards

Show match status on each court card for clarity:

```vue
<v-card-text>
  <template v-if="court.status === 'in_use' || getMatchForCourt(court.id)">
    <div v-if="getMatchForCourt(court.id)" class="match-on-court">
      <!-- ADD STATUS CHIP -->
      <div class="text-center mb-2">
        <v-chip
          :color="getMatchForCourt(court.id)?.status === 'in_progress' ? 'success' :
                  getMatchForCourt(court.id)?.status === 'scheduled' ? 'info' : 'warning'"
          size="x-small"
        >
          {{ getMatchForCourt(court.id)?.status }}
        </v-chip>
      </div>

      <!-- Existing player names and scores -->
      <div class="text-body-2 font-weight-medium mb-1">
        {{ getParticipantName(getMatchForCourt(court.id)?.participant1Id) }}
      </div>
      ...
    </div>
  </template>
</v-card-text>
```

---

## Testing Plan

### Step 1: Verify Current Status
1. Open Match Control page
2. Check console for diagnostic logs
3. Verify matches are loaded correctly (16 matches, 8 ready + 8 scheduled)
4. Note which matches have courtId and scheduledTime

### Step 2: Test Status Flow
1. Generate brackets for a category
2. Run auto-schedule
3. Navigate to Match Control → Courts view
4. **Check:** Do court cards show "Start Match" button? (Should show for 'scheduled' matches)
5. Click "Start Match" on a court
6. **Check:** Does match status change to 'in_progress'?
7. **Check:** Does "In Progress" stat update to 1?
8. **Check:** Does button change from "Start Match" to "Score"?

### Step 3: Test Scoring Interface
1. Click "Score" button on a court with in_progress match
2. **Check:** Does scoring interface load correctly?
3. **Check:** Can you enter scores?
4. Enter scores and complete match
5. **Check:** Does match status change to 'completed'?
6. **Check:** Does court status change to 'available'?

---

## Console Logging Checklist

Add these logs to trace the complete flow:

**In MatchControlView.vue:**
```typescript
// When startMatchInProgress is called:
console.log('[startMatchInProgress] Starting match', {
  matchId: match.id,
  currentStatus: match.status,
  courtId: match.courtId,
});

// After matchStore.startMatch completes:
console.log('[startMatchInProgress] Match started successfully', {
  matchId: match.id,
  newStatus: 'in_progress',
});
```

**In matches.ts (startMatch function):**
```typescript
// At start of function:
console.log('[matchStore.startMatch] Starting match', {
  tournamentId,
  matchId,
  categoryId,
  matchScoresPath,
});

// After setDoc completes:
console.log('[matchStore.startMatch] Match scores updated', {
  matchId,
  status: 'in_progress',
  startedAt: 'now',
});
```

---

## Quick Summary

**The Problem:**
Matches are assigned to courts but never transition to "in_progress" because there's no "Start Match" button on the court cards.

**The Solution:**
1. Add "Start Match" button to court cards for matches with status 'scheduled' or 'ready'
2. Change button to "Score" only when match status is 'in_progress'
3. Add diagnostic logging to trace status transitions
4. Fix scoring interface navigation if needed

**Impact:**
This will enable the complete match lifecycle: ready → scheduled → in_progress → completed

---

## Next Steps

1. Implement Fix #1 (Add Start Match button)
2. Test the complete flow
3. Check console logs for any navigation issues
4. Report back with results
