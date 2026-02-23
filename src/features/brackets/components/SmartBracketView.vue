<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import BracketView from './BracketView.vue';
import DoubleEliminationBracket from './DoubleEliminationBracket.vue';
import RoundRobinStandings from './RoundRobinStandings.vue';
import PoolDrawView from './PoolDrawView.vue';
import { FORMAT_LABELS } from '@/types';

const props = defineProps<{
  tournamentId: string;
  categoryId: string;
}>();

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const categories = computed(() => tournamentStore.categories);

const category = computed(() =>
  tournamentStore.categories.find((c) => c.id === props.categoryId)
);

const format = computed(() => category.value?.format || 'single_elimination');
const isPoolPhase = computed(
  () => format.value === 'pool_to_elimination' && category.value?.poolPhase !== 'elimination'
);

const poolTab = ref('draw');

const selectedCategoryId = computed<string>({
  get: () => props.categoryId,
  set: (nextCategoryId: string) => {
    if (!nextCategoryId || nextCategoryId === props.categoryId) return;

    router.push({
      name: 'smart-bracket-view',
      params: {
        tournamentId: props.tournamentId,
        categoryId: nextCategoryId,
      },
      query: route.query,
    });
  },
});

onMounted(async () => {
  if (categories.value.length > 0) return;
  await tournamentStore.fetchTournament(props.tournamentId);
});
</script>

<template>
  <div class="smart-bracket-view">
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

    <!-- Category Info Header -->
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

    <!-- Round Robin View (pure round_robin format) -->
    <RoundRobinStandings
      v-if="format === 'round_robin'"
      :tournament-id="tournamentId"
      :category-id="categoryId"
    />

    <!-- Pool Phase: Pool Draw + Standings tabs -->
    <template v-else-if="isPoolPhase">
      <v-tabs
        v-model="poolTab"
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
      </v-tabs>
      <v-tabs-window v-model="poolTab">
        <v-tabs-window-item value="draw">
          <PoolDrawView
            :tournament-id="tournamentId"
            :category-id="categoryId"
          />
        </v-tabs-window-item>
        <v-tabs-window-item value="standings">
          <RoundRobinStandings
            :tournament-id="tournamentId"
            :category-id="categoryId"
          />
        </v-tabs-window-item>
      </v-tabs-window>
    </template>

    <!-- Double Elimination View -->
    <DoubleEliminationBracket
      v-else-if="format === 'double_elimination'"
      :tournament-id="tournamentId"
      :category-id="categoryId"
    />

    <!-- Single Elimination View (default) -->
    <BracketView
      v-else
      :tournament-id="tournamentId"
      :category-id="categoryId"
    />
  </div>
</template>
