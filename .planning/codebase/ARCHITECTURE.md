# Architecture

**Analysis Date:** 2026-03-21

## Pattern Overview

**Overall:** Feature-sliced Vue SPA backed by Firebase, with Pinia stores as the client-side domain layer and Cloud Functions reserved for privileged or bracket-manager-sensitive operations.

**Key Characteristics:**
- Route-driven application shell. `src/router/index.ts` defines page boundaries, access rules, and layout mode through route meta, and `src/App.vue` switches between full app, volunteer, and overlay rendering based on that meta.
- Firestore-first data access. Most reads and CRUD writes happen directly from Pinia stores and scheduling/composable helpers through `src/services/firebase.ts`.
- Split match model. Bracket structure lives in category-scoped `.../match` collections, while operational state lives in parallel `.../match_scores` collections and is merged in `src/stores/matches.ts`.

## Layers

**Bootstrap and Shell:**
- Purpose: Start the SPA, initialize Firebase, install plugins, and choose the top-level layout.
- Location: `src/main.ts`, `src/App.vue`, `src/plugins/vuetify.ts`, `src/router/index.ts`
- Contains: App bootstrap, Vuetify theme/defaults, auth bootstrap, route guards, layout selection.
- Depends on: `src/services/firebase.ts`, `src/stores/auth.ts`, `src/stores/notifications.ts`
- Used by: All frontend code.

**Route/View Layer:**
- Purpose: Assemble page-level features from stores, composables, and feature components.
- Location: `src/features/*/views/*.vue`
- Contains: Routed pages such as `src/features/tournaments/views/TournamentDashboardView.vue`, `src/features/tournaments/views/MatchControlView.vue`, `src/features/scoring/views/ScoringInterfaceView.vue`
- Depends on: Pinia stores, feature components, shared components, composables, router.
- Used by: `src/router/index.ts`

**Feature Component Layer:**
- Purpose: Hold feature-local UI and behavior below the route level.
- Location: `src/features/*/components/`, `src/features/tournaments/dialogs/`
- Contains: Tournament control panels, bracket viewers, check-in panels, scoring editors, dialogs.
- Depends on: Shared UI in `src/components/`, composables, types.
- Used by: Feature views and sometimes sibling feature components.

**Shared UI and Navigation Layer:**
- Purpose: Provide reusable layout, navigation, and generic UI primitives across features.
- Location: `src/components/layout/`, `src/components/navigation/`, `src/components/common/`
- Contains: `src/components/layout/AppLayout.vue`, `src/components/layout/VolunteerLayout.vue`, `src/components/navigation/AppNavigation.vue`, `src/components/common/BaseDialog.vue`
- Depends on: Router, stores, Vuetify, composables.
- Used by: `src/App.vue` and multiple feature views.

**State and Workflow Layer:**
- Purpose: Own long-lived domain state, real-time subscriptions, and reusable workflows.
- Location: `src/stores/*.ts`, `src/composables/*.ts`, `src/scheduling/*.ts`
- Contains: Setup-style Pinia stores, cross-view composables, scheduling orchestration and persistence helpers.
- Depends on: `src/services/firebase.ts`, `src/utils/firestore.ts`, `src/types/index.ts`
- Used by: Views, layouts, shared components.

**Infrastructure and Backend Layer:**
- Purpose: Wrap Firebase SDK access on the client and expose privileged backend operations in Cloud Functions.
- Location: `src/services/*.ts`, `src/utils/firestore.ts`, `functions/src/*.ts`
- Contains: Firebase initialization, storage helpers, review/branding services, callable functions like `functions/src/updateMatch.ts` and `functions/src/volunteerAccess.ts`
- Depends on: Firebase SDKs, `brackets-manager`, Firestore admin APIs.
- Used by: Stores/composables on the client and Firebase Hosting/Functions in deployment.

## Data Flow

**App bootstrap and auth gating:**

1. `src/main.ts` calls `initializeFirebase()` from `src/services/firebase.ts` before importing stores so Firestore singletons exist before store code runs.
2. `src/main.ts` creates the app, installs Pinia, router, Vuetify, and i18n, then waits for `useAuthStore().initAuth()` from `src/stores/auth.ts`.
3. `src/router/index.ts` route guards read auth state and volunteer session state to allow, redirect, or switch kiosk/access flows before the app mounts routed views.

**Tournament operations and realtime dashboarding:**

1. A routed page such as `src/features/tournaments/views/TournamentDashboardView.vue` reads `tournamentId` from the route and invokes `useTournamentStore()`, `useMatchStore()`, and `useRegistrationStore()`.
2. `src/stores/tournaments.ts` loads `tournaments/{id}`, `categories`, and `courts`; `src/stores/registrations.ts` loads `registrations` and `players`; `src/stores/matches.ts` resolves category and level scopes and fetches both `match` and `match_scores`.
3. `src/stores/bracketMatchAdapter.ts` converts brackets-manager documents into the app `Match` shape, then `src/stores/matches.ts` overlays operational fields like `status`, `scores`, `courtId`, `plannedStartAt`, and `publishedAt`.
4. Views use composables such as `src/composables/useParticipantResolver.ts` and `src/composables/useCategoryStageStatus.ts` to derive display state for feature components.

**Schedule drafting, publishing, and assignment:**

1. `src/features/tournaments/views/MatchControlView.vue` coordinates the workflow and delegates scheduling logic to `src/composables/useMatchScheduler.ts` and `src/scheduling/useScheduleOrchestrator.ts`.
2. The orchestrator resolves schedule targets from category and level scopes, applies capacity guards from `src/scheduling/scheduleCapacityGuard.ts`, and calculates slotting through `src/composables/useTimeScheduler.ts` and `src/composables/useMatchScheduler.ts`.
3. Draft and publish writes go to `match_scores` through `src/scheduling/useScheduleStore.ts`, while court assignment and match lifecycle changes are handled in `src/stores/matches.ts`.
4. Realtime listeners in `src/stores/matches.ts` refresh local match state when `match` or `match_scores` documents change.

**Volunteer scoring and privileged mutations:**

1. Volunteer entry routes in `src/router/index.ts` issue or validate kiosk sessions via `src/stores/volunteerAccess.ts` and route meta.
2. Client code in `src/stores/matches.ts` and `src/stores/registrations.ts` prefers callable functions when a volunteer session token is present.
3. `functions/src/updateMatch.ts` and `functions/src/volunteerAccess.ts` verify the session or Firebase auth, mutate Firestore, and update bracket-manager storage through `functions/src/storage/firestore-adapter.ts`.

**State Management:**
- Global state is store-owned in `src/stores/*.ts`; examples include auth in `src/stores/auth.ts`, tournaments in `src/stores/tournaments.ts`, matches in `src/stores/matches.ts`, and notifications in `src/stores/notifications.ts`.
- Cross-view logic that needs reactive composition but not app-wide ownership lives in composables such as `src/composables/useParticipantResolver.ts`, `src/composables/useNavigation.ts`, and `src/composables/useTournamentStateAdvance.ts`.
- Scheduling logic is treated as a subdomain under `src/scheduling/`, not embedded directly inside view files.

## Key Abstractions

**Tournament Scope:**
- Purpose: Almost every authenticated workflow is anchored to a `tournamentId`, often plus `categoryId` and optional `levelId`.
- Examples: `src/stores/tournaments.ts`, `src/stores/matches.ts`, `src/scheduling/useScheduleStore.ts`
- Pattern: Resolve scope from route params first, then build Firestore collection paths from that scope.

**Dual Match Model:**
- Purpose: Separate bracket structure from operational state.
- Examples: `src/stores/bracketMatchAdapter.ts`, `src/stores/matches.ts`, `functions/src/updateMatch.ts`
- Pattern: Read structure from `.../match`, overlay operational fields from `.../match_scores`, and write operational updates back to `match_scores` while preserving bracket-manager as the source of bracket progression.

**Route Meta as Control Plane:**
- Purpose: Keep layout, public/private access, volunteer flow, and overlay behavior declarative.
- Examples: `src/router/index.ts`, `src/App.vue`, `src/components/layout/VolunteerLayout.vue`
- Pattern: Set booleans like `requiresAuth`, `requiresAdmin`, `volunteerLayout`, `overlayPage`, and `obsOverlay` on routes, then branch in app shell and guards instead of duplicating access logic in views.

**Feature-Scoped Composition:**
- Purpose: Keep routed pages thin by pushing repeated logic down into composables and feature components.
- Examples: `src/features/tournaments/views/MatchControlView.vue`, `src/composables/useDialogManager.ts`, `src/composables/useParticipantResolver.ts`
- Pattern: Views coordinate, stores own data, composables derive workflow state, and components render.

## Entry Points

**Frontend application:**
- Location: `src/main.ts`
- Triggers: Vite serves `index.html`, which loads the Vue app.
- Responsibilities: Initialize Firebase, install plugins, wait for auth bootstrap, mount the app.

**Frontend route graph:**
- Location: `src/router/index.ts`
- Triggers: Every client-side navigation.
- Responsibilities: Lazy-load views, enforce auth and volunteer access, declare overlay/public/admin routes.

**Cloud Functions bundle:**
- Location: `functions/src/index.ts`
- Triggers: Firebase callable or HTTP invocations.
- Responsibilities: Export callable handlers for bracket generation, schedule generation, scoring updates, bug reports, reviews, self check-in, volunteer access, and player stats aggregation.

**Firebase hosting/deployment config:**
- Location: `firebase.json`
- Triggers: `firebase emulators:start`, `firebase deploy`
- Responsibilities: Wire Hosting to `dist`, Functions to `functions/`, and local emulator ports for auth, Firestore, storage, hosting, and functions.

## Error Handling

**Strategy:** Catch at the store/composable/function boundary, log with context, surface a user-facing message through the notification store or throw an `HttpsError` from Cloud Functions.

**Patterns:**
- Client stores log and rethrow or set `error` state, for example in `src/stores/auth.ts`, `src/stores/tournaments.ts`, and `src/stores/registrations.ts`.
- UI feedback is centralized through `src/stores/notifications.ts` and used broadly in views such as `src/features/tournaments/views/TournamentDashboardView.vue` and `src/features/tournaments/views/MatchControlView.vue`.
- Callable functions validate input early and return typed Firebase errors, as in `functions/src/updateMatch.ts` and `functions/src/volunteerAccess.ts`.

## Cross-Cutting Concerns

**Logging:** Contextual `console.error`, `console.warn`, and targeted debug logging are used throughout client stores/composables and Cloud Functions, especially in `src/stores/matches.ts`, `src/composables/useMatchScheduler.ts`, and `functions/src/index.ts`.

**Validation:** Route-level access is enforced in `src/router/index.ts`; match-scoring validation lives in `src/features/scoring/utils/validation.ts`; callable input parsing is explicit in `functions/src/updateMatch.ts` and `functions/src/volunteerAccess.ts`.

**Authentication:** User auth is initialized in `src/stores/auth.ts`; admin/organizer/scorekeeper gating is route-meta-driven in `src/router/index.ts`; volunteer kiosk access uses signed session tokens managed by `src/stores/volunteerAccess.ts` and `functions/src/volunteerAccess.ts`.

---

*Architecture analysis: 2026-03-21*
