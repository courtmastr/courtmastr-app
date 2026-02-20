<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import { 
  ArrowLeft, Calendar, MapPin, Settings as SettingsIcon, ChevronDown, 
  UserPlus, Play, CalendarClock, Check, Trash2,
  Zap, Users, Trophy, ClipboardEdit, Lock, Unlock,
  PlayCircle, Medal, ArrowRightCircle, Megaphone, CheckCheck,
  UserCheck, AlertTriangle, Info, GitFork
} from 'lucide-vue-next';
import { useCategoryStageStatus } from '@/composables/useCategoryStageStatus';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { getNextTournamentState, type TournamentLifecycleState } from '@/guards/tournamentState';
import OrganizerChecklist from '../components/OrganizerChecklist.vue';
import ActiveMatchesSection from '../components/ActiveMatchesSection.vue';
import ReadyQueue from '../components/ReadyQueue.vue';

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

const selectedCategory = ref<string | null>(null);

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
  }
}

// Complete Tournament confirmation
const showCompleteDialog = ref(false);

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
            <v-btn icon variant="text" density="comfortable" class="mr-2" @click="router.push('/tournaments')"><ArrowLeft :size="20" /></v-btn>
            <h1 class="text-h4 font-weight-bold text-gradient">
              {{ tournament.name }}
            </h1>
          </div>
          <div class="d-flex align-center text-body-2 text-grey-darken-1 ml-10">
            <Calendar :size="16" class="mr-2" />
            {{ formatDate(tournament.startDate) }}
            <span
              v-if="tournament.location"
              class="mx-2"
            >•</span>
            <MapPin :size="16" class="mr-2" />
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
            >
            <template #prepend><SettingsIcon :size="18" /></template
            :to="`/tournaments/${tournamentId}/settings`"
          >
            Settings
          </v-btn>
          <v-menu>
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                color="primary"
                >
                Manage
                <template #append><ChevronDown :size="18" /></template>
              </v-btn
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
                >
                <template #prepend><UserPlus :size="18" class="mr-3 text-grey-darken-1" /></template>
              </v-list-item
                title="Open Registration"
                @click="updateStatus('registration')"
              />
              <v-list-item
                v-if="tournament.status === 'registration'"
                >
                <template #prepend><Play :size="18" class="mr-3 text-grey-darken-1" /></template>
              </v-list-item
                title="Start Tournament"
                @click="updateStatus('active')"
              />
              <v-list-item
                >
                <template #prepend><CalendarClock :size="18" class="mr-3 text-grey-darken-1" /></template>
              </v-list-item
                title="Generate Schedule"
                @click="generateSchedule"
              />
              <v-list-item
                v-if="tournament.status === 'active'"
                >
                <template #prepend><Check :size="18" class="mr-3 text-grey-darken-1" /></template>
              </v-list-item
                title="Complete Tournament"
                @click="showCompleteDialog = true"
              />
              <v-divider class="my-1" />
              <v-list-item
                >
                <template #prepend><Trash2 :size="18" class="mr-3 text-grey-darken-1" /></template>
              </v-list-item
                title="Delete Tournament"
                base-color="error"
                @click="showDeleteDialog = true"
              />
            </v-list>
          </v-menu>
        </div>
      </div>
    </v-card>

    <!-- Unified Status + Actions Card -->
    <v-card
      v-if="isAdmin"
      elevation="0"
      class="mb-6 unified-status-card"
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
            <!-- Lock-state chips (condensed from StateBanner) -->
            <div
              v-if="tournament.state"
              class="d-flex flex-wrap gap-1 mt-2"
            >
              <v-chip
                size="x-small"
                :color="['SEEDING','BRACKET_GENERATED','BRACKET_LOCKED','LIVE','COMPLETED'].includes(tournament.state) ? 'success' : 'grey'"
                variant="tonal"
              >
                <v-icon
                  start
                  size="10"
                >
                  {{ ['SEEDING','BRACKET_GENERATED','BRACKET_LOCKED','LIVE','COMPLETED'].includes(tournament.state) ? 'mdi-lock' : 'mdi-lock-open' }}
                </v-icon>
                Roster
              </v-chip>
              <v-chip
                size="x-small"
                :color="['BRACKET_LOCKED','LIVE','COMPLETED'].includes(tournament.state) ? 'success' : 'grey'"
                variant="tonal"
              >
                <v-icon
                  start
                  size="10"
                >
                  {{ ['BRACKET_LOCKED','LIVE','COMPLETED'].includes(tournament.state) ? 'mdi-lock' : 'mdi-lock-open' }}
                </v-icon>
                Bracket
              </v-chip>
              <v-chip
                size="x-small"
                :color="['LIVE','COMPLETED'].includes(tournament.state) ? 'success' : 'grey'"
                variant="tonal"
              >
                <v-icon
                  start
                  size="10"
                >
                  {{ ['LIVE','COMPLETED'].includes(tournament.state) ? 'mdi-lock' : 'mdi-lock-open' }}
                </v-icon>
                Scoring
              </v-chip>
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
            >
            <template #prepend><PlayCircle :size="18" /></template
            :to="`/tournaments/${tournamentId}/match-control`"
          >
            Enter Match Control
          </v-btn>
          <!-- Other status CTAs -->
          <v-btn
            v-if="tournament.status === 'draft'"
            variant="flat"
            color="primary"
            >
            <template #prepend><GitFork :size="18" /></template
            :to="`/tournaments/${tournamentId}/categories`"
          >
            Setup Categories
          </v-btn>
          <v-btn
            v-if="tournament.status === 'registration'"
            variant="flat"
            color="primary"
            >
            <template #prepend><UserCheck :size="18" /></template
            :to="`/tournaments/${tournamentId}/registrations`"
          >
            Review Registrations
          </v-btn>
          <v-btn
            v-if="tournament.status === 'completed'"
            variant="flat"
            color="primary"
            >
            <template #prepend><Medal :size="18" /></template
            :to="`/tournaments/${tournamentId}/brackets`"
          >
            View Results
          </v-btn>
          <!-- Advance state (secondary) -->
          <v-btn
            v-if="isAdmin && getNextState(tournament.state)"
            variant="outlined"
            color="primary"
            size="small"
            >
            <template #prepend><ArrowRightCircle :size="18" /></template
            @click="advanceState"
          >
            {{ getNextState(tournament.state) }}
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

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
            <Users :size="24" />
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
            <GitFork :size="24" />
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
            <Megaphone :size="24" />
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
          class="stat-card"
          elevation="0"
        >
          <div class="stat-icon-wrapper bg-success-subtle">
            <CheckCheck :size="24" />
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
          <Megaphone :size="20" class="mr-2" />
          Live and Upcoming Matches
        </h2>
      </div>

      <v-row>
        <v-col
          cols="12"
          lg="7"
        >
          <ActiveMatchesSection
            :matches="enrichedActiveMatches"
            :show-actions="false"
          />
        </v-col>
        <v-col
          cols="12"
          lg="5"
        >
          <ReadyQueue
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
          >
                <template #prepend><Check :size="18" class="mr-3 text-grey-darken-1" /></template>
              </v-list-item
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
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.text-gradient {
  color: $primary-base;
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
