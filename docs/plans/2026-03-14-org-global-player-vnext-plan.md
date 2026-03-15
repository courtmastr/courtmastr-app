# Org + Global Player vNext Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver vNext features for multi-organization switching, global players across orgs, venues library, org dashboard, branded slug portal, and feature/settings search without breaking current tournament-day flows.

**Architecture:** Introduce org tenancy as a first-class axis (`orgId` + active org context), keep players globally canonical, and use a compatibility bridge so existing tournament-scoped player consumers keep working during migration. Roll out in vertical slices with strict Firestore rules/index hardening and route-safe backward compatibility.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), TypeScript strict mode, Pinia, Vue Router, Vuetify 3, Firebase Auth/Firestore/Functions/Hosting, Vitest, Playwright.

---

## Task 1: Tenancy Data Contracts

**Files:**
- Modify: `src/types/index.ts`
- Test: `tests/unit/auth.store.test.ts`

**Step 1: Add tenancy types (failing type usage first)**

Add:
- `Organization`
- `OrganizationMemberRole`
- `OrganizationMembership`
- `GlobalPlayer`
- `OrganizationPlayerProfile`
- `Venue`

Extend:
- `User` with `activeOrgId?: string` and `orgMemberships?: string[]`
- `Tournament` with `orgId: string` and public portal fields

**Step 2: Run targeted tests**

Run: `npm run test -- --run tests/unit/auth.store.test.ts`
Expected: FAIL until auth mapping is implemented.

**Step 3: Commit**

```bash
git add src/types/index.ts tests/unit/auth.store.test.ts
git commit -m "feat: add tenancy and global player type contracts"
```

---

## Task 2: Firestore Rules + Index Foundation

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Test: `tests/integration/setup/emulator.test.ts`

**Step 1: Add rules for new collections**

Add rule blocks for:
- `/organizations/{orgId}`
- `/organizations/{orgId}/members/{uid}`
- `/organizations/{orgId}/playerProfiles/{playerId}`
- `/players/{playerId}`
- `/playerEmailIndex/{emailNormalized}`
- `/venues/{venueId}`

Keep existing tournament public read behavior temporarily, but lock global player PII to org membership.

**Step 2: Add indexes for org-scoped queries**

Add indexes for:
- `tournaments(orgId + status + startDate)`
- `venues(orgId + name)`
- `players(emailNormalized)` and org profile lookups
- `organizations(slug)` if queried directly

**Step 3: Validate emulator boot**

Run: `npm run test -- --run tests/integration/setup/emulator.test.ts`
Expected: PASS.

**Step 4: Commit**

```bash
git add firestore.rules firestore.indexes.json tests/integration/setup/emulator.test.ts
git commit -m "feat: add firestore tenancy rules and indexes"
```

---

## Task 3: Active Org Context + Switching

**Files:**
- Modify: `src/stores/auth.ts`
- Create: `src/stores/organizations.ts`
- Modify: `src/router/index.ts`
- Modify: `src/components/layout/AppLayout.vue`
- Test: `tests/unit/navigationGuards.test.ts`
- Test: `tests/unit/AppLayout.publicFooter.test.ts`

**Step 1: Write failing tests**

Add tests for:
- restoring `activeOrgId` on login
- switching org updates app context
- guard behavior for org-required routes

**Step 2: Implement org context store**

Create store that:
- loads memberships for current user
- exposes active org
- supports switching org

**Step 3: Wire auth + layout**

Update auth initialization to include active org fields and surface a lightweight org switcher in app chrome.

**Step 4: Run targeted tests**

Run:
- `npm run test -- --run tests/unit/navigationGuards.test.ts`
- `npm run test -- --run tests/unit/AppLayout.publicFooter.test.ts`

**Step 5: Commit**

```bash
git add src/stores/auth.ts src/stores/organizations.ts src/router/index.ts src/components/layout/AppLayout.vue tests/unit/navigationGuards.test.ts tests/unit/AppLayout.publicFooter.test.ts
git commit -m "feat: add active organization context and switching"
```

---

## Task 4: Organization Profile Pages + Sidebar Section

**Files:**
- Create: `src/features/org/views/OrganizationProfileView.vue`
- Create: `src/features/org/views/OrganizationProfileEditView.vue`
- Modify: `src/router/index.ts`
- Modify: `src/components/navigation/AppNavigation.vue`
- Test: `tests/unit/AppNavigation.test.ts`

**Step 1: Write failing navigation/route tests**

Cover:
- `/org/profile`
- `/org/profile/edit`
- sidebar placement above logout

**Step 2: Build read + edit views**

Implement:
- read-only profile
- edit form with logo/banner/contact/timezone/social fields

**Step 3: Add sidebar section**

Add "Organization" section in the global (non-tournament) region with Profile/Settings entries above logout.

**Step 4: Run targeted tests**

Run: `npm run test -- --run tests/unit/AppNavigation.test.ts`

**Step 5: Commit**

```bash
git add src/features/org/views/OrganizationProfileView.vue src/features/org/views/OrganizationProfileEditView.vue src/router/index.ts src/components/navigation/AppNavigation.vue tests/unit/AppNavigation.test.ts
git commit -m "feat: add organization profile pages and sidebar section"
```

---

## Task 5: Venues Library + Tournament Integration

**Files:**
- Create: `src/stores/venues.ts`
- Create: `src/features/venues/views/VenuesListView.vue`
- Create: `src/features/venues/views/VenueDetailView.vue`
- Modify: `src/router/index.ts`
- Modify: `src/components/navigation/AppNavigation.vue`
- Modify: `src/features/tournaments/views/TournamentCreateView.vue`
- Modify: `src/features/tournaments/views/TournamentSettingsView.vue`
- Test: `tests/unit/TournamentCreateView.test.ts`
- Test: `tests/unit/TournamentSettingsView.test.ts`

**Step 1: Write failing integration tests**

Cover:
- selecting venue from dropdown
- prefill court count from venue total courts

**Step 2: Build venues CRUD**

Implement:
- org-scoped venue list/detail
- courts array editing in venue detail

**Step 3: Integrate tournament forms**

Replace free-text location workflow with venue selector, while retaining a temporary fallback for legacy tournaments.

**Step 4: Run tests**

Run:
- `npm run test -- --run tests/unit/TournamentCreateView.test.ts`
- `npm run test -- --run tests/unit/TournamentSettingsView.test.ts`

**Step 5: Commit**

```bash
git add src/stores/venues.ts src/features/venues/views/VenuesListView.vue src/features/venues/views/VenueDetailView.vue src/router/index.ts src/components/navigation/AppNavigation.vue src/features/tournaments/views/TournamentCreateView.vue src/features/tournaments/views/TournamentSettingsView.vue tests/unit/TournamentCreateView.test.ts tests/unit/TournamentSettingsView.test.ts
git commit -m "feat: add venues library and tournament venue selection"
```

---

## Task 6: Feature Search v2 (Command Palette + Settings Index)

**Files:**
- Create: `src/config/searchIndex.ts`
- Create: `src/composables/useFeatureSearch.ts`
- Modify: `src/components/navigation/GlobalSearch.vue`
- Modify: `src/components/layout/AppLayout.vue`
- Test: `tests/unit/GlobalSearch.test.ts`

**Step 1: Write failing search tests**

Cover:
- grouped results (data + feature settings)
- route parameter interpolation
- keyboard shortcut `Cmd+K/Ctrl+K`

**Step 2: Implement static index + matcher**

Add indexed entries for settings/actions with category badges and keyword matching.

**Step 3: Integrate global keyboard handler**

Open/focus search from anywhere and navigate with keyboard.

**Step 4: Run tests**

Run: `npm run test -- --run tests/unit/GlobalSearch.test.ts`

**Step 5: Commit**

```bash
git add src/config/searchIndex.ts src/composables/useFeatureSearch.ts src/components/navigation/GlobalSearch.vue src/components/layout/AppLayout.vue tests/unit/GlobalSearch.test.ts
git commit -m "feat: add feature settings search and command palette shortcut"
```

---

## Task 7: Global Player Canonical Model + Compatibility Bridge

**Files:**
- Create: `src/stores/players.ts`
- Modify: `src/stores/registrations.ts`
- Modify: `src/composables/useParticipantResolver.ts`
- Modify: `src/composables/useLeaderboard.ts`
- Create: `functions/src/players.ts`
- Modify: `functions/src/index.ts`
- Modify: `functions/src/selfCheckIn.ts`
- Create: `scripts/seed/migrate-global-players.ts`
- Test: `tests/integration/registration-management.integration.test.ts`
- Test: `tests/unit/registrations.store.test.ts`
- Test: `tests/unit/useParticipantResolver.test.ts`

**Step 1: Write failing migration-bridge tests**

Cover:
- registration resolves names from global players
- tournament-level mirror continues to support old consumers

**Step 2: Implement canonical global player operations**

Implement callable/transaction flow for:
- find-or-create by `emailNormalized` using `/playerEmailIndex`
- org profile linkage

**Step 3: Add compatibility writes**

When registering/importing player:
- write canonical global player
- write/update org player profile
- write/update tournament player mirror with same `playerId`

**Step 4: Update read paths incrementally**

Move resolver and leaderboard paths to global players + org profile, keeping fallback to tournament mirror until cutover complete.

**Step 5: Run tests**

Run:
- `npm run test -- --run tests/unit/registrations.store.test.ts`
- `npm run test -- --run tests/unit/useParticipantResolver.test.ts`
- `npm run test -- --run tests/integration/registration-management.integration.test.ts`

**Step 6: Commit**

```bash
git add src/stores/players.ts src/stores/registrations.ts src/composables/useParticipantResolver.ts src/composables/useLeaderboard.ts functions/src/players.ts functions/src/index.ts functions/src/selfCheckIn.ts scripts/seed/migrate-global-players.ts tests/unit/registrations.store.test.ts tests/unit/useParticipantResolver.test.ts tests/integration/registration-management.integration.test.ts
git commit -m "feat: add global players with org bridge and compatibility mirror"
```

---

## Task 8: Players Pages

**Files:**
- Create: `src/features/players/views/PlayersListView.vue`
- Create: `src/features/players/views/PlayerProfileView.vue`
- Modify: `src/router/index.ts`
- Modify: `src/components/navigation/AppNavigation.vue`
- Test: `tests/unit/PlayersListView.test.ts`
- Test: `tests/unit/PlayerProfileView.test.ts`

**Step 1: Write failing page tests**

Cover:
- list search/filter/sort
- profile stats/history rendering

**Step 2: Implement list + profile views**

Include:
- export CSV
- deactivate toggle
- verified toggle

**Step 3: Run tests**

Run:
- `npm run test -- --run tests/unit/PlayersListView.test.ts`
- `npm run test -- --run tests/unit/PlayerProfileView.test.ts`

**Step 4: Commit**

```bash
git add src/features/players/views/PlayersListView.vue src/features/players/views/PlayerProfileView.vue src/router/index.ts src/components/navigation/AppNavigation.vue tests/unit/PlayersListView.test.ts tests/unit/PlayerProfileView.test.ts
git commit -m "feat: add global players list and profile pages"
```

---

## Task 9: Org-Level Dashboard

**Files:**
- Create: `src/features/dashboard/views/OrgDashboardView.vue`
- Create: `src/stores/dashboard.ts`
- Modify: `src/router/index.ts`
- Modify: `src/components/navigation/AppNavigation.vue`
- Create: `functions/src/dashboard.ts`
- Modify: `functions/src/index.ts`
- Test: `tests/unit/OrgDashboardView.test.ts`

**Step 1: Write failing dashboard tests**

Cover:
- pending approvals
- live/upcoming tournaments
- total players
- recent activity feed cards

**Step 2: Build dashboard aggregate source**

Prefer callable endpoint for aggregate metrics to avoid heavy client fan-out reads.

**Step 3: Route transition**

Add `/dashboard` and redirect authenticated post-login flow there. Keep `/tournaments` as full list page.

**Step 4: Run tests**

Run: `npm run test -- --run tests/unit/OrgDashboardView.test.ts`

**Step 5: Commit**

```bash
git add src/features/dashboard/views/OrgDashboardView.vue src/stores/dashboard.ts src/router/index.ts src/components/navigation/AppNavigation.vue functions/src/dashboard.ts functions/src/index.ts tests/unit/OrgDashboardView.test.ts
git commit -m "feat: add organization dashboard and aggregate metrics endpoint"
```

---

## Task 10: Branded Public Portal Slugs

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/features/tournaments/views/TournamentSettingsView.vue`
- Modify: `src/router/index.ts`
- Create: `src/features/public/views/OrgPublicHomeView.vue`
- Modify: `src/features/public/views/TournamentLandingTemplateView.vue`
- Modify: `src/features/public/views/PublicScheduleView.vue`
- Modify: `src/features/public/views/PublicBracketView.vue`
- Modify: `src/features/public/views/PublicScoringView.vue`
- Create: `functions/src/publicPortal.ts`
- Modify: `functions/src/index.ts`
- Test: `tests/unit/PublicScheduleView.test.ts`
- Test: `tests/unit/PublicBracketView.test.ts`
- Test: `tests/unit/PublicScoringView.test.ts`

**Step 1: Write failing slug-route tests**

Cover:
- `/[orgSlug]`
- `/[orgSlug]/[tournamentSlug]`
- schedule/bracket/leaderboard subpaths

**Step 2: Add slug uniqueness strategy**

Use lookup docs or callable checks before save; do not rely on client-only prechecks.

**Step 3: Add tournament public-page controls**

Add fields in settings:
- `slug`
- `publicPageEnabled`
- `heroImageUrl`
- `accentColor`
- visibility toggles

**Step 4: Keep old routes backward-compatible**

Legacy `/tournaments/:id/...` public routes continue to work and can optionally redirect to slug URL when enabled.

**Step 5: Run tests**

Run:
- `npm run test -- --run tests/unit/PublicScheduleView.test.ts`
- `npm run test -- --run tests/unit/PublicBracketView.test.ts`
- `npm run test -- --run tests/unit/PublicScoringView.test.ts`

**Step 6: Commit**

```bash
git add src/types/index.ts src/features/tournaments/views/TournamentSettingsView.vue src/router/index.ts src/features/public/views/OrgPublicHomeView.vue src/features/public/views/TournamentLandingTemplateView.vue src/features/public/views/PublicScheduleView.vue src/features/public/views/PublicBracketView.vue src/features/public/views/PublicScoringView.vue functions/src/publicPortal.ts functions/src/index.ts tests/unit/PublicScheduleView.test.ts tests/unit/PublicBracketView.test.ts tests/unit/PublicScoringView.test.ts
git commit -m "feat: add branded public portal with org and tournament slugs"
```

---

## Task 11: Data Migration + Rollout Safety

**Files:**
- Create: `scripts/seed/migrate-organizations-and-memberships.ts`
- Create: `scripts/seed/migrate-tournaments-orgid.ts`
- Modify: `scripts/seed/README.md`
- Create: `docs/migration/ORG_PLAYER_VNEXT_MIGRATION.md`

**Step 1: Add idempotent migration scripts**

Migrations:
- users -> memberships + active org
- tournaments -> `orgId`
- tournament players -> global players + org profiles + mirror consistency

**Step 2: Add dry-run mode**

Every script supports `--dry-run` and prints summary deltas.

**Step 3: Validate in emulator**

Run:
- `npm run emulators`
- migration scripts in dry-run then apply mode

**Step 4: Commit**

```bash
git add scripts/seed/migrate-organizations-and-memberships.ts scripts/seed/migrate-tournaments-orgid.ts scripts/seed/README.md docs/migration/ORG_PLAYER_VNEXT_MIGRATION.md
git commit -m "chore: add org/player vnext migration scripts and guide"
```

---

## Task 12: Verification Gates + Logging Protocol

**Files:**
- Modify: `docs/deployment/LAST_DEPLOY.md` (only when deployed)
- Modify: `docs/debug-kb/index.yml` and fingerprint files if any `:log` command fails

**Step 1: Run targeted tests per changed areas**

Run: `npm run test -- --run <changed-test-files>`

**Step 2: Run logged targeted tests**

Run: `npm run test:log -- --run <changed-test-files>`

**Step 3: Run env and build gates**

Run:
- `npm run check:firebase-env`
- `npm run build`
- `npm run build:log`

**Step 4: Optional lint gate for shared UI/routing/rules changes**

Run: `npm run lint:log`

**Step 5: Handle failures via Debug KB protocol**

If any `:log` command fails:
1. Capture fingerprint from output.
2. Check `docs/debug-kb/index.yml`.
3. Apply existing fix first, or create a new KB entry from template.

---

## Release Strategy

1. Ship behind feature flags:
   - `orgContextEnabled`
   - `globalPlayersEnabled`
   - `slugPortalEnabled`
2. Roll out in this order:
   - tenancy foundation
   - org profile + venues + search
   - global players bridge
   - dashboard
   - slug portal
3. Remove bridge only after:
   - resolver, self-checkin, leaderboard, and registration flows are fully on canonical global players
   - emulator + CI + manual smoke pass all required gates

---

Plan complete and saved to `docs/plans/2026-03-14-org-global-player-vnext-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration.

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints.

Which approach?
