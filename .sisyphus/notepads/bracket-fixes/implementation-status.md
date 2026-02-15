# Implementation Status: Category-Isolated Bracket Architecture

## ✅ COMPLETED

### 1. Created ClientFirestoreStorage (`src/services/brackets-storage.ts`)
- Client-side Firestore adapter for brackets-manager
- Works with category-isolated paths
- Implements full CrudInterface

### 2. Updated useBracketGenerator (`src/composables/useBracketGenerator.ts`)
- Uses ClientFirestoreStorage with category-specific paths
- Saves ALL collections: stage, group, round, match, participant
- Properly isolates each category's data
- Stores registrationId in participant.name for lookup

### 3. Updated BracketsManagerViewer (`src/features/brackets/components/BracketsManagerViewer.vue`)
- Reads from category subcollections using ClientFirestoreStorage
- Simplified implementation
- Properly loads stages, matches, and participants

## 🔄 REMAINING WORK

### 4. Update matches store (`src/stores/matches.ts`)
**Current Issue**: Still queries old shared paths
**Required Changes**:
- Update `fetchMatches()` to use category path: `tournaments/{id}/categories/{catId}/match`
- Update `subscribeMatches()` to listen to category subcollection
- Update `fetchMatch()` to read from category path
- Update match completion to work with new structure

### 5. Update Cloud Function (`functions/src/updateMatch.ts`)
**Current Issue**: Uses old shared paths
**Required Changes**:
- Update to use category-specific FirestoreStorage path
- Pass categoryId to the function
- Query matches from category subcollection

### 6. Update useMatchScheduler (`src/composables/useMatchScheduler.ts`)
**Current Issue**: Queries matches from old paths
**Required Changes**:
- Update to fetch matches from category subcollections
- Pass categoryId to scheduling functions

### 7. Update bracketMatchAdapter (`src/stores/bracketMatchAdapter.ts`)
**Current Issue**: Adapts from old data structure
**Required Changes**:
- Update to read from category subcollections
- Adapt participant lookup to use participant.name (registrationId)

## Testing Required

After all changes:
1. Generate bracket for Category A
2. Generate bracket for Category B
3. Verify both display independently
4. Complete match in Category A
5. Verify Category B unaffected
6. Verify winner advances in Category A

## Migration Notes

- Old brackets won't work (different paths)
- Need to regenerate all brackets after deployment
- Or write migration script to move data from old paths to new

## Key Architectural Changes

### Before (Broken):
```
/tournaments/{id}/match/{matchId}  <- All categories mixed
/tournaments/{id}/stage/{stageId}  <- All categories mixed
```

### After (Fixed):
```
/tournaments/{id}/categories/{catId}/match/{matchId}  <- Isolated
/tournaments/{id}/categories/{catId}/stage/{stageId}  <- Isolated
/tournaments/{id}/categories/{catId}/participant/{id} <- Isolated
```
