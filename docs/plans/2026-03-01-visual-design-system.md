# Visual Design System — Stadium Energy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade CourtMaster's visual identity to a sports-energy brand by replacing the icon library split with MDI-only, shifting the palette to Royal Blue + Amber, and introducing Barlow Condensed as the display typeface.

**Architecture:** Three independent, sequential areas: (1) icon library consolidation — removes lucide-vue-next and rewrites 3 files; (2) color token update — touches variables.scss and vuetify.ts; (3) font update — touches index.html, variables.scss, and style.scss. No new components; no feature changes.

**Tech Stack:** Vue 3, Vuetify 3, SCSS, MDI (@mdi/font already installed), Google Fonts

---

## Context: How Icons Work in This Project

There are two rendering mechanisms currently:

**MDI (Vuetify-native, the standard):**
```html
<!-- Inline string icon -->
<v-icon icon="mdi-trophy" size="20" />
<!-- Or as slot/prepend shorthand -->
<v-btn prepend-icon="mdi-plus">Label</v-btn>
```

**Lucide (component-based, being removed):**
```html
<script setup>
import { Trophy } from 'lucide-vue-next';
</script>
<template>
  <Trophy :size="20" class="text-primary" />
</template>
```

After migration, every icon is a `v-icon` or a `mdi-*` string prop — no imported components.

---

## Context: How Colors Work in This Project

Color tokens live in **two places** that must stay in sync:

1. **`src/styles/variables.scss`** — SCSS variables used in scoped component styles
2. **`src/plugins/vuetify.ts`** — Vuetify theme object that generates CSS custom properties (`--v-theme-primary`, etc.) used by Vuetify components (buttons, chips, badges)

If you only update `variables.scss`, Vuetify components (v-btn color="primary") will still render the old indigo. Both must be updated.

---

## Task 1: Migrate Icons in HomeView.vue

**Files:**
- Modify: `src/features/public/views/HomeView.vue:1-30`

The `features` array currently holds Lucide component references as `icon`. The template renders them with `<component :is="feature.icon" :size="32" />`. Change each `icon` value to an MDI string and render with `<v-icon>`.

**Step 1: Replace the script block**

Replace the entire `<script setup>` block:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);

const features = [
  {
    icon: 'mdi-trophy',
    title: 'Tournament Management',
    description: 'Create and manage badminton tournaments with ease. Support for single and double elimination formats.',
  },
  {
    icon: 'mdi-monitor-play',
    title: 'Live Scoring',
    description: 'Mobile-optimized scoring interface for scorekeepers. Real-time score updates across all devices.',
  },
  {
    icon: 'mdi-calendar-clock',
    title: 'Smart Scheduling',
    description: 'Automated scheduling algorithm that respects player rest time and optimizes court usage.',
  },
  {
    icon: 'mdi-account-group',
    title: 'Easy Registration',
    description: 'Self-service registration for players or bulk import by administrators.',
  },
];
</script>
```

**Step 2: Update the icon renderer in the template**

Find and replace the `<component>` usage inside the feature loop (around line 164):

Old:
```html
<component
  :is="feature.icon"
  :size="32"
  class="text-primary"
/>
```

New:
```html
<v-icon
  :icon="feature.icon"
  size="32"
  class="text-primary"
/>
```

**Step 3: Verify no Lucide import remains**

Run:
```bash
grep -n "lucide" src/features/public/views/HomeView.vue
```
Expected: no output.

**Step 4: Start dev server and visually verify**

```bash
npm run dev
```
Open `http://localhost:3000` → confirm four feature icons render correctly in the features section.

**Step 5: Commit**

```bash
git add src/features/public/views/HomeView.vue
git commit -m "refactor: replace Lucide icons with MDI in HomeView"
```

---

## Task 2: Migrate Icons in AppLayout.vue

**Files:**
- Modify: `src/components/layout/AppLayout.vue`

AppLayout uses Lucide in three ways: inline (`<Bug>`, `<Bell>`), as component references in the `userMenuItems` array, and via `<component :is="item.icon">` in the template.

**Step 1: Replace the script imports and userMenuItems**

Remove all Lucide imports from the import line at line 6:
```ts
// OLD — remove this line entirely:
import { LogIn, UserPlus, LayoutDashboard, Settings, LogOut, Bug, Bell } from 'lucide-vue-next';
```

The `userMenuItems` computed currently stores Lucide component references as `icon`. Replace with MDI strings:

```ts
const userMenuItems = computed(() => {
  if (!isAuthenticated.value) {
    return [
      { title: 'Login', icon: 'mdi-login', action: () => router.push('/login') },
      { title: 'Register', icon: 'mdi-account-plus', action: () => router.push('/register') },
    ];
  }

  return [
    { title: 'My Tournaments', icon: 'mdi-view-dashboard', action: () => router.push('/tournaments') },
    ...(route.params.tournamentId && authStore.isOrganizer
      ? [{
          title: 'Tournament Settings',
          icon: 'mdi-cog',
          action: () => router.push(`/tournaments/${route.params.tournamentId as string}/settings`),
        }]
      : []),
    { divider: true },
    { title: 'Logout', icon: 'mdi-logout', action: handleLogout },
  ];
});
```

**Step 2: Replace inline Lucide components in the template**

Find and replace each Lucide component in the template:

**Bug report button** (around line 265):
```html
<!-- OLD -->
<Bug :size="20" />
<!-- NEW -->
<v-icon icon="mdi-bug-outline" size="20" />
```

**Bell (notifications)** (around line 283):
```html
<!-- OLD -->
<Bell :size="20" />
<!-- NEW -->
<v-icon icon="mdi-bell" size="20" />
```

**Bell in empty notifications state** (around line 331):
```html
<!-- OLD -->
<Bell
  :size="48"
  class="mb-2 text-grey-lighten-1"
/>
<!-- NEW -->
<v-icon
  icon="mdi-bell"
  size="48"
  class="mb-2 text-grey-lighten-1"
/>
```

**User menu item icons** (around line 424):
```html
<!-- OLD -->
<component
  :is="item.icon"
  :size="20"
  class="mr-4 text-grey-darken-1"
/>
<!-- NEW -->
<v-icon
  :icon="item.icon"
  size="20"
  class="mr-4 text-grey-darken-1"
/>
```

**Step 3: Verify no Lucide import remains**

```bash
grep -n "lucide" src/components/layout/AppLayout.vue
```
Expected: no output.

**Step 4: Visually verify**

With dev server running, sign in and confirm:
- Bug report button shows a bug icon
- Bell icon shows in the top bar (with badge when notifications exist)
- User menu items show correct icons (dashboard, cog, logout)

**Step 5: Commit**

```bash
git add src/components/layout/AppLayout.vue
git commit -m "refactor: replace Lucide icons with MDI in AppLayout"
```

---

## Task 3: Migrate Icons in TournamentDashboardView.vue

**Files:**
- Modify: `src/features/tournaments/views/TournamentDashboardView.vue`

This is the largest migration — 21 Lucide icons replaced with MDI strings rendered via `<v-icon>`.

**Step 1: Remove the Lucide import block**

Find and remove lines 10–15 entirely:
```ts
// REMOVE ALL OF THESE:
import {
  ArrowLeft, Calendar, MapPin, Settings as SettingsIcon, ChevronDown,
  UserPlus, Play, CalendarClock, Check, Trash2,
  Users, QrCode,
  PlayCircle, Medal, ArrowRightCircle, Megaphone, CheckCheck,
  UserCheck, GitFork, Download, Printer
} from 'lucide-vue-next';
```

**Step 2: Replace all Lucide component usages in the template**

Use this lookup table. Every `<IconName :size="N" />` becomes `<v-icon icon="mdi-xxx" :size="N" />`. Preserve any existing classes (e.g., `class="mr-2"`).

| Old | New |
|---|---|
| `<ArrowLeft :size="20" />` | `<v-icon icon="mdi-arrow-left" size="20" />` |
| `<Calendar :size="16" class="mr-2" />` | `<v-icon icon="mdi-calendar" size="16" class="mr-2" />` |
| `<MapPin :size="16" class="mr-2" />` | `<v-icon icon="mdi-map-marker" size="16" class="mr-2" />` |
| `<SettingsIcon :size="18" />` | `<v-icon icon="mdi-cog" size="18" />` |
| `<ChevronDown :size="18" />` | `<v-icon icon="mdi-chevron-down" size="18" />` |
| `<UserPlus :size="18" class="mr-3 text-grey-darken-1" />` | `<v-icon icon="mdi-account-plus" size="18" class="mr-3 text-grey-darken-1" />` |
| `<Play :size="18" class="mr-3 text-grey-darken-1" />` | `<v-icon icon="mdi-play" size="18" class="mr-3 text-grey-darken-1" />` |
| `<CalendarClock :size="18" class="mr-3 text-grey-darken-1" />` | `<v-icon icon="mdi-calendar-clock" size="18" class="mr-3 text-grey-darken-1" />` |
| `<QrCode :size="18" class="mr-3 text-grey-darken-1" />` | `<v-icon icon="mdi-qrcode" size="18" class="mr-3 text-grey-darken-1" />` |
| `<Check :size="18" class="mr-3 text-grey-darken-1" />` | `<v-icon icon="mdi-check" size="18" class="mr-3 text-grey-darken-1" />` |
| `<Trash2 :size="18" class="mr-3 text-grey-darken-1" />` | `<v-icon icon="mdi-trash-can" size="18" class="mr-3 text-grey-darken-1" />` |
| `<PlayCircle :size="18" />` | `<v-icon icon="mdi-play-circle" size="18" />` |
| `<GitFork :size="18" />` | `<v-icon icon="mdi-source-fork" size="18" />` |
| `<UserCheck :size="18" />` | `<v-icon icon="mdi-account-check" size="18" />` |
| `<Medal :size="18" />` | `<v-icon icon="mdi-medal" size="18" />` |
| `<ArrowRightCircle :size="18" />` | `<v-icon icon="mdi-arrow-right-circle" size="18" />` |
| `<ArrowRightCircle :size="18" style="transform: rotate(180deg);" />` | `<v-icon icon="mdi-arrow-right-circle" size="18" style="transform: rotate(180deg);" />` |
| `<Printer :size="18" />` | `<v-icon icon="mdi-printer" size="18" />` |
| `<Download :size="18" />` | `<v-icon icon="mdi-download" size="18" />` |
| `<Megaphone :size="20" class="mr-2" />` | `<v-icon icon="mdi-bullhorn" size="20" class="mr-2" />` |
| `<CheckCheck :size="24" />` | `<v-icon icon="mdi-check-all" size="24" />` |
| `<Users :size="24" />` | `<v-icon icon="mdi-account-group" size="24" />` |
| `<GitFork :size="24" />` | `<v-icon icon="mdi-source-fork" size="24" />` |
| `<Megaphone :size="24" />` | `<v-icon icon="mdi-bullhorn" size="24" />` |

> Note: `<v-btn>` already accepts `prepend`/`append` slot. The icons inside `<template #prepend>` and `<template #append>` slots should remain as `<v-icon>` elements inside those slots.

**Step 3: Verify no Lucide import remains**

```bash
grep -n "lucide" src/features/tournaments/views/TournamentDashboardView.vue
```
Expected: no output.

**Step 4: Type-check**

```bash
npx vue-tsc --noEmit
```
Expected: zero errors related to Lucide components.

**Step 5: Visually verify**

Navigate to a tournament dashboard. Confirm:
- Back arrow shows at top left
- Calendar and map-pin icons show next to date/location
- Manage dropdown shows all icons (account-plus, play, calendar-clock, qrcode, check, trash-can)
- Status card icons show (play-circle, source-fork, account-check, medal)
- Live matches section header shows bullhorn icon
- Stat cards show account-group, source-fork, bullhorn, check-all icons

**Step 6: Commit**

```bash
git add src/features/tournaments/views/TournamentDashboardView.vue
git commit -m "refactor: replace Lucide icons with MDI in TournamentDashboardView"
```

---

## Task 4: Uninstall lucide-vue-next

**Files:**
- Modify: `package.json` (via npm)

**Step 1: Confirm zero remaining Lucide usages**

```bash
grep -rn "lucide" src/ --include="*.vue" --include="*.ts"
```
Expected: no output. If any output appears, fix those files before proceeding.

**Step 2: Uninstall the package**

```bash
npm uninstall lucide-vue-next
```

**Step 3: Verify it's gone**

```bash
grep "lucide" package.json
```
Expected: no output.

**Step 4: Verify the build still compiles**

```bash
npm run build
```
Expected: successful build with no errors.

**Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove lucide-vue-next package"
```

---

## Task 5: Update Color Tokens in variables.scss

**Files:**
- Modify: `src/styles/variables.scss:9-24`

**Step 1: Replace color palette section**

Replace the Primary, Secondary, and Semantic color blocks with the Stadium Energy palette:

```scss
// Primary — Royal Blue
$primary-base:  #1D4ED8;   // Royal Blue 700
$primary-dark:  #1E40AF;   // Royal Blue 800
$primary-light: #3B82F6;   // Blue 500

// Secondary — Amber
$secondary-base:  #D97706; // Amber 600
$secondary-light: #F59E0B; // Amber 500
$secondary-dark:  #B45309; // Amber 700

// Semantic
$success: #16A34A;   // Green 600
$warning: #F97316;   // Orange 500
$error:   #DC2626;   // Red 600
$info:    #0EA5E9;   // Sky 500
```

The neutrals section (`$white`, `$background`, `$surface`, etc.) is unchanged.

**Step 2: Verify the file compiles**

```bash
npx sass --no-source-map src/styles/variables.scss /dev/null
```
Expected: no errors.

**Step 3: Commit**

```bash
git add src/styles/variables.scss
git commit -m "design: update SCSS color tokens to Stadium Energy palette"
```

---

## Task 6: Update Vuetify Theme in vuetify.ts

**Files:**
- Modify: `src/plugins/vuetify.ts:9-61`

Vuetify's theme generates CSS custom properties (e.g., `--v-theme-primary`) at runtime that are consumed by all `v-btn color="primary"`, `v-chip color="secondary"`, etc. The SCSS variables in step 5 only affect scoped styles — Vuetify components need this file updated too.

**Step 1: Replace the courtmasterTheme colors**

```ts
const courtmasterTheme = {
  dark: false,
  colors: {
    primary: '#1D4ED8',   // Royal Blue 700
    secondary: '#D97706', // Amber 600
    accent: '#F59E0B',    // Amber 500
    error: '#DC2626',     // Red 600
    info: '#0EA5E9',      // Sky 500
    success: '#16A34A',   // Green 600
    warning: '#F97316',   // Orange 500
    background: '#F8FAFC',
    surface: '#FFFFFF',
    'on-primary': '#FFFFFF',
    'on-secondary': '#FFFFFF',
    'on-surface': '#0F172A',
    'on-background': '#0F172A',
    // Tournament status colors
    'tournament-active': '#16A34A',
    'tournament-draft': '#9E9E9E',
    'tournament-registration': '#1D4ED8',
    'tournament-completed': '#64748B',
    // Match status colors
    'match-scheduled': '#94A3B8',
    'match-ready': '#D97706',
    'match-in-progress': '#16A34A',
    'match-completed': '#64748B',
  },
};
```

> Note: `tournament-registration` changed from teal → royal blue, `match-ready` changed from amber → amber-600 (same visual range), `match-completed` changed from teal → neutral gray. These better reflect the new palette.

Also update `courtmasterDarkTheme` (the dark theme object, currently has a missing `colors:` wrapper — fix that bug while you're here):

```ts
const courtmasterDarkTheme = {
  dark: true,
  colors: {
    primary: '#3B82F6',    // Blue 500 (lighter for dark bg)
    secondary: '#F59E0B',  // Amber 500 (lighter for dark bg)
    accent: '#F59E0B',
    error: '#EF4444',
    info: '#38BDF8',
    success: '#22C55E',
    warning: '#FB923C',
    background: '#0F172A',
    surface: '#1E293B',
    'on-primary': '#FFFFFF',
    'on-secondary': '#0F172A',
    'on-surface': '#F8FAFC',
    'on-background': '#F8FAFC',
    'tournament-active': '#22C55E',
    'tournament-draft': '#64748B',
    'tournament-registration': '#3B82F6',
    'tournament-completed': '#475569',
    'match-scheduled': '#64748B',
    'match-ready': '#F59E0B',
    'match-in-progress': '#22C55E',
    'match-completed': '#475569',
  },
};
```

**Step 2: Type-check**

```bash
npx vue-tsc --noEmit
```
Expected: zero errors.

**Step 3: Visually verify in browser**

With dev server running:
- Tournament list cards: primary buttons should be royal blue, not indigo
- Status chips for active tournaments should be green (unchanged)
- Any `color="secondary"` chips should be amber, not teal

**Step 4: Commit**

```bash
git add src/plugins/vuetify.ts
git commit -m "design: update Vuetify theme to Stadium Energy palette"
```

---

## Task 7: Add Barlow Condensed Font

**Files:**
- Modify: `index.html:15`
- Modify: `src/styles/variables.scss:44`
- Modify: `src/style.scss`

**Step 1: Update Google Fonts URL in index.html**

Current line 15:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

Replace with (adds Barlow Condensed, keeps Inter, removes Poppins since it's being superseded):
```html
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

> Poppins is removed — it was only used via `$font-family-display`. Barlow Condensed replaces it. Inter remains for body text.

**Step 2: Update $font-family-display in variables.scss**

Find line 44:
```scss
// OLD
$font-family-display: 'Poppins', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
```

Replace with:
```scss
$font-family-display: 'Barlow Condensed', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
```

**Step 3: Apply Barlow Condensed to heading elements globally in style.scss**

Add after the Typography Utilities section (after `.text-gradient` block, around line 45):

```scss
/* Heading Typography — Barlow Condensed */
h1, h2, h3, h4,
.text-h1, .text-h2, .text-h3, .text-h4 {
  font-family: $font-family-display;
  letter-spacing: -0.02em;
}

h3, h4,
.text-h3, .text-h4 {
  letter-spacing: -0.01em;
}
```

The Vuetify text utility classes (`.text-h4`, `.text-h5`, etc.) are used heavily in the dashboard for stats and section labels — this rule picks them up automatically.

**Step 4: Verify no compile errors**

```bash
npm run dev
```
Expected: dev server starts without error. No SCSS compilation warnings.

**Step 5: Visually verify Barlow Condensed is rendering**

Open browser DevTools → Elements tab → click on the hero title or a stat number → Computed → `font-family`. Should show `Barlow Condensed`.

Check these locations:
- Home page hero title (`The Professional Standard for Tournament Management`)
- Tournament dashboard tournament name heading
- Stat card numbers (participants, total matches, etc.)

**Step 6: Commit**

```bash
git add index.html src/styles/variables.scss src/style.scss
git commit -m "design: add Barlow Condensed as display font for headings"
```

---

## Final Verification

**Step 1: Full type-check**

```bash
npx vue-tsc --noEmit
```
Expected: zero errors.

**Step 2: Check for any remaining Lucide references**

```bash
grep -rn "lucide" src/ --include="*.vue" --include="*.ts"
```
Expected: no output.

**Step 3: Build verification**

```bash
npm run build
```
Expected: build completes successfully with no errors.

**Step 4: Final visual walkthrough**

Visit these pages and confirm no broken icons or wrong colors:
- `/` (Home) — feature section icons, CTA buttons are royal blue
- `/login` — form, sign-in button
- `/tournaments` — list cards, status chips
- `/tournaments/:id` (Dashboard) — all stat cards, back arrow, manage menu, status card

**Step 5: Final commit**

```bash
git add -A
git commit -m "design: complete Stadium Energy visual design system upgrade"
```

---

## Success Checklist

- [ ] `grep -rn "lucide" src/` returns no output
- [ ] `lucide-vue-next` absent from `package.json`
- [ ] `variables.scss` primary is `#1D4ED8`, secondary is `#D97706`
- [ ] `vuetify.ts` theme primary is `#1D4ED8`, secondary is `#D97706`
- [ ] `index.html` loads Barlow Condensed from Google Fonts
- [ ] `variables.scss` `$font-family-display` starts with `'Barlow Condensed'`
- [ ] Heading elements render in Barlow Condensed (verify in DevTools)
- [ ] `npm run build` succeeds
- [ ] `npx vue-tsc --noEmit` returns zero errors
