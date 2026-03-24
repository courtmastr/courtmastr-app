# Codebase Concerns

**Analysis Date:** 2026-03-21

## Tech Debt

**Bracket and scheduling logic exists in competing client and Cloud Function paths:**
- Issue: The active UI path is client-side (`USE_CLOUD_FUNCTION_FOR_BRACKETS = false`, `USE_CLOUD_FUNCTION_FOR_SCHEDULE = false`), but legacy callable code remains live and uses different storage assumptions.
- Files: `src/stores/tournaments.ts`, `src/composables/useBracketGenerator.ts`, `src/composables/useMatchScheduler.ts`, `src/services/brackets-storage.ts`, `functions/src/bracket.ts`, `functions/src/scheduling.ts`, `functions/src/index.ts`, `functions/src/manager.ts`, `functions/src/storage/firestore-adapter.ts`
- Impact: Future changes can fix one execution path while leaving the other broken. Migration bugs are likely because category-scoped data and tournament-scoped data are both still represented in code and rules.
- Fix approach: Pick one authoritative execution path for bracket generation, scheduling, and winner advancement. Remove or hard-disable the non-authoritative path, then add contract tests around the remaining adapter and path conventions.

**Operational views and stores are oversized and carry too many responsibilities:**
- Issue: Several files combine data fetching, state orchestration, routing, UI state, and business rules in single modules.
- Files: `src/features/tournaments/views/MatchControlView.vue`, `src/features/registration/views/RegistrationManagementView.vue`, `src/features/public/views/PublicScheduleView.vue`, `src/stores/matches.ts`, `src/stores/tournaments.ts`, `src/composables/useBracketGenerator.ts`
- Impact: Small fixes have large blast radius. Review cost is high, and regressions tend to appear in unrelated behaviors because the same file owns multiple flows.
- Fix approach: Split by responsibility before adding new features. Extract read models, route/query adapters, and Firestore mutation helpers into smaller composables or services with narrow tests.

**Repository-wide typing debt is documented and still visible in source:**
- Issue: The cleanup plan explicitly records prior TypeScript bypass pressure, and current source still contains broad `any` usage in bracket, scoring, registration, and admin flows.
- Files: `docs/tech-debt/TYPESCRIPT_CLEANUP_PLAN.md`, `src/features/scoring/components/ScoreCorrectionDialog.vue`, `src/features/registration/views/RegistrationManagementView.vue`, `src/features/tournaments/views/TournamentCreateView.vue`, `src/features/tournaments/views/TournamentDashboardView.vue`, `functions/src/storage/firestore-adapter.ts`
- Impact: Type drift weakens the data-model migration guardrails and makes refactors across scoring and bracket data much riskier.
- Fix approach: Prioritize the files named in `docs/tech-debt/TYPESCRIPT_CLEANUP_PLAN.md`, replace `any` with concrete types at the Firestore boundary, and add adapter-level type tests before further model changes.

**Debug logging remains embedded in hot runtime paths:**
- Issue: Bracket generation, scheduling, match fetches, auth, and viewer rendering emit extensive `console.log` output during normal operation.
- Files: `src/stores/matches.ts`, `src/composables/useBracketGenerator.ts`, `src/composables/useMatchScheduler.ts`, `src/stores/auth.ts`, `src/features/brackets/components/BracketsManagerViewer.vue`, `functions/src/bracket.ts`, `functions/src/storage/firestore-adapter.ts`, `functions/src/bugReport.ts`
- Impact: Production debugging becomes noisy, emulator logs are harder to triage, and sensitive operational data is more likely to be overexposed in logs.
- Fix approach: Replace ad hoc logs with a gated logger utility and standardize on structured error-only logging for production code paths.

## Known Bugs

**Bracket regeneration cannot safely delete existing stages:**
- Symptoms: Cloud Function bracket generation leaves stage-deletion logic commented out because it fails with `"Could not delete match games"`.
- Files: `functions/src/bracket.ts`
- Trigger: Re-running bracket generation against a category that already has bracket artifacts.
- Workaround: Use the client-side bracket regeneration flow and explicit cleanup helpers instead of relying on the function-side delete path.

**E2E scoring page model ignores the mandatory category-scoped route contract:**
- Symptoms: The Playwright page object navigates to `/matches/:matchId/score` without the required `?category=` query, while the scoring view reads `route.query.category` to resolve the Firestore path.
- Files: `e2e/models/ScoringInterfacePage.ts`, `src/features/scoring/views/ScoringInterfaceView.vue`, `docs/coding-patterns/CODING_PATTERNS.md`
- Trigger: Reusing `ScoringInterfacePage.goto()` against category-scoped or level-scoped matches.
- Workaround: Tests that need reliable scoring navigation pass `category` manually instead of using the page object helper.

## Security Considerations

**Tournament registration and player mirrors are publicly readable:**
- Risk: Tournament subcollections allow public reads even though registration records carry operational and participant metadata such as `paymentStatus`, `bibNumber`, and `participantPresence`.
- Files: `firestore.rules`, `src/types/index.ts`, `src/features/registration/views/RegistrationManagementView.vue`, `src/stores/registrations.ts`
- Current mitigation: None in rules; privacy relies on the UI not exposing every field.
- Recommendations: Restrict `tournaments/{id}/registrations` and `tournaments/{id}/players` reads to authorized roles, and introduce explicit public projection documents for pages that need public data.

**Global identity indexes are writable by any authenticated user:**
- Risk: Any signed-in user can write to `/playerEmailIndex/{emailNormalized}` and `/orgSlugIndex/{slug}`. That allows collisions, hijacking, or accidental corruption of uniqueness indexes used by org and global-player flows.
- Files: `firestore.rules`, `src/stores/players.ts`
- Current mitigation: Client code uses `runTransaction()` for normal writes, but rules do not enforce transaction intent or owner/admin checks.
- Recommendations: Move index writes behind admin-controlled Functions or stricter rules, and make index docs append-only from trusted code paths only.

**Volunteer session tokens persist in `localStorage`:**
- Risk: Volunteer access session tokens remain available to any script that executes in the browser context until expiration.
- Files: `src/stores/volunteerAccess.ts`, `functions/src/volunteerAccess.ts`, `functions/src/volunteerAccessCore.ts`
- Current mitigation: Tokens are signed, include `pinRevision`, and expire after 12 hours.
- Recommendations: Prefer `sessionStorage` for kiosk-like sessions, shorten TTL for volunteer roles, and consider exchanging the token for a server-managed session if browser persistence becomes a wider attack surface.

**Bug-report screenshots are public-by-URL and the GitHub integration uses raw env vars:**
- Risk: Uploaded screenshots are world-readable from Storage, and the bug-report callable reads `GITHUB_TOKEN` and related config directly from process environment instead of managed Functions secrets.
- Files: `storage.rules`, `src/components/layout/AppLayout.vue`, `functions/src/bugReport.ts`
- Current mitigation: Uploads are authenticated and limited to image MIME types with a 5 MB cap.
- Recommendations: Replace public screenshot access with signed URLs or an admin-gated proxy, scrub uploaded filenames, and migrate GitHub credentials to Functions secrets before extending the bug-report flow.

## Performance Bottlenecks

**Match subscriptions re-read too much data too often:**
- Problem: `subscribeAllMatches()` creates `2N+1` listeners for categories alone, adds more per level, and each refresh path calls `fetchMatches()`, which re-reads registrations plus `match`, `match_scores`, `participant`, `round`, and `group` for every target scope.
- Files: `src/stores/matches.ts`, `src/stores/bracketMatchAdapter.ts`
- Cause: The store rebuilds the entire adapted match list on most snapshot changes instead of incrementally patching cached scope data.
- Improvement path: Cache registrations and structure maps separately, keep per-scope state, and patch only changed docs from `docChanges()` instead of full re-fetches.

**Scheduling runs do full category scans and repeated adaptation work:**
- Problem: Each schedule run reads all matches, registrations, participants, rounds, groups, and match-scores for the selected scope before filtering schedulable matches.
- Files: `src/composables/useMatchScheduler.ts`, `src/scheduling/useScheduleOrchestrator.ts`
- Cause: Scheduler input is rebuilt from Firestore on every run rather than from a precomputed in-memory schedule model.
- Improvement path: Introduce a schedule snapshot layer keyed by category/level scope and reuse the match-store cache for unchanged supporting data.

**Tournament completion stats aggregation does a collection-group scan and a single large batch:**
- Problem: Player stats are recalculated by scanning all completed `match_scores` for the tournament and then applying one Firestore batch for every player delta.
- Files: `functions/src/playerStats.ts`
- Cause: Aggregation is tournament-completion-driven instead of match-completion-driven, and the write path does not chunk batches.
- Improvement path: Chunk writes in batches of 500 or fewer and consider incremental stat updates per completed match with an idempotent ledger.

**Court maintenance reassignment performs serial cross-category updates:**
- Problem: Setting a court to maintenance loops through categories, queries match-scores per category, and updates matches/courts one document at a time.
- Files: `src/stores/tournaments.ts`
- Cause: Reassignment logic is implemented as a synchronous nested loop rather than a batched mutation plan.
- Improvement path: Build a single reassignment plan first, then commit the resulting match/court changes in a transaction or bounded write batches.

## Fragile Areas

**Category and level path resolution for scoring remains easy to break:**
- Files: `src/features/scoring/views/ScoringInterfaceView.vue`, `src/features/scoring/views/MatchListView.vue`, `src/features/tournaments/views/TournamentDashboardView.vue`, `src/components/admin/AuditLogViewer.vue`, `e2e/models/ScoringInterfacePage.ts`
- Why fragile: The router path itself does not encode `categoryId`, but data loading requires it for category-scoped collections. Any navigation helper that drops the query param regresses to "Match not found".
- Safe modification: Treat `categoryId` as part of the scoring route contract. Every new navigation helper, page object, and audit/deep-link generator must pass `query.category`.
- Test coverage: Partial. There are unit tests around volunteer match routing and some explicit query-param flows, but the shared Playwright scoring page helper still violates the contract.

**Court state and match state can drift and require repair code:**
- Files: `src/stores/matches.ts`, `src/stores/tournaments.ts`, `functions/src/updateMatch.ts`
- Why fragile: Court release, assignment, delay, unschedule, and completion updates span multiple docs and multiple code paths. The existence of `checkAndFixConsistency()` shows the invariant already breaks in practice.
- Safe modification: Centralize all match-to-court mutations in one transaction-capable service and add invariant tests that assert court occupancy and match status remain synchronized.
- Test coverage: Focused tests exist for some assignment gates and scoring paths, but there is no single contract suite covering all court lifecycle transitions.

**Client and server bracket adapters carry divergent assumptions:**
- Files: `src/services/brackets-storage.ts`, `functions/src/storage/firestore-adapter.ts`, `functions/src/manager.ts`, `functions/src/index.ts`, `src/composables/useBracketGenerator.ts`
- Why fragile: Comments and code acknowledge path differences as "intentional", but the codebase also contains category-scoped manager initialization and tournament-scoped callable paths at the same time.
- Safe modification: Normalize all bracket reads and writes to category/level scope only, then add shared adapter conformance tests that run against both client and server implementations.
- Test coverage: Limited. `tests/unit/firestoreAdapter.test.ts` covers parts of the adapter, but there is no end-to-end contract test for client/server path parity.

**Auth sign-in still depends on polling for downstream profile state:**
- Files: `src/stores/auth.ts`, `src/router/index.ts`
- Why fragile: `signIn()` resolves by polling `currentUser` with a timeout. If profile fetches slow down or rules change, routing can proceed with incomplete user state.
- Safe modification: Resolve sign-in from a single awaited auth/profile initialization promise instead of a timeout-based poller.
- Test coverage: Route-guard tests exist, but they do not stress delayed Firestore profile resolution.

## Scaling Limits

**Listener growth is proportional to category and level count:**
- Current capacity: `subscribeAllMatches()` documents its own baseline as `2N+1` listeners for categories, with additional listeners per level scope.
- Limit: Multi-category tournaments with many level splits and multiple open organizer tabs will generate high Firestore listener counts and frequent whole-scope rebuilds.
- Scaling path: Move from per-scope live listeners to denormalized aggregate docs or a server-generated operational match feed.

**Batch write limits can be exceeded in tournament-wide operations:**
- Current capacity: `functions/src/playerStats.ts` writes all affected players in a single batch; adapter update/delete helpers also assume one batch is enough for the matched doc set.
- Limit: Large tournaments with more than 500 player updates or large delete/update targets will hit Firestore batch limits.
- Scaling path: Implement chunked batch helpers shared by Cloud Functions and client utilities, then apply them anywhere a query result can exceed 500 docs.

**Scheduling and public views assume entire tournament datasets fit comfortably in memory:**
- Current capacity: `src/stores/matches.ts`, `src/composables/useMatchScheduler.ts`, and `src/features/public/views/PublicScheduleView.vue` all build large in-memory derived collections from raw Firestore reads.
- Limit: Very large events will pay in CPU, memory, and client-side sort/filter time before any UI is shown.
- Scaling path: Introduce paged or precomputed public feeds and avoid recomputing full adapted match graphs on every reactive update.

## Dependencies at Risk

**`firebase-functions` usage is split across v1 and v2 patterns:**
- Risk: The repo mixes `functions.https.onCall`/commented v1 Firestore trigger code with `onDocumentUpdated` from `firebase-functions/v2/firestore`.
- Impact: Future Functions upgrades and trigger additions will keep hitting syntax/runtime mismatches, as shown by the disabled match-ready trigger.
- Migration plan: Standardize new and existing Functions on v2, migrate secrets and triggers accordingly, and remove commented compatibility stubs.

**`brackets-manager` is deeply coupled through custom adapters and loose typing:**
- Risk: The package is not used through a thin wrapper; application logic reaches directly into custom adapters, storage assumptions, and bracket-specific numeric/string ID conversions.
- Impact: Library upgrades or data-model changes will break both generation and scoring propagation in multiple places at once.
- Migration plan: Wrap `brackets-manager` behind a domain service with contract tests and keep adapter logic out of views/stores.

**`oh-my-opencode-darwin-arm64` is shipped as an application dependency with no runtime usage in app code:**
- Risk: A platform-specific developer tool is listed under root `dependencies` rather than `devDependencies`.
- Impact: It adds avoidable install and lockfile churn and can complicate CI or non-Darwin environments.
- Migration plan: Remove it from production dependencies or move it to a tool-specific workspace or `devDependencies` if it is still needed locally.

## Missing Critical Features

**Automatic "match ready" notifications are disabled:**
- Problem: The Firestore trigger that should react to match readiness is commented out due to API incompatibility, and the TODO for participant notifications remains unresolved.
- Blocks: Reliable system-generated participant notifications when matches become ready.

**Security-rule verification is not present:**
- Problem: No Firestore or Storage rules test suite was detected under `tests/` or `e2e/`.
- Blocks: Safe tightening of public-read and uniqueness-index rules without fear of silent auth regressions.

## Test Coverage Gaps

**Most Cloud Function entry points do not have direct behavioral tests:**
- What's not tested: `functions/src/updateMatch.ts`, `functions/src/bracket.ts`, `functions/src/scheduling.ts`, `functions/src/bugReport.ts`, and `functions/src/reviews.ts`
- Files: `functions/src/updateMatch.ts`, `functions/src/bracket.ts`, `functions/src/scheduling.ts`, `functions/src/bugReport.ts`, `functions/src/reviews.ts`
- Risk: The highest-risk server-side mutation paths can drift from client expectations without a red test.
- Priority: High

**Migration path parity between client and server bracket flows is not covered end-to-end:**
- What's not tested: Category-scoped versus tournament-scoped bracket reads/writes across generation, advancement, scheduling, and score propagation.
- Files: `src/services/brackets-storage.ts`, `functions/src/storage/firestore-adapter.ts`, `functions/src/index.ts`, `functions/src/manager.ts`
- Risk: Future cleanup phases can accidentally reactivate legacy paths or break adapter assumptions without immediate detection.
- Priority: High

**Operational security rules lack regression coverage:**
- What's not tested: Public-read behavior for tournament subcollections, authenticated writes to `/playerEmailIndex`, public Storage reads for bug-report screenshots, and admin-only review moderation paths.
- Files: `firestore.rules`, `storage.rules`
- Risk: Security fixes may be delayed because the repository has no fast way to prove rules behavior.
- Priority: High

**E2E helpers and reports have drifted from the current route contract:**
- What's not tested: Shared page objects enforcing the category query parameter required by scoring routes.
- Files: `e2e/models/ScoringInterfacePage.ts`, `src/features/scoring/views/ScoringInterfaceView.vue`, `docs/coding-patterns/CODING_PATTERNS.md`
- Risk: Future E2E additions may accidentally codify the wrong navigation pattern and hide real routing regressions.
- Priority: Medium

---

*Concerns audit: 2026-03-21*
