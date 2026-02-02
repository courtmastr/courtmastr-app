# Bracket Fixes Progress

## Issues Being Fixed

### 1. Bracket Viewer Display (IN PROGRESS - Task bg_c5c9e715)
**Status**: Agent working on adding `group_id` and `round_id` fields to match documents

**Problem**: 
- Matches showing in single vertical line instead of tournament tree
- brackets-viewer.js library expects `group_id` and `round_id` fields
- Our optimized schema only stores `bracket` and `round` fields

**Solution**: 
- Add `group_id: String(m.group_id)` and `round_id: String(m.round_id)` to match documents in `useBracketGenerator.ts`
- Keep both old and new fields for backward compatibility

### 2. Bracket Advancement (IN PROGRESS - Task bg_f336c46c)
**Status**: Agent debugging Cloud Function and client-side winner ID

**Problem**:
- Winners not advancing to next matches
- Cloud Function compares winnerId with opponent IDs
- Potential mismatch between sequential IDs and registration IDs

**Solution**:
- Find where `updateMatch` is called from client
- Verify correct ID (sequential vs registration) is being passed
- Fix client-side if needed

### 3. Start Time Display (IDENTIFIED - Not a code bug)
**Status**: Data issue, not code issue

**Problem**:
- Activity shows "started on -" instead of court name

**Root Cause**:
- Match was started without a court assignment
- `courtName` parameter was empty when `logMatchStarted` was called
- This is a workflow issue - matches should have courts assigned before starting

**No code fix needed** - the logging code is correct. The issue is matches being started without court assignments.

## Next Steps
1. Wait for background tasks to complete
2. Test bracket generation and display
3. Test match completion and advancement
4. Verify court assignment workflow
