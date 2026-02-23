<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { collection, getDocs, db } from '@/services/firebase';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';

const props = defineProps<{
  tournamentId: string;
  categoryId: string;
}>();

const emit = defineEmits<{
  (e: 'edit-pool', poolId: string): void;
}>();

interface StoredGroup {
  id: string;
  number?: number | string;
  stage_id?: number | string;
}

const loading = ref(true);
const groups = ref<StoredGroup[]>([]);

const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();

async function fetchGroups() {
  const snap = await getDocs(
    collection(db, 'tournaments', props.tournamentId, 'categories', props.categoryId, 'group'),
  );
  groups.value = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as StoredGroup[];
}

const groupLabelById = computed(() => {
  const map = new Map<string, string>();
  const sorted = [...groups.value].sort((a, b) => Number(a.number ?? 0) - Number(b.number ?? 0));
  sorted.forEach((g, i) => {
    map.set(String(g.id), g.number ? `Pool ${g.number}` : `Pool ${i + 1}`);
  });
  return map;
});

const pools = computed(() => {
  const categoryMatches = matchStore.matches.filter(
    (m) => m.categoryId === props.categoryId && m.groupId,
  );

  const playersByGroup = new Map<string, Set<string>>();
  for (const match of categoryMatches) {
    const gid = match.groupId!;
    if (!playersByGroup.has(gid)) playersByGroup.set(gid, new Set());
    if (match.participant1Id) playersByGroup.get(gid)!.add(match.participant1Id);
    if (match.participant2Id) playersByGroup.get(gid)!.add(match.participant2Id);
  }

  const result = [];
  for (const [groupId, regIds] of playersByGroup) {
    const label = groupLabelById.value.get(groupId) ?? `Pool ${groupId}`;
    const poolNumber = Number(label.replace('Pool ', '')) || 0;
    const players = [...regIds]
      .map((regId) => {
        const reg = registrationStore.registrations.find((r) => r.id === regId);
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

onMounted(async () => {
  await Promise.all([
    matchStore.fetchMatches(props.tournamentId, props.categoryId),
    registrationStore.fetchRegistrations(props.tournamentId),
    registrationStore.fetchPlayers(props.tournamentId),
    fetchGroups(),
  ]);
  loading.value = false;
});

watch(
  () => props.categoryId,
  async () => {
    loading.value = true;
    await Promise.all([
      matchStore.fetchMatches(props.tournamentId, props.categoryId),
      fetchGroups(),
    ]);
    loading.value = false;
  },
);
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

    <!-- Pool Grid -->
    <v-row v-else>
      <v-col
        v-for="pool in pools"
        :key="pool.groupId"
        cols="12"
        sm="6"
        md="4"
      >
        <v-card
          variant="outlined"
          class="h-100"
        >
          <v-card-title class="d-flex align-center py-3 px-4">
            <v-icon
              start
              color="primary"
            >
              mdi-table-large
            </v-icon>
            {{ pool.label }}
            <v-spacer />
            <v-chip
              size="small"
              variant="tonal"
              color="primary"
            >
              {{ pool.players.length }} players
            </v-chip>
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
                  {{ player.seed !== null && player.seed !== undefined ? `[${player.seed}]` : 'Unseeded' }}
                </span>
              </template>
              <v-list-item-title class="text-body-2">
                {{ player.name }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.seed-badge {
  min-width: 36px;
  display: inline-block;
  text-align: right;
}
</style>
