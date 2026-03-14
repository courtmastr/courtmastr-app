# Horizon 3 Brand Growth Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver Horizon 3 brand-growth outcomes with a code-first track we can execute now, while tracking non-code business/marketing tasks in parallel.

**Architecture:** Use the existing Vue 3 + Vuetify public-page system and router to add new marketing surfaces (tournament landing templates and hall-of-champions), then layer installability and localization support without changing Firestore core schema. Keep operations-heavy items as tracked milestones outside deploy-critical code.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Vue Router, Pinia stores, Firebase Hosting/Firestore, Vite PWA plugin, Vitest, Playwright.

---

## Horizon 3 Audit Snapshot (as of 2026-03-14)

1. Already done in repo:
   - Tournament sponsor branding feature (logo upload + public render) is already implemented.
2. Code-first pending:
   - Tournament landing page templates.
   - Hall of Champions public pages.
   - Multilingual support foundation.
   - PWA install prompts on spectator pages.
3. Ops/content pending:
   - Professional logo refinement.
   - Demo video.
   - Blog launch.
   - White-label packaging strategy.
   - Federation partnership outreach.

---

### Task 1: Horizon 3 Branch Setup

**Files:**
- Modify: none

**Step 1: Create branch from clean `master`**

Run: `git checkout master && git pull --ff-only origin master && git checkout -b feat/horizon3-brand-growth`
Expected: new branch created from latest `master`.

**Step 2: Baseline verify**

Run: `npm run check:firebase-env && npm run build`
Expected: env check and production build pass before feature work starts.

---

### Task 2: Tournament Landing Page Templates (H3 #3)

**Files:**
- Create: `src/features/public/views/TournamentLandingTemplateView.vue`
- Create: `src/composables/useTournamentLandingTheme.ts`
- Modify: `src/router/index.ts`
- Modify: `src/components/common/TournamentPublicShell.vue`
- Test: `tests/unit/TournamentLandingTemplateView.test.ts`

**Step 1: Write failing route/render test**

Run: `npm run test -- --run tests/unit/TournamentLandingTemplateView.test.ts`
Expected: FAIL (new route/view missing).

**Step 2: Add route + view scaffold**

Implement public route for template rendering (per tournament, non-auth).

**Step 3: Add reusable theme composable**

Implement small theme modes (`classic`, `event-night`, `minimal`) mapped to CSS variables for branding reuse.

**Step 4: Integrate with public shell metadata**

Ensure page title/metadata reflects tournament + template style.

**Step 5: Verify**

Run:
- `npm run test -- --run tests/unit/TournamentLandingTemplateView.test.ts`
- `npm run build`
Expected: PASS.

---

### Task 3: Hall of Champions Public Surface (H3 #5)

**Files:**
- Create: `src/features/public/views/HallOfChampionsView.vue`
- Create: `src/composables/useHallOfChampions.ts`
- Modify: `src/router/index.ts`
- Test: `tests/unit/HallOfChampionsView.test.ts`

**Step 1: Write failing tests**

Test for route availability and empty/non-empty champion states.

**Step 2: Implement champions composable**

Resolve winners from existing tournament/category result data (read-only aggregation, no schema changes).

**Step 3: Implement public champions page**

Render cards by tournament, with year/category metadata and share-safe layout.

**Step 4: Verify**

Run:
- `npm run test -- --run tests/unit/HallOfChampionsView.test.ts`
- `npm run build`

---

### Task 4: PWA Install Prompts for Spectator Pages (H3 #9)

**Files:**
- Create: `src/composables/usePwaInstallPrompt.ts`
- Modify: `src/features/public/views/PublicScheduleView.vue`
- Modify: `src/features/public/views/PublicScoringView.vue`
- Modify: `src/features/public/views/PublicBracketView.vue`
- Test: `tests/unit/usePwaInstallPrompt.test.ts`

**Step 1: Write failing composable test**

Mock `beforeinstallprompt` and assert prompt lifecycle.

**Step 2: Implement composable**

Capture deferred prompt safely, expose `canInstall`, `installApp`, and `dismiss` APIs.

**Step 3: Add non-intrusive install UI**

Use a subtle CTA card/banner on public spectator pages only.

**Step 4: Verify**

Run:
- `npm run test -- --run tests/unit/usePwaInstallPrompt.test.ts`
- `npm run build`

---

### Task 5: Multilingual Foundation (H3 #8)

**Files:**
- Create: `src/i18n/messages/en.ts`
- Create: `src/i18n/messages/es.ts`
- Create: `src/i18n/index.ts`
- Modify: `src/main.ts`
- Modify: `src/features/public/views/HomeView.vue`
- Modify: `src/components/layouts/AppLayout.vue`
- Test: `tests/unit/i18n-smoke.test.ts`

**Step 1: Write failing i18n smoke test**

Validate default locale fallback and one translated key render path.

**Step 2: Add minimal i18n bootstrap**

Wire localization provider at app entry with English default.

**Step 3: Localize high-impact public strings first**

Start with homepage headline/footer CTA and language toggle in layout.

**Step 4: Verify**

Run:
- `npm run test -- --run tests/unit/i18n-smoke.test.ts`
- `npm run build`

---

### Task 6: Sponsor Branding Re-Verification (H3 #4 already present)

**Files:**
- Modify (if needed): `src/features/tournaments/components/TournamentBrandingCard.vue`
- Modify (if needed): `src/components/common/TournamentSponsorStrip.vue`
- Test: `tests/unit/useTournamentBranding.test.ts`

**Step 1: Confirm feature parity with Horizon 3 expectation**

Check upload, placement, and public rendering behavior.

**Step 2: Add/adjust edge-case test only if gaps found**

Test failed image fallback and display order.

**Step 3: Verify**

Run:
- `npm run test -- --run tests/unit/useTournamentBranding.test.ts`

---

### Task 7: Ops Track (Non-Code Deliverables)

**Files:**
- Create: `docs/ops/horizon-3-growth-checklist.md`

**Step 1: Create checklist with owner/date/status**

Track:
- Logo design refinement (external designer).
- 2-3 minute demo video production.
- Blog launch calendar.
- White-label packaging discovery.
- Federation partnership outreach.

**Step 2: Add acceptance criteria for “done”**

Include artifact links (Figma, video URL, blog URL, outreach tracker).

---

### Task 8: Release Gates Per Milestone

**Files:**
- Modify: `docs/deployment/LAST_DEPLOY.md` (only when deployed)

**Step 1: Run required gates per merged batch**

Run:
- `npm run test -- --run <changed-tests>`
- `npm run test:log -- --run <changed-tests>`
- `npm run check:firebase-env`
- `npm run build`
- `npm run build:log`

**Step 2: Deploy from `master` only**

Run: `npm run deploy && npm run deploy:log`

**Step 3: Record deploy evidence**

Update `docs/deployment/LAST_DEPLOY.md`.

---

## Suggested Horizon 3 Delivery Order

1. Sprint A (1 week): Task 2 + Task 6.
2. Sprint B (1 week): Task 3 + Task 4.
3. Sprint C (1-2 weeks): Task 5.
4. Parallel every sprint: Task 7 ops execution.

## Definition of Done (Horizon 3 Code Track)

1. New public routes/pages ship with tests.
2. No regressions in existing public tournament flows.
3. Build and `:log` gates pass.
4. Deploy record updated for each production release.
