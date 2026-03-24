# Coding Conventions

**Analysis Date:** 2026-03-21

## Naming Patterns

**Files:**
- Vue SFCs use PascalCase names for components and views, for example `src/components/common/BaseDialog.vue`, `src/components/layout/AppLayout.vue`, and `src/features/tournaments/views/TournamentCreateView.vue`.
- Composables use camelCase files starting with `use`, for example `src/composables/useAsyncOperation.ts`, `src/composables/useParticipantResolver.ts`, and `src/features/checkin/composables/useSelfCheckIn.ts`.
- Store files live under `src/stores/` and use lowercase or plural resource names in the filename, while exporting a `use...Store` composable, for example `src/stores/tournaments.ts` exports `useTournamentStore` and `src/stores/notifications.ts` exports `useNotificationStore`.
- Utility and service files use descriptive camelCase names, for example `src/services/reviewsService.ts`, `src/features/tournaments/utils/scheduleExport.ts`, and `src/features/checkin/composables/checkInSearchUtils.ts`.

**Functions:**
- Store actions are usually function declarations inside `defineStore(...)`, for example `fetchTournament`, `createTournament`, and `subscribeTournament` in `src/stores/tournaments.ts`.
- Exported helpers in services and composables commonly use `export const` arrow functions with explicit return types, for example `submitReview` in `src/services/reviewsService.ts` and `seedDocument` in `tests/integration/setup/firestore-fixtures.ts`.
- Test helpers and builders use `make...`, `build...`, `mount...`, and `configure...` prefixes, for example `makeRegistration` in `tests/integration/public-views.integration.test.ts` and `mountWorkflowHarness` in `tests/unit/useFrontDeskCheckInWorkflow.test.ts`.

**Variables:**
- Reactive state uses lower camelCase `ref()` and `computed()` names such as `loading`, `error`, `currentTournament`, `unreadCount`, and `continueDisabledReason` in `src/stores/tournaments.ts`, `src/stores/notifications.ts`, and `src/features/tournaments/views/TournamentCreateView.vue`.
- Shared mutable test state is usually grouped into `runtime` or `runtimeState` objects, and mock collections are grouped into `mockDeps`, for example `tests/unit/AppLayout.publicFooter.test.ts` and `tests/integration/match-assignment.integration.test.ts`.

**Types:**
- Interfaces and type aliases use PascalCase, often with domain suffixes such as `AsyncOperationState`, `SubmitSelfCheckInInput`, `WorkflowHarnessOptions`, and `EmulatorUserProfile` in `src/composables/useAsyncOperation.ts`, `src/features/checkin/composables/useSelfCheckIn.ts`, `tests/unit/useFrontDeskCheckInWorkflow.test.ts`, and `tests/integration/setup/auth-fixtures.ts`.
- Request/response and state-shape names often end with `Input`, `Response`, `Result`, `State`, or `Options`.

**Constants:**
- App-level constants use `UPPER_SNAKE_CASE`, for example `USE_CLOUD_FUNCTION_FOR_BRACKETS` in `src/stores/tournaments.ts`, `DEFAULT_COMMANDS` in `scripts/testing/verify-release.mjs`, and `POST_LOGIN_URL_RE` in `e2e/utils/auth.ts`.

## Code Style

**Formatting:**
- No Prettier or Biome config is detected. Formatting is maintained through repository conventions plus ESLint autofix via `npm run lint` and `npm run lint:log` in `package.json`.
- TypeScript strict mode is enabled in `tsconfig.app.json` with `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`.
- Vue files use `<script setup lang="ts">` as the default pattern, for example `src/components/common/BaseDialog.vue` and `src/features/tournaments/views/TournamentCreateView.vue`.

**Linting:**
- ESLint uses the classic config file `.eslintrc.cjs` with `vue-eslint-parser`, `plugin:vue/vue3-recommended`, and `plugin:@typescript-eslint/recommended`.
- The lint command forces legacy config mode with `ESLINT_USE_FLAT_CONFIG=false` in `package.json`.
- Repository rules currently disable `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars` in `.eslintrc.cjs`, so code review and `AGENTS.md` policy carry more weight than lint for those cases.
- `vue/valid-v-slot` remains enforced and `vue/multi-word-component-names` is disabled.

## Import Organization

**Order:**
1. Framework and runtime imports first, such as `vue`, `vue-router`, `pinia`, and test runners. See `src/features/tournaments/views/TournamentCreateView.vue`, `src/stores/tournaments.ts`, and `tests/unit/BaseDialog.test.ts`.
2. Internal stores next, then composables and services, typically via the `@/` alias. See `src/features/scoring/views/ScoringInterfaceView.vue` and `src/features/admin/views/UserManagementView.vue`.
3. Components, constants, and type-only imports follow. Relative imports are usually reserved for same-feature utilities or sibling files, such as `../utils/validation` in `src/features/scoring/views/ScoringInterfaceView.vue` and `./brackets-storage-utils` in `src/services/brackets-storage.ts`.

**Path Aliases:**
- `@/*` maps to `src/*` in `tsconfig.app.json` and `vitest.config.ts`. Use it for application code in `src/` from both source and test files.
- `@tests` exists only in `vitest.config.ts`; the current suite rarely uses it.
- Playwright and helper scripts under `e2e/` use relative imports instead of aliases, for example `e2e/p0-court-management.spec.ts` and `e2e/fixtures/auth-fixtures.ts`.

## State Management

**Pinia Setup Stores:**
- Stores use the setup-store pattern: `defineStore('name', () => { ... })` with `ref()` state, `computed()` getters, action functions, and an explicit returned object. See `src/stores/auth.ts`, `src/stores/tournaments.ts`, and `src/stores/notifications.ts`.
- Store state usually includes the domain collection plus `loading` and `error` refs. This pattern is consistent in `src/stores/auth.ts`, `src/stores/notifications.ts`, and `src/stores/tournaments.ts`.

**Subscriptions and Firestore State:**
- Realtime listeners are kept inside stores and paired with unsubscribe handles, for example `tournamentsUnsubscribe` in `src/stores/tournaments.ts` and `notificationsUnsubscribe` in `src/stores/notifications.ts`.
- Timestamp normalization is centralized through helpers like `convertTimestamps` in `src/utils/firestore.ts`, which stores apply after Firestore reads.

**Component vs Shared State:**
- Page-local wizard or dialog state stays inside the component, for example `currentStep`, `name`, `settings`, and `courts` in `src/features/tournaments/views/TournamentCreateView.vue`.
- Reusable async or workflow state gets extracted into composables that return reactive refs and action functions, for example `src/composables/useAsyncOperation.ts` and `src/features/checkin/composables/useSelfCheckIn.ts`.

**User Feedback:**
- Toast and transient notification state is centralized in `src/stores/notifications.ts`. Feature code calls `useNotificationStore().showToast(...)` rather than managing ad hoc alerts.

## Error Handling

**Patterns:**
- Async flows usually reset `error.value = null` before work, set `loading.value = true`, wrap the operation in `try/catch/finally`, and clear loading in `finally`. See `src/stores/auth.ts`, `src/stores/tournaments.ts`, `src/stores/notifications.ts`, and `src/features/checkin/composables/useSelfCheckIn.ts`.
- Errors are logged with context-specific messages using `console.error(...)`, then either converted into user-facing text on the reactive `error` ref or rethrown for upstream handling.
- Store actions that the caller must react to often rethrow after logging, for example `fetchTournament` in `src/stores/tournaments.ts`, `markAsRead` in `src/stores/notifications.ts`, and `submit` in `src/features/checkin/composables/useSelfCheckIn.ts`.
- Fallback behavior is explicit when partial recovery is possible. `src/stores/auth.ts` builds a limited-access user if Firestore profile reads fail during auth initialization.

## Logging

**Framework:** `console`

**Patterns:**
- Application logging is plain `console.log`, `console.warn`, and `console.error`, usually with a function or feature prefix. Examples include `[createTournament]` logging in `src/features/tournaments/views/TournamentCreateView.vue`, `[signIn]` logging in `src/stores/auth.ts`, and `[useAsyncOperation]` logging in `src/composables/useAsyncOperation.ts`.
- Verification logging is standardized by `scripts/run-and-log.mjs`, which writes artifacts under `docs/debug-kb/_artifacts/` and emits an error fingerprint when a logged command fails.
- The debug knowledge base index in `docs/debug-kb/index.yml` records recurring `build:log`, `test:log`, and `lint:log` outcomes; future work should use the same logged commands so failures stay traceable.

## Comments

**When to Comment:**
- Comments are used for architectural constraints and non-obvious sequencing, not for simple assignments. See the Firebase bootstrap comments in `src/main.ts`, the compatibility notes in `e2e/models/TournamentCreatePage.ts`, and the synchronization explanation in `tests/unit/useFrontDeskCheckInWorkflow.test.ts`.
- Inline comments commonly explain why a timeout, fallback, or guard exists, especially around auth, seeding, or synchronization.

**JSDoc/TSDoc:**
- Shared building blocks are the most documented. `src/composables/useAsyncOperation.ts` and `src/components/common/BaseDialog.vue` include interface docs, parameter docs, and usage examples.
- Feature views and large stores rely more on inline section comments than full docblocks, for example `src/stores/tournaments.ts` and `src/features/tournaments/views/TournamentCreateView.vue`.

## Function Design

**Size:** Large orchestration functions and broad stores are common in feature-heavy files such as `src/stores/tournaments.ts` and `src/features/tournaments/views/TournamentCreateView.vue`. Pure helper extraction is used when logic becomes reusable or independently testable, for example `src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts` and `src/scheduling/scheduleCapacityGuard.ts`.

**Parameters:** Prefer typed primitives or small typed objects over untyped bags. Examples include `SubmitSelfCheckInInput` in `src/features/checkin/composables/useSelfCheckIn.ts`, `WorkflowHarnessOptions` in `tests/unit/useFrontDeskCheckInWorkflow.test.ts`, and explicit route or entity IDs throughout store actions.

**Return Values:** Exported async actions usually declare explicit `Promise<void>`, `Promise<string>`, or typed payload returns, for example `createTournament(): Promise<string>` in `src/stores/tournaments.ts`, `submitReview(): Promise<SubmitReviewResponse>` in `src/services/reviewsService.ts`, and `waitForPostLoginLanding(): Promise<void>` in `e2e/utils/auth.ts`.

## Module Design

**Exports:** TypeScript modules prefer named exports. Vue SFCs are consumed via the framework default export, while stores, composables, helpers, and services expose named bindings from their files.

**Barrel Files:** Barrel usage is limited and intentional. `src/scheduling/index.ts` re-exports the scheduling subsystem, and `e2e/models/index.ts` re-exports Playwright page models. Most features import concrete files directly instead of adding new barrel layers.

---

*Convention analysis: 2026-03-21*
