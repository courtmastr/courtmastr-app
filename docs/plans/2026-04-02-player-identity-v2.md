# Player Identity v2 — Feature-Flagged Identity, Linking & Merge

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a feature-flagged player identity system where `playerId` is the only canonical key, email is optional, players are found via multi-signal candidate matching, linking is always explicit, and admins can merge duplicate player records.

**Architecture:** Three sequential sub-projects on the same feature branch (`feat/player-identity-v2`). Sub-project A lays the data layer and service boundary. B wires the UI flows. C adds the merge workflow and Cloud Function. The global flag in `src/config/featureFlags.ts` gates all new behavior — existing production paths are untouched while it is `false`.

**Tech Stack:** Vue 3 + Pinia + TypeScript strict, Firebase Firestore + Cloud Functions v2, Vitest unit tests, Playwright e2e on emulators.

---

## Pre-flight: Read before starting

Key files to have open:
- [src/types/index.ts](src/types/index.ts) lines 642–663 — `GlobalPlayer` interface (currently `email: string` required)
- [src/stores/players.ts](src/stores/players.ts) lines 31–75 — `findOrCreateByEmail`
- [src/stores/registrations.ts](src/stores/registrations.ts) lines 205–241 — `addPlayer` (calls `findOrCreateByEmail`, throws if email empty)
- [firestore.rules](firestore.rules) lines 305–323 — player + emailIndex rules
- [firestore.indexes.json](firestore.indexes.json) — existing indexes
- [functions/src/index.ts](functions/src/index.ts) — exported Cloud Functions
- [functions/src/playerStats.ts](functions/src/playerStats.ts) — stats aggregation trigger

---

## Sub-project A: Identity Model + Feature Flag + Service Layer

### A-1: Create feature branch and flag

**Files:**
- Create: `src/config/featureFlags.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout master && git pull
git checkout -b feat/player-identity-v2
```

- [ ] **Step 2: Create the flag file**

```typescript
// src/config/featureFlags.ts
// Global flag for player identity v2 system.
// Set to true to enable new identity/linking/merge behavior.
// Set to false (default) to preserve production behavior exactly.
export const PLAYER_IDENTITY_V2 = false;
```

- [ ] **Step 3: Commit**

```bash
git add src/config/featureFlags.ts
git commit -m "feat: add player-identity-v2 feature flag (off by default)"
```

---

### A-2: Update GlobalPlayer type

**Files:**
- Modify: `src/types/index.ts` (lines 646–663)

- [ ] **Step 1: Write the failing type test**

Create file `tests/unit/globalPlayer.types.test.ts`:

```typescript
import { describe, it, expectTypeOf } from 'vitest';
import type { GlobalPlayer } from '@/types';

describe('GlobalPlayer v2 type', () => {
  it('allows email to be null or undefined', () => {
    expectTypeOf<GlobalPlayer['email']>().toEqualTypeOf<string | null | undefined>();
  });

  it('allows emailNormalized to be null or undefined', () => {
    expectTypeOf<GlobalPlayer['emailNormalized']>().toEqualTypeOf<string | null | undefined>();
  });

  it('requires identityStatus field', () => {
    expectTypeOf<GlobalPlayer['identityStatus']>().toEqualTypeOf<
      'active' | 'merged' | 'pending_merge'
    >();
  });

  it('allows mergedIntoPlayerId', () => {
    expectTypeOf<GlobalPlayer['mergedIntoPlayerId']>().toEqualTypeOf<string | null | undefined>();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test -- --run tests/unit/globalPlayer.types.test.ts
```

Expected: FAIL (email is `string`, identityStatus doesn't exist).

- [ ] **Step 3: Update the GlobalPlayer interface**

In `src/types/index.ts`, replace lines 646–663:

```typescript
export type PlayerIdentityStatus = 'active' | 'merged' | 'pending_merge';

export interface GlobalPlayer {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  emailNormalized?: string | null;
  phone?: string | null;
  skillLevel?: number | null;
  userId?: string | null;
  isActive: boolean;
  isVerified: boolean;
  identityStatus: PlayerIdentityStatus;
  mergedIntoPlayerId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  stats: {
    [sport: string]: PlayerSportStats | PlayerStats;
    overall: PlayerStats;
  };
}
```

- [ ] **Step 4: Fix TypeScript errors from the type change**

Run build to find call sites that assumed `email: string` (non-optional):

```bash
npm run build 2>&1 | grep "email" | head -40
```

For each error site, add a null-guard. The pattern is:
- Replace `player.email` → `player.email ?? ''`
- Replace `player.emailNormalized` → `player.emailNormalized ?? ''`
- Do NOT remove the guards — they stay permanently

Common sites to check:
- `src/stores/registrations.ts:213` — change `if (!email) throw new Error(...)` to `if (!email && !PLAYER_IDENTITY_V2) throw new Error('Player email is required')`
- Any template that renders `{{ player.email }}` — add `{{ player.email ?? '—' }}`

- [ ] **Step 5: Run type test to verify it passes**

```bash
npm run test -- --run tests/unit/globalPlayer.types.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run build gate**

```bash
npm run build
```

Expected: 0 type errors.

- [ ] **Step 7: Commit**

```bash
git add src/types/index.ts tests/unit/globalPlayer.types.test.ts src/stores/registrations.ts
git commit -m "feat: make GlobalPlayer.email optional, add identityStatus + mergedIntoPlayerId"
```

---

### A-3: Add candidate matching service

**Files:**
- Create: `src/services/playerIdentityService.ts`
- Test: `tests/unit/playerIdentityService.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/playerIdentityService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findPlayerCandidates, rankCandidates } from '@/services/playerIdentityService';
import type { GlobalPlayer } from '@/types';

const makeplayer = (overrides: Partial<GlobalPlayer> = {}): GlobalPlayer => ({
  id: 'p1',
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@test.com',
  emailNormalized: 'alice@test.com',
  phone: '555-1234',
  userId: null,
  isActive: true,
  isVerified: false,
  identityStatus: 'active',
  mergedIntoPlayerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  stats: { overall: { wins: 0, losses: 0, gamesPlayed: 0, tournamentsPlayed: 0 } },
  ...overrides,
});

describe('rankCandidates', () => {
  it('returns empty array when no players provided', () => {
    expect(rankCandidates([], { firstName: 'Alice', lastName: 'Smith' })).toEqual([]);
  });

  it('matches by userId first (highest priority)', () => {
    const players = [
      makeplayer({ id: 'p1', userId: 'u1', firstName: 'Alice', lastName: 'Smith' }),
      makeplayer({ id: 'p2', userId: 'u2', firstName: 'Alice', lastName: 'Smith' }),
    ];
    const results = rankCandidates(players, { userId: 'u1', firstName: 'Alice', lastName: 'Smith' });
    expect(results[0].player.id).toBe('p1');
    expect(results[0].matchedSignals).toContain('userId');
  });

  it('matches name+phone when both present', () => {
    const players = [makeplayer({ id: 'p1', phone: '555-1234' })];
    const results = rankCandidates(players, {
      firstName: 'Alice', lastName: 'Smith', phone: '555-1234',
    });
    expect(results[0].matchedSignals).toContain('name+phone');
  });

  it('matches name+email when phone absent', () => {
    const players = [makeplayer({ id: 'p1', email: 'alice@test.com', phone: null })];
    const results = rankCandidates(players, {
      firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com',
    });
    expect(results[0].matchedSignals).toContain('name+email');
  });

  it('skips tombstoned (merged) players', () => {
    const players = [makeplayer({ id: 'p1', identityStatus: 'merged' })];
    const results = rankCandidates(players, { firstName: 'Alice', lastName: 'Smith' });
    expect(results).toHaveLength(0);
  });

  it('skips inactive players', () => {
    const players = [makeplayer({ id: 'p1', isActive: false })];
    const results = rankCandidates(players, { firstName: 'Alice', lastName: 'Smith' });
    expect(results).toHaveLength(0);
  });

  it('does not auto-link on email-only match', () => {
    const players = [makeplayer({ id: 'p1', firstName: 'Bob', lastName: 'Jones' })];
    const results = rankCandidates(players, {
      firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com',
    });
    // email-only match should appear but with lowest score
    expect(results[0].matchedSignals).toContain('email');
    expect(results[0].matchScore).toBeLessThan(10);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test -- --run tests/unit/playerIdentityService.test.ts
```

Expected: FAIL (module doesn't exist).

- [ ] **Step 3: Implement the service**

```typescript
// src/services/playerIdentityService.ts
import {
  db,
  collection,
  doc,
  getDocs,
  runTransaction,
  serverTimestamp,
  query,
  where,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';
import type { GlobalPlayer } from '@/types';

// -----------------------------------------------
// Types
// -----------------------------------------------

export type CandidateSignal = 'userId' | 'name+phone' | 'name+email' | 'email' | 'name';

const SIGNAL_SCORE: Record<CandidateSignal, number> = {
  userId: 100,
  'name+phone': 50,
  'name+email': 40,
  email: 8,
  name: 5,
};

export interface CandidateMatch {
  player: GlobalPlayer;
  matchScore: number;
  matchedSignals: CandidateSignal[];
}

export interface PlayerInput {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
}

// -----------------------------------------------
// Pure ranking — no Firestore dependency
// -----------------------------------------------

export function rankCandidates(
  players: GlobalPlayer[],
  input: PlayerInput,
  maxResults = 5
): CandidateMatch[] {
  const emailNorm = input.email?.toLowerCase().trim() ?? null;
  const firstLower = input.firstName.toLowerCase().trim();
  const lastLower = input.lastName.toLowerCase().trim();
  const phoneTrim = input.phone?.replace(/\D/g, '') ?? null;

  const results: CandidateMatch[] = [];

  for (const player of players) {
    // Skip tombstones and inactive
    if (player.identityStatus === 'merged' || !player.isActive) continue;

    const signals: CandidateSignal[] = [];

    // userId match
    if (input.userId && player.userId && input.userId === player.userId) {
      signals.push('userId');
    }

    const nameMatch =
      player.firstName.toLowerCase().trim() === firstLower &&
      player.lastName.toLowerCase().trim() === lastLower;

    const playerPhone = player.phone?.replace(/\D/g, '') ?? null;
    if (nameMatch && phoneTrim && playerPhone && phoneTrim === playerPhone) {
      signals.push('name+phone');
    }

    if (nameMatch && emailNorm && player.emailNormalized && emailNorm === player.emailNormalized) {
      signals.push('name+email');
    }

    if (emailNorm && player.emailNormalized && emailNorm === player.emailNormalized) {
      // Only add email-only if name didn't match
      if (!nameMatch) signals.push('email');
    }

    if (nameMatch && signals.length === 0) {
      signals.push('name');
    }

    if (signals.length === 0) continue;

    const matchScore = signals.reduce((sum, s) => sum + SIGNAL_SCORE[s], 0);
    results.push({ player, matchScore, matchedSignals: signals });
  }

  return results
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, maxResults);
}

// -----------------------------------------------
// Firestore operations
// -----------------------------------------------

/**
 * Query /players for candidates matching the input.
 * Uses emailNormalized index if email provided, then ranks all results.
 */
export async function findPlayerCandidates(input: PlayerInput): Promise<CandidateMatch[]> {
  const candidates: GlobalPlayer[] = [];

  // If email provided — use the index for fast lookup
  if (input.email) {
    const emailNorm = input.email.toLowerCase().trim();
    const q = query(
      collection(db, 'players'),
      where('emailNormalized', '==', emailNorm),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    snap.docs.forEach((d) =>
      candidates.push(convertTimestamps({ id: d.id, ...d.data() }) as GlobalPlayer)
    );
  }

  // Also query by name (lastName index)
  const nameQ = query(
    collection(db, 'players'),
    where('lastName', '==', input.lastName),
    where('isActive', '==', true)
  );
  const nameSnap = await getDocs(nameQ);
  nameSnap.docs.forEach((d) => {
    const p = convertTimestamps({ id: d.id, ...d.data() }) as GlobalPlayer;
    if (!candidates.find((c) => c.id === p.id)) candidates.push(p);
  });

  return rankCandidates(candidates, input);
}

/**
 * Link to an existing player (by explicit choice) or create a new one.
 * Returns the globalPlayerId.
 *
 * - Pass chosenPlayerId to link to an existing player.
 * - Pass null/undefined to always create a new player (even if email matches someone).
 */
export async function linkOrCreatePlayer(
  input: PlayerInput,
  chosenPlayerId: string | null
): Promise<string> {
  if (chosenPlayerId) {
    // Linking to existing: verify they exist and are active
    const playerRef = doc(db, 'players', chosenPlayerId);
    const snap = await playerRef.get ? (await (playerRef as any).get()) : null;
    // Use getDoc directly
    const { getDoc } = await import('@/services/firebase');
    const playerSnap = await getDoc(doc(db, 'players', chosenPlayerId));
    if (!playerSnap.exists()) throw new Error(`Player ${chosenPlayerId} not found`);
    const data = playerSnap.data() as GlobalPlayer;
    if (!data.isActive || data.identityStatus === 'merged') {
      throw new Error(`Player ${chosenPlayerId} is not active`);
    }
    return chosenPlayerId;
  }

  // Create new player (never checks email index in v2)
  const newPlayerRef = doc(collection(db, 'players'));
  const now = serverTimestamp();
  const emailNorm = input.email?.toLowerCase().trim() ?? null;

  await runTransaction(db, async (transaction) => {
    transaction.set(newPlayerRef, {
      id: newPlayerRef.id,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ?? null,
      emailNormalized: emailNorm,
      phone: input.phone ?? null,
      skillLevel: null,
      userId: input.userId ?? null,
      isActive: true,
      isVerified: false,
      identityStatus: 'active' as const,
      mergedIntoPlayerId: null,
      createdAt: now,
      updatedAt: now,
      stats: {
        overall: { wins: 0, losses: 0, gamesPlayed: 0, tournamentsPlayed: 0 },
      },
    });
  });

  return newPlayerRef.id;
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- --run tests/unit/playerIdentityService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run build gate**

```bash
npm run build
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/playerIdentityService.ts tests/unit/playerIdentityService.test.ts
git commit -m "feat: add playerIdentityService with candidate ranking and linkOrCreate"
```

---

### A-4: Gate registrations.ts addPlayer behind the flag

**Files:**
- Modify: `src/stores/registrations.ts`
- Test: `tests/unit/registrations.store.test.ts`

- [ ] **Step 1: Write a failing test for flag-off behavior preservation**

In `tests/unit/registrations.store.test.ts`, add:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Ensure flag is off for these tests
vi.mock('@/config/featureFlags', () => ({ PLAYER_IDENTITY_V2: false }));

describe('addPlayer (flag OFF — legacy path)', () => {
  it('throws when email is empty', async () => {
    // ... existing test or new one verifying the throw still happens
    // Reference existing test file pattern from tests/unit/
  });
});

describe('addPlayer (flag ON — v2 path)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/config/featureFlags', () => ({ PLAYER_IDENTITY_V2: true }));
  });

  it('does not throw when email is empty', async () => {
    // Should call linkOrCreatePlayer(input, null) instead of findOrCreateByEmail
  });
});
```

Run: `npm run test -- --run tests/unit/registrations.store.test.ts`
Expected: FAIL (v2 path not implemented).

- [ ] **Step 2: Update addPlayer in registrations.ts**

Replace the `addPlayer` function body in `src/stores/registrations.ts` (lines 205–241):

```typescript
async function addPlayer(
  tournamentId: string,
  playerData: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>,
  chosenPlayerId?: string | null  // v2: explicit link choice (null = create new)
): Promise<string> {
  try {
    const { PLAYER_IDENTITY_V2 } = await import('@/config/featureFlags');
    let globalPlayerId: string;

    if (PLAYER_IDENTITY_V2) {
      // v2: use linkOrCreatePlayer — email is optional
      const { linkOrCreatePlayer } = await import('@/services/playerIdentityService');
      globalPlayerId = await linkOrCreatePlayer(
        {
          firstName: playerData.firstName,
          lastName: playerData.lastName,
          email: playerData.email ?? null,
          phone: playerData.phone ?? null,
        },
        chosenPlayerId ?? null
      );
    } else {
      // v1 legacy: email required, find-or-create by email index
      const playersStore = usePlayersStore();
      const email = playerData.email?.trim() || '';
      if (!email) throw new Error('Player email is required');
      globalPlayerId = await playersStore.findOrCreateByEmail(email, {
        firstName: playerData.firstName,
        lastName: playerData.lastName,
        phone: playerData.phone ?? undefined,
        skillLevel: playerData.skillLevel ?? undefined,
      });
    }

    // Write tournament mirror — same in both paths
    await setDoc(
      doc(db, `tournaments/${tournamentId}/players`, globalPlayerId),
      {
        ...playerData,
        id: globalPlayerId,
        globalPlayerId,
        emailNormalized: playerData.email?.toLowerCase().trim() ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );

    return globalPlayerId;
  } catch (err) {
    console.error('Error adding player:', err);
    throw err;
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npm run test -- --run tests/unit/registrations.store.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/stores/registrations.ts tests/unit/registrations.store.test.ts
git commit -m "feat: gate addPlayer behind PLAYER_IDENTITY_V2 flag"
```

---

### A-5: Update Firestore rules and indexes

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`

- [ ] **Step 1: Add indexes for candidate queries**

In `firestore.indexes.json`, add to the `indexes` array:

```json
{
  "collectionGroup": "players",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "lastName", "order": "ASCENDING" },
    { "fieldPath": "isActive", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "players",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "identityStatus", "order": "ASCENDING" },
    { "fieldPath": "lastName", "order": "ASCENDING" }
  ]
}
```

- [ ] **Step 2: Update player Firestore rules to handle optional email and identityStatus**

In `firestore.rules`, find the `/players/{playerId}` block (lines ~305–318) and update the `update` rule to also prevent clients from directly setting `identityStatus: 'merged'` or `mergedIntoPlayerId`:

```javascript
match /players/{playerId} {
  allow read: if true;
  allow create: if isAuthenticated();
  allow update: if isAdmin()
    || (isOwner(resource.data.userId)
        && !request.resource.data.diff(resource.data).affectedKeys()
             .hasAny(['isVerified', 'stats', 'identityStatus', 'mergedIntoPlayerId']));
  allow delete: if isAdmin();
}
```

- [ ] **Step 3: Add mergeRequests collection rules (placeholder for Sub-project C)**

```javascript
match /mergeRequests/{requestId} {
  allow read: if isAdmin() || isOrganizer();
  allow create: if isAuthenticated();
  allow update: if isAdmin() || isOrganizer();
  allow delete: if isAdmin();
}
```

- [ ] **Step 4: Validate emulator boots**

```bash
npm run check:firebase-env
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules firestore.indexes.json
git commit -m "feat: update firestore rules for identity v2 fields and mergeRequests"
```

---

### A-6: Sub-project A verification gate

- [ ] Run targeted tests

```bash
npm run test -- --run tests/unit/globalPlayer.types.test.ts tests/unit/playerIdentityService.test.ts tests/unit/registrations.store.test.ts
```

Expected: All PASS.

- [ ] Run full gates

```bash
npm run check:firebase-env
npm run build
npm run build:log
```

Expected: All clean.

---

## Sub-project B: Linking UI Flows

### B-1: PlayerCandidatePicker composable

**Files:**
- Create: `src/composables/usePlayerCandidatePicker.ts`
- Test: `tests/unit/usePlayerCandidatePicker.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/unit/usePlayerCandidatePicker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlayerCandidatePicker } from '@/composables/usePlayerCandidatePicker';

vi.mock('@/config/featureFlags', () => ({ PLAYER_IDENTITY_V2: true }));
vi.mock('@/services/playerIdentityService', () => ({
  findPlayerCandidates: vi.fn(),
}));

import { findPlayerCandidates } from '@/services/playerIdentityService';

describe('usePlayerCandidatePicker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with empty candidates and no selection', () => {
    const { candidates, selectedCandidate, isLoading } = usePlayerCandidatePicker();
    expect(candidates.value).toEqual([]);
    expect(selectedCandidate.value).toBeNull();
    expect(isLoading.value).toBe(false);
  });

  it('populates candidates on search', async () => {
    const mockCandidate = {
      player: { id: 'p1', firstName: 'Alice', lastName: 'Smith' },
      matchScore: 40,
      matchedSignals: ['name+email'],
    };
    vi.mocked(findPlayerCandidates).mockResolvedValue([mockCandidate] as any);

    const { candidates, search } = usePlayerCandidatePicker();
    await search({ firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com' });
    expect(candidates.value).toHaveLength(1);
    expect(candidates.value[0].player.id).toBe('p1');
  });

  it('selectExisting sets selectedCandidate', () => {
    const { selectedCandidate, selectExisting } = usePlayerCandidatePicker();
    selectExisting('p1');
    expect(selectedCandidate.value).toBe('p1');
  });

  it('selectCreateNew clears selectedCandidate', () => {
    const { selectedCandidate, selectExisting, selectCreateNew } = usePlayerCandidatePicker();
    selectExisting('p1');
    selectCreateNew();
    expect(selectedCandidate.value).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm run test -- --run tests/unit/usePlayerCandidatePicker.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the composable**

```typescript
// src/composables/usePlayerCandidatePicker.ts
import { ref } from 'vue';
import { PLAYER_IDENTITY_V2 } from '@/config/featureFlags';
import { findPlayerCandidates } from '@/services/playerIdentityService';
import type { CandidateMatch, PlayerInput } from '@/services/playerIdentityService';

export function usePlayerCandidatePicker() {
  const candidates = ref<CandidateMatch[]>([]);
  const selectedCandidate = ref<string | null>(null); // playerId or null = create new
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function search(input: PlayerInput): Promise<void> {
    if (!PLAYER_IDENTITY_V2) return;
    isLoading.value = true;
    error.value = null;
    try {
      candidates.value = await findPlayerCandidates(input);
    } catch (err) {
      error.value = 'Could not load player suggestions';
      console.error(err);
    } finally {
      isLoading.value = false;
    }
  }

  function selectExisting(playerId: string): void {
    selectedCandidate.value = playerId;
  }

  function selectCreateNew(): void {
    selectedCandidate.value = null;
  }

  function reset(): void {
    candidates.value = [];
    selectedCandidate.value = null;
    error.value = null;
  }

  return { candidates, selectedCandidate, isLoading, error, search, selectExisting, selectCreateNew, reset };
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- --run tests/unit/usePlayerCandidatePicker.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/composables/usePlayerCandidatePicker.ts tests/unit/usePlayerCandidatePicker.test.ts
git commit -m "feat: add usePlayerCandidatePicker composable for v2 linking flow"
```

---

### B-2: PlayerCandidateSuggestions component

**Files:**
- Create: `src/components/players/PlayerCandidateSuggestions.vue`

- [ ] **Step 1: Create the component**

```vue
<!-- src/components/players/PlayerCandidateSuggestions.vue -->
<script setup lang="ts">
import type { CandidateMatch } from '@/services/playerIdentityService';

const props = defineProps<{
  candidates: CandidateMatch[];
  selectedPlayerId: string | null;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  'select-existing': [playerId: string];
  'create-new': [];
}>();

const signalLabel: Record<string, string> = {
  userId: 'Logged-in account',
  'name+phone': 'Name + phone',
  'name+email': 'Name + email',
  email: 'Email only',
  name: 'Name only',
};
</script>

<template>
  <div v-if="isLoading" class="text-body-2 text-medium-emphasis py-2">
    Searching for matching players…
  </div>

  <div v-else-if="candidates.length > 0">
    <p class="text-body-2 font-weight-medium mb-2">Possible matches found:</p>
    <v-list density="compact" class="mb-2">
      <v-list-item
        v-for="c in candidates"
        :key="c.player.id"
        :value="c.player.id"
        :active="selectedPlayerId === c.player.id"
        @click="emit('select-existing', c.player.id)"
        rounded
      >
        <v-list-item-title>
          {{ c.player.firstName }} {{ c.player.lastName }}
        </v-list-item-title>
        <v-list-item-subtitle>
          {{ c.player.email ?? 'No email' }} ·
          <span v-for="sig in c.matchedSignals" :key="sig" class="text-primary">
            {{ signalLabel[sig] }}
          </span>
        </v-list-item-subtitle>
        <template #append>
          <v-icon v-if="selectedPlayerId === c.player.id" color="primary">
            mdi-check-circle
          </v-icon>
        </template>
      </v-list-item>
    </v-list>
    <v-btn
      variant="text"
      size="small"
      :color="selectedPlayerId === null ? 'primary' : 'default'"
      @click="emit('create-new')"
    >
      Create as new player anyway
    </v-btn>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/players/PlayerCandidateSuggestions.vue
git commit -m "feat: add PlayerCandidateSuggestions component"
```

---

### B-3: Wire candidate picker into organizer add-player flow

Find the organizer's "Add Player" form. Based on codebase patterns, this lives in the registrations management view.
<br>**Note:** Before implementing, run:

```bash
grep -rn "addPlayer\|findOrCreateByEmail" src/ --include="*.vue" --include="*.ts" | grep -v "node_modules"
```

Identify the Vue component that calls `registrationsStore.addPlayer()` (likely `src/features/registration/views/ParticipantsView.vue` or similar).

**Files:**
- Modify: `[identified add-player view]`

- [ ] **Step 1: Add candidate search trigger**

In the add-player form component, import and use `usePlayerCandidatePicker`. After the user fills in name + email (on blur or submit attempt), call `search()` with the form values.

```typescript
import { usePlayerCandidatePicker } from '@/composables/usePlayerCandidatePicker';
import { PLAYER_IDENTITY_V2 } from '@/config/featureFlags';

const { candidates, selectedCandidate, isLoading: candidatesLoading,
        search: searchCandidates, selectExisting, selectCreateNew, reset: resetCandidates } =
  usePlayerCandidatePicker();

async function onEmailBlur() {
  if (!PLAYER_IDENTITY_V2) return;
  if (form.firstName && form.lastName) {
    await searchCandidates({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || null,
      phone: form.phone || null,
    });
  }
}
```

- [ ] **Step 2: Insert PlayerCandidateSuggestions below the form fields (when flag is on)**

```vue
<PlayerCandidateSuggestions
  v-if="PLAYER_IDENTITY_V2"
  :candidates="candidates"
  :selected-player-id="selectedCandidate"
  :is-loading="candidatesLoading"
  @select-existing="selectExisting"
  @create-new="selectCreateNew"
/>
```

- [ ] **Step 3: Pass selectedCandidate to addPlayer**

Change the submit handler to pass `selectedCandidate.value` (which is `null` when "create new"):

```typescript
async function handleSubmit() {
  const playerId = await registrationsStore.addPlayer(
    tournamentId,
    formData,
    PLAYER_IDENTITY_V2 ? selectedCandidate.value : undefined
  );
  resetCandidates();
}
```

- [ ] **Step 4: Run build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add [modified vue file]
git commit -m "feat: add candidate suggestions to organizer add-player flow"
```

---

### B-4: Wire candidate picker into self-registration flow

Find `src/features/registration/views/SelfRegistrationView.vue` (confirmed in codebase).

**Files:**
- Modify: `src/features/registration/views/SelfRegistrationView.vue`

- [ ] **Step 1: Apply same pattern as B-3**

Add `usePlayerCandidatePicker`, trigger search on name+email input, show `PlayerCandidateSuggestions`, pass `selectedCandidate` when submitting.

Key difference: if the user is logged in (`authStore.user.uid`), pass `userId: authStore.user.uid` in the search input so a userId match scores highest.

```typescript
await searchCandidates({
  firstName: form.firstName,
  lastName: form.lastName,
  email: form.email || null,
  userId: authStore.user?.uid ?? null,
});
```

- [ ] **Step 2: Run build + tests**

```bash
npm run build
npm run test -- --run tests/unit/usePlayerCandidatePicker.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/features/registration/views/SelfRegistrationView.vue
git commit -m "feat: add candidate suggestions to self-registration flow"
```

---

### B-5: Sub-project B verification gate

- [ ] Run all new tests

```bash
npm run test -- --run tests/unit/usePlayerCandidatePicker.test.ts tests/unit/registrations.store.test.ts
```

- [ ] Run build gates

```bash
npm run build
npm run build:log
```

- [ ] Manual smoke with flag ON (emulator)

```bash
# In .env.local, set VITE_USE_FIREBASE_EMULATOR=true
# Manually toggle PLAYER_IDENTITY_V2 = true in src/config/featureFlags.ts
# Run dev server: npm run dev
# Add a player in organizer view — verify candidate suggestions appear
# Add player with no email — verify it works (no error)
# Add player via self-registration — verify candidates appear
```

---

## Sub-project C: Merge Workflows

### C-1: MergeRequest type + Firestore schema

**Files:**
- Modify: `src/types/index.ts`
- Test: `tests/unit/mergeRequest.types.test.ts`

- [ ] **Step 1: Write type test**

```typescript
// tests/unit/mergeRequest.types.test.ts
import { describe, it, expectTypeOf } from 'vitest';
import type { MergeRequest, MergeRequestStatus } from '@/types';

describe('MergeRequest type', () => {
  it('has correct status values', () => {
    expectTypeOf<MergeRequestStatus>().toEqualTypeOf<
      'pending' | 'approved' | 'rejected' | 'completed'
    >();
  });

  it('requires sourcePlayerId and targetPlayerId', () => {
    expectTypeOf<MergeRequest['sourcePlayerId']>().toEqualTypeOf<string>();
    expectTypeOf<MergeRequest['targetPlayerId']>().toEqualTypeOf<string>();
  });
});
```

- [ ] **Step 2: Run to verify fails**

```bash
npm run test -- --run tests/unit/mergeRequest.types.test.ts
```

- [ ] **Step 3: Add types to src/types/index.ts**

```typescript
// Add after GlobalPlayer definition

export type MergeRequestStatus = 'pending' | 'approved' | 'rejected' | 'completed';
export type MergeRequestRole = 'player' | 'organizer' | 'admin';

export interface MergeRequest {
  id: string;
  sourcePlayerId: string;   // player to be tombstoned
  targetPlayerId: string;   // surviving player
  requestedBy: string;      // userId
  requestedByRole: MergeRequestRole;
  status: MergeRequestStatus;
  reason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Audit: set when both players have different userId values
  conflictingUserIds?: boolean;
  conflictOverrideConfirmed?: boolean;
}
```

- [ ] **Step 4: Run type test**

```bash
npm run test -- --run tests/unit/mergeRequest.types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts tests/unit/mergeRequest.types.test.ts
git commit -m "feat: add MergeRequest type definitions"
```

---

### C-2: MergeRequest store (client-side)

**Files:**
- Create: `src/stores/mergeRequests.ts`
- Test: `tests/unit/mergeRequests.store.test.ts`

- [ ] **Step 1: Write failing store tests**

```typescript
// tests/unit/mergeRequests.store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useMergeRequestsStore } from '@/stores/mergeRequests';

vi.mock('@/services/firebase', () => ({
  db: {},
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => new Date()),
}));

describe('useMergeRequestsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initializes with empty requests', () => {
    const store = useMergeRequestsStore();
    expect(store.requests).toEqual([]);
  });

  it('requestMerge calls addDoc with correct shape', async () => {
    const { addDoc } = await import('@/services/firebase');
    vi.mocked(addDoc).mockResolvedValue({ id: 'mr1' } as any);

    const store = useMergeRequestsStore();
    await store.requestMerge({
      sourcePlayerId: 'p1',
      targetPlayerId: 'p2',
      requestedBy: 'u1',
      requestedByRole: 'player',
      reason: 'duplicate account',
    });

    expect(addDoc).toHaveBeenCalledOnce();
    const call = vi.mocked(addDoc).mock.calls[0][1];
    expect(call.status).toBe('pending');
    expect(call.sourcePlayerId).toBe('p1');
    expect(call.targetPlayerId).toBe('p2');
  });
});
```

- [ ] **Step 2: Run to verify fails**

```bash
npm run test -- --run tests/unit/mergeRequests.store.test.ts
```

- [ ] **Step 3: Implement the store**

```typescript
// src/stores/mergeRequests.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  db,
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';
import type { MergeRequest, MergeRequestRole } from '@/types';

interface RequestMergeInput {
  sourcePlayerId: string;
  targetPlayerId: string;
  requestedBy: string;
  requestedByRole: MergeRequestRole;
  reason?: string;
}

export const useMergeRequestsStore = defineStore('mergeRequests', () => {
  const requests = ref<MergeRequest[]>([]);
  const loading = ref(false);

  async function requestMerge(input: RequestMergeInput): Promise<string> {
    const docRef = await addDoc(collection(db, 'mergeRequests'), {
      sourcePlayerId: input.sourcePlayerId,
      targetPlayerId: input.targetPlayerId,
      requestedBy: input.requestedBy,
      requestedByRole: input.requestedByRole,
      status: 'pending',
      reason: input.reason ?? null,
      reviewedBy: null,
      reviewedAt: null,
      completedAt: null,
      conflictingUserIds: false,
      conflictOverrideConfirmed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  async function reviewRequest(
    requestId: string,
    decision: 'approved' | 'rejected',
    reviewedBy: string
  ): Promise<void> {
    await updateDoc(doc(db, 'mergeRequests', requestId), {
      status: decision,
      reviewedBy,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function fetchPendingRequests(): Promise<void> {
    loading.value = true;
    try {
      const q = query(
        collection(db, 'mergeRequests'),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      requests.value = snap.docs.map((d) =>
        convertTimestamps({ id: d.id, ...d.data() }) as MergeRequest
      );
    } finally {
      loading.value = false;
    }
  }

  return { requests, loading, requestMerge, reviewRequest, fetchPendingRequests };
});
```

- [ ] **Step 4: Run tests**

```bash
npm run test -- --run tests/unit/mergeRequests.store.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/mergeRequests.ts tests/unit/mergeRequests.store.test.ts
git commit -m "feat: add mergeRequests store with requestMerge and reviewRequest"
```

---

### C-3: Merge Cloud Function

**Files:**
- Create: `functions/src/playerMerge.ts`
- Modify: `functions/src/index.ts`
- Test: `functions/src/playerMerge.test.ts` (Vitest or Jest — check `functions/package.json` for test runner)

- [ ] **Step 1: Write failing Cloud Function test**

```typescript
// functions/src/playerMerge.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase-admin
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => mockDb),
  FieldValue: { serverTimestamp: () => 'TIMESTAMP' },
}));

const mockDb: any = {};

describe('executeMerge validation', () => {
  it('throws if sourcePlayerId === targetPlayerId', async () => {
    const { executeMergeLogic } = await import('./playerMerge');
    await expect(
      executeMergeLogic({ sourcePlayerId: 'p1', targetPlayerId: 'p1', requestedBy: 'u1' }, mockDb)
    ).rejects.toThrow('Cannot merge player with itself');
  });
});
```

- [ ] **Step 2: Run to verify fails**

```bash
cd functions && npm run test -- --run src/playerMerge.test.ts
```

- [ ] **Step 3: Implement the merge Cloud Function**

```typescript
// functions/src/playerMerge.ts
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

interface MergePlayerInput {
  mergeRequestId?: string;    // For approval-path merges
  sourcePlayerId: string;     // Will be tombstoned
  targetPlayerId: string;     // Survives
}

/**
 * Pure merge logic — extracted for unit testing.
 */
export async function executeMergeLogic(
  input: { sourcePlayerId: string; targetPlayerId: string; requestedBy: string },
  db: admin.firestore.Firestore
): Promise<void> {
  if (input.sourcePlayerId === input.targetPlayerId) {
    throw new Error('Cannot merge player with itself');
  }

  const sourceRef = db.doc(`players/${input.sourcePlayerId}`);
  const targetRef = db.doc(`players/${input.targetPlayerId}`);

  const [sourceSnap, targetSnap] = await Promise.all([sourceRef.get(), targetRef.get()]);

  if (!sourceSnap.exists) throw new Error(`Source player ${input.sourcePlayerId} not found`);
  if (!targetSnap.exists) throw new Error(`Target player ${input.targetPlayerId} not found`);

  const source = sourceSnap.data()!;
  if (source.identityStatus === 'merged') throw new Error('Source player is already merged');

  // Step 1: Find all registrations pointing to source (as primary or partner)
  const [primarySnap, partnerSnap] = await Promise.all([
    db.collectionGroup('registrations').where('playerId', '==', input.sourcePlayerId).get(),
    db.collectionGroup('registrations').where('partnerPlayerId', '==', input.sourcePlayerId).get(),
  ]);

  // Step 2: Batch repoint registrations + tombstone source
  const MAX_BATCH = 490; // Firestore batch limit is 500
  let batch = db.batch();
  let opCount = 0;

  const flush = async () => {
    if (opCount > 0) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  };

  for (const regDoc of primarySnap.docs) {
    batch.update(regDoc.ref, { playerId: input.targetPlayerId });
    opCount++;
    if (opCount >= MAX_BATCH) await flush();
  }

  for (const regDoc of partnerSnap.docs) {
    batch.update(regDoc.ref, { partnerPlayerId: input.targetPlayerId });
    opCount++;
    if (opCount >= MAX_BATCH) await flush();
  }

  // Tombstone source player
  batch.update(sourceRef, {
    identityStatus: 'merged',
    mergedIntoPlayerId: input.targetPlayerId,
    isActive: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  opCount++;

  await flush();
  await batch.commit();

  // Step 3: Recompute stats for target player
  // Import the stats aggregation logic
  const { recomputePlayerStats } = await import('./playerStats');
  await recomputePlayerStats(input.targetPlayerId, db);
}

/**
 * Cloud Function: executeMerge
 * Requires admin or organizer-level auth.
 */
export const executeMerge = onCall(
  { enforceAppCheck: false },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be logged in');

    const db = admin.firestore();
    const callerUid = request.auth.uid;

    // Verify caller is admin or organizer
    const userDoc = await db.doc(`users/${callerUid}`).get();
    if (!userDoc.exists) throw new HttpsError('permission-denied', 'User not found');
    const userRole = userDoc.data()?.role;
    if (!['admin', 'organizer'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Admin or organizer role required');
    }

    const { mergeRequestId, sourcePlayerId, targetPlayerId } =
      request.data as MergePlayerInput;

    // If mergeRequestId provided, validate the request is approved
    if (mergeRequestId) {
      const mrSnap = await db.doc(`mergeRequests/${mergeRequestId}`).get();
      if (!mrSnap.exists) throw new HttpsError('not-found', 'Merge request not found');
      const mr = mrSnap.data()!;
      if (mr.status !== 'approved') {
        throw new HttpsError('failed-precondition', 'Merge request is not approved');
      }
    }

    try {
      await executeMergeLogic({ sourcePlayerId, targetPlayerId, requestedBy: callerUid }, db);

      // Mark merge request completed
      if (mergeRequestId) {
        await db.doc(`mergeRequests/${mergeRequestId}`).update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return { success: true, targetPlayerId };
    } catch (err) {
      throw new HttpsError('internal', (err as Error).message);
    }
  }
);
```

- [ ] **Step 4: Export from functions/src/index.ts**

Add to `functions/src/index.ts`:
```typescript
export { executeMerge } from './playerMerge';
```

- [ ] **Step 5: Run function tests**

```bash
cd functions && npm run test -- --run src/playerMerge.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run functions build**

```bash
cd functions && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add functions/src/playerMerge.ts functions/src/index.ts functions/src/playerMerge.test.ts
git commit -m "feat: add executeMerge Cloud Function with batch repoint and tombstone"
```

---

### C-4: Admin merge UI

**Files:**
- Create: `src/features/players/views/PlayerMergeView.vue`
- Modify: `src/router/index.ts` (add route `/players/:id/merge`)

- [ ] **Step 1: Create the merge view**

This view lets an admin:
1. See the source player (pre-filled from route param)
2. Search for the target player
3. Review what will happen (registrations repainted, source tombstoned)
4. Confirm and call `executeMerge`

```vue
<!-- src/features/players/views/PlayerMergeView.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/services/firebase';
import { usePlayersStore } from '@/stores/players';
import { useNotificationStore } from '@/stores/notification';

const route = useRoute();
const router = useRouter();
const playersStore = usePlayersStore();
const notificationStore = useNotificationStore();

const sourcePlayerId = route.params.id as string;
const targetPlayerId = ref('');
const isConfirming = ref(false);
const isExecuting = ref(false);

const sourcePlayer = computed(() =>
  playersStore.players.find((p) => p.id === sourcePlayerId)
);
const targetPlayer = computed(() =>
  playersStore.players.find((p) => p.id === targetPlayerId.value)
);

async function executeMerge() {
  if (!targetPlayerId.value) return;
  isExecuting.value = true;
  try {
    const fn = httpsCallable(functions, 'executeMerge');
    await fn({ sourcePlayerId, targetPlayerId: targetPlayerId.value });
    notificationStore.showToast('Players merged successfully', 'success');
    router.push('/players');
  } catch (err) {
    notificationStore.showToast('Merge failed: ' + (err as Error).message, 'error');
  } finally {
    isExecuting.value = false;
    isConfirming.value = false;
  }
}
</script>

<template>
  <v-container>
    <h1 class="text-h5 mb-4">Merge Players</h1>

    <v-alert type="warning" class="mb-4">
      This permanently tombstones the source player. All their registrations
      will be repointed to the target player. This cannot be undone.
    </v-alert>

    <v-row>
      <v-col cols="6">
        <v-card variant="outlined">
          <v-card-title>Source (will be removed)</v-card-title>
          <v-card-text v-if="sourcePlayer">
            {{ sourcePlayer.firstName }} {{ sourcePlayer.lastName }}<br />
            {{ sourcePlayer.email ?? 'No email' }}
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6">
        <v-card variant="outlined">
          <v-card-title>Target (survives)</v-card-title>
          <v-card-text>
            <v-autocomplete
              v-model="targetPlayerId"
              :items="playersStore.players.filter(p => p.id !== sourcePlayerId && p.isActive)"
              item-title="firstName"
              item-value="id"
              label="Select target player"
            />
            <div v-if="targetPlayer">
              {{ targetPlayer.firstName }} {{ targetPlayer.lastName }}<br />
              {{ targetPlayer.email ?? 'No email' }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <div class="mt-4 d-flex gap-2">
      <v-btn
        color="error"
        :disabled="!targetPlayerId"
        :loading="isExecuting"
        @click="isConfirming = true"
      >
        Merge Players
      </v-btn>
      <v-btn variant="text" @click="router.back()">Cancel</v-btn>
    </div>

    <!-- Confirmation dialog -->
    <v-dialog v-model="isConfirming" max-width="400">
      <v-card>
        <v-card-title>Confirm Merge</v-card-title>
        <v-card-text>
          Are you sure you want to merge
          <strong>{{ sourcePlayer?.firstName }} {{ sourcePlayer?.lastName }}</strong>
          into
          <strong>{{ targetPlayer?.firstName }} {{ targetPlayer?.lastName }}</strong>?
          This cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="isConfirming = false">Cancel</v-btn>
          <v-btn color="error" :loading="isExecuting" @click="executeMerge">Confirm Merge</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
```

- [ ] **Step 2: Add route**

In `src/router/index.ts`, under the players section, add:
```typescript
{
  path: '/players/:id/merge',
  name: 'PlayerMerge',
  component: () => import('@/features/players/views/PlayerMergeView.vue'),
  meta: { requiresAuth: true, requiresAdmin: true },
},
```

- [ ] **Step 3: Run build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/features/players/views/PlayerMergeView.vue src/router/index.ts
git commit -m "feat: add PlayerMergeView and route for admin direct merge"
```

---

### C-5: Sub-project C verification gate

- [ ] Run all new tests

```bash
npm run test -- --run tests/unit/mergeRequest.types.test.ts tests/unit/mergeRequests.store.test.ts
cd functions && npm run test -- --run src/playerMerge.test.ts
```

- [ ] Run all gates

```bash
npm run check:firebase-env
npm run build
npm run build:log
cd functions && npm run build
```

- [ ] Manual smoke with flag ON + emulators

```bash
# Start emulators: npm run emulators
# Toggle PLAYER_IDENTITY_V2 = true
# Run dev server: npm run dev
# Log in as admin
# Go to /players/:id/merge
# Select target player
# Confirm merge
# Verify source player shows identityStatus: 'merged' in Firestore emulator
# Verify registrations repointed to target player
```

---

## Final: Enable the flag and end-to-end verification

When ready to enable for real:

- [ ] **Step 1: Flip the flag**

In `src/config/featureFlags.ts`:
```typescript
export const PLAYER_IDENTITY_V2 = true;
```

- [ ] **Step 2: Run full test suite**

```bash
npm run test -- --run
```

- [ ] **Step 3: Run Playwright e2e (emulators)**

```bash
npm run emulators &
npx playwright test --project=chromium
```

- [ ] **Step 4: Run all build gates**

```bash
npm run check:firebase-env
npm run build
npm run build:log
npm run lint:log
```

- [ ] **Step 5: Commit flag flip**

```bash
git add src/config/featureFlags.ts
git commit -m "feat: enable PLAYER_IDENTITY_V2 flag"
```

---

## Save plan to docs/plans

When starting this work, copy this plan to the project:

```bash
cp /Users/ramc/.claude/plans/squishy-meandering-anchor.md \
   docs/plans/2026-04-02-player-identity-v2.md
git add docs/plans/2026-04-02-player-identity-v2.md
git commit -m "docs: add player-identity-v2 implementation plan"
```
