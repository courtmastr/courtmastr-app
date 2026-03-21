# Technology Stack

**Analysis Date:** 2026-03-21

## Languages

**Primary:**
- TypeScript - Main application language in `src/**/*.ts`, `src/**/*.vue`, and `functions/src/**/*.ts`.
- Vue Single-File Components - UI layer in `src/**/*.vue` with `<script setup lang="ts">`, routed from `src/router/index.ts`.

**Secondary:**
- JavaScript / Node scripts - Operational tooling in `scripts/**/*.mjs`, `scripts/**/*.cjs`, and `.github/workflows/ci-cd.yml`.
- SCSS - Global styling in `src/style.scss` and `src/styles/_print.scss`.
- Markdown - Process, deployment, and debug docs in `docs/**`.

## Runtime

**Environment:**
- Browser SPA runtime for the frontend built from `src/main.ts`.
- Node.js 22 for Cloud Functions and CI, pinned in `functions/package.json` and `.github/workflows/ci-cd.yml`.

**Package Manager:**
- npm - Root app managed by `package.json`.
- npm - Functions package managed separately by `functions/package.json`.
- Lockfile: present in `package-lock.json` and `functions/package-lock.json`.

## Frameworks

**Core:**
- Vue 3.5 - SPA framework declared in `package.json`, bootstrapped in `src/main.ts`.
- Vite 7 - Dev server and bundler from `package.json`, configured in `vite.config.ts`.
- Vuetify 3 - Material UI system created in `src/plugins/vuetify.ts`.
- Pinia 3 - Application state layer created in `src/main.ts` and used across `src/stores/*.ts`.
- Vue Router 4 - Route graph and access control in `src/router/index.ts`.
- Firebase Web SDK 12 - Auth, Firestore, Functions, and Storage bootstrap in `src/services/firebase.ts`.
- Firebase Cloud Functions - Backend entrypoint in `functions/src/index.ts`.

**Testing:**
- Vitest 4 - Unit/integration runner configured in `vitest.config.ts`.
- `@vue/test-utils` - Vue component testing from `package.json`.
- `happy-dom` - Browser-like test environment set in `vitest.config.ts`.
- Playwright 1.58 - E2E suite driven from `e2e/**/*.spec.ts`.

**Build/Dev:**
- `vue-tsc` - Type-check gate in `package.json` build and `type-check` scripts.
- ESLint - Linting config in `.eslintrc.cjs`.
- `vite-plugin-pwa` - PWA manifest and Workbox config in `vite.config.ts`.
- Firebase CLI - Emulator and deploy orchestration via `package.json` scripts and `firebase.json`.

## Key Dependencies

**Critical:**
- `firebase` - Core client platform for auth, Firestore, callable functions, and Storage in `src/services/firebase.ts`.
- `firebase-admin` - Server-side Firebase access in `functions/src/index.ts`, `functions/src/selfCheckIn.ts`, and `functions/src/volunteerAccess.ts`.
- `firebase-functions` - Callable functions and HTTP endpoints in `functions/src/index.ts`.
- `vuetify` - Shared UI primitives and theme defaults in `src/plugins/vuetify.ts`.
- `pinia` - Store architecture used in `src/stores/auth.ts`, `src/stores/tournaments.ts`, and `src/stores/matches.ts`.
- `vue-router` - Route-level auth and public/volunteer flows in `src/router/index.ts`.

**Infrastructure:**
- `brackets-manager` - Tournament bracket generation used both client-side in `src/composables/useBracketGenerator.ts` and server-side in `functions/src/index.ts`.
- `brackets-viewer` - Bracket rendering in `src/features/brackets/components/BracketsManagerViewer.vue`.
- `vuefire` - Installed in `package.json`; not the primary Firebase bootstrap path because the app uses `src/services/firebase.ts`.
- `xlsx` - Excel schedule export in `src/features/tournaments/utils/scheduleExport.ts`.
- `html2canvas` - Announcement/bracket image export in `src/features/tournaments/components/TournamentAnnouncementCardDialog.vue` and `src/features/brackets/components/DoubleEliminationBracket.vue`.
- `qrcode` - QR generation in `src/features/tournaments/components/ScoringQrDialog.vue`.
- `vuedraggable` - Drag-and-drop queue UI in `src/features/tournaments/components/DraggableMatchQueue.vue`.

## Configuration

**Environment:**
- Firebase web config is loaded from Vite env vars in `src/services/firebase.ts`.
- Required production keys are validated by `scripts/check-firebase-env.mjs` before `npm run build`.
- Environment file templates/touchpoints exist at `.env.template`, `.env`, `.env.development`, and `.env.production`.
- Featured marketing metrics use `VITE_MARKETING_FEATURED_TOURNAMENT_ID` in `src/composables/useFeaturedTournamentMetrics.ts`.
- Emulator switching uses `VITE_USE_FIREBASE_EMULATOR` and `VITE_FIREBASE_EMULATOR_HOST` in `src/services/firebase.ts`.

**Build:**
- Frontend bundling, aliases, manual chunks, and PWA config live in `vite.config.ts`.
- Test runtime config lives in `vitest.config.ts`.
- TS project references are split across `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, and `tsconfig.vitest.json`.
- Cloud Functions TS compilation is configured in `functions/tsconfig.json`.
- Firebase project wiring is configured in `firebase.json` and `.firebaserc`.
- CI creates `.env.production` from GitHub Actions secrets in `.github/workflows/ci-cd.yml`.

## Platform Requirements

**Development:**
- Node.js 22 to match `functions/package.json` and `.github/workflows/ci-cd.yml`.
- npm for both the root app and `functions/`.
- Firebase emulators for local auth/database/functions/storage flows, configured in `firebase.json`.
- Frontend dev server runs through Vite; the repo snapshot in `vite.config.ts` uses port `3000`, while `AGENTS.md` documents `npm run dev` on port `3002`. Treat the config file as authoritative for current code.

**Production:**
- Firebase Hosting serves the SPA from `dist` per `firebase.json`.
- Firebase Cloud Functions host backend callables from `functions/src/index.ts`.
- Firestore and Firebase Storage back the primary application data paths referenced from `src/services/firebase.ts`.
- GitHub Actions deploys to the `production` Firebase project alias in `.firebaserc` using `.github/workflows/ci-cd.yml`.

## Practical Notes

- Initialize Firebase once, before store imports, using `initializeFirebase()` in `src/main.ts`. Future app entrypoints should preserve that ordering.
- Use `src/services/firebase.ts` as the single client integration seam instead of importing raw Firebase modules ad hoc.
- Prefer the existing split-package structure: frontend deps in `package.json`, backend deps in `functions/package.json`.
- Keep environment-sensitive build logic in `scripts/check-firebase-env.mjs` and `vite.config.ts`; those two files define the current release gate.

---

*Stack analysis: 2026-03-21*
