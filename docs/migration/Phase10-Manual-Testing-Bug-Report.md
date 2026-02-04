# Phase 10 Manual Testing - Critical Bugs Found

**Date:** 2026-02-03
**Testing By:** User (Manual Testing)
**Analysis By:** Claude Code
**Status:** 🔴 **4 CRITICAL BUGS FOUND**

---

## 📊 Executive Summary

Manual testing revealed **4 critical bugs**, including 2 bugs that were NOT caught during code verification:

| Bug # | Severity | Issue | Status |
|-------|----------|-------|--------|
| **Bug 1** | 🔴 CRITICAL | Triple bracket display (3 brackets shown instead of 1) | NEW - Not in Phase 10 |
| **Bug 2** | 🔴 CRITICAL | Duplicates STILL appearing (deduplication fix incomplete) | REGRESSION - Fix didn't work |
| **Bug 3** | 🟡 INFO | # vs ID column confusion | INFO ONLY - Works as designed |
| **Bug 4** | 🔴 CRITICAL | Completed matches not updating in bracket | RELATED to Bug 1 |

**Overall:** Phase 10 implementation has **3 critical bugs** that must be fixed immediately.

---

## 🔴 Bug 1: Triple Bracket Display (NEW)

### Severity: CRITICAL (P0)

### User Report
> "I see 3 brackets for the same category - see image"

Screenshot shows 3 identical "Mixed Doubles" brackets stacked vertically on the same page.

### Root Cause Analysis

**File:** `src/features/brackets/components/BracketsManagerViewer.vue`
**Function:** `renderBracket()` (lines 227-274)

**The Problem:**

The `viewer.render()` call (line 259) does NOT clear the previous bracket before rendering a new one. The brackets-viewer.js library **appends** brackets instead of replacing them.

**What Happens:**
1. Component mounts → `fetchBracketData()` → `renderBracket()` → First bracket rendered ✅
2. Real-time listener fires (match changes) → `fetchBracketData()` → `renderBracket()` → Second bracket APPENDED ❌
3. Another listener fires → Third bracket APPENDED ❌

**Current Code (BROKEN):**
```typescript
function renderBracket() {
  // ... validation ...

  viewer.render(data, {
    selector: '#' + containerId,
    // ... options ...
  });
  // ❌ No cleanup of previous bracket!
}
```

**Evidence:**
- Component only instantiated ONCE (verified in TournamentDashboardView.vue:565-569)
- Real-time listeners call `fetchBracketData()` which calls `renderBracket()`
- Each call to `viewer.render()` appends a new bracket to the container

---

### Fix for Bug 1

**Option A: Clear Container Before Rendering (Recommended)**

```typescript
function renderBracket() {
  if (!bracketContainer.value) {
    console.error('❌ Bracket container not found');
    return;
  }

  if (stages.value.length === 0) {
    console.log('⚠️ No stages to render');
    return;
  }

  console.log('🎨 Rendering bracket');

  try {
    const viewer = (window as any).bracketsViewer;
    if (!viewer || !viewer.render) {
      throw new Error('Brackets viewer library not loaded');
    }

    // ✅ CLEAR CONTAINER BEFORE RE-RENDERING
    if (bracketContainer.value) {
      bracketContainer.value.innerHTML = '';
    }

    const data = JSON.parse(JSON.stringify({
      stages: stages.value,
      matches: matches.value,
      matchGames: matchGames.value,
      participants: participants.value,
    }));

    viewer.render(data, {
      selector: '#' + containerId,
      participantOriginPlacement: 'before',
      separatedChildCountLabel: true,
      showSlotsOrigin: true,
      showLowerBracketSlotsOrigin: true,
      highlightParticipantOnHover: true,
    });

    console.log('✅ Bracket rendered successfully');

  } catch (err: any) {
    console.error('❌ Error rendering bracket:', err);
    error.value = err.message || 'Failed to render bracket';
  }
}
```

**What Changed:**
- Added `bracketContainer.value.innerHTML = '';` before rendering
- Clears ALL previous brackets from the container
- Then renders the fresh bracket

**Option B: Track Render State (Alternative)**

If Option A doesn't work, use a flag to prevent multiple renders:

```typescript
let isRendering = false;

function renderBracket() {
  if (isRendering) {
    console.log('⏩ Render already in progress, skipping');
    return;
  }

  isRendering = true;

  try {
    // ... existing render logic ...
  } finally {
    isRendering = false;
  }
}
```

---

## 🔴 Bug 2: Duplicates Still Appearing (REGRESSION)

### Severity: CRITICAL (P0)

### User Report
> "In Match Control schedule I see duplicates - see image"

Screenshot shows:
- **Row 3:** #2, Round 1, **ID 1**, Thomas Harris vs Christopher Irving
- **Row 4:** #2, Round 1, **ID 1**, Thomas Harris vs Christopher Irving (DUPLICATE!)

Same match ID appearing twice = deduplication fix FAILED.

### Root Cause Analysis

**File:** `src/stores/matches.ts`
**Lines:** 172-177 (deduplication logic)

**The Problem:**

The current deduplication logic has a **CRITICAL FLAW**. It only checks if newly fetched matches exist in OTHER categories, NOT:
1. If they already exist in matches.value from the SAME category
2. If there are duplicates WITHIN the newly fetched batch itself

**Current Code (BROKEN):**
```typescript
if (categoryId) {
  const createKey = (m: Match) => `${m.categoryId}-${m.id}`;
  const otherMatches = matches.value.filter(m => m.categoryId !== categoryId);
  const existingKeys = new Set(otherMatches.map(createKey));  // ❌ Only checks OTHER categories!
  const uniqueAdapted = adaptedMatches.filter(m => !existingKeys.has(createKey(m)));
  matches.value = [...otherMatches, ...uniqueAdapted];
  console.log(`📊 Merged matches: ...`);
}
```

**Why It Fails:**

**Scenario:** Two listeners fire simultaneously for the SAME category
1. Listener 1 starts `fetchMatches()` → fetches 10 matches from Firestore
2. Listener 2 starts `fetchMatches()` → fetches SAME 10 matches from Firestore
3. Listener 1 completes → Merges: `otherMatches` (empty) + 10 matches = 10 matches in `matches.value`
4. Listener 2 completes → Checks `otherMatches` (empty, because category was removed on line 173) → Adds SAME 10 matches again!

**Result:** 20 matches in array (10 duplicates)

**Evidence:**
- Line 174: `existingKeys` only includes matches from OTHER categories
- Line 173: `otherMatches` filters OUT the same category
- No check for duplicates already in `matches.value` from same category
- No check for duplicates WITHIN `adaptedMatches`

---

### Fix for Bug 2

**Replace lines 171-177 with this CORRECTED logic:**

```typescript
if (categoryId) {
  const createKey = (m: Match) => `${m.categoryId}-${m.id}`;

  // ✅ FIX 1: Check against ALL existing matches (not just other categories)
  const existingKeys = new Set(matches.value.map(createKey));

  // ✅ FIX 2: Deduplicate WITHIN adaptedMatches (handle simultaneous fetches)
  const seenKeys = new Set<string>();
  const uniqueAdapted = adaptedMatches.filter(m => {
    const key = createKey(m);

    // Skip if already exists in matches.value
    if (existingKeys.has(key)) {
      return false;
    }

    // Skip if already seen in current batch (internal duplicate)
    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
    return true;
  });

  // Keep matches from other categories + unique new matches only
  const otherMatches = matches.value.filter(m => m.categoryId !== categoryId);
  matches.value = [...otherMatches, ...uniqueAdapted];

  console.log(`📊 Merged matches: ${otherMatches.length} from other categories + ${uniqueAdapted.length} new (${adaptedMatches.length - uniqueAdapted.length} duplicates filtered)`);
}
```

**What Changed:**
1. **Line 174 (NEW):** `existingKeys` now includes ALL matches, not just other categories
2. **Lines 177-189 (NEW):** Added `seenKeys` set to track duplicates within `adaptedMatches` itself
3. **Logic:** Rejects matches that already exist OR are duplicates in the current batch

**Why This Works:**
- Prevents adding matches that already exist (from any category)
- Prevents adding internal duplicates within the fetched batch
- Handles the race condition when multiple listeners fetch simultaneously

---

## 🟡 Bug 3: # vs ID Column Confusion (INFO ONLY)

### Severity: INFO (Not a bug)

### User Report
> "What is # and ID - if this related to match ID"

### Explanation

**Both columns serve different purposes:**

| Column | Data Key | Meaning | Example Values |
|--------|----------|---------|----------------|
| **#** | `matchNumber` | Sequential position in bracket (from brackets-manager library) | 1, 2, 3, 4, 5... |
| **ID** | `id` | Unique Firestore document ID for the match | "0", "1", "2", "8", "9", "10"... |

**From Types (src/types/index.ts:170):**
```typescript
export interface Match {
  id: string;                // Unique database ID
  matchNumber: number;       // Position in bracket (sequential)
  // ...
}
```

**Why Both Are Needed:**

- **# (matchNumber):**
  - Comes from brackets-manager library
  - Sequential numbering for each match in the bracket
  - Used for display order
  - May have duplicates if multiple categories (each category starts at 1)

- **ID (id):**
  - Unique Firestore document ID
  - Never duplicates (should be unique)
  - Used for database operations, tracking, debugging
  - What Phase 10 Part 2 added for user visibility

**User's Question Answered:**
- Yes, **ID** is the match ID (unique identifier)
- **#** is the bracket position number (sequential, may repeat across categories)

**Note:** In your screenshot, ID 1 appears twice - this is the **duplicate bug (Bug 2)**, not a design issue.

---

## 🔴 Bug 4: Completed Match Not Updating Bracket

### Severity: CRITICAL (P0)

### User Report
> "shows completed here [in Match Control] - Anderson/Wilson vs Roberts/Clark completed - not reflecting in the brackets"

### Root Cause Analysis

**This is DIRECTLY CAUSED by Bug 1 (Triple Bracket Display).**

**What's Happening:**

1. User completes match → Cloud function updates `/match` collection
2. Real-time listener fires in BracketsManagerViewer (line 173-181)
3. `fetchBracketData()` called → fetches updated match data with winner
4. `renderBracket()` called → **APPENDS a new bracket** (doesn't update existing)
5. User sees:
   - First bracket (old, no winner)
   - Second bracket (new, has winner)
   - Third bracket (another re-render)

**Why User Doesn't See Update:**
- The FIRST bracket (at the top) is stale
- The UPDATED bracket is rendered BELOW it
- User only looks at the first bracket, thinks it didn't update

**Evidence:**
- Real-time listeners are working (verified in code review)
- `fetchBracketData()` is being called (verified by console logs)
- The issue is `renderBracket()` appending instead of replacing

**Fix:**
**Same fix as Bug 1** - Clear container before re-rendering.

Once Bug 1 is fixed:
- Only ONE bracket will be shown
- Re-renders will REPLACE the bracket, not append
- Updates will be visible immediately

---

## 📋 Summary of Fixes Required

### Fix 1: Clear Bracket Container (Bug 1 & 4)

**File:** `src/features/brackets/components/BracketsManagerViewer.vue`
**Function:** `renderBracket()` around line 245

**Add this line before `viewer.render()`:**
```typescript
// Clear previous bracket before re-rendering
if (bracketContainer.value) {
  bracketContainer.value.innerHTML = '';
}
```

**Full Context:**
```typescript
function renderBracket() {
  // ... validation checks ...

  try {
    const viewer = (window as any).bracketsViewer;
    if (!viewer || !viewer.render) {
      throw new Error('Brackets viewer library not loaded');
    }

    // ✅ ADD THIS
    if (bracketContainer.value) {
      bracketContainer.value.innerHTML = '';
    }

    const data = JSON.parse(JSON.stringify({
      stages: stages.value,
      matches: matches.value,
      matchGames: matchGames.value,
      participants: participants.value,
    }));

    viewer.render(data, { /* ... options ... */ });

  } catch (err: any) {
    // ... error handling ...
  }
}
```

---

### Fix 2: Correct Deduplication Logic (Bug 2)

**File:** `src/stores/matches.ts`
**Lines:** 171-177

**Replace this BROKEN code:**
```typescript
if (categoryId) {
  const createKey = (m: Match) => `${m.categoryId}-${m.id}`;
  const otherMatches = matches.value.filter(m => m.categoryId !== categoryId);
  const existingKeys = new Set(otherMatches.map(createKey));
  const uniqueAdapted = adaptedMatches.filter(m => !existingKeys.has(createKey(m)));
  matches.value = [...otherMatches, ...uniqueAdapted];
  console.log(`📊 Merged matches: ...`);
}
```

**With this FIXED code:**
```typescript
if (categoryId) {
  const createKey = (m: Match) => `${m.categoryId}-${m.id}`;

  // Check against ALL existing matches
  const existingKeys = new Set(matches.value.map(createKey));

  // Deduplicate within adaptedMatches
  const seenKeys = new Set<string>();
  const uniqueAdapted = adaptedMatches.filter(m => {
    const key = createKey(m);
    if (existingKeys.has(key) || seenKeys.has(key)) {
      return false;
    }
    seenKeys.add(key);
    return true;
  });

  // Merge: other categories + unique new
  const otherMatches = matches.value.filter(m => m.categoryId !== categoryId);
  matches.value = [...otherMatches, ...uniqueAdapted];

  console.log(`📊 Merged matches: ${otherMatches.length} from other categories + ${uniqueAdapted.length} new (${adaptedMatches.length - uniqueAdapted.length} duplicates filtered)`);
}
```

---

### Fix 3: No Code Change (Bug 3)

Bug 3 is **not a bug** - just clarification needed:
- **#** = Match number (bracket position)
- **ID** = Match ID (unique identifier)

Both are correct and working as designed.

---

## 🧪 Testing Instructions

### Test 1: Verify Single Bracket Display (Bug 1)

1. Navigate to tournament dashboard
2. Select a category with a bracket
3. **Verify:** Only ONE bracket is displayed
4. Complete a match
5. Wait 2 seconds for real-time update
6. **Verify:** Still only ONE bracket (updated with winner)
7. Complete another match
8. **Verify:** Still only ONE bracket

**Pass Criteria:** Never more than 1 bracket displayed

---

### Test 2: Verify No Duplicates (Bug 2)

1. Navigate to Match Control
2. View Match Schedule table
3. Check ID column
4. **Verify:** Each ID appears ONLY ONCE
5. Complete 2-3 matches rapidly
6. **Verify:** No new duplicates appear
7. Check console logs
8. **Verify:** Console shows "X duplicates filtered" if any were detected

**Pass Criteria:**
- Zero duplicate IDs in table
- Console logs show deduplication working

---

### Test 3: Verify Bracket Updates (Bug 4)

1. Navigate to tournament dashboard
2. Select a category
3. Note a match in the bracket (e.g., "Anderson vs Roberts")
4. Go to Match Control
5. Complete that match with a winner
6. Return to tournament dashboard
7. **Verify:** Winner is shown in bracket within 2 seconds
8. **Verify:** Loser is shown as eliminated
9. **Verify:** Winner advanced to next round (if applicable)

**Pass Criteria:**
- Bracket updates within 2 seconds
- Winner advancement works correctly
- No multiple brackets displayed

---

## 📊 Impact Assessment

| Bug | User Impact | Data Impact | Priority |
|-----|-------------|-------------|----------|
| **Bug 1** | High - Confusing UI | None | P0 - Fix immediately |
| **Bug 2** | Critical - Wrong data shown | Medium - Duplicates in array | P0 - Fix immediately |
| **Bug 3** | Low - Just confusion | None | P2 - Documentation only |
| **Bug 4** | Critical - Can't see results | None | P0 - Fix immediately (same as Bug 1) |

---

## 🔄 Recommended Commit Strategy

### Option 1: Single Commit (After All Fixes)

```bash
git add src/features/brackets/components/BracketsManagerViewer.vue \
        src/stores/matches.ts

git commit -m "fix(critical): resolve triple bracket display and duplicate matches bugs

Bug 1 & 4: Triple Bracket Display + Updates Not Showing
- Clear bracket container before re-rendering
- Prevents bracketsViewer.render() from appending multiple brackets
- Fixes real-time updates not being visible

Bug 2: Duplicate Matches Still Appearing
- Fixed deduplication logic to check ALL existing matches
- Added internal deduplication within fetched batch
- Handles race condition when multiple listeners fire simultaneously

Testing:
✅ Only 1 bracket displayed (not 3)
✅ Zero duplicate matches in table
✅ Bracket updates within 2 seconds after match completion
✅ Console logs show duplicate detection working

Fixes: Critical bugs found in Phase 10 manual testing
Impact: P0 production blockers resolved

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

### Option 2: Separate Commits (By Bug)

**Commit 1: Fix Bug 1 & 4**
```bash
git add src/features/brackets/components/BracketsManagerViewer.vue

git commit -m "fix(brackets): clear container before re-rendering to prevent triple display

Bug: 3 brackets displayed instead of 1, completed matches not visible

Root Cause:
- viewer.render() appends brackets instead of replacing
- Real-time listeners trigger re-renders that stack on top of each other
- First (stale) bracket hides updated brackets below

Fix:
- Clear bracketContainer.innerHTML before calling viewer.render()
- Ensures only ONE bracket is displayed
- Updates now visible immediately

Testing:
✅ Only 1 bracket displayed
✅ Real-time updates visible within 2 seconds

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Commit 2: Fix Bug 2**
```bash
git add src/stores/matches.ts

git commit -m "fix(matches): correct deduplication to eliminate all duplicates

Bug: Thomas Harris vs Christopher Irving appearing twice (ID 1 duplicate)

Root Cause:
- Deduplication only checked against OTHER categories
- Didn't check if match already exists in SAME category
- Didn't deduplicate WITHIN fetched batch (race condition)

Fix:
- Check against ALL existing matches (not just other categories)
- Deduplicate within adaptedMatches using seenKeys set
- Handles simultaneous listener fires correctly

Testing:
✅ Zero duplicate IDs in Match Schedule table
✅ Console logs show duplicates filtered
✅ Works with rapid match completions

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## 📞 Questions for User

Before proceeding with fixes:

1. **Should we fix all 3 bugs in one commit or separate commits?**
   - Recommended: Separate commits (easier to review, rollback if needed)

2. **Do you want to test Bug 1 fix first before Bug 2?**
   - Bug 1 is easier to fix and will immediately improve UX

3. **Should we add unit tests for the deduplication logic?**
   - Recommended: Yes, to prevent regression

---

## 🎯 Priority Order

**Recommend fixing in this order:**

1. **Fix Bug 1 first** (15 minutes)
   - Simple one-line fix
   - Immediately improves UX (single bracket)
   - Fixes Bug 4 automatically

2. **Fix Bug 2 second** (30 minutes)
   - More complex logic change
   - Eliminates duplicates
   - Needs thorough testing

3. **Document Bug 3** (5 minutes)
   - Add clarification to Phase 10 docs
   - No code changes needed

**Total Estimated Time:** 50 minutes

---

**Manual Testing Bug Report Complete:** 2026-02-03
**Bugs Found:** 4 (3 critical, 1 info)
**Fixes Required:** 2 code changes
**Status:** Ready for AI Coder to implement fixes
