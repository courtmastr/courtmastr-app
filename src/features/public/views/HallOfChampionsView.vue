<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import TournamentPublicShell from '@/components/common/TournamentPublicShell.vue';
import { useHallOfChampions } from '@/composables/useHallOfChampions';
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import type { LevelDefinition } from '@/types';

const route = useRoute();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const levelDefinitionsByCategory = ref<Record<string, LevelDefinition[]>>({});
const notFound = ref(false);

const { champions, hasChampions, crownedDivisionCount, crownedCategoryCount } = useHallOfChampions({
  tournament,
  categories,
  matches: computed(() => matchStore.matches),
  registrations: computed(() => registrationStore.registrations),
  players: computed(() => registrationStore.players),
  levelDefinitionsByCategory,
});

const canonicalPath = computed(() => `/tournaments/${tournamentId.value}/champions`);

const categoriesRequiringLevels = computed(() => [...new Set(
  matchStore.matches
    .filter((match) => Boolean(match.levelId))
    .map((match) => match.categoryId)
)]);

watch(
  [tournament, crownedDivisionCount, canonicalPath],
  ([activeTournament, crownedDivisions, canonical]) => {
    const tournamentName = activeTournament?.name?.trim() || 'Tournament';
    const description = crownedDivisions > 0
      ? `${crownedDivisions} completed title holders from ${tournamentName}.`
      : `Completed title holders and podium finishes for ${tournamentName}.`;

    usePublicPageMetadata({
      title: `${tournamentName} Champions`,
      description,
      canonicalPath: canonical,
    });
  },
  { immediate: true },
);

watch(categoriesRequiringLevels, async (nextCategoryIds) => {
  const missingCategoryIds = nextCategoryIds.filter((categoryId) => !levelDefinitionsByCategory.value[categoryId]);
  if (missingCategoryIds.length === 0) return;

  const fetchedLevels = await Promise.all(missingCategoryIds.map(async (categoryId) => {
    try {
      const levels = await tournamentStore.fetchCategoryLevels(tournamentId.value, categoryId);
      return [categoryId, levels] as const;
    } catch (error) {
      console.error('Failed to fetch category levels:', error);
      return [categoryId, []] as const;
    }
  }));

  levelDefinitionsByCategory.value = {
    ...levelDefinitionsByCategory.value,
    ...Object.fromEntries(fetchedLevels),
  };
}, { immediate: true });

onMounted(async () => {
  try {
    await tournamentStore.fetchTournament(tournamentId.value);
  } catch {
    notFound.value = true;
    return;
  }

  tournamentStore.subscribeTournament(tournamentId.value);
  matchStore.subscribeAllMatches(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  registrationStore.unsubscribeAll();
});
</script>

<template>
  <TournamentPublicShell
    :tournament="tournament"
    eyebrow="Tournament Honors"
    page-title="Hall of Champions"
    page-subtitle="Completed divisions, crowned title holders, and the finalists who pushed them there."
    fallback-icon="mdi-trophy-award"
  >
    <template #metrics>
      <div class="hall-of-champions__summary">
        <div class="hall-of-champions__summary-item">
          <span class="hall-of-champions__summary-label">Crowned Divisions</span>
          <strong class="hall-of-champions__summary-value">{{ crownedDivisionCount }}</strong>
        </div>
        <div class="hall-of-champions__summary-item">
          <span class="hall-of-champions__summary-label">Categories Closed</span>
          <strong class="hall-of-champions__summary-value">{{ crownedCategoryCount }}</strong>
        </div>
      </div>
    </template>

    <v-skeleton-loader
      v-if="!tournament && !notFound"
      type="heading, article"
    />

    <v-row v-else-if="notFound">
      <v-col cols="12">
        <v-card class="hall-of-champions__surface-card">
          <v-card-text class="text-center py-8">
            <v-icon
              size="64"
              color="grey-lighten-1"
            >
              mdi-alert-circle-outline
            </v-icon>
            <h2 class="text-h6 mt-4">
              Tournament not found
            </h2>
            <p class="text-body-2 text-grey mt-2">
              This tournament does not exist or has been removed.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <template v-else>
      <v-card
        class="hall-of-champions__surface-card mb-4"
        elevation="0"
      >
        <v-card-text class="pa-5 pa-sm-6">
          <div class="hall-of-champions__intro">
            <div>
              <p class="hall-of-champions__intro-eyebrow mb-2">
                Championship Record
              </p>
              <h2 class="hall-of-champions__intro-title">
                Event winners in one clean view
              </h2>
              <p class="hall-of-champions__intro-copy mb-0">
                Titles appear here as finals close and standings lock. The layout stays simple so clubs can share it directly with players, families, and sponsors.
              </p>
            </div>
          </div>
        </v-card-text>
      </v-card>

      <v-card
        v-if="!hasChampions"
        class="hall-of-champions__surface-card text-center"
        elevation="0"
      >
        <v-card-text class="py-10 px-5">
          <v-icon
            size="60"
            color="grey-lighten-1"
          >
            mdi-trophy-outline
          </v-icon>
          <h2 class="text-h6 mt-4 mb-2">
            No champions crowned yet
          </h2>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Completed finals and locked standings will appear here as categories finish.
          </p>
        </v-card-text>
      </v-card>

      <div
        v-else
        class="hall-of-champions__grid"
      >
        <v-card
          v-for="champion in champions"
          :key="champion.key"
          class="hall-of-champions__surface-card hall-of-champions__champion-card"
          elevation="0"
        >
          <v-card-text class="pa-5">
            <div class="hall-of-champions__card-top">
              <div>
                <p class="hall-of-champions__card-eyebrow mb-2">
                  {{ champion.seasonLabel }}
                </p>
                <h2 class="hall-of-champions__card-title">
                  {{ champion.categoryName }}
                </h2>
              </div>

              <v-avatar
                size="48"
                color="primary"
                variant="tonal"
              >
                <v-icon size="24">
                  mdi-trophy-outline
                </v-icon>
              </v-avatar>
            </div>

            <div class="hall-of-champions__chip-row">
              <v-chip
                size="small"
                variant="outlined"
              >
                {{ champion.formatLabel }}
              </v-chip>
              <v-chip
                v-if="champion.levelLabel"
                size="small"
                color="primary"
                variant="tonal"
              >
                {{ champion.levelLabel }}
              </v-chip>
            </div>

            <div class="hall-of-champions__winner-block">
              <p class="hall-of-champions__winner-label mb-1">
                Champion
              </p>
              <div class="hall-of-champions__winner-name">
                {{ champion.championName }}
              </div>
              <p class="hall-of-champions__victory-label mb-0">
                {{ champion.victoryLabel }}
              </p>
            </div>

            <div
              v-if="champion.runnerUpName"
              class="hall-of-champions__runner-up"
            >
              <span class="hall-of-champions__runner-up-label">{{ champion.runnerUpLabel }}</span>
              <strong class="hall-of-champions__runner-up-name">{{ champion.runnerUpName }}</strong>
            </div>
          </v-card-text>
        </v-card>
      </div>
    </template>
  </TournamentPublicShell>
</template>

<style scoped>
.hall-of-champions__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hall-of-champions__summary-item {
  min-width: 170px;
  padding: 12px 16px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.74);
}

.hall-of-champions__summary-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.52);
}

.hall-of-champions__summary-value {
  display: block;
  margin-top: 6px;
  font-size: 1.45rem;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
}

.hall-of-champions__surface-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 24px;
  background: rgba(var(--v-theme-surface), 0.94);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.06);
}

.hall-of-champions__intro-eyebrow,
.hall-of-champions__card-eyebrow,
.hall-of-champions__winner-label,
.hall-of-champions__runner-up-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hall-of-champions__intro-title,
.hall-of-champions__card-title {
  margin: 0;
  font-family: 'Barlow Condensed', 'Avenir Next Condensed', sans-serif;
  font-weight: 700;
  line-height: 0.96;
}

.hall-of-champions__intro-title {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
}

.hall-of-champions__intro-copy {
  max-width: 54ch;
  color: rgba(var(--v-theme-on-surface), 0.72);
}

.hall-of-champions__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.hall-of-champions__champion-card {
  min-height: 100%;
}

.hall-of-champions__card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.hall-of-champions__card-title {
  font-size: clamp(1.45rem, 3vw, 2rem);
}

.hall-of-champions__chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.hall-of-champions__winner-block {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.hall-of-champions__winner-name {
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1.1;
  color: rgb(var(--v-theme-on-surface));
}

.hall-of-champions__victory-label {
  margin-top: 8px;
  color: rgba(var(--v-theme-on-surface), 0.65);
}

.hall-of-champions__runner-up {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 20px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(var(--v-theme-primary), 0.05);
}

.hall-of-champions__runner-up-name {
  font-size: 1rem;
  color: rgb(var(--v-theme-on-surface));
}

@media (max-width: 700px) {
  .hall-of-champions__summary-item {
    min-width: 0;
    flex: 1 1 140px;
  }
}
</style>
