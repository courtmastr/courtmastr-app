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

// Pool-only matches — groupId != null means pool match (permanent, never deleted)
const poolMatches = computed(() =>
  matchStore.matches.filter(
    (m) => m.categoryId === props.categoryId && m.groupId != null
  )
);

// Registration IDs of participants in any elimination bracket match
// Uses participant1Id/participant2Id — the actual Match type field names
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
const snapshotLoading = computed(
  () => snapshotStage.value === 'fetching' || snapshotStage.value === 'calculating'
);

// Active outer tab — default to draw (pool phase) or bracket (elimination phase)
const activeTab = ref<'draw' | 'standings' | 'matches' | 'bracket'>(
  isPoolPhase.value ? 'draw' : 'bracket'
);

// Auto-switch tab on phase transition and trigger snapshot generation
watch(isPoolPhase, async (nowPool) => {
  activeTab.value = nowPool ? 'draw' : 'bracket';
  if (!nowPool && isPoolToElimFormat.value) {
    await generateSnapshot(props.tournamentId, props.categoryId, { phaseScope: 'pool' });
  }
});

// Navigate to new category without losing tournament context
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
    // Elimination phase: generateSnapshot fetches matches + registrations + players internally.
    // This populates matchStore.matches for poolMatches/bracketParticipantIds computeds.
    // phaseScope:'pool' uses poolStageId/groupId filter — snapshot data is pool-only.
    await generateSnapshot(props.tournamentId, props.categoryId, { phaseScope: 'pool' });
  } else {
    // Pool phase or non-pool format: fetch manually (generateSnapshot won't run).
    await Promise.all([
      matchStore.fetchMatches(props.tournamentId, props.categoryId),
      registrationStore.fetchRegistrations(props.tournamentId),
      registrationStore.fetchPlayers(props.tournamentId),
    ]);
  }
});
</script>

<template>
  <div class="smart-bracket-view">
    <!-- Category selector -->
    <v-row class="mb-3">
      <v-col
        cols="12"
        sm="6"
        md="4"
      >
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
    <v-card
      v-if="category"
      class="mb-4"
      variant="flat"
      color="surface-variant"
    >
      <v-card-text class="d-flex align-center py-2">
        <v-icon class="mr-2">
          mdi-tournament
        </v-icon>
        <span class="text-h6">{{ category.name }}</span>
        <v-chip
          size="small"
          variant="tonal"
          color="primary"
          class="ml-3"
        >
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

    <!-- Pure round_robin — no outer tabs; RoundRobinStandings handles its own data -->
    <RoundRobinStandings
      v-if="format === 'round_robin'"
      :tournament-id="tournamentId"
      :category-id="categoryId"
    />

    <!-- Pool-to-Elimination format — 4-tab view (Bracket hidden during pool phase) -->
    <template v-else-if="isPoolToElimFormat">
      <v-tabs
        v-model="activeTab"
        color="primary"
        class="mb-4"
      >
        <v-tab value="draw">
          <v-icon start>
            mdi-table-large
          </v-icon>
          Pool Draw
        </v-tab>
        <v-tab value="standings">
          <v-icon start>
            mdi-podium
          </v-icon>
          Standings
        </v-tab>
        <v-tab value="matches">
          <v-icon start>
            mdi-view-list
          </v-icon>
          Matches by Round
        </v-tab>
        <!-- Bracket tab: only rendered in elimination phase -->
        <v-tab
          v-if="!isPoolPhase"
          value="bracket"
        >
          <v-icon start>
            mdi-tournament
          </v-icon>
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

        <!-- Bracket window item: v-if mirrors the tab above -->
        <v-tabs-window-item
          v-if="!isPoolPhase"
          value="bracket"
        >
          <BracketTab
            v-if="category"
            :tournament-id="tournamentId"
            :category-id="categoryId"
            :category="category"
          />
        </v-tabs-window-item>
      </v-tabs-window>
    </template>

    <!-- Single or double elimination (non-pool formats) -->
    <BracketTab
      v-else-if="category"
      :tournament-id="tournamentId"
      :category-id="categoryId"
      :category="category"
    />
  </div>
</template>
