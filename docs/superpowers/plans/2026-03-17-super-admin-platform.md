# Super Admin Platform Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a platform-level super admin experience — dashboard, all-org list, and impersonation mode — for users with `role: 'admin'`.

**Architecture:** Add `isSuperAdmin` computed to auth store. New `superAdmin` Pinia store owns impersonation state (`viewingOrgId`, `viewingOrg`) and sets `organizationsStore.currentOrg` directly when entering/exiting an org. New `/super/dashboard` and `/super/orgs` routes guarded by existing `requiresWebAdmin` meta. A `SuperAdminBanner` component floats at the top of `AppLayout` when impersonating on non-super routes.

**Tech Stack:** Vue 3, Pinia, Vuetify 3, Firebase Firestore, TypeScript, Vue Router 4

---

## File Map

**Create:**
- `src/stores/superAdmin.ts` — impersonation state, platform stats, suspendOrg/unsuspendOrg
- `src/features/super/views/SuperDashboardView.vue` — platform health dashboard
- `src/features/super/views/SuperOrgListView.vue` — all orgs table with Enter button
- `src/components/layout/SuperAdminBanner.vue` — persistent purple banner during impersonation
- `src/composables/useOrgAccess.ts` — `canEdit` = isSuperAdmin || isOrgMemberAdmin

**Modify:**
- `src/types/index.ts` — add `suspended?`, `suspendedAt?`, `suspendedBy?` to `Organization` interface
- `src/types/router-meta.d.ts` — add `requiresWebAdmin?: boolean` to `RouteMeta`
- `src/stores/auth.ts` — add `isSuperAdmin` computed + return it
- `src/stores/organizations.ts` — add `currentOrgMembers` ref + return it
- `src/router/index.ts` — add `/super/dashboard` and `/super/orgs` routes
- `src/components/navigation/AppNavigation.vue` — add "Platform Admin" nav item
- `src/components/layout/AppLayout.vue` — render `SuperAdminBanner`

---

## Task 1: Foundation — Types and Auth Store

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/types/router-meta.d.ts`
- Modify: `src/stores/auth.ts`

- [ ] **Step 1.1: Add suspended fields to Organization interface**

In `src/types/index.ts`, find the `Organization` interface and add three optional fields. Look for the interface that has `id`, `name`, `slug`, etc.:

```ts
// Add these three fields to the Organization interface
suspended?: boolean
suspendedAt?: Date
suspendedBy?: string
```

- [ ] **Step 1.2: Add requiresWebAdmin to RouteMeta**

In `src/types/router-meta.d.ts`, add `requiresWebAdmin?: boolean` to the `RouteMeta` interface:

```ts
// Add inside the RouteMeta interface block
requiresWebAdmin?: boolean;
```

- [ ] **Step 1.3: Add isSuperAdmin to auth store**

In `src/stores/auth.ts`, add after the existing `isAdmin` computed (line ~31):

```ts
const isSuperAdmin = computed(() => currentUser.value?.role === 'admin');
```

Then add `isSuperAdmin` to the return statement (around line 300):

```ts
return {
  // ... existing values
  isSuperAdmin,
  // ... rest of existing values
};
```

- [ ] **Step 1.4: Verify TypeScript compiles**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2 && npx vue-tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 1.5: Commit**

```bash
git add src/types/index.ts src/types/router-meta.d.ts src/stores/auth.ts
git commit -m "feat: add isSuperAdmin computed and Organization suspended fields"
```

---

## Task 2: Organizations Store — currentOrgMembers

**Files:**
- Modify: `src/stores/organizations.ts`

- [ ] **Step 2.1: Add currentOrgMembers ref**

In `src/stores/organizations.ts`, add after the existing `orgTournaments` ref (around line 26):

```ts
const currentOrgMembers = ref<OrganizationMember[]>([]);
```

Then add to the return object (at the bottom of the store, around line 199):

```ts
return {
  myOrgs,
  currentOrg,
  currentOrgMembers,   // ADD THIS
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
  addOrgMember,
};
```

- [ ] **Step 2.2: Verify TypeScript compiles**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2 && npx vue-tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 2.3: Commit**

```bash
git add src/stores/organizations.ts
git commit -m "feat: add currentOrgMembers ref to organizations store"
```

---

## Task 3: superAdmin Store

**Files:**
- Create: `src/stores/superAdmin.ts`

- [ ] **Step 3.1: Create the superAdmin store**

Create `src/stores/superAdmin.ts` with the full store:

```ts
// Super Admin Store — platform-level org browsing and impersonation
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { deleteField } from 'firebase/firestore';
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';
import type { Organization } from '@/types';
import { useAuthStore } from '@/stores/auth';
import { useOrganizationsStore } from '@/stores/organizations';
import { useRouter } from 'vue-router';

interface PlatformStats {
  totalOrgs: number
  activeTournaments: number
  totalPlayers: number
  newOrgsLast30Days: number
}

export const useSuperAdminStore = defineStore('superAdmin', () => {
  const allOrgs = ref<Organization[]>([]);
  const viewingOrgId = ref<string | null>(null);
  const viewingOrg = ref<Organization | null>(null);
  const platformStats = ref<PlatformStats | null>(null);
  const loading = ref(false);

  const isImpersonating = computed(() => viewingOrgId.value !== null);

  async function fetchAllOrgs(): Promise<void> {
    loading.value = true;
    try {
      const snap = await getDocs(collection(db, 'organizations'));
      allOrgs.value = snap.docs.map(
        (d) => convertTimestamps({ id: d.id, ...d.data() }) as Organization
      );
    } finally {
      loading.value = false;
    }
  }

  async function fetchPlatformStats(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [orgsSnap, activeTournamentsSnap, playersSnap, newOrgsSnap] = await Promise.all([
      getDocs(collection(db, 'organizations')),
      getDocs(query(collection(db, 'tournaments'), where('status', '==', 'active'))),
      getDocs(collection(db, 'players')),
      getDocs(query(
        collection(db, 'organizations'),
        where('createdAt', '>=', thirtyDaysAgo)
      )),
    ]);

    platformStats.value = {
      totalOrgs: orgsSnap.size,
      activeTournaments: activeTournamentsSnap.size,
      totalPlayers: playersSnap.size,
      newOrgsLast30Days: newOrgsSnap.size,
    };
  }

  async function enterOrg(orgId: string): Promise<void> {
    const router = useRouter();
    const orgsStore = useOrganizationsStore();
    const snap = await getDoc(doc(db, 'organizations', orgId));
    if (!snap.exists()) return;
    viewingOrgId.value = orgId;
    viewingOrg.value = convertTimestamps({ id: snap.id, ...snap.data() }) as Organization;
    orgsStore.currentOrg = viewingOrg.value;
    orgsStore.currentOrgMembers = await orgsStore.fetchOrgMembers(orgId);
    router.push('/tournaments');
  }

  function exitOrg(): void {
    const router = useRouter();
    const orgsStore = useOrganizationsStore();
    const authStore = useAuthStore();
    viewingOrgId.value = null;
    viewingOrg.value = null;
    const activeId = authStore.currentUser?.activeOrgId;
    orgsStore.currentOrg = activeId
      ? orgsStore.myOrgs.find((o) => o.id === activeId) ?? null
      : null;
    orgsStore.currentOrgMembers = [];
    router.push('/super/orgs');
  }

  async function suspendOrg(orgId: string): Promise<void> {
    const authStore = useAuthStore();
    await updateDoc(doc(db, 'organizations', orgId), {
      suspended: true,
      suspendedAt: serverTimestamp(),
      suspendedBy: authStore.currentUser!.id,
    });
    // Update in-place
    const update = { suspended: true, suspendedBy: authStore.currentUser!.id };
    if (viewingOrg.value?.id === orgId) {
      viewingOrg.value = { ...viewingOrg.value, ...update };
    }
    const idx = allOrgs.value.findIndex((o) => o.id === orgId);
    if (idx !== -1) allOrgs.value[idx] = { ...allOrgs.value[idx], ...update };
  }

  async function unsuspendOrg(orgId: string): Promise<void> {
    await updateDoc(doc(db, 'organizations', orgId), {
      suspended: false,
      suspendedAt: deleteField(),
      suspendedBy: deleteField(),
    });
    // Update in-place
    if (viewingOrg.value?.id === orgId) {
      const { suspendedAt: _a, suspendedBy: _b, ...rest } = viewingOrg.value;
      viewingOrg.value = { ...rest, suspended: false };
    }
    const idx = allOrgs.value.findIndex((o) => o.id === orgId);
    if (idx !== -1) {
      const { suspendedAt: _a, suspendedBy: _b, ...rest } = allOrgs.value[idx];
      allOrgs.value[idx] = { ...rest, suspended: false };
    }
  }

  return {
    allOrgs,
    viewingOrgId,
    viewingOrg,
    platformStats,
    loading,
    isImpersonating,
    fetchAllOrgs,
    fetchPlatformStats,
    enterOrg,
    exitOrg,
    suspendOrg,
    unsuspendOrg,
  };
});
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2 && npx vue-tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to superAdmin.ts.

- [ ] **Step 3.3: Commit**

```bash
git add src/stores/superAdmin.ts
git commit -m "feat: add superAdmin store with impersonation and platform stats"
```

---

## Task 4: useOrgAccess Composable

**Files:**
- Create: `src/composables/useOrgAccess.ts`

- [ ] **Step 4.1: Create the composable**

```ts
// useOrgAccess — unified edit permission check for org admin or super admin
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useOrganizationsStore } from '@/stores/organizations';

export function useOrgAccess() {
  const authStore = useAuthStore();
  const orgsStore = useOrganizationsStore();

  // Whether the currently logged-in user is an admin-role member of the current org.
  // uid is read inside computed so it stays reactive if auth resolves after composable setup.
  // When currentOrgMembers is loaded (impersonation flow), checks the members list.
  // When empty (normal non-impersonation flow), falls back to the global isAdmin role check.
  const isOrgMemberAdmin = computed(() => {
    const uid = authStore.currentUser?.id;
    if (!uid) return false;
    if (orgsStore.currentOrgMembers.length > 0) {
      return orgsStore.currentOrgMembers.some((m) => m.uid === uid && m.role === 'admin');
    }
    // Fallback: global role (admin or organizer) — preserves existing non-impersonation behavior
    return authStore.isAdmin;
  });

  // Super admin OR org member admin — use this for all edit/write permission gates
  const canEdit = computed(() => authStore.isSuperAdmin || isOrgMemberAdmin.value);

  return { canEdit, isOrgMemberAdmin };
}
```

- [ ] **Step 4.2: Verify TypeScript compiles**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2 && npx vue-tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4.3: Commit**

```bash
git add src/composables/useOrgAccess.ts
git commit -m "feat: add useOrgAccess composable with canEdit check"
```

---

## Task 5: Routes

**Files:**
- Modify: `src/router/index.ts`

- [ ] **Step 5.1: Add lazy-loaded view imports**

At the top of `src/router/index.ts`, after the existing admin view imports (around line 28–30), add:

```ts
// Super admin views
const SuperDashboard = () => import('@/features/super/views/SuperDashboardView.vue');
const SuperOrgList = () => import('@/features/super/views/SuperOrgListView.vue');
```

- [ ] **Step 5.2: Add routes**

In the routes array, after the `admin-reviews` route (around line 373), add:

```ts
// Super admin routes
{
  path: '/super/dashboard',
  name: 'super-dashboard',
  component: SuperDashboard,
  meta: { requiresAuth: true, requiresWebAdmin: true },
},
{
  path: '/super/orgs',
  name: 'super-orgs',
  component: SuperOrgList,
  meta: { requiresAuth: true, requiresWebAdmin: true },
},
```

- [ ] **Step 5.3: Verify TypeScript compiles**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2 && npx vue-tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5.4: Commit**

```bash
git add src/router/index.ts
git commit -m "feat: add /super/dashboard and /super/orgs routes"
```

---

## Task 6: SuperAdminBanner Component

**Files:**
- Create: `src/components/layout/SuperAdminBanner.vue`
- Modify: `src/components/layout/AppLayout.vue`

- [ ] **Step 6.1: Create SuperAdminBanner.vue**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useSuperAdminStore } from '@/stores/superAdmin';
import { useNotificationStore } from '@/stores/notifications';

const route = useRoute();
const superAdminStore = useSuperAdminStore();
const notificationStore = useNotificationStore();

const showBanner = computed(() =>
  superAdminStore.isImpersonating && !route.path.startsWith('/super')
);

const org = computed(() => superAdminStore.viewingOrg);
const isSuspended = computed(() => org.value?.suspended === true);

const suspendDialog = ref(false);
const suspending = ref(false);

async function handleSuspend(): Promise<void> {
  if (!org.value) return;
  suspending.value = true;
  try {
    await superAdminStore.suspendOrg(org.value.id);
    notificationStore.showToast('success', 'Organization suspended');
  } catch {
    notificationStore.showToast('error', 'Failed to suspend organization');
  } finally {
    suspending.value = false;
    suspendDialog.value = false;
  }
}

async function handleUnsuspend(): Promise<void> {
  if (!org.value) return;
  try {
    await superAdminStore.unsuspendOrg(org.value.id);
    notificationStore.showToast('success', 'Organization unsuspended');
  } catch {
    notificationStore.showToast('error', 'Failed to unsuspend organization');
  }
}
</script>

<template>
  <div v-if="showBanner" class="super-admin-banner">
    <div class="super-admin-banner__content">
      <v-icon icon="mdi-shield-account" class="mr-2" size="small" />
      <span class="super-admin-banner__label">Super Admin Mode</span>
      <span class="super-admin-banner__separator mx-2">—</span>
      <span class="super-admin-banner__org">Viewing: <strong>{{ org?.name }}</strong></span>
      <v-chip
        v-if="isSuspended"
        color="error"
        size="x-small"
        class="ml-2"
        label
      >
        Suspended
      </v-chip>
    </div>

    <div class="super-admin-banner__actions">
      <v-btn
        v-if="!isSuspended"
        size="small"
        variant="outlined"
        color="white"
        class="mr-2"
        @click="suspendDialog = true"
      >
        Suspend Org
      </v-btn>
      <v-btn
        v-else
        size="small"
        variant="outlined"
        color="white"
        class="mr-2"
        @click="handleUnsuspend"
      >
        Unsuspend Org
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        color="white"
        prepend-icon="mdi-arrow-left"
        @click="superAdminStore.exitOrg()"
      >
        Exit to Admin
      </v-btn>
    </div>

    <!-- Suspend confirmation dialog -->
    <v-dialog v-model="suspendDialog" max-width="400">
      <v-card>
        <v-card-title>Suspend Organization?</v-card-title>
        <v-card-text>
          This will mark <strong>{{ org?.name }}</strong> as suspended.
          Their data is preserved and this can be reversed.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="suspendDialog = false">Cancel</v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="suspending"
            @click="handleSuspend"
          >
            Suspend
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.super-admin-banner {
  background-color: #7b1fa2;
  color: white;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  position: sticky;
  top: 0;
  z-index: 1000;
}

.super-admin-banner__content {
  display: flex;
  align-items: center;
}

.super-admin-banner__label {
  font-weight: 600;
}

.super-admin-banner__actions {
  display: flex;
  align-items: center;
}
</style>
```

- [ ] **Step 6.2: Add SuperAdminBanner to AppLayout**

In `src/components/layout/AppLayout.vue`, import the banner in the `<script setup>` block:

```ts
import SuperAdminBanner from '@/components/layout/SuperAdminBanner.vue';
```

Then in the template, find `<v-main` (NOT `<v-app>` — AppLayout.vue uses `<v-layout>` as root). Add `<SuperAdminBanner />` as the FIRST child inside `<v-main>`, before `<v-container>`:

```html
<!-- AppLayout.vue: inside <v-main id="main-content" class="app-main"> -->
<v-main id="main-content" class="app-main">
  <SuperAdminBanner />  <!-- ADD HERE — first child of v-main -->
  <v-container fluid class="app-main__content">
```

- [ ] **Step 6.3: Verify TypeScript compiles**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2 && npx vue-tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6.4: Commit**

```bash
git add src/components/layout/SuperAdminBanner.vue src/components/layout/AppLayout.vue
git commit -m "feat: add SuperAdminBanner component to AppLayout"
```

---

## Task 7: AppNavigation — Platform Admin Link

**Files:**
- Modify: `src/components/navigation/AppNavigation.vue`

- [ ] **Step 7.1: Update AppNavigation to use isSuperAdmin and add Platform Admin link**

In `src/components/navigation/AppNavigation.vue` in the `<script setup>` section (around line 385), the existing `isWebAdmin` computed is:

```ts
const isWebAdmin = computed(() => authStore.currentUser?.role === 'admin');
```

Replace it with (using `isSuperAdmin` from auth store for consistency):

```ts
const isWebAdmin = computed(() => authStore.isSuperAdmin);
```

Then in the template, find the "Review Moderation" nav item (around line 105–113):

```html
<v-list-item
  v-if="isWebAdmin"
  to="/admin/reviews"
  ...
/>
```

After that block, add the Platform Admin link with a divider:

```html
<template v-if="isWebAdmin">
  <v-divider class="my-2" />
  <v-list-item
    to="/super/dashboard"
    prepend-icon="mdi-shield-crown"
    title="Platform Admin"
    class="nav-item nav-item--super-admin"
    rounded="lg"
    :ripple="false"
  />
</template>
```

- [ ] **Step 7.2: Verify TypeScript compiles**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2 && npx vue-tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7.3: Commit**

```bash
git add src/components/navigation/AppNavigation.vue
git commit -m "feat: add Platform Admin nav item for super admin users"
```

---

## Task 8: SuperDashboardView

**Files:**
- Create: `src/features/super/views/SuperDashboardView.vue`

- [ ] **Step 8.1: Create the view directory and file**

```bash
mkdir -p /Users/ramc/Documents/Code/courtmaster-v2/src/features/super/views
```

Create `src/features/super/views/SuperDashboardView.vue`:

```vue
<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useSuperAdminStore } from '@/stores/superAdmin';

const superAdminStore = useSuperAdminStore();

const stats = computed(() => superAdminStore.platformStats);
const recentOrgs = computed(() =>
  [...superAdminStore.allOrgs]
    .sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 5)
);

const statTiles = computed(() => [
  { label: 'Total Orgs', value: stats.value?.totalOrgs ?? '—', icon: 'mdi-domain' },
  { label: 'Active Tournaments', value: stats.value?.activeTournaments ?? '—', icon: 'mdi-trophy' },
  { label: 'Total Players', value: stats.value?.totalPlayers ?? '—', icon: 'mdi-account-group' },
  { label: 'New Orgs (30d)', value: stats.value?.newOrgsLast30Days ?? '—', icon: 'mdi-domain-plus' },
]);

onMounted(async () => {
  await Promise.all([
    superAdminStore.fetchPlatformStats(),
    superAdminStore.fetchAllOrgs(),
  ]);
});
</script>

<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center mb-6">
      <v-icon icon="mdi-shield-crown" color="purple" class="mr-3" size="28" />
      <h1 class="text-h5 font-weight-bold">Platform Admin</h1>
    </div>

    <!-- Stat tiles -->
    <v-row class="mb-6">
      <v-col
        v-for="tile in statTiles"
        :key="tile.label"
        cols="12"
        sm="6"
        lg="3"
      >
        <v-card rounded="lg" variant="tonal">
          <v-card-text class="d-flex align-center pa-5">
            <v-icon :icon="tile.icon" color="purple" size="36" class="mr-4" />
            <div>
              <div class="text-h4 font-weight-bold">{{ tile.value }}</div>
              <div class="text-caption text-medium-emphasis">{{ tile.label }}</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <!-- Recent orgs -->
      <v-col cols="12" md="6">
        <v-card rounded="lg">
          <v-card-title class="text-subtitle-1 font-weight-semibold pa-4 pb-2">
            Recent Organizations
          </v-card-title>
          <v-list density="compact">
            <v-list-item
              v-for="org in recentOrgs"
              :key="org.id"
              :title="org.name"
              :subtitle="org.createdAt instanceof Date ? org.createdAt.toLocaleDateString() : ''"
            >
              <template #append>
                <v-btn
                  size="small"
                  variant="text"
                  color="purple"
                  @click="superAdminStore.enterOrg(org.id)"
                >
                  Enter →
                </v-btn>
              </template>
            </v-list-item>
            <v-list-item v-if="recentOrgs.length === 0">
              <v-list-item-title class="text-medium-emphasis">No organizations yet</v-list-item-title>
            </v-list-item>
          </v-list>
          <v-card-actions>
            <v-btn variant="text" color="purple" to="/super/orgs" size="small">
              View all orgs →
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Quick actions -->
      <v-col cols="12" md="6">
        <v-card rounded="lg">
          <v-card-title class="text-subtitle-1 font-weight-semibold pa-4 pb-2">
            Quick Actions
          </v-card-title>
          <v-card-text>
            <v-btn
              block
              variant="outlined"
              color="purple"
              prepend-icon="mdi-domain"
              to="/super/orgs"
              class="mb-3"
            >
              Browse All Organizations
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
```

- [ ] **Step 8.2: Verify TypeScript compiles**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2 && npx vue-tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 8.3: Commit**

```bash
git add src/features/super/views/SuperDashboardView.vue
git commit -m "feat: add SuperDashboardView with platform stats and recent orgs"
```

---

## Task 9: SuperOrgListView

**Files:**
- Create: `src/features/super/views/SuperOrgListView.vue`

- [ ] **Step 9.1: Create SuperOrgListView.vue**

```vue
<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useSuperAdminStore } from '@/stores/superAdmin';
import type { Organization } from '@/types';

const superAdminStore = useSuperAdminStore();

const search = ref('');
const statusFilter = ref<'all' | 'active' | 'suspended'>('all');
const enteringOrgId = ref<string | null>(null);

const filteredOrgs = computed(() => {
  return superAdminStore.allOrgs.filter((org) => {
    const matchesSearch = org.name.toLowerCase().includes(search.value.toLowerCase());
    const matchesStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'suspended' && org.suspended) ||
      (statusFilter.value === 'active' && !org.suspended);
    return matchesSearch && matchesStatus;
  });
});

function getStatusColor(org: Organization): string {
  return org.suspended ? 'error' : 'success';
}

function getStatusLabel(org: Organization): string {
  return org.suspended ? 'Suspended' : 'Active';
}

async function handleEnter(org: Organization): Promise<void> {
  enteringOrgId.value = org.id;
  await superAdminStore.enterOrg(org.id);
}

onMounted(() => {
  superAdminStore.fetchAllOrgs();
});
</script>

<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center mb-6">
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        class="mr-2"
        to="/super/dashboard"
      />
      <v-icon icon="mdi-domain" color="purple" class="mr-3" size="28" />
      <h1 class="text-h5 font-weight-bold">All Organizations</h1>
      <v-spacer />
      <v-chip color="purple" variant="tonal" size="small">
        {{ filteredOrgs.length }} orgs
      </v-chip>
    </div>

    <!-- Filters -->
    <v-row class="mb-4">
      <v-col cols="12" sm="8">
        <v-text-field
          v-model="search"
          placeholder="Search organizations..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-select
          v-model="statusFilter"
          :items="[
            { title: 'All statuses', value: 'all' },
            { title: 'Active', value: 'active' },
            { title: 'Suspended', value: 'suspended' },
          ]"
          variant="outlined"
          density="compact"
          hide-details
        />
      </v-col>
    </v-row>

    <!-- Loading -->
    <div v-if="superAdminStore.loading" class="text-center py-8">
      <v-progress-circular indeterminate color="purple" />
    </div>

    <!-- Table -->
    <v-card v-else rounded="lg">
      <v-table>
        <thead>
          <tr>
            <th>Organization</th>
            <th>Status</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="org in filteredOrgs" :key="org.id">
            <td>
              <div class="font-weight-medium">{{ org.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ org.slug }}</div>
            </td>
            <td>
              <v-chip
                :color="getStatusColor(org)"
                size="small"
                label
              >
                {{ getStatusLabel(org) }}
              </v-chip>
            </td>
            <td class="text-medium-emphasis text-caption">
              {{ org.createdAt instanceof Date ? org.createdAt.toLocaleDateString() : '—' }}
            </td>
            <td>
              <v-btn
                size="small"
                variant="flat"
                color="purple"
                :loading="enteringOrgId === org.id"
                append-icon="mdi-arrow-right"
                @click="handleEnter(org)"
              >
                Enter
              </v-btn>
            </td>
          </tr>
          <tr v-if="filteredOrgs.length === 0">
            <td colspan="4" class="text-center text-medium-emphasis py-6">
              No organizations found
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </v-container>
</template>
```

- [ ] **Step 9.2: Verify TypeScript compiles**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2 && npx vue-tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 9.3: Commit**

```bash
git add src/features/super/views/SuperOrgListView.vue
git commit -m "feat: add SuperOrgListView with search, filter, and enter button"
```

---

## Task 10: End-to-End Verification

- [ ] **Step 10.1: Start the dev server**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2 && npm run dev
```

- [ ] **Step 10.2: Manual verification checklist**

Open http://localhost:3000 and log in with `admin@courtmastr.com` / `admin123`.

Check each item:
- [ ] "Platform Admin" nav item appears in sidebar with shield-crown icon, below a divider
- [ ] Clicking "Platform Admin" navigates to `/super/dashboard`
- [ ] Dashboard shows 4 stat tiles (Total Orgs, Active Tournaments, Total Players, New Orgs 30d)
- [ ] Dashboard shows Recent Organizations list
- [ ] Clicking "View all orgs →" navigates to `/super/orgs`
- [ ] `/super/orgs` shows a table of all organizations with search and filter
- [ ] Clicking "Enter →" on an org navigates to `/tournaments` and shows the purple SuperAdminBanner
- [ ] Banner shows the org name and "Exit to Admin" button
- [ ] Clicking "Exit to Admin" clears impersonation and returns to `/super/orgs`
- [ ] Clicking "Suspend Org" shows confirmation dialog; confirming suspends the org
- [ ] Suspended org shows "Suspended" chip in the banner and in org list
- [ ] Logging in as a non-admin user (e.g. `scorekeeper@courtmastr.com`) does NOT see "Platform Admin" nav item
- [ ] Navigating directly to `/super/dashboard` as non-admin redirects to home/dashboard

- [ ] **Step 10.3: Final full TypeScript check**

```bash
cd /Users/ramc/Documents/Code/courtmaster-v2 && npx vue-tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 10.4: Final commit**

```bash
git add -A
git commit -m "feat: complete super admin platform — dashboard, org list, impersonation"
```
