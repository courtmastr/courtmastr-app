<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useNotificationStore } from '@/stores/notifications';
import { useActivityStore } from '@/stores/activities';
import { useAuthStore } from '@/stores/auth';
import { useMatchScheduler } from '@/composables/useMatchScheduler';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import { useCategoryStageStatus } from '@/composables/useCategoryStageStatus';
import { useDialogManager } from '@/composables/useDialogManager';
import AssignCourtDialog from '@/features/tournaments/dialogs/AssignCourtDialog.vue';
import ScheduleMatchDialog from '@/features/tournaments/dialogs/ScheduleMatchDialog.vue';
import ManualScoreDialog from '@/features/tournaments/dialogs/ManualScoreDialog.vue';
import AutoScheduleDialog from '@/features/tournaments/dialogs/AutoScheduleDialog.vue';
import BaseDialog from '@/components/common/BaseDialog.vue';
import ActivityFeed from '@/components/ActivityFeed.vue';
import FilterBar from '@/components/common/FilterBar.vue';
import MatchQueueList from '@/features/tournaments/components/MatchQueueList.vue';
import QuickActionsBar from '@/features/tournaments/components/QuickActionsBar.vue';
import ActiveMatchesSection from '@/features/tournaments/components/ActiveMatchesSection.vue';
// TOURNEY-101: Command Center components
import CourtGrid from '@/features/tournaments/components/CourtGrid.vue';
import ReadyQueue from '@/features/tournaments/components/ReadyQueue.vue';
import AlertsPanel from '@/features/tournaments/components/AlertsPanel.vue';
import RunningStatusBoard from '@/features/tournaments/components/RunningStatusBoard.vue';
import { getNextTournamentState, type TournamentLifecycleState } from '@/guards/tournamentState';
import type { Match, Court } from '@/types';
import StateBanner from '@/features/tournaments/components/StateBanner.vue';
import type { ScheduleResult } from '@/composables/useMatchScheduler';

// Configuration for auto-ready
const AUTO_READY_MINUTES_BEFORE = 5; // Mark matches as ready X minutes before scheduled time

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const notificationStore = useNotificationStore();
const activityStore = useActivityStore();
const authStore = useAuthStore();
const scheduler = useMatchScheduler();
const { getParticipantName } = useParticipantResolver();
const { getMatchDisplayName } = useMatchDisplay();
const { open: openDialog, close: closeDialog, isOpen: isDialogOpen } = useDialogManager([
  'assignCourt', 'schedule', 'score', 'autoSchedule', 'release', 'reset', 'share'
]);

const isAdmin = computed(() => authStore.isAdmin);
const showUnlockDialog = ref(false);


const tournamentId = computed(() => route.params.tournamentId as string);

// Auto-schedule result for displaying errors
const autoScheduleResult = ref<ScheduleResult | null>(null);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const courts = computed(() => tournamentStore.courts);
const matches = computed(() => matchStore.matches);

// Load data
async function loadData() {
  if (!tournamentId.value) return;
  try {
    await Promise.all([
      tournamentStore.fetchTournament(tournamentId.value),
      matchStore.fetchMatches(tournamentId.value)
    ]);
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

onMounted(() => {
  loadData();
  // Start auto-ready interval
  autoReadyInterval = setInterval(checkAndMarkDueMatches, 60 * 1000);
});

onUnmounted(() => {
  if (autoReadyInterval) clearInterval(autoReadyInterval);
});

// Filter state
const selectedCategory = ref<string>('all');
const viewMode = ref<'queue' | 'courts' | 'schedule' | 'command'>('command');

interface QueueMatchRef {
  matchId: string;
  categoryId: string;
  levelId?: string;
}

// Schedule view filter state
const scheduleFilters = ref({
  status: 'all' as 'all' | 'scheduled' | 'ready' | 'in_progress' | 'completed' | 'cancelled',
  courtId: 'all' as string,
  searchQuery: '',
  sortBy: 'round' as string,
  sortDesc: false,
});

// TOURNEY-104: Compact table view mode
const scheduleViewMode = ref<'compact' | 'full'>('compact');

// Quick filter presets
const quickFilters = [
  { label: 'All', value: 'all', color: 'default' },
  { label: 'Pending', value: 'scheduled', color: 'grey' },
  { label: 'Ready', value: 'ready', color: 'warning' },
  { label: 'In Progress', value: 'in_progress', color: 'info' },
  { label: 'Completed', value: 'completed', color: 'success' },
];

// Category options for dropdown
const categoryOptions = computed(() => [
  { name: 'All Categories', id: 'all' },
  ...categories.value,
]);

const { categoryStageStatuses } = useCategoryStageStatus(
  categories,
  matches,
  getParticipantName
);

const filteredCategoryStageStatuses = computed(() => {
  if (selectedCategory.value === 'all') {
    return categoryStageStatuses.value;
  }
  return categoryStageStatuses.value.filter((status) => status.categoryId === selectedCategory.value);
});

// Dialog state
const selectedMatch = ref<Match | null>(null);
const selectedCourtId = ref<string | null>(null);
const showAssignCourtDialog = computed<boolean>({
  get: () => isDialogOpen('assignCourt'),
  set: (value) => {
    if (value) openDialog('assignCourt');
    else closeDialog('assignCourt');
  },
});
const showScheduleDialog = computed<boolean>({
  get: () => isDialogOpen('schedule'),
  set: (value) => {
    if (value) openDialog('schedule');
    else closeDialog('schedule');
  },
});
const showManualScoreDialog = computed<boolean>({
  get: () => isDialogOpen('score'),
  set: (value) => {
    if (value) openDialog('score');
    else closeDialog('score');
  },
});
const showAutoScheduleDialog = computed<boolean>({
  get: () => isDialogOpen('autoSchedule'),
  set: (value) => {
    if (value) openDialog('autoSchedule');
    else closeDialog('autoSchedule');
  },
});
const showReleaseDialog = computed<boolean>({
  get: () => isDialogOpen('release'),
  set: (value) => {
    if (value) openDialog('release');
    else closeDialog('release');
  },
});
const showResetDialog = computed<boolean>({
  get: () => isDialogOpen('reset'),
  set: (value) => {
    if (value) openDialog('reset');
    else closeDialog('reset');
  },
});

// Auto-schedule state
const autoScheduleConfig = ref({
  startTime: '',
  matchDurationMinutes: 20,
  breakBetweenMatches: 5,
});
const selectedCategoryIds = ref<string[]>([]); // Multi-select categories for auto-schedule

// Select/deselect all categories
function selectAllCategories() {
  selectedCategoryIds.value = categories.value.map(c => c.id);
}

function deselectAllCategories() {
  selectedCategoryIds.value = [];
}

// Open auto-schedule dialog with all categories pre-selected
function openAutoScheduleDialog() {
  // Auto-select all categories for better UX
  if (categories.value.length > 0) {
    selectedCategoryIds.value = categories.value.map(c => c.id);
  }
  openDialog('autoSchedule');
}

// Reset selected categories when dialog closes
watch(() => isDialogOpen('autoSchedule'), (newValue) => {
  if (!newValue) {
    // Dialog closed - reset selection and results for next time
    selectedCategoryIds.value = [];
    autoScheduleResult.value = null;
  }
});

function resolveViewModeFromQuery(value: unknown): 'queue' | 'schedule' | 'command' | null {
  if (typeof value !== 'string') return null;
  if (value === 'queue' || value === 'schedule' || value === 'command') return value;
  return null;
}

watch(
  () => route.query.view,
  (queryView) => {
    const resolved = resolveViewModeFromQuery(Array.isArray(queryView) ? queryView[0] : queryView);
    if (resolved && resolved !== viewMode.value) {
      viewMode.value = resolved;
    }
  },
  { immediate: true }
);

watch(viewMode, (mode) => {
  const current = resolveViewModeFromQuery(
    Array.isArray(route.query.view) ? route.query.view[0] : route.query.view
  );
  if (current === mode) return;
  router.replace({
    query: {
      ...route.query,
      view: mode,
    },
  });
});

// Share links dialog
const scoringUrl = computed(() => `${window.location.origin}/tournaments/${tournamentId.value}/score`);

// Current time for auto-ready calculations (updates every minute)
const currentTime = ref(new Date());
let autoReadyInterval: ReturnType<typeof setInterval> | null = null;

// Computed match lists
// Matches that need court assignment or scheduling:
// - Status is 'ready' or 'scheduled'
// - Have both participants assigned (not TBD)
// - Don't have a court OR don't have a scheduled time
const pendingMatches = computed(() => {
  let result = matches.value.filter(
    (m) => (m.status === 'ready' || m.status === 'scheduled') &&
           m.participant1Id && m.participant2Id &&
           !m.courtId
  );
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }
  return result.sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);
});

// Enrich pending matches with participant names for MatchQueueList
// MatchQueueList expects participant1Name and participant2Name properties
const enrichedPendingMatches = computed(() => {
  return pendingMatches.value.map(match => ({
    ...match,
    participant1Name: getParticipantName(match.participant1Id),
    participant2Name: getParticipantName(match.participant2Id),
    categoryName: getCategoryName(match.categoryId)
  })) as any;
});

// Matches that are scheduled AND have a court AND scheduledTime assigned - waiting for their time
// Only includes matches that went through auto-schedule (which sets both courtId and scheduledTime)
const scheduledWithCourtMatches = computed(() => {
  let result = matches.value.filter(
    (m) => m.status === 'scheduled' && m.participant1Id && m.participant2Id && m.courtId && m.scheduledTime
  );
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }
  return result.sort((a, b) => {
    // Sort by scheduled time, then by round/match number
    const timeA = a.scheduledTime?.getTime() || 0;
    const timeB = b.scheduledTime?.getTime() || 0;
    if (timeA !== timeB) return timeA - timeB;
    return a.round - b.round || a.matchNumber - b.matchNumber;
  });
});

// Check if a match is due to start (scheduled time has arrived or is within X minutes)
function isMatchDue(match: Match): boolean {
  if (!match.scheduledTime) return false;
  const scheduledTime = match.scheduledTime.getTime();
  const readyTime = scheduledTime - (AUTO_READY_MINUTES_BEFORE * 60 * 1000);
  return currentTime.value.getTime() >= readyTime;
}


const readyMatches = computed(() => {
  let result = matches.value.filter((m) => m.status === 'ready');
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }
  return result;
});



// Enrich in-progress matches with participant names and court names for ActiveMatchesSection
// Also include READY matches that have a court assigned, so they appear in the list
const enrichedInProgressMatches = computed(() => {
  // Get both In Progress AND Ready matches that have a court
  const matchesToShow = matches.value.filter(m => 
    (m.status === 'in_progress' || (m.status === 'ready' && m.courtId)) &&
    (selectedCategory.value === 'all' || m.categoryId === selectedCategory.value)
  );

  const enriched = matchesToShow.map(match => ({
    ...match,
    participant1Name: getParticipantName(match.participant1Id),
    participant2Name: getParticipantName(match.participant2Id),
    categoryName: getCategoryName(match.categoryId),
    courtName: courts.value.find(c => c.id === match.courtId)?.name
  })) as any;

  return enriched;
});



// Filtered matches for Schedule view with advanced filtering and sorting
const filteredMatches = computed(() => {
  let result = [...matches.value];

  // Category filter
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }

  // Status filter
  if (scheduleFilters.value.status !== 'all') {
    result = result.filter((m) => m.status === scheduleFilters.value.status);
  }

  // Court filter
  if (scheduleFilters.value.courtId !== 'all') {
    result = result.filter((m) => m.courtId === scheduleFilters.value.courtId);
  }

  // Search filter (participants)
  if (scheduleFilters.value.searchQuery.trim()) {
    const query = scheduleFilters.value.searchQuery.toLowerCase();
    result = result.filter((m) => {
      const p1Name = getParticipantName(m.participant1Id).toLowerCase();
      const p2Name = getParticipantName(m.participant2Id).toLowerCase();
      const matchNumber = String(m.matchNumber).toLowerCase();
      return p1Name.includes(query) || p2Name.includes(query) || matchNumber.includes(query);
    });
  }

  // Sorting
  const sortBy = scheduleFilters.value.sortBy;
  const sortDesc = scheduleFilters.value.sortDesc;

  result.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'matchNumber':
        comparison = a.matchNumber - b.matchNumber || a.round - b.round;
        break;
      case 'round':
        comparison = a.round - b.round || a.matchNumber - b.matchNumber;
        break;
      case 'category':
        comparison = getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId));
        break;
      case 'participants': {
        const aName = getParticipantName(a.participant1Id);
        const bName = getParticipantName(b.participant1Id);
        comparison = aName.localeCompare(bName);
        break;
      }
      case 'court': {
        const aCourt = getCourtName(a.courtId);
        const bCourt = getCourtName(b.courtId);
        comparison = aCourt.localeCompare(bCourt);
        break;
      }
      case 'time': {
        const aTime = a.scheduledTime?.getTime() || 0;
        const bTime = b.scheduledTime?.getTime() || 0;
        comparison = aTime - bTime;
        break;
      }
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
      default:
        comparison = a.matchNumber - b.matchNumber;
    }

    return sortDesc ? -comparison : comparison;
  });

  return result;
});

// Court options for filter dropdown
const courtOptions = computed(() => [
  { name: 'All Courts', id: 'all' },
  ...courts.value.map(c => ({ name: c.name, id: c.id })),
]);

// Status options for filter dropdown
const statusOptions = [
  { name: 'All Status', value: 'all' },
  { name: 'Scheduled', value: 'scheduled' },
  { name: 'Ready', value: 'ready' },
  { name: 'In Progress', value: 'in_progress' },
  { name: 'Completed', value: 'completed' },
  { name: 'Cancelled', value: 'cancelled' },
] as const;

const categoryFilterOptions = computed(() => [
  { title: 'All Categories', value: 'all' },
  ...categories.value.map((category) => ({ title: category.name, value: category.id })),
]);

const scheduleStatusFilterOptions = statusOptions.map((option) => ({
  title: option.name,
  value: option.value,
}));

const scheduleCourtFilterOptions = computed(() => [
  { title: 'All Courts', value: 'all' },
  ...courts.value.map((court) => ({ title: court.name, value: court.id })),
]);

const scheduleSortOptions = [
  { title: 'Round (Asc)', value: 'round_asc' },
  { title: 'Round (Desc)', value: 'round_desc' },
  { title: 'Match Number (Asc)', value: 'match_number_asc' },
  { title: 'Match Number (Desc)', value: 'match_number_desc' },
  { title: 'Category (A-Z)', value: 'category_asc' },
  { title: 'Participants (A-Z)', value: 'participants_asc' },
  { title: 'Court (A-Z)', value: 'court_asc' },
  { title: 'Scheduled Time (Earliest)', value: 'time_asc' },
  { title: 'Scheduled Time (Latest)', value: 'time_desc' },
  { title: 'Status (A-Z)', value: 'status_asc' },
];

const scheduleSortValue = computed<string>({
  get: () => {
    const { sortBy, sortDesc } = scheduleFilters.value;
    if (sortBy === 'round') return sortDesc ? 'round_desc' : 'round_asc';
    if (sortBy === 'matchNumber') return sortDesc ? 'match_number_desc' : 'match_number_asc';
    if (sortBy === 'category') return 'category_asc';
    if (sortBy === 'participants') return 'participants_asc';
    if (sortBy === 'court') return 'court_asc';
    if (sortBy === 'time') return sortDesc ? 'time_desc' : 'time_asc';
    if (sortBy === 'status') return 'status_asc';
    return 'round_asc';
  },
  set: (value) => {
    switch (value) {
      case 'round_desc':
        scheduleFilters.value.sortBy = 'round';
        scheduleFilters.value.sortDesc = true;
        break;
      case 'match_number_asc':
        scheduleFilters.value.sortBy = 'matchNumber';
        scheduleFilters.value.sortDesc = false;
        break;
      case 'match_number_desc':
        scheduleFilters.value.sortBy = 'matchNumber';
        scheduleFilters.value.sortDesc = true;
        break;
      case 'category_asc':
        scheduleFilters.value.sortBy = 'category';
        scheduleFilters.value.sortDesc = false;
        break;
      case 'participants_asc':
        scheduleFilters.value.sortBy = 'participants';
        scheduleFilters.value.sortDesc = false;
        break;
      case 'court_asc':
        scheduleFilters.value.sortBy = 'court';
        scheduleFilters.value.sortDesc = false;
        break;
      case 'time_asc':
        scheduleFilters.value.sortBy = 'time';
        scheduleFilters.value.sortDesc = false;
        break;
      case 'time_desc':
        scheduleFilters.value.sortBy = 'time';
        scheduleFilters.value.sortDesc = true;
        break;
      case 'status_asc':
        scheduleFilters.value.sortBy = 'status';
        scheduleFilters.value.sortDesc = false;
        break;
      case 'round_asc':
      default:
        scheduleFilters.value.sortBy = 'round';
        scheduleFilters.value.sortDesc = false;
    }
  },
});

const hasActiveScheduleFilters = computed(() => (
  selectedCategory.value !== 'all' ||
  scheduleFilters.value.status !== 'all' ||
  scheduleFilters.value.courtId !== 'all' ||
  Boolean(scheduleFilters.value.searchQuery.trim()) ||
  scheduleSortValue.value !== 'round_asc'
));

function updateScheduleStatus(value: string | null): void {
  switch (value) {
    case 'scheduled':
    case 'ready':
    case 'in_progress':
    case 'completed':
    case 'cancelled':
      scheduleFilters.value.status = value;
      break;
    default:
      scheduleFilters.value.status = 'all';
  }
}

// Reset schedule filters
function resetScheduleFilters() {
  scheduleFilters.value = {
    status: 'all',
    courtId: 'all',
    searchQuery: '',
    sortBy: 'round',
    sortDesc: false,
  };
}

// Court status
const availableCourts = computed(() =>
  courts.value.filter((c) => c.status === 'available')
);

const courtsInUse = computed(() =>
  courts.value.filter((c) => c.status === 'in_use')
);

// Category-independent computed properties for stats (show totals across all categories)
const allReadyMatches = computed(() =>
  matches.value.filter((m) => m.status === 'ready')
);

const allInProgressMatches = computed(() =>
  matches.value.filter((m) => m.status === 'in_progress')
);

const allCompletedMatches = computed(() =>
  matches.value.filter((m) => m.status === 'completed' || m.status === 'walkover')
);

const allScheduledWithCourtMatches = computed(() =>
  matches.value.filter((m) => (m.status === 'scheduled' || m.status === 'ready') && m.courtId)
);

const allPendingMatches = computed(() =>
  matches.value.filter((m) => (m.status === 'ready' || m.status === 'scheduled') && !m.courtId)
);

// Stats - always show totals across ALL categories for dashboard overview
const stats = computed(() => {
  const result = {
    total: matches.value.length,
    pending: allPendingMatches.value.length,
    scheduled: allScheduledWithCourtMatches.value.length,
    ready: allReadyMatches.value.length,
    inProgress: allInProgressMatches.value.length,
    completed: allCompletedMatches.value.length,
    totalCourts: courts.value.length,
    courtsInUse: courtsInUse.value.length,
  };

  return result;
});

const blockedMatches = computed(() =>
  matches.value.filter((match) =>
    (match.status === 'scheduled' || match.status === 'ready') &&
    (!match.participant1Id || !match.participant2Id)
  )
);

const nextActionMatchLabel = computed(() => {
  const nextMatch = matches.value
    .filter((match) =>
      (match.status === 'ready' || match.status === 'scheduled') &&
      !match.courtId &&
      match.participant1Id &&
      match.participant2Id &&
      (selectedCategory.value === 'all' || match.categoryId === selectedCategory.value)
    )
    .sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber)[0];

  if (!nextMatch) return '-';
  return `${getCategoryName(nextMatch.categoryId)} · ${getMatchDisplayName(nextMatch)}`;
});

const runningStatusSummary = computed(() => ({
  total: stats.value.total,
  inProgress: stats.value.inProgress,
  ready: stats.value.ready,
  scheduled: stats.value.scheduled,
  blocked: blockedMatches.value.length,
  completed: stats.value.completed,
  nextMatch: nextActionMatchLabel.value,
}));

// Activity feed
const activities = computed(() => activityStore.recentActivities);

// Auto-ready: check for scheduled matches that are due and mark them as ready
async function checkAndMarkDueMatches() {
  currentTime.value = new Date();

  const dueMatches = scheduledWithCourtMatches.value.filter(isMatchDue);

  for (const match of dueMatches) {
    try {
      // Mark match as ready
      await matchStore.markMatchReady(tournamentId.value, match.id, match.categoryId, match.levelId);

      // Log activity (non-blocking)
      const p1Name = getParticipantName(match.participant1Id);
      const p2Name = getParticipantName(match.participant2Id);
      const courtName = getCourtName(match.courtId);
      const categoryName = getCategoryName(match.categoryId);
      activityStore.logMatchReady(
        tournamentId.value,
        match.id,
        p1Name,
        p2Name,
        courtName,
        categoryName
      ).catch((err) => console.warn('Activity logging failed:', err));

      notificationStore.showToast('info', `${getMatchDisplayName(match)} is ready on ${courtName}`);
    } catch (error) {
      console.error('Failed to auto-ready match:', error);
    }
  }
}



onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);
  // Subscribe to all matches across all categories
  // This automatically watches categories and subscribes to each one
  matchStore.subscribeAllMatches(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
  activityStore.subscribeActivities(tournamentId.value);

  // Start auto-ready interval (check every 30 seconds)
  autoReadyInterval = setInterval(checkAndMarkDueMatches, 30000);
  // Also check immediately on mount
  checkAndMarkDueMatches();
  
  // Run consistency check to fix any zombie courts/matches
  setTimeout(() => {
    matchStore.checkAndFixConsistency(tournamentId.value);
  }, 2000); // Small delay to ensure data is loaded
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  activityStore.unsubscribe();

  // Clear auto-ready interval
  if (autoReadyInterval) {
    clearInterval(autoReadyInterval);
    autoReadyInterval = null;
  }
});

// Helper functions
function getCategoryName(categoryId: string): string {
  const category = categories.value.find((c) => c.id === categoryId);
  return category?.name || 'Unknown';
}

function getCourtName(courtId: string | undefined): string {
  if (!courtId) return '-';
  const court = courts.value.find((c) => c.id === courtId);
  return court?.name || 'Unknown';
}

function getBracketCode(match: Match): string {
  if (match.bracketPosition?.bracket === 'losers') return 'LB';
  if (match.bracketPosition?.bracket === 'finals') return 'F';
  return 'WB';
}

// Actions
function openAssignCourtDialog(match: Match) {
  selectedMatch.value = match;
  selectedCourtId.value = null;
  openDialog('assignCourt');
}

// Release Court Dialog State
const courtToReleaseId = ref<string | null>(null);

async function releaseCourt(courtId: string) {
  const court = courts.value.find(c => c.id === courtId);
  if (!court) return;
  courtToReleaseId.value = courtId;
  openDialog('release');
}

async function confirmReleaseCourt() {
  if (!courtToReleaseId.value) return;

  const courtId = courtToReleaseId.value;
  const court = courts.value.find(c => c.id === courtId);

  closeDialog('release');
  courtToReleaseId.value = null;

  if (!court) return;

  try {
    // If there's a match on this court, we should unschedule it properly
    // to avoid the "In Progress but Unassigned" state.
    if (court.currentMatchId) {
       const match = matches.value.find(m =>
         m.id === court.currentMatchId &&
         m.courtId === court.id &&
         (m.status === 'in_progress' || m.status === 'ready' || m.status === 'scheduled')
       );
       if (match) {
         await matchStore.unscheduleMatch(
           tournamentId.value,
           match.id,
           match.categoryId,
           court.id,
           match.levelId
         );
         notificationStore.showToast('success', 'Court released and match unscheduled');
         return;
       }
    }

    // Fallback: Just release the court manually
    await tournamentStore.releaseCourtManual(tournamentId.value, courtId);
    notificationStore.showToast('success', 'Court released manually');
  } catch (error) {
    console.error('Failed to release court:', error);
    notificationStore.showToast('error', 'Failed to release court');
  }
}

// TOURNEY-101: Command Center helper functions
function openAssignCourtDialogForCourt(courtId: string) {
  selectedCourtId.value = courtId;
  // Find the first ready match to suggest, or leave null for manual selection
  const firstReadyMatch = matches.value.find(m => m.status === 'ready' && !m.courtId);
  selectedMatch.value = firstReadyMatch || null;
  openDialog('assignCourt');
}

function selectMatchFromQueue(ref: QueueMatchRef) {
  const match = matches.value.find(
    (m) =>
      m.id === ref.matchId &&
      m.categoryId === ref.categoryId &&
      (m.levelId || null) === (ref.levelId || null)
  );
  if (match) {
    selectedMatch.value = match;
  }
}

function openAssignCourtDialogFromQueue(ref: QueueMatchRef) {
  const match = matches.value.find(
    (m) =>
      m.id === ref.matchId &&
      m.categoryId === ref.categoryId &&
      (m.levelId || null) === (ref.levelId || null)
  );
  if (match) {
    openAssignCourtDialog(match);
  }
}

async function quickAssignCourt(match: Match, court: Court) {
  try {
    await matchStore.assignCourt(
      tournamentId.value,
      match.id,
      court.id,
      match.categoryId,
      match.levelId
    );
    notificationStore.showToast('success', `Assigned to ${court.name}`);

    // Log activity (non-blocking - don't fail assignment if logging fails)
    const categoryName = getCategoryName(match.categoryId);
    const p1Name = getParticipantName(match.participant1Id);
    const p2Name = getParticipantName(match.participant2Id);
    activityStore.logMatchReady(
      tournamentId.value,
      match.id,
      p1Name,
      p2Name,
      court.name,
      categoryName
    ).catch((err) => console.warn('Activity logging failed:', err));
  } catch (error) {
    notificationStore.showToast('error', 'Failed to assign court');
  }
}

function openScheduleDialog(match: Match) {
  selectedMatch.value = match;
  openDialog('schedule');
}



function openScoreDialog(matchId: string) {
  const match = matches.value.find(m => m.id === matchId);
  if (match) {
    openManualScoreDialog(match);
  } else {
    console.error('[openScoreDialog] Match not found:', matchId);
    notificationStore.showToast('error', 'Match not found');
  }
}

function openCompleteMatchDialog(matchId: string) {
  const match = matches.value.find(m => m.id === matchId);
  if (match) {
    openManualScoreDialog(match);
  }
}

// Start match - changes status to in_progress without navigating away
async function startMatchInProgress(match: Match) {
  try {
    await matchStore.startMatch(tournamentId.value, match.id, match.categoryId, match.levelId);

    // Log activity (non-blocking)
    const p1Name = getParticipantName(match.participant1Id);
    const p2Name = getParticipantName(match.participant2Id);
    const courtName = getCourtName(match.courtId);
    const categoryName = getCategoryName(match.categoryId);
    activityStore.logMatchStarted(
      tournamentId.value,
      match.id,
      p1Name,
      p2Name,
      courtName,
      categoryName
    ).catch((err) => console.warn('Activity logging failed:', err));

    notificationStore.showToast('success', `Match started on ${courtName}`);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to start match');
  }
}

// Open manual score entry dialog
function openManualScoreDialog(match: Match) {
  // Validate that both participants are assigned
  if (!match.participant1Id || !match.participant2Id) {
    const p1Name = getParticipantName(match.participant1Id);
    const p2Name = getParticipantName(match.participant2Id);
    console.error('[openManualScoreDialog] BLOCKED: Match missing participants:', {
      matchId: match.id,
      participant1Id: match.participant1Id,
      participant2Id: match.participant2Id,
      p1Name,
      p2Name,
      status: match.status,
      courtId: match.courtId,
      categoryId: match.categoryId
    });
    notificationStore.showToast('error', `Cannot score match ${match.id}: ${getMatchDisplayName(match)}. Both players must be assigned first. This match may be waiting for a previous round to complete.`);
    return;
  }

  selectedMatch.value = match;
  openDialog('score');
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    notificationStore.showToast('success', `${label} copied to clipboard!`);
  }).catch(() => {
    notificationStore.showToast('error', 'Failed to copy');
  });
}

// Get matches to schedule based on selected categories (multi-select)
const matchesToScheduleForAuto = computed(() => {
  let result = matches.value.filter(
    (m) => (m.status === 'scheduled' || m.status === 'ready') && !m.courtId
  );

  if (selectedCategoryIds.value.length > 0) {
    result = result.filter((m) => selectedCategoryIds.value.includes(m.categoryId));
  } else {
    return [];
  }

  return result.sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);
});

// Count of already scheduled matches for the selected categories
const alreadyScheduledCount = computed(() => {
  let result = matches.value.filter(
    (m) => (m.status === 'scheduled' || m.status === 'ready') && m.courtId
  );
  if (selectedCategoryIds.value.length > 0) {
    result = result.filter((m) => selectedCategoryIds.value.includes(m.categoryId));
  }
  return result.length;
});

// Reset schedule loading state
const resettingSchedule = ref(false);

// Reset schedule for selected category
async function resetSchedule() {
  // Show confirmation dialog instead of native confirm()
  openDialog('reset');
}

// Actually perform the reset after confirmation
async function confirmResetSchedule() {
  closeDialog('reset');

  // Use selected categories or 'all' if all are selected
  const categoryIdsToReset = selectedCategoryIds.value; // removed allCategoriesSelected

  resettingSchedule.value = true;
  try {
    const result = await tournamentStore.resetScheduleForCategory(
      tournamentId.value,
      categoryIdsToReset
    );

    if (result.resetCount === 0) {
      notificationStore.showToast('info', 'No matches to reset');
    } else {
      let message = `Reset ${result.resetCount} match(es)`;
      if (result.skippedCount > 0) {
        message += ` (${result.skippedCount} in-progress/completed skipped)`;
      }
      if (result.releasedCourts.length > 0) {
        message += `. Released: ${result.releasedCourts.join(', ')}`;
      }
      notificationStore.showToast('success', message);
    }
  } catch (error) {
    console.error('Reset schedule error:', error);
    notificationStore.showToast('error', 'Failed to reset schedule');
  } finally {
    resettingSchedule.value = false;
  }
}

// Auto-schedule function with improved algorithm
async function runAutoSchedule() {
  if (selectedCategoryIds.value.length === 0) {
    notificationStore.showToast('error', 'Please select at least one category');
    return;
  }

  if (!autoScheduleConfig.value.startTime) {
    notificationStore.showToast('error', 'Please set a start time');
    return;
  }

  const startTime = new Date(autoScheduleConfig.value.startTime);

  // Use ALL courts (not just available) for scheduling
  const allCourts = courts.value
    .filter((c) => c.status !== 'maintenance')
    .sort((a, b) => a.number - b.number);

  if (allCourts.length === 0) {
    notificationStore.showToast('error', 'No courts available');
    return;
  }

  // Get matches to schedule
  const matchesToSchedule = [...matchesToScheduleForAuto.value];

  if (matchesToSchedule.length === 0) {
    notificationStore.showToast('info', 'No matches to schedule');
    return;
  }

  try {
    // Schedule for each selected category separately
    // This prevents time/court overlaps between categories
    let totalScheduled = 0;
    let totalUnscheduled: { matchId: string; reason?: string; details?: Record<string, unknown> }[] = [];

    for (const categoryId of selectedCategoryIds.value) {
      const levels = await tournamentStore.fetchCategoryLevels(tournamentId.value, categoryId);
      const scheduleScopes = [
        { categoryId, levelId: undefined as string | undefined },
        ...levels.map((level) => ({ categoryId, levelId: level.id })),
      ];

      for (const scope of scheduleScopes) {
        const result = await scheduler.scheduleMatches(tournamentId.value, {
          categoryId: scope.categoryId,
          levelId: scope.levelId,
          courtIds: allCourts.map((c) => c.id),
          startTime,
          respectDependencies: true,
        });

        totalScheduled += result.scheduled.length;
        totalUnscheduled = [
          ...totalUnscheduled,
          ...result.unscheduled.map((item) => ({
            ...item,
            details: {
              ...(item.details || {}),
              categoryId: scope.categoryId,
              levelId: scope.levelId,
            },
          })),
        ];

        // Store the last result for display
        autoScheduleResult.value = result;
      }
    }

    // Build combined result
    const combinedResult: ScheduleResult = {
      scheduled: [], // We don't need the full list for display
      unscheduled: totalUnscheduled,
      stats: {
        totalMatches: matchesToSchedule.length,
        scheduledCount: totalScheduled,
        unscheduledCount: totalUnscheduled.length,
        courtUtilization: 0, // Not calculated for multi-category
        estimatedDuration: 0,
      },
    };

    autoScheduleResult.value = combinedResult;

    // Show appropriate message
    if (totalUnscheduled.length > 0) {
      notificationStore.showToast(
        'warning',
        `Scheduled ${totalScheduled} matches, ${totalUnscheduled.length} could not be scheduled`
      );
    } else {
      notificationStore.showToast(
        'success',
        `Scheduled ${totalScheduled} matches across ${allCourts.length} courts`
      );
      // Only close dialog on full success
      if (totalUnscheduled.length === 0) {
        closeDialog('autoSchedule');
        autoScheduleResult.value = null;
      }
    }
  } catch (error) {
    console.error('Auto-schedule error:', error);
    notificationStore.showToast('error', 'Failed to auto-schedule');
  }
}



// Auto-assign and Auto-start state
const autoAssignEnabled = ref(true);
const autoStartEnabled = ref(false);

// Watch for tournament settings updates to sync auto-assign state
watch(() => tournament.value?.settings, (settings) => {
  if (settings && typeof settings.autoAssignEnabled !== 'undefined') {
    autoAssignEnabled.value = settings.autoAssignEnabled;
  }
}, { immediate: true });

// Watch for ready matches to auto-start
watch(() => readyMatches.value, async (newMatches) => {
  if (autoStartEnabled.value && newMatches.length > 0) {
    for (const match of newMatches) {
      if (!match.courtId) continue;

      const court = courts.value.find(c => c.id === match.courtId);
      if (!court || court.status !== 'available') continue;

      if (match.scheduledTime) {
        const scheduledTime = new Date(match.scheduledTime);
        const now = new Date();
        if (scheduledTime.getTime() - now.getTime() > 2 * 60 * 1000) continue;
      }

      await startMatchInProgress(match);
    }
  }
}, { deep: true, immediate: true });

// Watch for auto-assign opportunities
watch(
  [() => autoAssignEnabled.value, () => availableCourts.value, () => pendingMatches.value],
  async ([isEnabled, courts, matches]) => {
    if (!isEnabled || courts.length === 0 || matches.length === 0) return;

    const match = matches[0];
    const court = courts[0];

    try {
      await tournamentStore.assignMatchToCourt(
        tournamentId.value,
        match.id,
        court.id,
        match.categoryId,
        match.levelId
      );
      notificationStore.showToast('success', `Auto-assigned to ${court.name}`);
      const categoryName = getCategoryName(match.categoryId);
      activityStore.logActivity(
        tournamentId.value,
        'court_assigned',
        `Auto-assigned: ${getMatchDisplayName(match)} → ${court.name} (${categoryName})`
      );
    } catch (error) {
      console.error('[AutoAssign] Failed to assign match:', error);
    }
  },
  { deep: true, immediate: true }
);

const showConsistencyDialog = ref(false);
const showUnscheduleDialog = ref(false);
const matchToUnschedule = ref<QueueMatchRef | null>(null);

function handleConsistencyCheck() {
  showConsistencyDialog.value = true;
}

async function confirmConsistencyCheck() {
  showConsistencyDialog.value = false;
  try {
    await matchStore.checkAndFixConsistency(tournamentId.value);
    notificationStore.showToast('success', 'Data consistency check completed');
  } catch (error) {
    console.error('Consistency check failed:', error);
    notificationStore.showToast('error', 'Failed to run consistency check');
  }
}

async function handleUnschedule(ref: QueueMatchRef) {
  matchToUnschedule.value = ref;
  showUnscheduleDialog.value = true;
}

async function confirmUnschedule() {
  if (!matchToUnschedule.value) return;

  const { matchId, categoryId, levelId } = matchToUnschedule.value;
  const match = matches.value.find(
    (m) =>
      m.id === matchId &&
      m.categoryId === categoryId &&
      (m.levelId || null) === (levelId || null)
  );
  
  showUnscheduleDialog.value = false;
  matchToUnschedule.value = null;

  if (!match) return;

  try {
    await matchStore.unscheduleMatch(
      tournamentId.value,
      matchId,
      categoryId,
      undefined,
      levelId || match.levelId
    );
    notificationStore.showToast('success', 'Match unscheduled and moved to queue');
    
    // Log activity
    const p1 = getParticipantName(match.participant1Id);
    const p2 = getParticipantName(match.participant2Id);
    activityStore.logActivity(
      tournamentId.value,
      'match_update',
       `Unscheduled: ${p1} vs ${p2}`
    );
  } catch (error) {
    console.error('Failed to unschedule:', error);
    notificationStore.showToast('error', 'Failed to unschedule match');
  }
}


/**
 * Toggle auto-assignment on/off
 */
function toggleAutoAssign(enabled: boolean) {
  autoAssignEnabled.value = enabled;
  tournamentStore.updateTournament(tournamentId.value, {
    settings: {
      ...(tournament.value?.settings || {}),
      autoAssignEnabled: enabled,
    } as any, // Cast to any to avoid type error if property missing in interface
  });
}

function toggleAutoStart(enabled: boolean) {
  autoStartEnabled.value = enabled;
  if (enabled) {
    notificationStore.showToast('success', 'Auto-start enabled');
    // Trigger check immediately
    if (readyMatches.value.length > 0) {
      readyMatches.value.forEach(m => startMatchInProgress(m));
    }
  } else {
    notificationStore.showToast('info', 'Auto-start disabled');
  }
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

</script>

<template>
  <div class="match-control-container h-100 d-flex flex-column bg-background">
    <!-- State Banner -->
    <StateBanner
      v-if="tournament"
      :state="tournament.state || 'DRAFT'"
      :next-state="getNextState(tournament.state || 'DRAFT')"
      :is-admin="isAdmin"
      @advance="advanceState"
      @unlock="showUnlockDialog = true"
    />

    <!-- Header Toolbar -->
    <v-toolbar
      color="surface"
      elevation="1"
      density="compact"
      class="px-2 border-b"
    >
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        size="small"
        @click="router.push(`/tournaments/${tournamentId}`)"
      />
      <v-toolbar-title class="text-subtitle-1 font-weight-bold">
        Match Control
        <span class="text-caption text-medium-emphasis ml-2 hidden-sm-and-down">
          {{ tournament?.name }}
        </span>
      </v-toolbar-title>
      
      <v-spacer />

      <!-- Category Filter -->
      <div
        v-if="viewMode !== 'schedule'"
        style="width: 200px"
        class="mr-2"
      >
        <v-select
          v-model="selectedCategory"
          :items="categoryOptions"
          item-title="name"
          item-value="id"
          density="compact"
          variant="outlined"
          hide-details
          bg-color="surface"
          prepend-inner-icon="mdi-filter-variant"
          label="Category"
          class="category-select"
        />
      </div>

      <!-- View Mode Toggle -->
      <v-btn-toggle
        v-model="viewMode"
        mandatory
        density="compact"
        color="primary"
        variant="outlined"
        class="mr-2"
        divided
      >
        <v-btn
          value="command"
          prepend-icon="mdi-view-dashboard-variant"
        >
          <span class="hidden-sm-and-down">Command Center</span>
        </v-btn>
        <v-btn
          value="queue"
          prepend-icon="mdi-view-dashboard"
        >
          <span class="hidden-sm-and-down">Live View</span>
        </v-btn>
        <v-btn
          value="schedule"
          prepend-icon="mdi-format-list-bulleted"
        >
          <span class="hidden-sm-and-down">All Matches</span>
        </v-btn>
      </v-btn-toggle>

    </v-toolbar>

    <!-- Main Content Grid -->
    <div class="flex-grow-1 overflow-hidden">
      <!-- VIEW MODE: QUEUE (Original Layout) -->
      <v-row
        v-if="viewMode === 'queue'"
        class="fill-height ma-0"
        no-gutters
      >
        <v-col
          cols="12"
          class="pa-3 pb-0"
        >
          <RunningStatusBoard
            :summary="runningStatusSummary"
            :category-statuses="filteredCategoryStageStatuses"
          />
        </v-col>

        <!-- LEFT PANEL: Active Matches & Courts (Flexible, Scrollable) -->
        <v-col
          cols="12"
          md="8"
          class="d-flex flex-column border-e fill-height"
        >
          <!-- Scrollable Content Area -->
          <div class="flex-grow-1 overflow-y-auto pa-4 bg-background">
            <!-- Active Matches Section -->
            <div class="mb-4">
              <active-matches-section
                :matches="enrichedInProgressMatches"
                :show-actions="false"
              />
            </div>

            <!-- Courts Grid -->
            <div class="d-flex align-center mb-2 mt-6">
              <v-icon
                start
                size="20"
                color="secondary"
              >
                mdi-stadium
              </v-icon>
              <h3 class="text-subtitle-1 font-weight-bold">
                Court Status
              </h3>
              <v-spacer />
              <v-btn
                icon="mdi-database-refresh"
                variant="text"
                size="small"
                color="warning"
                @click="handleConsistencyCheck"
              >
                <v-icon>mdi-database-refresh</v-icon>
                <v-tooltip
                  activator="parent"
                  location="top"
                >
                  Fix Court Data Integrity
                </v-tooltip>
              </v-btn>
            </div>

            <court-grid
              :courts="courts"
              :matches="matches"
              :get-category-name="getCategoryName"
              @assign="openAssignCourtDialogForCourt"
              @score="openScoreDialog"
              @release="releaseCourt"
            />
          </div>
        </v-col>

        <!-- RIGHT PANEL: Queue & Schedule (Fixed Width on Desktop) -->
        <v-col
          cols="12"
          md="4"
          class="d-flex flex-column bg-surface fill-height border-s"
        >
          <div class="pa-3 border-b bg-surface-light">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-subtitle-2 font-weight-bold text-uppercase text-medium-emphasis">Next Up</span>
              <v-chip
                size="x-small"
                color="primary"
              >
                {{ enrichedPendingMatches.length }}
              </v-chip>
            </div>
          </div>

          <!-- Queue List -->
          <div class="flex-grow-1 overflow-y-auto pa-0">
            <match-queue-list
              :matches="enrichedPendingMatches"
              :available-courts="availableCourts"
              :auto-assign-enabled="autoAssignEnabled"
              :auto-start-enabled="autoStartEnabled"
              :read-only="true"
            />
          </div>
        </v-col>
      </v-row>

      <!-- VIEW MODE: SCHEDULE (Full List) -->
      <div
        v-else-if="viewMode === 'schedule'"
        class="fill-height d-flex flex-column bg-background"
      >
        <!-- Schedule Filters Toolbar -->
        <div class="px-4 py-3 bg-surface border-b">
          <filter-bar
            :search="scheduleFilters.searchQuery"
            :category="selectedCategory"
            :status="scheduleFilters.status"
            :court="scheduleFilters.courtId"
            :sort="scheduleSortValue"
            :enable-category="true"
            :enable-status="true"
            :enable-court="true"
            :category-options="categoryFilterOptions"
            :status-options="scheduleStatusFilterOptions"
            :court-options="scheduleCourtFilterOptions"
            :sort-options="scheduleSortOptions"
            search-label="Search"
            search-placeholder="Search participants or match number"
            :has-active-filters="hasActiveScheduleFilters"
            @update:search="scheduleFilters.searchQuery = $event"
            @update:category="selectedCategory = $event || 'all'"
            @update:status="updateScheduleStatus($event)"
            @update:court="scheduleFilters.courtId = $event || 'all'"
            @update:sort="scheduleSortValue = $event || 'round_asc'"
            @clear="resetScheduleFilters"
          />
        </div>

        <!-- TOURNEY-104: Compact Schedule Toggle -->
        <div class="px-4 py-2 bg-surface border-b d-flex align-center justify-space-between">
          <span class="text-body-2 text-grey">{{ filteredMatches.length }} matches</span>
          <v-btn-toggle
            v-model="scheduleViewMode"
            density="compact"
            variant="outlined"
            mandatory
          >
            <v-btn
              value="compact"
              prepend-icon="mdi-view-compact"
              size="small"
            >
              Compact
            </v-btn>
            <v-btn
              value="full"
              prepend-icon="mdi-table"
              size="small"
            >
              Full
            </v-btn>
          </v-btn-toggle>
        </div>

        <!-- Schedule Table - Compact View (TOURNEY-104) -->
        <div
          v-if="scheduleViewMode === 'compact'"
          class="flex-grow-1 overflow-auto"
        >
          <v-data-table
            :items="filteredMatches"
            :headers="[
              { title: 'Match', key: 'match', width: '40%', sortable: false },
              { title: 'Status', key: 'status', width: '100px', sortable: true },
              { title: 'Court', key: 'court', width: '120px', sortable: true },
              { title: 'Actions', key: 'actions', align: 'end', sortable: false },
            ]"
            :items-per-page="50"
            density="compact"
            class="fill-height"
            fixed-header
            hover
            show-expand
            item-value="id"
          >
            <template #item.match="{ item }">
              <div class="d-flex flex-column py-1">
                <div class="d-flex align-center gap-2 mb-1">
                  <span class="text-caption text-grey">#{{ item.id }}</span>
                  <v-chip
                    size="x-small"
                    variant="outlined"
                    density="compact"
                  >
                    {{ getCategoryName(item.categoryId) }}
                  </v-chip>
                </div>
                <div class="d-flex flex-column">
                  <span
                    :class="{'font-weight-bold text-success': item.winnerId === item.participant1Id}"
                    class="text-body-2"
                  >
                    {{ getParticipantName(item.participant1Id) }}
                  </span>
                  <span
                    :class="{'font-weight-bold text-success': item.winnerId === item.participant2Id}"
                    class="text-body-2"
                  >
                    {{ getParticipantName(item.participant2Id) }}
                  </span>
                </div>
                <div
                  v-if="item.scores && item.scores.length > 0"
                  class="mt-1"
                >
                  <span class="font-mono text-caption text-grey">
                    {{ item.scores.map(s => `${s.score1}-${s.score2}`).join(', ') }}
                  </span>
                </div>
              </div>
            </template>

            <template #item.status="{ item }">
              <v-chip
                size="small"
                :color="quickFilters.find(f => f.value === item.status)?.color || (item.status === 'completed' ? 'success' : 'grey')"
                variant="flat"
                class="text-uppercase font-weight-bold"
                style="font-size: 10px; height: 20px;"
              >
                {{ item.status.replace('_', ' ') }}
              </v-chip>
            </template>

            <template #item.court="{ item }">
              <div
                v-if="item.courtId"
                class="d-flex align-center"
              >
                <v-icon
                  size="small"
                  :color="item.status === 'in_progress' ? 'success' : 'grey'"
                  class="mr-1"
                >
                  mdi-court-sport
                </v-icon>
                <span class="text-body-2">{{ getCourtName(item.courtId) }}</span>
              </div>
              <span
                v-else
                class="text-grey-lighten-1 text-caption"
              >-</span>
            </template>

            <template #item.actions="{ item }">
              <div class="d-flex justify-end gap-1">
                <v-btn
                  v-if="item.status === 'ready' || item.status === 'in_progress'"
                  size="small"
                  color="primary"
                  variant="tonal"
                  prepend-icon="mdi-scoreboard"
                  @click.stop="openScoreDialog(item.id)"
                >
                  Score
                </v-btn>
                <v-btn
                  v-else-if="!item.courtId && (item.status === 'scheduled' || item.status === 'ready')"
                  size="small"
                  color="secondary"
                  variant="tonal"
                  prepend-icon="mdi-court-sport"
                  @click.stop="openAssignCourtDialog(item)"
                >
                  Assign
                </v-btn>
                <v-menu>
                  <template #activator="{ props }">
                    <v-btn
                      icon="mdi-dots-vertical"
                      variant="text"
                      size="small"
                      v-bind="props"
                    />
                  </template>
                  <v-list density="compact">
                    <v-list-item
                      prepend-icon="mdi-pencil"
                      title="Edit Schedule"
                      @click="openScheduleDialog(item)"
                    />
                    <v-list-item 
                      v-if="item.status !== 'completed' && item.status !== 'walkover'"
                      prepend-icon="mdi-flag-checkered" 
                      title="Force Complete" 
                      @click="openCompleteMatchDialog(item.id)"
                    />
                    <v-list-item 
                      v-if="item.status === 'scheduled' || item.status === 'ready'"
                      prepend-icon="mdi-calendar-remove" 
                      title="Unschedule" 
                      color="warning"
                      @click="handleUnschedule({ matchId: item.id, categoryId: item.categoryId, levelId: item.levelId })"
                    />
                  </v-list>
                </v-menu>
              </div>
            </template>

            <template #expanded-row="{ columns, item }">
              <tr>
                <td
                  :colspan="columns.length"
                  class="bg-grey-lighten-5 pa-4"
                >
                  <div class="d-flex flex-wrap gap-4 text-body-2">
                    <div><strong>Match:</strong> {{ getBracketCode(item) }}-{{ item.matchNumber }}</div>
                    <div><strong>Round:</strong> {{ item.round }}</div>
                    <div><strong>Category:</strong> {{ getCategoryName(item.categoryId) }}</div>
                    <div v-if="item.scheduledTime">
                      <strong>Scheduled:</strong>
                      {{ new Date(item.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}
                    </div>
                    <div v-if="item.scores && item.scores.length > 0">
                      <strong>Score:</strong>
                      {{ item.scores.map(s => `${s.score1}-${s.score2}`).join(', ') }}
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </v-data-table>
        </div>

        <!-- Schedule Table - Full View (Legacy) -->
        <div
          v-else
          class="flex-grow-1 overflow-auto"
        >
          <v-data-table
            :items="filteredMatches"
            :headers="[
              { title: 'Match', key: 'matchNumber', align: 'start', sortable: true },
              { title: 'Category', key: 'categoryId', sortable: true },
              { title: 'Round', key: 'round', sortable: true },
              { title: 'Participants', key: 'participants', sortable: false },
              { title: 'Score', key: 'score', sortable: false },
              { title: 'Court', key: 'courtId', sortable: true },
              { title: 'Scheduled', key: 'scheduledTime', sortable: true },
              { title: 'Status', key: 'status', sortable: true },
              { title: 'Actions', key: 'actions', align: 'end', sortable: false },
            ]"
            item-value="id"
            hover
            sticky-header
            class="fill-height"
            fixed-header
          >
            <!-- Custom Slots -->
            <template #item.matchNumber="{ item }">
              <div class="d-flex flex-column py-1">
                <span class="font-weight-bold text-grey">#{{ item.id }}</span>
                <span class="text-caption text-medium-emphasis">{{ getBracketCode(item) }}-{{ item.matchNumber }}</span>
              </div>
            </template>

            <template #item.categoryId="{ item }">
              <v-chip
                size="x-small"
                variant="outlined"
              >
                {{ getCategoryName(item.categoryId) }}
              </v-chip>
            </template>
            
            <template #item.participants="{ item }">
              <div class="d-flex flex-column py-1">
                <span :class="{'font-weight-bold text-success': item.winnerId === item.participant1Id}">
                  {{ getParticipantName(item.participant1Id) }}
                </span>
                <span :class="{'font-weight-bold text-success': item.winnerId === item.participant2Id}">
                  {{ getParticipantName(item.participant2Id) }}
                </span>
              </div>
            </template>

            <template #item.score="{ item }">
              <span
                v-if="item.scores && item.scores.length > 0"
                class="font-weight-medium font-mono text-body-2"
              >
                {{ item.scores.map(s => `${s.score1}-${s.score2}`).join(', ') }}
              </span>
              <span
                v-else
                class="text-caption text-grey"
              >-</span>
            </template>

            <template #item.courtId="{ item }">
              <div v-if="item.courtId">
                <v-icon
                  size="small"
                  :color="item.status === 'in_progress' ? 'success' : 'grey'"
                  class="mr-1"
                >
                  mdi-court-sport
                </v-icon>
                {{ getCourtName(item.courtId) }}
              </div>
              <span
                v-else
                class="text-grey-lighten-1"
              >-</span>
            </template>

            <template #item.scheduledTime="{ item }">
              <div
                v-if="item.scheduledTime"
                class="d-flex align-center text-caption"
              >
                <v-icon
                  size="small"
                  class="mr-1"
                >
                  mdi-clock-outline
                </v-icon>
                {{ new Date(item.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}
              </div>
            </template>

            <template #item.status="{ item }">
              <v-chip
                size="small"
                :color="quickFilters.find(f => f.value === item.status)?.color || (item.status === 'completed' ? 'success' : 'grey')"
                variant="flat"
                class="text-uppercase font-weight-bold"
                style="font-size: 10px; height: 20px;"
              >
                {{ item.status.replace('_', ' ') }}
              </v-chip>
            </template>

            <template #item.actions="{ item }">
              <div class="d-flex justify-end gap-1">
                <!-- Actions available based on status -->
                <v-btn
                  v-if="item.status === 'ready' || item.status === 'in_progress'"
                  size="small"
                  color="primary"
                  variant="tonal"
                  prepend-icon="mdi-scoreboard"
                  @click="openScoreDialog(item.id)"
                >
                  Score
                </v-btn>
                 
                <v-btn
                  v-if="!item.courtId && (item.status === 'scheduled' || item.status === 'ready')"
                  size="small"
                  color="secondary"
                  variant="tonal"
                  prepend-icon="mdi-court-sport"
                  @click="openAssignCourtDialog(item)"
                >
                  Assign
                </v-btn>
                 
                <v-menu>
                  <template #activator="{ props }">
                    <v-btn
                      icon="mdi-dots-vertical"
                      variant="text"
                      size="small"
                      v-bind="props"
                    />
                  </template>
                  <v-list density="compact">
                    <v-list-item
                      prepend-icon="mdi-pencil"
                      title="Edit Schedule"
                      @click="openScheduleDialog(item)"
                    />
                    <v-list-item 
                      v-if="item.status !== 'completed' && item.status !== 'walkover'"
                      prepend-icon="mdi-flag-checkered" 
                      title="Force Complete" 
                      @click="openCompleteMatchDialog(item.id)"
                    />
                    <v-list-item 
                      v-if="item.status === 'scheduled' || item.status === 'ready'"
                      prepend-icon="mdi-calendar-remove" 
                      title="Unschedule" 
                      color="warning"
                      @click="handleUnschedule({ matchId: item.id, categoryId: item.categoryId, levelId: item.levelId })"
                    />
                  </v-list>
                </v-menu>
              </div>
            </template>
            
            <template #no-data>
              <div class="text-center py-8 text-grey">
                <v-icon
                  size="48"
                  class="mb-2"
                >
                  mdi-filter-off
                </v-icon>
                <div>No matches found matching standard filters</div>
                <v-btn
                  color="primary"
                  variant="text"
                  size="small"
                  class="mt-2"
                  @click="resetScheduleFilters"
                >
                  Reset Filters
                </v-btn>
              </div>
            </template>
          </v-data-table>
        </div>
      </div>

      <!-- TOURNEY-101: VIEW MODE: COMMAND CENTER (Court Grid + Queue + Alerts) -->
      <div
        v-else-if="viewMode === 'command'"
        class="fill-height d-flex flex-column bg-background"
      >
        <div class="command-center-grid flex-grow-1 overflow-y-auto pa-3">
          <v-row
            class="ma-0 h-100"
            dense
          >
            <v-col
              cols="12"
              class="pa-1"
            >
              <v-card
                variant="flat"
                border
                class="command-center-controls"
              >
                <!-- Row 1: Title + primary action -->
                <div class="d-flex align-center px-4 py-3 gap-3">
                  <div class="d-flex flex-column">
                    <span class="text-subtitle-2 font-weight-bold">Command Center</span>
                    <span class="text-caption text-medium-emphasis">
                      Schedule, assign, and monitor match flow from one place.
                    </span>
                  </div>
                  <v-spacer />
                  <v-btn
                    variant="flat"
                    size="small"
                    color="primary"
                    prepend-icon="mdi-calendar-clock"
                    @click="openAutoScheduleDialog"
                  >
                    Auto-Schedule
                  </v-btn>
                </div>
                <!-- Row 2: Automation toggles + court/queue status -->
                <div class="d-flex align-center px-4 py-2 gap-4 border-t">
                  <v-switch
                    :model-value="autoAssignEnabled"
                    density="compact"
                    hide-details
                    inset
                    color="primary"
                    label="Auto-assign"
                    @update:model-value="toggleAutoAssign(!!$event)"
                  />
                  <v-switch
                    :model-value="autoStartEnabled"
                    density="compact"
                    hide-details
                    inset
                    color="success"
                    label="Auto-start"
                    @update:model-value="toggleAutoStart(!!$event)"
                  />
                  <v-spacer />
                  <v-chip
                    size="small"
                    :color="courts.filter(c => c.status === 'in_use').length === courts.length ? 'error' : 'success'"
                    variant="tonal"
                  >
                    Courts {{ courts.filter(c => c.status === 'available').length }} free / {{ courts.length }}
                  </v-chip>
                  <v-chip
                    size="small"
                    :color="pendingMatches.length > 0 ? 'warning' : 'success'"
                    variant="tonal"
                  >
                    Queue: {{ pendingMatches.length }}
                  </v-chip>
                </div>
              </v-card>
            </v-col>

            <v-col
              cols="12"
              class="pa-1"
            >
              <RunningStatusBoard
                :summary="runningStatusSummary"
                :category-statuses="filteredCategoryStageStatuses"
              />
            </v-col>

            <v-col
              cols="12"
              lg="8"
              class="pa-1 d-flex"
            >
              <v-card
                variant="flat"
                border
                class="command-section-card flex-grow-1"
              >
                <div class="command-section-header d-flex align-center px-3 py-2 border-b">
                  <v-icon
                    size="20"
                    class="mr-2"
                    color="primary"
                  >
                    mdi-stadium
                  </v-icon>
                  <span class="font-weight-medium">Courts</span>
                  <v-spacer />
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    color="success"
                  >
                    {{ courts.filter(c => c.status === 'available').length }} Available
                  </v-chip>
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    color="info"
                    class="ml-1"
                  >
                    {{ courts.filter(c => c.status === 'in_use').length }} In Use
                  </v-chip>
                </div>
                <div class="command-section-body">
                  <court-grid
                    :courts="courts"
                    :matches="matches"
                    :get-category-name="getCategoryName"
                    @assign="openAssignCourtDialogForCourt"
                    @score="openScoreDialog"
                    @release="releaseCourt"
                  />
                </div>
              </v-card>
            </v-col>

            <v-col
              cols="12"
              lg="4"
              class="pa-1 d-flex"
            >
              <div class="command-side-stack">
                <v-card
                  variant="flat"
                  border
                  class="command-feed-card"
                >
                  <ready-queue
                    :matches="pendingMatches"
                    :categories="categories"
                    :get-participant-name="getParticipantName"
                    :get-category-name="getCategoryName"
                    @select="selectMatchFromQueue"
                    @assign="openAssignCourtDialogFromQueue"
                  />
                </v-card>

                <v-card
                  variant="flat"
                  border
                  class="command-feed-card"
                >
                  <alerts-panel
                    :courts="courts"
                    :matches="matches"
                    :get-participant-name="getParticipantName"
                    :get-category-name="getCategoryName"
                    @assign-to-court="openAssignCourtDialogForCourt"
                    @view-match="openScoreDialog"
                    @release-court="releaseCourt"
                  />
                </v-card>
              </div>
            </v-col>
          </v-row>
        </div>
      </div>
    </div>

    <!-- Dialogs -->
    <AssignCourtDialog
      v-model="showAssignCourtDialog"
      :match="selectedMatch"
      :initial-court-id="selectedCourtId"
      :tournament-id="tournamentId"
      :courts="courts"
      @assigned="showAssignCourtDialog = false"
    />

    <AutoScheduleDialog
      v-model="showAutoScheduleDialog"
      :tournament-id="tournamentId"
      :categories="categories"
      :courts="courts"
      @scheduled="autoScheduleResult = $event"
    />

    <ScheduleMatchDialog
      v-model="showScheduleDialog"
      :match="selectedMatch"
      :tournament-id="tournamentId"
      :courts="courts"
      @saved="showScheduleDialog = false"
    />

    <ManualScoreDialog
      v-if="tournament"
      v-model="showManualScoreDialog"
      :match="selectedMatch"
      :tournament-id="tournamentId"
      :tournament="tournament"
      :categories="categories"
      @saved="showManualScoreDialog = false"
    />

    <!-- Unschedule Confirmation Dialog -->
    <BaseDialog
      v-model="showUnscheduleDialog"
      title="Unschedule Match?"
      max-width="400"
      @cancel="showUnscheduleDialog = false"
    >
      <p class="text-body-1">
        Are you sure you want to unschedule this match? It will be moved back to the queue and the court will be released.
      </p>
      <template #actions>
        <v-spacer />
        <v-btn
          color="grey"
          variant="text"
          @click="showUnscheduleDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="warning"
          @click="confirmUnschedule"
        >
          Unschedule
        </v-btn>
      </template>
    </BaseDialog>

    <!-- Release Court Confirmation -->
    <BaseDialog
      v-model="showReleaseDialog"
      title="Release Court?"
      max-width="400"
      @cancel="showReleaseDialog = false"
    >
      <p class="text-body-1">
        Are you sure you want to release this court? If a match is currently assigned, it will be unscheduled.
      </p>
      <template #actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="showReleaseDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="warning"
          @click="confirmReleaseCourt"
        >
          Release
        </v-btn>
      </template>
    </BaseDialog>

    <BaseDialog
      v-model="showResetDialog"
      title="Reset Schedule?"
      max-width="420"
      @cancel="showResetDialog = false"
    >
      <p class="text-body-1">
        This will unschedule queued/ready matches for selected categories and release assigned courts. In-progress and completed matches are not changed.
      </p>
      <template #actions>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="resettingSchedule"
          @click="showResetDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="warning"
          :loading="resettingSchedule"
          @click="confirmResetSchedule"
        >
          Reset
        </v-btn>
      </template>
    </BaseDialog>

    <!-- Consistency Check Confirmation -->
    <BaseDialog
      v-model="showConsistencyDialog"
      title="Run Diagnostics?"
      max-width="400"
      @cancel="showConsistencyDialog = false"
    >
      <p class="text-body-1">
        This will scan for and fix data inconsistencies, such as 'Zombie Courts' (courts marked busy but with no match) and double-booked matches.
      </p>
      <template #actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="showConsistencyDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="warning"
          @click="confirmConsistencyCheck"
        >
          Run Fix
        </v-btn>
      </template>
    </BaseDialog>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

// Compact Header
.text-gradient {
  background: $primary-gradient;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  display: inline-block;
}

.compact-header {
  position: relative;
  
  .v-btn {
    text-transform: none;
    letter-spacing: 0;
    font-weight: $font-weight-medium;
  }
}

// Stats Grid
.stat-card {
  height: 100%;
  border: 1px solid rgba($border, 0.5);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px -10px rgba(0, 0, 0, 0.1);
    border-color: rgba($primary-base, 0.3);
  }

  // Background decoration
  &::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, rgba($white, 0.1), rgba($white, 0));
    border-radius: 0 0 0 100%;
    z-index: 0;
  }

  .stat-icon-wrapper {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
    transition: transform 0.3s ease;

    .v-icon {
      font-size: 24px;
    }
  }

  &:hover .stat-icon-wrapper {
    transform: scale(1.1) rotate(5deg);
  }

  // Variants
  &.stat-primary {
    .stat-icon-wrapper {
      background: rgba($primary-base, 0.1);
      color: $primary-base;
    }
  }

  &.stat-success {
    border-left: 4px solid $success;
    .stat-icon-wrapper {
      background: rgba($success, 0.1);
      color: $success;
    }
  }

  &.stat-warning {
    border-left: 4px solid $warning;
    .stat-icon-wrapper {
      background: rgba($warning, 0.1);
      color: $warning;
    }
  }

  &.stat-info {
    border-left: 4px solid $info;
    .stat-icon-wrapper {
      background: rgba($info, 0.1);
      color: $info;
    }
  }
  
  &.stat-secondary {
    border-left: 4px solid $secondary-base;
    .stat-icon-wrapper {
      background: rgba($secondary-base, 0.1);
      color: $secondary-base;
    }
  }
}

.text-gradient-primary {
  background: $primary-gradient;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

// Global Polish
.v-btn {
  text-transform: none !important;
  letter-spacing: 0.3px;
}

.match-control-container {
  height: calc(100vh - 64px); // Adjust based on app header
}

.command-center-controls {
  background: rgba($primary-base, 0.02);
  border-radius: 10px;
}

.command-center-grid {
  min-height: 0;
}

.command-section-card {
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
  border-radius: 10px;
  min-height: 560px;
}

.command-section-header {
  background: rgba($primary-base, 0.02);
}

.command-section-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.command-side-stack {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  flex-direction: column;
  gap: 8px;
}

.command-feed-card {
  display: flex;
  flex: 1;
  min-height: 280px;
  min-width: 0;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
  border-radius: 10px;
}

@media (max-width: 960px) {
  .command-section-card {
    min-height: 420px;
  }

  .command-feed-card {
    min-height: 300px;
  }
}

@media (max-width: 600px) {
  .command-center-controls .v-switch {
    width: 100%;
  }
}

.court-card {
  transition: all 0.2s ease;
  height: 100px;
  
  &:hover {
    border-color: rgba($primary-base, 0.5);
  }
  
  &.court-active {
    border-color: rgba($success, 0.5);
    background: linear-gradient(to bottom right, rgb(var(--v-theme-surface)), rgba($success, 0.05));
  }
}

.active-match-info {
  line-height: 1.2;
}

.player-names {
  line-height: 1.1;
  font-size: 0.85rem;
}
</style>
