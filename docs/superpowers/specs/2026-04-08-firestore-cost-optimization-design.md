# Firestore Cost Optimization Design

**Date:** 2026-04-08
**Branch:** feat/tnf-2026-seed-refresh (design only, implementation on new branch)
**Problem:** Excessive Firestore reads (~12K/day observed) driven by listener leaks and a fan-out subscription pattern
**Goal:** Reduce reads by ~75–80% for a typical tournament day session

---

## Context

The Firebase Console showed 12K reads and 2.6K writes in 24 hours on a day with light activity. The root cause is two compounding issues:

1. **Listener leaks** — views subscribe to Firestore stores on mount but never unsubscribe on unmount. Navigation away and back stacks listeners.
2. **`subscribeAllMatches()` fan-out** — this function creates `2N+1` listeners where N = (categories × levels). A tournament with 3 categories and 2 levels each generates ~28 simultaneous open listeners that stay active for the entire session (organizer + scorekeeper keep views open all day).

A 16-hour tournament day with 28 listeners and periodic document updates across all collections would produce a very large read volume.

---

## Phase 1: Fix Listener Leaks

Three files require cleanup:

### 1. `TournamentDashboardView.vue`
**File:** `src/features/tournaments/views/TournamentDashboardView.vue`

`onMounted` subscribes to `tournamentsStore.subscribeTournament()`, `registrationsStore.subscribeRegistrations()`, `registrationsStore.subscribePlayers()`, and `activitiesStore.subscribeActivities()`. There is no `onUnmounted` hook. On every re-visit, listeners stack without being released.

**Fix:** Add `onUnmounted` that calls cleanup on all four stores:
```ts
onUnmounted(() => {
  tournamentsStore.unsubscribeAll()
  registrationsStore.unsubscribeAll()   // requires Phase 1.3
  activitiesStore.unsubscribe()
})
```

### 2. `TournamentListView.vue`
**File:** `src/features/tournaments/views/TournamentListView.vue`

`onMounted` calls `tournamentsStore.subscribeTournaments()`. No cleanup on unmount.

**Fix:**
```ts
onUnmounted(() => {
  tournamentsStore.unsubscribeAll()
})
```

### 3. `registrations.ts` — Add `unsubscribeAll()`
**File:** `src/stores/registrations.ts`

The store has `registrationsUnsubscribe` and `playersUnsubscribe` tracking variables but no public method to call both. Required by the view cleanup above.

**Fix:** Add method:
```ts
function unsubscribeAll() {
  registrationsUnsubscribe?.()
  registrationsUnsubscribe = null
  playersUnsubscribe?.()
  playersUnsubscribe = null
}
```

---

## Phase 2: Scoped Category Subscriptions

### Problem

`subscribeAllMatches()` in `src/stores/matches.ts` (line 817) eagerly subscribes to every category and every level simultaneously. It creates:
- 1 categories collection listener
- Per category: 2 listeners (matches + match_scores) + 1 levels collection listener
- Per level: 2 listeners (matches + match_scores)

For 3 categories × 2 levels: `1 + 3×(2+1) + 6×2 = 22+ listeners`. This stays open for the entire session.

### Solution

Replace the all-at-once fan-out with a **lazy per-category subscription** that activates only for the currently selected category.

#### New API in `matches.ts`

**Add `subscribeCategoryMatches(tournamentId, categoryId)`:**
- Creates exactly 2 listeners: matches collection filtered to `categoryId`, and match_scores filtered to `categoryId`
- Stores unsubscribers in the existing `categorySubscriptions` Map keyed by `categoryId`

**Add `unsubscribeCategoryMatches(categoryId)`:**
- Calls and removes the unsubscribers for that category from the Map
- No-ops safely if the category isn't subscribed

**Retain `subscribeAllMatches()` as-is** for any admin/reporting views that genuinely need all categories at once. The organizer dashboard switches to the scoped version.

#### View-level watcher pattern

In `MatchControlView.vue` (or whichever view calls `subscribeAllMatches`):

```ts
// Replace subscribeAllMatches() call with:
watch(selectedCategoryId, (newId, oldId) => {
  if (oldId) matchesStore.unsubscribeCategoryMatches(oldId)
  if (newId) matchesStore.subscribeCategoryMatches(tournamentId, newId)
}, { immediate: true })

onUnmounted(() => {
  if (selectedCategoryId.value) {
    matchesStore.unsubscribeCategoryMatches(selectedCategoryId.value)
  }
})
```

### Listener count comparison

| Scenario | Before | After |
|----------|--------|-------|
| Dashboard, 3 cats × 2 levels | ~28 listeners | 6 listeners |
| Category tab switch | Stays at 28 | Swaps 2 (old out, new in) |
| Navigate away + back | Listeners stack | Clean teardown + re-subscribe |

**The 6 remaining listeners:**
1. Tournament document
2. Categories subcollection
3. Courts subcollection
4. Matches for selected category
5. Match scores for selected category
6. Activities

---

## Files to Change

| File | Change |
|------|--------|
| `src/features/tournaments/views/TournamentDashboardView.vue` | Add `onUnmounted` cleanup |
| `src/features/tournaments/views/TournamentListView.vue` | Add `onUnmounted` cleanup |
| `src/stores/registrations.ts` | Add `unsubscribeAll()` |
| `src/stores/matches.ts` | Add `subscribeCategoryMatches()` and `unsubscribeCategoryMatches()` |
| View that calls `subscribeAllMatches()` (MatchControlView or similar) | Replace with per-category watcher pattern |

---

## Verification

1. **Local emulator** — open Match Control, check Firestore emulator UI listener count. Before: ~28. After: ~6.
2. **Leak test** — navigate away from dashboard to tournament list and back 3 times. Listener count should remain flat (not multiply).
3. **Tab switch test** — switch between 3 category tabs. Listener count stays at 6.
4. **Firebase Console** — after deploying, check Firestore Usage tab. Reads should drop measurably within the first active session.

---

## Expected Impact

- **~75–80% read reduction** for a full tournament day session
- Listener count: 28 → 6 on the heaviest view
- No UX change — real-time updates preserved for active category

---

## Out of Scope (future)

- Moving activities/registrations to on-demand reads (Approach B)
- Centralized subscription lifecycle manager (Approach C)
- Dashboard store `collectionGroup` query optimization
