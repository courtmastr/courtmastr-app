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
// SmartBracketView.vue — receives tournamentId + categoryId from route params
// reads: matchStore, tournamentStore, useLeaderboard (pool-scoped)
// computes: isPoolPhase, poolMatches, bracketParticipantIds, snapshotEntries, snapshotTiebreakerResolutions

// PoolDrawTab.vue
// Wraps PoolDrawView.vue directly — loads its own group data from Firestore.
props: { tournamentId: string; categoryId: string }

// StandingsTab.vue
props: { category: Category; poolMatches: Match[]; snapshotEntries: LeaderboardEntry[]; snapshotTiebreakerResolutions: TiebreakerResolution[] }
// derives inner sub-tab visibility from category.poolPhase

// PoolResultsSubTab.vue
// Wraps RoundRobinStandings (with pool-only matches prop).
props: { tournamentId: string; categoryId: string; matches: Match[] }

// PreElimSnapshotSubTab.vue
// Wraps LeaderboardTable. bracketParticipantIds used to override status label.
props: {
  entries: LeaderboardEntry[];
  tiebreakerResolutions: TiebreakerResolution[];
  bracketParticipantIds: Set<string>;  // registration IDs found in elimination matches
}

// MatchesByRoundTab.vue
// Renders the by-round match list (extracted from RoundRobinStandings inner "Matches" tab).
props: { matches: Match[] }  // pool-only matches

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

`useLeaderboard()` takes no constructor args. Call `generate()` imperatively in `SmartBracketView`. The `Leaderboard` type (`src/types/leaderboard.ts`) has both `entries` and `tiebreakerResolutions`.

```typescript
// SmartBracketView.vue
const { leaderboard, generate: generateSnapshot } = useLeaderboard();

// Guard: only generate once matches are loaded (generate() is one-shot, not reactive).
// Trigger on phase transition to elimination, when matches are guaranteed populated.
watch(isPoolPhase, async (nowPool) => {
  if (!nowPool) {
    await generateSnapshot(props.tournamentId, props.categoryId, { phaseScope: 'pool' });
  }
}, { immediate: false });
// Also generate on mount if already in elimination phase.
onMounted(async () => {
  if (!isPoolPhase.value) {
    await generateSnapshot(props.tournamentId, props.categoryId, { phaseScope: 'pool' });
  }
});

const snapshotEntries = computed(() => leaderboard.value?.entries ?? []);
const snapshotTiebreakerResolutions = computed(() => leaderboard.value?.tiebreakerResolutions ?? []);
```

### Pre-Elim Snapshot — bracket qualification status

`PreElimSnapshotSubTab` receives `bracketParticipantIds: Set<string>` — the set of registration IDs that appear in at least one elimination bracket match. Computed in `SmartBracketView`:

```typescript
const bracketParticipantIds = computed(() => {
  const ids = new Set<string>();
  matchStore.matches
    .filter(m => m.categoryId === props.categoryId && m.groupId == null)
    .forEach(m => {
      if (m.player1Id) ids.add(m.player1Id);
      if (m.player2Id) ids.add(m.player2Id);
    });
  return ids;
});
```

`PreElimSnapshotSubTab` renders a status chip per row using `bracketParticipantIds`:
- `registrationId in bracketParticipantIds` → green chip "Qualified"
- otherwise → red chip "Eliminated"

The standard `LeaderboardTable.vue` status slot is overridden via a scoped slot in `PreElimSnapshotSubTab`.

### Pre-Elim Snapshot columns

Reuse `LeaderboardTable.vue` with `showCategory=false`. Columns: `# | Participant | Status | MP | W-L | Played | Set W-L | Pts For/Ag | Pts +/-`.

### RoundRobinStandings fix

`RoundRobinStandings` currently queries the store directly AND fetches in `onMounted`. Changes required:

1. **Add `matches` prop**: `matches: Match[]` — pool-filtered matches passed from parent.
2. **Remove `onMounted` fetch**: delete the `matchStore.fetchMatches(...)` call (parent already fetched).
3. **Remove `watch(categoryId, ...)` re-fetch**: delete the watcher that re-fetches on categoryId change.
4. **Update `allMatches` computed**: change from `matchStore.matches.filter(...)` to `() => props.matches`.
5. **Remove inner "Matches by Round" tab**: the `v-tab value="matches"` and its `v-tabs-window-item` are removed from `RoundRobinStandings`. This view moves to the top-level `MatchesByRoundTab`. Keep only the "Standings" inner tab content (the `v-data-table`).

---

## UI / Theme Requirements

- Outer tabs: `v-tabs` with `color="primary"`, matching `src/features/registration/views/RegistrationManagementView.vue` tab style (lines 1429–1451).
- Inner sub-tabs (inside Standings): `v-tabs` with `color="primary"` and `density="compact"` to visually distinguish them as secondary navigation.
- Tab content transitions: `v-tabs-window` / `v-tabs-window-item` (Vuetify default slide transition) — no custom override needed.
- Phase transition (pool → elimination): auto-switch active outer tab to "Bracket" using a `watch` on `isPoolPhase`:
  ```typescript
  const activeTab = ref<'draw' | 'standings' | 'matches' | 'bracket'>(
    isPoolPhase.value ? 'draw' : 'bracket'
  );
  watch(isPoolPhase, (nowPool) => {
    if (!nowPool) activeTab.value = 'bracket';   // pools closed → jump to bracket
    else activeTab.value = 'draw';               // pools regenerated → jump to draw
  });
  ```
- Disabled/hidden tabs: use `v-if` (not `v-show`) for tabs that should not render in a given phase (Bracket during pool phase, Pre-Elim Snapshot sub-tab during pool phase). `BracketTab` unmounting/remounting on phase transition is intentional — it re-fetches bracket data on mount, which is correct behaviour.
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
