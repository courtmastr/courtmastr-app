# Pool Data - Files & Code Summary

## Investigation Scope

**Goal:** Understand how pool data is stored, retrieved, and whether it persists after tournament progression to elimination rounds.

**Finding:** Pool data is **intentionally deleted** when transitioning from pool play to elimination rounds. This is permanent and unrecoverable unless Firestore backups exist.

---

## Files Related to Pool Processing

### 1. Type Definitions
**File:** `src/types/index.ts` (Lines 71-116)

**Pool-Related Types:**
```typescript
export type PoolPhase = 'pool' | 'elimination';
export type LevelingMode = 'pool_position' | 'global_bands';
export type LevelingStatus = 'not_started' | 'configured' | 'generated';

export interface Category {
  poolStageId?: number | null;                    // Pool stage ID
  poolPhase?: PoolPhase | null;                   // Current phase
  poolGroupCount?: number | null;                 // Number of pools
  poolQualifiersPerGroup?: number | null;         // Qualifiers per pool
  poolQualifiedRegistrationIds?: string[];        // Qualified participants
  poolCompletedAt?: Date | null;                  // Completion timestamp
  eliminationStageId?: number | null;             // Elimination stage ID
  levelingEnabled?: boolean | null;               // Leveling enabled
  levelingStatus?: LevelingStatus | null;         // Leveling status
  selectedLevelMode?: LevelingMode | null;        // Selected leveling mode
  levelCount?: number | null;                     // Number of levels
}

export interface LevelDefinition {
  id: string;
  name: string;
  order: number;
  eliminationFormat: LevelEliminationFormat;
  participantCount: number;
  stageId?: number | null;
}

export interface LevelAssignment {
  id: string;
  registrationId: string;
  levelId: string;
  levelName: string;
  sourceMode: LevelingMode;
  poolId?: string;
  poolLabel?: string;
  poolRank?: number;
  globalRank?: number;
  levelSeed?: number | null;
  overridden: boolean;
}
```

---

### 2. Bracket Generation & Pool Deletion
**File:** `src/composables/useBracketGenerator.ts` (1136 lines)

**Key Sections:**

#### Pool Generation (Lines 211-234)
```typescript
if (category.format === 'pool_to_elimination') {
  result = await createPoolStage(
    category,
    manager,
    storage,
    participantsData.length,
    options
  );

  await setDoc(
    doc(db, 'tournaments', tournamentId, 'categories', categoryId),
    {
      status: 'active',
      stageId: result.stageId,
      poolStageId: result.stageId,
      eliminationStageId: null,
      poolPhase: 'pool',
      poolGroupCount: result.groupCount,
      poolQualifiersPerGroup: options.qualifiersPerGroup ?? 2,
      bracketGeneratedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
```

#### Elimination Generation from Pool (Lines 280-427)
```typescript
async function generateEliminationFromPool(
  tournamentId: string,
  categoryId: string,
  options: BracketOptions = {}
): Promise<BracketResult> {
  // ... validation ...
  
  // Extract qualifiers from pool results
  const qualifiers = extractPoolQualifiers({
    participants,
    matches: poolMatches,
    rounds: poolRounds,
    groups: poolGroups,
    matchScores: matchScoresMap,
    requestedQualifiersPerGroup: options.qualifiersPerGroup ?? 2,
  });

  // ⚠️ DELETE ALL POOL DATA
  await deletePoolStageData(tournamentId, categoryId, storage, poolStageId, poolMatches);

  // Create elimination bracket
  const result = await createStageWithStats(...);

  // Update category with elimination info
  await setDoc(
    doc(db, 'tournaments', tournamentId, 'categories', categoryId),
    {
      status: 'active',
      stageId: result.stageId,
      eliminationStageId: result.stageId,
      poolPhase: 'elimination',
      poolGroupCount: qualifiers.groupCount,
      poolQualifiersPerGroup: qualifiers.qualifiersPerGroup,
      poolQualifiedRegistrationIds: qualifiers.registrationIds,
      bracketGeneratedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
```

#### Pool Data Deletion (Lines 1039-1078)
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

async function deleteMatchScoresByIds(
  tournamentId: string,
  categoryId: string,
  matchIds: string[]
): Promise<void> {
  if (matchIds.length === 0) return;

  const CHUNK_SIZE = 400;
  for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
    const chunk = matchIds.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const matchId of chunk) {
      batch.delete(
        doc(db, 'tournaments', tournamentId, 'categories', categoryId, 'match_scores', matchId)
      );
    }

    await batch.commit();
  }
}
```

**Functions:**
- `generateBracket()` - Creates pool or standard bracket
- `generateEliminationFromPool()` - Transitions from pool to elimination
- `deletePoolStageData()` - **Deletes all pool data**
- `deleteMatchScoresByIds()` - Deletes match scores from Firestore
- `createPoolStage()` - Creates pool stage structure
- `extractPoolQualifiers()` - Extracts qualifiers from pool results
- `resolvePoolStage()` - Finds pool stage by ID

---

### 3. Pool Standings Calculation
**File:** `src/composables/usePoolLeveling.ts` (632 lines)

**Key Sections:**

#### Fetch Pool Data (Lines 159-241)
```typescript
async function fetchPoolData(tournamentId: string, categoryId: string): Promise<PoolData> {
  const categoryDoc = await getDoc(doc(db, 'tournaments', tournamentId, 'categories', categoryId));
  
  const [registrationSnap, playerSnap, stageSnap, participantSnap, matchSnap, roundSnap, groupSnap, scoreSnap] =
    await Promise.all([
      getDocs(query(collection(...), where('categoryId', '==', categoryId), where('status', 'in', ['approved', 'checked_in']))),
      getDocs(collection(db, 'tournaments', tournamentId, 'players')),
      getDocs(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'stage')),
      getDocs(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'participant')),
      getDocs(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'match')),
      getDocs(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'round')),
      getDocs(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'group')),
      getDocs(collection(db, 'tournaments', tournamentId, 'categories', categoryId, 'match_scores')),
    ]);

  // Find pool stage
  const poolStage = category.poolStageId !== null && category.poolStageId !== undefined
    ? stages.find((stage) => Number(stage.id) === Number(category.poolStageId))
    : stages.find((stage) => stage.type === 'round_robin');

  // Filter matches to pool stage only
  const matches = asArray(matchSnap.docs.map(...)).filter((match) => Number(match.stage_id) === poolStageId);
  
  return { category, registrations, players, participants, groups, rounds, matches, scoresByMatchId };
}
```

#### Build Pool Summaries (Lines 243-299)
```typescript
function buildPoolSummaries(
  matches: StoredMatch[],
  rounds: StoredRound[],
  groups: StoredGroup[],
  participantById: Map<number, string>
): { pools: PoolSummary[]; participantPoolByRegistrationId: Map<string, string>; poolLabelById: Map<string, string> } {
  // Maps participants to pools
  // Returns pool summaries with participant counts
}
```

#### Rank Pools (Lines 378-440)
```typescript
function rankPools(
  category: Category,
  registrations: Registration[],
  players: Player[],
  pools: PoolSummary[],
  participantPoolByRegistrationId: Map<string, string>,
  resolvedPoolMatches: ResolvedMatch[],
  poolLabelById: Map<string, string>
): PoolLevelParticipant[] {
  // Calculates standings within each pool
  // Applies BWF tiebreaker rules
  // Returns ranked participants with pool position and global rank
}
```

#### Generate Preview (Lines 545-609)
```typescript
async function generatePreview(
  tournamentId: string,
  categoryId: string,
  levelCount: number
): Promise<PoolLevelPreview> {
  // Fetches pool data
  // Calculates standings
  // Recommends leveling mode
  // Returns preview with participants and suggested levels
}
```

**Exports:**
- `usePoolLeveling()` - Vue composable
- `generatePreview()` - Generate level preview
- `buildDefaultPoolMappings()` - Create default pool-to-level mappings
- `assignByPoolPosition()` - Assign levels by pool rank
- `assignByGlobalBands()` - Assign levels by global ranking

---

### 4. Category Stage Status
**File:** `src/composables/useCategoryStageStatus.ts`

**Pool Phase Detection:**
```typescript
if (category.poolPhase === 'pool') {
  // Category is in pool play phase
}

if (category.poolPhase === 'elimination') {
  // Category has moved to elimination
}

// Check if pool play is available
if (cat.format === 'pool_to_elimination' && cat.poolPhase === 'pool') {
  // Show pool standings
}
```

---

### 5. Tournament Store
**File:** `src/stores/tournaments.ts` (1274 lines)

**Pool-Related Updates:**
- Tracks `poolStageId`, `poolPhase`, `poolGroupCount`, `poolQualifiersPerGroup`
- Updates category document when pool is generated
- Updates category document when elimination is generated
- Manages category subscriptions

---

### 6. Firestore Adapter
**File:** `src/services/brackets-storage.ts` (237 lines)

**Purpose:** Implements brackets-manager CRUD interface for Firestore

**Key Methods:**
- `insert()` - Insert stage, match, participant, etc.
- `select()` - Query by ID or criteria
- `update()` - Update documents
- `delete()` - Delete documents (used for pool data deletion)

---

### 7. Leaderboard Calculation
**File:** `src/composables/useLeaderboard.ts` (861 lines)

**Pool Data Usage:**
- Fetches completed matches from `/match_scores`
- Joins with `/match` for participant IDs
- Calculates standings using BWF tiebreaker rules
- Does NOT preserve pool-specific data after elimination

---

## Firestore Collection Structure

### Pool Data Collections (Deleted on Elimination)

```
tournaments/{tournamentId}/categories/{categoryId}/
├── stage/{stageId}
│   └── type: 'round_robin'
│       id: number
│       tournament_id: string
│       name: string
│
├── participant/{participantId}
│   └── id: number
│       name: string (= registrationId)
│       tournament_id: string
│
├── match/{matchId}
│   └── id: number
│       stage_id: number
│       round_id: number
│       group_id: number
│       opponent1: { id: number, result?: 'win'|'loss' }
│       opponent2: { id: number, result?: 'win'|'loss' }
│       status: number (0-4)
│
├── match_game/{gameId}
│   └── match_id: number
│       stage_id: number
│       number: number
│       opponent1_score: number
│       opponent2_score: number
│
├── round/{roundId}
│   └── id: number
│       stage_id: number
│       group_id: number
│       number: number
│
├── group/{groupId}
│   └── id: number
│       stage_id: number
│       number: number
│
└── match_scores/{matchId}
    └── status: 'completed'|'walkover'
        winnerId: string (registrationId)
        scores: GameScore[]
        completedAt: Timestamp
```

### Preserved Data

```
tournaments/{tournamentId}/categories/{categoryId}/
├── (Category document)
│   ├── poolStageId: number | null
│   ├── poolPhase: 'pool' | 'elimination' | null
│   ├── poolGroupCount: number | null
│   ├── poolQualifiersPerGroup: number | null
│   ├── poolQualifiedRegistrationIds: string[]
│   ├── poolCompletedAt: Date | null
│   ├── eliminationStageId: number | null
│   └── ...
│
└── levels/{levelId}/
    ├── stage/
    ├── participant/
    ├── match/
    ├── match_game/
    ├── round/
    ├── group/
    └── match_scores/
```

---

## Data Flow Diagram

```
Pool Generation
├── Create pool stage (round_robin)
├── Create participants
├── Create matches
├── Create rounds/groups
└── Update Category: poolStageId, poolPhase='pool'

Pool Play
├── Score matches
├── Update match_scores
└── Calculate standings (on-demand)

Elimination Generation
├── Extract qualifiers from pool results
├── ⚠️ DELETE pool stage data
│   ├── Delete match/{matchId}
│   ├── Delete match_game/{gameId}
│   ├── Delete round/{roundId}
│   ├── Delete group/{groupId}
│   ├── Delete stage/{stageId}
│   └── Delete match_scores/{matchId}
├── Create elimination stage
├── Create elimination matches
└── Update Category: poolPhase='elimination', eliminationStageId

Elimination Play
├── Score elimination matches
├── Update match_scores
└── Calculate final standings
```

---

## Summary Table

| Aspect | Details |
|--------|---------|
| **Pool Data Storage** | Brackets-manager collections under category |
| **Pool Standings** | Calculated on-demand from matches + scores |
| **Data Persistence** | ❌ Deleted when moving to elimination |
| **Backup/Archive** | ❌ No backup created before deletion |
| **Recovery** | ❌ Not possible (unless Firestore backups exist) |
| **Preserved Info** | ✅ Qualified participants list only |
| **Deletion Trigger** | `generateEliminationFromPool()` function |
| **Deletion Location** | `src/composables/useBracketGenerator.ts:1039-1078` |

---

## Related Documentation

- [POOL_DATA_INVESTIGATION.md](./POOL_DATA_INVESTIGATION.md) - Full investigation report
- [POOL_DATA_QUICK_REFERENCE.md](./POOL_DATA_QUICK_REFERENCE.md) - Quick reference guide
- [TOURNAMENT_LEADERBOARD_PLAN.md](./TOURNAMENT_LEADERBOARD_PLAN.md) - Leaderboard architecture
- [DATA_MODEL_MIGRATION_RULES.md](./migration/DATA_MODEL_MIGRATION_RULES.md) - Data model rules
