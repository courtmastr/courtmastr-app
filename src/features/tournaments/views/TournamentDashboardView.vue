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
import { exportTournamentMatchesToCSV } from '../utils/export';
import OrganizerChecklist from '../components/OrganizerChecklist.vue';
import ActiveMatchesSection from '../components/ActiveMatchesSection.vue';
import ReadyQueue from '../components/ReadyQueue.vue';
import ScoringQrDialog from '../components/ScoringQrDialog.vue';
import TournamentAnnouncementCardDialog from '../components/TournamentAnnouncementCardDialog.vue';
import CategoryProgressPanel from '../components/CategoryProgressPanel.vue';

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
const isOrganizer = computed(() => authStore.isOrganizer);
// Both admins and organizers need Manage controls for their own tournaments.
const showManageControls = computed(() => isAdmin.value || isOrganizer.value);
const { tournamentLogoUrl } = useTournamentBranding(tournament);

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

const queueMatchesTop3 = computed(() => queueMatches.value.slice(0, 3));

const statusLabel = computed(() => {
  switch (tournament.value?.status) {
    case 'active': return 'In Progress';
    case 'registration': return 'Registration Open';
    case 'completed': return 'Tournament Completed';
    default: return 'Draft Mode — Configure categories and courts';
  }
});

const ctaRoute = computed(() => {
  const tid = tournamentId.value;
  switch (tournament.value?.status) {
    case 'active': return `/tournaments/${tid}/match-control`;
    case 'registration': return `/tournaments/${tid}/registrations`;
    case 'completed': return `/tournaments/${tid}/brackets`;
    default: return `/tournaments/${tid}/categories`;
  }
});

const ctaLabel = computed(() => {
  switch (tournament.value?.status) {
    case 'active': return 'Enter Match Control';
    case 'registration': return 'Review Registrations';
    case 'completed': return 'View Results';
    default: return 'Setup Categories';
  }
});

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

function handleEnterScore(matchId: string): void {
  const match = matches.value.find((m) => m.id === matchId);
  router.push({
    path: `/tournaments/${tournamentId.value}/matches/${matchId}/score`,
    query: match ? { category: match.categoryId } : undefined,
  });
}

function handleCompleteMatch(matchId: string): void {
  matchToComplete.value = matches.value.find((m) => m.id === matchId) ?? null;
  showCompleteMatchDialog.value = true;
}

function handleQueueSelect(ref: { matchId: string; categoryId: string }): void {
  router.push({
    path: `/tournaments/${tournamentId.value}/matches/${ref.matchId}/score`,
    query: { category: ref.categoryId },
  });
}

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);

  // Organizers may only access tournaments they are assigned to.
  // Admins always have full access — only enforce for pure 'organizer' role (never 'admin').
  if (authStore.currentUser?.role === 'organizer') {
    const t = tournamentStore.currentTournament;
    const uid = authStore.currentUser.id;
    const activeOrgId = authStore.currentUser.activeOrgId;
    const ids = t?.organizerIds ?? [];
    
    // Organizers can access tournaments they created, are explicitly assigned to,
    // or that belong to their currently active organization.
    if (t && !ids.includes(uid) && t.createdBy !== uid && t.orgId !== activeOrgId) {
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
  <!-- ── Main content ── -->
  <v-container
    v-if="tournament"
    fluid
    class="event-center-container pa-0"
  >
    <!-- Header band -->
    <div class="ec-header">
      <div class="ec-header__left">
        <div class="ec-tournament-name">{{ tournament.name }}</div>
        <div class="ec-tournament-meta">
          <span v-if="tournament.startDate">{{ formatDate(tournament.startDate) }}</span>
          <template v-if="tournament.location">
            <span class="ec-meta-sep">·</span>
            <span>{{ tournament.location }}</span>
          </template>
          <template v-if="tournament.sport">
            <span class="ec-meta-sep">·</span>
            <span>{{ tournament.sport }}</span>
          </template>
        </div>
      </div>
      <div class="ec-header__right">
        <div
          v-if="tournament.status === 'active'"
          class="ec-live-badge"
        >
          <span class="ec-live-dot" />
          <span class="ec-live-text">LIVE</span>
        </div>
        <v-menu v-if="showManageControls">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              variant="outlined"
              size="small"
              density="comfortable"
            >
              Manage
              <v-icon
                icon="mdi-chevron-down"
                size="16"
                end
              />
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
              title="Print Dashboard"
              @click="handlePrint"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-printer"
                  size="18"
                  class="mr-3 text-grey-darken-1"
                />
              </template>
            </v-list-item>
            <v-list-item
              title="Export (CSV)"
              @click="handleExport"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-download"
                  size="18"
                  class="mr-3 text-grey-darken-1"
                />
              </template>
            </v-list-item>
            <v-list-item
              :to="`/tournaments/${tournamentId}/settings`"
              title="Settings"
            >
              <template #prepend>
                <v-icon
                  icon="mdi-cog"
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

    <!-- Stats row -->
    <div class="ec-stats">
      <template v-if="!statsLoaded">
        <div
          v-for="n in 4"
          :key="`sk-${n}`"
          class="ec-stat"
        >
          <v-skeleton-loader
            type="heading"
            width="60"
          />
        </div>
      </template>
      <template v-else>
        <div class="ec-stat">
          <div class="ec-stat__number">{{ stats.approvedRegistrations }}</div>
          <div class="ec-stat__label">Players</div>
        </div>
        <div class="ec-stat ec-stat--orange">
          <div class="ec-stat__number">{{ stats.inProgressMatches }}</div>
          <div class="ec-stat__label">Live Now</div>
        </div>
        <div class="ec-stat ec-stat--green">
          <div class="ec-stat__number">
            {{ stats.progress }}<span class="ec-stat__unit">%</span>
          </div>
          <div class="ec-stat__label">Complete</div>
        </div>
        <div class="ec-stat ec-stat--purple">
          <div class="ec-stat__number">{{ queueMatches.length }}</div>
          <div class="ec-stat__label">In Queue</div>
        </div>
      </template>
    </div>

    <!-- Status + CTA bar -->
    <div class="ec-status-bar">
      <div>
        <div class="ec-status-bar__eyebrow">Tournament Status</div>
        <div class="ec-status-bar__text">
          <span
            class="ec-status-dot"
            :class="`ec-status-dot--${tournament.status}`"
          />
          {{ statusLabel }}
        </div>
      </div>
      <v-btn
        color="primary"
        :to="ctaRoute"
        class="ec-cta-btn"
        elevation="4"
      >
        {{ ctaLabel }}
      </v-btn>
    </div>

    <!-- Quick links (active only) -->
    <div
      v-if="tournament.status === 'active'"
      class="ec-quick-links"
    >
      <v-btn
        variant="outlined"
        size="small"
        class="ec-quick-link"
        :to="`/tournaments/${tournamentId}/checkin`"
      >
        Check-in
      </v-btn>
      <v-btn
        variant="outlined"
        size="small"
        class="ec-quick-link"
        :to="`/tournaments/${tournamentId}/brackets`"
      >
        Brackets
      </v-btn>
      <v-btn
        variant="outlined"
        size="small"
        class="ec-quick-link"
        :to="`/tournaments/${tournamentId}/live-view`"
      >
        Live View
      </v-btn>
      <v-btn
        variant="outlined"
        size="small"
        class="ec-quick-link"
        :to="`/tournaments/${tournamentId}/leaderboard`"
      >
        Leaderboard
      </v-btn>
      <v-btn
        variant="outlined"
        size="small"
        class="ec-quick-link"
        :to="`/tournaments/${tournamentId}/score`"
      >
        Share Links
      </v-btn>
    </div>

    <!-- Operations — 2-col (active only) -->
    <div
      v-if="tournament.status === 'active'"
      class="ec-operations"
    >
      <!-- Left 3fr: Active Matches -->
      <div class="ec-operations__left">
        <ActiveMatchesSection
          :matches="enrichedActiveMatches"
          :show-actions="true"
          @enter-score="handleEnterScore"
          @complete-match="handleCompleteMatch"
        />
      </div>

      <!-- Right 2fr: Queue + Category Progress -->
      <div class="ec-operations__right">
        <ReadyQueue
          :matches="queueMatchesTop3"
          :categories="categories"
          :get-participant-name="getParticipantName"
          :get-category-name="getCategoryName"
          :enable-assign="false"
          @select="handleQueueSelect"
        />
        <div
          v-if="queueMatches.length > 3"
          class="ec-queue-more"
        >
          <span class="text-body-2 text-medium-emphasis">
            {{ queueMatches.length - 3 }} more waiting
          </span>
          <v-btn
            variant="text"
            size="small"
            color="primary"
            :to="`/tournaments/${tournamentId}/match-control`"
          >
            View all →
          </v-btn>
        </div>
        <CategoryProgressPanel
          :statuses="categoryStageStatuses"
          class="mt-3"
        />
      </div>
    </div>

    <!-- Pre-event: Organizer checklist (draft / registration) -->
    <div
      v-if="['draft', 'registration'].includes(tournament.status)"
      class="pa-5"
    >
      <organizer-checklist :tournament-id="tournamentId" />
    </div>

    <!-- Schedule Result Alert -->
    <v-alert
      v-if="scheduleResult && scheduleResult.unscheduled > 0"
      type="warning"
      variant="tonal"
      closable
      class="ma-4"
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

// ── Outer container ──────────────────────────────────────────────
.event-center-container {
  background: #f1f5f9;
  min-height: 100%;
}

// ── Header band ──────────────────────────────────────────────────
.ec-header {
  background: #fff;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.ec-header__left {
  min-width: 0;
}

.ec-tournament-name {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ec-tournament-meta {
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
}

.ec-meta-sep {
  margin: 0 6px;
}

.ec-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

// LIVE badge
.ec-live-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  background: #dcfce7;
  border: 1px solid #86efac;
  padding: 5px 12px;
  border-radius: 20px;
}

.ec-live-dot {
  width: 7px;
  height: 7px;
  background: #16a34a;
  border-radius: 50%;
  display: inline-block;
  animation: ec-pulse 1.5s ease-in-out infinite;
}

.ec-live-text {
  font-size: 11px;
  font-weight: 700;
  color: #15803d;
  letter-spacing: 0.5px;
}

@keyframes ec-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

// ── Stats row ─────────────────────────────────────────────────────
.ec-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.ec-stat {
  padding: 14px 18px;
  border-right: 1px solid #e2e8f0;

  &:last-child {
    border-right: none;
  }

  &--orange {
    background: #fff7ed;
  }

  &--green {
    background: #f0fdf4;
  }

  &--purple {
    background: #f5f3ff;
  }
}

.ec-stat__number {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
  color: #0f172a;
  font-variant-numeric: tabular-nums;

  .ec-stat--orange & {
    color: #ea580c;
  }

  .ec-stat--green & {
    color: #16a34a;
  }

  .ec-stat--purple & {
    color: #7c3aed;
  }
}

.ec-stat__unit {
  font-size: 18px;
}

.ec-stat__label {
  font-size: 10px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-top: 4px;
}

// ── Status + CTA bar ──────────────────────────────────────────────
.ec-status-bar {
  background: #fff;
  padding: 14px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ec-status-bar__eyebrow {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 5px;
}

.ec-status-bar__text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.ec-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #64748b;

  &--active {
    background: #f97316;
  }

  &--registration {
    background: #1d4ed8;
  }

  &--completed {
    background: #16a34a;
  }
}

.ec-cta-btn {
  box-shadow: 0 4px 14px rgba(29, 78, 216, 0.3) !important;
  flex-shrink: 0;
}

// ── Quick links ───────────────────────────────────────────────────
.ec-quick-links {
  background: #fff;
  padding: 10px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ec-quick-link {
  font-size: 12px !important;
  font-weight: 600 !important;
  color: #475569 !important;
  border-color: #e2e8f0 !important;
  background: #f8fafc !important;

  &:hover {
    border-color: #cbd5e1 !important;
    color: #1d4ed8 !important;
    background: #f1f5f9 !important;
  }
}

// ── Operations 2-col ──────────────────────────────────────────────
.ec-operations {
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 16px;
  padding: 16px 20px;
  background: #f8fafc;
  align-items: start;
}

.ec-operations__right {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.ec-queue-more {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 4px 0;
}

</style>
