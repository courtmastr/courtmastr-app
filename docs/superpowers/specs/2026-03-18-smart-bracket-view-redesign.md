# SmartBracketView Redesign — Design Spec

**Date:** 2026-03-18
**Branch:** feat/global-players-org-platform
**Status:** Approved

---

## Problem

`SmartBracketView.vue` currently shows Pool Draw and Standings tabs during pool phase, but all pool-related tabs disappear when the tournament transitions to the elimination phase (`poolPhase = 'elimination'`). This means pool results and match history are inaccessible once elimination begins. Additionally, `RoundRobinStandings` does not filter by phase, so during elimination it would mix pool and bracket match data in stats — producing incorrect standings.

---

## Goals

1. Pool Draw, Pool Results, Pre-Elimination Snapshot, and Matches by Round remain accessible throughout the entire tournament.
2. Pre-Elimination Snapshot shows the full leaderboard-style standings (same columns and component as the main leaderboard) computed from pool matches only — frozen for all time.
3. Bracket tab appears only when the bracket is generated (elimination phase).
4. All UI matches the app theme and includes micro-animations consistent with other pages.
5. No new Firestore data structures needed — all views derive from existing permanent pool match documents.

---

## Non-Goals

- Leaderboard view changes (stays `carry_forward` scope — no code changes needed).
- Double-elimination bracket UI changes.
- Any admin-only functionality — this view is already public-facing.

---

## Tab Structure

### Outer tabs (4)

| Tab | Pool phase | Elimination phase | Default active |
|---|---|---|---|
| Pool Draw | visible | visible | Pool phase |
| Standings | visible | visible | — |
| Matches by Round | visible | visible | — |
| Bracket | **hidden** | visible | Elimination phase |

Phase is derived from `category.poolPhase`: `'pool'` = pool phase, `'elimination'` = elimination phase.

### Standings inner sub-tabs (2)

| Sub-tab | Pool phase | Elimination phase | Default active |
|---|---|---|---|
| Pool Results | visible | visible | Always |
| Pre-Elim Snapshot | **hidden** | visible | Elimination phase |

---

## Component Architecture

`SmartBracketView.vue` becomes a thin orchestrator — it reads from stores once and passes data down via props. No store access inside tab components.

```
src/features/brackets/components/
├── SmartBracketView.vue           ← thin orchestrator (tab switching + phase logic)
├── PoolDrawTab.vue                ← extracted from current SmartBracketView pool draw section
├── StandingsTab.vue               ← owns inner sub-tab switcher
│   ├── PoolResultsSubTab.vue      ← per-pool ranked tables
│   └── PreElimSnapshotSubTab.vue  ← reuses LeaderboardTable with pool-only data
├── MatchesByRoundTab.vue          ← extracted from current RoundRobinStandings "Matches" inner tab
└── BracketTab.vue                 ← extracted from current elimination bracket render
```

Existing components retained as-is (no deletion):
- `PoolDrawView.vue` — used by `PoolDrawTab.vue`
- `RoundRobinStandings.vue` — used by `PoolResultsSubTab.vue` (with pool-only match filter fix)
- `BracketView.vue`, `DoubleEliminationBracket.vue` — used by `BracketTab.vue`
- `LeaderboardTable.vue` — used by `PreElimSnapshotSubTab.vue`

---

## Props Contracts

```typescript
// SmartBracketView.vue — receives tournamentId + categoryId from route
// reads: matchStore, tournamentStore
// computes: isPoolPhase, poolMatches, category, groups

// PoolDrawTab.vue
props: { categoryId: string; groups: Group[] }

// StandingsTab.vue
props: { categoryId: string; category: Category }
// derives inner sub-tab visibility from category.poolPhase

// PoolResultsSubTab.vue
props: { categoryId: string; groups: Group[]; matches: Match[] }
// matches = pool-only (groupId != null filter applied in SmartBracketView)

// PreElimSnapshotSubTab.vue
props: { entries: LeaderboardEntry[]; tiebreakerResolutions: TiebreakerResolution[] }
// entries computed via useLeaderboard({ phaseScope: 'pool' }) in SmartBracketView

// MatchesByRoundTab.vue
props: { categoryId: string; matches: Match[] }
// matches = pool-only (groupId != null)

// BracketTab.vue
props: { categoryId: string; category: Category }
// owns its own bracket data (existing logic moved from SmartBracketView)
```

---

## Data Flow

### Pool match filter

Pool matches always have `groupId != null`. Elimination matches always have `groupId == null`. This is permanent — pool match docs are never deleted. Filter in `SmartBracketView.vue`:

```typescript
const poolMatches = computed(() =>
  matchStore.matches.filter(m => m.categoryId === props.categoryId && m.groupId != null)
);
```

### Pre-Elim Snapshot data

Use existing `useLeaderboard` composable with `phaseScope: 'pool'`. This uses `category.poolStageId` to filter matches — already supported.

```typescript
const { entries, tiebreakerResolutions } = useLeaderboard({
  categoryId: props.categoryId,
  phaseScope: 'pool',
});
```

### Pre-Elim Snapshot columns

Reuse `LeaderboardTable.vue` with `showCategory=false`. Columns: `# | Participant | Status | MP | W-L | Played | Set W-L | Pts For/Ag | Pts +/-`. Status chip shows "Qualified" (green) if participant appears in the bracket seedings, "Eliminated" (red) otherwise.

### RoundRobinStandings fix

`RoundRobinStandings` currently queries `matchStore.matches.filter(m => m.categoryId)` — no phase filter. Fix: pass `poolMatches` (already filtered) as a prop instead of letting it query the store directly. This prevents elimination bracket results from mixing into pool standings stats.

---

## UI / Theme Requirements

- Outer tabs: `v-tabs` with `color="primary"`, matching `RegistrationManagementView` tab style.
- Inner sub-tabs (inside Standings): `v-tabs` with `color="primary"` and `density="compact"` to visually distinguish them as secondary navigation.
- Tab content transitions: `v-tabs-window` / `v-tabs-window-item` (Vuetify default slide transition) — no custom override needed.
- Phase transition (pool → elimination): auto-switch active outer tab to "Bracket" using a `watch` on `isPoolPhase`.
- Disabled/hidden tabs: use `v-if` (not `v-show`) for tabs that should not render in a given phase (Bracket during pool phase, Pre-Elim Snapshot sub-tab during pool phase).
- Loading states: each tab component manages its own loading skeleton, matching the `v-skeleton-loader` pattern used in existing tournament views.
- Empty states: if no data for a section (e.g., no groups yet), show a `v-alert` with `variant="tonal"` and an appropriate icon — consistent with app conventions.

---

## Edge Cases

| Case | Behaviour |
|---|---|
| User is on Bracket tab, pools regenerated (poolPhase resets to 'pool') | Watch on `isPoolPhase` auto-switches active tab to Pool Draw |
| Pre-Elim Snapshot visited during pool phase | Tab is hidden (`v-if="!isPoolPhase"`) — user cannot reach it |
| Category has no groups yet (pools not generated) | Pool Draw tab shows empty state alert; Standings shows empty state |
| Leveled category (multiple levels) | Same logic applies — `poolPhase` field exists on all pool-format categories |

---

## Files to Create

- `src/features/brackets/components/PoolDrawTab.vue`
- `src/features/brackets/components/StandingsTab.vue`
- `src/features/brackets/components/PoolResultsSubTab.vue`
- `src/features/brackets/components/PreElimSnapshotSubTab.vue`
- `src/features/brackets/components/MatchesByRoundTab.vue`
- `src/features/brackets/components/BracketTab.vue`

## Files to Modify

- `src/features/brackets/components/SmartBracketView.vue` — refactored to thin orchestrator
- `src/features/brackets/components/RoundRobinStandings.vue` — accept `matches` prop instead of querying store directly; add pool-only filter guard

---

## Out of Scope

- Routing changes
- URL-driven tab state (deep links to specific tabs)
- Admin controls within the bracket view
- Leaderboard page modifications
