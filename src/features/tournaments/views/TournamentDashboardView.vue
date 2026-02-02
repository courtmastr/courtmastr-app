<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import SmartBracketView from '@/features/brackets/components/SmartBracketView.vue';
import BracketsManagerViewer from '@/features/brackets/components/BracketsManagerViewer.vue';
import CategoryManagement from '../components/CategoryManagement.vue';
import CourtManagement from '../components/CourtManagement.vue';
import CategoryRegistrationStats from '../components/CategoryRegistrationStats.vue';
import { FORMAT_LABELS } from '@/types';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const courts = computed(() => tournamentStore.courts);
const matches = computed(() => matchStore.matches);
const registrations = computed(() => registrationStore.registrations);
const loading = computed(() => tournamentStore.loading);
const isAdmin = computed(() => authStore.isAdmin);

const activeTab = ref('overview');
const selectedCategory = ref<string | null>(null);

// Track active category for match data queries
const activeCategory = computed(() => {
  // Use selectedCategory if available, otherwise check route query
  if (selectedCategory.value) {
    return selectedCategory.value;
  }
  const categoryQuery = route.query.category;
  return typeof categoryQuery === 'string' ? categoryQuery : null;
});

// Statistics
const stats = computed(() => {
  const totalMatches = matches.value.length;
  const completedMatches = matches.value.filter((m) => m.status === 'completed').length;
  const inProgressMatches = matches.value.filter((m) => m.status === 'in_progress').length;
  const totalRegistrations = registrations.value.length;
  const approvedRegistrations = registrations.value.filter((r) =>
    r.status === 'approved' || r.status === 'checked_in'
  ).length;

  return {
    totalMatches,
    completedMatches,
    inProgressMatches,
    totalRegistrations,
    approvedRegistrations,
    progress: totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0,
  };
});

const players = computed(() => registrationStore.players);

// Helper to get participant name from registration ID
function getParticipantName(registrationId: string | undefined): string {
  if (!registrationId) return 'TBD';

  const registration = registrations.value.find((r) => r.id === registrationId);
  if (!registration) return 'TBD';

  // For teams (doubles), show team name
  if (registration.teamName) {
    return registration.teamName;
  }

  // For singles, show player name
  const player = players.value.find((p) => p.id === registration.playerId);
  if (player) {
    return `${player.firstName} ${player.lastName}`;
  }

  return 'Unknown';
}

// Helper to get category name from match
function getCategoryName(categoryId: string): string {
  const category = categories.value.find((c) => c.id === categoryId);
  return category?.name || 'Unknown';
}

// Helper to get participant display name from registration
function getParticipantDisplay(registration: any): string {
  // For teams (doubles), show team name if available
  if (registration.teamName) {
    return registration.teamName;
  }

  // For singles or when teamName is not set, look up player names
  const player = players.value.find((p) => p.id === registration.playerId);
  const playerName = player ? `${player.firstName} ${player.lastName}` : 'Unknown';

  // If there's a partner, show both names
  if (registration.partnerPlayerId) {
    const partner = players.value.find((p) => p.id === registration.partnerPlayerId);
    const partnerName = partner ? `${partner.firstName} ${partner.lastName}` : 'Unknown';
    return `${playerName} / ${partnerName}`;
  }

  return playerName;
}

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);

  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);

  if (categories.value.length > 0) {
    selectedCategory.value = categories.value[0].id;
  }

  watch(
    [tournamentId, activeCategory],
    ([tid, catId]) => {
      if (tid && catId) {
        matchStore.subscribeMatches(tid, catId);
      }
    },
    { immediate: true }
  );
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  registrationStore.unsubscribeAll();
});

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'grey',
    registration: 'info',
    active: 'success',
    completed: 'secondary',
    cancelled: 'error',
  };
  return colors[status] || 'grey';
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

async function generateBracket(categoryId: string) {
  try {
    await tournamentStore.generateBracket(tournamentId.value, categoryId);
    notificationStore.showToast('success', 'Bracket generated successfully!');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to generate bracket');
  }
}

const showRegenerateBracketDialog = ref(false);
const regenerateCategoryId = ref<string | null>(null);
const regenerateInProgress = ref(false);

// Seeding state
const showSeedingDialog = ref(false);
const seedingCategoryId = ref<string | null>(null);
const seedingRegistrations = ref<Array<{ id: string; name: string; seed: number | null }>>([]);
const savingSeed = ref(false);

function openSeedingDialog(categoryId: string) {
  seedingCategoryId.value = categoryId;

  // Get registrations for this category that are approved/checked_in
  const categoryRegs = registrations.value.filter(
    (r) => r.categoryId === categoryId && (r.status === 'approved' || r.status === 'checked_in')
  );

  // Sort by existing seed first, then alphabetically
  seedingRegistrations.value = categoryRegs
    .map((r) => ({
      id: r.id,
      name: r.teamName || getParticipantName(r.id),
      seed: r.seed || null,
    }))
    .sort((a, b) => {
      // Seeded players first (by seed number), then unseeded
      if (a.seed !== null && b.seed !== null) return a.seed - b.seed;
      if (a.seed !== null) return -1;
      if (b.seed !== null) return 1;
      return a.name.localeCompare(b.name);
    });

  showSeedingDialog.value = true;
}

async function saveSeed(regId: string, seed: number | null) {
  savingSeed.value = true;
  try {
    await registrationStore.updateSeed(tournamentId.value, regId, seed);

    // Update local state
    const reg = seedingRegistrations.value.find((r) => r.id === regId);
    if (reg) reg.seed = seed;

    notificationStore.showToast('success', 'Seed updated');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update seed');
  } finally {
    savingSeed.value = false;
  }
}

async function autoAssignSeeds() {
  savingSeed.value = true;
  try {
    // Assign seeds 1-4 to first 4 players (by current order)
    for (let i = 0; i < Math.min(4, seedingRegistrations.value.length); i++) {
      const reg = seedingRegistrations.value[i];
      await registrationStore.updateSeed(tournamentId.value, reg.id, i + 1);
      reg.seed = i + 1;
    }
    // Clear seeds for the rest
    for (let i = 4; i < seedingRegistrations.value.length; i++) {
      const reg = seedingRegistrations.value[i];
      if (reg.seed !== null) {
        await registrationStore.updateSeed(tournamentId.value, reg.id, null);
        reg.seed = null;
      }
    }
    notificationStore.showToast('success', 'Auto-assigned top 4 seeds');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to auto-assign seeds');
  } finally {
    savingSeed.value = false;
  }
}

function clearAllSeeds() {
  seedingRegistrations.value.forEach(async (reg) => {
    if (reg.seed !== null) {
      await registrationStore.updateSeed(tournamentId.value, reg.id, null);
      reg.seed = null;
    }
  });
  notificationStore.showToast('success', 'All seeds cleared');
}

function confirmRegenerateBracket(categoryId: string) {
  regenerateCategoryId.value = categoryId;
  showRegenerateBracketDialog.value = true;
}

async function regenerateBracket() {
  if (!regenerateCategoryId.value) return;

  regenerateInProgress.value = true;
  try {
    await tournamentStore.regenerateBracket(tournamentId.value, regenerateCategoryId.value);
    notificationStore.showToast('success', 'Bracket regenerated successfully! Progression links updated.');
    showRegenerateBracketDialog.value = false;
  } catch (error) {
    console.error('Failed to regenerate bracket:', error);
    notificationStore.showToast('error', 'Failed to regenerate bracket');
  } finally {
    regenerateInProgress.value = false;
    regenerateCategoryId.value = null;
  }
}

async function generateSchedule() {
  try {
    await tournamentStore.generateSchedule(tournamentId.value);
    notificationStore.showToast('success', 'Schedule generated successfully!');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to generate schedule');
  }
}

async function updateStatus(status: string) {
  try {
    await tournamentStore.updateTournamentStatus(tournamentId.value, status as any);
    notificationStore.showToast('success', `Tournament status updated to ${status}`);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update status');
  }
}
</script>

<template>
  <v-container fluid v-if="tournament">
    <!-- Header -->
    <v-row class="mb-4">
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-btn icon="mdi-arrow-left" variant="text" @click="router.push('/tournaments')" />
          <div class="ml-2 flex-grow-1">
            <div class="d-flex align-center">
              <h1 class="text-h4 font-weight-bold">{{ tournament.name }}</h1>
              <v-chip
                :color="getStatusColor(tournament.status)"
                class="ml-3"
                size="small"
              >
                {{ tournament.status }}
              </v-chip>
            </div>
            <p class="text-body-2 text-grey">
              {{ formatDate(tournament.startDate) }}
              <span v-if="tournament.location"> | {{ tournament.location }}</span>
            </p>
          </div>
          <div v-if="isAdmin" class="d-flex gap-2">
            <v-btn
              v-if="tournament.status === 'active'"
              color="success"
              prepend-icon="mdi-controller"
              :to="`/tournaments/${tournamentId}/match-control`"
            >
              Match Control
            </v-btn>
            <v-btn
              variant="outlined"
              prepend-icon="mdi-cog"
              :to="`/tournaments/${tournamentId}/settings`"
            >
              Settings
            </v-btn>
            <v-menu>
              <template #activator="{ props }">
                <v-btn v-bind="props" color="primary">
                  Actions
                  <v-icon end>mdi-chevron-down</v-icon>
                </v-btn>
              </template>
              <v-list>
                <v-list-item
                  v-if="tournament.status === 'draft'"
                  prepend-icon="mdi-account-plus"
                  @click="updateStatus('registration')"
                >
                  Open Registration
                </v-list-item>
                <v-list-item
                  v-if="tournament.status === 'registration'"
                  prepend-icon="mdi-play"
                  @click="updateStatus('active')"
                >
                  Start Tournament
                </v-list-item>
                <v-list-item
                  prepend-icon="mdi-calendar-clock"
                  @click="generateSchedule"
                >
                  Generate Schedule
                </v-list-item>
                <v-list-item
                  v-if="tournament.status === 'active'"
                  prepend-icon="mdi-check"
                  @click="updateStatus('completed')"
                >
                  Complete Tournament
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Stats Cards -->
    <v-row class="mb-4">
      <v-col cols="6" md="3">
        <v-card>
          <v-card-text class="text-center">
            <v-icon size="32" color="primary">mdi-account-group</v-icon>
            <h3 class="text-h4 font-weight-bold mt-2">{{ stats.approvedRegistrations }}</h3>
            <p class="text-body-2 text-grey">Participants</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card>
          <v-card-text class="text-center">
            <v-icon size="32" color="info">mdi-tournament</v-icon>
            <h3 class="text-h4 font-weight-bold mt-2">{{ stats.totalMatches }}</h3>
            <p class="text-body-2 text-grey">Total Matches</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card>
          <v-card-text class="text-center">
            <v-icon size="32" color="success">mdi-play-circle</v-icon>
            <h3 class="text-h4 font-weight-bold mt-2">{{ stats.inProgressMatches }}</h3>
            <p class="text-body-2 text-grey">In Progress</p>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card>
          <v-card-text class="text-center">
            <v-icon size="32" color="secondary">mdi-check-circle</v-icon>
            <h3 class="text-h4 font-weight-bold mt-2">{{ stats.progress }}%</h3>
            <p class="text-body-2 text-grey">Complete</p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Tabs -->
    <v-card>
      <v-tabs v-model="activeTab" color="primary">
        <v-tab value="overview">Overview</v-tab>
        <v-tab v-if="isAdmin" value="categories">Categories</v-tab>
        <v-tab v-if="isAdmin" value="courts-manage">Courts</v-tab>
        <v-tab value="brackets">Brackets</v-tab>
        <v-tab value="matches">Matches</v-tab>
        <v-tab v-if="isAdmin" value="registrations">Registrations</v-tab>
      </v-tabs>

      <v-divider />

      <v-tabs-window v-model="activeTab">
        <!-- Overview Tab -->
        <v-tabs-window-item value="overview">
          <v-card-text>
            <!-- Category Registration Stats -->
            <CategoryRegistrationStats
              :tournament-id="tournamentId"
              @generate-bracket="generateBracket"
              @regenerate-bracket="confirmRegenerateBracket"
              @manage-registrations="(categoryId) => router.push(`/tournaments/${tournamentId}/registrations?category=${categoryId}`)"
              @manage-seeds="openSeedingDialog"
            />

            <!-- Tournament Info -->
            <v-card class="mt-4" variant="outlined">
              <v-card-title>
                <v-icon start>mdi-information</v-icon>
                Tournament Info
              </v-card-title>
              <v-card-text>
                <v-row>
                  <v-col cols="6" sm="4" md="2">
                    <div class="text-caption text-grey">Sport</div>
                    <div class="font-weight-medium">{{ tournament.sport }}</div>
                  </v-col>
                  <v-col cols="6" sm="4" md="2">
                    <div class="text-caption text-grey">Categories</div>
                    <div class="font-weight-medium">{{ categories.length }}</div>
                  </v-col>
                  <v-col cols="6" sm="4" md="2">
                    <div class="text-caption text-grey">Courts</div>
                    <div class="font-weight-medium">{{ courts.length }}</div>
                  </v-col>
                  <v-col cols="6" sm="4" md="2">
                    <div class="text-caption text-grey">Rest Time</div>
                    <div class="font-weight-medium">{{ tournament.settings?.minRestTimeMinutes || 15 }} min</div>
                  </v-col>
                  <v-col cols="6" sm="4" md="2">
                    <div class="text-caption text-grey">Match Duration</div>
                    <div class="font-weight-medium">{{ tournament.settings?.matchDurationMinutes || 30 }} min</div>
                  </v-col>
                  <v-col cols="6" sm="4" md="2">
                    <div class="text-caption text-grey">Location</div>
                    <div class="font-weight-medium">{{ tournament.location || '-' }}</div>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-card-text>
        </v-tabs-window-item>

        <!-- Categories Tab (Admin only) -->
        <v-tabs-window-item v-if="isAdmin" value="categories">
          <v-card-text>
            <CategoryManagement :tournament-id="tournamentId" />
          </v-card-text>
        </v-tabs-window-item>

        <!-- Courts Management Tab (Admin only) -->
        <v-tabs-window-item v-if="isAdmin" value="courts-manage">
          <v-card-text>
            <CourtManagement :tournament-id="tournamentId" />
          </v-card-text>
        </v-tabs-window-item>

        <!-- Brackets Tab -->
        <v-tabs-window-item value="brackets">
          <v-card-text>
            <v-select
              v-model="selectedCategory"
              :items="categories"
              item-title="name"
              item-value="id"
              label="Select Category"
              class="mb-4"
              style="max-width: 300px"
            />
            
            <!-- New brackets-viewer.js Display -->
            <BracketsManagerViewer
              v-if="selectedCategory"
              :tournament-id="tournamentId"
              :category-id="selectedCategory"
            />
            
            <!-- Fallback: Old custom bracket view (keep for now) -->
            <!-- 
            <SmartBracketView
              v-if="selectedCategory"
              :tournament-id="tournamentId"
              :category-id="selectedCategory"
            />
            -->
          </v-card-text>
        </v-tabs-window-item>

        <!-- Matches Tab -->
        <v-tabs-window-item value="matches">
          <v-card-text>
            <v-select
              v-model="selectedCategory"
              :items="categories"
              item-title="name"
              item-value="id"
              label="Select Category"
              class="mb-4"
              style="max-width: 300px"
            />
            <v-data-table
              :headers="[
                { title: 'Match', key: 'matchNumber' },
                { title: 'Category', key: 'categoryId' },
                { title: 'Round', key: 'round' },
                { title: 'Participants', key: 'participants' },
                { title: 'Score', key: 'score' },
                { title: 'Court', key: 'court' },
                { title: 'Status', key: 'status' },
                { title: 'Actions', key: 'actions', sortable: false },
              ]"
              :items="matches"
              :items-per-page="10"
            >
              <template #item.categoryId="{ item }">
                <v-chip size="x-small" variant="outlined">
                  {{ getCategoryName(item.categoryId) }}
                </v-chip>
              </template>
              <template #item.participants="{ item }">
                <span>{{ getParticipantName(item.participant1Id) }} vs {{ getParticipantName(item.participant2Id) }}</span>
              </template>
              <template #item.score="{ item }">
                <span v-if="item.scores.length > 0">
                  {{ item.scores.map((s: any) => `${s.score1}-${s.score2}`).join(', ') }}
                </span>
                <span v-else class="text-grey">-</span>
              </template>
              <template #item.court="{ item }">
                {{ courts.find((c) => c.id === item.courtId)?.name || '-' }}
              </template>
              <template #item.status="{ item }">
                <v-chip :color="getStatusColor(item.status)" size="small">
                  {{ item.status }}
                </v-chip>
              </template>
              <template #item.actions="{ item }">
                <v-btn
                  v-if="item.status === 'ready' || item.status === 'in_progress'"
                  size="small"
                  color="primary"
                  :to="`/tournaments/${tournamentId}/matches/${item.id}/score`"
                >
                  Score
                </v-btn>
              </template>
            </v-data-table>
          </v-card-text>
        </v-tabs-window-item>

        <!-- Registrations Tab (Admin only) -->
        <v-tabs-window-item v-if="isAdmin" value="registrations">
          <v-card-text>
            <div class="d-flex justify-end mb-4">
              <v-btn
                color="primary"
                prepend-icon="mdi-account-plus"
                :to="`/tournaments/${tournamentId}/registrations`"
              >
                Manage Registrations
              </v-btn>
            </div>
            <v-data-table
              :headers="[
                { title: 'Player', key: 'player' },
                { title: 'Category', key: 'category' },
                { title: 'Status', key: 'status' },
                { title: 'Registered', key: 'registeredAt' },
              ]"
              :items="registrations"
              :items-per-page="10"
            >
              <template #item.player="{ item }">
                {{ getParticipantDisplay(item) }}
              </template>
              <template #item.category="{ item }">
                {{ categories.find((c) => c.id === item.categoryId)?.name || 'Unknown' }}
              </template>
              <template #item.status="{ item }">
                <v-chip
                  :color="item.status === 'approved' ? 'success' : item.status === 'pending' ? 'warning' : 'grey'"
                  size="small"
                >
                  {{ item.status }}
                </v-chip>
              </template>
              <template #item.registeredAt="{ item }">
                {{ new Date(item.registeredAt).toLocaleDateString() }}
              </template>
            </v-data-table>
          </v-card-text>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card>
  </v-container>

  <!-- Loading State -->
  <v-container v-else-if="loading" class="fill-height">
    <v-row align="center" justify="center">
      <v-progress-circular indeterminate size="64" color="primary" />
    </v-row>
  </v-container>

  <!-- Regenerate Bracket Confirmation Dialog -->
  <v-dialog v-model="showRegenerateBracketDialog" max-width="500">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon color="warning" class="mr-2">mdi-alert</v-icon>
        Regenerate Bracket?
      </v-card-title>
      <v-card-text>
        <p class="mb-3">This will regenerate the bracket for this category with proper progression links.</p>
        <v-alert type="warning" variant="tonal" class="mb-3">
          <strong>Warning:</strong> This will reset all matches and clear any existing scores.
          Only do this if bracket progression is broken.
        </v-alert>
        <p class="text-body-2 text-grey">Seeding and participant assignments will be preserved.</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="showRegenerateBracketDialog = false"
          :disabled="regenerateInProgress"
        >
          Cancel
        </v-btn>
        <v-btn
          color="warning"
          variant="flat"
          @click="regenerateBracket"
          :loading="regenerateInProgress"
        >
          Regenerate Bracket
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Seeding Dialog -->
  <v-dialog v-model="showSeedingDialog" max-width="600">
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-seed</v-icon>
        Manage Seeds
        <v-spacer />
        <v-chip size="small" color="primary" variant="tonal">
          {{ seedingRegistrations.length }} players
        </v-chip>
      </v-card-title>

      <v-card-text>
        <v-alert type="info" variant="tonal" density="compact" class="mb-4">
          <strong>Seeding tips:</strong>
          <ul class="text-body-2 mt-1 mb-0">
            <li>Seed your top 4 players to ensure they don't meet early</li>
            <li>Seeded players get favorable bracket positions (byes if available)</li>
            <li>Leave seed empty for unseeded players</li>
          </ul>
        </v-alert>

        <div class="d-flex gap-2 mb-4">
          <v-btn
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-auto-fix"
            :loading="savingSeed"
            @click="autoAssignSeeds"
          >
            Auto-assign Top 4
          </v-btn>
          <v-btn
            size="small"
            variant="text"
            color="error"
            prepend-icon="mdi-eraser"
            @click="clearAllSeeds"
          >
            Clear All
          </v-btn>
        </div>

        <v-list density="compact">
          <v-list-item
            v-for="(reg, index) in seedingRegistrations"
            :key="reg.id"
            :class="{ 'bg-primary-lighten-5': reg.seed !== null }"
          >
            <template #prepend>
              <v-avatar
                :color="reg.seed !== null ? 'primary' : 'grey-lighten-2'"
                size="32"
                class="mr-3"
              >
                <span v-if="reg.seed !== null" class="text-white font-weight-bold">
                  {{ reg.seed }}
                </span>
                <span v-else class="text-grey">{{ index + 1 }}</span>
              </v-avatar>
            </template>

            <v-list-item-title class="font-weight-medium">
              {{ reg.name }}
            </v-list-item-title>

            <template #append>
              <v-select
                :model-value="reg.seed"
                :items="[
                  { title: 'No seed', value: null },
                  { title: 'Seed #1', value: 1 },
                  { title: 'Seed #2', value: 2 },
                  { title: 'Seed #3', value: 3 },
                  { title: 'Seed #4', value: 4 },
                  { title: 'Seed #5', value: 5 },
                  { title: 'Seed #6', value: 6 },
                  { title: 'Seed #7', value: 7 },
                  { title: 'Seed #8', value: 8 },
                ]"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="compact"
                hide-details
                style="width: 120px"
                @update:model-value="(val) => saveSeed(reg.id, val)"
              />
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="showSeedingDialog = false">
          Done
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
