<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';
import { useTournamentLandingTheme } from '@/composables/useTournamentLandingTheme';
import TournamentPublicShell from '@/components/common/TournamentPublicShell.vue';

const route = useRoute();
const tournamentStore = useTournamentStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const notFound = ref(false);

const requestedTheme = computed(() => {
  const queryValue = route.query.template;
  return typeof queryValue === 'string' ? queryValue : null;
});

const {
  resolvedThemeKey,
  themePreset,
  availableThemePresets,
} = useTournamentLandingTheme(requestedTheme);

const canonicalPath = computed(() => `/tournaments/${tournamentId.value}/landing`);

const dateFormatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

const formatDate = (value: Date | null | undefined): string | null => {
  if (!value) return null;
  return Number.isNaN(value.getTime()) ? null : dateFormatter.format(value);
};

const tournamentDateLabel = computed(() => {
  const start = formatDate(tournament.value?.startDate);
  const end = formatDate(tournament.value?.endDate);
  if (!start && !end) return 'Date to be announced';
  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end || 'Date to be announced';
});

const tournamentLocationLabel = computed(() =>
  tournament.value?.location?.trim() || 'Venue details shared by organizer'
);

const landingLinks = computed(() => [
  {
    key: 'schedule',
    label: 'View Schedule',
    icon: 'mdi-calendar-clock',
    to: `/tournaments/${tournamentId.value}/schedule`,
  },
  {
    key: 'bracket',
    label: 'View Bracket',
    icon: 'mdi-tournament',
    to: `/tournaments/${tournamentId.value}/bracket`,
  },
  {
    key: 'scores',
    label: 'Live Scores',
    icon: 'mdi-scoreboard-outline',
    to: `/tournaments/${tournamentId.value}/score`,
  },
  {
    key: 'player',
    label: 'Player Lookup',
    icon: 'mdi-account-search-outline',
    to: `/tournaments/${tournamentId.value}/player`,
  },
]);

watch(
  [tournament, themePreset, canonicalPath],
  ([activeTournament, activeTheme, canonical]) => {
    const tournamentName = activeTournament?.name?.trim() || 'Tournament';
    const descriptor = `${activeTheme.label} landing template for ${tournamentName}, with quick links to schedule, bracket, and live scoring.`;
    usePublicPageMetadata({
      title: `${tournamentName} Landing`,
      description: descriptor,
      canonicalPath: canonical,
    });
  },
  { immediate: true }
);

onMounted(async () => {
  try {
    await tournamentStore.fetchTournament(tournamentId.value);
  } catch {
    notFound.value = true;
    return;
  }

  tournamentStore.subscribeTournament(tournamentId.value);
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
});
</script>

<template>
  <TournamentPublicShell
    :tournament="tournament"
    :eyebrow="themePreset.eyebrow"
    :page-title="themePreset.title"
    :page-subtitle="themePreset.subtitle"
    fallback-icon="mdi-view-dashboard-outline"
  >
    <v-row v-if="notFound">
      <v-col cols="12">
        <v-card class="landing-template__surface-card">
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

    <template v-else-if="tournament">
      <section
        class="landing-template"
        :class="`landing-template--${resolvedThemeKey}`"
      >
        <v-card
          class="landing-template__surface-card landing-template__hero-card"
          elevation="0"
        >
          <v-card-text class="pa-5 pa-sm-6">
            <div class="landing-template__theme-meta mb-3">
              <v-icon
                size="18"
                class="mr-2"
              >
                {{ themePreset.accentIcon }}
              </v-icon>
              <span>{{ themePreset.label }} Template</span>
            </div>

            <h2 class="landing-template__tournament-name">
              {{ tournament.name }}
            </h2>

            <p class="landing-template__tournament-meta mb-4">
              {{ tournamentDateLabel }} · {{ tournamentLocationLabel }}
            </p>

            <p class="text-body-2 text-medium-emphasis mb-4">
              Share this page with players and spectators for direct access to live tournament information.
            </p>

            <div class="landing-template__link-grid">
              <v-btn
                v-for="link in landingLinks"
                :key="link.key"
                :to="link.to"
                color="primary"
                variant="flat"
                size="large"
                :prepend-icon="link.icon"
                class="landing-template__link-btn"
              >
                {{ link.label }}
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <v-card
          class="landing-template__surface-card mt-4"
          elevation="0"
        >
          <v-card-text class="pa-4 pa-sm-5">
            <p class="text-caption text-medium-emphasis mb-2 text-uppercase">
              Landing Theme
            </p>
            <div class="landing-template__theme-switch">
              <v-chip
                v-for="theme in availableThemePresets"
                :key="theme.key"
                :to="{
                  path: canonicalPath,
                  query: theme.key === 'classic' ? {} : { template: theme.key },
                }"
                :variant="resolvedThemeKey === theme.key ? 'flat' : 'outlined'"
                :color="resolvedThemeKey === theme.key ? 'primary' : undefined"
                size="small"
              >
                {{ theme.label }}
              </v-chip>
            </div>
          </v-card-text>
        </v-card>
      </section>
    </template>
  </TournamentPublicShell>
</template>

<style scoped>
.landing-template {
  position: relative;
}

.landing-template__surface-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 24px;
  background: rgba(var(--v-theme-surface), 0.94);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.07);
}

.landing-template__hero-card {
  overflow: hidden;
}

.landing-template__theme-meta {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.landing-template__tournament-name {
  margin: 0;
  font-family: 'Barlow Condensed', 'Avenir Next Condensed', sans-serif;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 0.94;
  text-wrap: balance;
}

.landing-template__tournament-meta {
  font-size: 0.92rem;
  color: rgba(var(--v-theme-on-surface), 0.66);
}

.landing-template__link-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.landing-template__link-btn {
  justify-content: flex-start;
}

.landing-template__theme-switch {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.landing-template--event-night .landing-template__surface-card {
  background:
    linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.93));
  color: #f8fafc;
  border-color: rgba(148, 163, 184, 0.24);
  box-shadow: 0 18px 40px rgba(2, 6, 23, 0.38);
}

.landing-template--event-night .landing-template__tournament-meta {
  color: rgba(226, 232, 240, 0.8);
}

.landing-template--event-night :deep(.v-btn.v-btn--variant-flat) {
  background-color: #2563eb;
}

.landing-template--minimal .landing-template__surface-card {
  border-radius: 14px;
  border-color: rgba(var(--v-theme-on-surface), 0.1);
  box-shadow: none;
}

.landing-template--minimal .landing-template__theme-meta {
  border-style: dashed;
}
</style>
