<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import type { Match } from '@/types';
import { collection, getDocs, db } from '@/services/firebase';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useMatchDisplay } from '@/composables/useMatchDisplay';

const props = defineProps<{
  tournamentId: string;
  categoryId: string;
  matches: Match[];
  poolStageId?: string | number | null;
}>();

defineEmits<{
  (e: 'edit-pool', poolId: string): void;
}>();

interface StoredGroup {
  id: string;
  number?: number | string;
  stage_id?: number | string;
}

interface StandingEntry {
  registrationId: string;
  name: string;
  played: number;
  matchesWon: number;
  matchesLost: number;
  matchPoints: number;
  gamesWon: number;
  gamesLost: number;
  gameDifference: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;
}

const loading = ref(true);
const groups = ref<StoredGroup[]>([]);
const activeGroupTab = ref<string | null>(null);

const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();
const { getRankBadgeColor } = useMatchDisplay();

async function fetchGroups() {
  const snap = await getDocs(
    collection(db, 'tournaments', props.tournamentId, 'categories', props.categoryId, 'group'),
  );
  groups.value = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StoredGroup[];
}

const groupLabelById = computed(() => {
  const map = new Map<string, string>();
  let filteredGroups = [...groups.value];

  if (props.poolStageId != null) {
    filteredGroups = filteredGroups.filter(
      (g) => String(g.stage_id) === String(props.poolStageId)
    );
  }

  const sorted = filteredGroups.sort((a, b) => Number(a.number ?? 0) - Number(b.number ?? 0));
  sorted.forEach((g, i) => {
    map.set(String(g.id), g.number ? `Pool ${g.number}` : `Pool ${i + 1}`);
  });
  return map;
});

const pools = computed(() => {
  const validGroupIds = new Set(groupLabelById.value.keys());

  const categoryMatches = props.matches.filter(
    (m) =>
      m.categoryId === props.categoryId &&
      m.groupId !== null &&
      m.groupId !== undefined &&
      validGroupIds.has(String(m.groupId)),
  );

  const playersByGroup = new Map<string, Set<string>>();
  for (const match of categoryMatches) {
    const gid = String(match.groupId!);
    if (!playersByGroup.has(gid)) playersByGroup.set(gid, new Set());
    if (match.participant1Id) playersByGroup.get(gid)!.add(match.participant1Id);
    if (match.participant2Id) playersByGroup.get(gid)!.add(match.participant2Id);
  }

  const playersByGroupEntries = Array.from(playersByGroup.entries());
  const categoryRegistrations = registrationStore.registrations.filter(
    (r) => r.categoryId === props.categoryId
  );

  const smallPools = playersByGroupEntries.filter(([_, regIds]) => regIds.size < categoryRegistrations.length);
  const playersInSmallPools = new Set<string>();
  smallPools.forEach(([_, regIds]) => regIds.forEach((id) => playersInSmallPools.add(id)));

  const result = [];
  for (const [groupId, regIds] of playersByGroupEntries) {
    let finalRegIds = regIds;

    if (
      playersByGroupEntries.length > 1 &&
      categoryRegistrations.length > 8 &&
      regIds.size === categoryRegistrations.length
    ) {
      const orphans = new Set([...regIds].filter((id) => !playersInSmallPools.has(id)));
      if (orphans.size === 0 || orphans.size === categoryRegistrations.length) continue;
      finalRegIds = orphans;
    }

    const label = groupLabelById.value.get(groupId) ?? `Pool ${groupId}`;
    const poolNumber = Number(label.replace('Pool ', '')) || 0;
    const players = [...finalRegIds]
      .map((regId) => {
        const reg = categoryRegistrations.find((r) => r.id === regId);
        return {
          registrationId: regId,
          name: getParticipantName(regId),
          seed: reg?.seed,
        };
      })
      .sort((a, b) => {
        if (a.seed !== undefined && b.seed !== undefined) return a.seed - b.seed;
        if (a.seed !== undefined) return -1;
        if (b.seed !== undefined) return 1;
        return a.name.localeCompare(b.name);
      });
    result.push({ groupId, label, poolNumber, players });
  }

  return result.sort((a, b) => a.poolNumber - b.poolNumber);
});

// Matches filtered per group, sorted by round
const matchesByGroup = computed(() => {
  const result = new Map<string, Match[]>();
  for (const pool of pools.value) {
    const groupMatches = props.matches
      .filter((m) => String(m.groupId) === pool.groupId)
      .sort((a, b) => a.round - b.round);
    result.set(pool.groupId, groupMatches);
  }
  return result;
});

// Per-group standings computed from group-filtered matches + group players only
const standingsByGroup = computed(() => {
  const result = new Map<string, StandingEntry[]>();

  for (const pool of pools.value) {
    const groupMatches = matchesByGroup.value.get(pool.groupId) ?? [];
    const standingsMap = new Map<string, StandingEntry>();

    for (const player of pool.players) {
      standingsMap.set(player.registrationId, {
        registrationId: player.registrationId,
        name: player.name,
        played: 0,
        matchesWon: 0,
        matchesLost: 0,
        matchPoints: 0,
        gamesWon: 0,
        gamesLost: 0,
        gameDifference: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDifference: 0,
      });
    }

    for (const match of groupMatches) {
      const isFinished =
        (match.status === 'completed' || match.status === 'walkover') && match.winnerId;
      if (!isFinished) continue;

      const p1 = standingsMap.get(match.participant1Id || '');
      const p2 = standingsMap.get(match.participant2Id || '');

      if (p1 && p2) {
        p1.played++;
        p2.played++;

        let p1Points = 0;
        let p2Points = 0;
        let p1Games = 0;
        let p2Games = 0;

        if (match.status !== 'walkover') {
          for (const score of match.scores) {
            p1Points += score.score1;
            p2Points += score.score2;
            if (score.score1 > score.score2) p1Games++;
            else if (score.score2 > score.score1) p2Games++;
          }
        }

        p1.gamesWon += p1Games;
        p1.gamesLost += p2Games;
        p2.gamesWon += p2Games;
        p2.gamesLost += p1Games;
        p1.gameDifference = p1.gamesWon - p1.gamesLost;
        p2.gameDifference = p2.gamesWon - p2.gamesLost;

        p1.pointsFor += p1Points;
        p1.pointsAgainst += p2Points;
        p2.pointsFor += p2Points;
        p2.pointsAgainst += p1Points;

        if (match.winnerId === match.participant1Id) {
          p1.matchesWon++;
          p1.matchPoints += 2;
          p2.matchesLost++;
          p2.matchPoints += 1;
        } else {
          p2.matchesWon++;
          p2.matchPoints += 2;
          p1.matchesLost++;
          p1.matchPoints += 1;
        }

        p1.pointDifference = p1.pointsFor - p1.pointsAgainst;
        p2.pointDifference = p2.pointsFor - p2.pointsAgainst;
      } else if (match.status === 'walkover' && match.winnerId) {
        const winner = standingsMap.get(match.winnerId);
        if (winner) {
          winner.played++;
          winner.matchesWon++;
          winner.matchPoints += 2;
        }
      }
    }

    const sorted = Array.from(standingsMap.values()).sort((a, b) => {
      if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
      if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
      if (b.gameDifference !== a.gameDifference) return b.gameDifference - a.gameDifference;
      if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
      return b.gamesWon - a.gamesWon;
    });

    result.set(pool.groupId, sorted);
  }

  return result;
});

onMounted(async () => {
  await Promise.all([
    matchStore.fetchMatches(props.tournamentId, props.categoryId),
    registrationStore.fetchRegistrations(props.tournamentId),
    registrationStore.fetchPlayers(props.tournamentId),
    fetchGroups(),
  ]);
  loading.value = false;
  if (pools.value.length > 0) {
    activeGroupTab.value = pools.value[0].groupId;
  }
});

watch(
  () => props.categoryId,
  async () => {
    loading.value = true;
    activeGroupTab.value = null;
    await Promise.all([
      matchStore.fetchMatches(props.tournamentId, props.categoryId),
      fetchGroups(),
    ]);
    loading.value = false;
    if (pools.value.length > 0) {
      activeGroupTab.value = pools.value[0].groupId;
    }
  },
);

watch(pools, (newPools) => {
  if (!activeGroupTab.value && newPools.length > 0) {
    activeGroupTab.value = newPools[0].groupId;
  }
});
</script>

<template>
  <div class="pool-draw-view">
    <!-- Loading -->
    <div
      v-if="loading"
      class="text-center py-8"
    >
      <v-progress-circular
        indeterminate
        color="primary"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="pools.length === 0"
      class="text-center py-8"
    >
      <v-icon
        size="64"
        color="grey-lighten-1"
      >
        mdi-table-large
      </v-icon>
      <p class="text-body-1 text-grey mt-4">
        No pool draw generated yet
      </p>
    </div>

    <!-- Group Tabs -->
    <template v-else>
      <v-tabs
        v-model="activeGroupTab"
        color="primary"
        show-arrows
        class="mb-4"
      >
        <v-tab
          v-for="pool in pools"
          :key="pool.groupId"
          :value="pool.groupId"
        >
          <v-icon start>
            mdi-table-large
          </v-icon>
          {{ pool.label }}
          <v-chip
            size="x-small"
            variant="tonal"
            color="primary"
            class="ml-2"
          >
            {{ pool.players.length }}
          </v-chip>
        </v-tab>
      </v-tabs>

      <v-tabs-window v-model="activeGroupTab">
        <v-tabs-window-item
          v-for="pool in pools"
          :key="pool.groupId"
          :value="pool.groupId"
        >
          <v-row>
            <!-- Players -->
            <v-col
              cols="12"
              md="4"
            >
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1 py-3 px-4">
                  <v-icon
                    start
                    color="primary"
                    size="small"
                  >
                    mdi-account-group
                  </v-icon>
                  Players
                </v-card-title>
                <v-divider />
                <v-list
                  density="compact"
                  class="py-1"
                >
                  <v-list-item
                    v-for="player in pool.players"
                    :key="player.registrationId"
                    class="px-4"
                  >
                    <template #prepend>
                      <span class="seed-badge text-caption font-weight-bold text-medium-emphasis mr-3">
                        {{ player.seed !== null && player.seed !== undefined ? `[${player.seed}]` : '–' }}
                      </span>
                    </template>
                    <v-list-item-title class="text-body-2">
                      {{ player.name }}
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-card>
            </v-col>

            <!-- Standings -->
            <v-col
              cols="12"
              md="8"
            >
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1 py-3 px-4">
                  <v-icon
                    start
                    color="primary"
                    size="small"
                  >
                    mdi-podium
                  </v-icon>
                  Standings
                </v-card-title>
                <v-divider />
                <v-data-table
                  :headers="[
                    { title: '#', key: 'rank', width: '48px', align: 'center' },
                    { title: 'Player', key: 'name' },
                    { title: 'MP', key: 'matchPoints', width: '56px', align: 'center' },
                    { title: 'W', key: 'matchesWon', width: '48px', align: 'center' },
                    { title: 'L', key: 'matchesLost', width: '48px', align: 'center' },
                    { title: 'GD', key: 'gameDifference', width: '56px', align: 'center' },
                    { title: 'PD', key: 'pointDifference', width: '56px', align: 'center' },
                  ]"
                  :items="(standingsByGroup.get(pool.groupId) ?? []).map((s, i) => ({ ...s, rank: i + 1 }))"
                  :items-per-page="-1"
                  density="compact"
                  class="standings-table"
                >
                  <template #item.rank="{ item }">
                    <v-avatar
                      v-if="item.played > 0"
                      :color="getRankBadgeColor(item.rank)"
                      size="24"
                      class="font-weight-bold text-caption"
                    >
                      {{ item.rank }}
                    </v-avatar>
                    <span
                      v-else
                      class="text-medium-emphasis"
                    >–</span>
                  </template>
                  <template #item.name="{ item }">
                    <span class="text-body-2 font-weight-medium">{{ item.name }}</span>
                  </template>
                  <template #item.matchPoints="{ item }">
                    <span class="font-weight-bold">{{ item.matchPoints }}</span>
                  </template>
                  <template #item.gameDifference="{ item }">
                    <span :class="item.gameDifference >= 0 ? 'text-success' : 'text-error'">
                      {{ item.gameDifference >= 0 ? '+' : '' }}{{ item.gameDifference }}
                    </span>
                  </template>
                  <template #item.pointDifference="{ item }">
                    <span :class="item.pointDifference >= 0 ? 'text-success' : 'text-error'">
                      {{ item.pointDifference >= 0 ? '+' : '' }}{{ item.pointDifference }}
                    </span>
                  </template>
                  <template #bottom />
                </v-data-table>
              </v-card>
            </v-col>
          </v-row>
        </v-tabs-window-item>
      </v-tabs-window>
    </template>
  </div>
</template>

<style scoped>
.seed-badge {
  min-width: 32px;
  display: inline-block;
  text-align: right;
}

.standings-table :deep(tr:nth-child(1) td) {
  background: rgba(var(--v-theme-warning), 0.08);
}

.standings-table :deep(tr:nth-child(2) td) {
  background: rgba(128, 128, 128, 0.08);
}

.standings-table :deep(tr:nth-child(3) td) {
  background: rgba(139, 69, 19, 0.08);
}
</style>
