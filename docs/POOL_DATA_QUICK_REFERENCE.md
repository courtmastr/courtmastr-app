# Pool Data Storage - Quick Reference

## File Locations

| Component | File Path | Purpose |
|-----------|-----------|---------|
| **Pool Generation** | `src/composables/useBracketGenerator.ts:211-234` | Creates pool stage |
| **Pool Deletion** | `src/composables/useBracketGenerator.ts:1039-1056` | Deletes pool data when moving to elimination |
| **Pool Standings** | `src/composables/usePoolLeveling.ts:159-241` | Fetches and calculates pool standings |
| **Pool Ranking** | `src/composables/usePoolLeveling.ts:378-440` | Ranks participants within pools |
| **Category State** | `src/stores/tournaments.ts:200-300` | Tracks pool phase and metadata |
| **Type Definitions** | `src/types/index.ts:71-116` | Pool-related types and interfaces |
| **Firestore Adapter** | `src/services/brackets-storage.ts` | CRUD operations for brackets-manager |

## Firestore Collections

### Pool Data (Deleted on Elimination Generation)

```
tournaments/{id}/categories/{catId}/
├── stage/{stageId}              ❌ DELETED
├── participant/{participantId}  ✅ KEPT
├── match/{matchId}              ❌ DELETED
├── match_game/{gameId}          ❌ DELETED
├── round/{roundId}              ❌ DELETED
├── group/{groupId}              ❌ DELETED
└── match_scores/{matchId}       ❌ DELETED
```

### Preserved Data

```
tournaments/{id}/categories/{catId}/
├── (Category document)
│   ├── poolStageId              ✅ Preserved
│   ├── poolPhase                ✅ Preserved
│   ├── poolGroupCount           ✅ Preserved
│   ├── poolQualifiersPerGroup   ✅ Preserved
│   ├── poolQualifiedRegistrationIds  ✅ Preserved
│   └── poolCompletedAt          ✅ Preserved
└── levels/{levelId}/            ✅ Elimination data
```

## Key Functions

### Pool Generation
```typescript
// src/composables/useBracketGenerator.ts:211-234
async function generateBracket(
  tournamentId: string,
  categoryId: string,
  registrationIds: string[],
  options?: BracketOptions
): Promise<BracketResult>
```

### Pool-to-Elimination Transition
```typescript
// src/composables/useBracketGenerator.ts:280-427
async function generateEliminationFromPool(
  tournamentId: string,
  categoryId: string,
  options?: BracketOptions
): Promise<BracketResult>
```

### Pool Data Deletion
```typescript
// src/composables/useBracketGenerator.ts:1039-1056
async function deletePoolStageData(
  tournamentId: string,
  categoryId: string,
  storage: ClientFirestoreStorage,
  poolStageId: number,
  poolMatches: StoredMatch[]
): Promise<void>
```

### Pool Standings Calculation
```typescript
// src/composables/usePoolLeveling.ts:545-609
async function generatePreview(
  tournamentId: string,
  categoryId: string,
  levelCount: number
): Promise<PoolLevelPreview>
```

## Category Fields

### Pool Phase Tracking

```typescript
interface Category {
  // Pool configuration
  poolStageId?: number | null;                    // ID of pool stage
  poolPhase?: 'pool' | 'elimination' | null;      // Current phase
  poolGroupCount?: number | null;                 // Number of pools
  poolQualifiersPerGroup?: number | null;         // Qualifiers per pool
  poolQualifiedRegistrationIds?: string[];        // Who qualified
  poolCompletedAt?: Date | null;                  // When pool finished
  
  // Elimination configuration
  eliminationStageId?: number | null;             // ID of elimination stage
  
  // Leveling (for pool_to_elimination with levels)
  levelingEnabled?: boolean | null;
  levelingStatus?: 'not_started' | 'configured' | 'generated';
  selectedLevelMode?: 'pool_position' | 'global_bands';
  levelCount?: number | null;
}
```

## Data Loss Timeline

| Event | Data State | Recoverable |
|-------|-----------|------------|
| Pool bracket generated | ✅ Pool data exists | Yes (Firestore) |
| Pool matches scored | ✅ Pool data + scores | Yes (Firestore) |
| `generateEliminationFromPool()` called | ✅ Still exists | Yes (Firestore) |
| `deletePoolStageData()` executes | ❌ **DELETED** | No (unless backup) |
| Elimination bracket created | ✅ Elimination data | Yes (Firestore) |

## Detection Commands

### Find pool-related code
```bash
grep -rn "poolStageId\|poolPhase\|poolCompleted" src/ --include="*.ts" --include="*.vue"
```

### Find deletion logic
```bash
grep -n "deletePoolStageData\|storage.delete" src/composables/useBracketGenerator.ts
```

### Find pool standings calculation
```bash
grep -n "rankPools\|aggregateStats" src/composables/usePoolLeveling.ts
```

## Critical Code Sections

### Where Pool Data Gets Deleted (Line 384)
```typescript
// src/composables/useBracketGenerator.ts:384
await deletePoolStageData(tournamentId, categoryId, storage, poolStageId, poolMatches);
```

### What Gets Deleted (Lines 1051-1055)
```typescript
await storage.delete('match', { stage_id: poolStageId });
await storage.delete('match_game', { stage_id: poolStageId });
await storage.delete('round', { stage_id: poolStageId });
await storage.delete('group', { stage_id: poolStageId });
await storage.delete('stage', poolStageId);
```

### Match Scores Deletion (Lines 1070-1073)
```typescript
batch.delete(
  doc(db, 'tournaments', tournamentId, 'categories', categoryId, 'match_scores', matchId)
);
```

## Related Patterns

- **CP-POOL-001:** Pool data is deleted when transitioning to elimination
- **CP-POOL-002:** No archive/backup of pool standings before deletion
- **CP-POOL-003:** Pool qualifiers stored in `poolQualifiedRegistrationIds` only
- **CP-POOL-004:** Pool standings calculated on-demand from brackets-manager collections

## See Also

- [POOL_DATA_INVESTIGATION.md](./POOL_DATA_INVESTIGATION.md) - Full investigation report
- [TOURNAMENT_LEADERBOARD_PLAN.md](./TOURNAMENT_LEADERBOARD_PLAN.md) - Leaderboard architecture
- [DATA_MODEL_MIGRATION_RULES.md](./migration/DATA_MODEL_MIGRATION_RULES.md) - Data model rules
