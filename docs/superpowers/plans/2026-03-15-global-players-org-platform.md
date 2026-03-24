# Global Players + Org Platform Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce global player identity, an organization layer, org admin pages, a public org landing page, and a player stats page — all additive with zero changes to existing tournament-day flows.

**Architecture:** New `/players` and `/organizations` Firestore collections sit alongside existing tournament subcollections. The `addPlayer` bridge in `registrations.ts` uses `runTransaction` to find-or-create a global player before writing the existing tournament mirror. New views are isolated in `src/features/players/` and `src/features/org/` following the existing feature module pattern.

**Tech Stack:** Vue 3 + TypeScript + Vuetify 3 + Pinia (Setup Store) + Firebase (Firestore, Cloud Functions v2) + Playwright e2e

**Spec:** `docs/plans/2026-03-15-global-players-org-platform-design.md`

**Branch:** `feat/global-players-org-platform` (create from master before starting)

**UI Direction:** Sports Scoreboard — dark `#0F172A` page headers with `#1E293B` embedded stats panel, Amber `#F59E0B` stat values, left-accent border tournament cards.

---

## Chunk 1: Foundation — Branch + Types + Firestore

### Task 1.1: Create feature branch

- [ ] **Create and switch to branch**

```bash
git checkout master && git pull
git checkout -b feat/global-players-org-platform
```

- [ ] **Enable hooks for this worktree (one-time)**

```bash
npm run hooks:enable
```

---

### Task 1.2: Add new TypeScript types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Widen `Tournament.sport` from literal to string**

In `src/types/index.ts`, the `Tournament` interface currently has `sport: 'badminton'`. Change it to accept any sport string and make it optional per the spec:

```typescript
// BEFORE (line ~85):
sport: 'badminton'; // Starting with badminton only

// AFTER:
sport?: string | null; // Multi-sport support
```

> **Risk check:** Before editing, run `grep -rn "\.sport === 'badminton'\|\.sport == 'badminton'\|sport: 'badminton'" src/ --include="*.ts" --include="*.vue"` and verify no code will break.

- [ ] **Add `activeOrgId` to the `User` interface**

In `src/types/index.ts`, find the `User` interface and add:

```typescript
export interface User {
  id: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  isActive?: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  activeOrgId?: string | null; // ADD THIS
}
```

- [ ] **Add new interfaces at the end of `src/types/index.ts`**

```typescript
// ============================================
// Global Player Identity
// ============================================

export interface PlayerStats {
  wins: number;
  losses: number;
  gamesPlayed: number;
  tournamentsPlayed: number;
}

export interface PlayerSportStats {
  [categoryType: string]: PlayerStats; // 'singles' | 'doubles' | 'mixed'
}

export interface GlobalPlayer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailNormalized: string;
  phone?: string | null;
  skillLevel?: number | null;
  userId?: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  stats: {
    [sport: string]: PlayerSportStats;
    overall: PlayerStats;
  };
}

// ============================================
// Organizations
// ============================================

export type OrgMemberRole = 'admin' | 'organizer';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  contactEmail?: string | null;
  timezone?: string | null;
  about?: string | null;
  website?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  uid: string;
  role: OrgMemberRole;
  joinedAt: Date;
}
```

- [ ] **Run type-check to verify no errors introduced**

```bash
npm run type-check
```

Expected: no errors (Tournament.sport change may surface warnings — fix any found).

- [ ] **Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add GlobalPlayer, Organization, OrganizationMember types; widen Tournament.sport"
```

---

### Task 1.3: Add `getCountFromServer` and `collectionGroup` to firebase service

**Files:**
- Modify: `src/services/firebase.ts`

- [ ] **Add missing Firestore exports**

In `src/services/firebase.ts`, add `getCountFromServer` and `collectionGroup` to the existing Firestore re-export block:

```typescript
export {
  // Firestore
  collection,
  collectionGroup,    // ADD
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  getCountFromServer, // ADD
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  increment,
  arrayUnion,
  arrayRemove,
  type DocumentReference,
  type DocumentSnapshot,
  type QuerySnapshot,
  type QueryDocumentSnapshot,
  type Transaction,
} from 'firebase/firestore';
```

- [ ] **Run type-check**

```bash
npm run type-check
```

- [ ] **Commit**

```bash
git add src/services/firebase.ts
git commit -m "feat: export getCountFromServer and collectionGroup from firebase service"
```

---

### Task 1.4: Update Firestore security rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Add new helper functions and collection rules**

Append the following inside the `match /databases/{database}/documents {` block in `firestore.rules`, just before the closing `}` of that block (before the final `}`):

```
    // ---- Global Player Identity ----

    function isOrgMember(orgId) {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid));
    }

    function isOrgAdmin(orgId) {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.role == 'admin';
    }

    match /organizations/{orgId} {
      allow read: if true;
      allow create: if isAdmin();
      allow update: if isAdmin() || isOrgMember(orgId);
      allow delete: if isAdmin();

      match /members/{uid} {
        allow read: if isAuthenticated();
        allow write: if isAdmin() || isOrgAdmin(orgId);
      }
    }

    match /players/{playerId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAdmin()
        || (isOwner(resource.data.userId)
            && !request.resource.data.diff(resource.data).affectedKeys()
                 .hasAny(['isVerified', 'stats']));
      allow delete: if isAdmin();
    }

    match /playerEmailIndex/{emailNormalized} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    match /orgSlugIndex/{slug} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
```

- [ ] **Validate rules syntax (no deploy yet — just syntax check)**

```bash
firebase firestore:rules --help
# Or just check file opens without parse error in editor
# Full validation happens in Task 1.5 deploy step
```

- [ ] **Commit**

```bash
git add firestore.rules
git commit -m "feat: add organization, global player, and slug index Firestore security rules"
```

---

### Task 1.5: Update Firestore indexes

**Files:**
- Modify: `firestore.indexes.json`

- [ ] **Add new indexes to the `indexes` array**

Open `firestore.indexes.json` and add these 4 entries to the existing `"indexes"` array:

```json
    {
      "collectionGroup": "players",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "emailNormalized", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "players",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "lastName", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "registrations",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "playerId", "order": "ASCENDING" },
        { "fieldPath": "registeredAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "tournaments",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "orgId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "activities",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
```

> Note: The `players lastName/firstName` index already exists in `firestore.indexes.json` (line 38-44). Do NOT add a duplicate. The above 5 are new additions only.

- [ ] **Commit**

```bash
git add firestore.indexes.json
git commit -m "feat: add Firestore indexes for players, registrations collection group, and tournaments by orgId"
```

---

## Chunk 2: Global Player Store + Org Store

### Task 2.1: Create `src/stores/players.ts`

**Files:**
- Create: `src/stores/players.ts`

- [ ] **Write the store**

```typescript
// Global Player Store — find-or-create by email, cross-tournament player identity
import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  runTransaction,
  orderBy,
  query,
  onSnapshot,
  serverTimestamp,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';
import type { GlobalPlayer } from '@/types';

export const usePlayersStore = defineStore('players', () => {
  const players = ref<GlobalPlayer[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let unsubscribeFn: (() => void) | null = null;

  /**
   * Find an existing global player by email, or create a new one.
   * Uses runTransaction for atomic check-then-write (batch cannot read).
   * Returns the globalPlayerId.
   */
  const findOrCreateByEmail = async (
    email: string,
    data: Pick<GlobalPlayer, 'firstName' | 'lastName' | 'phone' | 'skillLevel'>
  ): Promise<string> => {
    const emailNormalized = email.toLowerCase().trim();
    const indexRef = doc(db, 'playerEmailIndex', emailNormalized);

    return runTransaction(db, async (transaction) => {
      const indexSnap = await transaction.get(indexRef);

      if (indexSnap.exists()) {
        // Global player already exists — return their ID
        return indexSnap.data().playerId as string;
      }

      // Create new global player
      const newPlayerRef = doc(collection(db, 'players'));
      const now = serverTimestamp();

      transaction.set(newPlayerRef, {
        id: newPlayerRef.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        emailNormalized,
        phone: data.phone ?? null,
        skillLevel: data.skillLevel ?? null,
        userId: null,
        isActive: true,
        isVerified: false,
        createdAt: now,
        updatedAt: now,
        stats: {
          overall: { wins: 0, losses: 0, gamesPlayed: 0, tournamentsPlayed: 0 },
        },
      });

      transaction.set(indexRef, {
        playerId: newPlayerRef.id,
        createdAt: now,
      });

      return newPlayerRef.id;
    });
  };

  const fetchPlayers = async (): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
      const q = query(collection(db, 'players'), orderBy('lastName'), orderBy('firstName'));
      const snap = await getDocs(q);
      players.value = snap.docs.map((d) =>
        convertTimestamps({ id: d.id, ...d.data() }) as GlobalPlayer
      );
    } catch (err) {
      error.value = 'Failed to fetch players';
      console.error('Error fetching players:', err);
    } finally {
      loading.value = false;
    }
  };

  const subscribePlayers = (): void => {
    if (unsubscribeFn) return;
    const q = query(collection(db, 'players'), orderBy('lastName'), orderBy('firstName'));
    unsubscribeFn = onSnapshot(q, (snap) => {
      players.value = snap.docs.map((d) =>
        convertTimestamps({ id: d.id, ...d.data() }) as GlobalPlayer
      );
    });
  };

  const getPlayerById = (id: string): GlobalPlayer | undefined =>
    players.value.find((p) => p.id === id);

  const updatePlayer = async (id: string, updates: Partial<GlobalPlayer>): Promise<void> => {
    try {
      await updateDoc(doc(db, 'players', id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error updating player:', err);
      throw err;
    }
  };

  const fetchPlayerById = async (id: string): Promise<GlobalPlayer | null> => {
    try {
      const snap = await getDoc(doc(db, 'players', id));
      if (!snap.exists()) return null;
      return convertTimestamps({ id: snap.id, ...snap.data() }) as GlobalPlayer;
    } catch (err) {
      console.error('Error fetching player:', err);
      throw err;
    }
  };

  const unsubscribe = (): void => {
    unsubscribeFn?.();
    unsubscribeFn = null;
  };

  return {
    players,
    loading,
    error,
    findOrCreateByEmail,
    fetchPlayers,
    subscribePlayers,
    getPlayerById,
    updatePlayer,
    fetchPlayerById,
    unsubscribe,
  };
});
```

- [ ] **Run type-check**

```bash
npm run type-check
```

- [ ] **Commit**

```bash
git add src/stores/players.ts
git commit -m "feat: add global players store with findOrCreateByEmail transaction"
```

---

### Task 2.2: Create `src/stores/organizations.ts`

**Files:**
- Create: `src/stores/organizations.ts`

- [ ] **Write the store**

```typescript
// Organizations Store — org CRUD, slug uniqueness, org context switching
import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  db,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  query,
  where,
  orderBy,
  serverTimestamp,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';
import type { Organization, OrganizationMember, Tournament } from '@/types';
import { useAuthStore } from '@/stores/auth';

export const useOrganizationsStore = defineStore('organizations', () => {
  const myOrgs = ref<Organization[]>([]);
  const currentOrg = ref<Organization | null>(null);
  const orgTournaments = ref<Tournament[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchMyOrgs = async (): Promise<void> => {
    const authStore = useAuthStore();
    if (!authStore.currentUser) return;
    loading.value = true;
    try {
      // Fetch all org docs where current user is a member
      // (uses collectionGroup query on members subcollection — collectionGroup imported statically from firebase.ts)
      const membersQ = query(
        collectionGroup(db, 'members'),
        where('uid', '==', authStore.currentUser.id)
      );
      const membersSnap = await getDocs(membersQ);

      const orgIds = membersSnap.docs.map((d) => d.ref.parent.parent!.id);
      if (orgIds.length === 0) {
        myOrgs.value = [];
        return;
      }

      const orgDocs = await Promise.all(
        orgIds.map((id) => getDoc(doc(db, 'organizations', id)))
      );
      myOrgs.value = orgDocs
        .filter((d) => d.exists())
        .map((d) => convertTimestamps({ id: d.id, ...d.data() }) as Organization);
    } catch (err) {
      console.error('Error fetching orgs:', err);
      error.value = 'Failed to fetch organizations';
    } finally {
      loading.value = false;
    }
  };

  const fetchOrgById = async (orgId: string): Promise<Organization | null> => {
    try {
      const snap = await getDoc(doc(db, 'organizations', orgId));
      if (!snap.exists()) return null;
      const org = convertTimestamps({ id: snap.id, ...snap.data() }) as Organization;
      currentOrg.value = org;
      return org;
    } catch (err) {
      console.error('Error fetching org:', err);
      throw err;
    }
  };

  const fetchOrgBySlug = async (slug: string): Promise<Organization | null> => {
    try {
      const indexSnap = await getDoc(doc(db, 'orgSlugIndex', slug));
      if (!indexSnap.exists()) return null;
      const { orgId } = indexSnap.data() as { orgId: string };
      return fetchOrgById(orgId);
    } catch (err) {
      console.error('Error fetching org by slug:', err);
      throw err;
    }
  };

  const createOrg = async (data: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const authStore = useAuthStore();
    if (!authStore.currentUser) throw new Error('Must be authenticated to create an organization');
    const slugRef = doc(db, 'orgSlugIndex', data.slug);
    return runTransaction(db, async (transaction) => {
      const slugSnap = await transaction.get(slugRef);
      if (slugSnap.exists()) {
        throw new Error(`Slug "${data.slug}" is already taken`);
      }

      const newOrgRef = doc(collection(db, 'organizations'));
      const now = serverTimestamp();

      transaction.set(newOrgRef, {
        ...data,
        id: newOrgRef.id,
        createdAt: now,
        updatedAt: now,
      });

      transaction.set(slugRef, {
        orgId: newOrgRef.id,
        createdAt: now,
      });

      // Add creator as admin member — required for fetchMyOrgs to find this org
      const memberRef = doc(db, `organizations/${newOrgRef.id}/members`, authStore.currentUser.id);
      transaction.set(memberRef, {
        uid: authStore.currentUser.id,
        role: 'admin',
        joinedAt: now,
      });

      return newOrgRef.id;
    });
  };

  const updateOrg = async (orgId: string, updates: Partial<Organization>): Promise<void> => {
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      if (currentOrg.value?.id === orgId) {
        currentOrg.value = { ...currentOrg.value, ...updates } as Organization;
      }
    } catch (err) {
      console.error('Error updating org:', err);
      throw err;
    }
  };

  const setActiveOrg = async (orgId: string | null): Promise<void> => {
    const authStore = useAuthStore();
    if (!authStore.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', authStore.currentUser.id), {
        activeOrgId: orgId,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error setting active org:', err);
      throw err;
    }
  };

  const fetchOrgTournaments = async (orgId: string): Promise<void> => {
    try {
      const q = query(
        collection(db, 'tournaments'),
        where('orgId', '==', orgId),
        orderBy('startDate', 'desc')
      );
      const snap = await getDocs(q);
      orgTournaments.value = snap.docs.map((d) =>
        convertTimestamps({ id: d.id, ...d.data() }) as Tournament
      );
    } catch (err) {
      console.error('Error fetching org tournaments:', err);
      throw err;
    }
  };

  const fetchOrgMembers = async (orgId: string): Promise<OrganizationMember[]> => {
    try {
      const snap = await getDocs(collection(db, `organizations/${orgId}/members`));
      return snap.docs.map((d) =>
        convertTimestamps({ ...d.data() }) as OrganizationMember
      );
    } catch (err) {
      console.error('Error fetching org members:', err);
      throw err;
    }
  };

  return {
    myOrgs,
    currentOrg,
    orgTournaments,
    loading,
    error,
    fetchMyOrgs,
    fetchOrgById,
    fetchOrgBySlug,
    createOrg,
    updateOrg,
    setActiveOrg,
    fetchOrgTournaments,
    fetchOrgMembers,
  };
});
```

- [ ] **Run type-check**

```bash
npm run type-check
```

- [ ] **Commit**

```bash
git add src/stores/organizations.ts
git commit -m "feat: add organizations store with slug-unique createOrg transaction"
```

---

## Chunk 3: Bridge — `addPlayer` in Registrations Store

### Task 3.1: Update `addPlayer` in `src/stores/registrations.ts`

**Files:**
- Modify: `src/stores/registrations.ts:1-30` (imports), `src/stores/registrations.ts:203-245` (addPlayer function)

The current `addPlayer` uses `addDoc` with a random ID and does an in-memory email duplicate check. The new version:
1. Calls `findOrCreateByEmail` (from `usePlayersStore`) — gets/creates the global player ID
2. Writes the tournament mirror using `setDoc` with the global player ID as the document ID
3. Removes the old duplicate-check logic (now handled transactionally)

- [ ] **Add `usePlayersStore` import at top of `registrations.ts`**

Find the imports section (around line 22-26) and add:

```typescript
import { usePlayersStore } from '@/stores/players';
```

- [ ] **Replace the `addPlayer` function body**

Find the existing `addPlayer` function (line ~203) and replace its entire body:

```typescript
  // Add a player — creates global player record then writes tournament mirror
  async function addPlayer(
    tournamentId: string,
    playerData: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const playersStore = usePlayersStore();
      const email = playerData.email?.trim() || '';
      if (!email) throw new Error('Player email is required');

      // Step 1: Find or create global player (atomic via runTransaction)
      const globalPlayerId = await playersStore.findOrCreateByEmail(email, {
        firstName: playerData.firstName,
        lastName: playerData.lastName,
        phone: playerData.phone ?? undefined,
        skillLevel: playerData.skillLevel ?? undefined,
      });

      // Step 2: Write tournament mirror using setDoc — ID must match global player ID
      await setDoc(
        doc(db, `tournaments/${tournamentId}/players`, globalPlayerId),
        {
          ...playerData,
          id: globalPlayerId,
          globalPlayerId,
          emailNormalized: email.toLowerCase().trim(),
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

- [ ] **Verify `setDoc` and `doc` are already imported**

Check that `setDoc` and `doc` are in the imports at the top of `registrations.ts`. They should already be imported from `@/services/firebase`. If not, add them.

- [ ] **Run type-check**

```bash
npm run type-check
```

- [ ] **Run registrations store tests**

```bash
npm run test -- tests/unit/registrations.store.test.ts --run
```

Expected: all pass (existing tests may not cover `addPlayer` directly; if failures occur, debug before continuing).

- [ ] **Build verification**

```bash
npm run build
```

Expected: successful build with no errors.

- [ ] **Commit**

```bash
git add src/stores/registrations.ts
git commit -m "feat: bridge addPlayer to findOrCreateByEmail global player identity"
```

---

## Chunk 4: Org Feature Module

### Task 4.1: Add navigation icon keys

**Files:**
- Modify: `src/constants/navigationIcons.ts`

- [ ] **Add 3 new icon keys**

```typescript
export const NAVIGATION_ICONS = {
  tournaments: 'mdi-format-list-bulleted',
  createTournament: 'mdi-plus-circle',
  reviewModeration: 'mdi-message-badge',
  dashboard: 'mdi-view-dashboard',
  // NEW:
  orgDashboard: 'mdi-view-dashboard-variant',
  players: 'mdi-account-group',
  organization: 'mdi-office-building',
  // ...rest unchanged
  matchControl: 'mdi-controller',
  // ... (keep all existing entries)
} as const;
```

- [ ] **Commit**

```bash
git add src/constants/navigationIcons.ts
git commit -m "feat: add orgDashboard, players, organization navigation icon keys"
```

---

### Task 4.2: Create `OrgProfileView.vue`

**Files:**
- Create: `src/features/org/views/OrgProfileView.vue`

- [ ] **Create the directory**

```bash
mkdir -p src/features/org/views
```

- [ ] **Write the view**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useOrganizationsStore } from '@/stores/organizations';
import { useAuthStore } from '@/stores/auth';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import { useNotificationStore } from '@/stores/notifications';
import type { Organization } from '@/types';

const orgStore = useOrganizationsStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const tab = ref('profile');
const org = ref<Organization | null>(null);
const members = ref<Array<{ uid: string; role: string; joinedAt: Date }>>([]);

// Form fields (profile tab) — slug is display-only, not editable; changing slug requires admin action
const form = ref({
  name: '',
  contactEmail: '',
  timezone: '',
  about: '',
  website: '',
});

const { execute: loadOrg, loading } = useAsyncOperation(async () => {
  const activeOrgId = authStore.currentUser?.activeOrgId;
  if (!activeOrgId) return;
  org.value = await orgStore.fetchOrgById(activeOrgId);
  if (org.value) {
    form.value = {
      name: org.value.name,
      contactEmail: org.value.contactEmail ?? '',
      timezone: org.value.timezone ?? '',
      about: org.value.about ?? '',
      website: org.value.website ?? '',
    };
    await orgStore.fetchOrgTournaments(activeOrgId);
    members.value = await orgStore.fetchOrgMembers(activeOrgId);
  }
});

const { execute: saveProfile, loading: saving } = useAsyncOperation(async () => {
  if (!org.value) return;
  await orgStore.updateOrg(org.value.id, {
    name: form.value.name,
    contactEmail: form.value.contactEmail || null,
    timezone: form.value.timezone || null,
    about: form.value.about || null,
    website: form.value.website || null,
  });
  notificationStore.showToast('Organization profile saved', 'success');
});

const statusColor = (status: string): string => {
  const map: Record<string, string> = {
    active: 'success',
    registration: 'primary',
    completed: 'default',
    draft: 'default',
  };
  return map[status] ?? 'default';
};

onMounted(loadOrg);
</script>

<template>
  <v-container v-if="loading" class="d-flex justify-center pa-8">
    <v-progress-circular indeterminate color="primary" />
  </v-container>

  <v-container v-else-if="!org" class="pa-8 text-center">
    <v-icon size="48" color="grey-lighten-1" class="mb-4">mdi-office-building-off-outline</v-icon>
    <p class="text-body-1 text-medium-emphasis">No organization linked to your account.</p>
  </v-container>

  <template v-else>
    <!-- Dark sports-scoreboard header -->
    <div style="background: #0F172A; padding: 24px 24px 0;">
      <div class="d-flex align-center ga-4 mb-4">
        <div
          style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#1D4ED8,#D97706);
                 display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:white;flex-shrink:0;"
        >
          {{ org.name.slice(0, 2).toUpperCase() }}
        </div>
        <div>
          <div style="font-size:20px;font-weight:800;color:white;">{{ org.name }}</div>
          <div style="font-size:12px;color:#64748b;">{{ org.slug ? `courtmaster.app/${org.slug}` : 'No slug set' }}</div>
        </div>
      </div>

      <v-tabs v-model="tab" color="white" bg-color="transparent">
        <v-tab value="profile">Profile</v-tab>
        <v-tab value="tournaments">Tournaments</v-tab>
        <v-tab value="members">Members</v-tab>
      </v-tabs>
    </div>

    <v-window v-model="tab" class="pa-4">
      <!-- Profile tab -->
      <v-window-item value="profile">
        <v-card class="mb-4">
          <v-card-title class="text-body-1 font-weight-bold pa-4 pb-2">Organization Profile</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.name" label="Organization Name" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  :model-value="org?.slug"
                  label="URL Slug"
                  :prefix="`courtmaster.app/`"
                  disabled
                  hint="Slug cannot be changed after creation"
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.contactEmail" label="Contact Email" type="email" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.website" label="Website URL" />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.timezone"
                  label="Timezone"
                  :items="['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu']"
                  clearable
                />
              </v-col>
              <v-col cols="12">
                <v-textarea v-model="form.about" label="About / Description" rows="3" />
              </v-col>
            </v-row>
          </v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-spacer />
            <v-btn color="primary" :loading="saving" @click="saveProfile">Save Profile</v-btn>
          </v-card-actions>
        </v-card>
      </v-window-item>

      <!-- Tournaments tab -->
      <v-window-item value="tournaments">
        <v-card v-if="orgStore.orgTournaments.length === 0" class="text-center pa-8">
          <p class="text-medium-emphasis">No tournaments linked to this organization yet.</p>
        </v-card>
        <div v-else>
          <div
            v-for="t in orgStore.orgTournaments"
            :key="t.id"
            style="background:white;border-left:3px solid #1D4ED8;border-radius:0 8px 8px 0;
                   padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;
                   justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.05);"
          >
            <div>
              <div style="font-size:14px;font-weight:600;color:#0F172A;">{{ t.name }}</div>
              <div style="font-size:12px;color:#64748b;">{{ t.sport ?? '—' }} · {{ t.status }}</div>
            </div>
            <div class="d-flex align-center ga-2">
              <v-chip :color="statusColor(t.status)" size="small" label>{{ t.status.toUpperCase() }}</v-chip>
              <v-btn
                variant="text"
                size="small"
                icon="mdi-arrow-right"
                :to="`/tournaments/${t.id}`"
              />
            </div>
          </div>
        </div>
      </v-window-item>

      <!-- Members tab -->
      <v-window-item value="members">
        <v-card v-if="members.length === 0" class="text-center pa-8">
          <p class="text-medium-emphasis">No members found.</p>
        </v-card>
        <div v-else>
          <div
            v-for="m in members"
            :key="m.uid"
            style="background:white;border:1px solid #e2e8f0;border-radius:8px;
                   padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;
                   justify-content:space-between;"
          >
            <div>
              <div style="font-size:14px;font-weight:600;color:#0F172A;">{{ m.uid }}</div>
              <div style="font-size:12px;color:#64748b;">Joined {{ m.joinedAt?.toLocaleDateString?.() ?? '—' }}</div>
            </div>
            <v-chip size="small" :color="m.role === 'admin' ? 'primary' : 'default'" label>{{ m.role }}</v-chip>
          </div>
        </div>
      </v-window-item>
    </v-window>
  </template>
</template>
```

- [ ] **Run type-check**

```bash
npm run type-check
```

- [ ] **Commit**

```bash
git add src/features/org/
git commit -m "feat: add OrgProfileView with profile/tournaments/members tabs (Sports Scoreboard header)"
```

---

### Task 4.3: Add org route + nav item

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/components/navigation/AppNavigation.vue`

- [ ] **Add lazy import at top of router file (with other admin views, around line 28)**

```typescript
// Org views
const OrgProfile = () => import('@/features/org/views/OrgProfileView.vue');
```

- [ ] **Add route (in the authenticated routes block, after line 357 admin-reviews route)**

```typescript
  {
    path: '/org/profile',
    name: 'org-profile',
    component: OrgProfile,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
```

> `requiresAdmin: true` is correct here — `isAdmin` in the auth store returns `true` for both `'admin'` and `'organizer'` roles.

- [ ] **Add nav item to `AppNavigation.vue`**

Find the "Always visible" section (around line 50-77). Add the Organization item after the "Create Tournament" item, before the "Review Moderation" item:

```vue
      <v-list-item
        v-if="isOrganizer"
        to="/org/profile"
        :prepend-icon="NAVIGATION_ICONS.organization"
        title="Organization"
        class="nav-item nav-item--organization"
        rounded="lg"
        :ripple="false"
      />
```

- [ ] **Run build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/router/index.ts src/components/navigation/AppNavigation.vue
git commit -m "feat: add /org/profile route and Organization nav item"
```

---

## Chunk 5: Player Feature Module

### Task 5.1: Create `PlayersListView.vue`

**Files:**
- Create: `src/features/players/views/PlayersListView.vue`

- [ ] **Create directory**

```bash
mkdir -p src/features/players/views
```

- [ ] **Write the view**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { usePlayersStore } from '@/stores/players';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import type { GlobalPlayer } from '@/types';

const playersStore = usePlayersStore();

const search = ref('');

const { execute: load, loading } = useAsyncOperation(() => playersStore.fetchPlayers());

const filteredPlayers = computed((): GlobalPlayer[] => {
  const q = search.value.toLowerCase();
  if (!q) return playersStore.players;
  return playersStore.players.filter(
    (p) =>
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
  );
});

const winRate = (p: GlobalPlayer): string => {
  const { wins, losses } = p.stats?.overall ?? { wins: 0, losses: 0 };
  const total = wins + losses;
  if (total === 0) return '—';
  return `${Math.round((wins / total) * 100)}%`;
};

onMounted(load);
</script>

<template>
  <!-- Dark sports-scoreboard header -->
  <div style="background:#0F172A;padding:24px 24px 0;">
    <div class="d-flex align-center ga-3 mb-4">
      <div
        style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#1D4ED8,#D97706);
               display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;"
      >
        <v-icon size="22">mdi-account-group</v-icon>
      </div>
      <div>
        <div style="font-size:18px;font-weight:800;color:white;">Players</div>
        <div style="font-size:12px;color:#64748b;">Global player registry</div>
      </div>
    </div>
    <!-- Stats bar -->
    <div
      style="background:#1E293B;border-radius:10px 10px 0 0;display:grid;grid-template-columns:repeat(3,1fr);"
    >
      <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
        <div style="font-size:22px;font-weight:800;color:#F59E0B;">{{ playersStore.players.length }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Total</div>
      </div>
      <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
        <div style="font-size:22px;font-weight:800;color:#F59E0B;">{{ playersStore.players.filter(p => p.isActive).length }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Active</div>
      </div>
      <div style="padding:12px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#F59E0B;">{{ playersStore.players.filter(p => p.isVerified).length }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Verified</div>
      </div>
    </div>
  </div>

  <v-container class="pa-4">
    <v-text-field
      v-model="search"
      prepend-inner-icon="mdi-magnify"
      placeholder="Search by name or email..."
      clearable
      class="mb-4"
    />

    <v-progress-circular v-if="loading" indeterminate color="primary" class="d-block mx-auto my-8" />

    <div v-else-if="filteredPlayers.length === 0" class="text-center py-8 text-medium-emphasis">
      No players found.
    </div>

    <template v-else>
      <div
        v-for="player in filteredPlayers"
        :key="player.id"
        style="background:white;border-left:3px solid #1D4ED8;border-radius:0 8px 8px 0;
               padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;
               justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.05);cursor:pointer;"
        @click="$router.push(`/players/${player.id}`)"
      >
        <div class="d-flex align-center ga-3">
          <div
            style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#1D4ED8,#D97706);
                   display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0;"
          >
            {{ player.firstName.charAt(0) }}{{ player.lastName.charAt(0) }}
          </div>
          <div>
            <div style="font-size:14px;font-weight:600;color:#0F172A;">
              {{ player.firstName }} {{ player.lastName }}
              <v-icon v-if="player.isVerified" size="14" color="success" class="ml-1">mdi-check-circle</v-icon>
            </div>
            <div style="font-size:12px;color:#64748b;">{{ player.email }}</div>
          </div>
        </div>
        <div class="d-flex align-center ga-2">
          <div v-if="player.stats?.overall" class="text-right">
            <div style="font-size:13px;font-weight:700;color:#0F172A;">{{ winRate(player) }}</div>
            <div style="font-size:10px;color:#64748b;">win rate</div>
          </div>
          <v-icon color="grey-lighten-1" size="18">mdi-chevron-right</v-icon>
        </div>
      </div>
    </template>
  </v-container>
</template>
```

- [ ] **Run type-check**

```bash
npm run type-check
```

- [ ] **Commit**

```bash
git add src/features/players/views/PlayersListView.vue
git commit -m "feat: add PlayersListView with search and global player stats summary"
```

---

### Task 5.2: Create `PlayerProfileView.vue`

**Files:**
- Create: `src/features/players/views/PlayerProfileView.vue`

- [ ] **Write the view**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { usePlayersStore } from '@/stores/players';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import type { GlobalPlayer, PlayerStats } from '@/types';

const route = useRoute();
const playersStore = usePlayersStore();

const player = ref<GlobalPlayer | null>(null);
const activeSportTab = ref<string>('overall');

const { execute: load, loading } = useAsyncOperation(async () => {
  const id = route.params.playerId as string;
  player.value = await playersStore.fetchPlayerById(id);
  // Set first sport tab by default if stats exist
  if (player.value?.stats) {
    const sports = Object.keys(player.value.stats).filter((k) => k !== 'overall');
    if (sports.length > 0) activeSportTab.value = sports[0];
  }
});

const initials = computed((): string => {
  if (!player.value) return '??';
  return `${player.value.firstName.charAt(0)}${player.value.lastName.charAt(0)}`.toUpperCase();
});

const overallStats = computed((): PlayerStats =>
  player.value?.stats?.overall ?? { wins: 0, losses: 0, gamesPlayed: 0, tournamentsPlayed: 0 }
);

const winRate = (wins: number, losses: number): number => {
  const total = wins + losses;
  return total === 0 ? 0 : Math.round((wins / total) * 100);
};

const sportTabs = computed((): string[] =>
  player.value ? Object.keys(player.value.stats).filter((k) => k !== 'overall') : []
);

const sportEmoji = (sport: string): string => {
  const map: Record<string, string> = {
    tennis: '🎾',
    pickleball: '🏓',
    badminton: '🏸',
    squash: '🎱',
    padel: '🎾',
  };
  return map[sport.toLowerCase()] ?? '🏅';
};

const categoryStats = (sport: string): Array<{ label: string; stats: PlayerStats }> => {
  if (!player.value?.stats?.[sport]) return [];
  return Object.entries(player.value.stats[sport]).map(([label, stats]) => ({
    label,
    stats: stats as PlayerStats,
  }));
};

const categoryColor = (label: string): string => {
  const map: Record<string, string> = {
    singles: '#1D4ED8',
    doubles: '#D97706',
    mixed: '#16A34A',
  };
  return map[label.toLowerCase()] ?? '#94A3B8';
};

onMounted(load);
</script>

<template>
  <v-container v-if="loading" class="d-flex justify-center pa-8">
    <v-progress-circular indeterminate color="primary" />
  </v-container>

  <v-container v-else-if="!player" class="text-center pa-8">
    <v-icon size="48" color="grey-lighten-1" class="mb-4">mdi-account-off-outline</v-icon>
    <p class="text-body-1 text-medium-emphasis">Player not found.</p>
    <v-btn :to="'/players'" variant="text" class="mt-2">Back to Players</v-btn>
  </v-container>

  <template v-else>
    <!-- Dark header -->
    <div style="background:#0F172A;padding:24px 24px 0;">
      <div class="d-flex align-center ga-4 mb-4">
        <div
          style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#1D4ED8,#D97706);
                 display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:white;flex-shrink:0;"
        >
          {{ initials }}
        </div>
        <div>
          <div class="d-flex align-center ga-2">
            <span style="font-size:20px;font-weight:800;color:white;">{{ player.firstName }} {{ player.lastName }}</span>
            <v-icon v-if="player.isVerified" color="success" size="18">mdi-check-circle</v-icon>
          </div>
          <div class="d-flex align-center ga-2 mt-1">
            <v-chip v-if="player.skillLevel" size="x-small" color="primary" label>Level {{ player.skillLevel }}</v-chip>
            <span style="font-size:12px;color:#64748b;">Member since {{ player.createdAt?.toLocaleDateString?.() ?? '—' }}</span>
          </div>
        </div>
      </div>

      <!-- Overall stats bar -->
      <div style="background:#1E293B;border-radius:10px 10px 0 0;display:grid;grid-template-columns:repeat(4,1fr);">
        <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
          <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ overallStats.wins }}</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Wins</div>
        </div>
        <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
          <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ overallStats.losses }}</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Losses</div>
        </div>
        <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
          <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ overallStats.tournamentsPlayed }}</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Tournaments</div>
        </div>
        <div style="padding:12px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ winRate(overallStats.wins, overallStats.losses) }}%</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Win Rate</div>
        </div>
      </div>
    </div>

    <v-container class="pa-4">
      <!-- No sport data yet -->
      <div v-if="sportTabs.length === 0" class="text-center py-6 text-medium-emphasis">
        <v-icon size="32" class="mb-2">mdi-chart-bar</v-icon>
        <p>No stats yet. Stats are computed after tournament completion.</p>
      </div>

      <template v-else>
        <!-- Sport tabs -->
        <v-tabs v-model="activeSportTab" class="mb-4">
          <v-tab
            v-for="sport in sportTabs"
            :key="sport"
            :value="sport"
          >
            {{ sportEmoji(sport) }} {{ sport.charAt(0).toUpperCase() + sport.slice(1) }}
          </v-tab>
        </v-tabs>

        <!-- Stat cards grid for active sport -->
        <v-window v-model="activeSportTab">
          <v-window-item v-for="sport in sportTabs" :key="sport" :value="sport">
            <v-row>
              <v-col
                v-for="{ label, stats } in categoryStats(sport)"
                :key="label"
                cols="12"
                sm="4"
              >
                <v-card>
                  <div :style="`height:3px;background:${categoryColor(label)};`" />
                  <v-card-text>
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:8px;">
                      {{ label.charAt(0).toUpperCase() + label.slice(1) }}
                    </div>
                    <div style="font-size:22px;font-weight:800;color:#0F172A;">
                      {{ stats.wins }}
                      <span style="font-size:16px;color:#dc2626;font-weight:600;"> / {{ stats.losses }}</span>
                    </div>
                    <v-progress-linear
                      :model-value="winRate(stats.wins, stats.losses)"
                      :color="categoryColor(label)"
                      bg-color="#e2e8f0"
                      rounded
                      height="4"
                      class="my-2"
                    />
                    <div style="font-size:11px;color:#64748b;">
                      {{ winRate(stats.wins, stats.losses) }}% · {{ stats.tournamentsPlayed }} tournament{{ stats.tournamentsPlayed !== 1 ? 's' : '' }}
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-window-item>
        </v-window>
      </template>
    </v-container>
  </template>
</template>
```

- [ ] **Run type-check**

```bash
npm run type-check
```

- [ ] **Commit**

```bash
git add src/features/players/views/PlayerProfileView.vue
git commit -m "feat: add PlayerProfileView with dark header, overall stats bar, sport tabs, and stat cards"
```

---

### Task 5.3: Add player routes + nav item

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/components/navigation/AppNavigation.vue`

- [ ] **Add lazy imports to router (after org import added in Task 4.3)**

```typescript
// Player views
const PlayersListView = () => import('@/features/players/views/PlayersListView.vue');
const PlayerProfileView = () => import('@/features/players/views/PlayerProfileView.vue');
```

- [ ] **Add routes (after org-profile route)**

```typescript
  {
    path: '/players',
    name: 'players-list',
    component: PlayersListView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/players/:playerId',
    name: 'player-profile',
    component: PlayerProfileView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
```

- [ ] **Add Players nav item to `AppNavigation.vue`** (in "Always visible" section, after Organization item):

```vue
      <v-list-item
        v-if="isOrganizer"
        to="/players"
        :prepend-icon="NAVIGATION_ICONS.players"
        title="Players"
        class="nav-item nav-item--players"
        rounded="lg"
        :ripple="false"
      />
```

- [ ] **Run build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/router/index.ts src/components/navigation/AppNavigation.vue
git commit -m "feat: add /players and /players/:playerId routes with Players nav item"
```

---

## Chunk 6: Dashboard — Store + View + Redirect + E2E

### Task 6.1: Create `src/stores/dashboard.ts`

**Files:**
- Create: `src/stores/dashboard.ts`

- [ ] **Write the store**

```typescript
// Dashboard Store — aggregated counts using getCountFromServer (no document reads)
import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  db,
  collection,
  collectionGroup,
  query,
  where,
  getCountFromServer,
  getDocs,
  orderBy,
  limit,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  tournamentId?: string;
}

export const useDashboardStore = defineStore('dashboard', () => {
  const pendingRegistrationCount = ref(0);
  const totalPlayerCount = ref(0);
  const recentActivity = ref<ActivityItem[]>([]);
  const loading = ref(false);

  const fetchCounts = async (): Promise<void> => {
    loading.value = true;
    try {
      const [pendingSnap, playersSnap] = await Promise.all([
        getCountFromServer(
          query(collectionGroup(db, 'registrations'), where('status', '==', 'pending'))
        ),
        getCountFromServer(collection(db, 'players')),
      ]);

      pendingRegistrationCount.value = pendingSnap.data().count;
      totalPlayerCount.value = playersSnap.data().count;
    } catch (err) {
      console.error('Error fetching dashboard counts:', err);
    } finally {
      loading.value = false;
    }
  };

  const fetchRecentActivity = async (): Promise<void> => {
    try {
      const q = query(
        collectionGroup(db, 'activities'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const snap = await getDocs(q);
      recentActivity.value = snap.docs.map((d) =>
        convertTimestamps({ id: d.id, ...d.data() }) as ActivityItem
      );
    } catch (err) {
      console.error('Error fetching recent activity:', err);
    }
  };

  const refresh = async (): Promise<void> => {
    await Promise.all([fetchCounts(), fetchRecentActivity()]);
  };

  return {
    pendingRegistrationCount,
    totalPlayerCount,
    recentActivity,
    loading,
    refresh,
  };
});
```

- [ ] **Run type-check**

```bash
npm run type-check
```

- [ ] **Commit**

```bash
git add src/stores/dashboard.ts
git commit -m "feat: add dashboard store with getCountFromServer aggregations"
```

---

### Task 6.2: Create `OrgDashboardView.vue`

**Files:**
- Create: `src/features/dashboard/views/OrgDashboardView.vue`

- [ ] **Create directory**

```bash
mkdir -p src/features/dashboard/views
```

- [ ] **Write the view**

```vue
<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useDashboardStore } from '@/stores/dashboard';
import { useTournamentStore } from '@/stores/tournaments';
import { useAuthStore } from '@/stores/auth';
import { useAsyncOperation } from '@/composables/useAsyncOperation';

const dashboardStore = useDashboardStore();
const tournamentStore = useTournamentStore();
const authStore = useAuthStore();

const { execute: load, loading } = useAsyncOperation(async () => {
  await Promise.all([
    dashboardStore.refresh(),
    tournamentStore.fetchTournaments(),
  ]);
});

const activeTournaments = computed(() =>
  tournamentStore.tournaments.filter((t) => t.status === 'active')
);

const upcomingTournaments = computed(() =>
  tournamentStore.tournaments.filter((t) =>
    t.status === 'registration' || t.status === 'draft'
  )
);

const greeting = computed((): string => {
  const name = authStore.currentUser?.displayName?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
});

onMounted(load);
</script>

<template>
  <!-- Dark header -->
  <div style="background:#0F172A;padding:24px 24px 0;">
    <div class="d-flex align-center ga-3 mb-4">
      <div
        style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#1D4ED8,#D97706);
               display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;"
      >
        <v-icon size="22">mdi-view-dashboard-variant</v-icon>
      </div>
      <div>
        <div style="font-size:18px;font-weight:800;color:white;">{{ greeting }}</div>
        <div style="font-size:12px;color:#64748b;">CourtMastr Dashboard</div>
      </div>
    </div>
    <!-- Stats bar -->
    <div
      style="background:#1E293B;border-radius:10px 10px 0 0;display:grid;grid-template-columns:repeat(4,1fr);"
    >
      <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
        <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ activeTournaments.length }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Live</div>
      </div>
      <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
        <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ upcomingTournaments.length }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Upcoming</div>
      </div>
      <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
        <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ dashboardStore.pendingRegistrationCount }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Pending Regs</div>
      </div>
      <div style="padding:12px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ dashboardStore.totalPlayerCount }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Players</div>
      </div>
    </div>
  </div>

  <v-container class="pa-4">
    <v-progress-circular v-if="loading" indeterminate color="primary" class="d-block mx-auto my-8" />

    <template v-else>
      <!-- Live tournaments -->
      <div v-if="activeTournaments.length > 0" class="mb-6">
        <div class="d-flex align-center ga-2 mb-3">
          <span
            style="width:8px;height:8px;border-radius:50%;background:#16A34A;display:inline-block;
                   animation:pulse 1.5s infinite;"
          />
          <span style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Live Now</span>
        </div>
        <div
          v-for="t in activeTournaments"
          :key="t.id"
          style="background:white;border-left:3px solid #16A34A;border-radius:0 8px 8px 0;
                 padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;
                 justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.05);"
        >
          <div>
            <div style="font-size:14px;font-weight:600;color:#0F172A;">{{ t.name }}</div>
            <div style="font-size:12px;color:#64748b;">{{ t.sport ?? '—' }} · {{ t.location ?? 'No location' }}</div>
          </div>
          <v-btn :to="`/tournaments/${t.id}`" size="small" variant="tonal" color="success">Manage</v-btn>
        </div>
      </div>

      <!-- Upcoming tournaments -->
      <div v-if="upcomingTournaments.length > 0" class="mb-6">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:12px;">
          Upcoming
        </div>
        <div
          v-for="t in upcomingTournaments"
          :key="t.id"
          style="background:white;border-left:3px solid #1D4ED8;border-radius:0 8px 8px 0;
                 padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;
                 justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.05);"
        >
          <div>
            <div style="font-size:14px;font-weight:600;color:#0F172A;">{{ t.name }}</div>
            <div style="font-size:12px;color:#64748b;">{{ t.sport ?? '—' }} · {{ t.status }}</div>
          </div>
          <v-btn :to="`/tournaments/${t.id}`" size="small" variant="text">View</v-btn>
        </div>
      </div>

      <!-- Recent activity -->
      <div v-if="dashboardStore.recentActivity.length > 0">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:12px;">
          Recent Activity
        </div>
        <v-card>
          <v-list lines="one" density="compact">
            <v-list-item
              v-for="item in dashboardStore.recentActivity"
              :key="item.id"
              :title="item.message"
              :subtitle="item.createdAt?.toLocaleString?.() ?? ''"
              prepend-icon="mdi-clock-outline"
            />
          </v-list>
        </v-card>
      </div>

      <!-- Empty state -->
      <div v-if="activeTournaments.length === 0 && upcomingTournaments.length === 0 && dashboardStore.recentActivity.length === 0"
           class="text-center py-8 text-medium-emphasis">
        <v-icon size="48" class="mb-4">mdi-calendar-blank-outline</v-icon>
        <p>No tournaments yet. <v-btn to="/tournaments/create" variant="text" color="primary" size="small">Create one</v-btn></p>
      </div>
    </template>
  </v-container>
</template>

<style scoped>
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
```

- [ ] **Run type-check**

```bash
npm run type-check
```

- [ ] **Commit**

```bash
git add src/features/dashboard/views/OrgDashboardView.vue
git commit -m "feat: add OrgDashboardView with live/upcoming stats and activity feed"
```

---

### Task 6.3: Add dashboard route + nav + change all `tournament-list` redirects

**Files:**
- Modify: `src/router/index.ts`
- Modify: `src/components/navigation/AppNavigation.vue`

This task contains the highest-risk change in the plan: replacing `tournament-list` with `dashboard` in 4 router guard redirect calls. These affect where all auth redirects land.

- [ ] **Add lazy import**

```typescript
// Dashboard
const OrgDashboard = () => import('@/features/dashboard/views/OrgDashboardView.vue');
```

- [ ] **Add `/dashboard` route (in authenticated routes, BEFORE the `/tournaments` route)**

```typescript
  {
    path: '/dashboard',
    name: 'dashboard',
    component: OrgDashboard,
    meta: { requiresAuth: true },
  },
```

- [ ] **Update 4 router guard redirect calls** (search for `tournament-list` in `router/index.ts`)

The following 4 occurrences must change from `{ name: 'tournament-list' }` to `{ name: 'dashboard' }`:

1. `guestOnly && isAuthenticated` redirect (~line 502)
2. `requiresAdmin && !isAdmin` redirect (~line 513)
3. `requiresWebAdmin` redirect (~line 519)
4. `requiresScorekeeper && !isScorekeeper` redirect (~line 525)

> Run this grep first to find all 4 locations: `grep -n "tournament-list" src/router/index.ts`

- [ ] **Add Dashboard nav item** (at the top of the "Always visible" section in AppNavigation.vue, as first item):

```vue
      <v-list-item
        to="/dashboard"
        :prepend-icon="NAVIGATION_ICONS.orgDashboard"
        title="Dashboard"
        class="nav-item nav-item--org-dashboard"
        rounded="lg"
        :ripple="false"
      />
```

- [ ] **Run build**

```bash
npm run build
```

- [ ] **Commit**

```bash
git add src/router/index.ts src/components/navigation/AppNavigation.vue
git commit -m "feat: add /dashboard route, Dashboard nav item; redirect all auth guards to dashboard"
```

---

### Task 6.4: Update E2E test URL expectations

**Files:**
- Modify: `e2e/auth.setup.ts`
- Modify: `e2e/fixtures/auth-fixtures.ts`
- Modify: various e2e spec files (see grep output)

After changing post-login redirect to `/dashboard`, E2E tests that `waitForURL('/tournaments')` after login will time out.

- [ ] **Find all affected files**

```bash
grep -rn "waitForURL.*\/tournaments'" e2e/ --include="*.ts"
```

- [ ] **Update `e2e/auth.setup.ts`** — change post-login `waitForURL('/tournaments')` to `waitForURL('/dashboard')`

- [ ] **Update `e2e/fixtures/auth-fixtures.ts`** — change post-login `waitForURL('/tournaments')` to `waitForURL('/dashboard')`

- [ ] **Update all other e2e spec files** found by the grep above. Change the URL pattern in the context of login flows only (do not change assertions that navigate to `/tournaments` deliberately — only the post-login landing URL).

> Each file: find `await page.waitForURL('/tournaments'` near login calls and change to `await page.waitForURL('/dashboard'`

- [ ] **Run E2E tests (with emulators running)**

```bash
# In one terminal:
npm run emulators

# In another terminal:
npx playwright test e2e/auth.setup.ts --reporter=list
```

Expected: auth setup passes without timeout.

- [ ] **Commit**

```bash
git add e2e/
git commit -m "feat: update e2e post-login waitForURL from /tournaments to /dashboard"
```

---

## Chunk 7: Org Public Landing Page

### Task 7.1: Create `OrgPublicHomeView.vue`

**Files:**
- Create: `src/features/public/views/OrgPublicHomeView.vue`

- [ ] **Write the view**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useOrganizationsStore } from '@/stores/organizations';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import type { Organization, Tournament } from '@/types';

const route = useRoute();
const orgStore = useOrganizationsStore();

const org = ref<Organization | null>(null);
const notFound = ref(false);

const { execute: load, loading } = useAsyncOperation(async () => {
  const slug = route.params.orgSlug as string;
  const result = await orgStore.fetchOrgBySlug(slug);
  if (!result) {
    notFound.value = true;
    return;
  }
  org.value = result;
  await orgStore.fetchOrgTournaments(result.id);
});

const statusColor = (status: string): string => {
  const map: Record<string, string> = { active: 'success', registration: 'primary', completed: 'grey' };
  return map[status] ?? 'grey';
};

const statusLabel = (status: string): string => {
  const map: Record<string, string> = { active: 'LIVE', registration: 'OPEN', completed: 'COMPLETED', draft: 'DRAFT' };
  return map[status] ?? status.toUpperCase();
};

const isLive = (status: string): boolean => status === 'active';

const totalMatches = computed((): number =>
  orgStore.orgTournaments.reduce((acc, t) => acc + (t.settings?.matchDurationMinutes ? 1 : 0), 0)
);

const sportSet = computed((): string[] =>
  [...new Set(orgStore.orgTournaments.map((t) => t.sport).filter(Boolean) as string[])]
);

onMounted(load);
</script>

<template>
  <v-container v-if="loading" class="d-flex justify-center pa-8">
    <v-progress-circular indeterminate color="primary" />
  </v-container>

  <!-- 404 state -->
  <v-container v-else-if="notFound" class="text-center pa-12">
    <v-icon size="64" color="grey-lighten-2" class="mb-4">mdi-office-building-off-outline</v-icon>
    <h2 class="text-h5 font-weight-bold mb-2">Organization not found</h2>
    <p class="text-medium-emphasis mb-4">No organization exists at this URL.</p>
    <v-btn to="/" variant="outlined">Go Home</v-btn>
  </v-container>

  <template v-else-if="org">
    <!-- Dark hero header -->
    <div style="background:#0F172A;padding:28px 24px 0;">
      <div class="d-flex align-center ga-4 mb-5">
        <div
          style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,#1D4ED8,#D97706);
                 display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:white;flex-shrink:0;"
        >
          {{ org.name.slice(0, 2).toUpperCase() }}
        </div>
        <div>
          <div style="font-size:22px;font-weight:800;color:white;line-height:1.2;">{{ org.name }}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">
            {{ org.about ? org.about.slice(0, 60) + (org.about.length > 60 ? '…' : '') : 'courtmaster.app/' + org.slug }}
          </div>
        </div>
      </div>

      <!-- Stats panel -->
      <div style="background:#1E293B;border-radius:10px 10px 0 0;display:grid;grid-template-columns:repeat(4,1fr);">
        <div style="padding:14px 10px;text-align:center;border-right:1px solid #334155;">
          <div style="font-size:22px;font-weight:800;color:#F59E0B;">{{ orgStore.orgTournaments.length }}</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Tournaments</div>
        </div>
        <div style="padding:14px 10px;text-align:center;border-right:1px solid #334155;">
          <div style="font-size:22px;font-weight:800;color:#F59E0B;">—</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Players</div>
        </div>
        <div style="padding:14px 10px;text-align:center;border-right:1px solid #334155;">
          <div style="font-size:22px;font-weight:800;color:#F59E0B;">—</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Matches</div>
        </div>
        <div style="padding:14px 10px;text-align:center;">
          <div style="font-size:22px;font-weight:800;color:#F59E0B;">{{ sportSet.length || '—' }}</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;">Sports</div>
        </div>
      </div>
    </div>

    <!-- Tournament list -->
    <v-container class="pa-4">
      <div v-if="orgStore.orgTournaments.length === 0" class="text-center py-8 text-medium-emphasis">
        <v-icon size="40" class="mb-3">mdi-calendar-blank-outline</v-icon>
        <p>No tournaments yet.</p>
      </div>

      <div
        v-for="t in orgStore.orgTournaments"
        :key="t.id"
        :style="`background:white;border-left:3px solid ${isLive(t.status) ? '#16A34A' : '#1D4ED8'};
                 border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:8px;
                 display:flex;align-items:center;justify-content:space-between;
                 box-shadow:0 1px 3px rgba(0,0,0,0.05);`"
      >
        <div>
          <div style="font-size:14px;font-weight:600;color:#0F172A;">
            {{ t.sport ? '🏅' : '' }} {{ t.name }}
          </div>
          <div style="font-size:12px;color:#64748b;">
            {{ t.startDate?.toLocaleDateString?.() ?? '—' }}
            <template v-if="t.endDate"> – {{ t.endDate.toLocaleDateString() }}</template>
          </div>
        </div>
        <div class="d-flex align-center ga-2">
          <div v-if="isLive(t.status)" class="d-flex align-center" style="gap:4px;">
            <span style="width:7px;height:7px;border-radius:50%;background:#16A34A;display:inline-block;animation:pulse 1.5s infinite;" />
            <span style="font-size:11px;font-weight:700;color:#16A34A;">LIVE</span>
          </div>
          <v-chip v-else :color="statusColor(t.status)" size="small" label>{{ statusLabel(t.status) }}</v-chip>
          <v-btn
            :to="`/tournaments/${t.id}/landing`"
            variant="text"
            size="small"
            icon="mdi-arrow-right"
          />
        </div>
      </div>

      <!-- Org info footer -->
      <v-card v-if="org.contactEmail || org.website" class="mt-4">
        <v-card-text class="d-flex ga-4 flex-wrap">
          <div v-if="org.contactEmail" class="d-flex align-center ga-2">
            <v-icon size="16" color="grey">mdi-email-outline</v-icon>
            <a :href="`mailto:${org.contactEmail}`" style="font-size:13px;color:#1D4ED8;">{{ org.contactEmail }}</a>
          </div>
          <div v-if="org.website" class="d-flex align-center ga-2">
            <v-icon size="16" color="grey">mdi-web</v-icon>
            <a :href="org.website" target="_blank" style="font-size:13px;color:#1D4ED8;">{{ org.website }}</a>
          </div>
        </v-card-text>
      </v-card>
    </v-container>
  </template>
</template>

<style scoped>
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
```

- [ ] **Run type-check**

```bash
npm run type-check
```

- [ ] **Commit**

```bash
git add src/features/public/views/OrgPublicHomeView.vue
git commit -m "feat: add OrgPublicHomeView with dark hero, stats panel, and tournament cards"
```

---

### Task 7.2: Add `/:orgSlug` route

**Files:**
- Modify: `src/router/index.ts`

> **CRITICAL:** `/:orgSlug` must be added AFTER all static root-level routes AND before the existing `/:pathMatch(.*)` catch-all. The reserved paths (`login`, `register`, `about`, `pricing`, `privacy`, `terms`, `tournaments`, `dashboard`, `players`, `org`) will be matched first because Vue Router matches routes in declaration order.

- [ ] **Add lazy import**

```typescript
const OrgPublicHome = () => import('@/features/public/views/OrgPublicHomeView.vue');
```

- [ ] **Add route — place it immediately BEFORE the existing `/:pathMatch(.*)` catch-all**

```typescript
  // Org public landing — must be LAST before catch-all
  // Reserved slugs: login, register, about, pricing, privacy, terms, tournaments,
  //                 dashboard, players, org, obs, overlay, profile, preferences
  {
    path: '/:orgSlug',
    name: 'org-public-home',
    component: OrgPublicHome,
    meta: { requiresAuth: false },
  },
```

- [ ] **Run build**

```bash
npm run build
```

- [ ] **Verify route ordering in router** — confirm `/:orgSlug` appears after `/tournaments`, `/dashboard`, `/players`, `/org` routes and before `/:pathMatch`:

```bash
grep -n "path:" src/router/index.ts | tail -10
```

- [ ] **Commit**

```bash
git add src/router/index.ts
git commit -m "feat: add /:orgSlug public org landing route (before catch-all)"
```

---

## Chunk 8: Cloud Function — Stats Aggregation

### Task 8.1: Add `tournamentId` denormalization to match_scores writes

**Files:**
- Modify: whichever service/store writes to `match_scores` (search: `match_scores`)

The Cloud Function uses `collectionGroup("match_scores").where("tournamentId", "==", tournamentId)`. For this to work, each `match_score` document must have a `tournamentId` field.

- [ ] **Find match_scores write locations**

```bash
grep -rn "match_scores" src/ --include="*.ts" --include="*.vue" | grep -v "\.test\." | grep -v "firestore.rules"
```

- [ ] **For each write location found**, add `tournamentId` to the written data:

```typescript
// In each match_score setDoc/updateDoc/addDoc call, include:
tournamentId: tournamentId, // forward pointer for Cloud Function collectionGroup query
```

> This is additive. Existing documents without `tournamentId` are silently skipped by the Cloud Function per the spec.

- [ ] **Run type-check + build after each file modified**

```bash
npm run type-check && npm run build
```

- [ ] **Commit**

```bash
git add src/
git commit -m "feat: denormalize tournamentId onto match_scores documents for stats aggregation"
```

---

### Task 8.2: Create `functions/src/playerStats.ts`

**Files:**
- Create: `functions/src/playerStats.ts`

- [ ] **Write the Cloud Function (uses Firebase Functions v2)**

```typescript
// playerStats.ts — Aggregate player stats when a tournament completes
// Uses Firebase Functions v2 API (not v1 — see index.ts comment about v1 deprecation)
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const { FieldValue } = admin.firestore;

export const aggregatePlayerStats = onDocumentUpdated(
  'tournaments/{tournamentId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) return;

    // Only run when status changes TO 'completed'
    if (before.status === after.status) return;
    if (after.status !== 'completed') return;

    // Skip if already processed or no sport defined
    if (after.statsProcessed === true) return;
    if (!after.sport) return;

    const tournamentId = event.params.tournamentId;
    const sport = after.sport as string;

    console.log(`[playerStats] Processing stats for tournament ${tournamentId}, sport: ${sport}`);

    try {
      // Step 1: Read all match scores via collectionGroup query
      const matchScoresSnap = await db
        .collectionGroup('match_scores')
        .where('tournamentId', '==', tournamentId)
        .where('status', '==', 'completed')
        .get();

      if (matchScoresSnap.empty) {
        console.log(`[playerStats] No completed match scores found for ${tournamentId}`);
        await event.data?.after.ref.update({ statsProcessed: true });
        return;
      }

      // Step 2: Read all registrations for this tournament
      const regsSnap = await db
        .collection(`tournaments/${tournamentId}/registrations`)
        .get();

      // Build map: registrationId -> playerId (from globalPlayerId field on player doc)
      // The tournament player doc ID equals the globalPlayerId (per spec §4.2)
      const registrationToGlobalPlayer: Record<string, string> = {};
      for (const regDoc of regsSnap.docs) {
        const reg = regDoc.data();
        if (reg.playerId) {
          registrationToGlobalPlayer[regDoc.id] = reg.playerId as string;
        }
      }

      // Step 3: Compute per-player deltas
      const deltas: Record<string, { wins: number; losses: number; gamesPlayed: number; categoryType: string }> = {};

      for (const matchDoc of matchScoresSnap.docs) {
        const match = matchDoc.data();
        const categoryType = (match.categoryType as string | undefined) ?? 'singles';

        const winner1Id = registrationToGlobalPlayer[match.winnerId as string];
        const loser1Id = registrationToGlobalPlayer[match.loserId as string];

        // Handle doubles: winner2Id, loser2Id (optional)
        const winner2Id = match.winner2Id ? registrationToGlobalPlayer[match.winner2Id as string] : undefined;
        const loser2Id = match.loser2Id ? registrationToGlobalPlayer[match.loser2Id as string] : undefined;

        const recordResult = (globalPlayerId: string | undefined, isWin: boolean): void => {
          if (!globalPlayerId) return;
          if (!deltas[globalPlayerId]) {
            deltas[globalPlayerId] = { wins: 0, losses: 0, gamesPlayed: 0, categoryType };
          }
          if (isWin) {
            deltas[globalPlayerId].wins += 1;
          } else {
            deltas[globalPlayerId].losses += 1;
          }
          deltas[globalPlayerId].gamesPlayed += 1;
        };

        recordResult(winner1Id, true);
        recordResult(winner2Id, true);
        recordResult(loser1Id, false);
        recordResult(loser2Id, false);
      }

      // Step 4: Batch write increments to /players
      const batch = db.batch();

      for (const [globalPlayerId, delta] of Object.entries(deltas)) {
        const playerRef = db.collection('players').doc(globalPlayerId);
        const catPath = `stats.${sport}.${delta.categoryType}`;

        batch.update(playerRef, {
          [`${catPath}.wins`]: FieldValue.increment(delta.wins),
          [`${catPath}.losses`]: FieldValue.increment(delta.losses),
          [`${catPath}.gamesPlayed`]: FieldValue.increment(delta.gamesPlayed),
          [`${catPath}.tournamentsPlayed`]: FieldValue.increment(1),
          'stats.overall.wins': FieldValue.increment(delta.wins),
          'stats.overall.losses': FieldValue.increment(delta.losses),
          'stats.overall.gamesPlayed': FieldValue.increment(delta.gamesPlayed),
          'stats.overall.tournamentsPlayed': FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Step 5: Mark tournament as processed (prevents double-counting)
      batch.update(event.data!.after.ref, { statsProcessed: true });

      await batch.commit();

      console.log(`[playerStats] Updated stats for ${Object.keys(deltas).length} players in tournament ${tournamentId}`);
    } catch (err) {
      console.error(`[playerStats] Error processing tournament ${tournamentId}:`, err);
      throw err;
    }
  }
);
```

- [ ] **Run TypeScript check in functions directory**

```bash
cd functions && npm run build 2>&1 | head -30
```

Expected: builds without errors.

- [ ] **Commit**

```bash
git add functions/src/playerStats.ts
git commit -m "feat: add aggregatePlayerStats Cloud Function (v2 trigger, end-of-tournament)"
```

---

### Task 8.3: Export the Cloud Function

**Files:**
- Modify: `functions/src/index.ts`

- [ ] **Add import and export**

At the top of `functions/src/index.ts`, add:

```typescript
import { aggregatePlayerStats as aggregatePlayerStatsFn } from './playerStats';
```

After the existing exports, add:

```typescript
export const aggregatePlayerStats = aggregatePlayerStatsFn;
```

- [ ] **Build functions**

```bash
cd functions && npm run build
```

Expected: successful build.

- [ ] **Commit**

```bash
git add functions/src/index.ts
git commit -m "feat: export aggregatePlayerStats from Cloud Functions index"
```

---

## Final Verification

### Task 9.1: Full build + type-check

- [ ] **Run full build verification**

```bash
npm run type-check
npm run build
npm run build:log
```

All must pass with no errors.

- [ ] **Run unit tests**

```bash
npm run test -- --run
```

Expected: all existing tests pass. If any fail due to the `Tournament.sport` type change or the `addPlayer` change, fix them before continuing.

- [ ] **Run E2E auth setup**

```bash
npm run emulators &
npx playwright test e2e/auth.setup.ts --reporter=list
```

- [ ] **Run smoke E2E tests**

```bash
npx playwright test --project=chromium-no-auth --reporter=list
npx playwright test --project=chromium --reporter=list
```

- [ ] **Final commit if any fixes made**

```bash
git add -A
git commit -m "fix: final build and test verification fixes"
```

---

### Task 9.2: Verify pattern compliance

- [ ] **Check for native dialogs (must be zero)**

```bash
grep -rn "confirm(" src/ --include="*.vue" --include="*.ts"
```

- [ ] **Check for loading without useAsyncOperation (must be zero in new files)**

```bash
grep -rn "loading.value = true" src/features/players/ src/features/org/ src/features/dashboard/ --include="*.vue" --include="*.ts"
```

- [ ] **Check for `new Date()` (must be zero in Firestore writes)**

```bash
grep -rn "new Date()" src/stores/players.ts src/stores/organizations.ts src/stores/dashboard.ts
```

Expected: all zero.

---

## File Map Summary

| File | Action | Purpose |
|---|---|---|
| `src/types/index.ts` | Modify | Add GlobalPlayer, Organization, OrganizationMember; widen Tournament.sport; add User.activeOrgId |
| `src/services/firebase.ts` | Modify | Export getCountFromServer, collectionGroup |
| `firestore.rules` | Modify | Add org, player, index rules + helper functions |
| `firestore.indexes.json` | Modify | Add 4 new indexes |
| `src/constants/navigationIcons.ts` | Modify | Add orgDashboard, players, organization icons |
| `src/stores/players.ts` | **Create** | Global player store with findOrCreateByEmail transaction |
| `src/stores/organizations.ts` | **Create** | Org store with slug-unique createOrg |
| `src/stores/dashboard.ts` | **Create** | Dashboard aggregation store |
| `src/stores/registrations.ts` | Modify | Bridge addPlayer to global player identity |
| `src/features/org/views/OrgProfileView.vue` | **Create** | Org admin profile with tabs |
| `src/features/players/views/PlayersListView.vue` | **Create** | Global player list with search |
| `src/features/players/views/PlayerProfileView.vue` | **Create** | Player stats page with sport tabs + stat cards |
| `src/features/dashboard/views/OrgDashboardView.vue` | **Create** | Post-login dashboard |
| `src/features/public/views/OrgPublicHomeView.vue` | **Create** | Public org landing page |
| `src/router/index.ts` | Modify | Add 5 new routes; 4 redirect fixes; /:orgSlug before catch-all |
| `src/components/navigation/AppNavigation.vue` | Modify | Add Dashboard, Players, Organization nav items |
| `functions/src/playerStats.ts` | **Create** | Stats aggregation Cloud Function (v2) |
| `functions/src/index.ts` | Modify | Export aggregatePlayerStats |
| `e2e/auth.setup.ts` | Modify | Update waitForURL /tournaments → /dashboard |
| `e2e/fixtures/auth-fixtures.ts` | Modify | Update waitForURL /tournaments → /dashboard |
| `e2e/*.spec.ts` (up to 13 files) | Modify | Update post-login URL assertions |
