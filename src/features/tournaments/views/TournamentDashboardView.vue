<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import { useCategoryStageStatus } from '@/composables/useCategoryStageStatus';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useTournamentBranding } from '@/composables/useTournamentBranding';
import { useTournamentStateAdvance } from '@/composables/useTournamentStateAdvance';
import TournamentBrandMark from '@/components/common/TournamentBrandMark.vue';
import TournamentSponsorStrip from '@/components/common/TournamentSponsorStrip.vue';
import { exportTournamentMatchesToCSV } from '../utils/export';
import OrganizerChecklist from '../components/OrganizerChecklist.vue';
import ActiveMatchesSection from '../components/ActiveMatchesSection.vue';
import ReadyQueue from '../components/ReadyQueue.vue';
import ScoringQrDialog from '../components/ScoringQrDialog.vue';
import TournamentAnnouncementCardDialog from '../components/TournamentAnnouncementCardDialog.vue';
import MatchStatsDashboard from '../components/MatchStatsDashboard.vue';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const courts = computed(() => tournamentStore.courts);
const matches = computed(() => matchStore.matches);
const registrations = computed(() => registrationStore.registrations);
const loading = computed(() => tournamentStore.loading);
const isAdmin = computed(() => authStore.isAdmin);
const { normalizedSponsors, tournamentLogoUrl } = useTournamentBranding(tournament);

const selectedCategory = ref<string | null>(null);
const statsLoaded = ref(false);

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

function getCategoryName(categoryId: string): string {
  const category = categories.value.find((item) => item.id === categoryId);
  return category?.name || 'Unknown Category';
}

function getCourtName(courtId?: string): string {
  if (!courtId) return 'No Court';
  const court = courts.value.find((item) => item.id === courtId);
  if (!court) return 'No Court';
  return court.name || `Court ${court.number}`;
}

const { queueMatches, totalRemainingMatches, categoryStageStatuses } = useCategoryStageStatus(
  categories,
  matches,
  getParticipantName
);

// Enrich active matches with category and court names for ActiveMatchesSection
const enrichedActiveMatches = computed(() => {
  return matches.value
    .filter((match) => match.status === 'in_progress')
    .map((match) => {
      return {
        ...match,
        categoryName: getCategoryName(match.categoryId),
        courtName: getCourtName(match.courtId),
      };
    });
});

async function confirmCompleteMatch(winnerId: string) {
  if (!matchToComplete.value) return;
  showCompleteMatchDialog.value = false;
  try {
    await matchStore.completeMatch(
      tournamentId.value,
      matchToComplete.value.id,
      [],
      winnerId,
      matchToComplete.value.categoryId
    );
    notificationStore.showToast('success', 'Match completed');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to complete match');
  }
  matchToComplete.value = null;
}

function handleQueueSelect(ref: { matchId: string; categoryId: string }): void {
  router.push({
    path: `/tournaments/${tournamentId.value}/matches/${ref.matchId}/score`,
    query: { category: ref.categoryId },
  });
}

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);

  // Organizers may only access tournaments they are assigned to
  if (authStore.currentUser?.role === 'organizer') {
    const t = tournamentStore.currentTournament;
    const uid = authStore.currentUser.id;
    const ids = t?.organizerIds ?? [];
    if (t && !ids.includes(uid) && t.createdBy !== uid) {
      router.replace('/tournaments');
      return;
    }
  }

  try {
    await Promise.all([
      matchStore.fetchMatches(tournamentId.value),
      registrationStore.fetchRegistrations(tournamentId.value),
    ]);
  } catch (error) {
    console.error('Error loading initial dashboard stats:', error);
  } finally {
    statsLoaded.value = true;
  }

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

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

const { advanceState, getNextState, transitionTo } = useTournamentStateAdvance(tournamentId);

// Complete match dialog state
const showCompleteMatchDialog = ref(false);
const matchToComplete = ref<any>(null);

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
    notificationStore.showToast('error', 'Failed to update tournament status');
  }
}

// Complete Tournament confirmation
const showCompleteDialog = ref(false);

// Scoring QR dialog
const showScoringQrDialog = ref(false);
const showAnnouncementCardDialog = ref(false);

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

function handlePrint() {
  window.print();
}

function handleExport() {
  if (!tournament.value || matches.value.length === 0) {
    notificationStore.showToast('info', 'No matches available to export');
    return;
  }
  exportTournamentMatchesToCSV(
    tournament.value.name,
    matches.value,
    getCategoryName,
    getParticipantName,
    (d) => {
      if (!d) return '';
      return formatDate(typeof d === 'string' ? new Date(d) : d);
    }
  );
  notificationStore.showToast('success', 'Tournament data exported successfully');
}
</script>

<template>
  <v-container
    v-if="tournament"
    fluid
    class="dashboard-container bg-pattern"
  >
    <!-- Compact Header with Breadcrumbs Integrated -->
    <v-card
      flat
      class="mb-6 bg-transparent"
    >
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-4">
        <div class="flex-grow-1">
          <div class="d-flex align-center flex-wrap gap-4 mb-1">
            <v-btn
              icon
              variant="text"
              density="comfortable"
              class="mr-2"
              aria-label="Back to tournaments"
              @click="router.push('/tournaments')"
            >
              <v-icon
                icon="mdi-arrow-left"
                size="20"
              />
            </v-btn>
            <TournamentBrandMark
              :tournament-name="tournament.name"
              :logo-url="tournamentLogoUrl"
              :width="72"
              :height="72"
            />
            <div>
              <h1 class="text-h4 font-weight-bold text-gradient">
                {{ tournament.name }}
              </h1>
              <div class="d-flex align-center text-body-2 text-grey-darken-1 flex-wrap">
                <v-icon
                  icon="mdi-calendar"
                  size="16"
                  class="mr-2"
                />
                {{ formatDate(tournament.startDate) }}
                <span
                  v-if="tournament.location"
                  class="mx-2"
                >•</span>
                <v-icon
                  icon="mdi-map-marker"
                  size="16"
                  class="mr-2"
                />
                <span v-if="tournament.location">{{ tournament.location }}</span>
              </div>
            </div>
          </div>
          <div
            v-if="normalizedSponsors.length > 0"
            class="mt-4"
          >
            <TournamentSponsorStrip
              :sponsors="normalizedSponsors"
              dense
            />
          </div>
        </div>

        <div
          v-if="isAdmin"
          class="d-flex gap-2"
        >
          <v-btn
            variant="outlined"
            color="secondary"
            class="d-none d-sm-flex"
            @click="handlePrint"
          >
            <template #prepend>
              <v-icon
                icon="mdi-printer"
                size="18"
              />
            </template>
            Print Dashboard
          </v-btn>
          <v-btn
            variant="outlined"
            color="secondary"
            class="d-none d-sm-flex"
            @click="handleExport"
          >
            <template #prepend>
              <v-icon
                icon="mdi-download"
                size="18"
              />
            </template>
            Export (CSV)
          </v-btn>
          <v-btn
            variant="outlined"
            color="primary"
            :to="`/tournaments/${tournamentId}/settings`"
          >
            <template #prepend>
              <v-icon
                icon="mdi-cog"
                size="18"
              />
            </template>
            Settings
          </v-btn>
          <v-menu>
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                color="primary"
              >
                <template #append>
                  <v-icon
                    icon="mdi-chevron-down"
                    size="18"
                  />
                </template>
                Manage
              </v-btn>
            </template>
            <v-list
              density="compact"
              nav
            >
              <v-list-item
                v-if="tournament.status === 'draft'"
                title="Open Registration"
                @click="updateStatus('registration')"
              >
                <template #prepend>
                  <v-icon
                    icon="mdi-account-plus"
                    size="18"
                    class="mr-3 text-grey-darken-1"
                  />
                </template>
              </v-list-item>
              <v-list-item
                v-if="tournament.status === 'registration'"
                title="Start Tournament"
                @click="updateStatus('active')"
              >
                <template #prepend>
                  <v-icon
                    icon="mdi-play"
                    size="18"
                    class="mr-3 text-grey-darken-1"
                  />
                </template>
              </v-list-item>
              <v-list-item
                title="Generate Schedule"
                @click="generateSchedule"
              >
                <template #prepend>
                  <v-icon
                    icon="mdi-calendar-clock"
                    size="18"
                    class="mr-3 text-grey-darken-1"
                  />
                </template>
              </v-list-item>
              <v-list-item
                v-if="tournament.status === 'active'"
                title="Share Scoring Link"
                @click="showScoringQrDialog = true"
              >
                <template #prepend>
                  <v-icon
                    icon="mdi-qrcode"
                    size="18"
                    class="mr-3 text-grey-darken-1"
                  />
                </template>
              </v-list-item>
              <v-list-item
                title="Download Announcement Card"
                @click="showAnnouncementCardDialog = true"
              >
                <template #prepend>
                  <v-icon
                    icon="mdi-image-outline"
                    size="18"
                    class="mr-3 text-grey-darken-1"
                  />
                </template>
              </v-list-item>
              <v-list-item
                v-if="tournament.status === 'active'"
                title="Complete Tournament"
                @click="showCompleteDialog = true"
              >
                <template #prepend>
                  <v-icon
                    icon="mdi-check"
                    size="18"
                    class="mr-3 text-grey-darken-1"
                  />
                </template>
              </v-list-item>
              <v-divider class="my-1" />
              <v-list-item
                title="Delete Tournament"
                base-color="error"
                @click="showDeleteDialog = true"
              >
                <template #prepend>
                  <v-icon
                    icon="mdi-trash-can"
                    size="18"
                    class="mr-3 text-grey-darken-1"
                  />
                </template>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
      </div>
    </v-card>

    <!-- Unified Status + Actions Card -->
    <v-card
      v-if="isAdmin"
      elevation="0"
      class="mb-6 unified-status-card gradient-accent"
      :class="`status-${tournament.status}`"
    >
      <v-card-text class="d-flex flex-column flex-sm-row align-center justify-space-between pa-4 gap-4">
        <!-- Left: Status identity -->
        <div class="d-flex align-center">
          <v-avatar
            :color="tournament.status === 'active' ? 'success' : tournament.status === 'completed' ? 'secondary' : 'primary'"
            variant="tonal"
            class="mr-4 flex-shrink-0"
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

        <!-- Right: Actions -->
        <div class="d-flex flex-column flex-sm-row gap-2 flex-shrink-0">
          <!-- Primary CTA: Enter Match Control (active tournaments) -->
          <v-btn
            v-if="tournament.status === 'active'"
            variant="flat"
            color="success"
            :to="`/tournaments/${tournamentId}/match-control`"
          >
            <template #prepend>
              <v-icon
                icon="mdi-play-circle"
                size="18"
              />
            </template>
            Enter Match Control
          </v-btn>
          <!-- Other status CTAs -->
          <v-btn
            v-if="tournament.status === 'draft'"
            variant="flat"
            color="primary"
            :to="`/tournaments/${tournamentId}/categories`"
          >
            <template #prepend>
              <v-icon
                icon="mdi-source-fork"
                size="18"
              />
            </template>
            Setup Categories
          </v-btn>
          <v-btn
            v-if="tournament.status === 'registration'"
            variant="flat"
            color="primary"
            :to="`/tournaments/${tournamentId}/registrations`"
          >
            <template #prepend>
              <v-icon
                icon="mdi-account-check"
                size="18"
              />
            </template>
            Review Registrations
          </v-btn>
          <v-btn
            v-if="tournament.status === 'completed'"
            variant="flat"
            color="primary"
            :to="`/tournaments/${tournamentId}/brackets`"
          >
            <template #prepend>
              <v-icon
                icon="mdi-medal"
                size="18"
              />
            </template>
            View Results
          </v-btn>
          <!-- Advance state (secondary) -->
          <v-btn
            v-if="isAdmin && getNextState(tournament.state)"
            variant="outlined"
            color="primary"
            size="small"
            @click="advanceState"
          >
            <template #prepend>
              <v-icon
                icon="mdi-arrow-right-circle"
                size="18"
              />
            </template>
            {{ getNextState(tournament.state) }}
          </v-btn>
          <!-- Revert to Live -->
          <v-btn
            v-if="isAdmin && tournament.state === 'COMPLETED'"
            variant="outlined"
            color="warning"
            size="small"
            @click="transitionTo('LIVE')"
          >
            <template #prepend>
              <v-icon
                icon="mdi-arrow-right-circle"
                size="18"
                style="transform: rotate(180deg);"
              />
            </template>
            Revert to Live
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- Stats Grid -->
    <v-row
      v-if="!statsLoaded"
      class="mb-6"
    >
      <v-col
        v-for="n in 4"
        :key="`stats-skeleton-${n}`"
        cols="12"
        sm="6"
        md="3"
      >
        <v-skeleton-loader
          type="article"
          class="rounded-lg"
        />
      </v-col>
    </v-row>
    <v-row
      v-else
      class="mb-6"
    >
      <v-col
        cols="12"
        sm="6"
        md="3"
      >
        <v-card
          class="stat-card gradient-accent"
          elevation="0"
        >
          <div class="stat-icon-wrapper bg-primary-subtle">
            <v-icon
              icon="mdi-account-group"
              size="24"
            />
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
          class="stat-card gradient-accent"
          elevation="0"
        >
          <div class="stat-icon-wrapper bg-info-subtle">
            <v-icon
              icon="mdi-source-fork"
              size="24"
            />
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
          class="stat-card gradient-accent"
          elevation="0"
        >
          <div class="stat-icon-wrapper bg-warning-subtle">
            <v-icon
              icon="mdi-bullhorn"
              size="24"
            />
          </div>
          <div class="stat-content">
            <span class="text-h4 font-weight-bold d-block">
              {{ stats.inProgressMatches }}<span class="text-body-2 text-grey font-weight-regular">/{{ stats.totalMatches }}</span>
            </span>
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
          class="stat-card gradient-accent"
          elevation="0"
        >
          <div class="stat-icon-wrapper bg-success-subtle">
            <v-icon
              icon="mdi-check-all"
              size="24"
            />
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

    <!-- Tournament Info Strip -->
    <div class="d-flex flex-wrap gap-6 px-3 py-2 mb-6 bg-surface rounded border info-strip">
      <div class="info-strip-item">
        <span class="text-caption text-grey text-uppercase">Sport</span>
        <span class="text-body-2 font-weight-medium d-block">{{ tournament.sport }}</span>
      </div>
      <div class="info-strip-item">
        <span class="text-caption text-grey text-uppercase">Categories</span>
        <span class="text-body-2 font-weight-medium d-block">{{ categories.length }}</span>
      </div>
      <div class="info-strip-item">
        <span class="text-caption text-grey text-uppercase">Courts</span>
        <span class="text-body-2 font-weight-medium d-block">{{ courts.length }}</span>
      </div>
      <div class="info-strip-item">
        <span class="text-caption text-grey text-uppercase">Match Duration</span>
        <span class="text-body-2 font-weight-medium d-block">{{ tournament.settings?.matchDurationMinutes || 30 }} min</span>
      </div>
      <div class="info-strip-item">
        <span class="text-caption text-grey text-uppercase">Rest Time</span>
        <span class="text-body-2 font-weight-medium d-block">{{ tournament.settings?.minRestTimeMinutes || 15 }} min</span>
      </div>
      <div
        v-if="tournament.location"
        class="info-strip-item"
      >
        <span class="text-caption text-grey text-uppercase">Location</span>
        <span class="text-body-2 font-weight-medium d-block">{{ tournament.location }}</span>
      </div>
    </div>

    <!-- Live + Upcoming Match Context -->
    <div class="mb-6">
      <div class="d-flex align-center mb-4">
        <h2 class="text-h5 font-weight-bold text-gradient-primary">
          <v-icon
            icon="mdi-bullhorn"
            size="20"
            class="mr-2"
          />
          Live and Upcoming Matches
        </h2>
      </div>

      <v-row class="cm-balanced-panels">
        <v-col
          cols="12"
          lg="7"
          class="cm-balanced-panels__col"
        >
          <ActiveMatchesSection
            class="cm-balanced-panels__pane"
            :matches="enrichedActiveMatches"
            :show-actions="false"
          />
        </v-col>
        <v-col
          cols="12"
          lg="5"
          class="cm-balanced-panels__col"
        >
          <ReadyQueue
            class="cm-balanced-panels__pane"
            :matches="queueMatches"
            :categories="categories"
            :get-participant-name="getParticipantName"
            :get-category-name="getCategoryName"
            :enable-assign="false"
            @select="handleQueueSelect"
          />
        </v-col>
      </v-row>

      <v-card
        class="mt-4"
        variant="outlined"
      >
        <v-card-title class="d-flex align-center justify-space-between">
          <span>Remaining Matches by Category</span>
          <v-chip
            size="small"
            color="primary"
            variant="tonal"
          >
            {{ totalRemainingMatches }} open
          </v-chip>
        </v-card-title>
        <v-divider />
        <v-table density="compact">
          <thead>
            <tr>
              <th class="text-left">
                Category
              </th>
              <th class="text-center">
                Stage
              </th>
              <th class="text-center">
                Remaining
              </th>
              <th class="text-left">
                Next Match
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in categoryStageStatuses"
              :key="item.categoryId"
            >
              <td class="font-weight-medium">
                {{ item.categoryName }}
              </td>
              <td class="text-center">
                <v-chip
                  size="x-small"
                  color="primary"
                  variant="tonal"
                >
                  {{ item.stageLabel }}
                </v-chip>
              </td>
              <td class="text-center">
                {{ item.remaining }} / {{ item.total }}
              </td>
              <td class="text-left text-body-2">
                {{ item.nextMatchLabel }}
              </td>
            </tr>
            <tr v-if="categoryStageStatuses.length === 0">
              <td
                colspan="4"
                class="text-center text-medium-emphasis py-4"
              >
                No category match data available yet
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card>
    </div>

    <!-- Event Insights -->
    <div
      v-if="stats.completedMatches > 0"
      class="mt-6 mb-2"
    >
      <div class="d-flex align-center mb-3">
        <v-icon
          size="18"
          color="secondary"
          class="mr-2"
        >
          mdi-chart-bar
        </v-icon>
        <span class="text-subtitle-2 font-weight-bold text-uppercase text-medium-emphasis">Event Insights</span>
      </div>
      <match-stats-dashboard
        :matches="matches"
        :courts="courts"
      />
    </div>

    <!-- Organizer Checklist -->
    <v-row class="mt-6 mb-4">
      <v-col cols="12">
        <organizer-checklist :tournament-id="tournamentId" />
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

  <!-- Complete Tournament Confirmation Dialog -->
  <v-dialog
    v-model="showCompleteDialog"
    max-width="480"
    persistent
  >
    <v-card>
      <v-card-title class="d-flex align-center pa-4 pb-2">
        <v-icon
          start
          icon="mdi-trophy"
          color="success"
        />
        Complete Tournament?
      </v-card-title>
      <v-card-text>
        <p class="mb-3">
          You're about to mark <strong>{{ tournament?.name }}</strong> as completed.
        </p>
        <v-alert
          type="warning"
          variant="tonal"
          density="compact"
        >
          This will close all active scoring. This action cannot be undone.
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="showCompleteDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="success"
          variant="elevated"
          @click="updateStatus('completed'); showCompleteDialog = false"
        >
          Complete Tournament
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
        Are you sure you want to delete <strong>{{ tournament?.name }}</strong>? This action cannot be undone and will remove all matches, scores, and participant data.
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

  <!-- Scoring QR Code Dialog -->
  <ScoringQrDialog
    v-model="showScoringQrDialog"
    :tournament-id="tournamentId"
    @copied="notificationStore.showToast('success', 'Scoring link copied!')"
  />

  <TournamentAnnouncementCardDialog
    v-model="showAnnouncementCardDialog"
    :tournament-name="tournament?.name || 'Tournament'"
    :tournament-date="tournament?.startDate || null"
    :tournament-location="tournament?.location || null"
    :logo-url="tournamentLogoUrl"
    @downloaded="notificationStore.showToast('success', 'Announcement card downloaded')"
  />
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.text-gradient {
  color: $primary-base;
  background: linear-gradient(135deg, $primary-base, $secondary-base);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-family: $font-family-display;
  font-weight: 700;
}

.unified-status-card {
  border-left: 4px solid rgba($primary-base, 0.4) !important;
  border-top: 1px solid rgba($primary-base, 0.08) !important;
  border-right: 1px solid rgba($primary-base, 0.08) !important;
  border-bottom: 1px solid rgba($primary-base, 0.08) !important;

  &.status-active {
    border-left-color: rgba($success, 0.6) !important;
  }

  &.status-registration {
    border-left-color: rgba($primary-base, 0.5) !important;
  }

  &.status-completed {
    border-left-color: rgba($secondary-base, 0.5) !important;
  }
}

.info-strip {
  .info-strip-item {
    min-width: 80px;
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
  color: $text-primary;

  .text-h4 {
    font-variant-numeric: tabular-nums;
  }
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


// Enhanced animations for dashboard elements
.dashboard-container {
  .v-col {
    animation: slideUp 0.5s ease-out forwards;
    opacity: 0;
    animation-delay: calc(var(--item-index) * 0.1s);
  }
}

// Staggered card animations
.stat-card {
  animation: slideUp 0.6s ease-out forwards;
  opacity: 0;
  animation-fill-mode: both;
}

// Hover animation for interactive elements
.v-btn, .v-card, .stat-card {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;

  &:hover {
    transform: translateY(-3px);
    box-shadow: $shadow-lg !important;
  }
}
// Background utility classes
.bg-primary-subtle { background-color: rgba($primary-base, 0.1) !important; }
.bg-info-subtle { background-color: rgba($info, 0.1) !important; }
.bg-success-subtle { background-color: rgba($success, 0.1) !important; }
.bg-warning-subtle { background-color: rgba($warning, 0.1) !important; }
</style>
