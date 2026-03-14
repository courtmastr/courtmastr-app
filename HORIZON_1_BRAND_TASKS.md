# CourtMastr — Horizon 1 Brand Implementation Tasks

> **Context:** Marvy Technologies builds CourtMastr. The tagline is **"Run Every Rally."**
> **Deadline:** Before the live tournament next week.
> **Rule:** No functional changes — visual/branding additions only.
> **Rule:** Follow all patterns in `AGENTS.md` and `docs/coding-patterns/CODING_PATTERNS.md`.

---

## Before You Start

Read these two files before touching any code:
- `AGENTS.md` — mandatory patterns (no native dialogs, use `serverTimestamp()`, etc.)
- `docs/coding-patterns/CODING_PATTERNS.md` — detection commands to verify compliance

---

## TASK 1 — Fix Logo SVG Colors + Font

**Priority: CRITICAL — do this first, everything else builds on it.**

The logo SVG uses `#4F46E5` (indigo) but the app's primary color is `#1D4ED8` (Court Blue). They are visibly different. Fix both SVG files.

### File: `src/assets/brand/courtmaster-mark.svg`

Change all occurrences of `stroke="#4F46E5"` → `stroke="#1D4ED8"`.

Current file:
```xml
<g stroke="#4F46E5" stroke-width="8" ...>
```

After fix:
```xml
<g stroke="#1D4ED8" stroke-width="8" ...>
```

The three `<rect>` elements using `stroke="#0EA5E9"` (sky blue) are **intentional** — do not change those.

---

### File: `src/assets/brand/courtmaster-lockup.svg`

Two changes:

**Change 1:** Same stroke color fix.
Change all `stroke="#4F46E5"` → `stroke="#1D4ED8"` (the `<g>` tag).

**Change 2:** Switch the wordmark font from Inter to Barlow Condensed.

Current `<style>` block:
```xml
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap');
  .text { font-family: 'Inter', sans-serif; font-size: 48px; font-weight: 700; letter-spacing: -1.5px; }
  .court { fill: #0F172A; }
  .master { fill: #4F46E5; }
  @media (prefers-color-scheme: dark) {
    .court { fill: #F8FAFC; }
  }
</style>
```

Replace with:
```xml
<style>
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&display=swap');
  .text { font-family: 'Barlow Condensed', sans-serif; font-size: 48px; font-weight: 700; letter-spacing: -1px; }
  .court { fill: #0F172A; }
  .master { fill: #1D4ED8; }
  @media (prefers-color-scheme: dark) {
    .court { fill: #F8FAFC; }
  }
</style>
```

**Verification:** Open both SVGs in a browser. The court lines should be royal blue (`#1D4ED8`). The wordmark "CourtMastr" should appear in Barlow Condensed with "Court" in near-black and "Master" in royal blue.

---

## TASK 2 — Add "Powered by CourtMastr" Footer to All Public Pages

**Priority: HIGH**

All public-facing pages use the `TournamentPublicShell` component (`src/components/common/TournamentPublicShell.vue`). Adding the footer here benefits every public page in one edit.

### Step 1: Add the footer inside `TournamentPublicShell.vue`

File: `src/components/common/TournamentPublicShell.vue`

Locate the closing `</v-container>` before `</section>` (near the end of the template). Add a `<footer>` block immediately before the closing `</v-container>`:

```vue
<!-- CourtMastr brand footer -->
<footer class="tournament-public-shell__powered-by">
  <a
    href="/"
    class="tournament-public-shell__powered-by-link"
    title="Tournament software by CourtMastr — Marvy Technologies"
  >
    <img
      src="/logo.svg"
      alt="CourtMastr"
      class="tournament-public-shell__powered-by-logo"
      width="20"
      height="20"
    />
    <span class="tournament-public-shell__powered-by-text">
      Powered by <strong>CourtMastr</strong>
    </span>
  </a>
</footer>
```

### Step 2: Add the SCSS styles in the same file

Inside the existing `<style scoped lang="scss">` block, add:

```scss
.tournament-public-shell__powered-by {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px 0 8px;
  opacity: 0.6;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }
}

.tournament-public-shell__powered-by-link {
  display: flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: inherit;
}

.tournament-public-shell__powered-by-logo {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.tournament-public-shell__powered-by-text {
  font-size: 12px;
  letter-spacing: 0.01em;

  strong {
    font-weight: 600;
  }
}
```

**Verification:** Open any public tournament page (bracket, schedule, scores). The footer should appear at the bottom with a small logo and "Powered by CourtMastr".

---

## TASK 3 — Add "LIVE" Pulse Badge to Public Schedule and Scoring Pages

**Priority: HIGH**

Show a pulsing "LIVE" badge when the tournament has matches that are `in_progress`. This signals real-time data to spectators.

### Step 1: Create a reusable `LiveBadge.vue` component

Create file: `src/components/common/LiveBadge.vue`

```vue
<script setup lang="ts">
// No props — badge is purely visual, shown/hidden by parent v-if
</script>

<template>
  <span class="live-badge" aria-label="Live">
    <span class="live-badge__dot" aria-hidden="true" />
    LIVE
  </span>
</template>

<style scoped lang="scss">
.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background-color: #16A34A;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  border-radius: 9999px;
  text-transform: uppercase;
  vertical-align: middle;
}

.live-badge__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #ffffff;
  animation: live-pulse 1.4s ease-in-out infinite;
}

@keyframes live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.75); }
}
</style>
```

### Step 2: Add `LiveBadge` to `PublicScheduleView.vue`

File: `src/features/public/views/PublicScheduleView.vue`

**Import the component** in the `<script setup>` block:
```ts
import LiveBadge from '@/components/common/LiveBadge.vue';
```

**Add a computed** that returns true when there are in-progress matches:
```ts
const hasLiveMatches = computed(() =>
  matchStore.matches.some((m) => m.status === 'in_progress')
);
```

**Add the badge** in the template, next to the page title or eyebrow text inside the `TournamentPublicShell`. Use the `eyebrow` prop or the `actions` slot:

Pass to `TournamentPublicShell` via the `actions` slot:
```vue
<template #actions>
  <LiveBadge v-if="hasLiveMatches" />
</template>
```

### Step 3: Same change in `PublicScoringView.vue`

File: `src/features/public/views/PublicScoringView.vue`

Apply the identical pattern:
1. Import `LiveBadge`
2. Add `hasLiveMatches` computed (already has `matchStore` in scope)
3. Add `<LiveBadge v-if="hasLiveMatches" />` via the `actions` slot on `TournamentPublicShell`

**Also add** this helper text below the page title (via the `metrics` slot or inside the shell default slot):
```vue
<template #metrics>
  <p class="text-caption text-medium-emphasis">
    Scores update automatically — no refresh needed.
  </p>
</template>
```

**Verification:** With an active tournament that has in-progress matches, a green pulsing "LIVE" badge should appear on both the public schedule and public scoring pages.

---

## TASK 4 — Add CourtMastr Branding to Check-In Kiosk Views

**Priority: CRITICAL — first touchpoint for players at the venue.**

### File A: `src/features/checkin/views/SelfCheckInView.vue`

The self check-in view currently has no app branding header. Add one.

**In the `<script setup>` block**, add this import:
```ts
import { useRoute } from 'vue-router'; // already imported, skip if present
```

Add a composable call to get the tournament name (the component doesn't currently have it):
```ts
import { useTournamentStore } from '@/stores/tournaments';
const tournamentStore = useTournamentStore();
const tournament = computed(() => tournamentStore.currentTournament);
```

**In the `<template>`**, wrap the entire existing content in a new outer div and prepend a branded header:

```vue
<template>
  <div class="self-checkin-page">

    <!-- Branded header -->
    <header class="self-checkin-page__header">
      <img
        src="/logo.svg"
        alt="CourtMastr"
        class="self-checkin-page__app-logo"
        width="32"
        height="32"
      />
      <div class="self-checkin-page__header-text">
        <span class="self-checkin-page__app-name">CourtMastr</span>
        <span
          v-if="tournament?.name"
          class="self-checkin-page__tournament-name"
        >
          {{ tournament.name }}
        </span>
      </div>
    </header>

    <!-- existing content below, unchanged -->
    ...
  </div>
</template>
```

**Add scoped styles:**
```scss
.self-checkin-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.self-checkin-page__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background-color: #0F172A;
  border-bottom: 2px solid #1D4ED8;
}

.self-checkin-page__app-logo {
  flex-shrink: 0;
  filter: brightness(0) invert(1); // make it white on dark bg
}

.self-checkin-page__header-text {
  display: flex;
  flex-direction: column;
}

.self-checkin-page__app-name {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.05em;
}

.self-checkin-page__tournament-name {
  font-size: 12px;
  color: #94A3B8;
  margin-top: 1px;
}
```

---

### File B: `src/features/checkin/views/FrontDeskCheckInView.vue`

This file already imports `TournamentBrandMark` and `useTournamentBranding`. Find the existing page header area in the template (look for the main `<v-card>` or top-level container) and verify it shows the CourtMastr app logo alongside the tournament brand mark.

Locate the top of the template and ensure there is a header bar similar to the one above. If no app-level header exists, add the same `<header>` pattern as SelfCheckInView above.

**Also add:** display the tournament date if available. Below the tournament name, add:
```vue
<span
  v-if="tournament?.startDate"
  class="self-checkin-page__tournament-date"
>
  {{ new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(tournament.startDate)) }}
</span>
```
Style: `font-size: 11px; color: #64748B;`

**Verification:** Navigate to the front-desk and self-check-in pages. A dark header bar with the CourtMastr logo and tournament name should appear at the top of both screens.

---

## TASK 5 — Add CourtMastr Watermark to OBS Overlays

**Priority: HIGH — these appear on stream/big screens.**

### Files:
- `src/features/obs/views/ObsScoreboardView.vue`
- `src/features/obs/views/ObsScoreBugView.vue`

In both files, add a small CourtMastr watermark in the bottom-right corner. This is a positioned element that overlays the existing content.

**Add inside the root `<template>` element** (as the last child of the outermost container):

```vue
<!-- CourtMastr watermark — do not remove -->
<div class="obs-courtmaster-watermark" aria-hidden="true">
  <img src="/logo.svg" alt="" width="16" height="16" class="obs-courtmaster-watermark__logo" />
  <span class="obs-courtmaster-watermark__text">CourtMastr</span>
</div>
```

**Add to the component's `<style>` block** (or `<style scoped>`):

```scss
.obs-courtmaster-watermark {
  position: absolute;
  bottom: 10px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0.45;
  pointer-events: none;
  z-index: 10;
}

.obs-courtmaster-watermark__logo {
  width: 14px;
  height: 14px;
  filter: brightness(0) invert(1); // white on dark OBS backgrounds
}

.obs-courtmaster-watermark__text {
  font-size: 10px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.06em;
  font-family: 'Barlow Condensed', sans-serif;
}
```

**Important:** OBS views use absolute/fixed positioning heavily. Ensure the parent container that holds this watermark has `position: relative` set. If it doesn't, add `position: relative` to the outermost container in each OBS view.

**Verification:** Open the OBS scoreboard and score bug URLs. A small "CourtMastr" label should appear in the bottom-right corner at ~45% opacity.

---

## TASK 6 — Update Homepage Hero Tagline

**Priority: MEDIUM**

File: `src/features/public/views/HomeView.vue`

### Change 1: Update the hero headline

Current (line ~45-48):
```vue
<h1 class="hero-title mb-6">
  The Professional Standard for
  <span class="text-primary">Tournament Management</span>
</h1>
```

Replace with:
```vue
<h1 class="hero-title mb-6">
  Run Every Rally.
</h1>
<p class="hero-eyebrow mb-2">
  by <strong>CourtMastr</strong> — Marvy Technologies
</p>
```

### Change 2: Update the hero subtitle

Current subtitle (line ~49-51):
```vue
<p class="hero-subtitle mb-8 text-body-1">
  CourtMastr provides organizers with a robust, reliable platform to schedule matches, manage registrations, and record live scores efficiently.
</p>
```

Replace with:
```vue
<p class="hero-subtitle mb-8 text-body-1">
  Tournament management for badminton organizers worldwide. Generate brackets in 30 seconds, run live scoring on any device, and give spectators real-time access from anywhere.
</p>
```

### Change 3: Replace the generic credibility stats

Current stat blocks show "Reliable / Real-Time / Secure" as plain text. Replace with stats that will hold real numbers after the first tournament:

```vue
<div class="stat-block">
  <div class="text-h4 font-weight-bold text-primary mb-1">30s</div>
  <div class="text-subtitle-2 text-grey-darken-1 text-uppercase letter-spacing-1">Bracket Generation</div>
</div>
<div class="stat-block">
  <div class="text-h4 font-weight-bold text-primary mb-1">Real-Time</div>
  <div class="text-subtitle-2 text-grey-darken-1 text-uppercase letter-spacing-1">Score Sync</div>
</div>
<div class="stat-block">
  <div class="text-h4 font-weight-bold text-primary mb-1">Any Device</div>
  <div class="text-subtitle-2 text-grey-darken-1 text-uppercase letter-spacing-1">Mobile Scoring</div>
</div>
```

### Change 4: Add hero eyebrow style

Inside the existing `<style scoped lang="scss">` block, add:

```scss
.hero-eyebrow {
  font-size: 13px;
  color: $text-secondary;
  letter-spacing: 0.02em;
  margin-top: -16px;
}
```

**Verification:** Load the homepage. The hero should now say "Run Every Rally." as the main headline with the CourtMastr + Marvy Technologies attribution below it.

---

## TASK 7 — Create Printable QR Code Card

**Priority: MEDIUM — needed as a physical asset at the venue.**

Create a standalone printable HTML file that generates a QR code pointing to the live scores page for a tournament.

Create file: `public/printables/qr-card.html`

This page should:
1. Accept a `?url=` query parameter with the public scores URL
2. Accept a `?name=` query parameter with the tournament name
3. Use the `qrcode` npm package (already a dependency — use the CDN version for this standalone file)
4. Render a print-friendly card (A6 size, centered) with:
   - CourtMastr logo at the top
   - Tournament name
   - QR code (large, minimum 200px)
   - Text: "Scan to follow live scores"
   - "Run Every Rally. — CourtMastr by Marvy Technologies" at the bottom
5. Include a `window.onload = window.print()` so it auto-prints when opened (optional, or add a visible Print button)

**Color spec for the card:**
- Background: `#0F172A` (Dark Navy) for dramatic effect at the venue
- Text: `#FFFFFF`
- QR code: white modules on navy background (or white card with navy QR)
- Accent line: `#1D4ED8` (Court Blue)

**Usage instructions** (add as an HTML comment at the top of the file):
```html
<!--
  Usage: /printables/qr-card.html?url=https://yourapp.com/t/TOURNAMENT_ID/scores&name=My+Tournament
  Print at A6 or index card size. Post at the venue entrance and each court.
-->
```

**Verification:** Open `http://localhost:5173/printables/qr-card.html?url=https://example.com&name=Test+Tournament` — a styled card with a QR code should render and be ready to print.

---

## Summary Checklist

Run through this before marking Horizon 1 complete:

- [ ] `courtmaster-mark.svg` — stroke color changed to `#1D4ED8`
- [ ] `courtmaster-lockup.svg` — stroke color changed to `#1D4ED8`, font changed to Barlow Condensed
- [ ] `TournamentPublicShell.vue` — "Powered by CourtMastr" footer added
- [ ] `LiveBadge.vue` — new component created in `src/components/common/`
- [ ] `PublicScheduleView.vue` — LiveBadge integrated via `actions` slot
- [ ] `PublicScoringView.vue` — LiveBadge + "auto-update" message integrated
- [ ] `SelfCheckInView.vue` — dark branded header with CourtMastr logo + tournament name
- [ ] `FrontDeskCheckInView.vue` — branded header verified/added
- [ ] `ObsScoreboardView.vue` — CourtMastr watermark in bottom-right
- [ ] `ObsScoreBugView.vue` — CourtMastr watermark in bottom-right
- [ ] `HomeView.vue` — tagline updated to "Run Every Rally.", stats updated, subtitle refreshed
- [ ] `public/printables/qr-card.html` — printable QR card created

### Pattern compliance checks (run before committing):
```bash
# No inline v-dialog (should use BaseDialog)
grep -rn "<v-dialog" src/ --include="*.vue" | grep -v "BaseDialog"

# No loading.value = true (should use useAsyncOperation)
grep -rn "loading.value = true" src/ --include="*.vue" --include="*.ts" | grep -v "useAsyncOperation"

# No native confirm/alert
grep -rn "confirm(\|alert(\|prompt(" src/ --include="*.vue" --include="*.ts"
```

---

*Document version: 1.0 | March 2026 | Marvy Technologies — CourtMastr Horizon 1*
