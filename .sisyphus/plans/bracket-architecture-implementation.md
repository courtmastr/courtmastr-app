# Implementation Plan: Category-Isolated Bracket Architecture

## Overview
Move from shared collections to category-isolated subcollections to properly support brackets-manager.

## Current State (Broken)
```
/tournaments/{tournamentId}/stage/{stageId}     <- All categories mixed
/tournaments/{tournamentId}/match/{matchId}     <- All categories mixed
/tournaments/{tournamentId}/participant/{id}    <- All categories mixed
```

## Target State (Fixed)
```
/tournaments/{tournamentId}/categories/{categoryId}/stage/{stageId}
/tournaments/{tournamentId}/categories/{categoryId}/group/{groupId}
/tournaments/{tournamentId}/categories/{categoryId}/round/{roundId}
/tournaments/{tournamentId}/categories/{categoryId}/match/{matchId}
/tournaments/{tournamentId}/categories/{categoryId}/participant/{participantId}
/tournaments/{tournamentId}/categories/{categoryId}/match_game/{gameId}
```

## Files to Modify

### 1. functions/src/storage/firestore-adapter.ts
**Changes**: Update to support category-specific root paths
- Modify constructor to accept categoryId
- Update getCollectionRef to use category subcollection path

### 2. src/composables/useBracketGenerator.ts
**Changes**: Complete rewrite to use FirestoreStorage adapter properly
- Remove manual batch saving
- Use BracketsManager with FirestoreStorage
- Save ALL collections (stage, group, round, match, participant)
- Store registrationId in participant.name for lookup

### 3. src/features/brackets/components/BracketsManagerViewer.vue
**Changes**: Read from category subcollections
- Update queries to use category-specific paths
- Fetch all required collections (stage, group, round, match, participant)
- Build viewer data from Firestore collections, not registrations

### 4. src/stores/matches.ts
**Changes**: Query matches from category subcollections
- Update fetchMatches to use category path
- Update match subscriptions to listen to category subcollection

### 5. functions/src/updateMatch.ts
**Changes**: Use category-specific FirestoreStorage
- Update to use category-specific root path
- Ensure all queries filter by category

### 6. src/composables/useMatchScheduler.ts
**Changes**: Query from category subcollections
- Update match fetching to use category paths

### 7. Firestore Indexes
**Create composite indexes for**:
- stage: tournament_id
- participant: tournament_id
- group: stage_id + number
- round: group_id + number
- match: round_id + number, stage_id, group_id
- match_game: parent_id + number

## Implementation Order

1. ✅ **Update FirestoreAdapter** - Make it category-aware
2. ✅ **Update useBracketGenerator** - Use adapter properly, save all collections
3. ✅ **Update BracketsManagerViewer** - Read from category subcollections
4. ✅ **Update matches store** - Query category subcollections
5. ✅ **Update Cloud Function** - Use category paths
6. ✅ **Update useMatchScheduler** - Use category paths
7. ✅ **Test** - Generate brackets for multiple categories, verify isolation

## Data Migration Strategy

Since we're changing the data structure:
- Old brackets won't work (wrong paths)
- Solution: Regenerate all brackets after deployment
- Or: Write migration script to move existing data

## Key Technical Decisions

1. **Use participant.name to store registrationId** - This is how brackets-manager links participants to our registrations
2. **Keep sequential IDs (1, 2, 3...)** - brackets-manager expects this
3. **Store registrationId in participant.name** - For reverse lookup
4. **CategoryId becomes the tournament_id** - In brackets-manager's view, each category is a tournament

## Rollback Plan

If issues arise:
- Keep old code commented out initially
- Can switch back by reverting to old paths
- Data in new paths won't conflict with old
