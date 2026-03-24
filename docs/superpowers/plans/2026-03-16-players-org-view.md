# Players & Org View Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken Org Profile and Players views, scope the authenticated Players list to the current org, and add a public `/find` player search page.

**Architecture:** Four independent changes — bug fixes, a new store method, a new public view, and a route addition — all in the existing Vue 3 + Pinia + Firestore stack. No new dependencies needed.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Firebase Firestore, Vue Router, Vuetify 3

---

## Chunk 1: Bug fixes + security rules

### Task 1: Fix `useAsyncOperation` bug in OrgProfileView

The `useAsyncOperation` composable takes NO arguments — the async function must be passed to `execute()`, not to the composable constructor. `OrgProfileView` currently passes it to the constructor (same bug as the already-fixed dashboard). Additionally, admin users have `activeOrgId: null`, so the view should show a meaningful message for them rather than the generic "No organization linked" empty state.

**Files:**
- Modify: `src/features/org/views/OrgProfileView.vue:26-41` and `65`

- [ ] **Step 1: Open `src/features/org/views/OrgProfileView.vue` and replace the `useAsyncOperation` call**

Replace this block (lines 26–41 and 65):
```typescript
// BEFORE (broken)
const { execute: loadOrg, loading } = useAsyncOperation(async () => {
  const activeOrgId = authStore.currentUser?.activeOrgId;
  if (!activeOrgId) return;
  org.value = await orgStore.fetchOrgById(activeOrgId);
  if (org.value) {
    form.value = { ... };
    await orgStore.fetchOrgTournaments(activeOrgId);
    members.value = await orgStore.fetchOrgMembers(activeOrgId);
  }
});
...
onMounted(loadOrg);
```

With this:
```typescript
// AFTER (correct)
const { execute, loading } = useAsyncOperation();

function loadOrg() {
  return execute(async () => {
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
}

onMounted(loadOrg);
```

- [ ] **Step 2: Fix the `saveProfile` call the same way**

```typescript
// BEFORE (broken)
const { execute: saveProfile, loading: saving } = useAsyncOperation(async () => {
  if (!org.value) return;
  await orgStore.updateOrg(org.value.id, { ... });
  notificationStore.showToast('success', 'Organization profile saved');
});
```

```typescript
// AFTER (correct)
const { execute: executeSave, loading: saving } = useAsyncOperation();

function saveProfile() {
  return executeSave(async () => {
    if (!org.value) return;
    await orgStore.updateOrg(org.value.id, {
      name: form.value.name,
      contactEmail: form.value.contactEmail || null,
      timezone: form.value.timezone || null,
      about: form.value.about || null,
      website: form.value.website || null,
    });
    notificationStore.showToast('success', 'Organization profile saved');
  });
}
```

- [ ] **Step 3: Update the template empty state for admin users (no activeOrgId)**

In the template, replace the generic empty state message:
```html
<!-- BEFORE -->
<v-container v-else-if="!org" class="pa-8 text-center">
  <v-icon size="48" color="grey-lighten-1" class="mb-4">mdi-office-building-off-outline</v-icon>
  <p class="text-body-1 text-medium-emphasis">No organization linked to your account.</p>
</v-container>
```

```html
<!-- AFTER -->
<v-container v-else-if="!org" class="pa-8 text-center">
  <v-icon size="48" color="grey-lighten-1" class="mb-4">mdi-office-building-off-outline</v-icon>
  <p class="text-body-1 text-medium-emphasis">
    {{ authStore.currentUser?.activeOrgId ? 'Organization not found.' : 'No organization linked to your account. Ask an admin to add you to an org.' }}
  </p>
</v-container>
```

- [ ] **Step 4: Run type-check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/features/org/views/OrgProfileView.vue
git commit -m "fix: correct useAsyncOperation usage in OrgProfileView"
```

---

### Task 2: Fix security rules — allow public read on `/players`

The `/players` collection currently requires authentication (`allow read: if isAuthenticated()`). The public `/find` search page needs to read players without auth. Also add a collection group rule for `members` (needed by `fetchMyOrgs`).

**Files:**
- Modify: `firestore.rules:301-309`

- [ ] **Step 1: Update the `/players` read rule**

```
// BEFORE
match /players/{playerId} {
  allow read: if isAuthenticated();
  ...
}
```

```
// AFTER
match /players/{playerId} {
  allow read: if true;  // public player search at /find
  ...
}
```

- [ ] **Step 2: Add collection group rule for `members` (needed by fetchMyOrgs)**

In the `// ---- Collection Group Query Rules ----` section at the bottom of the file, add:
```
match /{path=**}/members/{uid} {
  allow read: if isAuthenticated();
}
```

- [ ] **Step 3: Verify rules file is valid**

Reload the app and confirm the emulator console shows no security rules errors.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "fix: allow public read on /players for global search; add members collection group rule"
```

---

## Chunk 2: Org-scoped Players list

### Task 3: Add `fetchOrgPlayers` to players store

The authenticated `/players` view should show only players who have registered for tournaments belonging to the current user's org. Add a dedicated store method that:
1. Gets all tournament IDs for the org from `orgStore.orgTournaments` (already fetched)
2. Fetches `tournaments/{id}/players` subcollection for each tournament
3. Deduplicates by `globalPlayerId`
4. Fetches full player records from `/players/{globalPlayerId}`

**Files:**
- Modify: `src/stores/players.ts` (add method after `fetchPlayers` ~line 92)

- [ ] **Step 1: Add `fetchOrgPlayers` method to `src/stores/players.ts`**

Add the following after the existing `fetchPlayers` method:

```typescript
const fetchOrgPlayers = async (orgTournamentIds: string[]): Promise<void> => {
  if (orgTournamentIds.length === 0) {
    players.value = [];
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    // Collect unique globalPlayerIds from all tournament player mirrors
    const seenIds = new Set<string>();
    await Promise.all(
      orgTournamentIds.map(async (tournamentId) => {
        const snap = await getDocs(collection(db, 'tournaments', tournamentId, 'players'));
        snap.docs.forEach((d) => {
          const gid = (d.data().globalPlayerId as string) || d.id;
          seenIds.add(gid);
        });
      })
    );

    if (seenIds.size === 0) {
      players.value = [];
      return;
    }

    // Fetch global player records
    const playerDocs = await Promise.all(
      Array.from(seenIds).map((id) => getDoc(doc(db, 'players', id)))
    );
    players.value = playerDocs
      .filter((d) => d.exists())
      .map((d) => convertTimestamps({ id: d.id, ...d.data() }) as GlobalPlayer);
  } catch (err) {
    error.value = 'Failed to fetch org players';
    console.error('Error fetching org players:', err);
  } finally {
    loading.value = false;
  }
};
```

- [ ] **Step 2: Export `fetchOrgPlayers` in the store's return object**

In the `return { ... }` at the bottom of the store, add `fetchOrgPlayers`.

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/stores/players.ts
git commit -m "feat: add fetchOrgPlayers to players store (org-scoped player list)"
```

---

### Task 4: Update PlayersListView to use org-scoped fetch

`PlayersListView.vue` has the same `useAsyncOperation` bug as OrgProfileView. Fix the bug and update the load logic to call `fetchOrgPlayers` with the current user's org tournament IDs instead of the global `fetchPlayers`.

**Files:**
- Modify: `src/features/players/views/PlayersListView.vue:1-32`

- [ ] **Step 1: Update imports and load logic in `PlayersListView.vue`**

Replace the entire `<script setup>` block:

```typescript
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { usePlayersStore } from '@/stores/players';
import { useOrganizationsStore } from '@/stores/organizations';
import { useAuthStore } from '@/stores/auth';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import type { GlobalPlayer } from '@/types';

const playersStore = usePlayersStore();
const orgStore = useOrganizationsStore();
const authStore = useAuthStore();

const search = ref('');

const { execute, loading } = useAsyncOperation();

function load() {
  return execute(async () => {
    const activeOrgId = authStore.currentUser?.activeOrgId;
    if (activeOrgId) {
      // Fetch org tournaments first (needed to get tournament IDs)
      await orgStore.fetchOrgTournaments(activeOrgId);
      const tournamentIds = orgStore.orgTournaments.map((t) => t.id);
      await playersStore.fetchOrgPlayers(tournamentIds);
    } else {
      // Admin with no activeOrgId: show all global players
      await playersStore.fetchPlayers();
    }
  });
}

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
```

- [ ] **Step 2: Run type-check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/features/players/views/PlayersListView.vue
git commit -m "fix: org-scoped players list + fix useAsyncOperation usage"
```

---

## Chunk 3: Public player search

### Task 5: Create `PlayerSearchView.vue`

A public page at `/find` that lets anyone search the global player registry by name or email. No auth required. Dark header + stats bar matching the app's existing design language.

**Files:**
- Create: `src/features/public/views/PlayerSearchView.vue`

- [ ] **Step 1: Create `src/features/public/views/PlayerSearchView.vue`**

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { usePlayersStore } from '@/stores/players';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import type { GlobalPlayer } from '@/types';

const playersStore = usePlayersStore();
const search = ref('');

const { execute, loading } = useAsyncOperation();

onMounted(() => execute(() => playersStore.fetchPlayers()));

const filteredPlayers = computed((): GlobalPlayer[] => {
  const q = search.value.trim().toLowerCase();
  if (!q) return playersStore.players;
  return playersStore.players.filter(
    (p) =>
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
  );
});

const initials = (p: GlobalPlayer) =>
  `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
</script>

<template>
  <!-- Dark header -->
  <div style="background:#0F172A;padding:24px 24px 0;">
    <div class="d-flex align-center ga-3 mb-4">
      <div
        style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#1D4ED8,#D97706);
               display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;"
      >
        <v-icon size="22">mdi-account-search</v-icon>
      </div>
      <div>
        <div style="font-size:18px;font-weight:800;color:white;">Find a Player</div>
        <div style="font-size:12px;color:#64748b;">Search the global player registry</div>
      </div>
    </div>
    <!-- Stats bar -->
    <div style="background:#1E293B;border-radius:10px 10px 0 0;display:grid;grid-template-columns:repeat(3,1fr);">
      <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
        <div style="font-size:22px;font-weight:800;color:#F59E0B;">{{ playersStore.players.length }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Total</div>
      </div>
      <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
        <div style="font-size:22px;font-weight:800;color:#F59E0B;">{{ playersStore.players.filter(p => p.isActive).length }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Active</div>
      </div>
      <div style="padding:12px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#F59E0B;">{{ filteredPlayers.length }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Matching</div>
      </div>
    </div>
  </div>

  <v-container class="pa-4">
    <v-text-field
      v-model="search"
      prepend-inner-icon="mdi-magnify"
      placeholder="Search by name or email..."
      clearable
      variant="outlined"
      class="mb-4"
    />

    <v-progress-circular v-if="loading" indeterminate color="primary" class="d-block mx-auto my-8" />

    <div v-else-if="filteredPlayers.length === 0 && search" class="text-center py-8 text-medium-emphasis">
      No players matching "{{ search }}".
    </div>

    <div v-else-if="filteredPlayers.length === 0" class="text-center py-8 text-medium-emphasis">
      No players registered yet.
    </div>

    <template v-else>
      <div
        v-for="player in filteredPlayers"
        :key="player.id"
        style="background:white;border-left:3px solid #1D4ED8;border-radius:0 8px 8px 0;
               padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;
               justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.05);"
      >
        <div class="d-flex align-center ga-3">
          <div
            style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#1D4ED8,#D97706);
                   display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0;"
          >
            {{ initials(player) }}
          </div>
          <div>
            <div style="font-size:14px;font-weight:600;color:#0F172A;">
              {{ player.firstName }} {{ player.lastName }}
              <v-icon v-if="player.isVerified" size="14" color="success" class="ml-1">mdi-check-circle</v-icon>
            </div>
            <div style="font-size:12px;color:#64748b;">{{ player.skillLevel ? `Skill: ${player.skillLevel}` : 'Player' }}</div>
          </div>
        </div>
        <v-chip size="small" :color="player.isActive ? 'success' : 'default'" label>
          {{ player.isActive ? 'Active' : 'Inactive' }}
        </v-chip>
      </div>
    </template>
  </v-container>
</template>
```

- [ ] **Step 2: Run type-check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/features/public/views/PlayerSearchView.vue
git commit -m "feat: add public PlayerSearchView at /find"
```

---

### Task 6: Register `/find` route in router

Add the `/find` route before the `/:orgSlug` wildcard route, with `requiresAuth: false`. Also add a "Find Players" link in the public site navigation header.

**Files:**
- Modify: `src/router/index.ts`

- [ ] **Step 1: Add lazy import for `PlayerSearchView`**

Near the top of `src/router/index.ts` where other public view imports are defined, add:

```typescript
const PlayerSearchView = () => import('@/features/public/views/PlayerSearchView.vue');
```

- [ ] **Step 2: Add the `/find` route**

Insert before the `/:orgSlug` route (around line 460):

```typescript
{
  path: '/find',
  name: 'player-search',
  component: PlayerSearchView,
  meta: { requiresAuth: false },
},
```

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/router/index.ts
git commit -m "feat: add /find route for public player search"
```

---

### Task 7: Add "Find Players" link to public site navigation

The public `HomeView` (marketing site) and the `OrgPublicHomeView` should link to `/find` so public visitors can discover the player search.

**Files:**
- Modify: `src/features/public/views/OrgPublicHomeView.vue` (add a "Find Players" button in the stats/action area)

- [ ] **Step 1: Add a "Find Players" link in `OrgPublicHomeView.vue`**

Find the section in `OrgPublicHomeView.vue` where tournament sections end (after the last tournament section, before the footer). Add:

```html
<!-- Find Players CTA -->
<div style="text-align:center;padding:24px 0 8px;">
  <v-btn
    to="/find"
    variant="outlined"
    color="primary"
    prepend-icon="mdi-account-search"
    size="small"
  >
    Search All Players
  </v-btn>
</div>
```

- [ ] **Step 2: Run type-check**

```bash
npm run type-check
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/features/public/views/OrgPublicHomeView.vue
git commit -m "feat: add Search All Players link to org public page"
```

---

## Final verification

- [ ] Log in as `tnf-organizer@courtmastr.com` / `tnf123` → `/players` shows only TNF tournament players
- [ ] Log in as `admin@courtmastr.com` / `admin123` → `/players` shows all 131 global players
- [ ] Log in as `tnf-organizer@courtmastr.com` → `/org/profile` shows TNF organization details
- [ ] Navigate to `/find` without logging in → player search works
- [ ] Navigate to `/tnf` public page → see "Search All Players" button → click → `/find` loads
