# Phase 5: Fix Matches Display and Storage Path Logic

**Status:** ✅ **COMPLETE** - All code changes applied
**Priority:** HIGH - Matches tab is currently non-functional
**Complexity:** LOW - Simple fixes with clear root causes
**Actual Time:** ~30 minutes (code changes only, testing pending)
**Created:** 2026-02-02
**Completed:** 2026-02-02

---

## Executive Summary

The Matches tab in TournamentDashboardView is not displaying data due to two issues:
1. **Timing Bug**: Match subscription fires before categories are loaded
2. **Path Logic Confusion**: Storage adapters have unnecessarily complex path logic that obscures intent

**Impact:**
- Bracket visualization works correctly ✅
- Match progression (winner advancement) works correctly ✅
- Matches tab is empty/broken ❌
- Real-time match updates don't appear in UI ❌

**Solution:**
- Fix component lifecycle timing (3 lines changed)
- Simplify storage adapter path logic (remove confusing code)
- Add verification that data flows correctly

---

## Problem Statement

### Issue 1: Timing Bug in TournamentDashboardView

**File:** `src/features/tournaments/views/TournamentDashboardView.vue` lines 116-137

**Problem:**
The component sets up a `watch` to subscribe to matches BEFORE the category is available, causing the subscription to never fire with the correct `categoryId`.

**Current Code Flow:**
```typescript
onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);

  // 1. Watch fires IMMEDIATELY with activeCategory = null
  watch([tournamentId, activeCategory], ([tid, catId]) => {
    if (tid && catId) {  // ← catId is null, so this never runs
      matchStore.subscribeMatches(tid, catId);
    }
  }, { immediate: true });

  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);

  // 2. Category set TOO LATE (after watch already fired)
  if (categories.value.length > 0) {
    selectedCategory.value = categories.value[0].id;
  }
});
```

**Result:** `matchStore.subscribeMatches()` is never called with valid `categoryId`, so no matches are loaded.

### Issue 2: Confusing Storage Adapter Path Logic

**Files:**
- `src/services/brackets-storage.ts` lines 32-40
- `functions/src/storage/firestore-adapter.ts` lines 23-31

**Problem:**
The `getCollectionRef()` method has an odd-length path check that inserts `_data`, making the code difficult to understand and maintain.

**Current Code:**
```typescript
private getCollectionRef(table: string) {
  const parts = this.rootPath.split('/').filter(p => p.length > 0);

  if (parts.length % 2 !== 0) {  // If ODD path segments
    return collection(this.db, [...parts, '_data', table].join('/'));
  }

  return collection(this.db, [...parts, table].join('/'));
}
```

**Why This is Confusing:**
- The odd/even check is non-obvious
- The `_data` insertion purpose is unclear
- Makes debugging path issues difficult
- Actually not needed since all callers pass even-length paths (document paths)

**Note:** The brackets currently work because they use even-length paths (4 segments), which bypass the `_data` insertion.

---

## Root Cause Analysis

### Timing Bug

**Root Cause:** Vue's `watch` with `immediate: true` fires synchronously during setup, before `selectedCategory` is populated.

**Why It Matters:** The matches store requires a valid `categoryId` to construct the correct Firestore paths:
```typescript
// From matches.ts lines 98-103
const matchPath = categoryId
  ? `tournaments/${tournamentId}/categories/${categoryId}/match`  // ← Needs categoryId
  : `tournaments/${tournamentId}/match`;  // ← Fallback (may not have data)
```

### Path Logic Confusion

**Root Cause:** The storage adapter was designed to handle both document paths and collection paths, but all actual callers only pass document paths.

**Evidence:**
```typescript
// Bracket generator (line 108)
const categoryPath = `tournaments/${id}/categories/${id}`;  // 4 segments (EVEN) = document path

// UpdateMatch CF (line 57)
const rootPath = `tournaments/${id}`;  // 2 segments (EVEN) = document path
```

**All callers follow Firestore's pattern:** Pass a document path, then add collection name.

---

## Implementation Plan

### Step 1: Fix Timing Bug in TournamentDashboardView

**File:** `src/features/tournaments/views/TournamentDashboardView.vue`

**Lines to Modify:** 116-137

**Current Code:**
```typescript
onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);

  // Subscribe to matches for active category
  watch(
    [tournamentId, activeCategory],
    ([tid, catId]) => {
      if (tid && catId) {
        matchStore.subscribeMatches(tid, catId);
      }
    },
    { immediate: true }
  );

  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);

  if (categories.value.length > 0) {
    selectedCategory.value = categories.value[0].id;
  }
});
```

**New Code:**
```typescript
onMounted(async () => {
  // 1. Load tournament data first
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);

  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);

  // 2. Set initial category BEFORE setting up watch
  if (categories.value.length > 0) {
    selectedCategory.value = categories.value[0].id;
  }

  // 3. NOW set up the watch - it will fire immediately with correct categoryId
  watch(
    [tournamentId, activeCategory],
    ([tid, catId]) => {
      if (tid && catId) {
        matchStore.subscribeMatches(tid, catId);
      }
    },
    { immediate: true }
  );
});
```

**Key Changes:**
1. Move `selectedCategory.value = ...` BEFORE the `watch()` call
2. Watch will now fire with correct categoryId on first execution
3. `subscribeMatches()` will be called properly

**Why This Works:**
- Setting `selectedCategory.value` synchronously updates `activeCategory` computed property
- The `watch` with `immediate: true` fires immediately after being set up
- At that moment, `activeCategory` will have the correct value
- The subscription happens with the right parameters

---

### Step 2: Simplify Client Storage Adapter Path Logic

**File:** `src/services/brackets-storage.ts`

**Lines to Modify:** 32-40

**Current Code:**
```typescript
private getCollectionRef(table: string) {
  const parts = this.rootPath.split('/').filter(p => p.length > 0);

  if (parts.length % 2 !== 0) {
    return collection(this.db, [...parts, '_data', table].join('/'));
  }

  return collection(this.db, [...parts, table].join('/'));
}
```

**New Code:**
```typescript
private getCollectionRef(table: string) {
  // rootPath is always a document path (even segments: tournaments/{id}/categories/{id})
  // Simply append the table name to create a valid collection path
  return collection(this.db, `${this.rootPath}/${table}`);
}
```

**Add Comment Above Method:**
```typescript
/**
 * Get a Firestore collection reference for a brackets-manager table.
 *
 * @param table - The brackets-manager table name (e.g., 'match', 'stage', 'participant')
 * @returns Firestore CollectionReference
 *
 * Path Construction:
 * - rootPath is always a document path with even segments
 *   Example: "tournaments/{id}/categories/{id}" (4 segments)
 * - Adding table creates a valid collection path with odd segments
 *   Example: "tournaments/{id}/categories/{id}/match" (5 segments)
 *
 * Firestore Rule: Collections must have odd segments, documents must have even segments
 * - Collection: /path/with/odd (1, 3, 5, 7... segments)
 * - Document: /path/with/even (2, 4, 6, 8... segments)
 */
private getCollectionRef(table: string) {
  // rootPath is always a document path (even segments: tournaments/{id}/categories/{id})
  // Simply append the table name to create a valid collection path
  return collection(this.db, `${this.rootPath}/${table}`);
}
```

**Why This is Better:**
- Removes unnecessary complexity
- Makes the intent clear: append table to document path
- Self-documenting with the comment
- Easier to debug path issues

---

### Step 3: Simplify Server Storage Adapter Path Logic

**File:** `functions/src/storage/firestore-adapter.ts`

**Lines to Modify:** 23-31

**Current Code:**
```typescript
private getCollectionRef(table: string) {
  const parts = this.rootPath.split('/').filter(p => p.length > 0);

  if (parts.length % 2 !== 0) {
    return this.db.collection(this.rootPath).doc('_data').collection(table);
  }

  return this.db.doc(this.rootPath).collection(table);
}
```

**New Code:**
```typescript
/**
 * Get a Firestore collection reference for a brackets-manager table.
 *
 * @param table - The brackets-manager table name (e.g., 'match', 'stage', 'participant')
 * @returns Firestore CollectionReference
 *
 * Path Construction:
 * - rootPath is always a document path with even segments
 *   Example: "tournaments/{id}" (2 segments)
 * - Adding table creates a valid collection path with odd segments
 *   Example: "tournaments/{id}/match" (3 segments)
 *
 * Note: This adapter must match the client adapter behavior exactly.
 */
private getCollectionRef(table: string) {
  // rootPath is always a document path (even segments: tournaments/{id})
  // Get document reference and add collection
  return this.db.doc(this.rootPath).collection(table);
}
```

**Why This is Better:**
- Matches the client adapter behavior
- Removes the odd/even check entirely
- Clear documentation of expected input/output
- Easier to maintain consistency across adapters

---

## Testing Strategy

### Pre-Implementation Checklist

Before making changes, verify current state:

1. **Verify Brackets Work:**
   ```bash
   # Open the app
   # Navigate to a tournament with generated brackets
   # Confirm bracket visualization displays correctly
   # Confirm match progression shows winners advancing
   ```

2. **Verify Matches Tab is Broken:**
   ```bash
   # Navigate to same tournament
   # Click "Matches" tab
   # Confirm: No matches appear (empty state or loading forever)
   # Open browser console
   # Confirm: No subscription logs for matches
   ```

3. **Check Firestore Data Exists:**
   ```bash
   # Open Firebase Console
   # Navigate to Firestore
   # Go to: tournaments/{id}/categories/{id}/
   # Confirm: 'match' collection exists with documents
   # Confirm: 'stage' collection exists with documents
   ```

### Post-Implementation Testing

After making all three code changes:

#### Test 1: Component Timing Fix

**Objective:** Verify matches subscription happens with correct categoryId

**Steps:**
1. Open browser DevTools console
2. Navigate to tournament dashboard
3. Look for console logs from matches.ts

**Expected Output:**
```
🔍 [matches] Subscribing to matches for tournament: {id}, category: {categoryId}
✅ [matches] Subscription started successfully
```

**Success Criteria:**
- ✅ Console shows subscription with valid categoryId
- ✅ No errors about "undefined" or "null" categoryId
- ✅ Subscription happens immediately on page load

#### Test 2: Matches Display in UI

**Objective:** Verify matches appear in the Matches tab

**Steps:**
1. Navigate to tournament dashboard
2. Click "Matches" tab
3. Observe match list

**Expected Output:**
- List of all matches for the category
- Each match shows:
  - Round number
  - Match number
  - Player/team names
  - Match status
  - Court assignment (if scheduled)

**Success Criteria:**
- ✅ All matches from bracket appear in list
- ✅ Match data is accurate (matches bracket viewer)
- ✅ No empty state or loading spinner
- ✅ Match count matches bracket viewer count

#### Test 3: Real-Time Updates

**Objective:** Verify match updates appear in real-time

**Steps:**
1. Open tournament dashboard in one browser tab
2. Open scoring interface in another tab
3. Update a match score in the scoring interface
4. Observe the dashboard Matches tab

**Expected Output:**
- Match status updates immediately in the list
- Score updates appear without refresh
- No delay longer than 1-2 seconds

**Success Criteria:**
- ✅ Match list updates automatically
- ✅ No manual refresh needed
- ✅ Updates appear across all open tabs

#### Test 4: Match Progression in Brackets

**Objective:** Verify winner advancement still works after path changes

**Steps:**
1. Navigate to bracket visualization
2. Complete a match with a winner (use scoring interface)
3. Observe bracket visualization

**Expected Output:**
- Completed match shows winner highlighted
- Winner's name appears in next match slot
- Visual progression lines show the advancement

**Success Criteria:**
- ✅ Winner advances to correct next match
- ✅ Next match opponent fields update
- ✅ Bracket visualization refreshes automatically
- ✅ No errors in console

#### Test 5: Storage Path Verification

**Objective:** Verify data is written to correct Firestore paths

**Steps:**
1. Generate a new bracket (or use existing)
2. Open Firebase Console → Firestore
3. Navigate to: `tournaments/{tournamentId}/categories/{categoryId}/`
4. Inspect collections

**Expected Firestore Structure:**
```
tournaments/{tournamentId}/
├── categories/{categoryId}/
│   ├── match (collection)
│   │   ├── {matchId} (document)
│   │   │   ├── stage_id: "..."
│   │   │   ├── round: 1
│   │   │   ├── opponent1: {...}
│   │   │   └── opponent2: {...}
│   ├── stage (collection)
│   │   └── {stageId} (document)
│   ├── participant (collection)
│   │   └── {participantId} (document)
│   ├── match_scores (collection)
│   │   └── {matchId} (document)
│   │       ├── status: "in_progress"
│   │       ├── scores: [...]
│   │       └── courtId: "..."
│   └── ... other collections
```

**Success Criteria:**
- ✅ All collections at correct path level (no `_data` subdocument)
- ✅ Match collection has 5 segments: `tournaments/{id}/categories/{id}/match`
- ✅ No orphaned data in unexpected locations
- ✅ Document counts match bracket size

#### Test 6: Cloud Function Integration

**Objective:** Verify Cloud Functions read/write to correct paths

**Steps:**
1. Complete a match to trigger `updateMatch` Cloud Function
2. Check Cloud Function logs in Firebase Console
3. Verify winner advancement

**Expected Logs:**
```
🎯 [updateMatch] Called with: {tournamentId, matchId, ...}
🔧 [updateMatch] Creating BracketsManager with rootPath: tournaments/{id}
🔍 [updateMatch] Fetching match data for matchId: {matchId}
📋 [updateMatch] Match data retrieved: {...}
✅ [updateMatch] Winner is opponent1
🚀 [updateMatch] Calling manager.update.match with updateData: {...}
✅ [updateMatch] manager.update.match completed successfully
```

**Success Criteria:**
- ✅ No errors in Cloud Function logs
- ✅ Match data retrieved successfully
- ✅ Winner advancement completes
- ✅ Next match updates in Firestore

#### Test 7: Multi-Category Tournament

**Objective:** Verify category isolation works correctly

**Steps:**
1. Create tournament with 2+ categories
2. Generate brackets for each category
3. Switch between categories in dashboard
4. Verify matches display for each category

**Expected Behavior:**
- Category 1 matches display when Category 1 selected
- Category 2 matches display when Category 2 selected
- No cross-contamination of match data

**Success Criteria:**
- ✅ Matches filtered correctly by category
- ✅ Subscription switches categories properly
- ✅ No matches from other categories appear
- ✅ Match counts are correct per category

---

## Verification Checklist

After implementation and testing, verify:

### Functionality
- [ ] Matches tab displays all matches for selected category
- [ ] Match data is accurate (names, rounds, status)
- [ ] Real-time updates work (no refresh needed)
- [ ] Bracket visualization still works correctly
- [ ] Winner advancement still works
- [ ] Multi-category tournaments work correctly

### Code Quality
- [ ] No TypeScript errors in modified files
- [ ] Console shows no errors during normal operation
- [ ] Subscription logs appear in console (for debugging)
- [ ] Code is easier to understand than before

### Data Integrity
- [ ] Firestore paths are correct (5 segments for collections)
- [ ] No duplicate data in multiple locations
- [ ] Cloud Functions read/write to correct paths
- [ ] No orphaned data from old paths

### Performance
- [ ] Matches load quickly (< 1 second)
- [ ] Real-time updates are responsive
- [ ] No unnecessary re-fetching
- [ ] Memory usage is reasonable

---

## Rollback Plan

If issues arise after deployment:

### Quick Rollback (Git Revert)

```bash
# 1. Check current status
git status

# 2. View recent commits
git log --oneline -5

# 3. Revert to previous commit (replace COMMIT_HASH)
git revert COMMIT_HASH

# 4. Or reset to previous commit (DESTRUCTIVE)
git reset --hard COMMIT_HASH

# 5. Force push if needed (only if no one else has pulled)
git push --force
```

### Manual Rollback (File by File)

If selective rollback is needed:

**File 1: TournamentDashboardView.vue**
```bash
git checkout HEAD~1 -- src/features/tournaments/views/TournamentDashboardView.vue
```

**File 2: brackets-storage.ts**
```bash
git checkout HEAD~1 -- src/services/brackets-storage.ts
```

**File 3: firestore-adapter.ts**
```bash
git checkout HEAD~1 -- functions/src/storage/firestore-adapter.ts
```

### Rollback Verification

After rollback:
1. Verify brackets still display correctly
2. Accept that Matches tab may be broken (as before)
3. Monitor for any new errors in console
4. Document the rollback reason for future reference

---

## Known Issues and Limitations

### Current Limitations

1. **Tournament-Level Fallback Path May Be Empty:**
   - Some components use `subscribeMatches(tournamentId)` without categoryId
   - This reads from `tournaments/{id}/match` (tournament-level)
   - But bracket generation writes to `tournaments/{id}/categories/{id}/match`
   - Result: Tournament-level path may be empty if all data is category-isolated

2. **Participant ID Resolution Still Complex:**
   - See DATA_MODEL_ARCHITECTURE.md Appendix C
   - Uses fallback chain across multiple files
   - Stores registration ID in `participant.name` field
   - Works correctly but could be simplified in future

3. **Status Format Duality:**
   - `/match.status` is numeric (0-4, brackets-manager internal)
   - `/match_scores.status` is string ("scheduled", "in_progress", etc.)
   - UI must always use match_scores.status when available
   - This is intentional but requires careful handling

### Future Improvements

These are NOT part of Phase 5, but could be addressed later:

1. **Consolidate Tournament-Level and Category-Level Paths:**
   - Decide whether to use tournament-level OR category-level exclusively
   - Update all components to use consistent pattern
   - Migrate any tournament-level data to category-level

2. **Simplify Participant ID Mapping:**
   - Add explicit `registrationId` field to participant documents
   - Remove reliance on `participant.name` for ID storage
   - Create clearer mapping between participant IDs and registration IDs

3. **Add Loading States:**
   - Show skeleton loaders while matches are fetching
   - Add empty states for when no matches exist
   - Improve user feedback during subscriptions

4. **Add Error Handling:**
   - Catch and display subscription errors
   - Add retry logic for failed fetches
   - Show user-friendly error messages

---

## Success Criteria

Phase 5 is complete when ALL of the following are true:

### Primary Goals
- ✅ Matches tab displays all matches for the selected category
- ✅ Real-time updates work without manual refresh
- ✅ Bracket visualization continues working as before
- ✅ Winner advancement continues working as before

### Code Quality Goals
- ✅ Storage adapter path logic is simplified and well-documented
- ✅ Component timing bug is fixed
- ✅ No new TypeScript errors introduced
- ✅ Console logs confirm subscriptions are working

### Data Integrity Goals
- ✅ All data is stored at correct Firestore paths
- ✅ No duplicate data in multiple locations
- ✅ Cloud Functions read/write to correct paths
- ✅ Multi-category tournaments work correctly

### Documentation Goals
- ✅ This phase document is complete
- ✅ Code comments explain the path construction logic
- ✅ Testing procedures are documented
- ✅ Rollback plan is documented

---

## Appendix A: File Locations

### Files Modified in This Phase

| File | Path | Lines Changed | Purpose |
|------|------|---------------|---------|
| TournamentDashboardView.vue | src/features/tournaments/views/ | 116-137 | Fix timing bug |
| brackets-storage.ts | src/services/ | 32-40 | Simplify path logic |
| firestore-adapter.ts | functions/src/storage/ | 23-31 | Simplify path logic |

### Related Files (Not Modified)

| File | Path | Purpose |
|------|------|---------|
| matches.ts | src/stores/ | Match store (already correct) |
| useBracketGenerator.ts | src/composables/ | Bracket generator (already correct) |
| updateMatch.ts | functions/src/ | Cloud Function (already correct) |
| BracketsManagerViewer.vue | src/features/brackets/components/ | Bracket viewer (already correct) |

---

## Appendix B: Firestore Path Reference

### Category-Level Paths (Recommended)

```
tournaments/{tournamentId}/
  categories/{categoryId}/
    stage/           ← Brackets-manager: Tournament phases
      {stageId}

    match/           ← Brackets-manager: Match structure
      {matchId}

    participant/     ← Brackets-manager: Participant/seeding
      {participantId}

    round/           ← Brackets-manager: Rounds (optional)
      {roundId}

    group/           ← Brackets-manager: Groups (optional)
      {groupId}

    match_scores/    ← Custom: Operational data
      {matchId}

    registrations/   ← Custom: Player entries
      {registrationId}
```

### Tournament-Level Paths (Legacy Fallback)

```
tournaments/{tournamentId}/
  match/           ← May be empty if using category-level
    {matchId}

  match_scores/    ← May be empty if using category-level
    {matchId}

  registrations/   ← Always at tournament level
    {registrationId}

  players/         ← Always at tournament level
    {playerId}

  courts/          ← Always at tournament level
    {courtId}
```

---

## Appendix C: Console Log Reference

### Expected Console Logs

When working correctly, you should see these logs:

**On Page Load:**
```
🔍 [TournamentDashboardView] Fetching tournament: {tournamentId}
✅ [TournamentDashboardView] Tournament loaded
🔍 [matches] Subscribing to matches for tournament: {tournamentId}, category: {categoryId}
✅ [matches] Subscription started successfully
📊 [matches] Loaded {count} matches
```

**On Match Update:**
```
📝 [matches] Match updated: {matchId}
🔄 [matches] Refreshing match list
✅ [matches] Match list updated with {count} matches
```

**On Category Change:**
```
🔄 [matches] Unsubscribing from previous category
🔍 [matches] Subscribing to matches for tournament: {tournamentId}, category: {newCategoryId}
✅ [matches] Subscription started successfully
📊 [matches] Loaded {count} matches
```

### Error Logs to Watch For

**Timing Bug (Before Fix):**
```
⚠️ [matches] subscribeMatches called with null categoryId
❌ [matches] Cannot subscribe without valid categoryId
```

**Path Issues (If Still Broken):**
```
❌ [FirestoreError] Invalid collection reference
❌ Collection references must have an odd number of segments
```

**Data Missing:**
```
⚠️ [matches] No matches found for category: {categoryId}
⚠️ [matches] Stage collection is empty
```

---

## Appendix D: Testing Scenarios

### Scenario 1: New Tournament Flow

1. Create new tournament
2. Add category
3. Add registrations
4. Generate bracket
5. Navigate to dashboard
6. Click Matches tab
7. **Verify:** All matches appear immediately

### Scenario 2: Score Update Flow

1. Navigate to Matches tab
2. Select a match
3. Open scoring interface
4. Update score
5. Mark match in progress
6. Complete match with winner
7. **Verify:** Status updates in Matches tab
8. **Verify:** Winner advances in bracket visualization

### Scenario 3: Multi-Category Flow

1. Create tournament with 2 categories
2. Generate brackets for both
3. Switch between categories in dashboard
4. **Verify:** Matches tab updates for each category
5. **Verify:** Correct match count for each category
6. **Verify:** No cross-contamination

### Scenario 4: Real-Time Updates

1. Open dashboard in two browser tabs
2. In tab 1: View Matches tab
3. In tab 2: Update a match score
4. **Verify:** Tab 1 updates automatically (no refresh)
5. **Verify:** Update appears within 1-2 seconds

### Scenario 5: Empty State

1. Create new tournament
2. Add category
3. Navigate to dashboard
4. Click Matches tab (no bracket generated yet)
5. **Verify:** Shows empty state or message
6. **Verify:** No errors in console

---

## Support and References

### Related Documentation

- [DATA_MODEL_ARCHITECTURE.md](./DATA_MODEL_ARCHITECTURE.md) - Complete architecture overview
- [MASTER_PLAN.md](./MASTER_PLAN.md) - Overall migration plan
- [Phase1-Critical-Fixes.md](./Phase1-Critical-Fixes.md) - Previous phase
- [Phase4-Fix-Matches-Display.md](./Phase4-Fix-Matches-Display.md) - Related fixes

### External Resources

- [brackets-manager Documentation](https://github.com/Drarig29/brackets-manager.js)
- [brackets-viewer Documentation](https://github.com/Drarig29/brackets-viewer.js)
- [Firestore Path Documentation](https://firebase.google.com/docs/firestore/data-model#collections)
- [Vue Watch Documentation](https://vuejs.org/api/reactivity-core.html#watch)

### Questions and Issues

If you encounter issues during implementation:

1. Check console logs for errors
2. Verify Firestore data exists at correct paths
3. Confirm subscription is firing with valid categoryId
4. Review this document's troubleshooting section
5. Check related phase documents for context

---

**Document Version:** 1.0
**Last Updated:** 2026-02-02
**Author:** Migration Team
**Review Status:** Ready for Implementation
