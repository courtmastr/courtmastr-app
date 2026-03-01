# UI Accessibility & Correctness Fixes — Design

**Date:** 2026-03-01
**Branch:** `fix/ui-a11y-correctness`
**Scope:** Group A (Accessibility — Critical/High) + Group B (Correctness bugs)
**Approach:** Single branch, all 13 fixes, one PR

---

## Background

A full UI/UX audit of the Vue 3 + Vuetify 3 codebase identified ~40 issues across accessibility, layout consistency, dark mode, and TypeScript quality. This document covers the highest-priority subset: issues that are either broken for keyboard/screen-reader users, or silently wrong in ways that affect real users (missing error feedback, broken CSS, security exposure).

---

## Files Touched and Changes

### 1. `src/components/layout/AppLayout.vue`

**A — Skip-to-content link (Critical)**
Add a visually hidden skip link as the first element in the layout so keyboard users can bypass sidebar + app bar navigation:
```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```
Add `id="main-content"` to `<v-main>`. Style `.skip-link` to be off-screen by default and visible on focus.

**B — Fix `v-badge` `dot` + `:content` conflict (High)**
`dot` and `:content` are mutually exclusive in Vuetify. When `dot` is set, the count is never shown. Remove the `dot` prop so the numeric unread count is displayed. Keep `:model-value="unreadCount > 0"` to hide the badge when empty.

---

### 2. `src/components/navigation/AppNavigation.vue`

**A — Add `aria-label` to drawer (High)**
`<v-navigation-drawer>` with no label is not announced as a landmark. Add `aria-label="Main navigation"`.

**B — Remove `@click="rail = false"` from drawer root (Medium)**
Clicking anywhere in the drawer (including nav links) collapses rail mode, which is unexpected. The collapse button already handles this via `@click.stop`. Remove the handler from the drawer root element.

---

### 3. `src/components/common/BaseDialog.vue`

**A — `aria-label` on close button (Critical)**
Icon-only buttons must have an accessible label (WCAG 2.1 SC 1.1.1). The close `v-btn` currently has none:
```html
<v-btn aria-label="Close dialog" icon="mdi-close" ... />
```
This fix propagates to every dialog in the app that uses `BaseDialog`.

**B — Wire `aria-labelledby` (High)**
Vuetify applies `role="dialog"` on `v-dialog` but not `aria-labelledby`. Add a stable `id` to the title element and reference it on the dialog so screen readers announce the dialog title on open:
```html
<v-dialog aria-labelledby="base-dialog-title" ...>
  <v-card-title id="base-dialog-title">
```

---

### 4. `src/features/tournaments/views/TournamentListView.vue`

**A — Keyboard-navigable tournament cards (Critical)**
`@click` on a plain `v-card` produces no `tabindex`, no `role="button"`, and no keyboard handler — Tab stops skip every card entirely. Replace with `:to`:
```html
<v-card :to="`/tournaments/${tournament.id}`" class="tournament-card">
```
Vuetify automatically adds `role="link"`, `tabindex="0"`, and keyboard activation. Remove the `viewTournament()` click handler and the `@click` binding.

Also remove the decorative `v-btn icon="mdi-chevron-right"` (currently `aria-hidden="true" tabindex="-1"`) — it becomes redundant and adds visual noise.

---

### 5. `src/features/tournaments/views/TournamentDashboardView.vue`

**A — Error feedback in `updateStatus()` (High)**
The `catch` block is empty — status update failures are silently swallowed:
```ts
} catch (error) {
  notificationStore.showToast('error', 'Failed to update tournament status');
}
```

---

### 6. `src/features/scoring/views/ScoringInterfaceView.vue`

**A — Minus button touch target (Critical)**
The score-decrement button is `size="small"` (~28×28px), below the 44×44px WCAG touch target minimum. This is a live scoring screen used on mobile devices. Change to `size="default"` for both minus buttons.

**B — `aria-label` on manual score inputs (High)**
The 6 score inputs in the manual-entry dialog have no labels — only column-header text which is not programmatically associated. Add `aria-label` to each field:
```html
<v-text-field :aria-label="`Game 1, ${participant1Name} score`" ... />
<v-text-field :aria-label="`Game 1, ${participant2Name} score`" ... />
<!-- repeat for games 2 and 3 -->
```

**C — `router.back()` dead end (Medium)**
Back buttons call `router.back()` which does nothing when the user arrived via direct URL (e.g., QR code). Add a fallback:
```ts
function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push(`/tournaments/${tournamentId.value}/match-control`);
  }
}
```
Replace both `router.back()` calls in the template with `goBack()`.

---

### 7. `src/features/auth/views/LoginView.vue`

**A — Gate demo credentials in production (High)**
The demo credentials card renders unconditionally, exposing internal test accounts in production:
```html
<v-card v-if="import.meta.env.DEV" ...>
```

---

### 8. `src/components/common/EmptyState.vue`

**A — Fix broken CSS variable for background color (High)**
`:style="{ backgroundColor: \`var(--v-${color})\` }"` generates `var(--v-grey-lighten-1)` — not a valid Vuetify 3 CSS variable format (Vuetify 3 uses `rgb(var(--v-theme-surface))` patterns). This silently produces no background on every empty state in the app.

Replace the root `div` with a `v-sheet` which accepts Vuetify color props natively:
```html
<v-sheet :color="color" rounded class="empty-state-container pa-8">
```
Remove the `:style` binding and the scoped `.empty-state-container` background styles.

---

## Success Criteria

- All 8 Vuetify/Vue components pass the specific change listed above
- No new TypeScript errors introduced
- Existing unit tests continue to pass (`npm run test:unit`)
- Skip link is visible on keyboard focus in the browser
- Tournament cards are Tab-navigable and activate on Enter/Space
- BaseDialog close button announced as "Close dialog" by screen readers
- Notification badge shows numeric count when `unreadCount > 0`
- Demo credentials card absent from production build
- Empty states render with a background color in all contexts
- Score decrement buttons are at least 40px tall on mobile

## Out of Scope (this PR)

- Dark mode toggle wiring (Group D)
- Icon system unification (Group C)
- `text-grey` → `text-medium-emphasis` sweep (Group C)
- Mobile filter overflow (Group C)
- TypeScript `any` cleanup (Group C)
