# Global Players + Org Platform — Design Spec

**Date:** 2026-03-15
**Status:** Approved for implementation
**Author:** Design session with project owner

---

## 1. Overview

CourtMaster v2 currently stores players as tournament-scoped subcollections. The same person re-enters their details for every tournament, there is no cross-tournament identity, and there is no organizational layer. This spec introduces:

1. **Global Player Identity** — one canonical player record per email, with stats aggregated across all tournaments they enter
2. **Organization Layer** — orgs own tournaments; organizers are org admins
3. **Org Admin Pages** — org profile management (internal)
4. **Org Public Landing Page** — public-facing org page with tournaments, stats, sponsors
5. **Player Stats Page** — cross-tournament profile with stats broken down by sport and category

All changes are additive. Zero existing views, stores, or tournament-day flows are modified.

---

## 2. Roles & Access

| Role | Scope | What they manage |
|---|---|---|
| **Admin** | Platform-wide | All orgs, all tournaments, all players, all users, platform settings |
| **Organizer** | = Org Admin | Their org profile + all org tournaments + players in those tournaments. Can manage multiple orgs. |
| **Scorekeeper** | Tournament-scoped | Match scoring only (unchanged) |
| **Player** | Global | Own profile + own stats. Registers for any org's tournament. |

**Key rule:** Players do not explicitly "join" an org. They become associated with an org naturally by registering for one of its tournaments. A player who enters Miami Tennis Club's summer open AND an Orlando Pickleball tournament is associated with both orgs — visible from their profile, no explicit membership required.

**Organizer ↔ Org:** An organizer can manage multiple orgs. Each org they manage has one `/organizations/{orgId}/members/{uid}` document for them. Their `User` doc gains an `activeOrgId` field tracking which org context they are currently operating in.

---

## 3. Firestore Schema

### 3.1 New Collections

#### `/orgSlugIndex/{slug}`
Uniqueness enforcement for org slugs — same pattern as `playerEmailIndex`.

```
orgId:     string
createdAt: Timestamp
```

Slug creation uses `runTransaction`: read `/orgSlugIndex/{slug}`, if exists → reject with "slug taken", if not → create org document + index entry atomically.

#### `/organizations/{orgId}`
```
id:           string
name:         string
slug:         string            — unique, URL-safe (e.g. "miami-tennis")
logoUrl:      string | null
bannerUrl:    string | null
contactEmail: string | null
timezone:     string | null     — e.g. "America/New_York"
about:        string | null
website:      string | null
createdAt:    Timestamp
updatedAt:    Timestamp
```

#### `/organizations/{orgId}/members/{uid}`
```
uid:      string
role:     "admin" | "organizer"
joinedAt: Timestamp
```

#### `/players/{playerId}`
Global canonical player record. One per email address across the entire system.

```
id:              string
firstName:       string
lastName:        string
email:           string          — display version
emailNormalized: string          — lowercased + trimmed, indexed
phone:           string | null
skillLevel:      number | null   — 1–10
userId:          string | null   — Firebase Auth UID if self-registered
isActive:        boolean         — default true
isVerified:      boolean         — default false, admin-set
createdAt:       Timestamp
updatedAt:       Timestamp

stats: {
  [sport: string]: {             — e.g. "tennis", "pickleball", "badminton"
    [categoryType: string]: {    — "singles", "doubles", "mixed"
      wins:              number
      losses:            number
      gamesPlayed:       number
      tournamentsPlayed: number
    }
  }
  overall: {                     — cross-sport rollup
    wins:              number
    losses:            number
    gamesPlayed:       number
    tournamentsPlayed: number
  }
}
```

The `stats` map is dynamic. Sports and category types are added automatically as the player registers and completes tournaments. No schema migration required when a new sport is introduced.

#### `/playerEmailIndex/{emailNormalized}`
Deduplication lookup. Allows atomic find-or-create without a collection scan.

```
playerId:  string
createdAt: Timestamp
```

---

### 3.2 Modified Existing Documents

#### `/tournaments/{tournamentId}` — 3 new optional fields
```
orgId:          string | null   — links tournament to its organization
sport:          string | null   — e.g. "tennis", "pickleball", "badminton"
statsProcessed: boolean         — default false; set true after Cloud Function runs
```

All three fields are optional. Existing tournaments without them continue to work. Stats processing is skipped if `sport` is missing.

#### `/tournaments/{tournamentId}/players/{playerId}` — 1 new optional field
```
globalPlayerId: string | null   — forward pointer to /players/{playerId}
```

The tournament mirror document ID **must equal** the global player ID. This is the bridge: existing consumers read `tournaments/{id}/players` and get the same player ID, but now that ID also maps to a global record.

#### `/users/{uid}` — 1 new optional field
```
activeOrgId: string | null   — which org the organizer is currently operating as
```

---

### 3.3 Firestore Indexes (additions)

```json
{ "collectionGroup": "players", "queryScope": "COLLECTION",
  "fields": [{ "fieldPath": "emailNormalized", "order": "ASCENDING" }] },

{ "collectionGroup": "players", "queryScope": "COLLECTION",
  "fields": [{ "fieldPath": "isActive", "order": "ASCENDING" },
              { "fieldPath": "lastName", "order": "ASCENDING" }] },

{ "collectionGroup": "players", "queryScope": "COLLECTION",
  "fields": [{ "fieldPath": "lastName", "order": "ASCENDING" },
              { "fieldPath": "firstName", "order": "ASCENDING" }] },

{ "collectionGroup": "registrations", "queryScope": "COLLECTION_GROUP",
  "fields": [{ "fieldPath": "playerId", "order": "ASCENDING" },
              { "fieldPath": "registeredAt", "order": "DESCENDING" }] },
  // NOTE: This is a NEW entry at COLLECTION_GROUP scope — additive, do not edit
  // the existing COLLECTION-scope registrations indexes already in firestore.indexes.json

{ "collectionGroup": "tournaments", "queryScope": "COLLECTION",
  "fields": [{ "fieldPath": "orgId", "order": "ASCENDING" },
              { "fieldPath": "status", "order": "ASCENDING" },
              { "fieldPath": "startDate", "order": "DESCENDING" }] }
```

---

### 3.4 Firestore Security Rules (additions)

```
match /organizations/{orgId} {
  allow read: if true;                          // public org profiles
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
  // isVerified and stats are admin/function-only fields — owners cannot write them
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

Helper functions to add (full bodies):
```
function isOrgMember(orgId) {
  return isAuthenticated() &&
    exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid));
}
function isOrgAdmin(orgId) {
  return isAuthenticated() &&
    get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.role == 'admin';
}
```

---

## 4. Global Player Identity — How It Works

### 4.1 Find-or-Create by Email (`runTransaction`)

When a player is added to any tournament (by organizer or self-registration):

```
runTransaction(db, async (transaction) => {
  1. Read /playerEmailIndex/{emailNormalized}
  2. If exists → return existing playerId (reuse global player)
  3. If not exists →
     a. Create /players/{newId} with profile data + empty stats
     b. Create /playerEmailIndex/{emailNormalized} = { playerId: newId }
     c. Return newId
})
```

Then write tournament mirror at `/tournaments/{id}/players/{globalPlayerId}` using `setDoc` with the global player's ID (not `addDoc` — the document ID must match the global player ID).

**Why `runTransaction` not `writeBatch`:** A batch cannot read. The email index check requires a read before a conditional write. Using a transaction ensures atomicity — if the transaction fails, neither the global player nor the index entry is created, leaving no orphaned records.

### 4.2 Compatibility Bridge

The tournament mirror at `/tournaments/{id}/players/{id}` keeps the same shape as the existing `Player` interface:
```
id · firstName · lastName · email · skillLevel · userId? · createdAt · updatedAt
```
Plus one new field: `globalPlayerId`.

**All 28 existing views are unaffected.** They read `registrationStore.players` which reads from the mirror. The store's data source changes; the consumers do not.

### 4.3 Bulk Import Deduplication

When importing players via CSV, each row calls `findOrCreateByEmail`. If a global player already exists for that email, the import links to the existing record (no duplicate created) and only writes/updates the tournament mirror. The import result surface shows "3 players linked to existing records, 2 new players created."

**Note:** `bulkImportPlayers` in `registrations.ts` calls `addPlayer` in a loop. Once `addPlayer` is updated with the `findOrCreateByEmail` bridge (Step 4 in Section 11), bulk import inherits deduplication automatically — no separate implementation required.

### 4.4 `deletePlayer` in Tournament Context

Deletes **only the tournament mirror** — never the global player. Other tournaments may reference the same global player. The global player doc and email index entry are permanent until explicitly deleted by an Admin.

---

## 5. Stats Aggregation — Cloud Function

### 5.1 Trigger

```
onDocumentUpdated("tournaments/{tournamentId}")
  when: status changes to "completed"
  AND:  statsProcessed == false
  AND:  sport field is present
```

### 5.2 Function Logic

```
1. Read tournament.sport, tournament.orgId
2. Read all match scores via collection group query:
   `collectionGroup("match_scores").where("tournamentId", "==", tournamentId)`
   NOTE: `tournamentId` must be denormalized onto each match_score document at write time.
   Existing match_score write paths in `match-scores.ts` must include `tournamentId` field.
   (This is a one-time additive field — existing docs without it are silently skipped by the function.)
3. Read all /registrations for this tournament
4. For each completed match:
   a. Identify winner(s) and loser(s) via registrations → playerId
   b. Identify category.type (singles/doubles/mixed)
   c. For doubles/mixed: both partners are updated
5. Compute per-player deltas:
   { [playerId]: { wins: N, losses: N, gamesPlayed: N, tournamentsPlayed: 1 } }
   (`tournamentsPlayed: 1` is always 1 per tournament since the function runs once per tournament guaranteed by `statsProcessed` flag)
6. One batch write to /players:
   stats.{sport}.{categoryType}.wins   += delta.wins      (FieldValue.increment)
   stats.{sport}.{categoryType}.losses += delta.losses    (FieldValue.increment)
   stats.{sport}.{categoryType}.gamesPlayed += delta.gamesPlayed
   stats.{sport}.{categoryType}.tournamentsPlayed += 1
   stats.overall is updated the same way
7. Set tournament.statsProcessed = true  (prevents double-processing)
```

### 5.3 Cost Model

| Approach | Invocations per tournament | Notes |
|---|---|---|
| Per-match trigger | 50–300 | Previous approach |
| End-of-tournament | **1** | This design |

At 100 tournaments/month: 100 Cloud Function invocations. Practically free. Firebase Functions free tier: 2M invocations/month.

### 5.4 Safety

`statsProcessed: true` prevents double-counting if the tournament status is toggled. The function's first action is to check this flag and exit if true.

---

## 6. Page Designs

### 6.1 Org Admin Profile Page
**Route:** `/org/profile` (auth-required, organizer role)
**Tabs:** Profile · Tournaments · Members · Settings

**Profile tab fields:**
- Org banner (upload, editable inline with "Edit Banner" button)
- Org logo (upload, shown overlapping banner bottom edge, with edit icon)
- Organization Name
- Slug / URL (unique, validated)
- Contact Email
- Timezone (dropdown)
- About / Description (textarea)
- Website URL
- Primary Sport (informational)

**Tournaments tab:** List of org's tournaments with status badges (Live / Open / Completed), links to tournament dashboard.

**Members tab:** List of org members (uid → user display name, role), invite flow.

**Settings tab:** Danger zone — delete org, transfer ownership.

---

### 6.2 Org Public Landing Page
**Route:** `/[orgSlug]` (public, no auth)
**URL example:** `courtmaster.app/miami-tennis`

**Sections (top to bottom):**
1. **Hero** — org banner image, org logo overlapping bottom edge, org name, location/tagline
2. **Stats bar** — Total Tournaments · Total Players · Total Matches · Sports
3. **Tournaments list** — cards with sport icon, tournament name, date range, category summary, status badge (LIVE / OPEN / COMPLETED). Click → existing tournament landing page
4. **Sponsors section** — deferred to roadmap (see Section 13). No org-level sponsor schema defined in this release. The section is omitted from the initial implementation of `OrgPublicHomeView`.

---

### 6.3 Player Stats Page
**Route:** `/players/:playerId` (auth-required, admin/organizer role)
**Access note:** Intentionally restricted to organizers and admins in this release. Players do not have a self-service stats view yet (deferred to roadmap). Any authenticated user can read `/players` docs via Firestore rules, but the router guard restricts the page to organizer/admin roles.
**URL example:** `courtmaster.app/players/rafael-garcia`

**Sections:**

**Header:**
- Player avatar (initials-based, auto-generated from name)
- Full name
- Skill level badge
- Verified badge (if `isVerified == true`)
- Member since date

**Overall stats bar:**
- Total Wins · Total Losses · Total Tournaments · Win Rate %

**Sport tabs** (one per sport the player has stats for):
- Auto-generated from `Object.keys(player.stats)`
- Each tab shows the sport's emoji + name

**Per-sport stat cards** (3-column grid):
- One card per category: Singles · Doubles · Mixed
- Each card shows: W / L count, win-rate bar, tournaments played

**Tournament history:**
- List of all tournaments (from `registrations` collection group query by `playerId`)
- Each row: sport emoji · tournament name · org name · date · W–L result for that tournament
- Ordered by most recent first

---

## 7. New Stores & Feature Modules

### `src/stores/players.ts`
Setup Store. Key methods:
- `findOrCreateByEmail(email, data)` → `Promise<string>` (returns playerId) — uses `runTransaction`
- `fetchPlayers()` — loads full global player list
- `subscribePlayers()` — real-time listener
- `updatePlayer(id, updates)` — updates global doc
- `getPlayerById(id)` — in-memory lookup
- `unsubscribe()` — cleanup

### `src/stores/organizations.ts`
Setup Store. Key methods:
- `fetchMyOrgs()` — loads orgs where current user is a member
- `fetchOrgById(orgId)` — single org load
- `fetchOrgBySlug(slug)` — public lookup via `/orgSlugIndex/{slug}` → then fetch org doc
- `createOrg(data)` — uses `runTransaction` to check `/orgSlugIndex/{slug}`, create org + index entry atomically
- `setActiveOrg(orgId)` — updates `user.activeOrgId`
- `updateOrg(orgId, data)` — profile update (slug changes require transaction to update slug index)
- `fetchOrgTournaments(orgId)` — query `tournaments where orgId == orgId`

**How tournaments get their `orgId`:** When an organizer creates a new tournament, the create flow auto-sets `orgId = authStore.user.activeOrgId`. The tournament create view (`TournamentCreateView.vue`) gains a pre-filled, read-only "Organization" field showing the active org. Existing tournaments without `orgId` are shown in an "Unassigned" state and can be claimed via a tournament settings action.

### `src/stores/dashboard.ts`
Setup Store. Uses `getCountFromServer` for counts (no document reads).
- `pendingRegistrationCount` — collection group count where status == 'pending'
- `totalPlayerCount` — count of /players
- `activeTournamentCount` + `upcomingTournamentCount` — derived from tournamentStore
- `recentActivity` — latest 10 activity docs (collection group)

### New Feature Modules
```
src/features/players/
  views/
    PlayersListView.vue       — searchable list, export CSV, deactivate
    PlayerProfileView.vue     — stats page as designed above

src/features/org/
  views/
    OrgProfileView.vue        — admin profile editor
    OrgProfileEditView.vue    — (or inline editing within OrgProfileView)

src/features/public/views/
  OrgPublicHomeView.vue       — public org landing page (new)

src/features/dashboard/
  views/
    OrgDashboardView.vue      — post-login dashboard
```

### New Cloud Function
```
functions/src/playerStats.ts
  — onDocumentUpdated trigger
  — tournament completion handler
  — batch stats writer
```

---

## 8. Router Changes

### New Routes
```
/dashboard                          → OrgDashboardView        (auth)
/players                            → PlayersListView          (auth, organizer)
/players/:playerId                  → PlayerProfileView        (auth, organizer)
/org/profile                        → OrgProfileView           (auth, organizer)
/:orgSlug                           → OrgPublicHomeView        (public)
```

**Route ordering rule:** `/:orgSlug` must be defined AFTER all static root-level routes (`/login`, `/register`, `/about`, `/pricing`, `/privacy`, `/terms`, `/tournaments`, `/dashboard`, `/players`, `/org`) and BEFORE the catch-all `/:pathMatch(.*)`. This prevents static paths from being swallowed. Org slugs must not be allowed to equal any reserved static path — enforce this in the slug validation on the org create/edit form.

**`OrgPublicHomeView` not-found handling:** If `fetchOrgBySlug(slug)` returns null, render a 404-style "Organization not found" state — not a redirect.

**`:playerId` in `PlayerProfileView`:** The param is the Firestore document ID (20-char auto-generated string), not a name slug. The URL example `/players/rafael-garcia` in Section 6.3 is illustrative only; the actual URL will be `/players/xK8mNpQr2tVwYzLa5bCd`.

### Changed
- Post-login redirect: `tournament-list` → `dashboard`
- ⚠️ All four `next({ name: 'tournament-list' })` calls in `src/router/index.ts` router guard branches must be updated to `next({ name: 'dashboard' })` — not just the login success handler
- ⚠️ E2E test scope is broad: `waitForURL('/tournaments')` appears in ~13 files including `e2e/auth.setup.ts` and `e2e/fixtures/auth-fixtures.ts` (highest priority — depended upon by nearly all tests). Update these two first.

---

## 9. Navigation Changes (`AppNavigation.vue`)

New items added to global (non-tournament) nav section:

| Icon | Label | Visible to | Route |
|---|---|---|---|
| `mdi-view-dashboard-variant` | Dashboard | All auth users | `/dashboard` |
| `mdi-account-group` | Players | Organizer + Admin | `/players` |
| `mdi-office-building` | Organization | Organizer + Admin | `/org/profile` |

Existing nav items unchanged.

---

## 10. Impact on Current Application

| Area | Impact |
|---|---|
| Scoring, brackets, check-in, scheduling | **None** — zero code changes |
| OBS overlays, public pages, leaderboard | **None** — zero code changes |
| `useParticipantResolver` | **None** — reads from store, store shape unchanged |
| Existing player data in tournaments | **None** — mirror stays exactly as-is |
| Organizer adding a player | +~300ms (one Firestore transaction before mirror write) |
| Post-login landing page | Changes from `/tournaments` to `/dashboard` |
| E2E Playwright tests | ~5–10 tests need `waitForURL` updated |
| Existing tournaments (no `sport`/`orgId`) | Stats processing silently skipped — no errors |
| Firebase costs | ~1 Cloud Function invocation per completed tournament |

---

## 11. Implementation Sequence

Execute in this order to maintain zero regression at each step:

1. **Type contracts** — add `GlobalPlayer`, `Organization`, `OrganizationMember` to `src/types/index.ts`
2. **Firestore rules + indexes** — deploy new rules and indexes (no app code changes)
3. **`src/stores/players.ts`** — new store, nothing calls it yet
4. **Bridge in `registrations.ts`** — `addPlayer` calls `findOrCreateByEmail`, writes mirror with global ID
5. **`src/stores/organizations.ts`** — new store
6. **Org feature module** — `OrgProfileView`, routes, nav item
7. **Player feature module** — `PlayersListView`, `PlayerProfileView`, routes, nav item
8. **Dashboard** — `OrgDashboardView`, `src/stores/dashboard.ts`, route, nav item, redirect change + E2E test updates
9. **Org public landing** — `OrgPublicHomeView`, `/:orgSlug` route
10. **Cloud Function** — `functions/src/playerStats.ts`, deploy

Each step is independently deployable. Steps 1–4 are the foundation. Steps 5–10 can be developed in parallel once the foundation is in place.

---

## 12. Key Technical Constraints

- **`runTransaction` not `writeBatch`** for `findOrCreateByEmail` — batch cannot read; transaction is required for atomic check-then-write
- **`setDoc` not `addDoc`** for tournament mirror — document ID must match global player ID
- **`FieldValue.increment()`** for stats updates — atomic, race-condition safe
- **`serverTimestamp()`** not `new Date()` — per CP-006
- **`useAsyncOperation`** for all async state in views — per project coding patterns
- **`notificationStore.showToast`** for all user feedback — per CP-005
- **`v-dialog`** not native `confirm()`/`alert()` — per CP-001
- **`writeBatch`** for multi-document writes that do NOT require a pre-write read (e.g., member add, org profile update) — per CP-003
- **`runTransaction`** for `createOrg` (requires slug index read before write — batch cannot read)

---

## 13. Out of Scope (Future Roadmap)

- Org-level email uniqueness (currently: per-system)
- Org switcher UI (activeOrgId field is reserved for this)
- Branded tournament slugs (`/miami-tennis/summer-open`)
- Venues library
- Feature/settings search (command palette)
- Player self-service profile editing (public-facing)
- Win/loss stat breakdown per opponent
- Org-level sponsor logos (schema + storage + org public page section)
- Player self-service stats page (router guard currently restricts to organizer/admin)

---

## 14. Visual Design Decisions (Brainstorm Session 2026-03-15)

**Branch strategy:** Single branch `feat/global-players-org-platform`, one PR, commits per implementation step.

**UI Direction: "Sports Scoreboard" (Option C)**
- Page headers: dark `#0F172A` background with gradient logo tile (Blue→Amber diagonal)
- Embedded stats panel: `#1E293B` block flush at bottom of header, 4-column grid, Amber `#F59E0B` stat values
- Content area: `#F8FAFC` background
- Tournament cards: left `3px` accent border (Green=LIVE, Blue=OPEN), `border-radius: 0 8px 8px 0`, subtle shadow
- LIVE indicator: animated pulse dot (green, 1.5s CSS animation)
- All pages use existing Vuetify theme colors — no new color tokens required

**Player Stats Page: "Stat Cards Grid" (Option X)**
- 3-column card grid: Singles / Doubles / Mixed — each card has W/L count, win-rate `v-progress-linear`, tournaments-played count
- Sport tabs: pill-shaped tabs above the grid, one per sport the player has data for (auto-generated from `Object.keys(player.stats)`)
- Overall stats: dark embedded panel (same as org landing) at bottom of dark header
- Tournament history: flat list below stat cards, ordered most-recent-first

**Org Public Landing Page**
- Hero: dark header with org logo tile + org name + tagline
- Stats bar: `#1E293B` embedded panel (Tournaments / Players / Matches / Sports)
- Tournament cards: left-border accent cards in light content area

**Org Admin Profile Page**
- Standard Vuetify `v-tabs` + `v-tab-item` layout with Profile / Tournaments / Members / Settings
- Page header: same dark Sports Scoreboard style (org logo tile + name)
