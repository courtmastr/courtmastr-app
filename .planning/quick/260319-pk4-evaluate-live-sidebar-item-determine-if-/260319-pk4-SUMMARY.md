---
phase: 260319-pk4
plan: "01"
subsystem: tournaments/navigation
tags: [live-view, navigation, scoreboard, routing]
dependency_graph:
  requires: []
  provides: [LiveScoringView, conditional-live-nav]
  affects: [AppNavigation, router]
tech_stack:
  added: []
  patterns: [Vuetify v-card grid, matchStore subscription, conditional nav v-if]
key_files:
  created:
    - src/features/tournaments/views/LiveScoringView.vue
  modified:
    - src/router/index.ts
    - src/components/navigation/AppNavigation.vue
key_decisions:
  - "Used match.courtName (denormalized field on Match) for court display rather than tournament courts lookup"
  - "Mirrored ObsScoreboardView subscription pattern for onMounted/onUnmounted lifecycle"
  - "isTournamentLive computed checks currentTournament.state === 'LIVE' in AppNavigation"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-19"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Quick Task 260319-pk4: Live View Scoreboard Page — Summary

## One-liner

Read-only Vuetify live scoreboard page at `/tournaments/:id/live-view` with conditional nav visibility gated on `LIVE` tournament state.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create LiveScoringView.vue and update route | 8893be7 | LiveScoringView.vue (created), router/index.ts (modified) |
| 2 | Conditionally show Live View nav item only when LIVE | f32e547 | AppNavigation.vue (modified) |

## What Was Built

### LiveScoringView.vue (258 lines)

Read-only organizer-facing scoreboard using Vuetify components and the app's dark surface card styling. Features:

- Page header showing tournament name and live match count
- "In Progress" section: responsive grid (1/2/3 cols mobile/md/lg) of `v-card bg-surface` cards showing court, category, player names, games won (e.g. `1`), and current game score — with a green LIVE chip
- "Up Next" section: smaller cards listing ready matches with player names
- Empty state when no matches are in progress
- Real-time subscriptions via `matchStore.subscribeAllMatches` + `tournamentStore.subscribeTournament`
- Proper `onUnmounted` cleanup for all store subscriptions

### Route update (router/index.ts)

Replaced the broken redirect to `match-control?view=queue` with a proper lazy-loaded component route pointing to `LiveScoringView.vue`.

### Nav visibility update (AppNavigation.vue)

Added `isTournamentLive` computed (`currentTournament?.state === 'LIVE'`) and updated the Live View nav item `v-if` from `isOrganizer` to `isOrganizer && isTournamentLive`. The item is now hidden for all non-live states (DRAFT, REG_OPEN, REG_CLOSED, SEEDING, BRACKET_GENERATED, BRACKET_LOCKED, COMPLETED).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used match.courtName instead of tournament courts lookup**
- **Found during:** Task 1 implementation
- **Issue:** The plan suggested looking up court name from `tournament.courts` array, but the `Tournament` type has no `courts` field. Match already carries a denormalized `courtName?: string` field (same approach used in ObsScoreboardView).
- **Fix:** `getCourtName(match)` simply returns `match.courtName ?? ''`
- **Files modified:** src/features/tournaments/views/LiveScoringView.vue
- **Commit:** 8893be7

## Self-Check

### Files exist
- src/features/tournaments/views/LiveScoringView.vue: FOUND (258 lines)
- src/router/index.ts contains "LiveScoringView": FOUND
- src/components/navigation/AppNavigation.vue contains "isTournamentLive": FOUND (lines 181, 404)

### Redirect removed
- `grep "redirect" src/router/index.ts | grep "live-view"` returns nothing: CONFIRMED

### TypeScript
- `npx vue-tsc --noEmit` passes with no output: CONFIRMED

## Self-Check: PASSED
