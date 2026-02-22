<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useParticipantResolver } from '@/composables/useParticipantResolver';

const route = useRoute();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const selectedCategoryId = computed(() => (route.query.category as string) || 'all');

const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const notFound = ref(false);
let unsubscribe: (() => void) | null = null;

// Published matches sorted by plannedStartAt
const publishedMatches = computed(() => {
  return matchStore.matches
    .filter(m => m.scheduleStatus === 'published' && m.plannedStartAt)
    .filter(m =>
      selectedCategoryId.value === 'all' ||
      m.categoryId === selectedCategoryId.value
    )
    .sort((a, b) => {
      const aT = a.plannedStartAt!.getTime();
      const bT = b.plannedStartAt!.getTime();
      return aT - bT;
    });
});

const categoryName = (categoryId: string) =>
  categories.value.find(c => c.id === categoryId)?.name ?? categoryId;

function formatTime(date: Date | undefined): string {
  if (!date) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date | undefined): string {
  if (!date) return '—';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function statusColor(status: string): string {
  switch (status) {
    case 'in_progress': return 'warning';
    case 'completed': return 'success';
    case 'walkover': return 'success';
    case 'cancelled': return 'error';
    default: return 'default';
  }
}

onMounted(async () => {
  try {
    await tournamentStore.fetchTournament(tournamentId.value);
    await registrationStore.fetchRegistrations(tournamentId.value);
    // Subscribe to all matches (published schedule doesn't require auth)
    unsubscribe = matchStore.subscribeAllMatches(tournamentId.value) ?? null;
  } catch {
    notFound.value = true;
  }
});

onUnmounted(() => {
  unsubscribe?.();
});
</script>

<template>
  <v-container max-width="900">
    <!-- Not found -->
    <v-alert
      v-if="notFound"
      type="error"
      class="mt-8"
    >
      Tournament not found.
    </v-alert>

    <template v-else>
      <!-- Header -->
      <div class="d-flex align-center justify-space-between mt-6 mb-4">
        <div>
          <h1 class="text-h5 font-weight-bold">
            {{ tournament?.name ?? 'Tournament' }}
          </h1>
          <div class="text-caption text-medium-emphasis">
            Published Schedule
          </div>
        </div>
        <v-chip
          color="primary"
          variant="tonal"
        >
          published
        </v-chip>
      </div>

      <!-- Category filter -->
      <v-chip-group
        v-if="categories.length > 1"
        :model-value="selectedCategoryId"
        class="mb-4"
        @update:model-value="val => $router.replace({ query: { ...route.query, category: val } })"
      >
        <v-chip value="all" variant="outlined">
          All Categories
        </v-chip>
        <v-chip
          v-for="cat in categories"
          :key="cat.id"
          :value="cat.id"
          variant="outlined"
        >
          {{ cat.name }}
        </v-chip>
      </v-chip-group>

      <!-- No published schedule yet -->
      <v-alert
        v-if="publishedMatches.length === 0"
        type="info"
        variant="tonal"
        class="mb-4"
      >
        No published schedule yet. Check back soon.
      </v-alert>

      <!-- Schedule table -->
      <v-card v-else variant="outlined">
        <v-table density="compact">
          <thead>
            <tr>
              <th>Time</th>
              <th>End</th>
              <th>Category</th>
              <th>Team / Player 1</th>
              <th>vs</th>
              <th>Team / Player 2</th>
              <th>Court</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <template
              v-for="(match, idx) in publishedMatches"
              :key="match.id"
            >
              <!-- Date separator row -->
              <tr
                v-if="idx === 0 || formatDate(match.plannedStartAt) !== formatDate(publishedMatches[idx - 1].plannedStartAt)"
                class="bg-surface-light"
              >
                <td
                  colspan="8"
                  class="text-caption font-weight-bold text-medium-emphasis py-1 px-3"
                >
                  {{ formatDate(match.plannedStartAt) }}
                </td>
              </tr>
              <tr>
                <td class="font-weight-medium">
                  {{ formatTime(match.plannedStartAt) }}
                </td>
                <td class="text-caption text-medium-emphasis">
                  {{ formatTime(match.plannedEndAt) }}
                </td>
                <td class="text-caption">
                  {{ categoryName(match.categoryId) }}
                </td>
                <td>{{ getParticipantName(match.participant1Id) || 'TBD' }}</td>
                <td class="text-center text-caption text-medium-emphasis">
                  vs
                </td>
                <td>{{ getParticipantName(match.participant2Id) || 'TBD' }}</td>
                <td class="text-caption">
                  {{ match.courtName || '—' }}
                </td>
                <td>
                  <v-chip
                    v-if="match.status !== 'scheduled' && match.status !== 'ready'"
                    :color="statusColor(match.status)"
                    size="x-small"
                    variant="tonal"
                  >
                    {{ match.status.replace('_', ' ') }}
                  </v-chip>
                </td>
              </tr>
            </template>
          </tbody>
        </v-table>
      </v-card>
    </template>
  </v-container>
</template>
