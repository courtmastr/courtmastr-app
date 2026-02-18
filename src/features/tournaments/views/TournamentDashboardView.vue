<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import BaseDialog from '@/components/common/BaseDialog.vue';
import { getNextTournamentState, type TournamentLifecycleState } from '@/guards/tournamentState';
import BracketsManagerViewer from '@/features/brackets/components/BracketsManagerViewer.vue';
import CategoryManagement from '../components/CategoryManagement.vue';
import CourtManagement from '../components/CourtManagement.vue';
import CategoryRegistrationStats from '../components/CategoryRegistrationStats.vue';
import OrganizerChecklist from '../components/OrganizerChecklist.vue';
import StateBanner from '../components/StateBanner.vue';

import StatusBadge from '@/components/common/StatusBadge.vue';
// ActiveMatchesSection removed - using compact summary on dashboard instead

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const { getParticipantName } = useParticipantResolver();
const { getMatchDisplayName } = useMatchDisplay();

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

// Initialize active tab based on URL hash or query parameter
if (route.query.tab) {
  activeTab.value = route.query.tab as string;
}

// Watch for changes in route query parameter to update active tab
watch(() => route.query.tab, (newTab) => {
  if (newTab) {
    activeTab.value = newTab as string;
  }
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

// Enrich active matches with participant and court names for ActiveMatchesSection
const enrichedActiveMatches = computed(() => {
  return matches.value
    .filter(m => m.status === 'in_progress')
    .map(match => {
      const category = categories.value.find(c => c.id === match.categoryId);
      const court = courts.value.find(c => c.id === match.courtId);
      
      const p1Reg = registrations.value.find(r => r.id === match.participant1Id);
      const p2Reg = registrations.value.find(r => r.id === match.participant2Id);
      
      const p1Player = p1Reg ? registrationStore.players.find(p => p.id === p1Reg.playerId) : null;
      const p2Player = p2Reg ? registrationStore.players.find(p => p.id === p2Reg.playerId) : null;
      
      let p1Name = p1Reg && p1Player ? `${p1Player.firstName} ${p1Player.lastName}` : 'TBD';
      let p2Name = p2Reg && p2Player ? `${p2Player.firstName} ${p2Player.lastName}` : 'TBD';
      
      // Add partner names for doubles
      if (p1Reg?.partnerPlayerId) {
        const partner = registrationStore.players.find(p => p.id === p1Reg.partnerPlayerId);
        if (partner) p1Name += ` / ${partner.firstName} ${partner.lastName}`;
      }
      if (p2Reg?.partnerPlayerId) {
        const partner = registrationStore.players.find(p => p.id === p2Reg.partnerPlayerId);
        if (partner) p2Name += ` / ${partner.firstName} ${partner.lastName}`;
      }
      
      return {
        ...match,
        participant1Name: p1Name,
        participant2Name: p2Name,
        categoryName: category?.name || 'Unknown Category',
        courtName: court?.name || `Court ${court?.number}` || 'No Court',
      };
    }) as any[]; // Type cast for component compatibility
});

function handleEnterScore(matchId: string) {
  const match = matches.value.find((m) => m.id === matchId);
  router.push({
    path: `/tournaments/${tournamentId.value}/matches/${matchId}/score`,
    query: match?.categoryId ? { category: match.categoryId } : undefined
  });
}

function handleCompleteMatch(matchId: string) {
  const match = matches.value.find((m) => m.id === matchId);
  if (!match) return;
  matchToComplete.value = match;
  showCompleteMatchDialog.value = true;
}

async function confirmCompleteMatch(winnerId: string) {
  if (!matchToComplete.value) return;
  showCompleteMatchDialog.value = false;
  try {
    await matchStore.completeMatch(tournamentId.value, matchToComplete.value.id, winnerId);
    notificationStore.showToast('success', 'Match completed');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to complete match');
  }
  matchToComplete.value = null;
}

function getCurrentScore(match: any): string {
  if (!match.scores || match.scores.length === 0) return '0 - 0';
  const current = match.scores[match.scores.length - 1];
  return `${current.score1} - ${current.score2}`;
}

function navigateToMatchControl() {
  router.push(`/tournaments/${tournamentId.value}/match-control`);
}

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);

  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
});

watch(
  categories,
  (newCategories) => {
    if (!selectedCategory.value && newCategories.length > 0) {
      selectedCategory.value = newCategories[0].id;
    }
  },
  { immediate: true }
);

watch(
  tournamentId,
  (tid) => {
    if (tid) {
      matchStore.subscribeAllMatches(tid);
    }
  },
  { immediate: true }
);

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

function getNextState(currentState: TournamentLifecycleState | undefined): TournamentLifecycleState | null {
  if (!currentState) return 'REG_OPEN';
  return getNextTournamentState(currentState);
}

async function advanceState(): Promise<void> {
  if (!tournament.value?.state) return;
  const nextState = getNextTournamentState(tournament.value.state);
  if (nextState) {
    try {
      await tournamentStore.updateTournament(tournamentId.value, { state: nextState });
      notificationStore.showToast('success', `Tournament moved to ${nextState}`);
    } catch (error) {
      notificationStore.showToast('error', 'Failed to advance tournament state');
    }
  }
}

const showUnlockDialog = ref(false);

async function generateBracket(categoryId: string) {
  try {
    await tournamentStore.generateBracket(tournamentId.value, categoryId);
    notificationStore.showToast('success', 'Bracket generated successfully!');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to generate bracket');
  }
}

async function generateEliminationStage(categoryId: string) {
  try {
    await tournamentStore.generatePoolEliminationBracket(tournamentId.value, categoryId);
    notificationStore.showToast('success', 'Elimination stage generated from pool results!');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to generate elimination stage');
  }
}

const showRegenerateBracketDialog = ref(false);
const regenerateCategoryId = ref<string | null>(null);
const regenerateInProgress = ref(false);

// Complete match dialog state
const showCompleteMatchDialog = ref(false);
const matchToComplete = ref<any>(null);

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

const scheduleResult = ref<{
  scheduled: number;
  unscheduled: number;
  unscheduledDetails?: Array<{ matchId: string; reason?: string; details?: Record<string, unknown> }>;
} | null>(null);

async function generateSchedule() {
  try {
    if (!selectedCategory.value) {
      notificationStore.showToast('error', 'Please select a category to schedule');
      return;
    }

    const result = await tournamentStore.generateSchedule(tournamentId.value, {
      categoryId: selectedCategory.value,
    });
    scheduleResult.value = result;

    if (result.unscheduled > 0 && result.unscheduledDetails) {
      notificationStore.showToast(
        'warning',
        `${result.scheduled} matches scheduled, ${result.unscheduled} could not be scheduled`
      );
    } else {
      notificationStore.showToast('success', 'Schedule generated successfully!');
    }
  } catch (error) {
    notificationStore.showToast('error', 'Failed to generate schedule');
  }
}

async function updateStatus(status: string) {
  try {
    await tournamentStore.updateTournamentStatus(tournamentId.value, status as any);
    notificationStore.showToast('success', `Tournament status updated to ${status}`);
  } catch (error) {
  }
}

// Delete Tournament
const showDeleteDialog = ref(false);
const deleteLoading = ref(false);

async function handleDeleteTournament() {
  if (!tournament.value) return;
  
  // Double-check logic (case sensitive name match could be added for extra safety, but simple confirmation is fine)
  deleteLoading.value = true;
  try {
    await tournamentStore.deleteTournament(tournament.value.id);
    notificationStore.showToast('success', 'Tournament deleted successfully');
    showDeleteDialog.value = false;
    router.push('/tournaments');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to delete tournament');
  } finally {
    deleteLoading.value = false;
  }
}
</script>

<template>
  <v-container
    v-if="tournament"
    fluid
  >
    <!-- Compact Header with Breadcrumbs Integrated -->
    <v-card
      flat
      class="mb-6 bg-transparent"
    >
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-4">
        <div>
          <div class="d-flex align-center mb-1">
            <v-btn
              icon="mdi-arrow-left"
              variant="text"
              density="comfortable"
              class="mr-2"
              @click="router.push('/tournaments')"
            />
            <h1 class="text-h4 font-weight-bold text-gradient">
              {{ tournament.name }}
            </h1>
            <StatusBadge
              :status="tournament.status"
              type="general"
              size="small"
            />
          </div>
          <div class="d-flex align-center text-body-2 text-grey-darken-1 ml-10">
            <v-icon
              size="small"
              start
            >
              mdi-calendar
            </v-icon>
            {{ formatDate(tournament.startDate) }}
            <span
              v-if="tournament.location"
              class="mx-2"
            >•</span>
            <v-icon
              v-if="tournament.location"
              size="small"
              start
            >
              mdi-map-marker
            </v-icon>
            <span v-if="tournament.location">{{ tournament.location }}</span>
          </div>
        </div>

        <div
          v-if="isAdmin"
          class="d-flex gap-2"
        >
          <v-btn
            variant="outlined"
            color="primary"
            prepend-icon="mdi-cog"
            :to="`/tournaments/${tournamentId}/settings`"
          >
            Settings
          </v-btn>
          <v-menu>
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                color="primary"
                append-icon="mdi-chevron-down"
              >
                Manage
              </v-btn>
            </template>
            <v-list
              density="compact"
              nav
            >
              <v-list-item
                v-if="tournament.status === 'draft'"
                prepend-icon="mdi-account-plus"
                title="Open Registration"
                @click="updateStatus('registration')"
              />
              <v-list-item
                v-if="tournament.status === 'registration'"
                prepend-icon="mdi-play"
                title="Start Tournament"
                @click="updateStatus('active')"
              />
              <v-list-item
                prepend-icon="mdi-calendar-clock"
                title="Generate Schedule"
                @click="generateSchedule"
              />
              <v-list-item
                v-if="tournament.status === 'active'"
                prepend-icon="mdi-check"
                title="Complete Tournament"
                @click="updateStatus('completed')"
              />
              <v-divider class="my-1" />
              <v-list-item
                prepend-icon="mdi-delete"
                title="Delete Tournament"
                base-color="error"
                @click="showDeleteDialog = true"
              />
            </v-list>
          </v-menu>
        </div>
      </div>
    </v-card>

    <!-- Contextual Status Card -->
    <v-card
      v-if="isAdmin"
      elevation="0"
      class="mb-6 contextual-card"
      :class="`status-${tournament.status}`"
    >
      <v-card-text class="d-flex flex-column flex-sm-row align-center justify-space-between pa-4">
        <div class="d-flex align-center mb-3 mb-sm-0">
          <v-avatar
            :color="tournament.status === 'active' ? 'success' : 'primary'"
            variant="tonal"
            class="mr-4"
          >
            <v-icon>
              {{
                tournament.status === 'active' ? 'mdi-lightning-bolt' :
                tournament.status === 'registration' ? 'mdi-account-group' :
                tournament.status === 'completed' ? 'mdi-trophy' : 'mdi-clipboard-edit'
              }}
            </v-icon>
          </v-avatar>
          <div>
            <div class="text-subtitle-1 font-weight-bold">
              {{
                tournament.status === 'active' ? 'Tournament in Progress' :
                tournament.status === 'registration' ? 'Registration Open' :
                tournament.status === 'completed' ? 'Tournament Completed' : 'Draft Mode'
              }}
            </div>
            <div class="text-caption text-grey-darken-1">
              {{
                tournament.status === 'active' ? 'Manage live matches and update scores.' :
                tournament.status === 'registration' ? 'Review participants and approve registrations.' :
                tournament.status === 'completed' ? 'View final results and rankings.' : 'Configure settings and categories.'
              }}
            </div>
          </div>
        </div>
        
        <div class="d-flex gap-2">
          <v-btn
            v-if="tournament.status === 'draft'"
            variant="flat"
            color="primary"
            prepend-icon="mdi-tournament"
            @click="activeTab = 'categories'"
          >
            Setup Categories
          </v-btn>
          <v-btn
            v-if="tournament.status === 'registration'"
            variant="flat"
            color="primary"
            prepend-icon="mdi-account-check"
            @click="activeTab = 'registrations'"
          >
            Review Registrations
          </v-btn>

          <v-btn
            v-if="tournament.status === 'completed'"
            variant="flat"
            color="primary"
            prepend-icon="mdi-trophy-variant"
            @click="activeTab = 'brackets'"
          >
            View Results
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- State Banner (TOURNEY-003) -->
    <StateBanner
      v-if="tournament"
      :state="tournament.state || 'DRAFT'"
      :next-state="getNextState(tournament.state || 'DRAFT')"
      :is-admin="isAdmin"
      @advance="advanceState"
      @unlock="showUnlockDialog = true"
    />

    <!-- Stats Grid -->
    <v-row class="mb-6">
      <v-col
        cols="12"
        sm="6"
        md="3"
      >
        <v-card
          class="stat-card"
          elevation="0"
        >
          <div class="stat-icon-wrapper bg-primary-subtle">
            <v-icon
              color="primary"
              size="24"
            >
              mdi-account-group
            </v-icon>
          </div>
          <div class="stat-content">
            <span class="text-h4 font-weight-bold d-block">{{ stats.approvedRegistrations }}</span>
            <v-tooltip
              text="Approved and checked-in participants"
              location="bottom"
            >
              <template #activator="{ props }">
                <span
                  class="text-caption text-grey font-weight-medium"
                  v-bind="props"
                >PARTICIPANTS</span>
              </template>
            </v-tooltip>
          </div>
        </v-card>
      </v-col>
      
      <v-col
        cols="12"
        sm="6"
        md="3"
      >
        <v-card
          class="stat-card"
          elevation="0"
        >
          <div class="stat-icon-wrapper bg-info-subtle">
            <v-icon
              color="info"
              size="24"
            >
              mdi-tournament
            </v-icon>
          </div>
          <div class="stat-content">
            <span class="text-h4 font-weight-bold d-block">{{ stats.totalMatches }}</span>
            <v-tooltip
              text="Total matches across all categories"
              location="bottom"
            >
              <template #activator="{ props }">
                <span
                  class="text-caption text-grey font-weight-medium"
                  v-bind="props"
                >TOTAL MATCHES</span>
              </template>
            </v-tooltip>
          </div>
        </v-card>
      </v-col>
      
      <v-col
        cols="12"
        sm="6"
        md="3"
      >
        <v-card
          class="stat-card"
          elevation="0"
        >
          <div class="stat-icon-wrapper bg-warning-subtle">
            <v-icon
              color="warning"
              size="24"
            >
              mdi-whistle
            </v-icon>
          </div>
          <div class="stat-content">
            <span class="text-h4 font-weight-bold d-block">{{ stats.inProgressMatches }}</span>
            <v-tooltip
              text="Matches currently being played"
              location="bottom"
            >
              <template #activator="{ props }">
                <span
                  class="text-caption text-grey font-weight-medium"
                  v-bind="props"
                >IN PROGRESS</span>
              </template>
            </v-tooltip>
          </div>
        </v-card>
      </v-col>
      
      <v-col
        cols="12"
        sm="6"
        md="3"
      >
        <v-card
          class="stat-card"
          elevation="0"
        >
          <div class="stat-icon-wrapper bg-success-subtle">
            <v-icon
              color="success"
              size="24"
            >
              mdi-check-all
            </v-icon>
          </div>
          <div class="stat-content">
            <span class="text-h4 font-weight-bold d-block">{{ stats.progress }}%</span>
            <v-tooltip
              text="Percentage of matches completed"
              location="bottom"
            >
              <template #activator="{ props }">
                <span
                  class="text-caption text-grey font-weight-medium"
                  v-bind="props"
                >COMPLETED</span>
              </template>
            </v-tooltip>
          </div>
          <v-progress-linear
            :model-value="stats.progress"
            color="success"
            height="4"
            rounded
            class="mt-2"
          />
        </v-card>
      </v-col>
    </v-row>

    <!-- Active Matches Section (Overview Tab Only) -->
    <div
      v-if="activeTab === 'overview' && stats.inProgressMatches > 0"
      class="mb-6"
    >
      <div class="d-flex align-center justify-space-between mb-4">
        <h2 class="text-h5 font-weight-bold text-gradient-primary">
          <v-icon
            start
            class="mr-2"
          >
            mdi-whistle
          </v-icon>
          Active Matches
        </h2>
        <v-btn
          variant="text"
          color="primary"
          prepend-icon="mdi-court-sport"
          @click="activeTab = 'courts-manage'"
        >
          View Court Status
        </v-btn>
      </div>

      <!-- Compact Active Matches Summary -->
      <v-card
        variant="outlined"
        class="mb-4"
      >
        <v-card-title class="d-flex align-center justify-space-between">
          <div class="d-flex align-center">
            <v-icon
              start
              color="info"
            >
              mdi-timer-sand
            </v-icon>
            Active Matches
          </div>
          <v-chip
            color="info"
            size="small"
            variant="tonal"
          >
            {{ enrichedActiveMatches.length }}
          </v-chip>
        </v-card-title>
        <v-divider />
        <v-card-text
          v-if="enrichedActiveMatches.length > 0"
          class="pa-0"
        >
          <v-list
            density="compact"
            class="pa-0"
          >
            <v-list-item
              v-for="match in enrichedActiveMatches.slice(0, 3)"
              :key="match.id"
              class="px-4"
            >
              <v-list-item-title class="text-body-2">
                {{ match.participant1Name }} vs {{ match.participant2Name }}
              </v-list-item-title>
              <v-list-item-subtitle class="text-caption">
                {{ match.categoryName }} • {{ match.courtName }}
              </v-list-item-subtitle>
              <template #append>
                <v-chip
                  size="x-small"
                  variant="flat"
                  color="secondary"
                >
                  {{ getCurrentScore(match) }}
                </v-chip>
              </template>
            </v-list-item>
            <v-divider v-if="enrichedActiveMatches.length > 3" />
            <v-list-item
              v-if="enrichedActiveMatches.length > 3"
              class="px-4"
            >
              <v-list-item-title class="text-center text-medium-emphasis text-caption">
                +{{ enrichedActiveMatches.length - 3 }} more matches in progress
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-text
          v-else
          class="text-center text-medium-emphasis py-6"
        >
          <v-icon
            size="48"
            color="grey-lighten-2"
            class="mb-2"
          >
            mdi-trophy-outline
          </v-icon>
          <div class="text-body-2">
            No matches currently in progress
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-btn
            variant="text"
            color="primary"
            block
            @click="navigateToMatchControl"
          >
            <v-icon start>
              mdi-arrow-right
            </v-icon>
            View Match Control
          </v-btn>
        </v-card-actions>
      </v-card>
    </div>

    <!-- Tabs -->
    <v-card>
      <v-tabs
        v-model="activeTab"
        color="primary"
      >
        <v-tab value="overview">
          Overview
        </v-tab>
        <v-tab
          v-if="isAdmin"
          value="categories"
        >
          Categories
        </v-tab>
        <v-tab
          v-if="isAdmin"
          value="courts-manage"
        >
          Courts
        </v-tab>
        <v-tab value="brackets">
          Brackets
        </v-tab>
        <v-tab value="matches">
          Matches
        </v-tab>
        <v-tab
          v-if="isAdmin"
          value="registrations"
        >
          Registrations
        </v-tab>
        <v-tab :to="`/tournaments/${tournamentId}/leaderboard`">
          Leaderboard
        </v-tab>
      </v-tabs>

      <v-divider />

      <v-tabs-window v-model="activeTab">
        <!-- Overview Tab -->
        <v-tabs-window-item value="overview">
          <v-card-text>
            <!-- Organizer Checklist (TOURNEY-106) -->
            <v-row class="mb-4">
              <v-col
                cols="12"
                md="4"
              >
                <organizer-checklist :tournament-id="tournamentId" />
              </v-col>
              <v-col
                cols="12"
                md="8"
              >
                <!-- Category Registration Stats -->
                <CategoryRegistrationStats
                  :tournament-id="tournamentId"
                  @generate-bracket="generateBracket"
                  @generate-elimination="generateEliminationStage"
                  @regenerate-bracket="confirmRegenerateBracket"
                  @manage-registrations="(categoryId) => router.push(`/tournaments/${tournamentId}/registrations?category=${categoryId}`)"
                  @manage-seeds="openSeedingDialog"
                />
              </v-col>
            </v-row>

            <!-- Schedule Result Alert -->
            <v-alert
              v-if="scheduleResult && scheduleResult.unscheduled > 0"
              type="warning"
              variant="tonal"
              closable
              class="mt-4"
              @click:close="scheduleResult = null"
            >
              <div class="d-flex align-center">
                <v-icon
                  icon="mdi-alert"
                  class="mr-2"
                />
                <div class="font-weight-bold">
                  {{ scheduleResult.unscheduled }} match(es) could not be scheduled
                </div>
              </div>

              <v-divider class="my-2" />

              <v-list
                density="compact"
                class="bg-transparent"
              >
                <v-list-item
                  v-for="item in scheduleResult.unscheduledDetails"
                  :key="item.matchId"
                  class="px-0"
                >
                  <template #prepend>
                    <v-icon
                      icon="mdi-information"
                      size="small"
                      color="warning"
                    />
                  </template>
                  <v-list-item-title>Match ID: {{ item.matchId }}</v-list-item-title>
                  <v-list-item-subtitle class="text-warning">
                    {{ item.reason || 'Unknown reason' }}
                  </v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-alert>

            <!-- Tournament Info -->
            <v-card
              class="mt-4"
              variant="outlined"
            >
              <v-card-title>
                <v-icon start>
                  mdi-information
                </v-icon>
                Tournament Info
              </v-card-title>
              <v-card-text>
                <v-row>
                  <v-col
                    cols="6"
                    sm="4"
                    md="2"
                  >
                    <div class="text-caption text-grey">
                      Sport
                    </div>
                    <div class="font-weight-medium">
                      {{ tournament.sport }}
                    </div>
                  </v-col>
                  <v-col
                    cols="6"
                    sm="4"
                    md="2"
                  >
                    <div class="text-caption text-grey">
                      Categories
                    </div>
                    <div class="font-weight-medium">
                      {{ categories.length }}
                    </div>
                  </v-col>
                  <v-col
                    cols="6"
                    sm="4"
                    md="2"
                  >
                    <div class="text-caption text-grey">
                      Courts
                    </div>
                    <div class="font-weight-medium">
                      {{ courts.length }}
                    </div>
                  </v-col>
                  <v-col
                    cols="6"
                    sm="4"
                    md="2"
                  >
                    <div class="text-caption text-grey">
                      Rest Time
                    </div>
                    <div class="font-weight-medium">
                      {{ tournament.settings?.minRestTimeMinutes || 15 }} min
                    </div>
                  </v-col>
                  <v-col
                    cols="6"
                    sm="4"
                    md="2"
                  >
                    <div class="text-caption text-grey">
                      Match Duration
                    </div>
                    <div class="font-weight-medium">
                      {{ tournament.settings?.matchDurationMinutes || 30 }} min
                    </div>
                  </v-col>
                  <v-col
                    cols="6"
                    sm="4"
                    md="2"
                  >
                    <div class="text-caption text-grey">
                      Location
                    </div>
                    <div class="font-weight-medium">
                      {{ tournament.location || '-' }}
                    </div>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-card-text>
        </v-tabs-window-item>

        <!-- Categories Tab (Admin only) -->
        <v-tabs-window-item
          v-if="isAdmin"
          value="categories"
        >
          <v-card-text>
            <CategoryManagement :tournament-id="tournamentId" />
          </v-card-text>
        </v-tabs-window-item>

        <!-- Courts Management Tab (Admin only) -->
        <v-tabs-window-item
          v-if="isAdmin"
          value="courts-manage"
        >
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
               :items="matches"
               :headers="[
                 { title: 'Match', key: 'match', sortable: true },
                 { title: 'Status', key: 'status', sortable: true },
                 { title: 'Actions', key: 'actions', sortable: false },
               ]"
               :items-per-page="10"
               class="elevation-1"
               show-expand
               item-value="id"
             >
               <template #item.match="{ item }">
                 <div class="d-flex flex-column py-1">
                   <div class="font-weight-medium">
                     #{{ item.matchNumber }}: {{ getMatchDisplayName(item) }}
                   </div>
                   <div class="text-caption text-grey">
                     {{ getCategoryName(item.categoryId) }} • Round {{ item.round }}
                   </div>
                 </div>
               </template>
               <template #item.status="{ item }">
                 <v-chip
                   :color="getStatusColor(item.status)"
                   size="small"
                 >
                   {{ item.status }}
                 </v-chip>
               </template>
               <template #item.actions="{ item }">
                 <v-btn
                   v-if="item.status === 'ready' || item.status === 'in_progress'"
                   size="small"
                   color="primary"
                   :to="{ path: `/tournaments/${tournamentId}/matches/${item.id}/score`, query: item.categoryId ? { category: item.categoryId } : undefined }"
                 >
                   Score
                 </v-btn>
               </template>
               <template #expanded-row="{ columns, item }">
                 <tr>
                   <td :colspan="columns.length" class="bg-grey-lighten-5 pa-4">
                     <div class="d-flex flex-wrap gap-4 text-body-2">
                       <div>
                         <strong>Score:</strong> 
                         <span v-if="item.scores.length > 0">
                           {{ item.scores.map((s: any) => `${s.score1}-${s.score2}`).join(', ') }}
                         </span>
                         <span
                           v-else
                           class="text-grey"
                         >-</span>
                       </div>
                       <div><strong>Court:</strong> {{ courts.find((c) => c.id === item.courtId)?.name || '-' }}</div>
                     </div>
                   </td>
                 </tr>
               </template>
             </v-data-table>
          </v-card-text>
        </v-tabs-window-item>

        <!-- Registrations Tab (Admin only) -->
        <v-tabs-window-item
          v-if="isAdmin"
          value="registrations"
        >
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
               :items="registrations"
               :headers="[
                 { title: 'Player', key: 'player', sortable: true },
                 { title: 'Category', key: 'category', sortable: true },
                 { title: 'Status', key: 'status', sortable: true },
               ]"
               :items-per-page="10"
               class="elevation-1"
               show-expand
               item-value="id"
             >
               <template #item.player="{ item }">
                 <div class="d-flex flex-column">
                   <span class="font-weight-medium">{{ getParticipantDisplay(item) }}</span>
                 </div>
               </template>
               <template #item.category="{ item }">
                 <span class="text-caption text-grey">{{ categories.find((c) => c.id === item.categoryId)?.name || 'Unknown' }}</span>
               </template>
               <template #item.status="{ item }">
                 <v-chip
                   :color="item.status === 'approved' ? 'success' : item.status === 'pending' ? 'warning' : 'grey'"
                   size="small"
                 >
                   {{ item.status }}
                 </v-chip>
               </template>
               <template #expanded-row="{ columns, item }">
                 <tr>
                   <td :colspan="columns.length" class="bg-grey-lighten-5 pa-4">
                     <div class="text-body-2">
                       <strong>Registered:</strong> {{ item.createdAt?.toLocaleDateString() || 'Unknown' }}
                     </div>
                   </td>
                 </tr>
               </template>
             </v-data-table>
          </v-card-text>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card>
  </v-container>

  <!-- Loading State -->
  <v-container
    v-else-if="loading"
    class="fill-height"
  >
    <v-row
      align="center"
      justify="center"
    >
      <v-progress-circular
        indeterminate
        size="64"
        color="primary"
      />
    </v-row>
  </v-container>

  <!-- Regenerate Bracket Confirmation Dialog -->
  <BaseDialog
    v-model="showRegenerateBracketDialog"
    title="Regenerate Bracket?"
    max-width="500"
    @confirm="regenerateBracket"
    @cancel="showRegenerateBracketDialog = false"
  >
    <div class="d-flex align-center">
      <v-icon
        color="warning"
        class="mr-2"
      >
        mdi-alert
      </v-icon>
      <span>Regenerate Bracket?</span>
    </div>
    <p class="mb-3">
      This will regenerate the bracket for this category with proper progression links.
    </p>
    <v-alert
      type="warning"
      variant="tonal"
      class="mb-3"
    >
      <strong>Warning:</strong> This will reset all matches and clear any existing scores.
      Only do this if bracket progression is broken.
    </v-alert>
    <p class="text-body-2 text-grey">
      Seeding and participant assignments will be preserved.
    </p>
    <template #actions>
      <v-spacer />
      <v-btn
        variant="text"
        @click="showRegenerateBracketDialog = false"
      >
        Cancel
      </v-btn>
      <v-btn
        color="warning"
        variant="flat"
        :loading="regenerateInProgress"
        @click="regenerateBracket"
      >
        Regenerate Bracket
      </v-btn>
    </template>
  </BaseDialog>

  <!-- Seeding Dialog -->
  <v-dialog
    v-model="showSeedingDialog"
    max-width="600"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">
          mdi-seed
        </v-icon>
        Manage Seeds
        <v-spacer />
        <v-chip
          size="small"
          color="primary"
          variant="tonal"
        >
          {{ seedingRegistrations.length }} players
        </v-chip>
      </v-card-title>

      <v-card-text>
        <v-alert
          type="info"
          variant="tonal"
          density="compact"
          class="mb-4"
        >
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
            data-testid="auto-assign-seeds-btn"
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
                <span
                  v-if="reg.seed !== null"
                  class="text-white font-weight-bold"
                >
                  {{ reg.seed }}
                </span>
                <span
                  v-else
                  class="text-grey"
                >{{ index + 1 }}</span>
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
                :data-testid="`seed-input-${reg.id}`"
                @update:model-value="(val) => saveSeed(reg.id, val)"
              />
            </template>
          </v-list-item>
        </v-list>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          data-testid="close-seeding-dialog-btn"
          @click="showSeedingDialog = false"
        >
          Done
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Delete Confirmation Dialog -->
  <v-dialog
    v-model="showDeleteDialog"
    max-width="500"
  >
    <v-card>
      <v-card-title class="text-h5 text-error">
        <v-icon
          start
          icon="mdi-alert"
          color="error"
        />
        Delete Tournament?
      </v-card-title>
      <v-card-text>
        Are you sure you want to delete <strong>{{ tournament.name }}</strong>? This action cannot be undone and will remove all matches, scores, and participant data.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="deleteLoading"
          @click="showDeleteDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="error"
          variant="elevated"
          :loading="deleteLoading"
          @click="handleDeleteTournament"
        >
          Delete Forever
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Complete Match Winner Dialog -->
  <v-dialog
    v-model="showCompleteMatchDialog"
    max-width="400"
    persistent
  >
    <v-card v-if="matchToComplete">
      <v-card-title>Select Winner</v-card-title>
      <v-card-text>
        <p class="mb-4">
          Who won this match?
        </p>
        <v-btn
          block
          color="primary"
          class="mb-2"
          @click="confirmCompleteMatch(matchToComplete.participant1Id)"
        >
          {{ getParticipantName(matchToComplete.participant1Id) }}
        </v-btn>
        <v-btn
          block
          color="primary"
          variant="outlined"
          @click="confirmCompleteMatch(matchToComplete.participant2Id)"
        >
          {{ getParticipantName(matchToComplete.participant2Id) }}
        </v-btn>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="showCompleteMatchDialog = false"
        >
          Cancel
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.text-gradient {
  background: $primary-gradient;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.contextual-card {
  border: 1px solid rgba($primary-base, 0.1);
  background: linear-gradient(to right, rgba($primary-base, 0.05), rgba($white, 0.5));
  
  &.status-active {
    border-color: rgba($success, 0.2);
    background: linear-gradient(to right, rgba($success, 0.05), rgba($white, 0.5));
  }
  
  &.status-completed {
    border-color: rgba($secondary-base, 0.2);
    background: linear-gradient(to right, rgba($secondary-base, 0.05), rgba($white, 0.5));
  }
}

.stat-card {
  display: flex;
  align-items: center;
  padding: $spacing-md;
  border: 1px solid $border-light;
  border-radius: $border-radius-lg;
  transition: $transition-base;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: $shadow-md;
    border-color: $primary-light;
  }
}

.stat-icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: $border-radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: $spacing-md;
}

.stat-content {
  flex-grow: 1;
}

.glow-effect {
  box-shadow: 0 0 15px rgba($success, 0.4);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba($success, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba($success, 0); }
  100% { box-shadow: 0 0 0 0 rgba($success, 0); }
}

// Background utility classes
.bg-primary-subtle { background-color: rgba($primary-base, 0.1) !important; }
.bg-info-subtle { background-color: rgba($info, 0.1) !important; }
.bg-success-subtle { background-color: rgba($success, 0.1) !important; }
.bg-warning-subtle { background-color: rgba($warning, 0.1) !important; }
</style>
