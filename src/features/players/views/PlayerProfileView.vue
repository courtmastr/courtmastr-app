<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { usePlayersStore } from '@/stores/players';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import { usePlayerMatchHistory } from '@/composables/usePlayerMatchHistory';
import type { GlobalPlayer, PlayerStats } from '@/types';

const route = useRoute();
const playersStore = usePlayersStore();

const player = ref<GlobalPlayer | null>(null);
const activeSportTab = ref<string>('overall');

const { execute, loading } = useAsyncOperation();
const { history, loading: historyLoading, loadHistory } = usePlayerMatchHistory();

function load() {
  return execute(async () => {
    const id = route.params.playerId as string;
    player.value = await playersStore.fetchPlayerById(id);
    // Set first sport tab by default if stats exist
    if (player.value?.stats) {
      const sports = Object.keys(player.value.stats).filter((k) => k !== 'overall');
      if (sports.length > 0) activeSportTab.value = sports[0];
    }
    // Load match history in parallel (non-blocking for the profile header)
    loadHistory(id);
  });
}

const initials = computed((): string => {
  if (!player.value) return '??';
  return `${player.value.firstName.charAt(0)}${player.value.lastName.charAt(0)}`.toUpperCase();
});

const overallStats = computed((): PlayerStats =>
  player.value?.stats?.overall ?? { wins: 0, losses: 0, gamesPlayed: 0, tournamentsPlayed: 0 }
);

const winRate = (wins: number, losses: number): number => {
  const total = wins + losses;
  return total === 0 ? 0 : Math.round((wins / total) * 100);
};

const sportTabs = computed((): string[] =>
  player.value ? Object.keys(player.value.stats).filter((k) => k !== 'overall') : []
);

const sportEmoji = (sport: string): string => {
  const map: Record<string, string> = {
    tennis: '🎾',
    pickleball: '🏓',
    badminton: '🏸',
    squash: '🎱',
    padel: '🎾',
  };
  return map[sport.toLowerCase()] ?? '🏅';
};

const categoryStats = (sport: string): Array<{ label: string; stats: PlayerStats }> => {
  if (!player.value?.stats?.[sport]) return [];
  return Object.entries(player.value.stats[sport]).map(([label, stats]) => ({
    label,
    stats: stats as PlayerStats,
  }));
};

const categoryColor = (label: string): string => {
  const map: Record<string, string> = {
    singles: '#1D4ED8',
    doubles: '#D97706',
    mixed: '#16A34A',
  };
  return map[label.toLowerCase()] ?? '#94A3B8';
};

function formatScores(scores: Array<{ score1: number; score2: number }>): string {
  return scores.map((s) => `${s.score1}-${s.score2}`).join(', ');
}

onMounted(load);
</script>

<template>
  <v-container
    v-if="loading"
    class="d-flex justify-center pa-8"
  >
    <v-progress-circular
      indeterminate
      color="primary"
    />
  </v-container>

  <v-container
    v-else-if="!player"
    class="text-center pa-8"
  >
    <v-icon
      size="48"
      color="grey-lighten-1"
      class="mb-4"
    >
      mdi-account-off-outline
    </v-icon>
    <p class="text-body-1 text-medium-emphasis">
      Player not found.
    </p>
    <v-btn
      :to="'/players'"
      variant="text"
      class="mt-2"
    >
      Back to Players
    </v-btn>
  </v-container>

  <template v-else>
    <!-- Dark header -->
    <div style="background:#0F172A;padding:24px 24px 0;">
      <div class="d-flex align-center justify-space-between ga-4 mb-4">
        <div class="d-flex align-center ga-4">
          <div
            style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#1D4ED8,#D97706);
                   display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:white;flex-shrink:0;"
          >
            {{ initials }}
          </div>
          <div>
            <div class="d-flex align-center ga-2">
              <span style="font-size:20px;font-weight:800;color:white;">{{ player.firstName }} {{ player.lastName }}</span>
              <v-icon
                v-if="player.isVerified"
                color="success"
                size="18"
              >
                mdi-check-circle
              </v-icon>
            </div>
            <div class="d-flex align-center ga-2 mt-1">
              <v-chip
                v-if="player.skillLevel"
                size="x-small"
                color="primary"
                label
              >
                Level {{ player.skillLevel }}
              </v-chip>
              <span style="font-size:12px;color:#64748b;">Member since {{ player.createdAt?.toLocaleDateString?.() ?? '—' }}</span>
            </div>
            <div
              style="font-size:12px;color:#94A3B8;"
              class="mt-1"
            >
              Player ID: {{ player.id }}
            </div>
            <div
              v-if="player.identityStatus === 'merged' && player.mergedIntoPlayerId"
              class="d-flex align-center ga-2 mt-2"
            >
              <v-chip
                size="x-small"
                color="warning"
                variant="tonal"
              >
                Merged
              </v-chip>
              <span style="font-size:12px;color:#fbbf24;">
                Merged into {{ player.mergedIntoPlayerId }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Overall stats bar -->
      <div style="background:#1E293B;border-radius:10px 10px 0 0;display:grid;grid-template-columns:repeat(4,1fr);">
        <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
          <div style="font-size:20px;font-weight:800;color:#F59E0B;">
            {{ overallStats.wins }}
          </div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">
            Wins
          </div>
        </div>
        <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
          <div style="font-size:20px;font-weight:800;color:#F59E0B;">
            {{ overallStats.losses }}
          </div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">
            Losses
          </div>
        </div>
        <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
          <div style="font-size:20px;font-weight:800;color:#F59E0B;">
            {{ overallStats.tournamentsPlayed }}
          </div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">
            Tournaments
          </div>
        </div>
        <div style="padding:12px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#F59E0B;">
            {{ winRate(overallStats.wins, overallStats.losses) }}%
          </div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">
            Win Rate
          </div>
        </div>
      </div>
    </div>

    <v-container class="pa-4">
      <!-- No sport data yet -->
      <div
        v-if="sportTabs.length === 0"
        class="text-center py-6 text-medium-emphasis"
      >
        <v-icon
          size="32"
          class="mb-2"
        >
          mdi-chart-bar
        </v-icon>
        <p>No stats yet. Stats are computed after tournament completion.</p>
      </div>

      <template v-else>
        <!-- Sport tabs -->
        <v-tabs
          v-model="activeSportTab"
          class="mb-4"
        >
          <v-tab
            v-for="sport in sportTabs"
            :key="sport"
            :value="sport"
          >
            {{ sportEmoji(sport) }} {{ sport.charAt(0).toUpperCase() + sport.slice(1) }}
          </v-tab>
        </v-tabs>

        <!-- Stat cards grid for active sport -->
        <v-window v-model="activeSportTab">
          <v-window-item
            v-for="sport in sportTabs"
            :key="sport"
            :value="sport"
          >
            <v-row>
              <v-col
                v-for="{ label, stats } in categoryStats(sport)"
                :key="label"
                cols="12"
                sm="4"
              >
                <v-card>
                  <div :style="`height:3px;background:${categoryColor(label)};`" />
                  <v-card-text>
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:8px;">
                      {{ label.charAt(0).toUpperCase() + label.slice(1) }}
                    </div>
                    <div style="font-size:22px;font-weight:800;color:#0F172A;">
                      {{ stats.wins }}
                      <span style="font-size:16px;color:#dc2626;font-weight:600;"> / {{ stats.losses }}</span>
                    </div>
                    <v-progress-linear
                      :model-value="winRate(stats.wins, stats.losses)"
                      :color="categoryColor(label)"
                      bg-color="#e2e8f0"
                      rounded
                      height="4"
                      class="my-2"
                    />
                    <div style="font-size:11px;color:#64748b;">
                      {{ winRate(stats.wins, stats.losses) }}% · {{ stats.tournamentsPlayed }} tournament{{ stats.tournamentsPlayed !== 1 ? 's' : '' }}
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-window-item>
        </v-window>
      </template>

      <!-- Match History section -->
      <div class="mt-6">
        <div class="d-flex align-center ga-2 mb-3">
          <v-icon color="primary">
            mdi-history
          </v-icon>
          <span style="font-size:16px;font-weight:700;">Match History</span>
        </div>

        <v-progress-circular
          v-if="historyLoading"
          indeterminate
          color="primary"
          size="24"
        />

        <div
          v-else-if="history.length === 0"
          class="text-medium-emphasis text-body-2 py-4"
          data-testid="match-history-empty"
        >
          No completed matches found.
        </div>

        <v-expansion-panels
          v-else
          variant="accordion"
          data-testid="match-history-panels"
        >
          <v-expansion-panel
            v-for="entry in history"
            :key="entry.tournamentId + entry.categoryId"
          >
            <v-expansion-panel-title>
              <div class="d-flex align-center ga-2 flex-wrap">
                <span style="font-weight:600;">{{ entry.tournamentName }}</span>
                <v-chip
                  size="x-small"
                  :color="entry.categoryType === 'singles' ? 'primary' : entry.categoryType === 'doubles' ? 'warning' : 'success'"
                  label
                >
                  {{ entry.categoryName }}
                </v-chip>
                <span
                  v-if="entry.sport"
                  style="font-size:12px;color:#64748b;"
                >
                  {{ entry.sport }}
                </span>
                <span style="font-size:12px;color:#64748b;">
                  · {{ entry.startDate?.toLocaleDateString?.() ?? '—' }}
                </span>
                <v-chip
                  size="x-small"
                  variant="outlined"
                  color="grey"
                >
                  {{ entry.matches.length }} match{{ entry.matches.length !== 1 ? 'es' : '' }}
                </v-chip>
              </div>
            </v-expansion-panel-title>

            <v-expansion-panel-text>
              <div
                v-if="entry.matches.length === 0"
                class="text-medium-emphasis text-body-2 py-2"
              >
                No completed matches in this tournament.
              </div>

              <div
                v-for="match in entry.matches"
                :key="match.matchId"
                class="d-flex align-center ga-3 py-2"
                style="border-bottom:1px solid #f1f5f9;"
              >
                <!-- W/L badge -->
                <v-chip
                  size="small"
                  :color="match.result === 'win' ? 'success' : match.result === 'loss' ? 'error' : 'grey'"
                  style="min-width:36px;justify-content:center;"
                >
                  {{ match.result === 'win' ? 'W' : match.result === 'loss' ? 'L' : 'WO' }}
                </v-chip>

                <!-- Opponent + partner -->
                <div style="flex:1;">
                  <div style="font-weight:500;font-size:14px;">
                    vs {{ match.opponentName }}
                  </div>
                  <div
                    v-if="match.partnerName"
                    style="font-size:12px;color:#64748b;"
                  >
                    with {{ match.partnerName }}
                  </div>
                </div>

                <!-- Score -->
                <div
                  v-if="match.scores.length > 0"
                  style="font-size:13px;color:#475569;font-family:monospace;"
                >
                  {{ formatScores(match.scores) }}
                </div>
                <div
                  v-else-if="match.result === 'walkover'"
                  style="font-size:12px;color:#94a3b8;"
                >
                  walkover
                </div>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </div>
    </v-container>
  </template>
</template>
