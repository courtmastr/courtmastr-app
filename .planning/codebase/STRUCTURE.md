# Codebase Structure

**Analysis Date:** 2026-03-21

## Directory Layout

```text
courtmaster-v2/
├── src/                    # Frontend application source
├── functions/              # Firebase Cloud Functions source and compiled lib output
├── tests/                  # Vitest unit and integration tests
├── e2e/                    # Playwright end-to-end suites and fixtures
├── public/                 # Static assets copied by Vite
├── docs/                   # Product, process, bug, and architecture documentation
├── scripts/                # Local automation, seeding, diagnostics, and logging helpers
├── .planning/codebase/     # Generated codebase maps for planning agents
├── firebase.json           # Hosting, functions, and emulator wiring
├── vite.config.ts          # Vite app build and alias configuration
├── vitest.config.ts        # Vitest configuration and aliases
├── playwright.config.ts    # Playwright test configuration
└── package.json            # Root scripts and frontend dependencies
```

## Directory Purposes

**`src/`:**
- Purpose: All shipped frontend source.
- Contains: Vue app bootstrap, routed features, shared components, Pinia stores, composables, services, scheduling helpers, types, utilities, and styling.
- Key files: `src/main.ts`, `src/App.vue`, `src/router/index.ts`, `src/services/firebase.ts`, `src/types/index.ts`

**`src/features/`:**
- Purpose: Feature-sliced routed UI and feature-local components.
- Contains: `views/` for route components and `components/` for feature-owned building blocks. Some features also add `dialogs/`, `utils/`, or feature-local composables.
- Key files: `src/features/tournaments/views/MatchControlView.vue`, `src/features/tournaments/views/TournamentDashboardView.vue`, `src/features/public/views/HomeView.vue`, `src/features/scoring/views/ScoringInterfaceView.vue`

**`src/components/`:**
- Purpose: Shared UI not owned by a single feature.
- Contains: Layouts, navigation, admin widgets, leaderboard widgets, and generic primitives.
- Key files: `src/components/layout/AppLayout.vue`, `src/components/layout/VolunteerLayout.vue`, `src/components/navigation/AppNavigation.vue`, `src/components/common/BaseDialog.vue`

**`src/stores/`:**
- Purpose: App-wide Pinia setup stores with Firestore listeners and domain actions.
- Contains: Auth, tournaments, matches, registrations, activities, alerts, organizations, users, and volunteer access.
- Key files: `src/stores/auth.ts`, `src/stores/tournaments.ts`, `src/stores/matches.ts`, `src/stores/registrations.ts`

**`src/composables/`:**
- Purpose: Reusable Composition API logic shared across views/components.
- Contains: Display helpers, workflow logic, async helpers, branding/navigation helpers, scheduling helpers, and participant resolution.
- Key files: `src/composables/useParticipantResolver.ts`, `src/composables/useMatchScheduler.ts`, `src/composables/useTournamentStateAdvance.ts`, `src/composables/useNavigation.ts`

**`src/scheduling/`:**
- Purpose: Scheduling-specific subdomain that is separate from generic composables.
- Contains: Schedule rules, capacity guards, target resolution, orchestration, and persistence helpers for draft/publish flows.
- Key files: `src/scheduling/useScheduleOrchestrator.ts`, `src/scheduling/useScheduleStore.ts`, `src/scheduling/scheduleCapacityGuard.ts`

**`src/services/`:**
- Purpose: Infrastructure-facing helpers and thin service wrappers.
- Contains: Firebase initialization, storage helpers, export helpers, navigation service, branding storage, review service.
- Key files: `src/services/firebase.ts`, `src/services/reviewsService.ts`, `src/services/tournamentBrandingStorage.ts`, `src/services/orgBrandingStorage.ts`

**`src/types/`:**
- Purpose: Canonical frontend type definitions.
- Contains: Core domain types, advanced contracts, router meta typing, leaderboard/scoring support types, and ambient declarations.
- Key files: `src/types/index.ts`, `src/types/router-meta.d.ts`, `src/types/scoring.ts`

**`functions/src/`:**
- Purpose: Cloud Function source for privileged backend behavior.
- Contains: Callable handlers, Firestore adapter for brackets-manager, backend types, and volunteer/session helpers.
- Key files: `functions/src/index.ts`, `functions/src/updateMatch.ts`, `functions/src/volunteerAccess.ts`, `functions/src/storage/firestore-adapter.ts`

**`functions/lib/`:**
- Purpose: Compiled JavaScript output for Firebase Functions.
- Contains: Built `.js` and `.js.map` files corresponding to `functions/src/`.
- Key files: `functions/lib/index.js`, `functions/lib/updateMatch.js`

**`tests/`:**
- Purpose: Vitest unit and integration coverage for frontend stores, composables, utilities, and routed views.
- Contains: `tests/unit/`, `tests/integration/`, and setup helpers under `tests/setup/` and `tests/integration/setup/`.
- Key files: `tests/unit/matches.subscription.store.test.ts`, `tests/unit/MatchControlView.auto-assign.test.ts`, `tests/integration/tournament-management.integration.test.ts`

**`e2e/`:**
- Purpose: Playwright browser-level regression and workflow coverage.
- Contains: Auth setup/teardown, fixtures, models, utilities, and end-to-end specs.
- Key files: `e2e/p0-match-control-scoring.spec.ts`, `e2e/p0-self-checkin-kiosk.spec.ts`, `e2e/auth.setup.ts`

**`public/`:**
- Purpose: Static assets served directly by Vite/Firebase Hosting.
- Contains: Icons, manifest files, screenshots, and printable HTML assets.
- Key files: `public/site.webmanifest`, `public/logo.svg`, `public/printables/qr-card.html`

**`docs/`:**
- Purpose: Human-facing project knowledge base.
- Contains: Process guides, architecture notes, feature rules, debug KB, deployment notes, tech debt, and plans.
- Key files: `docs/process/BRANCHING_STRATEGY.md`, `docs/process/TEST_STRATEGY.md`, `docs/coding-patterns/CODING_PATTERNS.md`, `docs/migration/DATA_MODEL_MIGRATION_RULES.md`

**`scripts/`:**
- Purpose: Local-only automation and diagnostics.
- Contains: Logging wrappers, dev startup, data seeding, verification helpers, bracket utilities, and browser helpers.
- Key files: `scripts/run-and-log.mjs`, `scripts/check-firebase-env.mjs`, `scripts/start-dev.mjs`, `scripts/agent-browser.sh`

## Key File Locations

**Entry Points:**
- `src/main.ts`: Frontend bootstrap and auth-gated mount.
- `src/router/index.ts`: Route graph, lazy loading, access checks, volunteer flow routing.
- `functions/src/index.ts`: Cloud Functions export surface.
- `index.html`: Vite HTML shell.

**Configuration:**
- `package.json`: Root commands, app dependencies, and dev tooling.
- `vite.config.ts`: Vite plugins, PWA setup, aliases, dev server, build chunking.
- `vitest.config.ts`: Vitest environment, include/exclude patterns, aliases.
- `playwright.config.ts`: E2E runner configuration.
- `firebase.json`: Hosting/functions/emulator configuration.
- `tsconfig.json`: Root TypeScript project references.
- `functions/tsconfig.json`: Functions TypeScript compilation target.

**Core Logic:**
- `src/stores/matches.ts`: Match loading, realtime subscriptions, scoring, assignment, and match path resolution.
- `src/stores/tournaments.ts`: Tournament, category, and court lifecycle.
- `src/composables/useMatchScheduler.ts`: Court/time scheduling workflow.
- `src/scheduling/useScheduleOrchestrator.ts`: Multi-scope schedule run/publish orchestration.
- `src/stores/bracketMatchAdapter.ts`: brackets-manager to app-model translation.
- `functions/src/updateMatch.ts`: Privileged match mutation and bracket advancement backend.

**Testing:**
- `tests/unit/`: Unit tests for components, stores, composables, and utilities.
- `tests/integration/`: Higher-level data-flow and feature integration tests.
- `tests/setup/browser-storage.ts`: Shared Vitest setup.
- `e2e/`: Playwright suites for browser workflows.

## Naming Conventions

**Files:**
- Routed views use `*View.vue`: `src/features/tournaments/views/TournamentDashboardView.vue`
- Shared and feature components use PascalCase `.vue`: `src/features/tournaments/components/CourtGrid.vue`
- Composables use `use*.ts`: `src/composables/useParticipantResolver.ts`
- Stores use domain filenames and export `use...Store`: `src/stores/tournaments.ts`
- Scheduling helpers use domain-specific verb/noun names under `src/scheduling/`: `src/scheduling/useScheduleStore.ts`
- Types are centralized or split by concern under `src/types/`: `src/types/index.ts`, `src/types/scoring.ts`

**Directories:**
- Feature folders are lowercase singular/plural domain names under `src/features/`: `src/features/tournaments/`, `src/features/checkin/`
- Shared source folders are responsibility-based and flat: `src/components/`, `src/composables/`, `src/services/`, `src/stores/`
- Backend code keeps source and build output separated: `functions/src/` and `functions/lib/`

## Where to Add New Code

**New Feature:**
- Primary code: Add routed pages under `src/features/<feature>/views/` and feature-only pieces under `src/features/<feature>/components/`.
- Tests: Add unit or integration coverage under `tests/unit/` or `tests/integration/`; add browser workflow coverage under `e2e/` only when the feature needs end-to-end coverage.

**New Component/Module:**
- Implementation: Put cross-feature UI in `src/components/`; keep single-feature UI in that feature’s `components/` or `dialogs/` folder.

**Utilities:**
- Shared helpers: Put infrastructure helpers in `src/services/`, pure transforms in `src/utils/`, reusable reactive workflows in `src/composables/`, and schedule-domain logic in `src/scheduling/`.

**New Store or Domain State:**
- Implementation: Add a setup-style Pinia store in `src/stores/<domain>.ts`.
- Use this only when state must be shared across routes/components or requires long-lived realtime listeners.

**New Firebase backend behavior:**
- Implementation: Add the source handler in `functions/src/<name>.ts` and export it from `functions/src/index.ts`.
- Keep frontend invocation code in the relevant store or service, not in the view file.

**New Types:**
- Implementation: Extend `src/types/index.ts` for core shared types; use a focused file in `src/types/` only when the concern is large enough to stand alone.

## Special Directories

**`functions/lib/`:**
- Purpose: Compiled Cloud Functions artifacts generated from `functions/src/`.
- Generated: Yes
- Committed: Yes

**`dist/`:**
- Purpose: Vite production build output used by Firebase Hosting.
- Generated: Yes
- Committed: Yes

**`coverage/`:**
- Purpose: Test coverage output from Vitest.
- Generated: Yes
- Committed: Yes

**`.planning/codebase/`:**
- Purpose: Agent-generated reference docs for later planning and execution steps.
- Generated: Yes
- Committed: Intended to be committed when refreshed

**`docs/debug-kb/_artifacts/`:**
- Purpose: Failure logs captured by `:log` command wrappers.
- Generated: Yes
- Committed: No by convention of use, but artifacts exist in the repo workspace

---

*Structure analysis: 2026-03-21*
