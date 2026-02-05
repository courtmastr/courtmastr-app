# Bug Fix Plan - Courtmaster Tournament System

**Date:** 2026-02-04
**Bugs:** 3 HIGH severity issues from automated testing
**Root Cause:** Collection path mismatch between category-level and tournament-level Firestore paths

---

## Executive Summary

All three bugs stem from a **single root cause**: The bracket generator creates matches in **category-level** Firestore collections (`tournaments/{id}/categories/{catId}/match`), but the auto-scheduler queries and writes to **tournament-level** collections (`tournaments/{id}/match`). This path mismatch causes:

1. Matches to be invisible to the scheduler
2. Scheduled data to be written to the wrong collection
3. Stats and queue displays to show 0 matches

**Priority:** Fix Bug #2 first (scheduler paths), which will cascade-fix Bugs #1 and #3.

---

## Root Cause Analysis

### Current Architecture (BROKEN)

**Bracket Generation** (useBracketGenerator.ts:108-109):
```typescript
const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
const storage = new ClientFirestoreStorage(db, categoryPath);
// Creates: tournaments/{id}/categories/{catId}/match
//          tournaments/{id}/categories/{catId}/stage
//          tournaments/{id}/categories/{catId}/participant
```

**Match Store** (matches.ts:45-48) - ✅ CORRECT:
```typescript
function getMatchPath(tournamentId: string, categoryId?: string): string {
  return categoryId
    ? `tournaments/${tournamentId}/categories/${categoryId}/match`  // Category-level ✅
    : `tournaments/${tournamentId}/match`;  // Tournament-level
}
```

**Auto-Scheduler** (useMatchScheduler.ts:126, 499) - ❌ BROKEN:
```typescript
// Queries tournament-level (WRONG):
const matchesQuery = query(
  collection(db, 'tournaments', tournamentId, 'match'),  // ❌ Should be category-level
  where('status', 'in', [0, 1, 2])
);

// Saves tournament-level (WRONG):
const scoreRef = doc(db, 'tournaments', tournamentId, 'match_scores', slot.matchId);  // ❌
```

**Stage Query** (useMatchScheduler.ts:142-143) - ❌ BROKEN:
```typescript
const stagesQuery = query(
  collection(db, 'tournaments', tournamentId, 'stage'),  // ❌ Should be category-level
  where('tournament_id', '==', options.categoryId)
);
```

### Why Each Bug Occurs

**BUG #1: Total Matches = 0**
- Match store correctly reads category-level paths when categoryId is provided
- BUT merged data from `/match_scores` is missing because scheduler wrote to wrong path
- Stats calculation uses `matches.value.length` which may be correct, BUT status fields are wrong
- Actually, the matches ARE loaded correctly from category-level `/match`, but the test shows 0

**Wait - Let me reconsider Bug #1...**

Looking at TournamentDashboardView.vue:127-136, it subscribes with categoryId:
```typescript
watch(
  [tournamentId, activeCategory],
  ([tid, catId]) => {
    if (tid && catId) {
      matchStore.subscribeMatches(tid, catId);  // ✅ Passes categoryId
    }
  },
  { immediate: true }
);
```

So matches ARE being loaded from the correct category-level path. The bug report shows "Total Matches: 0" which means `matches.value.length === 0`.

This could mean:
1. The subscription isn't working correctly
2. The bracket wasn't generated successfully
3. There's a data loading race condition

Actually, the bug report says "Brackets generated successfully" and "Both brackets ready", so matches WERE created. The issue is they're not being loaded or counted.

**BUG #2: Auto Schedule Timeout**
- Button text is dynamic: "Schedule {{ matchesToScheduleForAuto.length }} Matches"
- Playwright test searches for `button:has-text("Generate")` which doesn't match
- Button selector issue: Test looks for "Generate", actual text is "Schedule N Matches"
- Even if button is clicked correctly, scheduler queries wrong path and finds 0 matches
- Function returns early (line 151-154) or stage query hangs/timeouts

**BUG #3: Queue Empty**
- Queue filters for `status === 'scheduled'` with participants but no court/time
- Scheduler writes to tournament-level `/match_scores`
- Match store reads from category-level `/match_scores`
- Data written to wrong location = queue shows 0 matches

---

## Bug #1: Total Matches Shows 0

### Severity
HIGH - Users cannot see tournament progress

### File Impact
- `src/features/tournaments/views/TournamentDashboardView.vue` (lines 46-64, 127-136)
- `src/stores/matches.ts` (lines 202-235 subscription, 89-200 fetch)

### Investigation Required
The matches store appears to be reading from the correct paths when categoryId is provided. Need to determine:
1. Is the subscription actually triggering?
2. Are matches being returned from Firestore?
3. Is there a timing issue where stats are calculated before matches load?

### Fix Strategy

**Option A: Add Loading State & Debug Logging**
```typescript
// In TournamentDashboardView.vue
const matchesLoading = ref(true);
const matchesDebug = ref<string>('');

watch(matches, (newMatches) => {
  matchesLoading.value = false;
  matchesDebug.value = `Loaded ${newMatches.length} matches from ${activeCategory.value}`;
  console.log('Matches loaded:', {
    count: newMatches.length,
    categoryId: activeCategory.value,
    matches: newMatches.map(m => ({ id: m.id, round: m.round, status: m.status }))
  });
}, { immediate: true });

// Update stats computation to show loading state
const stats = computed(() => {
  if (matchesLoading.value) {
    return {
      totalMatches: '...',
      // ... loading states
    };
  }
  // ... existing logic
});
```

**Option B: Verify Match Count from Firestore**
Add a separate query that counts matches directly from Firestore as a verification:
```typescript
// In TournamentDashboardView.vue
const firestoreMatchCount = ref<number | null>(null);

async function verifyMatchCount() {
  if (!tournamentId.value || !activeCategory.value) return;

  const matchPath = `tournaments/${tournamentId.value}/categories/${activeCategory.value}/match`;
  const matchSnap = await getDocs(collection(db, matchPath));
  firestoreMatchCount.value = matchSnap.size;

  console.log('Firestore match count:', {
    path: matchPath,
    count: matchSnap.size,
    storeCount: matches.value.length
  });
}

// Call on category change
watch(activeCategory, verifyMatchCount, { immediate: true });
```

### Testing
1. Generate brackets for a category
2. Check browser console for match loading logs
3. Verify stats display shows correct count
4. Compare store count vs direct Firestore query count

---

## Bug #2: Auto Schedule Generate Button Timeout

### Severity
HIGH - Users cannot schedule matches (critical workflow blocker)

### File Impact
- `src/composables/useMatchScheduler.ts` (lines 124-149, 491-514)
- `src/features/tournaments/views/MatchControlView.vue` (lines 1647-1653)
- `full-tournament-test.cjs` (test selector)

### Root Cause
**Two issues:**
1. **Test selector mismatch**: Button text is "Schedule N Matches", test searches for "Generate"
2. **Collection path mismatch**: Scheduler queries tournament-level paths, brackets stored at category-level

### Fix Strategy

#### Fix 2A: Update Scheduler to Use Category-Level Paths

**File:** `src/composables/useMatchScheduler.ts`

**Changes Required:**

1. **Update `scheduleMatches` function signature** (line ~77):
```typescript
// BEFORE:
async function scheduleMatches(
  tournamentId: string,
  options: {
    categoryId?: string;  // ❌ Optional
    courtIds: string[];
    startTime: Date;
    respectDependencies?: boolean;
  }
): Promise<ScheduleResult>

// AFTER:
async function scheduleMatches(
  tournamentId: string,
  options: {
    categoryId: string;  // ✅ REQUIRED - no longer optional
    courtIds: string[];
    startTime: Date;
    respectDependencies?: boolean;
  }
): Promise<ScheduleResult>
```

2. **Update match query to use category path** (lines 124-136):
```typescript
// BEFORE:
const matchesQuery = query(
  collection(db, 'tournaments', tournamentId, 'match'),  // ❌ Tournament-level
  where('status', 'in', [0, 1, 2]),
  orderBy('round'),
  orderBy('position')
);

// AFTER:
const matchPath = `tournaments/${tournamentId}/categories/${options.categoryId}/match`;
const matchesQuery = query(
  collection(db, matchPath),  // ✅ Category-level
  where('status', 'in', [0, 1, 2]),
  orderBy('round'),
  orderBy('position')
);

// Remove the filter logic (lines 138-149) since we're querying the correct category directly
```

3. **Update stage query to use category path** (lines 141-146):
```typescript
// BEFORE:
const stagesQuery = query(
  collection(db, 'tournaments', tournamentId, 'stage'),  // ❌ Tournament-level
  where('tournament_id', '==', options.categoryId)
);

// AFTER:
const stagePath = `tournaments/${tournamentId}/categories/${options.categoryId}/stage`;
const stagesQuery = query(collection(db, stagePath));  // ✅ Category-level, no filter needed
```

4. **Update `saveSchedule` function** (lines 491-514):
```typescript
// BEFORE:
async function saveSchedule(
  tournamentId: string,
  scheduled: ScheduledMatch[]
): Promise<void>

// AFTER:
async function saveSchedule(
  tournamentId: string,
  categoryId: string,  // ✅ Add categoryId parameter
  scheduled: ScheduledMatch[]
): Promise<void>

// Update batch write:
// BEFORE:
const scoreRef = doc(db, 'tournaments', tournamentId, 'match_scores', slot.matchId);

// AFTER:
const scoreRef = doc(
  db,
  'tournaments',
  tournamentId,
  'categories',
  categoryId,
  'match_scores',
  slot.matchId
);
```

5. **Update `saveSchedule` call** (line ~184):
```typescript
// BEFORE:
await saveSchedule(tournamentId, scheduled);

// AFTER:
await saveSchedule(tournamentId, options.categoryId, scheduled);
```

6. **Add validation for categoryId** (after line 100):
```typescript
if (!options.categoryId) {
  throw new Error('categoryId is required for scheduling');
}
```

#### Fix 2B: Update Test Selector

**File:** `full-tournament-test.cjs`

**Current (line ~XXX):**
```javascript
await page.click('button:has-text("Generate")');
```

**Updated:**
```javascript
// More flexible selector that matches dynamic text
await page.click('button:has-text("Schedule")');
// OR use data-test-id approach (recommended):
// In MatchControlView.vue: <v-btn data-test-id="auto-schedule-generate-btn">
// await page.click('[data-test-id="auto-schedule-generate-btn"]');
```

### Verification Steps

1. **Before testing**: Check Firestore paths manually
   - Verify matches exist at `tournaments/{id}/categories/{catId}/match`
   - Verify stages exist at `tournaments/{id}/categories/{catId}/stage`

2. **During testing**: Add console logs
   ```typescript
   console.log('Scheduling for category:', options.categoryId);
   console.log('Match query path:', matchPath);
   console.log('Matches found:', matches.length);
   console.log('Stage query path:', stagePath);
   console.log('Stages found:', stageIds);
   ```

3. **After scheduling**: Verify data written to correct path
   - Check `tournaments/{id}/categories/{catId}/match_scores` contains documents
   - Verify each document has `courtId`, `scheduledTime`, `status: 'scheduled'`

### Testing
1. Generate brackets for a category
2. Open Auto Schedule dialog
3. Select category and start time
4. Click "Schedule N Matches" button
5. Verify matches are scheduled successfully
6. Check Firestore to confirm data in category-level `/match_scores`
7. Run automated test with updated selector

---

## Bug #3: Queue Shows No Matches

### Severity
HIGH - Users cannot manage match queue

### File Impact
- `src/features/tournaments/views/MatchControlView.vue` (lines 138-147)
- `src/stores/matches.ts` (fetch/subscribe logic)

### Root Cause
Queue filters for matches with `status === 'scheduled'`, but:
- Scheduler writes to tournament-level `/match_scores` (wrong)
- Match store reads from category-level `/match_scores` (correct)
- Mismatched paths = no data loaded = queue empty

### Fix Strategy

**This bug is automatically fixed by Bug #2 Fix 2A**

Once the scheduler writes to category-level `/match_scores` paths, the match store will correctly load and merge the data, and the queue will populate.

**Additional Enhancement (Optional):**

Add empty state messaging to help debug:
```typescript
// In MatchControlView.vue, after pendingMatches computed (line 147):
const queueDebugInfo = computed(() => {
  return {
    totalMatches: matches.value.length,
    scheduledMatches: matches.value.filter(m => m.status === 'scheduled').length,
    matchesWithParticipants: matches.value.filter(m => m.participant1Id && m.participant2Id).length,
    matchesMissingCourt: matches.value.filter(
      m => m.status === 'scheduled' && m.participant1Id && m.participant2Id && !m.courtId
    ).length,
    pendingCount: pendingMatches.value.length,
    categoryPath: `tournaments/${tournamentId.value}/categories/${selectedCategory.value}/match_scores`
  };
});

// Add to template for debugging:
// <pre>{{ queueDebugInfo }}</pre>
```

### Verification Steps

1. After fixing Bug #2, generate brackets
2. Run auto-schedule
3. Check Match Control page
4. Verify queue shows scheduled matches
5. Verify matches have:
   - `status === 'scheduled'`
   - `participant1Id` and `participant2Id` populated
   - `courtId` and `scheduledTime` present (scheduled) or missing (pending)

### Testing
1. Complete Bug #2 fix
2. Generate brackets
3. Run auto-schedule
4. Navigate to Match Control
5. Verify queue shows matches with court assignments
6. Verify pending queue (if implemented) shows unscheduled matches

---

## Implementation Order

### Phase 1: Fix Scheduler Paths (Bug #2)
**Estimated effort:** 2-3 hours

1. Update `useMatchScheduler.ts`:
   - Make `categoryId` required parameter
   - Update match query path to category-level
   - Update stage query path to category-level
   - Update `saveSchedule` to accept categoryId
   - Update batch write to use category-level path
   - Add validation and debug logging

2. Test manually:
   - Generate brackets
   - Open auto-schedule dialog
   - Schedule matches
   - Verify Firestore data in correct location

3. Update test selector in `full-tournament-test.cjs`:
   - Change "Generate" to "Schedule"

### Phase 2: Verify Stats (Bug #1)
**Estimated effort:** 1 hour

1. Add debug logging to TournamentDashboardView.vue
2. Run automated test
3. Check console logs for match loading
4. If still showing 0, add direct Firestore count query
5. Compare store count vs Firestore count

### Phase 3: Verify Queue (Bug #3)
**Estimated effort:** 30 minutes

1. After Phase 1 complete, run automated test
2. Verify queue populates with scheduled matches
3. Optionally add debug info computed property
4. Remove debug code once verified working

### Phase 4: Re-run Full Test Suite
**Estimated effort:** 15 minutes

1. Run `node full-tournament-test.cjs`
2. Verify all 8 phases pass
3. Check screenshots confirm fixes:
   - Total Matches shows correct count
   - Auto-schedule completes successfully
   - Queue displays scheduled matches
4. Celebrate! 🎉

---

## Critical Files Reference

### Files to Modify

| File | Lines | Changes |
|------|-------|---------|
| `src/composables/useMatchScheduler.ts` | 77-149, 184, 491-514 | Update all paths to category-level |
| `src/features/tournaments/views/TournamentDashboardView.vue` | 46-64 | Add debug logging (optional) |
| `full-tournament-test.cjs` | Search for "Generate" | Update button selector |

### Files to Review (No Changes)

| File | Purpose | Status |
|------|---------|--------|
| `src/stores/matches.ts` | Match data store | ✅ Already correct (uses category paths) |
| `src/composables/useBracketGenerator.ts` | Bracket creation | ✅ Already correct (creates category paths) |
| `src/features/tournaments/views/MatchControlView.vue` | Queue display | ✅ Already correct (filters correctly) |

### Firestore Collection Structure (After Fix)

```
tournaments/{tournamentId}/
├── categories/{categoryId}/
│   ├── match/                         # ✅ Bracket structure (brackets-manager)
│   │   └── {matchId}
│   │       ├── stage_id: number
│   │       ├── status: 0-4 (internal)
│   │       ├── opponent1: {...}
│   │       └── opponent2: {...}
│   │
│   ├── match_scores/                  # ✅ Operational data (scheduler writes here)
│   │   └── {matchId}
│   │       ├── status: 'scheduled' | 'in_progress' | 'completed'
│   │       ├── courtId: string
│   │       ├── scheduledTime: Timestamp
│   │       ├── sequence: number
│   │       └── scores: GameScore[]
│   │
│   ├── stage/                         # ✅ Stage metadata
│   │   └── {stageId}
│   │
│   └── participant/                   # ✅ Participant mappings
│       └── {participantId}
│
└── registrations/                     # Tournament-level
    └── {registrationId}
```

---

## Testing Checklist

### Manual Testing

- [ ] **Bracket Generation**
  - [ ] Generate Men's Singles bracket
  - [ ] Generate Mixed Doubles bracket
  - [ ] Verify matches created in category-level `/match` collection
  - [ ] Check Firestore console for correct paths

- [ ] **Tournament Dashboard (Bug #1)**
  - [ ] Open tournament dashboard
  - [ ] Check "Total Matches" stat
  - [ ] Verify shows correct count (not 0)
  - [ ] Check browser console for debug logs

- [ ] **Auto-Schedule (Bug #2)**
  - [ ] Click "Match Control"
  - [ ] Click "Auto Schedule" button
  - [ ] Select categories and courts
  - [ ] Set start time
  - [ ] Click "Schedule N Matches" button
  - [ ] Verify success message appears
  - [ ] Check Firestore for data in category-level `/match_scores`

- [ ] **Match Queue (Bug #3)**
  - [ ] After scheduling, verify queue shows matches
  - [ ] Verify court assignments visible
  - [ ] Verify "Assign Court" button works for unassigned matches
  - [ ] Verify queue updates in real-time

### Automated Testing

```bash
# Run full automated test suite
node full-tournament-test.cjs

# Expected output:
# ✅ Phase 1: Login
# ✅ Phase 2: Find Tournament
# ✅ Phase 3: Verify Data (Total Matches > 0)
# ✅ Phase 4: Generate Brackets
# ✅ Phase 5: Start Tournament
# ✅ Phase 6: Match Control
# ✅ Phase 7: Auto Schedule (No timeout)
# ✅ Phase 8: Verify Queue (Matches visible)

# Exit code: 0 (success)
```

### Firestore Verification

```javascript
// Use Firebase Console or run in browser console:

// 1. Check matches exist (bracket data)
const matchPath = `tournaments/{tournamentId}/categories/{categoryId}/match`;
// Expected: Documents with status 0-4, stage_id, opponents

// 2. Check match_scores exist (operational data)
const scoresPath = `tournaments/{tournamentId}/categories/{categoryId}/match_scores`;
// Expected: Documents with status: 'scheduled', courtId, scheduledTime

// 3. Check stages exist
const stagePath = `tournaments/{tournamentId}/categories/{categoryId}/stage`;
// Expected: Stage documents with tournament_id matching categoryId
```

---

## Rollback Plan

If the fix causes issues:

1. **Revert scheduler changes** to tournament-level paths
2. **OR** Update bracket generator to create tournament-level data:
   ```typescript
   // In useBracketGenerator.ts, change:
   const categoryPath = `tournaments/${tournamentId}`;  // Tournament-level
   ```
   **Note:** This would break category isolation, not recommended

3. **Best rollback**: Keep category-level architecture, revert scheduler changes only

---

## Additional Improvements (Post-Fix)

### 1. Add Test IDs for Reliable Testing
```vue
<!-- In MatchControlView.vue -->
<v-btn
  data-test-id="auto-schedule-generate-btn"
  color="primary"
  @click="runAutoSchedule"
>
  Schedule {{ matchesToScheduleForAuto.length }} Matches
</v-btn>
```

### 2. Add Loading States
```typescript
// In TournamentDashboardView.vue
const statsLoading = computed(() => matchStore.loading);
```

### 3. Add Error Boundaries
```typescript
// In useMatchScheduler.ts
try {
  const matchesSnap = await getDocs(matchesQuery);
  console.log(`Found ${matchesSnap.size} matches at ${matchPath}`);
} catch (error) {
  console.error('Failed to query matches:', error);
  throw new Error(`Failed to load matches from ${matchPath}: ${error.message}`);
}
```

### 4. Add Path Validation Utility
```typescript
// New file: src/utils/firestorePaths.ts
export function getMatchPath(tournamentId: string, categoryId: string): string {
  if (!tournamentId || !categoryId) {
    throw new Error('tournamentId and categoryId are required');
  }
  return `tournaments/${tournamentId}/categories/${categoryId}/match`;
}

export function getMatchScoresPath(tournamentId: string, categoryId: string): string {
  if (!tournamentId || !categoryId) {
    throw new Error('tournamentId and categoryId are required');
  }
  return `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;
}
```

---

## Success Criteria

✅ **Bug #1 Fixed**: Tournament dashboard shows correct "Total Matches" count
✅ **Bug #2 Fixed**: Auto-schedule completes successfully without timeout
✅ **Bug #3 Fixed**: Match queue displays scheduled matches
✅ **Automated test passes**: All 8 phases complete successfully
✅ **Firestore data**: All data stored in correct category-level paths
✅ **No regressions**: Existing functionality continues to work

---

## Notes for AI Coders

### Key Concepts

1. **Category Isolation**: Each tournament category has its own isolated data subcollection structure
2. **Two-Collection Pattern**:
   - `/match` = Bracket structure from brackets-manager (numeric status 0-4)
   - `/match_scores` = Operational data for UI (string status, courts, times)
3. **Status Precedence**: Always use `match_scores.status` when available (matches.ts:159)
4. **Path Consistency**: ALL operations must use category-level paths when working with match data

### Common Pitfalls

❌ Don't query `tournaments/{id}/match` - brackets are category-isolated
❌ Don't make categoryId optional in scheduler - it's required for correct paths
❌ Don't write to tournament-level `/match_scores` - data won't be readable
✅ Always use category-level paths: `tournaments/{id}/categories/{catId}/match`
✅ Always pass categoryId to scheduling functions
✅ Always verify Firestore paths in console during development

### Debug Commands

```javascript
// Check if matches exist
const matches = await getDocs(
  collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'match')
);
console.log('Matches:', matches.size, matches.docs.map(d => d.id));

// Check if match_scores exist
const scores = await getDocs(
  collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'match_scores')
);
console.log('Match scores:', scores.size, scores.docs.map(d => d.data()));
```

---

**Ready for implementation!** 🚀

Any questions? Check the code references above or refer to the exploration notes from the Explore agents.
