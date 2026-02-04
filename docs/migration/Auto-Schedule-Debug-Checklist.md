# Auto-Schedule Debug Checklist

**Issue:** Auto-schedule says "Scheduled 0 matches across 4 courts" even though 8 matches show "Ready to Start"

---

## Step-by-Step Debugging

### Step 1: Open Auto-Schedule Dialog

1. Click "AUTO SCHEDULE" button
2. **BEFORE clicking "Schedule X Matches" button**, check at the bottom of the dialog:
   - What does it say? "**X matches ready to schedule**"
   - What is X? (It should be 8 if all matches are eligible)

**Screenshot this** and share the number.

---

### Step 2: Check Browser Console

1. Open browser console (F12)
2. Type this and press Enter:
   ```javascript
   // Check total matches
   console.log('Total matches:', __VUE_DEVTOOLS_GLOBAL_HOOK__.apps[0]._instance.proxy.$root.$children[0].$refs.matchStore.matches.value.length);

   // Check matches by status
   const matches = __VUE_DEVTOOLS_GLOBAL_HOOK__.apps[0]._instance.proxy.$root.$children[0].$refs.matchStore.matches.value;
   console.log('Status breakdown:');
   console.log('- scheduled:', matches.filter(m => m.status === 'scheduled').length);
   console.log('- ready:', matches.filter(m => m.status === 'ready').length);
   console.log('- in_progress:', matches.filter(m => m.status === 'in_progress').length);
   console.log('- completed:', matches.filter(m => m.status === 'completed').length);
   ```

3. Share the output

---

### Step 3: Check Match Details

In console, type:
```javascript
const matches = __VUE_DEVTOOLS_GLOBAL_HOOK__.apps[0]._instance.proxy.$root.$children[0].$refs.matchStore.matches.value;

// Check first "ready" match
const readyMatch = matches.find(m => m.status === 'ready');
console.log('Sample ready match:', readyMatch);

// Check if it has the required fields
console.log('Has participant1Id?', !!readyMatch?.participant1Id);
console.log('Has participant2Id?', !!readyMatch?.participant2Id);
console.log('Has courtId?', !!readyMatch?.courtId);
console.log('Status:', readyMatch?.status);
```

Share the output.

---

### Step 4: Check Selected Categories

In the auto-schedule dialog, check:
- Are any categories selected? (should show checkboxes)
- How many categories are selected?

---

## Likely Root Causes

### Cause 1: No Categories Selected
**Symptom:** Dialog shows "0 matches ready to schedule"
**Fix:** Select categories in the dialog before clicking Schedule

### Cause 2: Matches Have courtId Already
**Symptom:** Matches were previously scheduled
**Fix:** Click "Reset Schedule" first to clear court assignments

### Cause 3: Status is Not 'ready' or 'scheduled'
**Symptom:** Matches have status = 0, 1, 2 (numeric) instead of 'ready' (string)
**Fix:** This is a bug in the adapter - needs code fix

### Cause 4: Missing Participant IDs
**Symptom:** participant1Id or participant2Id is undefined
**Fix:** Matches with TBD opponents can't be scheduled yet

---

## Quick Tests

### Test A: Check Match Count in Dialog

When you open Auto-Schedule dialog, look at the bottom text:
- Should say: "**8 matches ready to schedule**"
- If it says: "**0 matches ready to schedule**" → Problem is in the filter
- If it shows a number but schedules 0 → Problem is in the scheduling logic

### Test B: Check Firebase match_scores

1. Open Firebase Emulator UI
2. Navigate to: `tournaments/{tournamentId}/categories/{categoryId}/match_scores`
3. Check if any documents have `courtId` field
4. If they do, those matches are already scheduled (won't be auto-scheduled again)

**Solution:** Click "Reset Schedule" button to clear `courtId` from all matches

---

## Most Likely Issue

Based on your screenshot showing "Scheduled 0 matches", I suspect:

**The matches already have `courtId` set in match_scores!**

The filter on line 684 checks:
```typescript
!m.courtId  // Only schedule matches WITHOUT a court
```

If your matches were previously scheduled and still have `courtId` in Firestore, they won't be scheduled again.

**Fix:**
1. Click "Reset Schedule" button in the auto-schedule dialog
2. This will clear `courtId` from all match_scores
3. Then try auto-schedule again

---

## Alternative: Check Custom Auto-Schedule Function

The issue might also be in the custom `runAutoSchedule()` function (lines 755-864).

This function does NOT use the `useMatchScheduler` composable (which is Part 3 of Phase 10 that's incomplete).

The custom logic might have bugs. The **proper fix** is to replace the custom function with the `useMatchScheduler` composable as specified in Phase 10 Part 3.

---

## Action Items

Please provide:
1. **Screenshot of Auto-Schedule dialog** showing "X matches ready to schedule"
2. **Console output** from Step 2 and Step 3 above
3. **Confirm:** Did you try clicking "Reset Schedule" first?

This will help me pinpoint the exact issue.
