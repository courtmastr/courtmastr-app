# External Integrations

**Analysis Date:** 2026-03-21

## APIs & External Services

**Firebase Platform:**
- Firebase Auth - End-user authentication for email/password and Google sign-in.
  - SDK/Client: `firebase` via `src/services/firebase.ts`
  - Auth: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
  - Practical use: `src/stores/auth.ts` initializes auth state, Firestore user profiles, and Google popup sign-in.
- Cloud Firestore - Primary operational database for tournaments, registrations, matches, reviews, bug reports, and analytics.
  - SDK/Client: `firebase` in `src/services/firebase.ts`, `firebase-admin` in `functions/src/index.ts`
  - Auth: Firebase project config from the `VITE_FIREBASE_*` variables above
  - Practical use: `src/stores/tournaments.ts`, `src/stores/matches.ts`, and `functions/src/playerStats.ts`.
- Firebase Cloud Functions - Backend callable API surface plus one HTTP health endpoint.
  - SDK/Client: `firebase/functions` via `src/services/firebase.ts`
  - Auth: Firebase Auth context for staff-only callables; Functions secrets for volunteer access in `functions/src/volunteerAccess.ts`
  - Practical use: callable names currently used by the frontend are `submitReview`, `submitBugReport`, `issueVolunteerSession`, `searchSelfCheckInCandidates`, `submitSelfCheckIn`, `setVolunteerPin`, `revealVolunteerPin`, `applyVolunteerCheckInAction`, and `updateMatch`.
- Firebase Storage - Binary asset storage for org/tournament branding and bug-report screenshots.
  - SDK/Client: `firebase/storage` via `src/services/firebase.ts`
  - Auth: `VITE_FIREBASE_STORAGE_BUCKET`
  - Practical use: `src/services/orgBrandingStorage.ts`, `src/services/tournamentBrandingStorage.ts`, and `src/components/layout/AppLayout.vue`.
- Firebase Hosting - Static hosting and SPA rewrites.
  - SDK/Client: Firebase CLI deploy target defined in `firebase.json`
  - Auth: Firebase project alias from `.firebaserc`

**GitHub:**
- GitHub REST Issues API - Receives user-submitted bug reports from a callable function.
  - SDK/Client: native `fetch` in `functions/src/bugReport.ts`
  - Auth: `GITHUB_TOKEN`
  - Additional config: `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`
  - Practical use: `src/components/layout/AppLayout.vue` uploads an optional screenshot to Storage, then calls `submitBugReport`, which POSTs to `https://api.github.com/repos/{owner}/{repo}/issues`.

## Data Storage

**Databases:**
- Cloud Firestore
  - Connection: Vite Firebase web env in `src/services/firebase.ts`; admin SDK default app in `functions/src/index.ts`
  - Client: Firebase Web SDK on the client, Firebase Admin SDK in functions
  - Notable patterns:
  - Browser persistence uses `persistentLocalCache` with `persistentMultipleTabManager()` in `src/services/firebase.ts`.
  - Cross-tournament reads use collection group queries in files such as `src/stores/dashboard.ts`, `src/stores/organizations.ts`, and `functions/src/playerStats.ts`.

**File Storage:**
- Firebase Storage
  - Client usage: `src/services/orgBrandingStorage.ts`, `src/services/tournamentBrandingStorage.ts`
  - Direct UI upload usage: `src/components/layout/AppLayout.vue`
  - Stored asset paths include `orgs/{orgId}/logo/...`, `orgs/{orgId}/banner/...`, `orgs/{orgId}/sponsors/{sponsorId}/...`, `tournaments/{tournamentId}/branding/logo/...`, `tournaments/{tournamentId}/branding/sponsors/{sponsorId}/...`, and `bug-reports/{userId}/...`

**Caching:**
- Firestore offline/local cache in `src/services/firebase.ts`
- Workbox runtime caching for Firestore API traffic in `vite.config.ts`
- No Redis or external cache detected

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication
  - Implementation: email/password plus Google popup sign-in in `src/stores/auth.ts`
  - User profile authority: Firestore `users/{uid}` documents read/written in `src/stores/auth.ts`
  - Route enforcement: `src/router/index.ts`

**Secondary Access Mechanism:**
- Volunteer PIN/session system
  - Implementation: encrypted PIN storage and signed volunteer session tokens in `functions/src/volunteerAccess.ts` and `functions/src/volunteerAccessCore.ts`
  - Client persistence: localStorage-backed session store in `src/stores/volunteerAccess.ts`

## Monitoring & Observability

**Error Tracking:**
- None detected for third-party SaaS products such as Sentry, Rollbar, Bugsnag, or PostHog.
- User-facing bug intake exists through `submitBugReport` in `functions/src/bugReport.ts`, with issue creation in GitHub and Firestore persistence.

**Logs:**
- Application and function logging uses `console.log`, `console.warn`, and `console.error` across `src/**` and `functions/src/**`.
- Logged command wrappers are centralized in `scripts/run-and-log.mjs` and exposed by `package.json` `*:log` scripts.
- Deployment evidence is tracked in `docs/deployment/LAST_DEPLOY.md`.

## CI/CD & Deployment

**Hosting:**
- Firebase Hosting serves the built SPA from `dist` according to `firebase.json`.
- Cloud Functions deploy alongside hosting using Firebase CLI commands from `package.json`.

**CI Pipeline:**
- GitHub Actions workflow in `.github/workflows/ci-cd.yml`
  - CI job: checkout, `npm ci`, `npm ci --prefix functions`, generate `.env.production`, run lint, unit tests, and build
  - Deploy job: build again and run `firebase deploy --project production --non-interactive`
- Local release verification helper exists in `scripts/testing/verify-release.mjs`.

## Environment Configuration

**Required env vars:**
- Frontend Firebase config required by `scripts/check-firebase-env.mjs` and `src/services/firebase.ts`:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
- Frontend runtime toggles:
  - `VITE_USE_FIREBASE_EMULATOR`
  - `VITE_FIREBASE_EMULATOR_HOST`
  - `VITE_MARKETING_FEATURED_TOURNAMENT_ID`
- Function/server env vars:
  - `GITHUB_TOKEN`
  - `GITHUB_REPO_OWNER`
  - `GITHUB_REPO_NAME`
  - `VOLUNTEER_PIN_SECRET`
  - `VOLUNTEER_SESSION_SECRET`
- Script-only touchpoints:
  - `GOOGLE_APPLICATION_CREDENTIALS` in `scripts/seed/migrate-organizer-ids.ts`
  - `VERIFY_RELEASE_VITEST_COMMAND` and `VERIFY_RELEASE_E2E_COMMAND` in `scripts/testing/verify-release.mjs`

**Secrets location:**
- Local developer env files are present at `.env`, `.env.development`, and `.env.production`; treat them as secret-bearing files.
- CI secrets are injected in `.github/workflows/ci-cd.yml`.
- Volunteer access secrets are declared as Functions secrets on the callable definitions in `functions/src/volunteerAccess.ts`.
- GitHub bug-report credentials are plain process env lookups in `functions/src/bugReport.ts`, not Functions secret bindings.

## Webhooks & Callbacks

**Incoming:**
- Callable Firebase Functions in `functions/src/index.ts`, `functions/src/bugReport.ts`, `functions/src/reviews.ts`, `functions/src/selfCheckIn.ts`, `functions/src/updateMatch.ts`, and `functions/src/volunteerAccess.ts`
- HTTP health endpoint `healthCheck` in `functions/src/index.ts`
- Firestore document trigger `aggregatePlayerStats` in `functions/src/playerStats.ts`
- No external third-party webhook receiver endpoints detected

**Outgoing:**
- GitHub Issues API POST from `functions/src/bugReport.ts`
- Firebase Storage uploads from `src/components/layout/AppLayout.vue`, `src/services/orgBrandingStorage.ts`, and `src/services/tournamentBrandingStorage.ts`
- Google OAuth popup flow from `src/stores/auth.ts` via `GoogleAuthProvider`
- No Stripe, Twilio, Slack, SendGrid, Algolia, or analytics SaaS outbound integrations detected

## Practical Notes

- Treat `src/services/firebase.ts` as the client integration boundary. New Firebase features should be exposed there before being consumed in stores/components.
- When adding a new backend API, prefer a callable export from `functions/src/index.ts`; that matches current client usage and auth assumptions.
- If bug reporting remains important, move the GitHub credentials in `functions/src/bugReport.ts` to Functions secret bindings to match the stronger pattern already used in `functions/src/volunteerAccess.ts`.
- If you need deployment-safe env validation, extend `scripts/check-firebase-env.mjs` instead of duplicating checks in Vite code or workflows.

---

*Integration audit: 2026-03-21*
