# Pool Play to Elimination Workflow Analysis

## Executive Summary

This document provides a complete analysis of the **Pool Play to Elimination** tournament workflow in CourtMastr v2. The workflow follows a specific sequence: **Add Players → Seed Players → Configure Format → Generate Pool Play → Play Pool Matches → Generate Elimination Bracket → Play Elimination Matches**.

---

## Workflow Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    POOL PLAY TO ELIMINATION WORKFLOW                             │
└─────────────────────────────────────────────────────────────────────────────────┘

Phase 1: REGISTRATION
┌─────────────────┐
│ 1. Add Players  │
│   to Category   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ 2. Approve      │────▶│ Players in      │
│ Registrations   │     │ "approved" or   │
└─────────────────┘     │ "checked_in"    │
                        │ status          │
                        └────────┬────────┘
                                 │
Phase 2: SEEDING                 ▼
┌─────────────────┐     ┌─────────────────┐
│ 3. Manage Seeds │◄────│ Select Category │
│    (Optional)   │     │ & Open Dialog   │
└────────┬────────┘     └─────────────────┘
         │
         │   ┌─────────────────────────────────────────────────────┐
         │   │ Seed Assignment Logic:                               │
         │   │ • Seeds stored on Registration documents            │
         │   │ • Seeds are numeric (1, 2, 3...)                    │
         │   │ • Unseeded players have seed = null                 │
         │   │ • Auto-shifting prevents duplicates                 │
         │   │ • Typically seed top 4-8 players                    │
         │   └─────────────────────────────────────────────────────┘
         ▼
┌─────────────────┐
│ Seeded Players  │
│ Ready for Draw  │
└────────┬────────┘
         │
Phase 3: FORMAT CONFIG           ▼
┌─────────────────┐     ┌─────────────────────────────────────────────────────┐
│ 4. Configure    │────▶│ Category Settings:                                   │
│    Category     │     │ • Format: "pool_to_elimination"                     │
│                 │     │ • Teams per Pool: 3 (your setting)                  │
│                 │     │ • Draw Method: "serpentine" (Balanced)              │
│                 │     │ • Seeding Enabled: true                             │
│                 │     │ • Qualifiers per Pool: 2 (default)                  │
└─────────────────┘     └─────────────────────────────────────────────────────┘
                                 │
Phase 4: POOL GENERATION         ▼
┌─────────────────┐     ┌─────────────────────────────────────────────────────┐
│ 5. Generate     │────▶│ Pool Generation Algorithm:                           │
│    Bracket      │     │                                                      │
└─────────────────┘     │ A. Collect Registrations                             │
                        │    └─▶ Filter: status = 'approved'|'checked_in'     │
                        │                                                      │
                        │ B. Sort by Seed                                      │
                        │    └─▶ Seeded first (ascending), then unseeded      │
                        │                                                      │
                        │ C. Apply Draw Method                                 │
                        │    └─▶ Serpentine: groups.effort_balanced           │
                        │        (snake distribution across pools)            │
                        │                                                      │
                        │ D. Calculate Pools                                  │
                        │    └─▶ P = ceil(N / K)                              │
                        │        N = number of participants                   │
                        │        K = teams per pool (3)                       │
                        │        P = number of pools                          │
                        │                                                      │
                        │ E. Create Pool Matches (Round Robin)                │
                        │    └─▶ Each pool = round_robin group                │
                        │        Everyone plays everyone in pool              │
                        └─────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           POOL PLAY STAGE                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Pool 1    │  │   Pool 2    │  │   Pool 3    │  │   Pool N    │         │
│  │ ┌─┐ ┌─┐ ┌─┐ │  │ ┌─┐ ┌─┐ ┌─┐ │  │ ┌─┐ ┌─┐ ┌─┐ │  │ ┌─┐ ┌─┐ ┌─┐ │         │
│  │ │1│ │6│ │7│ │  │ │2│ │5│ │8│ │  │ │3│ │4│ │9│ │  │ │...       │         │
│  │ └─┘ └─┘ └─┘ │  │ └─┘ └─┘ └─┘ │  │ └─┘ └─┘ └─┘ │  │ └─────────┘ │         │
│  │  Seed 1     │  │  Seed 2     │  │  Seed 3     │  │             │         │
│  │  Seed 6     │  │  Seed 5     │  │  Seed 4     │  │             │         │
│  │  Unseeded   │  │  Unseeded   │  │  Unseeded   │  │             │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                    │                                         │
│                    Each pool plays round-robin                               │
│                    (everyone vs everyone)                                    │
└──────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
Phase 5: POOL COMPLETION
┌─────────────────┐     ┌─────────────────────────────────────────────────────┐
│ 6. Complete All │────▶│ Pool Standings Calculation:                          │
│    Pool Matches │     │ • Match Points: Win=2, Loss=1                       │
│                 │     │ • Games Won/Lost                                    │
│                 │     │ • Points For/Against                                │
│                 │     │ • Tiebreaker: Head-to-head → Point diff → Total pts │
└─────────────────┘     └─────────────────────────────────────────────────────┘
                                 │
                                 ▼
Phase 6: ADVANCEMENT
┌─────────────────┐     ┌─────────────────────────────────────────────────────┐
│ 7. Generate     │────▶│ Qualification Logic:                                 │
│    Elimination  │     │ • Top N players per pool advance                    │
│                 │     │ • Default: top 2 per pool                           │
│                 │     │ • Seeds re-ordered based on pool performance        │
│                 │     │ • Serpentine seeding into elimination bracket       │
└─────────────────┘     └─────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        ELIMINATION BRACKET                                    │
│                                                                               │
│     Quarterfinals        Semifinals          Finals                          │
│     ┌───┐ ┌───┐         ┌───┐ ┌───┐        ┌───┐                            │
│     │Q1 │ │Q2 │────────▶│S1 │ │S2 │───────▶│ F │                            │
│     └───┘ └───┘         └───┘ └───┘        └───┘                            │
│     ┌───┐ ┌───┐         ┌───┐ ┌───┐                                         │
│     │Q3 │ │Q4 │────────▶│S3 │ │S4 │                                         │
│     └───┘ └───┘         └───┘ └───┘                                         │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                      ┌─────────────────┐
                      │ 8. Complete     │
                      │ Elimination     │
                      │ Matches         │
                      └─────────────────┘
```

---

## Detailed Component Breakdown

### 1. Registration Phase

**Files:**
- `src/stores/registrations.ts` - Registration CRUD operations
- `src/features/registration/views/RegistrationManagementView.vue` - UI for registration management

**Key Functions:**
- `createRegistration()` - Add player to category
- `approveRegistration()` - Approve pending registration
- `checkInRegistration()` - Mark as checked in

**Data Flow:**
```
Player/Team Registration ──▶ Firestore: tournaments/{id}/registrations/{regId}
```

**Critical:** Only registrations with status `'approved'` or `'checked_in'` are eligible for bracket generation.

---

### 2. Seeding Phase

**Files:**
- `src/features/tournaments/dialogs/ManageSeedsDialog.vue` - Seed management UI
- `src/stores/registrations.ts` - `setSeed()`, `batchUpdateSeeds()`

**Key Concepts:**

```typescript
// Registration document structure
interface Registration {
  id: string;
  playerId?: string;
  teamId?: string;
  seed?: number | null;  // ← Seed stored here
  status: 'pending' | 'approved' | 'checked_in' | ...
}
```

**Seed Assignment Rules:**
1. Seeds are numeric (1 = highest/best seed)
2. Only top players need seeds (typically 4-8)
3. Unseeded players have `seed = null`
4. Auto-shifting: Assigning seed N to a player bumps existing seed N to N+1
5. Seeds are used to determine pool placement order

**Algorithm for Seeding Display:**
```typescript
// From ManageSeedsDialog.vue
seedingRegistrations.value = categoryRegistrations
  .map(registration => ({
    id: registration.id,
    name: registration.teamName || getParticipantName(registration.id),
    seed: registration.seed || null,
  }))
  .sort((a, b) => {
    if (a.seed !== null && b.seed !== null) return a.seed - b.seed;
    if (a.seed !== null) return -1;  // Seeded first
    if (b.seed !== null) return 1;
    return a.name.localeCompare(b.name);
  });
```

---

### 3. Format Configuration

**Files:**
- `src/features/tournaments/components/CategoryManagement.vue` - Category setup UI
- `src/types/index.ts` - Type definitions

**Configuration Options:**

```typescript
interface Category {
  format: 'pool_to_elimination';
  teamsPerPool: number;           // 3 in your case
  poolSeedingMethod: 'serpentine' | 'random_in_tiers' | 'fully_random';
  seedingEnabled: boolean;
  poolQualifiersPerGroup: number; // 2 (default)
}
```

**Pool Seeding Methods:**

| Method | Description | Use Case |
|--------|-------------|----------|
| `serpentine` | Rank-sorted players snake across pools | Balanced competition |
| `random_in_tiers` | Random within skill tiers | Some randomness, some balance |
| `fully_random` | Complete blind draw | Maximum randomness |

**Calculation:**
```
Number of Pools (P) = ceil(Number of Players (N) / Teams per Pool (K))

Example: 12 players, 3 per pool
P = ceil(12 / 3) = 4 pools
```

---

### 4. Pool Generation (CRITICAL SECTION)

**Files:**
- `src/composables/useBracketGenerator.ts` - Main generation logic
- `src/utils/poolAssignment.ts` - Pool assignment algorithms

**Entry Point:**
```typescript
// useTournamentSetup.ts → useBracketGenerator.ts
const bracketResult = await bracketGen.generateBracket(
  tournamentId,
  categoryId,
  { grandFinal, consolationFinal }
);
```

**Step-by-Step Pool Generation:**

#### Step 4A: Collect Participants
```typescript
// From useBracketGenerator.ts lines 156-166
const registrationsQuery = query(
  collection(db, 'tournaments', tournamentId, 'registrations'),
  where('categoryId', '==', categoryId),
  where('status', 'in', ['approved', 'checked_in'])  // ← CRITICAL FILTER
);

const registrationsSnap = await getDocs(registrationsQuery);
const registrations = registrationsSnap.docs.map(d => ({
  ...d.data(),
  id: d.id,
})) as Registration[];
```

#### Step 4B: Sort by Seed
```typescript
// From useBracketGenerator.ts lines 175-189
const baseSorted = sortRegistrationsBySeed(registrations);

function sortRegistrationsBySeed(registrations: Registration[]): Registration[] {
  const seeded = registrations
    .filter(r => r.seed !== undefined && r.seed !== null)
    .sort((a, b) => (a.seed || 0) - (b.seed || 0));  // Seed 1 first

  const unseeded = registrations
    .filter(r => r.seed === undefined || r.seed === null)
    .sort(() => Math.random() - 0.5);  // Random order

  return [...seeded, ...unseeded];
}
```

#### Step 4C: Apply Draw Method
```typescript
// From useBracketGenerator.ts lines 639-659
function orderRegistrationsForPool(
  sortedByRank: Registration[],
  method: PoolSeedingMethod,
  numPools: number
): { ordered: Registration[]; seedOrdering: BracketOptions['seedOrdering'] } {
  if (method === 'fully_random') {
    return { ordered: fisherYatesShuffle(sortedByRank), seedOrdering: ['groups.effort_balanced'] };
  }

  if (method === 'random_in_tiers') {
    const tiered: Registration[] = [];
    for (let i = 0; i < sortedByRank.length; i += numPools) {
      const tier = sortedByRank.slice(i, i + numPools);
      tiered.push(...fisherYatesShuffle(tier));
    }
    return { ordered: tiered, seedOrdering: ['groups.effort_balanced'] };
  }

  // serpentine — pass rank-sorted; brackets-manager snakes them into pools
  return { ordered: sortedByRank, seedOrdering: ['groups.effort_balanced'] };
}
```

#### Step 4D: Calculate Pool Structure
```typescript
// From useBracketGenerator.ts lines 696-700
function calculatePoolGroupCount(participantCount: number, teamsPerPool?: number): number {
  const size = teamsPerPool && teamsPerPool >= 2 ? Math.floor(teamsPerPool) : 4;
  return Math.max(1, Math.floor(participantCount / size));
}
```

#### Step 4E: Create Pool Stage via brackets-manager
```typescript
// From useBracketGenerator.ts lines 760-783
async function createPoolStage(
  category: Category,
  manager: BracketsManager,
  storage: ClientFirestoreStorage,
  participantCount: number,
  options: BracketOptions
): Promise<BracketResult> {
  const teamsPerPool = category.teamsPerPool ?? options.teamsPerPool;
  const groupCount = calculatePoolGroupCount(participantCount, teamsPerPool);
  const seeding = createSequentialSeeding(participantCount);

  return createStageWithStats(
    manager,
    storage,
    category.id,
    `${category.name} - Pool Play`,
    'round_robin',  // ← Pool play = round robin
    seeding,
    {
      seedOrdering: getRoundRobinSeedOrdering(options.seedOrdering),  // groups.effort_balanced
      groupCount,  // Number of pools
    }
  );
}
```

**What `groups.effort_balanced` Does:**

This is the brackets-manager library's serpentine/snake distribution. Given sorted participants [1, 2, 3, 4, 5, 6, 7, 8, 9] and 3 pools:

```
Round 1 (Forward):   Pool1←1, Pool2←2, Pool3←3
Round 2 (Backward):  Pool1←6, Pool2←5, Pool3←4  
Round 3 (Forward):   Pool1←7, Pool2←8, Pool3←9

Final Distribution:
Pool 1: [1, 6, 7]  ← Seed 1 + 2 unseeded
Pool 2: [2, 5, 8]  ← Seed 2 + 2 unseeded  
Pool 3: [3, 4, 9]  ← Seed 3 + 2 unseeded
```

Each pool gets exactly one player from each "tier" of skill.

---

### 5. Pool Play Execution

**Data Storage:**
```
tournaments/{tournamentId}/categories/{categoryId}/
├── match/              # brackets-manager structure (read-only)
│   └── {matchId}
├── match_scores/       # Operational data (read/write)
│   └── {matchId}
├── group/              # Pool definitions
│   └── {groupId}
└── round/              # Round definitions
    └── {roundId}
```

**Match Structure:**
- Each pool is a `group` in brackets-manager
- Round-robin: Everyone plays everyone in their pool
- Match status tracked in `match_scores` collection

**Pool Standings Calculation:**
```typescript
// From useBracketGenerator.ts lines 836-994
// Calculates: matches played, won, lost, match points, game points
// Sorts by: match points → matches won → point differential → points for
```

---

### 6. Advancement to Elimination

**Files:**
- `src/composables/useBracketGenerator.ts` - `generateEliminationFromPool()`

**Trigger:** After all pool matches complete

**Process:**

#### Step 6A: Extract Qualifiers
```typescript
// From useBracketGenerator.ts lines 383-394
const qualifiers = extractPoolQualifiers({
  participants,
  matches: poolMatches,
  rounds: poolRounds,
  groups: poolGroups,
  matchScores: matchScoresMap,
  requestedQualifiersPerGroup: options.qualifiersPerGroup ?? category.poolQualifiersPerGroup ?? 2,
});
```

#### Step 6B: Generate Elimination Bracket
```typescript
// From useBracketGenerator.ts lines 404-416
const eliminationSeeding = createSeedingFromParticipantIds(qualifiers.participantIds);
const result = await createStageWithStats(
  manager,
  storage,
  categoryId,
  `${category.name} - Elimination`,
  'single_elimination',
  eliminationSeeding,
  {
    seedOrdering: options.seedOrdering || ['inner_outer'],
    consolationFinal: options.consolationFinal,
  }
);
```

**Category State Update:**
```typescript
await setDoc(
  doc(db, 'tournaments', tournamentId, 'categories', categoryId),
  {
    status: 'active',
    stageId: result.stageId,
    eliminationStageId: result.stageId,
    poolPhase: 'elimination',  // ← Now in elimination phase
    poolGroupCount: qualifiers.groupCount,
    poolQualifiersPerGroup: qualifiers.qualifiersPerGroup,
    poolQualifiedRegistrationIds: qualifiers.registrationIds,
    bracketGeneratedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  },
  { merge: true }
);
```

---

## Data Model Reference

### Category Document
```typescript
interface Category {
  id: string;
  tournamentId: string;
  name: string;
  format: 'pool_to_elimination';
  
  // Pool Configuration
  teamsPerPool: number;           // 3
  poolSeedingMethod: 'serpentine';
  seedingEnabled: boolean;        // true
  poolQualifiersPerGroup: number; // 2
  
  // Runtime State
  status: 'setup' | 'registration' | 'active' | 'completed';
  poolPhase: 'pool' | 'elimination' | null;
  poolStageId: number | null;     // brackets-manager stage ID for pools
  eliminationStageId: number | null;  // brackets-manager stage ID for elimination
  poolGroupCount: number | null;
  poolQualifiedRegistrationIds: string[];
}
```

### Registration Document
```typescript
interface Registration {
  id: string;
  tournamentId: string;
  categoryId: string;
  playerId?: string;
  teamId?: string;
  teamName?: string;
  seed?: number | null;           // ← SEED
  status: 'pending' | 'approved' | 'checked_in' | ...
  registeredAt: Date;
}
```

---

## Key Code Locations

| Purpose | File | Key Function/Line |
|---------|------|-------------------|
| Pool Generation | `useBracketGenerator.ts` | `generateBracket()` line 129 |
| Pool Stage Creation | `useBracketGenerator.ts` | `createPoolStage()` line 760 |
| Draw Method | `useBracketGenerator.ts` | `orderRegistrationsForPool()` line 639 |
| Sort by Seed | `useBracketGenerator.ts` | `sortRegistrationsBySeed()` line 605 |
| Elimination Generation | `useBracketGenerator.ts` | `generateEliminationFromPool()` line 297 |
| Pool Assignment Utils | `poolAssignment.ts` | `assignShuffledSerpentineModelA()` line 143 |
| Pool Validation | `poolAssignment.ts` | `validatePoolAssignment()` line 288 |
| Seeding UI | `ManageSeedsDialog.vue` | `handleSeedInput()` line 82 |
| Batch Seed Update | `registrations.ts` | `batchUpdateSeeds()` line 506 |
| Category Config | `CategoryManagement.vue` | `saveCategory()` line 144 |
| Setup Orchestration | `useTournamentSetup.ts` | `setupCategory()` line 49 |

---

## Common Issues & Debugging

### Issue 1: Players Not Appearing in Pools

**Symptoms:** Generated pools have fewer players than expected

**Check:**
1. Registration status must be `'approved'` or `'checked_in'`
2. Verify in Firestore: `tournaments/{id}/registrations/{regId}.status`
3. Check console for: `"📊 Generating pool_to_elimination bracket for X participants"`

**Debug Command:**
```javascript
// In browser console
const registrations = await firebase.firestore()
  .collection('tournaments/{tournamentId}/registrations')
  .where('categoryId', '==', '{categoryId}')
  .where('status', 'in', ['approved', 'checked_in'])
  .get();
console.log('Eligible registrations:', registrations.size);
```

### Issue 2: Seeding Not Applied

**Symptoms:** Top seeds in same pool, or pools unbalanced

**Check:**
1. Verify seeds are set: `registration.seed` should be number (1, 2, 3...)
2. Check seeding method in category: `category.poolSeedingMethod`
3. Verify `seedingEnabled` is true

**Debug:** Add logging in `orderRegistrationsForPool()`:
```typescript
console.log('Sorted by rank:', baseSorted.map(r => ({ id: r.id, seed: r.seed })));
console.log('Final ordered:', finalOrdered.map(r => ({ id: r.id, seed: r.seed })));
```

### Issue 3: Wrong Number of Pools

**Symptoms:** More/fewer pools than expected

**Formula:**
```
Pools = floor(ParticipantCount / TeamsPerPool)

Example: 10 players, 3 per pool
Pools = floor(10 / 3) = 3 pools
Distribution: Pool1=4, Pool2=3, Pool3=3 (brackets-manager balances)
```

**Check:** `calculatePoolGroupCount()` in `useBracketGenerator.ts` line 696

### Issue 4: Can't Generate Elimination

**Symptoms:** "Pool stage not complete" error

**Check:**
1. All pool matches must have status `'completed'` or `'walkover'`
2. Check `match_scores` collection for pending matches
3. Verify `poolStageId` is set on category document

---

## Testing the Workflow

### Unit Tests
```bash
# Test pool assignment algorithms
npm run test -- tests/unit/poolAssignment.test.ts

# Test bracket generation
npm run test -- tests/unit/bracket.test.ts
```

### E2E Tests
```bash
# Run tournament lifecycle tests
npx playwright test e2e/tournament-lifecycle.spec.ts
```

### Manual Test Checklist

1. [ ] Create tournament
2. [ ] Add category with format = `pool_to_elimination`, teamsPerPool = 3
3. [ ] Register 9+ players
4. [ ] Approve/check-in all registrations
5. [ ] Set seeds on top 3-4 players
6. [ ] Generate bracket
7. [ ] Verify:
   - [ ] Correct number of pools (ceil(N/3))
   - [ ] Each pool has ~3 players
   - [ ] Top seeds distributed across pools (1 per pool)
   - [ ] Each pool = round-robin group
8. [ ] Complete all pool matches
9. [ ] Generate elimination bracket
10. [ ] Verify qualifiers advanced correctly

---

## Summary

The Pool Play to Elimination workflow is a multi-phase process:

1. **Registration**: Players added and approved
2. **Seeding** (optional): Top players assigned seed numbers
3. **Configuration**: Category set to `pool_to_elimination` with `teamsPerPool`
4. **Pool Generation**: 
   - Players sorted by seed
   - Draw method applied (serpentine = balanced)
   - Pools created via brackets-manager with `groups.effort_balanced`
   - Round-robin matches generated per pool
5. **Pool Play**: Matches completed, standings calculated
6. **Advancement**: Top N per pool qualify for elimination
7. **Elimination**: Single/double elimination bracket generated from qualifiers

The key to balanced pools is the **serpentine distribution** which ensures each pool gets one player from each skill tier, preventing stacked pools.
