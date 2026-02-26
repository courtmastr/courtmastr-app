# Self Check-In Kiosk Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a venue iPad self-check-in flow (search-first, name-based, partner-aware) that marks registrations checked in only when all required participants are present.

**Architecture:** Keep `registrations.status` as the operational source-of-truth and add participant-level presence tracking on registrations. Expose public-safe self-check-in through Cloud Functions callables (`search` + `submit`) so kiosk users can act without direct write access. Implement a dedicated Vue view/composable for search, disambiguation, and check-in actions.

**Tech Stack:** Vue 3 + TypeScript + Vuetify 3, Pinia, Firebase Firestore, Firebase Cloud Functions, Vitest.

---

## Required Skills During Execution

- `@superpowers:executing-plans` (required for this plan execution flow)
- `@superpowers:test-driven-development` (before each code change)
- `@superpowers:verification-before-completion` (before claiming done)
- `@superpowers:systematic-debugging` (if any test/build/log fails)

---

### Task 1: Add Self Check-In Domain Helpers (Pure Functions)

**Files:**
- Create: `src/features/checkin/composables/selfCheckInDomain.ts`
- Test: `tests/unit/selfCheckInDomain.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import {
  getRequiredParticipantIds,
  deriveRegistrationStatusFromPresence,
  normalizeSelfCheckInQuery,
} from '@/features/checkin/composables/selfCheckInDomain';

describe('selfCheckInDomain', () => {
  it('returns both player and partner ids for doubles registration', () => {
    expect(getRequiredParticipantIds({ playerId: 'p1', partnerPlayerId: 'p2' } as any)).toEqual(['p1', 'p2']);
  });

  it('keeps status approved when partner is still missing', () => {
    expect(
      deriveRegistrationStatusFromPresence({ playerId: 'p1', partnerPlayerId: 'p2', status: 'approved' } as any, { p1: true })
    ).toBe('approved');
  });

  it('switches to checked_in when all required participants are present', () => {
    expect(
      deriveRegistrationStatusFromPresence({ playerId: 'p1', partnerPlayerId: 'p2', status: 'approved' } as any, { p1: true, p2: true })
    ).toBe('checked_in');
  });

  it('normalizes search query safely', () => {
    expect(normalizeSelfCheckInQuery('  AAnya  ')).toBe('aanya');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/selfCheckInDomain.test.ts`  
Expected: FAIL (`Cannot find module '@/features/checkin/composables/selfCheckInDomain'`).

**Step 3: Write minimal implementation**

```ts
import type { Registration, RegistrationStatus } from '@/types';

export const normalizeSelfCheckInQuery = (value: string): string => value.trim().toLowerCase();

export const getRequiredParticipantIds = (registration: Pick<Registration, 'playerId' | 'partnerPlayerId'>): string[] => {
  const ids = [registration.playerId, registration.partnerPlayerId].filter((id): id is string => Boolean(id));
  return Array.from(new Set(ids));
};

export const deriveRegistrationStatusFromPresence = (
  registration: Pick<Registration, 'playerId' | 'partnerPlayerId' | 'status'>,
  participantPresence: Record<string, boolean>
): RegistrationStatus => {
  const required = getRequiredParticipantIds(registration);
  if (required.length === 0) return registration.status;
  const allPresent = required.every((id) => participantPresence[id] === true);
  return allPresent ? 'checked_in' : 'approved';
};
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/selfCheckInDomain.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/selfCheckInDomain.test.ts src/features/checkin/composables/selfCheckInDomain.ts
git commit -m "test(checkin): add self-checkin domain helper coverage"
```

---

### Task 2: Extend Registration Types for Participant Presence

**Files:**
- Modify: `src/types/index.ts`
- Test: `tests/unit/selfCheckInDomain.test.ts`

**Step 1: Write the failing test**

Add assertions in `selfCheckInDomain.test.ts` that use typed registration fixtures with:

```ts
const registration: Registration = {
  // ...required fields
  participantPresence: { p1: true },
  checkInSource: 'kiosk',
};
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/selfCheckInDomain.test.ts`  
Expected: FAIL (`Property 'participantPresence' does not exist on type 'Registration'`).

**Step 3: Write minimal implementation**

Update `Registration` in `src/types/index.ts`:

```ts
participantPresence?: Record<string, boolean>;
checkInSource?: 'admin' | 'kiosk';
checkedInAt?: Date;
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/selfCheckInDomain.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/index.ts tests/unit/selfCheckInDomain.test.ts
git commit -m "feat(types): add participant-level check-in presence fields"
```

---

### Task 3: Add Cloud Function for Search-Only Candidate Lookup

**Files:**
- Create: `functions/src/selfCheckIn.ts`
- Modify: `functions/src/index.ts`
- Modify: `functions/src/types.ts` (if shared function request/response types are needed)

**Step 1: Write the failing test (compile contract check)**

Add frontend call-site type import stub (next task) that expects callable name:

```ts
const searchFn = httpsCallable(functions, 'searchSelfCheckInCandidates');
```

**Step 2: Run build to verify it fails (function missing export)**

Run: `cd functions && npm run build`  
Expected: FAIL after adding temporary import/export references if function is missing.

**Step 3: Write minimal implementation**

`functions/src/selfCheckIn.ts`:

```ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const searchSelfCheckInCandidates = functions.https.onCall(async (request) => {
  const tournamentId = String(request.data?.tournamentId || '');
  const query = String(request.data?.query || '').trim().toLowerCase();

  if (!tournamentId || query.length < 2) {
    throw new functions.https.HttpsError('invalid-argument', 'tournamentId and query(>=2) are required');
  }

  const regsSnap = await db.collection(`tournaments/${tournamentId}/registrations`).where('status', 'in', ['approved', 'checked_in']).get();
  const playersSnap = await db.collection(`tournaments/${tournamentId}/players`).get();
  const categoriesSnap = await db.collection(`tournaments/${tournamentId}/categories`).get();

  const players = new Map(playersSnap.docs.map((d) => [d.id, d.data()]));
  const categories = new Map(categoriesSnap.docs.map((d) => [d.id, d.data()]));

  const candidates = regsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .map((reg: any) => {
      const p1 = reg.playerId ? players.get(reg.playerId) : null;
      const p2 = reg.partnerPlayerId ? players.get(reg.partnerPlayerId) : null;
      const displayName = reg.teamName || [p1?.firstName, p1?.lastName].filter(Boolean).join(' ');
      const partnerName = p2 ? [p2.firstName, p2.lastName].filter(Boolean).join(' ') : '';
      const categoryName = categories.get(reg.categoryId)?.name || 'Unknown';
      return {
        registrationId: reg.id,
        categoryId: reg.categoryId,
        categoryName,
        displayName,
        partnerName,
        playerId: reg.playerId || null,
        partnerPlayerId: reg.partnerPlayerId || null,
        status: reg.status,
      };
    })
    .filter((item) => `${item.displayName} ${item.partnerName} ${item.categoryName}`.toLowerCase().includes(query))
    .slice(0, 20);

  return { candidates };
});
```

`functions/src/index.ts` export:

```ts
import { searchSelfCheckInCandidates, submitSelfCheckIn } from './selfCheckIn';
export { searchSelfCheckInCandidates, submitSelfCheckIn };
```

**Step 4: Run build to verify it passes**

Run: `cd functions && npm run build:log`  
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/src/selfCheckIn.ts functions/src/index.ts functions/src/types.ts
git commit -m "feat(functions): add self-checkin candidate search callable"
```

---

### Task 4: Add Cloud Function for Partner-Aware Check-In Submission

**Files:**
- Modify: `functions/src/selfCheckIn.ts`
- Modify: `functions/src/index.ts` (if export added here)

**Step 1: Write the failing test (compile contract check)**

Add frontend call-site type stub (next task) expecting:

```ts
const submitFn = httpsCallable(functions, 'submitSelfCheckIn');
```

**Step 2: Run build to verify it fails (if callable absent)**

Run: `cd functions && npm run build`  
Expected: FAIL if `submitSelfCheckIn` is not implemented/exported.

**Step 3: Write minimal implementation**

Add callable in `functions/src/selfCheckIn.ts`:

```ts
export const submitSelfCheckIn = functions.https.onCall(async (request) => {
  const tournamentId = String(request.data?.tournamentId || '');
  const registrationId = String(request.data?.registrationId || '');
  const participantIds = Array.isArray(request.data?.participantIds)
    ? request.data.participantIds.map((v: unknown) => String(v))
    : [];

  if (!tournamentId || !registrationId || participantIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid self check-in request');
  }

  const regRef = db.doc(`tournaments/${tournamentId}/registrations/${registrationId}`);

  const result = await db.runTransaction(async (tx) => {
    const regSnap = await tx.get(regRef);
    if (!regSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Registration not found');
    }

    const reg = regSnap.data() as any;
    if (!['approved', 'checked_in'].includes(reg.status)) {
      throw new functions.https.HttpsError('failed-precondition', 'Registration is not check-in eligible');
    }

    const required = [reg.playerId, reg.partnerPlayerId].filter(Boolean);
    const requiredSet = new Set(required);
    const invalid = participantIds.filter((id) => !requiredSet.has(id));
    if (invalid.length > 0) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot check in unrelated participants');
    }

    const existingPresence = (reg.participantPresence || {}) as Record<string, boolean>;
    const nextPresence = { ...existingPresence };
    for (const id of participantIds) nextPresence[id] = true;

    const allPresent = required.every((id: string) => nextPresence[id] === true);
    const nextStatus = allPresent ? 'checked_in' : 'approved';

    tx.update(regRef, {
      participantPresence: nextPresence,
      status: nextStatus,
      isCheckedIn: allPresent,
      checkInSource: 'kiosk',
      checkedInAt: allPresent ? admin.firestore.FieldValue.serverTimestamp() : reg.checkedInAt ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      status: nextStatus,
      waitingForPartner: !allPresent && required.length > 1,
      participantPresence: nextPresence,
    };
  });

  return result;
});
```

**Step 4: Run build to verify it passes**

Run: `cd functions && npm run build:log`  
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/src/selfCheckIn.ts functions/src/index.ts
git commit -m "feat(functions): add partner-aware self-checkin submit callable"
```

---

### Task 5: Build Frontend Self Check-In Composable

**Files:**
- Create: `src/features/checkin/composables/useSelfCheckIn.ts`
- Test: `tests/unit/useSelfCheckIn.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { useSelfCheckIn } from '@/features/checkin/composables/useSelfCheckIn';

describe('useSelfCheckIn', () => {
  it('loads candidates from search callable', async () => {
    const vm = useSelfCheckIn('t-1');
    await vm.search('aa');
    expect(vm.candidates.value.length).toBeGreaterThan(0);
  });

  it('submits Check In Me action with one participant id', async () => {
    const vm = useSelfCheckIn('t-1');
    await vm.submit({ registrationId: 'r1', participantIds: ['p1'] });
    expect(vm.lastResult.value?.status).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/useSelfCheckIn.test.ts`  
Expected: FAIL (composable missing).

**Step 3: Write minimal implementation**

```ts
import { ref } from 'vue';
import { functions, httpsCallable } from '@/services/firebase';

interface SearchCandidate {
  registrationId: string;
  displayName: string;
  partnerName: string;
  categoryName: string;
  playerId: string | null;
  partnerPlayerId: string | null;
  status: string;
}

export const useSelfCheckIn = (tournamentId: string) => {
  const candidates = ref<SearchCandidate[]>([]);
  const loading = ref(false);
  const lastResult = ref<{ status: string; waitingForPartner: boolean } | null>(null);

  const searchFn = httpsCallable(functions, 'searchSelfCheckInCandidates');
  const submitFn = httpsCallable(functions, 'submitSelfCheckIn');

  const search = async (query: string): Promise<void> => {
    if (query.trim().length < 2) {
      candidates.value = [];
      return;
    }
    loading.value = true;
    try {
      const response = await searchFn({ tournamentId, query });
      const payload = response.data as { candidates?: SearchCandidate[] };
      candidates.value = payload.candidates ?? [];
    } finally {
      loading.value = false;
    }
  };

  const submit = async (input: { registrationId: string; participantIds: string[] }): Promise<void> => {
    const response = await submitFn({ tournamentId, ...input });
    lastResult.value = response.data as { status: string; waitingForPartner: boolean };
  };

  return { candidates, loading, lastResult, search, submit };
};
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/useSelfCheckIn.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/checkin/composables/useSelfCheckIn.ts tests/unit/useSelfCheckIn.test.ts
git commit -m "feat(checkin): add self-checkin composable using callables"
```

---

### Task 6: Add Self Check-In Kiosk View + Public Route

**Files:**
- Create: `src/features/checkin/views/SelfCheckInView.vue`
- Modify: `src/router/index.ts`
- Test: `tests/unit/selfCheckInRoute.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import router from '@/router';

describe('self check-in route', () => {
  it('registers public self-checkin route', () => {
    const route = router.getRoutes().find((r) => r.name === 'self-check-in');
    expect(route?.path).toBe('/tournaments/:tournamentId/self-checkin');
    expect(route?.meta.requiresAuth).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/selfCheckInRoute.test.ts`  
Expected: FAIL (route missing).

**Step 3: Write minimal implementation**

`src/router/index.ts`:

```ts
{
  path: '/tournaments/:tournamentId/self-checkin',
  name: 'self-check-in',
  component: () => import('@/features/checkin/views/SelfCheckInView.vue'),
  meta: { requiresAuth: false },
},
```

`src/features/checkin/views/SelfCheckInView.vue` (core template skeleton):

```vue
<template>
  <v-container class="py-6" style="max-width: 860px">
    <v-card rounded="lg">
      <v-card-title class="text-h5">Self Check-In</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="query"
          label="Type player name"
          prepend-inner-icon="mdi-magnify"
          autofocus
          clearable
          @update:model-value="onSearch"
        />

        <v-list v-if="candidates.length > 0" lines="two">
          <v-list-item
            v-for="candidate in candidates"
            :key="candidate.registrationId"
            @click="selected = candidate"
          >
            <v-list-item-title>{{ candidate.displayName }}</v-list-item-title>
            <v-list-item-subtitle>{{ candidate.categoryName }} • {{ candidate.partnerName || 'No partner' }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <v-card v-if="selected" variant="outlined" class="mt-4">
          <v-card-text class="d-flex flex-column ga-3">
            <v-btn color="success" @click="checkInMe">Check In Me</v-btn>
            <v-btn v-if="selected.partnerPlayerId" color="primary" @click="checkInMeAndPartner">Check In Me + Partner</v-btn>
          </v-card-text>
        </v-card>
      </v-card-text>
    </v-card>
  </v-container>
</template>
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/selfCheckInRoute.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/router/index.ts src/features/checkin/views/SelfCheckInView.vue tests/unit/selfCheckInRoute.test.ts
git commit -m "feat(checkin): add public self-checkin kiosk route and view"
```

---

### Task 7: Wire View Actions, Success States, and Kiosk Reset

**Files:**
- Modify: `src/features/checkin/views/SelfCheckInView.vue`
- Modify: `src/features/checkin/composables/useSelfCheckIn.ts`
- Test: `tests/unit/useSelfCheckIn.test.ts`

**Step 1: Write the failing test**

Add tests for:
- `Check In Me` sends one participant id.
- `Check In Me + Partner` sends two participant ids.
- success state auto-resets to search after timeout.

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/useSelfCheckIn.test.ts`  
Expected: FAIL (action wiring/reset missing).

**Step 3: Write minimal implementation**

```ts
const resetAfterSuccess = (): void => {
  window.setTimeout(() => {
    query.value = '';
    selected.value = null;
    candidates.value = [];
  }, 1200);
};

const checkInMe = async (): Promise<void> => {
  if (!selected.value?.playerId) return;
  await submit({ registrationId: selected.value.registrationId, participantIds: [selected.value.playerId] });
  resetAfterSuccess();
};

const checkInMeAndPartner = async (): Promise<void> => {
  if (!selected.value?.playerId || !selected.value.partnerPlayerId) return;
  await submit({
    registrationId: selected.value.registrationId,
    participantIds: [selected.value.playerId, selected.value.partnerPlayerId],
  });
  resetAfterSuccess();
};
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/useSelfCheckIn.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/checkin/views/SelfCheckInView.vue src/features/checkin/composables/useSelfCheckIn.ts tests/unit/useSelfCheckIn.test.ts
git commit -m "feat(checkin): add kiosk action flow for self and partner check-in"
```

---

### Task 8: Verification, Docs, and Final Quality Gates

**Files:**
- Modify: `docs/features/PLAYER_CHECK_IN.md`
- Modify: `docs/coding-patterns/CODING_PATTERNS.md` (if bug-fix pattern updates are needed during implementation)
- Modify: `docs/debug-kb/<fingerprint>.md` only if a `:log` command fails

**Step 1: Update feature doc to reflect delivered kiosk scope**

Add MVP coverage section (implemented now vs later).

**Step 2: Run targeted tests**

Run:

```bash
npm run test:log -- --run tests/unit/selfCheckInDomain.test.ts tests/unit/useSelfCheckIn.test.ts tests/unit/selfCheckInRoute.test.ts
```

Expected: PASS.

**Step 3: Run builds**

Run:

```bash
npm run build:log
cd functions && npm run build:log
```

Expected: PASS for both app and functions.

**Step 4: Run lint with Debug KB protocol**

Run:

```bash
npm run lint:log
```

Expected: either PASS, or known fingerprint path handled per `docs/debug-kb/` protocol with scoped lint for touched files.

**Step 5: Commit docs + verification updates**

```bash
git add docs/features/PLAYER_CHECK_IN.md docs/coding-patterns/CODING_PATTERNS.md docs/debug-kb/*.md
git commit -m "docs(checkin): align player check-in spec with kiosk self-checkin implementation"
```

---

## Implementation Notes

- Apply CP-011: use `useParticipantResolver` in UI where participant names are displayed from registration IDs.
- Preserve CP-039 behavior: assignment gate remains status-driven; self-check-in must only transition to `checked_in` when participant presence is complete.
- Use `serverTimestamp()` for all persisted check-in timestamps (CP-006).
- Surface user feedback via `notificationStore.showToast` in admin/authenticated flows (CP-005).
- Keep changes minimal and avoid unrelated refactors.

## Recommended Execution Order

1. Task 1 -> 2 (shared domain model first)
2. Task 3 -> 4 (backend callables)
3. Task 5 -> 7 (UI integration)
4. Task 8 (final verification + docs)
