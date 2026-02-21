# Pool Data Loss Investigation Report

**Date:** February 21, 2026  
**Category:** Mens Doubles (pool_to_elimination format)  
**Status:** Data Loss Confirmed - Root Cause Identified  
**Severity:** Critical

---

## Executive Summary

Pool-level data in the Mens Doubles category is **intentionally deleted** when transitioning from pool play to elimination rounds. This is by design in the current implementation, but the deletion is **permanent and unrecoverable** once the elimination bracket is generated.

**Key Finding:** The pool data (matches, scores, standings) is stored in the brackets-manager collections and is **completely removed** from Firestore when `generateEliminationFromPool()` is called. The pool standings are never persisted to a separate "archive" collection.

---

## 1. Pool Data Storage Architecture

### 1.1 Collection Structure

Pool data is stored in **category-scoped collections** under the brackets-manager adapter:

```
tournaments/{tournamentId}/categories/{categoryId}/
├── stage/                    # Pool stage definition
├── participant/              # Participant registry (name = registrationId)
├── match/                    # Pool matches (brackets-manager format)
├── match_game/               # Individual games within matches
├── round/                    # Round definitions
├── group/                    # Pool groups
└── match_scores/             # Operational scores (Firestore-native)
```

### 1.2 Pool Stage Metadata

The `Category` document tracks pool state:

```typescript
// /tournaments/{id}/categories/{categoryId}
{
  poolStageId?: number | null;              // ID of pool stage
  poolPhase?: 'pool' | 'elimination' | null; // Current phase
  poolGroupCount?: number | null;            // Number of pools
  poolQualifiersPerGroup?: number | null;    // Qualifiers per pool
  poolQualifiedRegistrationIds?: string[];   // Qualified participants
  poolCompletedAt?: Date | null;             // When pool completed
  eliminationStageId?: number | null;        // ID of elimination stage
}
```

### 1.3 Pool Standings Calculation

Pool standings are calculated **on-demand** from:
- `/match` documents (participant IDs)
- `/match_scores` documents (scores, winners)
- `/participant` collection (registration ID mapping)

**Key Function:** `usePoolLeveling.ts` → `fetchPoolData()` → `rankPools()`

---

## 2. Data Loss Mechanism

### 2.1 The Deletion Process

When `generateEliminationFromPool()` is called (line 280 in `useBracketGenerator.ts`):

```typescript
// Step 1: Verify pool is complete
const pendingPoolMatches = poolMatches.filter((match) => {
  const score = matchScoresMap.get(String(match.id));
  return !isCompletedMatch(match, score);
});

if (pendingPoolMatches.length > 0) {
  throw new Error(`Pool stage not complete. ${pendingPoolMatches.length} match(es) still pending.`);
}

// Step 2: Extract qualifiers from pool results
const qualifiers = extractPoolQualifiers({...});

// Step 3: DELETE ALL POOL DATA ⚠️
await deletePoolStageData(tournamentId, categoryId, storage, poolStageId, poolMatches);
```

### 2.2 What Gets Deleted

Function: `deletePoolStageData()` (line 1039 in `useBracketGenerator.ts`)

```typescript
async function deletePoolStageData(
  tournamentId: string,
  categoryId: string,
  storage: ClientFirestoreStorage,
  poolStageId: number,
  poolMatches: StoredMatch[]
): Promise<void> {
  // Delete match_scores from Firestore
  await deleteMatchScoresByIds(
    tournamentId,
    categoryId,
    poolMatches.map((match) => String(match.id))
  );

  // Delete brackets-manager collections
  await storage.delete('match', { stage_id: poolStageId });
  await storage.delete('match_game', { stage_id: poolStageId });
  await storage.delete('round', { stage_id: poolStageId });
  await storage.delete('group', { stage_id: poolStageId });
  await storage.delete('stage', poolStageId);
}
```

**Deleted Collections:**
1. ✅ `match_scores/{matchId}` - Firestore operational data
2. ✅ `match/{matchId}` - Bracket structure
3. ✅ `match_game/{gameId}` - Individual games
4. ✅ `round/{roundId}` - Round definitions
5. ✅ `group/{groupId}` - Pool groups
6. ✅ `stage/{stageId}` - Pool stage definition

**NOT Deleted:**
- ❌ `participant/{participantId}` - Participant registry (kept for elimination)
- ❌ `registrations/{regId}` - Registration records (tournament-level)
- ❌ `players/{playerId}` - Player records (tournament-level)

### 2.3 Timeline of Data Loss

| Step | Action | Data State |
|------|--------|-----------|
| 1 | Pool bracket generated | ✅ Pool data exists |
| 2 | Pool matches scored | ✅ Pool data + scores exist |
| 3 | `generateEliminationFromPool()` called | ✅ Pool data still exists (qualifiers extracted) |
| 4 | `deletePoolStageData()` executes | ❌ **Pool data DELETED** |
| 5 | Elimination bracket created | ✅ Elimination data exists |

---

## 3. Why Pool Data Is Lost

### 3.1 Design Rationale

The deletion is **intentional** to:

1. **Prevent data confusion** - Avoid mixing pool and elimination matches in views
2. **Simplify adapter logic** - brackets-manager adapter only handles one stage at a time
3. **Reduce storage** - Remove obsolete pool data after qualifiers are extracted
4. **Avoid UI conflicts** - Pool matches shouldn't appear in elimination bracket views

### 3.2 Current Assumption

The implementation assumes:
- Pool standings are **not needed after elimination starts**
- Qualifiers are **extracted and stored** in `poolQualifiedRegistrationIds`
- Users only care about **elimination results**, not pool history

---

## 4. What Data Is Preserved

### 4.1 Preserved in Category Document

```typescript
{
  poolQualifiedRegistrationIds: string[];  // ✅ Who qualified
  poolQualifiersPerGroup: number;          // ✅ How many per pool
  poolGroupCount: number;                  // ✅ Number of pools
  poolPhase: 'elimination';                // ✅ Current phase
  eliminationStageId: number;              // ✅ Elimination stage ID
}
```

### 4.2 What's Lost

- ❌ Pool match results (who beat whom)
- ❌ Pool standings (rankings within each pool)
- ❌ Individual game scores from pool matches
- ❌ Pool match history and timestamps
- ❌ Pool-specific statistics (win rates, point differentials)

---

## 5. File Locations & Code References

### 5.1 Pool Data Handling Files

| File | Purpose | Key Functions |
|------|---------|---|
| `src/composables/useBracketGenerator.ts` | Bracket generation | `generateBracket()`, `generateEliminationFromPool()`, `deletePoolStageData()` |
| `src/composables/usePoolLeveling.ts` | Pool standings calculation | `fetchPoolData()`, `rankPools()`, `generatePreview()` |
| `src/composables/useCategoryStageStatus.ts` | Category state tracking | Pool phase detection |
| `src/stores/tournaments.ts` | Tournament state | Category updates with pool metadata |
| `src/services/brackets-storage.ts` | Firestore adapter | CRUD operations for brackets-manager |
| `src/types/index.ts` | Type definitions | `Category`, `PoolPhase`, `LevelingMode` |

### 5.2 Key Code Sections

**Pool Generation (line 211-234 in useBracketGenerator.ts):**
```typescript
if (category.format === 'pool_to_elimination') {
  result = await createPoolStage(...);
  await setDoc(doc(...), {
    poolStageId: result.stageId,
    poolPhase: 'pool',
    ...
  });
}
```

**Elimination Generation (line 280-427 in useBracketGenerator.ts):**
```typescript
async function generateEliminationFromPool(...) {
  // Extract qualifiers
  const qualifiers = extractPoolQualifiers({...});
  
  // DELETE POOL DATA HERE ⚠️
  await deletePoolStageData(tournamentId, categoryId, storage, poolStageId, poolMatches);
  
  // Create elimination bracket
  const result = await createStageWithStats(...);
  
  // Update category
  await setDoc(doc(...), {
    poolPhase: 'elimination',
    eliminationStageId: result.stageId,
    poolQualifiedRegistrationIds: qualifiers.registrationIds,
  });
}
```

**Pool Data Deletion (line 1039-1056 in useBracketGenerator.ts):**
```typescript
async function deletePoolStageData(
  tournamentId: string,
  categoryId: string,
  storage: ClientFirestoreStorage,
  poolStageId: number,
  poolMatches: StoredMatch[]
): Promise<void> {
  await deleteMatchScoresByIds(tournamentId, categoryId, poolMatches.map(m => String(m.id)));
  await storage.delete('match', { stage_id: poolStageId });
  await storage.delete('match_game', { stage_id: poolStageId });
  await storage.delete('round', { stage_id: poolStageId });
  await storage.delete('group', { stage_id: poolStageId });
  await storage.delete('stage', poolStageId);
}
```

---

## 6. Impact Analysis

### 6.1 What Users Can Still See

✅ **After elimination bracket is generated:**
- Qualified participants list
- Elimination bracket and results
- Final rankings
- Elimination match history

### 6.2 What Users Cannot See

❌ **After elimination bracket is generated:**
- Pool match results
- Pool standings/rankings
- Pool-specific statistics
- Head-to-head records from pool play
- Pool match scores and game details

### 6.3 Affected Features

| Feature | Status | Impact |
|---------|--------|--------|
| Pool leaderboard | ❌ Broken | Data deleted after elimination generation |
| Pool standings view | ❌ Broken | No data to display |
| Pool match history | ❌ Lost | Permanently deleted |
| Qualification tracking | ✅ Works | Stored in `poolQualifiedRegistrationIds` |
| Elimination bracket | ✅ Works | Created from qualifiers |
| Tournament leaderboard | ⚠️ Partial | Only shows elimination results |

---

## 7. Root Cause Summary

| Aspect | Finding |
|--------|---------|
| **Is pool data being overwritten?** | No - it's being deleted |
| **Is pool data being archived?** | No - no backup/archive collection |
| **Is it a display issue?** | No - the data is actually gone from Firestore |
| **Is it intentional?** | Yes - by design in `generateEliminationFromPool()` |
| **Is it recoverable?** | No - unless Firestore backups exist |
| **When does deletion occur?** | When `generateEliminationFromPool()` is called |

---

## 8. Recommendations

### 8.1 Short-term (Prevent Further Loss)

1. **Archive pool data before deletion**
   - Create `tournaments/{id}/categories/{catId}/pool_archive/` collection
   - Copy pool matches, scores, and standings before calling `deletePoolStageData()`
   - Preserve pool standings snapshot

2. **Add confirmation dialog**
   - Warn users that pool data will be permanently deleted
   - Require explicit confirmation before elimination generation

3. **Add audit logging**
   - Log when pool data is deleted
   - Track who initiated the deletion and when

### 8.2 Medium-term (Restore Functionality)

1. **Implement pool standings persistence**
   - Calculate and store pool standings in a separate collection
   - Keep standings even after elimination bracket is generated
   - Allow viewing historical pool results

2. **Create pool history view**
   - Display archived pool matches and standings
   - Show qualification criteria and results
   - Track pool-to-elimination progression

3. **Update leaderboard**
   - Include pool phase results in tournament leaderboard
   - Show both pool and elimination statistics
   - Implement combined ranking logic

### 8.3 Long-term (Architecture Improvement)

1. **Separate pool and elimination data**
   - Store pool data in permanent collection (not brackets-manager)
   - Keep brackets-manager only for elimination
   - Avoid deletion of historical data

2. **Implement data versioning**
   - Track tournament progression through phases
   - Maintain complete history of all matches
   - Enable rollback if needed

3. **Add data retention policy**
   - Define what data is kept after each phase
   - Document retention rules in AGENTS.md
   - Implement automated archival

---

## 9. Related Documentation

- **[DATA_MODEL_MIGRATION_RULES](./migration/DATA_MODEL_MIGRATION_RULES.md)** - Data model rules
- **[TOURNAMENT_LEADERBOARD_PLAN.md](./TOURNAMENT_LEADERBOARD_PLAN.md)** - Leaderboard architecture
- **[useBracketGenerator.ts](../src/composables/useBracketGenerator.ts)** - Bracket generation logic
- **[usePoolLeveling.ts](../src/composables/usePoolLeveling.ts)** - Pool standings calculation

---

## 10. Investigation Artifacts

### Files Examined

1. ✅ `src/types/index.ts` - Pool-related type definitions
2. ✅ `src/composables/useBracketGenerator.ts` - Bracket generation and deletion logic
3. ✅ `src/composables/usePoolLeveling.ts` - Pool standings calculation
4. ✅ `src/composables/useCategoryStageStatus.ts` - Category state tracking
5. ✅ `src/stores/tournaments.ts` - Tournament state management
6. ✅ `src/services/brackets-storage.ts` - Firestore adapter
7. ✅ `docs/TOURNAMENT_LEADERBOARD_PLAN.md` - Leaderboard architecture

### Code Patterns Identified

- **CP-POOL-001:** Pool data is deleted when transitioning to elimination
- **CP-POOL-002:** No archive/backup of pool standings before deletion
- **CP-POOL-003:** Pool qualifiers stored in `poolQualifiedRegistrationIds` only
- **CP-POOL-004:** Pool standings calculated on-demand from brackets-manager collections

---

**Investigation Completed:** February 21, 2026  
**Next Steps:** Implement recommendations to preserve pool data and restore functionality
