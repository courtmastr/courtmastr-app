# Phase 9: Bracket Real-Time Updates

**Status:** 🔴 **READY FOR IMPLEMENTATION**
**Branch:** `feature/minimal-bracket-collections`
**Safe Checkpoint:** Commit `40afacd` (Phase 8 complete)
**Priority:** P0 - Critical production blocker
**Estimated Time:** 1-2 hours
**Assigned To:** AI Coder

---

## 🎯 Objectives

Fix critical bug where bracket visualization does not update in real-time when matches are completed.

### Critical Issue
- ❌ User completes match scores
- ✅ Data saves to Firestore (confirmed)
- ✅ Activity feed updates immediately (working)
- ❌ **Bracket visualization stays STALE** (broken)
- ❌ User must manually change category to see updated bracket

### Success Criteria
- ✅ Bracket updates within 1-2 seconds after match completion
- ✅ No manual refresh required
- ✅ Syncs with activity feed behavior
- ✅ No memory leaks
- ✅ No console errors

---

## 📋 Pre-Implementation Checklist

Before starting, verify:
- [ ] You're on branch `feature/minimal-bracket-collections`
- [ ] Current commit is `40afacd` or later (Phase 8 complete)
- [ ] All changes are committed (clean working directory)
- [ ] You have reviewed this entire document

```bash
# Verify current state
git status
git log --oneline -1
```

---

## 🔍 Root Cause Analysis

### The Problem

**From User Testing:**
1. User enters match scores → Cloud function processes → Firestore updated ✅
2. Activity feed shows: "David Evans defeated opponent (21-0, 21-0) on Court 2" ✅
3. BUT: Bracket visualization does not show the update ❌
4. User says: "The updates have the results, but it is not showing up"

### Why This Happens

**Current Implementation (`BracketsManagerViewer.vue`):**
```typescript
// Lines 98-157: ONE-TIME FETCH
async function fetchBracketData() {
  const stageData = await storage.select('stage') as Stage[] | null;
  // ... fetches all data ONCE
  renderBracket();
}

// Lines 208-215: ONLY FETCHES ON MOUNT AND PROP CHANGE
onMounted(async () => {
  await fetchBracketData();  // Fetch once on mount
});

watch(() => props.categoryId, async () => {
  await fetchBracketData();  // Only when category changes
});
```

**The Issue:**
- Uses `getDocs()` (one-time fetch) instead of `onSnapshot()` (real-time listener)
- No listener to detect when Firestore documents change
- Bracket renders once and never updates until component remounts

### Why Activity Feed Works But Brackets Don't

| Component | Pattern | Updates |
|-----------|---------|---------|
| **Activity Feed** | `onSnapshot()` listener | ✅ Immediate |
| **Match Store** | `onSnapshot()` listener | ✅ Immediate |
| **Brackets Viewer** | `getDocs()` one-time | ❌ Never |

**Activity Feed Code (`src/stores/activities.ts` line 101):**
```typescript
activitiesUnsubscribe = onSnapshot(
  query(...),
  (snapshot) => {
    activities.value = snapshot.docs.map(...);  // ✅ Updates immediately
  }
);
```

**Brackets Viewer:**
- ❌ No `onSnapshot()` listeners
- ❌ No real-time updates

---

## 🔧 Implementation Guide

### File to Modify

**`src/features/brackets/components/BracketsManagerViewer.vue`**

Location: `/Users/ramc/Documents/Code/courtmaster-v2/src/features/brackets/components/BracketsManagerViewer.vue`

---

### Step 1: Import Real-Time Firestore Functions

**Find the imports section (around line 1-10):**
```typescript
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { db } from '@/services/firebase';
import type { Stage, Match, Participant, MatchGame } from 'brackets-model';
import { ClientFirestoreStorage } from '@/services/brackets-storage';
import { loadBracketsViewer } from '@/services/brackets-viewer-loader';
```

**Add these imports:**
```typescript
import { onSnapshot, collection, type Unsubscribe } from 'firebase/firestore';
```

**After adding, imports should look like:**
```typescript
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { db } from '@/services/firebase';
import { onSnapshot, collection, type Unsubscribe } from 'firebase/firestore';
import type { Stage, Match, Participant, MatchGame } from 'brackets-model';
import { ClientFirestoreStorage } from '@/services/brackets-storage';
import { loadBracketsViewer } from '@/services/brackets-viewer-loader';
```

**Note:** Also add `onUnmounted` to the vue imports (you'll need it later).

---

### Step 2: Add Unsubscribe Variables

**Find the refs section (around line 20-30), after existing ref declarations:**
```typescript
const loading = ref(false);
const error = ref<string | null>(null);
const currentTournamentId = ref<string>('');
const currentCategoryId = ref<string>('');
```

**Add after the existing refs:**
```typescript
// Real-time listener unsubscribe functions
let matchUnsubscribe: Unsubscribe | null = null;
let matchGameUnsubscribe: Unsubscribe | null = null;
let matchScoresUnsubscribe: Unsubscribe | null = null;
```

**Reason:** These variables store the unsubscribe functions returned by `onSnapshot()`, allowing us to cleanup listeners properly.

---

### Step 3: Create setupRealtimeListeners Function

**Location:** Add this function AFTER `fetchBracketData()` (around line 158)

**Add this complete function:**
```typescript
/**
 * Setup real-time listeners for bracket data collections
 * Automatically refreshes bracket when matches/scores update in Firestore
 *
 * Listeners:
 * - /match collection: Bracket structure changes
 * - /match_game collection: Game result changes
 * - /match_scores collection: Operational data changes (status, scores)
 */
function setupRealtimeListeners() {
  // Cleanup any existing listeners first to avoid duplicates
  cleanupRealtimeListeners();

  console.log(`🔄 [BracketsViewer] Setting up real-time listeners for category ${props.categoryId}`);

  const basePath = `tournaments/${props.tournamentId}/categories/${props.categoryId}`;

  // Listener 1: Match collection (bracket structure changes)
  const matchPath = `${basePath}/match`;
  matchUnsubscribe = onSnapshot(
    collection(db, matchPath),
    (snapshot) => {
      console.log(`   🔄 Match collection changed (${snapshot.docChanges().length} changes)`);
      // Re-fetch and re-render bracket when structure changes
      fetchBracketData();
    },
    (error) => {
      console.error(`   ❌ Error listening to matches:`, error);
    }
  );

  // Listener 2: Match_game collection (game results)
  const matchGamesPath = `${basePath}/match_game`;
  matchGameUnsubscribe = onSnapshot(
    collection(db, matchGamesPath),
    (snapshot) => {
      console.log(`   🔄 Match_game collection changed (${snapshot.docChanges().length} changes)`);
      fetchBracketData();
    },
    (error) => {
      console.error(`   ❌ Error listening to match_games:`, error);
    }
  );

  // Listener 3: Match_scores collection (operational data - status, scores)
  const matchScoresPath = `${basePath}/match_scores`;
  matchScoresUnsubscribe = onSnapshot(
    collection(db, matchScoresPath),
    (snapshot) => {
      console.log(`   🔄 Match_scores collection changed (${snapshot.docChanges().length} changes)`);
      fetchBracketData();
    },
    (error) => {
      console.error(`   ❌ Error listening to match_scores:`, error);
    }
  );

  console.log(`✅ [BracketsViewer] Real-time listeners active`);
}
```

**Key Points:**
- Creates 3 separate listeners for 3 collections
- Each listener calls `fetchBracketData()` when changes are detected
- Includes error handlers for each listener
- Logs all listener activity for debugging

---

### Step 4: Create cleanupRealtimeListeners Function

**Location:** Add immediately after `setupRealtimeListeners()` function

**Add this complete function:**
```typescript
/**
 * Cleanup all real-time listeners
 * CRITICAL: Must be called on unmount and when category changes to prevent memory leaks
 *
 * Called by:
 * - onUnmounted() hook
 * - watch() when categoryId changes
 * - setupRealtimeListeners() to cleanup before creating new listeners
 */
function cleanupRealtimeListeners() {
  console.log(`🧹 [BracketsViewer] Cleaning up real-time listeners`);

  if (matchUnsubscribe) {
    matchUnsubscribe();
    matchUnsubscribe = null;
  }

  if (matchGameUnsubscribe) {
    matchGameUnsubscribe();
    matchGameUnsubscribe = null;
  }

  if (matchScoresUnsubscribe) {
    matchScoresUnsubscribe();
    matchScoresUnsubscribe = null;
  }
}
```

**Key Points:**
- Calls each unsubscribe function if it exists
- Sets variables to `null` after unsubscribing
- Prevents memory leaks by removing unused listeners

---

### Step 5: Update onMounted Hook

**Find the existing `onMounted` hook (around line 208):**
```typescript
onMounted(async () => {
  await loadBracketsViewer();
  await fetchBracketData();
});
```

**Replace with:**
```typescript
onMounted(async () => {
  await loadBracketsViewer();
  await fetchBracketData();
  setupRealtimeListeners(); // Add real-time listeners after initial fetch
});
```

**Change:** Add `setupRealtimeListeners()` call after the initial data fetch.

---

### Step 6: Update watch Hook

**Find the existing `watch` hook (around line 212):**
```typescript
watch(() => props.categoryId, async () => {
  await fetchBracketData();
});
```

**Replace with:**
```typescript
watch(() => props.categoryId, async () => {
  cleanupRealtimeListeners(); // Cleanup old listeners
  await fetchBracketData();
  setupRealtimeListeners(); // Setup new listeners for new category
});
```

**Changes:**
1. Call `cleanupRealtimeListeners()` BEFORE fetching new data
2. Call `setupRealtimeListeners()` AFTER fetching new data

**Reason:** When category changes, we need to unsubscribe from old category's listeners and subscribe to new category's listeners.

---

### Step 7: Add onUnmounted Hook

**Location:** Add immediately after the `watch` hook (around line 216)

**Add this new hook:**
```typescript
onUnmounted(() => {
  cleanupRealtimeListeners(); // Cleanup on component unmount
});
```

**Reason:** When component is destroyed, we MUST cleanup all listeners to prevent memory leaks.

---

## 📝 Complete Modified Code Section

After all changes, your lifecycle hooks section should look like this:

```typescript
// Lifecycle hooks
onMounted(async () => {
  await loadBracketsViewer();
  await fetchBracketData();
  setupRealtimeListeners();
});

watch(() => props.categoryId, async () => {
  cleanupRealtimeListeners();
  await fetchBracketData();
  setupRealtimeListeners();
});

onUnmounted(() => {
  cleanupRealtimeListeners();
});
```

---

## 🧪 Testing & Verification

### Build Test

```bash
# Clean build
npm run build

# Expected: ✅ Build succeeds with no TypeScript errors
```

**If build fails:**
- Check that all imports are correct
- Verify `onUnmounted` is imported from 'vue'
- Verify `onSnapshot`, `collection`, `Unsubscribe` are imported from 'firebase/firestore'

---

### Manual Testing - Step by Step

#### Test 1: Real-Time Update After Match Completion

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Navigate to tournament brackets:**
   - Open browser to `http://localhost:5173`
   - Login if required
   - Navigate to a tournament (e.g., "Test Tournament 2025")
   - Click on a category with a bracket (e.g., "Men's Singles")
   - Verify bracket displays correctly

3. **Open browser console (F12):**
   - Look for log messages:
     ```
     🔄 [BracketsViewer] Setting up real-time listeners for category O0GZk32ZWr4md8Oq5aN3
     ✅ [BracketsViewer] Real-time listeners active
     ```
   - If you see these, listeners are active ✅

4. **Complete a match in another tab/window:**
   - Open a new tab with same tournament
   - Navigate to "Match Control" view
   - Select a match that's "In Progress" or "Ready to Start"
   - Click "ENTER SCORES"
   - Enter scores (e.g., Game 1: 21-0, Game 2: 21-0)
   - Click "SAVE SCORES"

5. **Verify bracket updates automatically:**
   - **Switch back to the bracket tab** (don't refresh!)
   - **Within 1-2 seconds**, you should see:
     - Console log: `🔄 Match_scores collection changed (1 changes)`
     - Console log: `🔍 Fetching bracket data for: ...`
     - Console log: `✅ Bracket rendered successfully`
     - **Bracket visual updates to show winner ✅**

6. **Expected Results:**
   - ✅ Match status updates in bracket
   - ✅ Winner is shown
   - ✅ Winner advances to next round (if applicable)
   - ✅ Activity feed shows completion
   - ✅ NO page refresh required

**If bracket does NOT update:**
- Check console for errors
- Verify listeners are active (see logs from step 3)
- Check that Firestore emulator is running
- Verify match completion succeeded (check activity feed)

---

#### Test 2: Category Change (Listener Cleanup)

1. **With bracket view open:**
   - Note current category (e.g., "Men's Singles")
   - Check console shows: `✅ [BracketsViewer] Real-time listeners active`

2. **Change to different category:**
   - Click on another category (e.g., "Mixed Doubles")

3. **Verify cleanup and re-setup:**
   - Console should show:
     ```
     🧹 [BracketsViewer] Cleaning up real-time listeners
     🔍 Fetching bracket data for: [new category]
     🔄 [BracketsViewer] Setting up real-time listeners for category [new category ID]
     ✅ [BracketsViewer] Real-time listeners active
     ```

4. **Expected Results:**
   - ✅ Old listeners cleaned up
   - ✅ New listeners created for new category
   - ✅ Bracket loads for new category
   - ✅ Real-time updates work for new category

---

#### Test 3: Component Unmount (Memory Leak Prevention)

1. **Navigate away from bracket view:**
   - Click on "Match Control" or any other view

2. **Check console for cleanup:**
   - Should see: `🧹 [BracketsViewer] Cleaning up real-time listeners`

3. **Navigate back to brackets:**
   - Should see listeners re-created:
     ```
     🔄 [BracketsViewer] Setting up real-time listeners...
     ✅ [BracketsViewer] Real-time listeners active
     ```

4. **Expected Results:**
   - ✅ Listeners cleanup when leaving view
   - ✅ Listeners re-created when returning
   - ✅ No memory leaks
   - ✅ No orphaned listeners

---

#### Test 4: Multiple Brackets on Same Page

**If your app shows multiple brackets simultaneously:**

1. **Open page with multiple brackets:**
   - E.g., tournament overview showing all category brackets

2. **Complete a match in one category:**
   - Follow Test 1 steps

3. **Verify only affected bracket updates:**
   - ✅ Bracket for completed match updates
   - ✅ Other brackets remain unchanged
   - ✅ No cross-category interference

---

### Expected Console Output

**On initial mount:**
```
🔄 [BracketsViewer] Setting up real-time listeners for category O0GZk32ZWr4md8Oq5aN3
✅ [BracketsViewer] Real-time listeners active
📊 Found stage: {tournament_id: 'WeFNDCf96ordXAXAmYEn', name: "Men's Singles", ...}
📊 Loaded 31 matches, 0 match games, 12 participants
🎨 Rendering bracket: {stages: 1, matches: 31, matchGames: 0, participants: 12}
✅ Bracket rendered successfully
```

**After completing a match:**
```
🔄 Match_scores collection changed (1 changes)
🔍 Fetching bracket data for: O0GZk32ZWr4md8Oq5aN3 WeFNDCf96ordXAXAmYEn
📊 Found stage: {...}
📊 Loaded 31 matches, 0 match games, 12 participants
🎨 Rendering bracket: {stages: 1, matches: 31, matchGames: 0, participants: 12}
✅ Bracket rendered successfully
```

**On category change:**
```
🧹 [BracketsViewer] Cleaning up real-time listeners
🔍 Fetching bracket data for: O0GZk32ZWr4md8Oq5aN3 [new category ID]
🔄 [BracketsViewer] Setting up real-time listeners for category [new category ID]
✅ [BracketsViewer] Real-time listeners active
```

---

## 🚨 Troubleshooting

### Issue: Bracket doesn't update after match completion

**Symptoms:**
- Activity feed shows match completion
- Bracket stays unchanged
- No listener logs in console

**Solutions:**
1. Check console for errors
2. Verify listeners are active:
   ```
   Should see: ✅ [BracketsViewer] Real-time listeners active
   If missing: Listeners didn't setup correctly
   ```
3. Check Firestore emulator is running:
   ```bash
   firebase emulators:start
   ```
4. Verify match completion succeeded (check activity feed)
5. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)

---

### Issue: Build fails with TypeScript errors

**Error:** `Cannot find name 'onSnapshot'` or `Cannot find name 'Unsubscribe'`

**Solution:**
Add missing import:
```typescript
import { onSnapshot, collection, type Unsubscribe } from 'firebase/firestore';
```

**Error:** `Cannot find name 'onUnmounted'`

**Solution:**
Add `onUnmounted` to vue imports:
```typescript
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
```

---

### Issue: Infinite loop - bracket keeps re-fetching

**Symptoms:**
- Console flooded with "Fetching bracket data" messages
- Bracket flickers constantly
- Browser becomes slow

**Cause:** Listener triggering itself (writing to same collection it's listening to)

**Solution:**
1. Check if `fetchBracketData()` writes to any of the collections we're listening to
2. If yes, add logic to prevent write-then-listen loops
3. Review cloud function to ensure it doesn't create infinite updates

---

### Issue: Multiple listeners not cleaning up

**Symptoms:**
- Console shows multiple "🔄 Match collection changed" messages for single change
- Memory usage increases over time

**Solution:**
1. Verify `cleanupRealtimeListeners()` is called in `watch` and `onUnmounted`
2. Check that unsubscribe functions are actually being called
3. Add debugging logs to confirm cleanup:
   ```typescript
   if (matchUnsubscribe) {
     console.log('🧹 Unsubscribing from match listener');
     matchUnsubscribe();
   }
   ```

---

### Issue: Bracket updates but shows old data

**Symptoms:**
- Listener triggers
- Bracket re-renders
- But shows stale match data

**Solution:**
1. Check if Firestore data is actually updated (use Firestore console)
2. Verify `fetchBracketData()` is getting fresh data (not cached)
3. Add timestamp to logs to verify timing:
   ```typescript
   console.log(`🔍 Fetching at ${new Date().toISOString()}`);
   ```

---

## 📊 Performance Impact

### Before Fix
- **Initial load:** 1 request
- **After match completion:** No update (stale)
- **User experience:** Must manually refresh

### After Fix
- **Initial load:** 1 request
- **Real-time listeners:** 3 persistent connections (minimal bandwidth)
- **After match completion:** 1 request (auto-triggered)
- **User experience:** Updates within 1-2 seconds

### Optimization Considerations

**If you notice performance issues (multiple rapid updates):**

Add debouncing to `fetchBracketData()` calls:

```typescript
let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedFetchBracketData() {
  if (refreshTimeout) clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(() => {
    fetchBracketData();
  }, 500); // Wait 500ms after last change
}

// Then use in listeners:
matchUnsubscribe = onSnapshot(
  collection(db, matchPath),
  (snapshot) => {
    console.log(`   🔄 Match collection changed`);
    debouncedFetchBracketData(); // Use debounced version
  }
);
```

**When to add debouncing:**
- If bracket re-fetches more than 3 times per second
- If user experience is affected by flicker
- If network bandwidth is a concern

**When NOT to add debouncing:**
- Initial implementation (wait to see if it's needed)
- If updates are infrequent (< 1 per minute)
- If instant updates are critical for UX

---

## 📝 Code Review Checklist

Before submitting, verify:

### Imports
- [ ] `onSnapshot`, `collection`, `Unsubscribe` imported from 'firebase/firestore'
- [ ] `onUnmounted` imported from 'vue'
- [ ] No TypeScript errors

### Variables
- [ ] Three unsubscribe variables declared (`matchUnsubscribe`, `matchGameUnsubscribe`, `matchScoresUnsubscribe`)
- [ ] Variables typed as `Unsubscribe | null`

### Functions
- [ ] `setupRealtimeListeners()` function added with 3 listeners
- [ ] `cleanupRealtimeListeners()` function added
- [ ] Both functions have console logs for debugging

### Lifecycle Hooks
- [ ] `onMounted()` calls `setupRealtimeListeners()` after `fetchBracketData()`
- [ ] `watch()` cleans up old listeners before setting up new ones
- [ ] `onUnmounted()` hook added and calls `cleanupRealtimeListeners()`

### Testing
- [ ] Build succeeds with no errors
- [ ] Brackets display correctly on initial load
- [ ] Brackets update within 1-2 seconds after match completion
- [ ] Console shows listener setup/cleanup logs
- [ ] No memory leaks (verified by checking browser memory)

---

## 🔄 Commit Message

```bash
git add src/features/brackets/components/BracketsManagerViewer.vue

git commit -m "$(cat <<'EOF'
fix(brackets): add real-time listeners for instant bracket updates

Critical Fix: Brackets now update automatically when matches complete

Problem:
- User completes match → Firestore updates → Activity feed shows result ✅
- BUT bracket visualization stays stale ❌
- User must manually change category to see updated bracket

Root Cause:
- BracketsManagerViewer used one-time getDocs() fetch
- No onSnapshot() real-time listeners
- Bracket only fetched on mount or category prop change
- Other components (activity feed, match store) use listeners correctly

Solution:
- Add 3 real-time Firestore listeners to BracketsManagerViewer:
  1. /match collection - bracket structure changes
  2. /match_game collection - game result changes
  3. /match_scores collection - operational data changes
- Auto-refresh bracket when any collection changes
- Proper cleanup on unmount and category change

Implementation:
- Import onSnapshot, collection, Unsubscribe from firebase/firestore
- Add 3 unsubscribe variables (matchUnsubscribe, etc.)
- Create setupRealtimeListeners() function (3 listeners)
- Create cleanupRealtimeListeners() function
- Update onMounted() to setup listeners after initial fetch
- Update watch() to cleanup/setup on category change
- Add onUnmounted() to cleanup on component destroy

Testing:
✅ Bracket updates within 1-2 seconds after match completion
✅ No manual refresh required
✅ Syncs with activity feed behavior
✅ Listeners cleanup properly (no memory leaks)
✅ Console logs all listener activity for debugging

Performance:
- 3 persistent listener connections (minimal bandwidth)
- Auto-triggered re-fetch only when data changes
- No polling or wasteful requests
- Industry-standard Firestore pattern

Follows pattern from:
- src/stores/activities.ts (real-time listener example)
- src/stores/matches.ts (multiple listeners example)

Fixes: Phase 9 - Bracket real-time updates
Related: Phase 7c - Match scoring fixes
Impact: Critical UX improvement for tournament officials

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## 📚 Reference Documentation

### Firestore Real-Time Listeners
- **Official Docs:** https://firebase.google.com/docs/firestore/query-data/listen
- **onSnapshot API:** https://firebase.google.com/docs/reference/js/firestore_.md#onsnapshot

### Vue Lifecycle Hooks
- **onMounted:** https://vuejs.org/api/composition-api-lifecycle.html#onmounted
- **onUnmounted:** https://vuejs.org/api/composition-api-lifecycle.html#onunmounted
- **watch:** https://vuejs.org/api/reactivity-core.html#watch

### Pattern Examples in Codebase
- **Activity Feed:** `src/stores/activities.ts` lines 101-123
- **Match Store:** `src/stores/matches.ts` lines 188-221

---

## ✅ Success Metrics

After implementation, verify:

| Metric | Target | How to Verify |
|--------|--------|---------------|
| **Real-time update delay** | < 2 seconds | Complete match, time until bracket updates |
| **Console logs present** | Yes | Check for "🔄 [BracketsViewer]" logs |
| **Memory leaks** | None | Navigate away and back, check memory |
| **Build errors** | 0 | `npm run build` succeeds |
| **User satisfaction** | High | Bracket updates without manual refresh |

---

## 🎓 What You're Learning

This fix teaches:
1. **Real-time listeners** - Firestore's `onSnapshot()` for live updates
2. **Memory management** - Proper cleanup of listeners to prevent leaks
3. **Vue lifecycle** - Using `onMounted`, `watch`, `onUnmounted` correctly
4. **Component cleanup** - Managing resources across component lifecycle
5. **UX patterns** - Providing instant feedback like modern web apps

**Key Takeaway:** Always use real-time listeners for data that changes frequently. One-time fetches are only for data that never or rarely changes.

---

**Phase 9 Status:** 🔴 READY FOR IMPLEMENTATION
**Estimated Time:** 1-2 hours
**Difficulty:** Medium
**Priority:** P0 - Critical blocker
**Last Updated:** 2026-02-03
**Document Version:** 1.0
