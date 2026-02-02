# Bracket Fixes Work Plan

## Overview
Fix three critical issues in the CourtMaster tournament bracket system:
1. Bracket viewer displaying matches in single vertical line instead of tournament tree
2. Missing start time display in activity feed
3. Auto-schedule not working after match completion (winners not advancing)

## Issues Analysis

### Issue 1: Bracket Viewer Display
**Root Cause**: Optimized schema stores `bracket` and `round` fields, but brackets-viewer.js library expects `group_id` and `round_id`

**Solution**: Add backward-compatible fields to match documents

### Issue 2: Missing Start Time
**Root Cause**: `startedAt` field exists but not being formatted in activity feed

**Solution**: Update activity feed component to format and display timestamps

### Issue 3: Bracket Advancement
**Root Cause**: Winners not advancing - likely Cloud Function issue or ID mismatch

**Solution**: Debug Cloud Function and verify winner ID mapping

## Files to Modify

1. `src/composables/useBracketGenerator.ts` - Add group_id/round_id for compatibility
2. `src/features/brackets/components/BracketsManagerViewer.vue` - Verify data loading
3. Activity feed component - Fix timestamp display
4. `functions/src/updateMatch.ts` - Debug advancement logic

## Success Criteria
- [ ] Bracket displays as proper tournament tree
- [ ] Start times show in activity feed
- [ ] Winners advance to next matches automatically
- [ ] Auto-schedule shows "ready" matches
