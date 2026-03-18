# SmartBracketView Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign SmartBracketView so pool tabs (Pool Draw, Standings, Matches by Round) remain accessible throughout the entire tournament, add a Pre-Elimination Snapshot using the existing leaderboard component, and show the Bracket tab only during elimination phase.

**Architecture:** Decompose `SmartBracketView.vue` into a thin orchestrator with 6 focused child components. `RoundRobinStandings.vue` is refactored to accept an optional `matches` prop (preserving backward-compat for standalone `round_robin` usage). `LeaderboardTable.vue` gains an optional `bracketParticipantIds` prop for Qualified/Eliminated status display.

**Tech Stack:** Vue 3 + Composition API + `<script setup lang="ts">`, Vuetify 3 (`v-tabs`, `v-tabs-window`), TypeScript, Pinia stores (`useMatchStore`, `useRegistrationStore`, `useTournamentStore`), `useLeaderboard` composable.

**Spec:** `docs/superpowers/specs/2026-03-18-smart-bracket-view-redesign.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/features/brackets/components/SmartBracketView.vue` | Thin orchestrator: category selector, 4 outer tabs, phase logic, data fetching. Still renders `RoundRobinStandings` directly for pure `round_robin` format (bypasses tabs). |
| Modify | `src/features/brackets/components/RoundRobinStandings.vue` | Add optional `matches` prop; remove inner "Matches by Round" tab; guard fetching |
| Modify | `src/components/leaderboard/LeaderboardTable.vue` | Add optional `bracketParticipantIds` prop for Qualified/Eliminated status |
| Create | `src/features/brackets/components/PoolDrawTab.vue` | Thin wrapper around `PoolDrawView.vue` |
| Create | `src/features/brackets/components/MatchesByRoundTab.vue` | Matches grouped by round (extracted from RoundRobinStandings) |
| Create | `src/features/brackets/components/PoolResultsSubTab.vue` | Wraps `RoundRobinStandings` with pool-only matches |
| Create | `src/features/brackets/components/PreElimSnapshotSubTab.vue` | Wraps `LeaderboardTable` with snapshot data + Qualified/Eliminated logic |
| Create | `src/features/brackets/components/StandingsTab.vue` | Inner sub-tab switcher (Pool Results + Pre-Elim Snapshot) |
| Create | `src/features/brackets/components/BracketTab.vue` | Wraps `BracketView` / `DoubleEliminationBracket` |

---

## Task 1: Add `bracketParticipantIds` prop to `LeaderboardTable`

**Files:**
- Modify: `src/components/leaderboard/LeaderboardTable.vue`

- [ ] **Step 1: Read the file**

  Open `src/components/leaderboard/LeaderboardTable.vue`. Locate:
  - The `defineProps` block (lines 7–13)
  - `statusLabel()` function (lines 87–93)
  - `statusColor()` function (lines 95–101)

- [ ] **Step 2: Add the optional prop and update status functions**

  In `defineProps`, add one optional field:

  ```typescript
  const props = defineProps<{
    entries: LeaderboardEntry[];
    loading: boolean;
    tiebreakerResolutions: TiebreakerResolution[];
    showCategory?: boolean;
    dense?: boolean;
    bracketParticipantIds?: Set<string>;  // ← add this
  }>();
  ```

  Replace `statusLabel()`:

  ```typescript
  function statusLabel(entry: LeaderboardEntry): string {
    if (props.bracketParticipantIds) {
      return props.bracketParticipantIds.has(entry.registrationId) ? 'Qualified' : 'Eliminated';
    }
    if (entry.matchesPlayed === 0) return 'Awaiting';
    if (entry.eliminated) return 'Eliminated';
    if (entry.rank === 1) return 'Leader';
    if (entry.rank <= 3) return 'Podium';
    return 'Active';
  }
  ```

  Replace `statusColor()`:

  ```typescript
  function statusColor(entry: LeaderboardEntry): string {
    if (props.bracketParticipantIds) {
      return props.bracketParticipantIds.has(entry.registrationId) ? 'success' : 'error';
    }
    if (entry.matchesPlayed === 0) return 'grey';
    if (entry.eliminated) return 'error';
    if (entry.rank === 1) return 'warning';
    if (entry.rank <= 3) return 'success';
    return 'info';
  }
  ```

- [ ] **Step 3: Verify build passes**

  ```bash
  cd /Users/ramc/Documents/Code/courtmaster-v2 && npm run type-check
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/leaderboard/LeaderboardTable.vue
  git commit -m "feat(leaderboard): add bracketParticipantIds prop for Qualified/Eliminated status"
  ```

---

## Task 2: Refactor `RoundRobinStandings` — add `matches` prop, remove inner Matches tab

**Files:**
- Modify: `src/features/brackets/components/RoundRobinStandings.vue`

The current component has 2 inner tabs ("Standings" and "Matches by Round"). After this task it will only show the standings table — no inner tabs. The Matches by Round view moves to `MatchesByRoundTab.vue` (Task 3). It also gains an optional `matches` prop; when provided, skip self-fetching (pool context). When absent, fetch as usual (standalone `round_robin` context).

- [ ] **Step 1: Update props and script setup**

  Replace the `defineProps` block:

  ```typescript
  const props = defineProps<{
    tournamentId: string;
    categoryId: string;
    matches?: Match[];  // optional — provided by SmartBracketView for pool_to_elimination
  }>();
  ```

  Change `allMatches` computed to use the prop when provided:

  ```typescript
  const allMatches = computed(() =>
    props.matches ?? matchStore.matches.filter((m) => m.categoryId === props.categoryId)
  );
  ```

  Guard `onMounted` to skip fetching when `matches` prop is provided (parent already fetched):

  ```typescript
  onMounted(async () => {
    if (!props.matches) {
      await Promise.all([
        matchStore.fetchMatches(props.tournamentId, props.categoryId),
        registrationStore.fetchRegistrations(props.tournamentId),
        registrationStore.fetchPlayers(props.tournamentId),
      ]);
    }
    loading.value = false;
  });
  ```

  Guard the `watch(categoryId)` the same way:

  ```typescript
  watch(
    () => props.categoryId,
    async () => {
      if (!props.matches) {
        loading.value = true;
        await matchStore.fetchMatches(props.tournamentId, props.categoryId);
        loading.value = false;
      }
    }
  );
  ```

  Remove `activeTab` ref — it was for the inner tabs which are being removed.

  Remove the `matchesByRound` and `rounds` computeds — they move to `MatchesByRoundTab.vue`.

- [ ] **Step 2: Remove inner tabs from template**

  In the template, remove the `<v-tabs>` / `<v-tabs-window>` wrapper entirely. The component now renders just the stats card + standings table directly (the content that was inside `<v-tabs-window-item value="standings">`).

  The final template structure should be:

  ```html
  <div class="round-robin-standings">
    <!-- Loading -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <!-- Empty State -->
    <div v-else-if="allMatches.length === 0" class="text-center py-8">
      <v-icon size="64" color="grey-lighten-1">mdi-tournament</v-icon>
      <p class="text-body-1 text-grey mt-4">No matches generated yet</p>
    </div>

    <template v-else>
      <!-- Tournament Stats card (keep as-is) -->
      ...

      <!-- Standings table directly (no v-tabs wrapper) -->
      <v-card>
        <v-data-table ...>
          ...
        </v-data-table>
      </v-card>

      <!-- BWF Rules expansion panel (keep as-is) -->
      ...
    </template>
  </div>
  ```

- [ ] **Step 3: Verify build passes**

  ```bash
  npm run type-check
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add src/features/brackets/components/RoundRobinStandings.vue
  git commit -m "refactor(brackets): add optional matches prop to RoundRobinStandings; remove inner Matches tab"
  ```

---

## Task 3: Create `MatchesByRoundTab.vue`

**Files:**
- Create: `src/features/brackets/components/MatchesByRoundTab.vue`

This is the "Matches by Round" content extracted verbatim from `RoundRobinStandings`. It receives pool matches from its parent and uses `useParticipantResolver` (reads from already-populated registration store — no fetching).

- [ ] **Step 1: Create the file**

  ```vue
  <script setup lang="ts">
  import { computed } from 'vue';
  import { useParticipantResolver } from '@/composables/useParticipantResolver';
  import { useMatchDisplay } from '@/composables/useMatchDisplay';
  import type { Match } from '@/types';

  const props = defineProps<{
    matches: Match[];
  }>();

  const { getParticipantName } = useParticipantResolver();
  const { getMatchStatusColor } = useMatchDisplay();

  const matchesByRound = computed(() => {
    const rounds: Record<number, Match[]> = {};
    for (const match of props.matches) {
      if (!rounds[match.round]) rounds[match.round] = [];
      rounds[match.round].push(match);
    }
    return rounds;
  });

  const rounds = computed(() =>
    Object.keys(matchesByRound.value).map(Number).sort((a, b) => a - b)
  );

  function getMatchScore(match: Match): string {
    if (match.scores.length === 0) return '-';
    return match.scores.map((s) => `${s.score1}-${s.score2}`).join(', ');
  }
  </script>

  <template>
    <div class="matches-by-round-tab">
      <div v-if="matches.length === 0" class="text-center py-8">
        <v-icon size="64" color="grey-lighten-1">mdi-calendar-blank</v-icon>
        <p class="text-body-1 text-grey mt-4">No matches yet</p>
      </div>

      <v-expansion-panels v-else variant="accordion">
        <v-expansion-panel
          v-for="round in rounds"
          :key="round"
          :title="`Round ${round}`"
        >
          <template #text>
            <v-list density="compact">
              <v-list-item
                v-for="match in matchesByRound[round]"
                :key="match.id"
                class="match-item"
              >
                <template #prepend>
                  <v-chip
                    :color="getMatchStatusColor(match.status)"
                    size="small"
                    class="mr-3"
                  >
                    #{{ match.matchNumber }}
                  </v-chip>
                </template>

                <v-list-item-title class="d-flex align-center">
                  <span
                    class="participant-name"
                    :class="{ 'font-weight-bold text-success': match.winnerId === match.participant1Id }"
                  >
                    {{ getParticipantName(match.participant1Id) }}
                  </span>
                  <span class="mx-3 text-grey">vs</span>
                  <span
                    class="participant-name"
                    :class="{ 'font-weight-bold text-success': match.winnerId === match.participant2Id }"
                  >
                    {{ getParticipantName(match.participant2Id) }}
                  </span>
                </v-list-item-title>

                <template #append>
                  <v-chip
                    v-if="match.status === 'completed'"
                    variant="tonal"
                    size="small"
                  >
                    {{ getMatchScore(match) }}
                  </v-chip>
                  <v-chip
                    v-else
                    :color="getMatchStatusColor(match.status)"
                    variant="tonal"
                    size="small"
                  >
                    {{ match.status }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
          </template>
        </v-expansion-panel>
      </v-expansion-panels>
    </div>
  </template>

  <style scoped>
  .match-item {
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }
  .participant-name {
    min-width: 150px;
  }
  </style>
  ```

- [ ] **Step 2: Verify build passes**

  ```bash
  npm run type-check
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/features/brackets/components/MatchesByRoundTab.vue
  git commit -m "feat(brackets): add MatchesByRoundTab component"
  ```

---

## Task 4: Create `PoolDrawTab.vue`

**Files:**
- Create: `src/features/brackets/components/PoolDrawTab.vue`

Thin wrapper — `PoolDrawView` loads its own groups from Firestore internally.

- [ ] **Step 1: Create the file**

  ```vue
  <script setup lang="ts">
  import PoolDrawView from './PoolDrawView.vue';

  defineProps<{
    tournamentId: string;
    categoryId: string;
  }>();
  </script>

  <template>
    <PoolDrawView
      :tournament-id="tournamentId"
      :category-id="categoryId"
    />
  </template>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/features/brackets/components/PoolDrawTab.vue
  git commit -m "feat(brackets): add PoolDrawTab wrapper component"
  ```

---

## Task 5: Create `PoolResultsSubTab.vue`

**Files:**
- Create: `src/features/brackets/components/PoolResultsSubTab.vue`

Wraps `RoundRobinStandings` with pool-only matches injected via prop.

- [ ] **Step 1: Create the file**

  ```vue
  <script setup lang="ts">
  import RoundRobinStandings from './RoundRobinStandings.vue';
  import type { Match } from '@/types';

  defineProps<{
    tournamentId: string;
    categoryId: string;
    matches: Match[];  // pool-only (groupId != null), pre-filtered by parent
  }>();
  </script>

  <template>
    <RoundRobinStandings
      :tournament-id="tournamentId"
      :category-id="categoryId"
      :matches="matches"
    />
  </template>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/features/brackets/components/PoolResultsSubTab.vue
  git commit -m "feat(brackets): add PoolResultsSubTab component"
  ```

---

## Task 6: Create `PreElimSnapshotSubTab.vue`

**Files:**
- Create: `src/features/brackets/components/PreElimSnapshotSubTab.vue`

Renders the full leaderboard table computed from pool matches only, with Qualified/Eliminated status. Uses `LeaderboardTable.vue` with the `bracketParticipantIds` prop added in Task 1.

- [ ] **Step 1: Create the file**

  ```vue
  <script setup lang="ts">
  import LeaderboardTable from '@/components/leaderboard/LeaderboardTable.vue';
  import type { LeaderboardEntry, TiebreakerResolution } from '@/types/leaderboard';

  defineProps<{
    entries: LeaderboardEntry[];
    tiebreakerResolutions: TiebreakerResolution[];
    bracketParticipantIds: Set<string>;
    loading: boolean;
  }>();
  </script>

  <template>
    <div class="pre-elim-snapshot-tab">
      <div class="d-flex align-center mb-3 pa-1">
        <v-icon color="primary" class="mr-2">mdi-camera</v-icon>
        <span class="text-body-2 text-medium-emphasis">
          Standings at the moment pools closed — computed from pool matches only, never changes.
        </span>
      </div>

      <LeaderboardTable
        :entries="entries"
        :loading="loading"
        :tiebreaker-resolutions="tiebreakerResolutions"
        :show-category="false"
        :bracket-participant-ids="bracketParticipantIds"
      />
    </div>
  </template>
  ```

- [ ] **Step 2: Verify build passes**

  ```bash
  npm run type-check
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/features/brackets/components/PreElimSnapshotSubTab.vue
  git commit -m "feat(brackets): add PreElimSnapshotSubTab component"
  ```

---

## Task 7: Create `StandingsTab.vue`

**Files:**
- Create: `src/features/brackets/components/StandingsTab.vue`

Owns the inner sub-tab switcher. Shows "Pool Results" always; shows "Pre-Elim Snapshot" only when `category.poolPhase === 'elimination'`.

- [ ] **Step 1: Create the file**

  ```vue
  <script setup lang="ts">
  import { ref, computed } from 'vue';
  import PoolResultsSubTab from './PoolResultsSubTab.vue';
  import PreElimSnapshotSubTab from './PreElimSnapshotSubTab.vue';
  import type { Category, Match } from '@/types';
  import type { LeaderboardEntry, TiebreakerResolution } from '@/types/leaderboard';

  const props = defineProps<{
    tournamentId: string;
    category: Category;
    poolMatches: Match[];
    snapshotEntries: LeaderboardEntry[];
    snapshotTiebreakerResolutions: TiebreakerResolution[];
    snapshotLoading: boolean;
    bracketParticipantIds: Set<string>;
  }>();

  const isElimPhase = computed(() => props.category.poolPhase === 'elimination');
  const activeSubTab = ref<'pool-results' | 'snapshot'>('pool-results');
  </script>

  <template>
    <div class="standings-tab">
      <!-- Inner sub-tabs: only show tab bar if snapshot is available -->
      <v-tabs
        v-if="isElimPhase"
        v-model="activeSubTab"
        color="primary"
        density="compact"
        class="mb-3"
      >
        <v-tab value="pool-results">
          <v-icon start>mdi-podium</v-icon>
          Pool Results
        </v-tab>
        <v-tab value="snapshot">
          <v-icon start>mdi-camera</v-icon>
          Pre-Elim Snapshot
        </v-tab>
      </v-tabs>

      <v-tabs-window v-if="isElimPhase" v-model="activeSubTab">
        <v-tabs-window-item value="pool-results">
          <PoolResultsSubTab
            :tournament-id="tournamentId"
            :category-id="category.id"
            :matches="poolMatches"
          />
        </v-tabs-window-item>
        <v-tabs-window-item value="snapshot">
          <PreElimSnapshotSubTab
            :entries="snapshotEntries"
            :tiebreaker-resolutions="snapshotTiebreakerResolutions"
            :bracket-participant-ids="bracketParticipantIds"
            :loading="snapshotLoading"
          />
        </v-tabs-window-item>
      </v-tabs-window>

      <!-- Pool phase: just show pool results directly (no sub-tab bar needed) -->
      <PoolResultsSubTab
        v-else
        :tournament-id="tournamentId"
        :category-id="category.id"
        :matches="poolMatches"
      />
    </div>
  </template>
  ```

- [ ] **Step 2: Verify build passes**

  ```bash
  npm run type-check
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/features/brackets/components/StandingsTab.vue
  git commit -m "feat(brackets): add StandingsTab with inner sub-tabs"
  ```

---

## Task 8: Create `BracketTab.vue`

**Files:**
- Create: `src/features/brackets/components/BracketTab.vue`

Wraps `BracketView` or `DoubleEliminationBracket` depending on format.

- [ ] **Step 1: Create the file**

  ```vue
  <script setup lang="ts">
  import { computed } from 'vue';
  import BracketView from './BracketView.vue';
  import DoubleEliminationBracket from './DoubleEliminationBracket.vue';
  import type { Category } from '@/types';

  const props = defineProps<{
    tournamentId: string;
    categoryId: string;
    category: Category;
  }>();

  const isDouble = computed(() => props.category.format === 'double_elimination');
  </script>

  <template>
    <DoubleEliminationBracket
      v-if="isDouble"
      :tournament-id="tournamentId"
      :category-id="categoryId"
    />
    <BracketView
      v-else
      :tournament-id="tournamentId"
      :category-id="categoryId"
    />
  </template>
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add src/features/brackets/components/BracketTab.vue
  git commit -m "feat(brackets): add BracketTab wrapper component"
  ```

---

## Task 9: Rewrite `SmartBracketView.vue` as thin orchestrator

**Files:**
- Modify: `src/features/brackets/components/SmartBracketView.vue`

This is the main task. Replace the current conditional template with 4 outer tabs. Fetch all data here and pass down via props.

- [ ] **Step 1: Rewrite the script setup**

  ```vue
  <script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { useTournamentStore } from '@/stores/tournaments';
  import { useMatchStore } from '@/stores/matches';
  import { useRegistrationStore } from '@/stores/registrations';
  import { useLeaderboard } from '@/composables/useLeaderboard';
  import RoundRobinStandings from './RoundRobinStandings.vue';
  import PoolDrawTab from './PoolDrawTab.vue';
  import StandingsTab from './StandingsTab.vue';
  import MatchesByRoundTab from './MatchesByRoundTab.vue';
  import BracketTab from './BracketTab.vue';
  import { FORMAT_LABELS } from '@/types';

  const props = defineProps<{
    tournamentId: string;
    categoryId: string;
  }>();

  const route = useRoute();
  const router = useRouter();
  const tournamentStore = useTournamentStore();
  const matchStore = useMatchStore();
  const registrationStore = useRegistrationStore();
  const { leaderboard, generate: generateSnapshot, stage: snapshotStage } = useLeaderboard();

  const categories = computed(() => tournamentStore.categories);
  const category = computed(() =>
    tournamentStore.categories.find((c) => c.id === props.categoryId)
  );
  const format = computed(() => category.value?.format || 'single_elimination');
  const isPoolPhase = computed(
    () => format.value === 'pool_to_elimination' && category.value?.poolPhase !== 'elimination'
  );
  const isPoolToElimFormat = computed(() => format.value === 'pool_to_elimination');

  // Pool-only matches (groupId != null — permanent, never deleted)
  const poolMatches = computed(() =>
    matchStore.matches.filter(
      (m) => m.categoryId === props.categoryId && m.groupId != null
    )
  );

  // Bracket participant IDs — registration IDs in any elimination bracket match.
  // Uses participant1Id/participant2Id (Match type field names — NOT player1Id/player2Id).
  const bracketParticipantIds = computed(() => {
    const ids = new Set<string>();
    matchStore.matches
      .filter((m) => m.categoryId === props.categoryId && m.groupId == null)
      .forEach((m) => {
        if (m.participant1Id) ids.add(m.participant1Id);
        if (m.participant2Id) ids.add(m.participant2Id);
      });
    return ids;
  });

  const snapshotEntries = computed(() => leaderboard.value?.entries ?? []);
  const snapshotTiebreakerResolutions = computed(() => leaderboard.value?.tiebreakerResolutions ?? []);
  const snapshotLoading = computed(() => snapshotStage.value === 'fetching' || snapshotStage.value === 'calculating');

  // Active outer tab — defaults to draw (pool phase) or bracket (elimination phase)
  const activeTab = ref<'draw' | 'standings' | 'matches' | 'bracket'>(
    isPoolPhase.value ? 'draw' : 'bracket'
  );

  // Auto-switch tab on phase transition
  watch(isPoolPhase, async (nowPool) => {
    activeTab.value = nowPool ? 'draw' : 'bracket';
    if (!nowPool) {
      await generateSnapshot(props.tournamentId, props.categoryId, { phaseScope: 'pool' });
    }
  });

  // Category selector — navigate to same view with new category
  const selectedCategoryId = computed<string>({
    get: () => props.categoryId,
    set: (nextCategoryId: string) => {
      if (!nextCategoryId || nextCategoryId === props.categoryId) return;
      router.push({
        name: 'smart-bracket-view',
        params: { tournamentId: props.tournamentId, categoryId: nextCategoryId },
        query: route.query,
      });
    },
  });

  onMounted(async () => {
    // Ensure tournament/categories are loaded
    if (categories.value.length === 0 || !tournamentStore.currentTournament) {
      await tournamentStore.fetchTournament(props.tournamentId);
    }

    if (!isPoolPhase.value && isPoolToElimFormat.value) {
      // Elimination phase: call generateSnapshot which internally fetches
      // matches (tournament-wide) + registrations + players. This populates
      // matchStore.matches for poolMatches/bracketParticipantIds computeds.
      // phaseScope:'pool' filters to pool matches using poolStageId/groupId.
      await generateSnapshot(props.tournamentId, props.categoryId, { phaseScope: 'pool' });
    } else {
      // Pool phase (or non-pool format): fetch manually since generateSnapshot won't run.
      await Promise.all([
        matchStore.fetchMatches(props.tournamentId, props.categoryId),
        registrationStore.fetchRegistrations(props.tournamentId),
        registrationStore.fetchPlayers(props.tournamentId),
      ]);
    }
  });
  </script>
  ```

- [ ] **Step 2: Rewrite the template**

  ```vue
  <template>
    <div class="smart-bracket-view">
      <!-- Category selector -->
      <v-row class="mb-3">
        <v-col cols="12" sm="6" md="4">
          <v-select
            v-model="selectedCategoryId"
            :items="categories"
            item-title="name"
            item-value="id"
            label="Select Category"
            variant="outlined"
            hide-details
          />
        </v-col>
      </v-row>

      <!-- Category info header -->
      <v-card v-if="category" class="mb-4" variant="flat" color="surface-variant">
        <v-card-text class="d-flex align-center py-2">
          <v-icon class="mr-2">mdi-tournament</v-icon>
          <span class="text-h6">{{ category.name }}</span>
          <v-chip size="small" variant="tonal" color="primary" class="ml-3">
            {{ FORMAT_LABELS[category.format] || category.format }}
          </v-chip>
          <v-chip
            v-if="category.minGamesGuaranteed"
            size="small"
            variant="tonal"
            color="info"
            class="ml-2"
          >
            Min {{ category.minGamesGuaranteed }} games guaranteed
          </v-chip>
        </v-card-text>
      </v-card>

      <!-- Pure round_robin — no tabs needed, use RoundRobinStandings directly -->
      <RoundRobinStandings
        v-if="format === 'round_robin'"
        :tournament-id="tournamentId"
        :category-id="categoryId"
      />

      <!-- Pool-to-Elimination format — 4-tab view -->
      <template v-else-if="isPoolToElimFormat">
        <v-tabs v-model="activeTab" color="primary" class="mb-4">
          <v-tab value="draw">
            <v-icon start>mdi-table-large</v-icon>
            Pool Draw
          </v-tab>
          <v-tab value="standings">
            <v-icon start>mdi-podium</v-icon>
            Standings
          </v-tab>
          <v-tab value="matches">
            <v-icon start>mdi-view-list</v-icon>
            Matches by Round
          </v-tab>
          <!-- Bracket tab: only shown in elimination phase -->
          <v-tab v-if="!isPoolPhase" value="bracket">
            <v-icon start>mdi-tournament</v-icon>
            Bracket
          </v-tab>
        </v-tabs>

        <v-tabs-window v-model="activeTab">
          <v-tabs-window-item value="draw">
            <PoolDrawTab
              :tournament-id="tournamentId"
              :category-id="categoryId"
            />
          </v-tabs-window-item>

          <v-tabs-window-item value="standings">
            <StandingsTab
              v-if="category"
              :tournament-id="tournamentId"
              :category="category"
              :pool-matches="poolMatches"
              :snapshot-entries="snapshotEntries"
              :snapshot-tiebreaker-resolutions="snapshotTiebreakerResolutions"
              :snapshot-loading="snapshotLoading"
              :bracket-participant-ids="bracketParticipantIds"
            />
          </v-tabs-window-item>

          <v-tabs-window-item value="matches">
            <MatchesByRoundTab :matches="poolMatches" />
          </v-tabs-window-item>

          <v-tabs-window-item v-if="!isPoolPhase" value="bracket">
            <BracketTab
              v-if="category"
              :tournament-id="tournamentId"
              :category-id="categoryId"
              :category="category"
            />
          </v-tabs-window-item>
        </v-tabs-window>
      </template>

      <!-- Non-pool formats: single or double elimination directly -->
      <BracketTab
        v-else-if="category"
        :tournament-id="tournamentId"
        :category-id="categoryId"
        :category="category"
      />
    </div>
  </template>
  ```

- [ ] **Step 3: Verify build passes**

  ```bash
  npm run type-check
  ```

  Fix any TypeScript errors before moving on.

- [ ] **Step 4: Verify the app runs**

  ```bash
  npm run dev
  ```

  Open `http://localhost:3000` and navigate to a tournament category with `pool_to_elimination` format. Check:
  - Pool phase: 3 tabs visible (Pool Draw, Standings, Matches by Round). No Bracket tab.
  - Standings tab → Pool Results sub-tab shows standings table.
  - Matches by Round tab shows pool matches grouped by round.
  - After bracket generation: Bracket tab appears, becomes active.
  - Standings tab → Pre-Elim Snapshot sub-tab appears with Qualified/Eliminated chips.
  - `round_robin` categories still show `RoundRobinStandings` directly (unchanged behaviour).
  - Non-pool formats (single/double elimination) still show bracket directly.

- [ ] **Step 5: Commit**

  ```bash
  git add src/features/brackets/components/SmartBracketView.vue
  git commit -m "feat(brackets): refactor SmartBracketView to 4-tab orchestrator with persistent pool history"
  ```

---

## Task 10: Final verification and cleanup

- [ ] **Step 1: Run full type check**

  ```bash
  npm run type-check
  ```

  Expected: 0 errors.

- [ ] **Step 2: Run build**

  ```bash
  npm run build
  ```

  Expected: successful build, 0 errors.

- [ ] **Step 3: Manual smoke test checklist**

  Navigate to SmartBracketView for a `pool_to_elimination` category and verify:

  | Scenario | Expected |
  |---|---|
  | Pool phase — land on page | Defaults to Pool Draw tab |
  | Pool phase — Standings tab | Shows Pool Results only (no sub-tab bar, no Snapshot) |
  | Pool phase — Matches by Round | Shows pool matches |
  | Pool phase — Bracket tab | Not visible |
  | After bracket generated | Bracket tab appears, auto-selected |
  | Elim phase — Standings tab | Shows sub-tab bar: Pool Results + Pre-Elim Snapshot |
  | Pre-Elim Snapshot | Shows LeaderboardTable with Qualified/Eliminated chips |
  | `round_robin` category | RoundRobinStandings shown directly (no outer tabs) |
  | Single/Double elim category | Bracket shown directly (no outer tabs) |

- [ ] **Step 4: Final commit if any cleanup needed**

  ```bash
  git add -p   # stage only intentional changes
  git commit -m "chore(brackets): post-refactor cleanup"
  ```
