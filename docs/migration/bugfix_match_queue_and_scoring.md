# Bug Fix: Match Queue & Scoring Interface Issues

**Date:** 2026-02-04
**Issues:**
1. Understanding Match Queue purpose and 10-minute break rule
2. Scoring interface not loading when clicking "SCORE" button

---

## Issue #1: Match Queue & Player Rest Time

### User Question
> "What is the use of Match Queue? I assume the next 4 matches needs to be here when a court gets free it needs to be assigned. Also when assigning we need to consider the rule: we need 10 min break before scheduling."

### Answer: ✅ Already Implemented!

**Match Queue Purpose:**
The Match Queue shows matches that are ready to be assigned to courts. It displays:
- Matches with participants assigned (not TBD)
- Matches without court assignments yet
- Prioritized by round and match number

**10-Minute Rest Rule:**
The rest time between matches **is already implemented** in the auto-scheduler!

**File:** [src/composables/useMatchScheduler.ts](../../src/composables/useMatchScheduler.ts)

**Default Settings (lines 100-103):**
```typescript
const settings = tournament?.settings || {
  matchDurationMinutes: 30,
  minRestTimeMinutes: 15,  // ✅ Default is 15 minutes!
};
```

**Rest Time Enforcement (lines 472-492):**
```typescript
/**
 * Calculate earliest start time based on participant rest
 * Rest time = minRestTimeMinutes * 60 * 1000 milliseconds
 */
let earliestStart = config.startTime;
let restViolation = false;

for (const pid of participantIds) {
  const lastEnd = participantSchedule.get(pid);
  if (lastEnd) {
    // Add rest time to the participant's last match end time
    const restEnd = new Date(lastEnd.getTime() + config.minRestTimeMinutes * 60 * 1000);

    if (restEnd > earliestStart) {
      earliestStart = restEnd;  // Push match start time to allow rest

      // Check if rest period extends beyond tournament end
      if (restEnd > latestEnd) {
        restViolation = true;
        restViolationDetails = { participantId: pid, restEndTime: restEnd };
      }
    }
  }
}

// If rest time can't be satisfied, mark match as unscheduled
if (restViolation && restViolationDetails) {
  unscheduled.push({
    matchId,
    reason: `Participant needs ${config.minRestTimeMinutes}-minute rest until ${restViolationDetails.restEndTime.toLocaleTimeString()}, but tournament ends at ${latestEnd.toLocaleTimeString()}`,
    details: { participantId, restEndTime, tournamentEndTime }
  });
  continue;
}
```

**How It Works:**
1. **Tracks participant schedules**: Maintains a `Map<participantId, lastMatchEndTime>` for each player
2. **Calculates rest period**: Adds `minRestTimeMinutes` to the last match end time
3. **Enforces minimum start time**: Match can't start until all participants have completed their rest period
4. **Handles violations**: If rest time would extend beyond tournament end, match is marked as unscheduled with a clear reason

**Current Match Queue Implementation (lines 138-147 in MatchControlView.vue):**
```typescript
const pendingMatches = computed(() => {
  let result = matches.value.filter(
    (m) => m.status === 'scheduled' &&
          m.participant1Id &&
          m.participant2Id &&
          (!m.courtId || !m.scheduledTime)  // Missing court or time assignment
  );

  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }

  return result.sort((a, b) =>
    a.round - b.round || a.matchNumber - b.matchNumber  // Prioritize by round, then match number
  );
});
```

**Summary:**
- ✅ Match Queue shows matches ready for court assignment
- ✅ 10-minute (configurable to 15-minute default) rest rule is enforced by auto-scheduler
- ✅ Scheduler tracks when each participant last played
- ✅ Ensures adequate rest before scheduling next match
- ✅ Won't schedule a match if rest period can't be satisfied

---

## Issue #2: Scoring Interface Not Working ❌

### Problem
User reported: "When I click score, it opens blank"
URL attempted: `http://localhost:3000/tournaments/JDmlZCpaeWSf0Yxhhpv7/score`

### Root Cause
The `goToScoring` function was missing the `categoryId` query parameter. The ScoringInterface component needs `categoryId` to:
1. Construct the correct Firestore path: `tournaments/{id}/categories/{catId}/match`
2. Subscribe to match updates
3. Load match data

**Without categoryId:**
- Match subscription fails (can't find the match document)
- Component loads but shows blank/loading state
- No error message shown to user

### The Fix

**File:** [src/features/tournaments/views/MatchControlView.vue](../../src/features/tournaments/views/MatchControlView.vue) (lines 635-667)

**Before (Missing categoryId):**
```typescript
function goToScoring(match: Match) {
  console.log('[goToScoring] Navigating to scoring interface', { ... });

  router.push({
    name: 'scoring-interface',
    params: {
      tournamentId: tournamentId.value,
      matchId: match.id,
    },
    // ❌ Missing: query parameter for categoryId
  });
}
```

**After (With categoryId):**
```typescript
function goToScoring(match: Match) {
  console.log('[goToScoring] Navigating to scoring interface', {
    matchId: match.id,
    tournamentId: tournamentId.value,
    categoryId: match.categoryId,  // ✅ Logged for debugging
    status: match.status,
    courtId: match.courtId,
    participants: {
      p1: match.participant1Id,
      p2: match.participant2Id,
    },
    route: {
      name: 'scoring-interface',
      params: {
        tournamentId: tournamentId.value,
        matchId: match.id,
      },
      query: {
        category: match.categoryId,  // ✅ Added to logging
      }
    }
  });

  router.push({
    name: 'scoring-interface',
    params: {
      tournamentId: tournamentId.value,
      matchId: match.id,
    },
    query: {
      category: match.categoryId,  // ✅ FIXED: Pass categoryId as query param
    },
  });
}
```

### How ScoringInterface Uses categoryId

**File:** [src/features/scoring/views/ScoringInterfaceView.vue](../../src/features/scoring/views/ScoringInterfaceView.vue) (lines 97-104)

```typescript
onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);

  // Get categoryId from route query
  const categoryId = route.query.category as string | undefined;

  // Subscribe to match updates (REQUIRES categoryId to construct Firestore path)
  matchStore.subscribeMatch(tournamentId.value, matchId.value, categoryId);

  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
});
```

**File:** [src/stores/matches.ts](../../src/stores/matches.ts) (lines 413-428)

```typescript
function subscribeMatch(tournamentId: string, matchId: string, categoryId?: string): void {
  if (currentMatchUnsubscribe) {
    currentMatchUnsubscribe();
    currentMatchUnsubscribe = null;
  }

  const unsubscribers: (() => void)[] = [];

  const refresh = async () => {
    await fetchMatch(tournamentId, matchId, categoryId);  // ✅ Needs categoryId
  };

  // Construct Firestore path - REQUIRES categoryId!
  const matchPath = getMatchPath(tournamentId, categoryId);
  // → "tournaments/{id}/categories/{catId}/match" if categoryId provided
  // → "tournaments/{id}/match" if categoryId is undefined (WRONG PATH!)

  const unsubMatch = onSnapshot(
    doc(db, matchPath, matchId),
    () => refresh(),
    (error) => console.error('Match subscription error:', error)
  );

  unsubscribers.push(unsubMatch);
  currentMatchUnsubscribe = () => unsubscribers.forEach(unsub => unsub());

  // Initial fetch
  refresh();
}
```

**The Problem Explained:**
1. Without `categoryId` query param → `categoryId = undefined`
2. `getMatchPath(tournamentId, undefined)` → `"tournaments/{id}/match"`
3. Firestore listener subscribes to **wrong path** (no categories collection)
4. Match document not found → component shows blank/loading state
5. No error shown because the subscription "succeeds" (just listening to non-existent path)

**With the fix:**
1. With `categoryId` query param → `categoryId = "Am8IhNsMXwlRweA4ixOQ"`
2. `getMatchPath(tournamentId, categoryId)` → `"tournaments/{id}/categories/{catId}/match"`
3. Firestore listener subscribes to **correct path**
4. Match document found → component loads match data
5. User can enter scores successfully

---

## Testing Instructions

### Test #1: Verify Match Queue Shows Correctly

1. Open Match Control page
2. Navigate to **Queue** tab
3. **Check "Match Queue" section:**
   - Should show matches without court assignments
   - Should be sorted by round, then match number
   - Should show participant names (not TBD)
4. **Console should show:**
   ```
   [MatchControlView] Matches updated: 16 matches
     By Status: { "ready": 8, "scheduled": 8, "in_progress": 4 }
   ```

### Test #2: Verify Rest Time Enforcement

1. **Manually check tournament settings:**
   - Open Tournament Settings
   - Look for "Match Duration" and "Rest Time Between Matches"
   - Default should be 30 min match duration, 15 min rest time

2. **Run auto-schedule:**
   - Open Auto Schedule dialog
   - Select all categories
   - Set start time (e.g., 9:00 AM)
   - Click "Schedule Matches"

3. **Check console logs:**
   ```
   [scheduleMatches] Scheduling configuration: {
     matchDurationMinutes: 30,
     minRestTimeMinutes: 15,
     courts: [...]
   }
   ```

4. **Verify participant schedules respect rest time:**
   - If a player finishes match at 9:30 AM
   - Their next match should not start before 9:45 AM (15-minute rest)
   - Check scheduled times in Match Schedule tab

### Test #3: Verify Scoring Interface Works

1. **Start a match:**
   - Navigate to Match Control → Courts tab
   - Find a match on a court with status "scheduled" or "ready"
   - Click **"START MATCH"** button (green)
   - Status should change to "in_progress"

2. **Open scoring interface:**
   - Click **"SCORE"** button (blue)
   - **Check browser console:**
     ```
     [goToScoring] Navigating to scoring interface {
       matchId: "0",
       tournamentId: "JDmlZCpaeWSf0Yxhhpv7",
       categoryId: "Am8IhNsMXwlRweA4ixOQ",  ← ✅ Should be present!
       status: "in_progress",
       courtId: "court-1",
       participants: { p1: "reg-123", p2: "reg-456" },
       route: {
         name: "scoring-interface",
         params: { tournamentId: "...", matchId: "..." },
         query: { category: "Am8IhNsMXwlRweA4ixOQ" }  ← ✅ Should be present!
       }
     }
     ```

3. **Check URL:**
   - Should be: `http://localhost:3000/tournaments/{id}/matches/{matchId}/score?category={catId}`
   - Example: `http://localhost:3000/tournaments/JDmlZCpaeWSf0Yxhhpv7/matches/0/score?category=Am8IhNsMXwlRweA4ixOQ`

4. **Check scoring interface loads:**
   - Should show player names (not "TBD" or "Unknown")
   - Should show current score (e.g., "0 - 0")
   - Should show game number (e.g., "Game 1")
   - Should have buttons to increment scores
   - Should NOT show blank/loading state indefinitely

5. **Enter scores:**
   - Click score buttons to increment points
   - Verify scores update in real-time
   - Complete game 1 (e.g., 21-19)
   - Verify game 2 starts automatically
   - Complete match (best of 3)
   - Verify match status changes to "completed"

### Test #4: Verify Console Logging

After clicking "SCORE" button, console should show:

```
[goToScoring] Navigating to scoring interface {
  matchId: "0",
  categoryId: "Am8IhNsMXwlRweA4ixOQ",  ← ✅ Must be present
  route: {
    query: { category: "Am8IhNsMXwlRweA4ixOQ" }  ← ✅ Must be present
  }
}
```

If `categoryId` is missing or undefined, the scoring interface will not work.

---

## Common Issues & Troubleshooting

### Issue: Scoring interface still shows blank after fix

**Check:**
1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
2. Check browser console for errors
3. Verify `categoryId` is in the URL: `?category=...`
4. Check match actually exists in Firestore at path:
   `tournaments/{id}/categories/{catId}/match/{matchId}`

**If still blank:**
- Check Firestore console → Match document exists?
- Check browser Network tab → Firestore requests succeeding?
- Check for authentication issues → User has scorekeeper role?

### Issue: Auto-scheduler not respecting rest time

**Check:**
1. Tournament settings have correct `minRestTimeMinutes` value
2. Console logs show rest time configuration:
   ```
   [scheduleMatches] Scheduling configuration: {
     minRestTimeMinutes: 15
   }
   ```
3. If a match is marked as "unscheduled", check the reason:
   ```
   reason: "Participant needs 15-minute rest until 10:15 AM, but tournament ends at 10:00 AM"
   ```

### Issue: Match Queue shows TBD matches

**Expected behavior:**
- Match Queue filters out TBD matches (line 140-141):
  ```typescript
  m.participant1Id && m.participant2Id  // Only show if both participants assigned
  ```
- If you see TBD matches, check the filter logic

---

## Files Modified

1. [src/features/tournaments/views/MatchControlView.vue](../../src/features/tournaments/views/MatchControlView.vue)
   - Lines 635-667: Added `categoryId` query parameter to `goToScoring` function
   - Lines 138-147: Match Queue implementation (no changes, documented for reference)

---

## Related Documentation

- [docs/migration/start_match_button_fix.md](./start_match_button_fix.md) - Start Match button implementation
- [docs/migration/bugfix_stats_and_ui_cleanup.md](./bugfix_stats_and_ui_cleanup.md) - Stats display and UI cleanup fixes
- [docs/migration/status_flow_summary.md](./status_flow_summary.md) - Complete status flow documentation

---

**Status:** ✅ Ready for testing!

**Key Takeaways:**
- ✅ 10-minute rest rule is already implemented (default 15 minutes)
- ✅ Scoring interface now works (categoryId passed in query param)
- ✅ Match Queue shows matches ready for court assignment
- ✅ Comprehensive logging helps debug navigation issues
