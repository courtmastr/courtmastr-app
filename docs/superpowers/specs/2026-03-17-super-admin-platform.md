# Super Admin Platform — Design Spec

**Date:** 2026-03-17
**Status:** Approved

---

## Overview

Add a platform-level super admin experience for the founder/ops team. A user with `role: 'admin'` can access a dedicated `/super/` area showing a platform health dashboard, browse all organizations, and enter any org in impersonation mode — seeing that org's full admin UI with a persistent banner and limited write access.

---

## Role System

No changes to `UserRole`. The existing `admin` value already represents the platform-level super admin.

```ts
// Unchanged
type UserRole = 'admin' | 'organizer' | 'scorekeeper' | 'player' | 'viewer'

// OrgMemberRole is completely separate — also unchanged
type OrgMemberRole = 'admin' | 'organizer'  // per-org, in members subcollection
```

**Existing computeds in `src/stores/auth.ts` are unchanged:**
- `isAdmin` = `role === 'admin' || role === 'organizer'` — org-level access, stays as-is
- `isOrganizer`, `isScorekeeper` — unchanged

**Add one new computed** (platform-level only — `admin` role exclusively, does NOT include `organizer`):

```ts
const isSuperAdmin = computed(() => currentUser.value?.role === 'admin')

// Add to the store's return object:
return {
  // ... existing values ...
  isSuperAdmin,
}
```

This is distinct from `isAdmin` because `isAdmin` returns `true` for both `admin` and `organizer`.

---

## Firestore Rules

**No changes required.** The existing rules already cover all super admin operations via the existing `isAdmin()` function (which checks `role == 'admin'`):

```
// Existing — no edits needed
match /organizations/{orgId} {
  allow read: if true;
  allow create: if isAdmin();
  allow update: if isAdmin() || isOrgMember(orgId);  // covers suspendOrg writes
  allow delete: if isAdmin();

  match /members/{uid} {
    allow read: if isAuthenticated();
    allow write: if isAdmin() || isOrgAdmin(orgId);
  }
}
```

Note: `unsuspendOrg` uses `deleteField()` to clear `suspendedAt`/`suspendedBy` — calling `deleteField()` on a non-existent field is a no-op in Firestore; safe.

---

## Firestore Schema Change

Add three optional fields to `organizations/{orgId}` documents and to the `Organization` interface in `src/types/index.ts`:

```ts
// Add to Organization interface
suspended?: boolean      // absent or false = active
suspendedAt?: Date
suspendedBy?: string     // uid of the admin who suspended
```

`src/types/index.ts` is in Files to Modify.

---

## Organizations Store Changes (`src/stores/organizations.ts`)

Add a `currentOrgMembers` reactive ref and expose it in the store's return object:

```ts
const currentOrgMembers = ref<OrganizationMember[]>([])

// Add to return object:
return {
  // ... existing values ...
  currentOrgMembers,
}
```

**Do not populate `currentOrgMembers` inside `fetchOrgById`.** It is populated only by the `superAdmin` store's `enterOrg` action and cleared by `exitOrg`. This avoids unintended Firestore reads for unrelated callers of `fetchOrgById`.

---

## New Store: `src/stores/superAdmin.ts`

**Imports note:** `deleteField` is not re-exported from `@/services/firebase`. Import it directly:
```ts
import { deleteField } from 'firebase/firestore'
import { db, collection, doc, getDoc, getDocs, updateDoc, serverTimestamp } from '@/services/firebase'
```

**Types (local to this file):**
```ts
interface PlatformStats {
  totalOrgs: number
  activeTournaments: number
  totalPlayers: number
  newOrgsLast30Days: number
}
```

**State:**
```ts
const allOrgs = ref<Organization[]>([])
const viewingOrgId = ref<string | null>(null)
const viewingOrg = ref<Organization | null>(null)
const platformStats = ref<PlatformStats | null>(null)
```

**Computed:**
```ts
const isImpersonating = computed(() => viewingOrgId.value !== null)
```

**Actions:**

```ts
async function fetchAllOrgs(): Promise<void> {
  const snap = await getDocs(collection(db, 'organizations'))
  allOrgs.value = snap.docs.map(d => convertTimestamps({ id: d.id, ...d.data() }) as Organization)
}

async function fetchPlatformStats(): Promise<void> {
  // Parallel getDocs queries: count orgs, tournaments with status='active', players,
  // orgs with createdAt > (now - 30d)
  // Assign to platformStats.value
}

async function enterOrg(orgId: string): Promise<void> {
  const orgsStore = useOrganizationsStore()
  const snap = await getDoc(doc(db, 'organizations', orgId))
  if (!snap.exists()) return
  viewingOrgId.value = orgId
  viewingOrg.value = convertTimestamps({ id: snap.id, ...snap.data() }) as Organization
  orgsStore.currentOrg = viewingOrg.value
  orgsStore.currentOrgMembers = await orgsStore.fetchOrgMembers(orgId)
  router.push('/tournaments')
}

function exitOrg(): void {
  const orgsStore = useOrganizationsStore()
  const authStore = useAuthStore()
  viewingOrgId.value = null
  viewingOrg.value = null
  const activeId = authStore.currentUser?.activeOrgId
  orgsStore.currentOrg = activeId
    ? orgsStore.myOrgs.find(o => o.id === activeId) ?? null
    : null
  orgsStore.currentOrgMembers = []
  router.push('/super/orgs')
}

async function suspendOrg(orgId: string): Promise<void> {
  const authStore = useAuthStore()  // declare inline, same pattern as exitOrg
  await updateDoc(doc(db, 'organizations', orgId), {
    suspended: true,
    suspendedAt: serverTimestamp(),
    suspendedBy: authStore.currentUser!.id,
  })
  // Update viewingOrg.value and matching entry in allOrgs in-place
}

async function unsuspendOrg(orgId: string): Promise<void> {
  await updateDoc(doc(db, 'organizations', orgId), {
    suspended: false,
    suspendedAt: deleteField(),  // imported directly from 'firebase/firestore'
    suspendedBy: deleteField(),
  })
  // Update viewingOrg.value and matching entry in allOrgs in-place
}

return {
  allOrgs, viewingOrgId, viewingOrg, platformStats, isImpersonating,
  fetchAllOrgs, fetchPlatformStats, enterOrg, exitOrg, suspendOrg, unsuspendOrg,
}
```

---

## Routes (`/super/` namespace)

Use the **existing `requiresWebAdmin: true` meta key** on `/super/` routes — it already gates on `role === 'admin'` in the existing `beforeEach` guard (line 568 of `router/index.ts`). No new meta key needed, but `requiresWebAdmin?: boolean` must be added to the `RouteMeta` interface in `src/types/router-meta.d.ts` (it is used at runtime but not yet declared there).

```ts
{ path: '/super/dashboard', name: 'super-dashboard', component: SuperDashboardView, meta: { requiresAuth: true, requiresWebAdmin: true } },
{ path: '/super/orgs',      name: 'super-orgs',      component: SuperOrgListView,  meta: { requiresAuth: true, requiresWebAdmin: true } },
```

**There is no `/super/orgs/:orgId` route.** Impersonation is triggered directly by the Enter button in `SuperOrgListView` calling `superAdminStore.enterOrg(org.id)`. The action handles navigation to `/tournaments`.

---

## New Screens

### `/super/dashboard` — `SuperDashboardView.vue`

- Calls `superAdminStore.fetchPlatformStats()` and `superAdminStore.fetchAllOrgs()` on mount
- **4 stat tiles:** Total Orgs, Active Tournaments, Total Players, New Orgs (30d) — from `platformStats`
- **Recent Orgs panel:** last 5 from `allOrgs` sorted by `createdAt` desc; each row has an Enter button
- **Live Tournaments panel:** query for tournaments with `status === 'active'` across all orgs

### `/super/orgs` — `SuperOrgListView.vue`

- Calls `superAdminStore.fetchAllOrgs()` on mount
- Searchable by org name, filterable by status (active / suspended)
- Columns: Org Name, Members, Tournaments, Status chip, Created date, Enter button
- "Enter →" button calls `superAdminStore.enterOrg(org.id)` — action navigates to `/tournaments`

### `SuperAdminBanner.vue`

Persistent banner rendered in `AppLayout` when impersonating and NOT on `/super/` routes:

```ts
const showBanner = computed(() =>
  superAdminStore.isImpersonating && !route.path.startsWith('/super')
)
```

Placed at the very top of the authenticated layout, above nav and content. Renders on all regular org routes (e.g. `/tournaments`, `/settings`) during impersonation.

```
🔐 Super Admin Mode — Viewing: {orgName}   [Suspend Org]   [← Exit to Admin]
```

- Background: `#7b1fa2` (purple), white text
- "Exit to Admin" calls `superAdminStore.exitOrg()`
- Toggle between "Suspend Org" and "Unsuspend Org" based on `viewingOrg.suspended`
- Suspend shows a `v-dialog` confirmation before calling `suspendOrg()`

---

## `useOrgAccess` Composable (`src/composables/useOrgAccess.ts`)

```ts
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationsStore } from '@/stores/organizations'

export function useOrgAccess() {
  const authStore = useAuthStore()
  const orgsStore = useOrganizationsStore()

  // Whether the currently logged-in user is an admin-role member of the current org.
  // uid is read inside computed so it stays reactive if auth resolves after composable setup.
  const isOrgMemberAdmin = computed(() => {
    const uid = authStore.currentUser?.id  // read inside computed — reactive
    if (!uid) return false
    return orgsStore.currentOrgMembers.some(m => m.uid === uid && m.role === 'admin')
  })

  // Super admin OR org member admin — use this for all edit/write permission gates
  const canEdit = computed(() => authStore.isSuperAdmin || isOrgMemberAdmin.value)

  return { canEdit, isOrgMemberAdmin }
}
```

Replace existing `isOrgAdmin` / ownership checks in views with `canEdit` from this composable.

### Write actions available while impersonating

| Action | Where | Notes |
|---|---|---|
| Fix org/tournament settings | Existing settings views | `canEdit` replaces ownership check |
| Manage members | `OrgProfileView` | `canEdit` replaces `isOrgAdmin` check |
| Fix player/registration data | Participants / Registration views | `canEdit` replaces ownership check |
| Override tournament status | `TournamentSettingsView` | Super-admin-only "Force Status" `v-select`, shown when `authStore.isSuperAdmin` |
| Suspend / unsuspend org | Impersonation banner | `v-dialog` confirmation before action |
| Delete data | Any list view | Delete actions visible when `authStore.isSuperAdmin` |

---

## Navigation Entry Point

`AppNavigation.vue` — when `authStore.isSuperAdmin` is true, show a **"Platform Admin"** nav item (shield icon) linking to `/super/dashboard`. Placed below the org list, separated by a `v-divider`.

---

## Files to Create

| File | Purpose |
|---|---|
| `src/stores/superAdmin.ts` | Impersonation state, platform stats, org actions |
| `src/features/super/views/SuperDashboardView.vue` | Platform health dashboard |
| `src/features/super/views/SuperOrgListView.vue` | All orgs table |
| `src/components/layout/SuperAdminBanner.vue` | Persistent impersonation banner |
| `src/composables/useOrgAccess.ts` | Unified `canEdit` check |

## Files to Modify

| File | Change |
|---|---|
| `src/types/index.ts` | Add `suspended?`, `suspendedAt?`, `suspendedBy?` to `Organization` interface |
| `src/stores/auth.ts` | Add `isSuperAdmin` computed; add to return object |
| `src/stores/organizations.ts` | Add `currentOrgMembers` ref; expose the raw `ref` (not readonly) in return object |
| `src/types/router-meta.d.ts` | Add `requiresWebAdmin?: boolean` to `RouteMeta` interface |
| `src/router/index.ts` | Add `/super/dashboard` and `/super/orgs` routes with `requiresWebAdmin: true` |
| `src/components/navigation/AppNavigation.vue` | Add "Platform Admin" nav item for `isSuperAdmin` users |
| `src/components/layout/AppLayout.vue` | Render `SuperAdminBanner` using `showBanner` computed |

---

## Out of Scope (this iteration)

- UI to promote/demote users to `admin` role (done manually in Firestore for now)
- Dedicated audit log entries for super admin actions (existing audit log captures writes)
- Firebase custom claims / token-level enforcement
- Separate ops team permission tiers
