# UI Accessibility & Correctness Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 13 Critical/High accessibility and correctness bugs across 8 Vue components in a single branch.

**Architecture:** All changes are prop additions, attribute additions, or small template/script restructures — no component rewrites. Start with `BaseDialog` (foundational, affects all dialogs) then work file by file. Commit after each file.

**Tech Stack:** Vue 3 Composition API, Vuetify 3, TypeScript, Vitest, vue-tsc

---

## Pre-flight

**Step 1: Create the branch**

```bash
git checkout -b fix/ui-a11y-correctness
```

**Step 2: Confirm tests pass on green baseline**

```bash
npm run test -- --run
```
Expected: all tests pass. If any already fail, note them — don't introduce new failures.

**Step 3: Confirm type-check passes**

```bash
npm run type-check
```
Expected: zero errors. Note any pre-existing errors.

---

## Task 1: BaseDialog — aria-label on close button + aria-labelledby

**Files:**
- Modify: `src/components/common/BaseDialog.vue`

`BaseDialog` is used by every dialog in the app. Fix it first so the benefit propagates everywhere.

**Step 1: Read the current file**

Open `src/components/common/BaseDialog.vue` and locate:
1. The `<v-dialog>` opening tag (line ~79)
2. The `<v-card-title>` (line ~87)
3. The close `<v-btn>` (line ~94)

**Step 2: Apply the two changes**

In the template, make these edits:

*Change 1* — add `aria-labelledby` to `v-dialog`:
```html
<!-- BEFORE -->
<v-dialog
  :model-value="modelValue"
  :max-width="maxWidth"
  :persistent="persistent"
  @update:model-value="(value) => emit('update:modelValue', value)"
>

<!-- AFTER -->
<v-dialog
  :model-value="modelValue"
  :max-width="maxWidth"
  :persistent="persistent"
  aria-labelledby="base-dialog-title"
  @update:model-value="(value) => emit('update:modelValue', value)"
>
```

*Change 2* — add `id` to `v-card-title` and `aria-label` to close button:
```html
<!-- BEFORE -->
<v-card-title class="d-flex align-center justify-space-between">
  <slot name="title">
    {{ title }}
  </slot>
  <v-btn
    v-if="showClose"
    icon="mdi-close"
    variant="text"
    size="small"
    @click="handleClose"
  />
</v-card-title>

<!-- AFTER -->
<v-card-title id="base-dialog-title" class="d-flex align-center justify-space-between">
  <slot name="title">
    {{ title }}
  </slot>
  <v-btn
    v-if="showClose"
    aria-label="Close dialog"
    icon="mdi-close"
    variant="text"
    size="small"
    @click="handleClose"
  />
</v-card-title>
```

**Step 3: Type-check**

```bash
npm run type-check
```
Expected: no new errors.

**Step 4: Commit**

```bash
git add src/components/common/BaseDialog.vue
git commit -m "fix(a11y): add aria-label to BaseDialog close button and aria-labelledby to dialog

- Close button was icon-only with no accessible label (WCAG 2.1 SC 1.1.1)
- aria-labelledby connects dialog title to role=dialog for screen readers
- Propagates to every dialog in the app that uses BaseDialog"
```

---

## Task 2: AppLayout — skip-to-content link + notification badge fix

**Files:**
- Modify: `src/components/layout/AppLayout.vue`

Two unrelated bugs in the same file — fix together.

**Step 1: Add skip-to-content link**

In the `<template>`, add a skip link as the **very first element** inside `<v-layout>`, before `<AppNavigation>`:

```html
<v-layout>
  <!-- Skip navigation for keyboard users -->
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <!-- Main Navigation (Drawer) -->
  <AppNavigation ...
```

Then on `<v-main>`, add the target id:
```html
<!-- BEFORE -->
<v-main>

<!-- AFTER -->
<v-main id="main-content">
```

**Step 2: Add skip-link styles**

In the `<style scoped lang="scss">` block, add after the existing `.app-bar` rule:

```scss
.skip-link {
  position: absolute;
  top: -100%;
  left: $spacing-md;
  z-index: 9999;
  padding: $spacing-sm $spacing-md;
  background: $primary-base;
  color: $white;
  border-radius: $border-radius-sm;
  font-weight: $font-weight-medium;
  text-decoration: none;
  transition: top 0.1s ease;

  &:focus {
    top: $spacing-md;
  }
}
```

**Step 3: Fix notification badge — remove `dot` prop**

Find the `<v-badge>` inside the notifications `<v-btn>` (around line 274):

```html
<!-- BEFORE -->
<v-badge
  :content="unreadCount"
  :model-value="unreadCount > 0"
  color="error"
  dot
>

<!-- AFTER -->
<v-badge
  :content="unreadCount"
  :model-value="unreadCount > 0"
  color="error"
>
```

`dot` and `:content` are mutually exclusive in Vuetify 3. With `dot` present, the numeric count is never rendered. Removing `dot` makes the count visible.

**Step 4: Type-check**

```bash
npm run type-check
```
Expected: no new errors.

**Step 5: Commit**

```bash
git add src/components/layout/AppLayout.vue
git commit -m "fix(a11y): add skip-to-content link and fix notification badge count

- Skip link allows keyboard users to bypass sidebar + app bar on every page
- v-badge dot prop suppressed numeric count; removing dot makes unread count visible"
```

---

## Task 3: AppNavigation — aria-label on drawer + remove accidental rail collapse

**Files:**
- Modify: `src/components/navigation/AppNavigation.vue`

**Step 1: Add `aria-label` to the navigation drawer**

Find `<v-navigation-drawer` (line 2):

```html
<!-- BEFORE -->
<v-navigation-drawer
  v-model="drawer"
  :rail="rail"
  @click="rail = false"
>

<!-- AFTER -->
<v-navigation-drawer
  v-model="drawer"
  :rail="rail"
  aria-label="Main navigation"
>
```

Note: also remove `@click="rail = false"` in this same edit (see next step).

**Step 2: Remove `@click="rail = false"` from drawer root**

The `@click="rail = false"` handler fires whenever anything inside the drawer is clicked — including nav links — unexpectedly collapsing the rail. The collapse button at line ~31 already handles this correctly with `@click.stop="rail = !rail"`. The root handler is redundant and disruptive.

The edit above already removes it. Confirm the drawer tag now reads:
```html
<v-navigation-drawer
  v-model="drawer"
  :rail="rail"
  aria-label="Main navigation"
>
```

**Step 3: Type-check**

```bash
npm run type-check
```

**Step 4: Commit**

```bash
git add src/components/navigation/AppNavigation.vue
git commit -m "fix(a11y): add aria-label to navigation drawer and remove accidental rail collapse

- Drawer had no accessible landmark label for screen readers
- @click='rail = false' on drawer root collapsed sidebar on any click including nav links;
  the dedicated collapse button already handles this correctly"
```

---

## Task 4: TournamentListView — keyboard-navigable tournament cards

**Files:**
- Modify: `src/features/tournaments/views/TournamentListView.vue`

**Step 1: Replace `@click` with `:to` on tournament cards**

Find the `<v-card` that wraps each tournament (around line 117):

```html
<!-- BEFORE -->
<v-card
  class="tournament-card"
  @click="viewTournament(tournament)"
>

<!-- AFTER -->
<v-card
  :to="`/tournaments/${tournament.id}`"
  class="tournament-card"
>
```

When Vuetify `v-card` receives a `:to` prop it renders as a router-link, automatically gaining `role="link"`, `tabindex="0"`, and keyboard activation (Enter/Space). No manual keyboard handler needed.

**Step 2: Remove the decorative chevron button**

The `v-btn icon="mdi-chevron-right"` in `v-card-actions` (around line 197) was present to hint at clickability. With `:to` the card is now a proper link — the chevron is redundant noise. Remove it:

```html
<!-- Remove this entire v-btn block -->
<v-btn
  icon="mdi-chevron-right"
  variant="text"
  size="small"
  aria-hidden="true"
  tabindex="-1"
/>
```

**Step 3: Remove unused `viewTournament` function**

In the `<script setup>`, remove:
```ts
function viewTournament(tournament: Tournament): void {
  router.push(`/tournaments/${tournament.id}`);
}
```

Also remove the `Tournament` type import if it becomes unused — check whether `Tournament` is still referenced by the `tournaments` computed type annotation. If `tournaments` is typed as `computed(() => tournamentStore.tournaments)` without an explicit `Tournament[]` annotation, the import can be removed. If the type annotation exists elsewhere in the file, keep it.

**Step 4: Run tests**

```bash
npm run test -- --run
```
Expected: all existing tests pass (no test for this component's click handler should exist, but verify).

**Step 5: Type-check**

```bash
npm run type-check
```

**Step 6: Commit**

```bash
git add src/features/tournaments/views/TournamentListView.vue
git commit -m "fix(a11y): make tournament cards keyboard-navigable using :to prop

- @click on v-card has no tabindex/role; Tab skipped all cards
- Using :to lets Vuetify render as router-link with role=link and keyboard activation
- Remove redundant chevron button and unused viewTournament() function"
```

---

## Task 5: TournamentDashboardView — error feedback in updateStatus()

**Files:**
- Modify: `src/features/tournaments/views/TournamentDashboardView.vue`

**Step 1: Find and fix the empty catch block**

Locate `updateStatus()` in the script (around line 225):

```ts
// BEFORE
async function updateStatus(status: string) {
  try {
    await tournamentStore.updateTournamentStatus(tournamentId.value, status as any);
    notificationStore.showToast('success', `Tournament status updated to ${status}`);
  } catch (error) {
  }
}

// AFTER
async function updateStatus(status: string) {
  try {
    await tournamentStore.updateTournamentStatus(tournamentId.value, status as any);
    notificationStore.showToast('success', `Tournament status updated to ${status}`);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update tournament status');
  }
}
```

**Step 2: Type-check**

```bash
npm run type-check
```

**Step 3: Commit**

```bash
git add src/features/tournaments/views/TournamentDashboardView.vue
git commit -m "fix: show error toast when tournament status update fails

Empty catch block silently swallowed failures, leaving users with no feedback"
```

---

## Task 6: ScoringInterfaceView — touch targets, input labels, back navigation

**Files:**
- Modify: `src/features/scoring/views/ScoringInterfaceView.vue`

Three fixes in the same file — do them together.

**Step 1: Fix minus button touch targets (both players)**

Find the two `v-btn` minus buttons inside the scoring card (around lines 532–581). Both use `size="small"`:

```html
<!-- BEFORE (participant1) -->
<v-btn
  variant="text"
  size="small"
  class="mt-2"
  :disabled="currentGame.score1 === 0"
  @click.stop="removePoint('participant1')"
>
  <v-icon>mdi-minus</v-icon>
</v-btn>

<!-- AFTER (participant1) -->
<v-btn
  variant="text"
  size="default"
  class="mt-2"
  :aria-label="`Remove point from ${participant1Name}`"
  :disabled="currentGame.score1 === 0"
  @click.stop="removePoint('participant1')"
>
  <v-icon>mdi-minus</v-icon>
</v-btn>
```

Apply the same change for participant2's minus button:
```html
<v-btn
  variant="text"
  size="default"
  class="mt-2"
  :aria-label="`Remove point from ${participant2Name}`"
  :disabled="currentGame.score2 === 0"
  @click.stop="removePoint('participant2')"
>
  <v-icon>mdi-minus</v-icon>
</v-btn>
```

**Step 2: Add aria-label to all 6 manual score inputs**

Find the manual score dialog's v-text-field inputs (around lines 762–850). Add `:aria-label` to each:

Game 1:
```html
<!-- participant1 -->
<v-text-field
  v-model.number="manualScores.game1.p1"
  :aria-label="`Game 1, ${participant1Name} score`"
  type="number"
  min="0"
  max="30"
  variant="outlined"
  density="compact"
  hide-details
  class="centered-input"
/>

<!-- participant2 -->
<v-text-field
  v-model.number="manualScores.game1.p2"
  :aria-label="`Game 1, ${participant2Name} score`"
  type="number"
  min="0"
  max="30"
  variant="outlined"
  density="compact"
  hide-details
  class="centered-input"
/>
```

Game 2 (same pattern):
```html
<v-text-field :aria-label="`Game 2, ${participant1Name} score`" v-model.number="manualScores.game2.p1" ... />
<v-text-field :aria-label="`Game 2, ${participant2Name} score`" v-model.number="manualScores.game2.p2" ... />
```

Game 3 (same pattern):
```html
<v-text-field :aria-label="`Game 3, ${participant1Name} score`" v-model.number="manualScores.game3.p1" ... />
<v-text-field :aria-label="`Game 3, ${participant2Name} score`" v-model.number="manualScores.game3.p2" ... />
```

**Step 3: Add `goBack()` function and replace `router.back()` calls**

In the `<script setup>`, add this function after the existing `onScoreCorrected()` function (around line 342):

```ts
function goBack(): void {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push(`/tournaments/${tournamentId.value}/match-control`);
  }
}
```

Then find all `router.back()` calls in the template and replace with `goBack()`. There are two:
1. The back arrow button in the header (around line 407): `@click="router.back()"` → `@click="goBack()"`
2. The "Back to Matches" button in the match-complete card (around line 646): `@click="router.back()"` → `@click="goBack()"`

**Step 4: Run tests**

```bash
npm run test -- --run
```

**Step 5: Type-check**

```bash
npm run type-check
```

**Step 6: Commit**

```bash
git add src/features/scoring/views/ScoringInterfaceView.vue
git commit -m "fix(a11y): scoring interface — touch targets, input labels, back navigation

- Minus buttons were size=small (~28px); changed to size=default (44px) for WCAG touch target
- Added aria-label to minus buttons (icon-only, no text)
- Added aria-label to all 6 manual score inputs (column headers not programmatically associated)
- goBack() falls back to /match-control when no history (QR code direct entry)"
```

---

## Task 7: LoginView — gate demo credentials to dev builds only

**Files:**
- Modify: `src/features/auth/views/LoginView.vue`

**Step 1: Add the `v-if` guard**

Find the demo credentials card at the bottom of the template (around line 179):

```html
<!-- BEFORE -->
<v-card
  class="mt-4"
  variant="tonal"
  color="info"
>

<!-- AFTER -->
<v-card
  v-if="import.meta.env.DEV"
  class="mt-4"
  variant="tonal"
  color="info"
>
```

No other changes needed. `import.meta.env.DEV` is a Vite built-in that is `true` during development and `false` (tree-shaken out) in production builds.

**Step 2: Type-check**

```bash
npm run type-check
```

**Step 3: Commit**

```bash
git add src/features/auth/views/LoginView.vue
git commit -m "fix: hide demo credentials from production builds

Demo credentials card was rendering unconditionally, exposing test account
details to end users. Gated behind import.meta.env.DEV."
```

---

## Task 8: EmptyState — fix broken CSS variable background

**Files:**
- Modify: `src/components/common/EmptyState.vue`

**Step 1: Replace root `div` with `v-sheet`**

The current template wraps content in a plain `div` with a broken `:style` binding. Replace it entirely:

```html
<!-- BEFORE -->
<template>
  <div
    class="empty-state-container"
    :style="{ backgroundColor: `var(--v-${color})` }"
  >
    <div class="empty-state-content">
      ...
    </div>
  </div>
</template>

<!-- AFTER -->
<template>
  <v-sheet
    :color="color"
    rounded
    class="empty-state-container"
  >
    <div class="empty-state-content">
      ...
    </div>
  </v-sheet>
</template>
```

`v-sheet` accepts Vuetify color props natively and generates correct CSS variables (`rgb(var(--v-theme-*))`). The `color` prop value of `'grey-lighten-1'` (the default) is a valid Vuetify color name.

**Step 2: Remove broken background styles from scoped CSS**

In the `<style scoped>` block, remove the `background-color` line from `.empty-state-container` (the `:style` binding previously handled this; now `v-sheet` does):

```css
/* BEFORE */
.empty-state-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 2rem;
  border-radius: 8px;
}

/* AFTER - remove background-color (was never working anyway; v-sheet handles it now) */
.empty-state-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}
```

Note: remove `padding: 2rem` and `border-radius: 8px` from the CSS class too — these are now handled by Vuetify's `rounded` prop and the `class="pa-8"` approach. Actually, keep `min-height: 300px` since that's not covered by Vuetify. The `pa-8` class on `v-sheet` handles padding (32px). The `rounded` prop handles border-radius.

The final `.empty-state-container` CSS:
```css
.empty-state-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}
```

**Step 3: Run tests**

```bash
npm run test -- --run
```

**Step 4: Type-check**

```bash
npm run type-check
```

**Step 5: Commit**

```bash
git add src/components/common/EmptyState.vue
git commit -m "fix: replace broken CSS variable in EmptyState with v-sheet color prop

:style=\"{ backgroundColor: \`var(--v-\${color})\` }\" generated var(--v-grey-lighten-1)
which is not a valid Vuetify 3 CSS variable format — silently produced no background.
v-sheet :color accepts Vuetify color names natively."
```

---

## Task 9: Final verification

**Step 1: Run full test suite**

```bash
npm run test -- --run
```
Expected: all tests pass. Zero new failures vs baseline.

**Step 2: Type-check**

```bash
npm run type-check
```
Expected: zero new errors vs baseline.

**Step 3: Lint**

```bash
npm run lint
```
Fix any lint warnings introduced by the changes.

**Step 4: Manual smoke check (browser)**

Start the dev server:
```bash
npm run dev
```

Verify each fix visually:

| Fix | How to verify |
|---|---|
| Skip link | Tab once from address bar on any page — a "Skip to main content" link should appear at top-left |
| Notification badge | If `unreadCount > 0`, badge should show a number, not just a dot |
| Nav drawer aria-label | Open browser accessibility tree (DevTools > Accessibility) — drawer should be labelled "Main navigation" |
| Rail collapse | Click any nav item in expanded sidebar — sidebar should NOT collapse unexpectedly |
| BaseDialog aria-label | Open any dialog, inspect close button — should have `aria-label="Close dialog"` |
| Tournament cards | On `/tournaments`, press Tab — cards should be focusable; Enter should navigate |
| updateStatus error | Not easily testable manually without mocking, but the catch block is now populated |
| Scoring touch targets | On `/matches/*/score`, inspect minus buttons — should be `size="default"` (40×40px min) |
| Scoring inputs aria-label | Open manual entry dialog, inspect inputs in DevTools — should have `aria-label` |
| Demo credentials | Set `NODE_ENV=production` or check production build — card should be absent |
| EmptyState background | Navigate to a page with empty state (no tournaments, empty registrations) — should have grey background |

**Step 5: Final commit summary**

```bash
git log --oneline fix/ui-a11y-correctness ^main
```

You should see 8 commits, one per task.

---

## PR Description Template

```
fix: accessibility and correctness bugs (Group A+B)

From a full UI/UX audit, fixes 13 Critical/High issues across 8 files.

**Accessibility (Group A):**
- Add skip-to-content link to AppLayout (every page)
- Add aria-label="Main navigation" to navigation drawer
- Add aria-label="Close dialog" to BaseDialog close button (all dialogs)
- Wire aria-labelledby from v-dialog to dialog title (all dialogs)
- Make tournament cards keyboard-navigable using :to instead of @click
- Increase scoring minus button touch targets from ~28px to 44px
- Add aria-label to all 6 manual score entry inputs
- Add aria-label to scoring minus buttons (icon-only)

**Correctness (Group B):**
- Fix notification badge: v-badge dot prop suppressed numeric count
- Fix EmptyState broken CSS variable → v-sheet color prop
- Gate demo credentials behind import.meta.env.DEV
- Add error toast to updateStatus() empty catch block
- Add router fallback in goBack() for direct-URL (QR code) entry

**Not included:** dark mode, icon unification, text-grey sweep, mobile filter overflow (Group C/D — separate PR)
```
