<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { usePlayersStore } from '@/stores/players';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import type { GlobalPlayer, PlayerStats } from '@/types';

const route = useRoute();
const playersStore = usePlayersStore();

const player = ref<GlobalPlayer | null>(null);
const activeSportTab = ref<string>('overall');

const { execute, loading } = useAsyncOperation();

function load() {
  return execute(async () => {
    const id = route.params.playerId as string;
    player.value = await playersStore.fetchPlayerById(id);
    // Set first sport tab by default if stats exist
    if (player.value?.stats) {
      const sports = Object.keys(player.value.stats).filter((k) => k !== 'overall');
      if (sports.length > 0) activeSportTab.value = sports[0];
    }
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

onMounted(load);
</script>

<template>
  <v-container v-if="loading" class="d-flex justify-center pa-8">
    <v-progress-circular indeterminate color="primary" />
  </v-container>

  <v-container v-else-if="!player" class="text-center pa-8">
    <v-icon size="48" color="grey-lighten-1" class="mb-4">mdi-account-off-outline</v-icon>
    <p class="text-body-1 text-medium-emphasis">Player not found.</p>
    <v-btn :to="'/players'" variant="text" class="mt-2">Back to Players</v-btn>
  </v-container>

  <template v-else>
    <!-- Dark header -->
    <div style="background:#0F172A;padding:24px 24px 0;">
      <div class="d-flex align-center ga-4 mb-4">
        <div
          style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#1D4ED8,#D97706);
                 display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:white;flex-shrink:0;"
        >
          {{ initials }}
        </div>
        <div>
          <div class="d-flex align-center ga-2">
            <span style="font-size:20px;font-weight:800;color:white;">{{ player.firstName }} {{ player.lastName }}</span>
            <v-icon v-if="player.isVerified" color="success" size="18">mdi-check-circle</v-icon>
          </div>
          <div class="d-flex align-center ga-2 mt-1">
            <v-chip v-if="player.skillLevel" size="x-small" color="primary" label>Level {{ player.skillLevel }}</v-chip>
            <span style="font-size:12px;color:#64748b;">Member since {{ player.createdAt?.toLocaleDateString?.() ?? '—' }}</span>
          </div>
        </div>
      </div>

      <!-- Overall stats bar -->
      <div style="background:#1E293B;border-radius:10px 10px 0 0;display:grid;grid-template-columns:repeat(4,1fr);">
        <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
          <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ overallStats.wins }}</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Wins</div>
        </div>
        <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
          <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ overallStats.losses }}</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Losses</div>
        </div>
        <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
          <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ overallStats.tournamentsPlayed }}</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Tournaments</div>
        </div>
        <div style="padding:12px;text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ winRate(overallStats.wins, overallStats.losses) }}%</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Win Rate</div>
        </div>
      </div>
    </div>

    <v-container class="pa-4">
      <!-- No sport data yet -->
      <div v-if="sportTabs.length === 0" class="text-center py-6 text-medium-emphasis">
        <v-icon size="32" class="mb-2">mdi-chart-bar</v-icon>
        <p>No stats yet. Stats are computed after tournament completion.</p>
      </div>

      <template v-else>
        <!-- Sport tabs -->
        <v-tabs v-model="activeSportTab" class="mb-4">
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
          <v-window-item v-for="sport in sportTabs" :key="sport" :value="sport">
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
    </v-container>
  </template>
</template>
