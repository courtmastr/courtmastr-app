<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useNotificationStore } from '@/stores/notifications';
import { useActivityStore } from '@/stores/activities';
import { useMatchScheduler } from '@/composables/useMatchScheduler';
import ActivityFeed from '@/components/ActivityFeed.vue';
import CourtStatusBoard from '@/features/tournaments/components/CourtStatusBoard.vue';
import MatchQueueList from '@/features/tournaments/components/MatchQueueList.vue';
import type { Match, Court } from '@/types';
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
const scheduler = useMatchScheduler();

const tournamentId = computed(() => route.params.tournamentId as string);

// Auto-schedule result for displaying errors
const autoScheduleResult = ref<ScheduleResult | null>(null);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const courts = computed(() => tournamentStore.courts);
const matches = computed(() => matchStore.matches);

// Filter state
const selectedCategory = ref<string>('all');
const viewMode = ref<'queue' | 'courts' | 'schedule'>('queue');

// Schedule view filter state
const scheduleFilters = ref({
  status: 'all' as 'all' | 'scheduled' | 'ready' | 'in_progress' | 'completed' | 'cancelled',
  courtId: 'all' as string,
  searchQuery: '',
  sortBy: 'matchNumber' as string,
  sortDesc: false,
});

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

// Dialog state
const showAssignCourtDialog = ref(false);
const showScheduleDialog = ref(false);
const showManualScoreDialog = ref(false);
const selectedMatch = ref<Match | null>(null);
const selectedCourtId = ref<string | null>(null);
const scheduledTime = ref<string>('');

// Manual score entry state
const manualScores = ref([
  { score1: 0, score2: 0 },
  { score1: 0, score2: 0 },
  { score1: 0, score2: 0 },
]);
const submittingScores = ref(false);

// Auto-schedule state
const showAutoScheduleDialog = ref(false);
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
  showAutoScheduleDialog.value = true;
}

const allCategoriesSelected = computed(() =>
  categories.value.length > 0 && selectedCategoryIds.value.length === categories.value.length
);

const someCategoriesSelected = computed(() =>
  selectedCategoryIds.value.length > 0 && selectedCategoryIds.value.length < categories.value.length
);

// Reset selected categories when dialog closes
watch(showAutoScheduleDialog, (newValue) => {
  if (!newValue) {
    // Dialog closed - reset selection and results for next time
    selectedCategoryIds.value = [];
    autoScheduleResult.value = null;
  }
});

// Share links dialog
const showShareDialog = ref(false);
const scoringUrl = computed(() => `${window.location.origin}/tournaments/${tournamentId.value}/score`);
const liveUrl = computed(() => `${window.location.origin}/tournaments/${tournamentId.value}/live`);

// Current time for auto-ready calculations (updates every minute)
const currentTime = ref(new Date());
let autoReadyInterval: ReturnType<typeof setInterval> | null = null;

// Computed match lists
// Matches that need court assignment or scheduling:
// - No courtId, OR
// - Has courtId but no scheduledTime (incomplete manual assignment)
const pendingMatches = computed(() => {
  let result = matches.value.filter(
    (m) => m.status === 'scheduled' && m.participant1Id && m.participant2Id &&
           (!m.courtId || !m.scheduledTime)
  );
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }
  return result.sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);
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

// Format time until match
function getTimeUntilMatch(match: Match): string {
  if (!match.scheduledTime) return '';
  const diff = match.scheduledTime.getTime() - currentTime.value.getTime();
  if (diff <= 0) return 'Due now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `In ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `In ${hours}h ${mins}m`;
}

const readyMatches = computed(() => {
  let result = matches.value.filter((m) => m.status === 'ready');
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }
  return result;
});

const inProgressMatches = computed(() => {
  let result = matches.value.filter((m) => m.status === 'in_progress');
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }
  return result;
});

const completedMatches = computed(() => {
  let result = matches.value.filter((m) => m.status === 'completed' || m.status === 'walkover');
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }
  return result.sort((a, b) =>
    (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
  ).slice(0, 10);
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
        comparison = a.matchNumber - b.matchNumber;
        break;
      case 'round':
        comparison = a.round - b.round;
        break;
      case 'category':
        comparison = getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId));
        break;
      case 'participants':
        const aName = getParticipantName(a.participant1Id);
        const bName = getParticipantName(b.participant1Id);
        comparison = aName.localeCompare(bName);
        break;
      case 'court':
        const aCourt = getCourtName(a.courtId);
        const bCourt = getCourtName(b.courtId);
        comparison = aCourt.localeCompare(bCourt);
        break;
      case 'time':
        const aTime = a.scheduledTime?.getTime() || 0;
        const bTime = b.scheduledTime?.getTime() || 0;
        comparison = aTime - bTime;
        break;
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
];

// Reset schedule filters
function resetScheduleFilters() {
  scheduleFilters.value = {
    status: 'all',
    courtId: 'all',
    searchQuery: '',
    sortBy: 'matchNumber',
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

// Stats
const stats = computed(() => ({
  total: matches.value.length,
  pending: pendingMatches.value.length,
  scheduled: scheduledWithCourtMatches.value.length,
  ready: readyMatches.value.length,
  inProgress: inProgressMatches.value.length,
  completed: completedMatches.value.length,
  courtsAvailable: availableCourts.value.length,
  courtsInUse: courtsInUse.value.length,
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
      await matchStore.markMatchReady(tournamentId.value, match.id, match.categoryId);

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

      notificationStore.showToast('info', `${p1Name} vs ${p2Name} is ready on ${courtName}`);
    } catch (error) {
      console.error('Failed to auto-ready match:', error);
    }
  }
}

// Manual mark ready function for organizers
async function manualMarkReady(match: Match) {
  if (!match.courtId) {
    notificationStore.showToast('error', 'Match needs a court assigned first');
    return;
  }

  try {
    await matchStore.markMatchReady(tournamentId.value, match.id, match.categoryId);

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

    notificationStore.showToast('success', `Match marked ready on ${courtName}`);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to mark match as ready');
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
function getParticipantName(registrationId: string | undefined): string {
  if (!registrationId) return 'TBD';
  const registration = registrationStore.registrations.find((r) => r.id === registrationId);
  if (!registration) return 'Unknown';

  if (registration.teamName) return registration.teamName;

  const player = registrationStore.players.find((p) => p.id === registration.playerId);
  if (player) return `${player.firstName} ${player.lastName}`;

  return 'Unknown';
}

function getCategoryName(categoryId: string): string {
  const category = categories.value.find((c) => c.id === categoryId);
  return category?.name || 'Unknown';
}

function getCourtName(courtId: string | undefined): string {
  if (!courtId) return '-';
  const court = courts.value.find((c) => c.id === courtId);
  return court?.name || 'Unknown';
}

function getMatchForCourt(courtId: string): Match | undefined {
  return inProgressMatches.value.find((m) => m.courtId === courtId) ||
         readyMatches.value.find((m) => m.courtId === courtId);
}

function getCurrentScore(match: Match): string {
  if (!match.scores || match.scores.length === 0) return '0 - 0';
  const current = match.scores[match.scores.length - 1];
  return `${current.score1} - ${current.score2}`;
}

function getGamesScore(match: Match): string {
  if (!match.scores) return '0 - 0';
  let p1 = 0;
  let p2 = 0;
  for (const game of match.scores) {
    if (game.isComplete) {
      if (game.winnerId === match.participant1Id) p1++;
      else if (game.winnerId === match.participant2Id) p2++;
    }
  }
  return `${p1} - ${p2}`;
}

// Actions
function openAssignCourtDialog(match: Match) {
  selectedMatch.value = match;
  selectedCourtId.value = null;
  showAssignCourtDialog.value = true;
}

async function assignCourt() {
  if (!selectedMatch.value || !selectedCourtId.value) return;

  try {
    await matchStore.assignCourt(
      tournamentId.value,
      selectedMatch.value.id,
      selectedCourtId.value
    );
    notificationStore.showToast('success', 'Court assigned - match ready!');
    showAssignCourtDialog.value = false;
  } catch (error) {
    notificationStore.showToast('error', 'Failed to assign court');
  }
}

async function quickAssignCourt(match: Match, court: Court) {
  try {
    await matchStore.assignCourt(tournamentId.value, match.id, court.id);
    notificationStore.showToast('success', `Assigned to ${court.name}`);

    // Log activity (non-blocking - don't fail assignment if logging fails)
    const p1Name = getParticipantName(match.participant1Id);
    const p2Name = getParticipantName(match.participant2Id);
    const categoryName = getCategoryName(match.categoryId);
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
  scheduledTime.value = match.scheduledTime
    ? new Date(match.scheduledTime).toISOString().slice(0, 16)
    : '';
  selectedCourtId.value = match.courtId || null;
  showScheduleDialog.value = true;
}

async function saveSchedule() {
  if (!selectedMatch.value) return;

  try {
    // Update match with scheduled time and court
    const updates: Record<string, unknown> = {};

    if (scheduledTime.value) {
      updates.scheduledTime = new Date(scheduledTime.value);
    }

    if (selectedCourtId.value && selectedCourtId.value !== selectedMatch.value.courtId) {
      await matchStore.assignCourt(
        tournamentId.value,
        selectedMatch.value.id,
        selectedCourtId.value
      );
    }

    notificationStore.showToast('success', 'Schedule updated');
    showScheduleDialog.value = false;
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update schedule');
  }
}

function goToScoring(match: Match) {
  router.push({
    name: 'scoring-interface',
    params: {
      tournamentId: tournamentId.value,
      matchId: match.id,
    },
  });
}

// Start match - changes status to in_progress without navigating away
async function startMatchInProgress(match: Match) {
  try {
    await matchStore.startMatch(tournamentId.value, match.id, match.categoryId);

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
  selectedMatch.value = match;
  // Pre-fill with existing scores if any
  if (match.scores && match.scores.length > 0) {
    manualScores.value = match.scores.map(g => ({
      score1: g.score1 || 0,
      score2: g.score2 || 0,
    }));
    // Ensure we have 3 games
    while (manualScores.value.length < 3) {
      manualScores.value.push({ score1: 0, score2: 0 });
    }
  } else {
    manualScores.value = [
      { score1: 0, score2: 0 },
      { score1: 0, score2: 0 },
      { score1: 0, score2: 0 },
    ];
  }
  showManualScoreDialog.value = true;
}

// Submit manual scores
async function submitManualScores() {
  if (!selectedMatch.value) return;

  submittingScores.value = true;
  try {
    const match = selectedMatch.value;

    // Build game scores with winner calculation
    const games = manualScores.value
      .filter(g => g.score1 > 0 || g.score2 > 0) // Only include games with scores
      .map((g, index) => {
        const isComplete = (g.score1 >= 21 || g.score2 >= 21) &&
          (Math.abs(g.score1 - g.score2) >= 2 || g.score1 === 30 || g.score2 === 30);
        let winnerId: string | undefined = undefined;
        if (isComplete) {
          winnerId = g.score1 > g.score2 ? match.participant1Id : match.participant2Id;
        }
        return {
          gameNumber: index + 1,
          score1: g.score1,
          score2: g.score2,
          isComplete,
          winnerId,
        };
      });

    await matchStore.submitManualScores(tournamentId.value, match.id, games, match.categoryId);

    // Log activity if match completed (non-blocking)
    const p1Wins = games.filter(g => g.winnerId === match.participant1Id).length;
    const p2Wins = games.filter(g => g.winnerId === match.participant2Id).length;
    if (p1Wins >= 2 || p2Wins >= 2) {
      const winnerName = p1Wins >= 2
        ? getParticipantName(match.participant1Id)
        : getParticipantName(match.participant2Id);
      const scoreString = games.map(g => `${g.score1}-${g.score2}`).join(', ');
      activityStore.logMatchCompleted(
        tournamentId.value,
        match.id,
        getParticipantName(match.participant1Id),
        getParticipantName(match.participant2Id),
        winnerName,
        scoreString,
        getCourtName(match.courtId),
        getCategoryName(match.categoryId)
      ).catch((err) => console.warn('Activity logging failed:', err));
    }

    notificationStore.showToast('success', 'Scores saved');
    showManualScoreDialog.value = false;
  } catch (error) {
    console.error('Error submitting scores:', error);
    notificationStore.showToast('error', 'Failed to save scores');
  } finally {
    submittingScores.value = false;
  }
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
    (m) => (m.status === 'scheduled' || m.status === 'ready') && m.participant1Id && m.participant2Id && !m.courtId
  );
  // Filter by selected categories
  if (selectedCategoryIds.value.length > 0) {
    result = result.filter((m) => selectedCategoryIds.value.includes(m.categoryId));
  } else {
    // No categories selected = no matches to schedule
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
const showResetConfirmDialog = ref(false);

// Reset schedule for selected category
async function resetSchedule() {
  // Show confirmation dialog instead of native confirm()
  showResetConfirmDialog.value = true;
}

// Actually perform the reset after confirmation
async function confirmResetSchedule() {
  showResetConfirmDialog.value = false;

  // Use selected categories or 'all' if all are selected
  const categoryIdsToReset = allCategoriesSelected.value ? 'all' : selectedCategoryIds.value;
  const categoryName = allCategoriesSelected.value
    ? 'all categories'
    : selectedCategoryIds.value.map(id => getCategoryName(id)).join(', ');

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

      // Log activity (non-blocking - don't fail reset if logging fails)
      activityStore.logActivity(
        tournamentId.value,
        'announcement',
        `Schedule reset for ${categoryName}: ${result.resetCount} matches cleared`
      );
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
      const result = await scheduler.scheduleMatches(tournamentId.value, {
        categoryId,
        courtIds: allCourts.map((c) => c.id),
        startTime,
        respectDependencies: true,
      });

      totalScheduled += result.scheduled.length;
      totalUnscheduled = [...totalUnscheduled, ...result.unscheduled];

      // Store the last result for display
      autoScheduleResult.value = result;
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
        showAutoScheduleDialog.value = false;
        autoScheduleResult.value = null;
      }
    }
  } catch (error) {
    console.error('Auto-schedule error:', error);
    notificationStore.showToast('error', 'Failed to auto-schedule');
  }
}

async function releaseCourt(match: Match) {
  if (!match.courtId) return;

  try {
    // Release the court
    await tournamentStore.updateCourt(tournamentId.value, match.courtId, {
      status: 'available',
      currentMatchId: undefined,
    });
    notificationStore.showToast('success', 'Court released');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to release court');
  }
}

// Auto-assign state
const autoAssignEnabled = ref(true);

/**
 * Manually assign a match to a court
 */
async function handleManualAssign(matchId: string, courtId: string) {
  const match = matches.value.find((m) => m.id === matchId);
  if (!match) return;

  try {
    await tournamentStore.assignMatchToCourt(
      tournamentId.value,
      matchId,
      courtId,
      match.categoryId
    );

    notificationStore.showToast('success', 'Court assigned');

    // Log activity
    const p1 = getParticipantName(match.participant1Id);
    const p2 = getParticipantName(match.participant2Id);
    const court = courts.value.find((c) => c.id === courtId);
    activityStore.logActivity(
      tournamentId.value,
      'match_assigned',
      `${p1} vs ${p2} → ${court?.name}`
    );
  } catch (error) {
    notificationStore.showToast('error', 'Failed to assign court');
  }
}

/**
 * Auto-assign next queued match to a court
 */
async function handleAutoAssign(courtId: string) {
  const nextMatch = pendingMatches.value[0];
  if (!nextMatch) {
    notificationStore.showToast('info', 'No matches in queue');
    return;
  }
  await handleManualAssign(nextMatch.id, courtId);
}

/**
 * Release a court (make it available)
 */
async function handleReleaseCourt(courtId: string) {
  try {
    await tournamentStore.releaseCourtManual(tournamentId.value, courtId);
    notificationStore.showToast('success', 'Court released');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to release court');
  }
}

/**
 * Toggle auto-assignment on/off
 */
function toggleAutoAssign(enabled: boolean) {
  autoAssignEnabled.value = enabled;
  tournamentStore.updateTournament(tournamentId.value, {
    settings: {
      ...tournament.value?.settings,
      autoAssignEnabled: enabled,
    },
  });
}

/**
 * Set court to maintenance mode
 */
async function handleSetMaintenance(courtId: string) {
  try {
    await tournamentStore.updateCourt(tournamentId.value, courtId, {
      status: 'maintenance',
    });
    notificationStore.showToast('info', 'Court set to maintenance');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to set maintenance');
  }
}

/**
 * Restore court from maintenance
 */
async function handleRestoreCourt(courtId: string) {
  try {
    await tournamentStore.updateCourt(tournamentId.value, courtId, {
      status: 'available',
    });
    notificationStore.showToast('success', 'Court restored');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to restore court');
  }
}
</script>

<template>
  <v-container fluid>
    <!-- Header -->
    <div class="d-flex align-center mb-4">
      <v-btn icon="mdi-arrow-left" variant="text" @click="router.back()" />
      <div class="ml-2 flex-grow-1">
        <h1 class="text-h5 font-weight-bold">Match Control</h1>
        <p class="text-body-2 text-grey">{{ tournament?.name }}</p>
      </div>
      <div class="d-flex gap-2">
        <v-btn
          variant="outlined"
          prepend-icon="mdi-share-variant"
          @click="showShareDialog = true"
        >
          Share Links
        </v-btn>
        <v-btn
          variant="outlined"
          prepend-icon="mdi-calendar-clock"
          @click="openAutoScheduleDialog"
        >
          Auto Schedule
        </v-btn>
        <v-btn
          color="primary"
          prepend-icon="mdi-monitor"
          :to="{ name: 'public-live-scores', params: { tournamentId } }"
          target="_blank"
        >
          Live View
        </v-btn>
      </div>
    </div>

    <!-- Stats Row -->
    <v-row class="mb-4">
      <v-col cols="6" sm="4" md="2" lg="1">
        <v-card variant="tonal" color="grey">
          <v-card-text class="text-center pa-2">
            <div class="text-h6 font-weight-bold">{{ stats.pending }}</div>
            <div class="text-caption">Needs Court</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" sm="4" md="2" lg="1">
        <v-card variant="tonal" color="info">
          <v-card-text class="text-center pa-2">
            <div class="text-h6 font-weight-bold">{{ stats.scheduled }}</div>
            <div class="text-caption">Scheduled</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" sm="4" md="2" lg="1">
        <v-card variant="tonal" color="warning">
          <v-card-text class="text-center pa-2">
            <div class="text-h6 font-weight-bold">{{ stats.ready }}</div>
            <div class="text-caption">Ready</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" sm="4" md="2" lg="1">
        <v-card variant="tonal" color="success">
          <v-card-text class="text-center pa-2">
            <div class="text-h6 font-weight-bold">{{ stats.inProgress }}</div>
            <div class="text-caption">Playing</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" sm="4" md="2" lg="1">
        <v-card variant="tonal" color="secondary">
          <v-card-text class="text-center pa-2">
            <div class="text-h6 font-weight-bold">{{ stats.completed }}</div>
            <div class="text-caption">Done</div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col cols="6" sm="4" md="2" lg="1">
        <v-card variant="tonal" color="primary">
          <v-card-text class="text-center pa-2">
            <div class="text-h6 font-weight-bold">{{ stats.courtsAvailable }}</div>
            <div class="text-caption">Courts Free</div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Category Filter & View Toggle -->
    <v-row class="mb-4">
      <v-col cols="12" sm="6">
        <v-select
          v-model="selectedCategory"
          :items="categoryOptions"
          item-title="name"
          item-value="id"
          label="Filter by Category"
          variant="outlined"
          density="compact"
          hide-details
        />
      </v-col>
      <v-col cols="12" sm="6">
        <v-btn-toggle v-model="viewMode" mandatory color="primary" density="compact">
          <v-btn value="queue">
            <v-icon start>mdi-format-list-bulleted</v-icon>
            Queue
          </v-btn>
          <v-btn value="courts">
            <v-icon start>mdi-scoreboard</v-icon>
            Live Scores
          </v-btn>
          <v-btn value="schedule">
            <v-icon start>mdi-calendar</v-icon>
            Schedule
          </v-btn>
        </v-btn-toggle>
      </v-col>
    </v-row>

    <!-- Queue View -->
    <template v-if="viewMode === 'queue'">
      <v-row>
        <!-- Left: Court Status Board -->
        <v-col cols="12" lg="6">
          <CourtStatusBoard
            :courts="courts"
            :matches="matches"
            :available-courts="availableCourts"
            :next-queued-match="pendingMatches[0] || null"
            @assign-next="handleAutoAssign"
            @release-court="handleReleaseCourt"
            @set-maintenance="handleSetMaintenance"
            @restore-court="handleRestoreCourt"
          />
        </v-col>

        <!-- Right: In-Progress + Queue -->
        <v-col cols="12" lg="6">
          <!-- In Progress Matches -->
          <v-card class="mb-4">
            <v-card-title class="d-flex align-center">
              <v-icon start color="success">mdi-play-circle</v-icon>
              In Progress ({{ inProgressMatches.length }})
            </v-card-title>

            <v-list v-if="inProgressMatches.length > 0" density="compact">
              <v-list-item
                v-for="match in inProgressMatches"
                :key="`${match.categoryId}-${match.id}`"
                class="match-item"
              >
                <div class="d-flex align-center w-100">
                  <div class="flex-grow-1">
                    <div class="font-weight-medium text-body-2">
                      {{ getParticipantName(match.participant1Id) }}
                      <span class="text-grey mx-1">vs</span>
                      {{ getParticipantName(match.participant2Id) }}
                    </div>
                    <div class="text-caption text-grey">
                      {{ getCategoryName(match.categoryId) }} - Round {{ match.round }}
                    </div>
                  </div>
                  <div class="text-center mx-2">
                    <div class="text-h6 font-weight-bold">{{ getCurrentScore(match) }}</div>
                    <div class="text-caption text-grey">{{ getGamesScore(match) }}</div>
                  </div>
                  <div class="text-right">
                    <v-chip color="success" size="x-small" class="mb-1">
                      {{ getCourtName(match.courtId) }}
                    </v-chip>
                    <br>
                    <v-btn
                      size="x-small"
                      color="primary"
                      @click="openManualScoreDialog(match)"
                    >
                      Enter Scores
                    </v-btn>
                  </div>
                </div>
              </v-list-item>
            </v-list>

            <v-card-text v-else class="text-center text-grey py-4">
              No matches in progress
            </v-card-text>
          </v-card>

          <!-- Match Queue List -->
          <MatchQueueList
            :matches="pendingMatches"
            :available-courts="availableCourts"
            :auto-assign-enabled="autoAssignEnabled"
            @manual-assign="handleManualAssign"
            @toggle-auto-assign="toggleAutoAssign"
          />
        </v-col>
      </v-row>

      <!-- Activity Feed in Queue View -->
      <v-row class="mt-4">
        <v-col cols="12">
          <ActivityFeed
            :activities="activities"
            :max-items="10"
            title="Recent Activity"
          />
        </v-col>
      </v-row>
    </template>

    <!-- Courts View -->
    <template v-if="viewMode === 'courts'">
      <v-row>
        <v-col
          v-for="court in courts"
          :key="court.id"
          cols="12"
          sm="6"
          md="4"
          lg="3"
        >
          <v-card
            :color="court.status === 'in_use' ? 'success' : court.status === 'maintenance' ? 'warning' : 'grey-lighten-4'"
            :variant="court.status === 'available' ? 'outlined' : 'flat'"
            class="court-card"
          >
            <v-card-title class="d-flex align-center">
              <v-icon start>mdi-badminton</v-icon>
              {{ court.name }}
              <v-spacer />
              <v-chip
                :color="court.status === 'in_use' ? 'white' : court.status === 'maintenance' ? 'black' : 'grey'"
                size="x-small"
                :variant="court.status === 'in_use' ? 'flat' : 'tonal'"
              >
                {{ court.status }}
              </v-chip>
            </v-card-title>

            <v-card-text>
              <template v-if="court.status === 'in_use' || getMatchForCourt(court.id)">
                <div v-if="getMatchForCourt(court.id)" class="match-on-court">
                  <div class="text-body-2 font-weight-medium mb-1">
                    {{ getParticipantName(getMatchForCourt(court.id)?.participant1Id) }}
                  </div>
                  <div class="text-h4 font-weight-bold text-center my-2">
                    {{ getCurrentScore(getMatchForCourt(court.id)!) }}
                  </div>
                  <div class="text-body-2 font-weight-medium text-right">
                    {{ getParticipantName(getMatchForCourt(court.id)?.participant2Id) }}
                  </div>
                  <div class="text-caption text-center mt-2">
                    Games: {{ getGamesScore(getMatchForCourt(court.id)!) }}
                  </div>
                </div>
              </template>
              <template v-else-if="court.status === 'available'">
                <div class="text-center py-4 text-grey">
                  <v-icon size="32">mdi-checkbox-blank-circle-outline</v-icon>
                  <p class="text-caption mt-2">Available</p>
                </div>
              </template>
              <template v-else>
                <div class="text-center py-4">
                  <v-icon size="32">mdi-wrench</v-icon>
                  <p class="text-caption mt-2">Maintenance</p>
                </div>
              </template>
            </v-card-text>

            <v-card-actions v-if="court.status !== 'maintenance'">
              <template v-if="getMatchForCourt(court.id)">
                <v-btn
                  size="small"
                  variant="text"
                  @click="goToScoring(getMatchForCourt(court.id)!)"
                >
                  Score
                </v-btn>
              </template>
              <template v-else-if="court.status === 'available' && pendingMatches.length > 0">
                <v-btn
                  size="small"
                  color="primary"
                  variant="text"
                  @click="quickAssignCourt(pendingMatches[0], court)"
                >
                  Assign Next Match
                </v-btn>
              </template>
            </v-card-actions>
          </v-card>
        </v-col>

        <v-col v-if="courts.length === 0" cols="12">
          <v-card class="text-center py-8">
            <v-icon size="64" color="grey-lighten-1">mdi-badminton</v-icon>
            <p class="text-body-1 text-grey mt-4">No courts configured</p>
            <v-btn
              color="primary"
              class="mt-4"
              :to="{ name: 'tournament-settings', params: { tournamentId } }"
            >
              Add Courts
            </v-btn>
          </v-card>
        </v-col>
      </v-row>
    </template>

    <!-- Schedule View -->
    <template v-if="viewMode === 'schedule'">
      <v-card>
        <v-card-title class="d-flex align-center flex-wrap">
          <span>Match Schedule</span>
          <v-spacer />
          <v-chip size="small" color="primary" variant="tonal">
            {{ filteredMatches.length }} matches
          </v-chip>
        </v-card-title>

        <!-- Quick Filter Chips -->
        <v-card-text class="pb-0">
          <div class="d-flex align-center flex-wrap gap-2 mb-4">
            <span class="text-caption text-grey mr-2">Quick Filter:</span>
            <v-chip
              v-for="filter in quickFilters"
              :key="filter.value"
              :color="scheduleFilters.status === filter.value ? filter.color : 'default'"
              :variant="scheduleFilters.status === filter.value ? 'flat' : 'tonal'"
              size="small"
              class="cursor-pointer"
              @click="scheduleFilters.status = filter.value"
            >
              {{ filter.label }}
            </v-chip>
          </div>

          <!-- Filter Controls -->
          <v-row class="mb-2">
            <v-col cols="12" sm="6" md="3">
              <v-text-field
                v-model="scheduleFilters.searchQuery"
                label="Search players or match #"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                hide-details
                clearable
              />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-select
                v-model="scheduleFilters.status"
                :items="statusOptions"
                item-title="name"
                item-value="value"
                label="Status"
                variant="outlined"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-select
                v-model="scheduleFilters.courtId"
                :items="courtOptions"
                item-title="name"
                item-value="id"
                label="Court"
                variant="outlined"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <div class="d-flex gap-2">
                <v-select
                  v-model="scheduleFilters.sortBy"
                  :items="[
                    { name: 'Match #', value: 'matchNumber' },
                    { name: 'Round', value: 'round' },
                    { name: 'Category', value: 'category' },
                    { name: 'Players', value: 'participants' },
                    { name: 'Court', value: 'court' },
                    { name: 'Time', value: 'time' },
                    { name: 'Status', value: 'status' },
                  ]"
                  item-title="name"
                  item-value="value"
                  label="Sort by"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="flex-grow-1"
                />
                <v-btn
                  :icon="scheduleFilters.sortDesc ? 'mdi-sort-descending' : 'mdi-sort-ascending'"
                  variant="outlined"
                  density="compact"
                  size="small"
                  class="mt-1"
                  @click="scheduleFilters.sortDesc = !scheduleFilters.sortDesc"
                />
              </div>
            </v-col>
          </v-row>

          <!-- Reset Filters -->
          <div class="d-flex justify-end mb-2">
            <v-btn
              size="small"
              variant="text"
              color="grey"
              prepend-icon="mdi-filter-off"
              @click="resetScheduleFilters"
            >
              Reset Filters
            </v-btn>
          </div>
        </v-card-text>

        <v-divider />

        <v-data-table
          :headers="[
            { title: '#', key: 'matchNumber', width: '60px', sortable: false },
            { title: 'Round', key: 'round', width: '80px', sortable: false },
            { title: 'ID', key: 'id', width: '50px', sortable: false },
            { title: 'Category', key: 'category', sortable: false },
            { title: 'Match', key: 'participants', sortable: false },
            { title: 'Court', key: 'court', sortable: false },
            { title: 'Time', key: 'time', sortable: false },
            { title: 'Status', key: 'status', sortable: false },
            { title: 'Actions', key: 'actions', sortable: false },
          ]"
          :items="filteredMatches"
          :items-per-page="20"
          class="elevation-0"
        >
          <template #item.category="{ item }">
            <v-chip size="small" variant="outlined">
              {{ getCategoryName(item.categoryId) }}
            </v-chip>
          </template>
          <template #item.participants="{ item }">
            <span class="font-weight-medium">
              {{ getParticipantName(item.participant1Id) }}
            </span>
            <span class="text-grey mx-1">vs</span>
            <span class="font-weight-medium">
              {{ getParticipantName(item.participant2Id) }}
            </span>
          </template>
          <template #item.court="{ item }">
            {{ getCourtName(item.courtId) }}
          </template>
          <template #item.time="{ item }">
            {{ item.scheduledTime ? new Date(item.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-' }}
          </template>
          <template #item.status="{ item }">
            <v-chip
              :color="
                item.status === 'completed' ? 'success' :
                item.status === 'in_progress' ? 'info' :
                item.status === 'ready' ? 'warning' :
                'grey'
              "
              size="small"
            >
              {{ item.status }}
            </v-chip>
          </template>
          <template #item.actions="{ item }">
            <v-btn
              v-if="item.status === 'scheduled' && item.participant1Id && item.participant2Id"
              icon="mdi-calendar-edit"
              size="small"
              variant="text"
              @click="openScheduleDialog(item)"
            />
            <v-btn
              v-if="item.status === 'in_progress' || item.status === 'ready'"
              icon="mdi-scoreboard"
              size="small"
              variant="text"
              color="primary"
              @click="goToScoring(item)"
            />
          </template>
        </v-data-table>
      </v-card>
    </template>

    <!-- Auto Schedule Dialog -->
    <v-dialog v-model="showAutoScheduleDialog" max-width="550">
      <v-card>
        <v-card-title>
          <v-icon start>mdi-calendar-clock</v-icon>
          Auto Schedule Matches
        </v-card-title>
        <v-card-text>
          <!-- Category Multi-Select -->
          <div class="mb-4">
            <div class="d-flex align-center justify-space-between mb-2">
              <div class="text-body-2 font-weight-medium">Select Categories to Schedule</div>
              <div>
                <v-btn
                  v-if="!allCategoriesSelected"
                  size="x-small"
                  variant="text"
                  color="primary"
                  @click="selectAllCategories"
                >
                  Select All
                </v-btn>
                <v-btn
                  v-else
                  size="x-small"
                  variant="text"
                  color="grey"
                  @click="deselectAllCategories"
                >
                  Deselect All
                </v-btn>
              </div>
            </div>
            <div class="category-checkboxes">
              <v-checkbox
                v-for="category in categories"
                :key="category.id"
                v-model="selectedCategoryIds"
                :label="category.name"
                :value="category.id"
                density="compact"
                hide-details
                class="mb-1"
              />
            </div>
            <div v-if="selectedCategoryIds.length === 0" class="text-caption text-error mt-1">
              Please select at least one category
            </div>
          </div>

          <!-- Status summary for selected categories -->
          <v-alert
            v-if="alreadyScheduledCount > 0"
            type="warning"
            variant="tonal"
            class="mb-4"
          >
            <div class="d-flex align-center justify-space-between">
              <div>
                <strong>{{ alreadyScheduledCount }}</strong> matches already have court/time assigned.
              </div>
              <v-btn
                size="small"
                color="warning"
                variant="text"
                :loading="resettingSchedule"
                @click="resetSchedule"
              >
                Reset Schedule
              </v-btn>
            </div>
          </v-alert>

          <v-alert type="info" variant="tonal" class="mb-4" density="compact">
            Matches will be distributed across courts by round, with load balancing.
          </v-alert>

          <v-text-field
            v-model="autoScheduleConfig.startTime"
            label="Start Time"
            type="datetime-local"
            variant="outlined"
          />

          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model.number="autoScheduleConfig.matchDurationMinutes"
                label="Match Duration (min)"
                type="number"
                variant="outlined"
                min="10"
                max="60"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="autoScheduleConfig.breakBetweenMatches"
                label="Break Between (min)"
                type="number"
                variant="outlined"
                min="0"
                max="30"
              />
            </v-col>
          </v-row>

          <!-- Courts info -->
          <div class="mb-2">
            <div class="text-body-2 font-weight-medium mb-1">Courts ({{ courts.filter(c => c.status !== 'maintenance').length }} available):</div>
            <div class="d-flex flex-wrap gap-1">
              <v-chip
                v-for="court in courts"
                :key="court.id"
                :color="court.status === 'maintenance' ? 'error' : court.status === 'in_use' ? 'warning' : 'success'"
                size="small"
                variant="tonal"
              >
                {{ court.name }}
                <span v-if="court.status === 'maintenance'" class="ml-1">(maintenance)</span>
                <span v-else-if="court.status === 'in_use'" class="ml-1">(in use)</span>
              </v-chip>
            </div>
          </div>

          <v-divider class="my-3" />

          <div class="text-body-2">
            <strong>{{ matchesToScheduleForAuto.length }}</strong> matches ready to schedule
            <span v-if="matchesToScheduleForAuto.length > 0" class="text-grey">
              (Round {{ matchesToScheduleForAuto[0]?.round }} - {{ matchesToScheduleForAuto[matchesToScheduleForAuto.length - 1]?.round }})
            </span>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-btn
            v-if="alreadyScheduledCount > 0"
            variant="outlined"
            color="warning"
            :loading="resettingSchedule"
            @click="resetSchedule"
          >
            <v-icon start>mdi-refresh</v-icon>
            Reset & Reschedule
          </v-btn>

          <!-- Unscheduled Matches Alert -->
          <v-alert
            v-if="autoScheduleResult && autoScheduleResult.unscheduled.length > 0"
            type="warning"
            variant="tonal"
            class="mt-4"
          >
            <div class="d-flex align-center">
              <v-icon icon="mdi-alert" class="mr-2" />
              <div class="font-weight-bold">
                {{ autoScheduleResult.unscheduled.length }} match(es) could not be scheduled
              </div>
            </div>

            <v-divider class="my-2" />

            <v-list density="compact" class="bg-transparent">
              <v-list-item
                v-for="item in autoScheduleResult.unscheduled"
                :key="item.matchId"
                class="px-0"
              >
                <template #prepend>
                  <v-icon icon="mdi-information" size="small" color="warning" />
                </template>
                <v-list-item-title>
                  Match ID: {{ item.matchId }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-warning">
                  {{ item.reason || 'Unknown reason' }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-alert>

          <v-spacer />
          <v-btn variant="text" @click="showAutoScheduleDialog = false; autoScheduleResult = null">Cancel</v-btn>
          <v-btn
            color="primary"
            :disabled="matchesToScheduleForAuto.length === 0 || courts.filter(c => c.status !== 'maintenance').length === 0"
            @click="runAutoSchedule"
          >
            Schedule {{ matchesToScheduleForAuto.length }} Matches
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Reset Schedule Confirmation Dialog -->
    <v-dialog v-model="showResetConfirmDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">
          <v-icon start color="warning">mdi-alert</v-icon>
          Reset Schedule?
        </v-card-title>
        <v-card-text>
          <p>This will clear all court and time assignments for matches that haven't started yet.</p>
          <p class="mt-2 text-body-2 text-grey">
            Categories: <strong>{{ selectedCategoryIds.length === categories.length ? 'All Categories' : selectedCategoryIds.map(id => getCategoryName(id)).join(', ') }}</strong>
          </p>
          <p class="text-body-2 text-grey">
            Matches to reset: <strong>{{ alreadyScheduledCount }}</strong>
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showResetConfirmDialog = false">Cancel</v-btn>
          <v-btn
            color="warning"
            variant="flat"
            @click="confirmResetSchedule"
          >
            Reset Schedule
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Manual Score Entry Dialog -->
    <v-dialog v-model="showManualScoreDialog" max-width="450">
      <v-card v-if="selectedMatch">
        <v-card-title>
          <v-icon start>mdi-scoreboard</v-icon>
          Enter Scores
        </v-card-title>
        <v-card-text>
          <div class="text-body-1 font-weight-medium mb-2">
            {{ getParticipantName(selectedMatch.participant1Id) }}
            <span class="text-grey mx-1">vs</span>
            {{ getParticipantName(selectedMatch.participant2Id) }}
          </div>
          <div class="text-caption text-grey mb-4">
            {{ getCategoryName(selectedMatch.categoryId) }} | {{ getCourtName(selectedMatch.courtId) }}
          </div>

          <!-- Game scores -->
          <div v-for="(game, index) in manualScores" :key="index" class="mb-3">
            <div class="text-caption text-grey mb-1">Game {{ index + 1 }}</div>
            <div class="d-flex align-center gap-2">
              <v-text-field
                v-model.number="game.score1"
                type="number"
                min="0"
                max="30"
                variant="outlined"
                density="compact"
                hide-details
                class="score-input"
              />
              <span class="text-grey">-</span>
              <v-text-field
                v-model.number="game.score2"
                type="number"
                min="0"
                max="30"
                variant="outlined"
                density="compact"
                hide-details
                class="score-input"
              />
            </div>
          </div>

          <v-alert type="info" variant="tonal" density="compact" class="mt-4">
            Enter final scores for each game. Match completes when a player wins 2 games.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showManualScoreDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            :loading="submittingScores"
            @click="submitManualScores"
          >
            Save Scores
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Manual Schedule Dialog -->
    <v-dialog v-model="showScheduleDialog" max-width="500">
      <v-card v-if="selectedMatch">
        <v-card-title>
          <v-icon start>mdi-calendar-edit</v-icon>
          Edit Schedule
        </v-card-title>
        <v-card-text>
          <div class="text-body-1 font-weight-medium mb-4">
            {{ getParticipantName(selectedMatch.participant1Id) }}
            <span class="text-grey mx-1">vs</span>
            {{ getParticipantName(selectedMatch.participant2Id) }}
          </div>

          <v-select
            v-model="selectedCourtId"
            :items="courts"
            item-title="name"
            item-value="id"
            label="Assign Court"
            variant="outlined"
            clearable
          />

          <v-text-field
            v-model="scheduledTime"
            label="Scheduled Time"
            type="datetime-local"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showScheduleDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="saveSchedule">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Share Links Dialog -->
    <v-dialog v-model="showShareDialog" max-width="500">
      <v-card>
        <v-card-title>
          <v-icon start>mdi-share-variant</v-icon>
          Share Links
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 text-grey mb-4">
            Share these links with volunteers and spectators. No login required!
          </p>

          <!-- Scoring Link -->
          <v-card variant="outlined" class="mb-4">
            <v-card-item>
              <template #prepend>
                <v-avatar color="success" size="48">
                  <v-icon>mdi-scoreboard</v-icon>
                </v-avatar>
              </template>
              <v-card-title class="text-body-1">Volunteer Scoring</v-card-title>
              <v-card-subtitle>Anyone can pick a match and score</v-card-subtitle>
            </v-card-item>
            <v-card-text class="pt-0">
              <v-text-field
                :model-value="scoringUrl"
                readonly
                variant="outlined"
                density="compact"
                hide-details
                class="mb-2"
              >
                <template #append-inner>
                  <v-btn
                    icon="mdi-content-copy"
                    size="small"
                    variant="text"
                    @click="copyToClipboard(scoringUrl, 'Scoring link')"
                  />
                </template>
              </v-text-field>
              <div class="d-flex gap-2">
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-open-in-new"
                  :href="scoringUrl"
                  target="_blank"
                >
                  Open
                </v-btn>
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-qrcode"
                  @click="copyToClipboard(scoringUrl, 'Scoring link')"
                >
                  Copy for QR
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <!-- Live Scores Link -->
          <v-card variant="outlined">
            <v-card-item>
              <template #prepend>
                <v-avatar color="info" size="48">
                  <v-icon>mdi-monitor</v-icon>
                </v-avatar>
              </template>
              <v-card-title class="text-body-1">Live Scores (Spectators)</v-card-title>
              <v-card-subtitle>View-only live score updates</v-card-subtitle>
            </v-card-item>
            <v-card-text class="pt-0">
              <v-text-field
                :model-value="liveUrl"
                readonly
                variant="outlined"
                density="compact"
                hide-details
                class="mb-2"
              >
                <template #append-inner>
                  <v-btn
                    icon="mdi-content-copy"
                    size="small"
                    variant="text"
                    @click="copyToClipboard(liveUrl, 'Live scores link')"
                  />
                </template>
              </v-text-field>
              <div class="d-flex gap-2">
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-open-in-new"
                  :href="liveUrl"
                  target="_blank"
                >
                  Open
                </v-btn>
                <v-btn
                  size="small"
                  variant="tonal"
                  prepend-icon="mdi-qrcode"
                  @click="copyToClipboard(liveUrl, 'Live scores link')"
                >
                  Copy for QR
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <v-alert type="info" variant="tonal" class="mt-4" density="compact">
            <div class="text-caption">
              Tip: Use a free QR code generator (like qr-code-generator.com) to create printable QR codes from these links.
            </div>
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showShareDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.match-item {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  padding: 12px 16px;
}

.match-item:last-child {
  border-bottom: none;
}

.court-card {
  height: 100%;
  min-height: 200px;
}

.match-on-court {
  min-height: 120px;
}

.score-input {
  max-width: 80px;
}

.score-input :deep(input) {
  text-align: center;
  font-weight: bold;
  font-size: 1.1rem;
}
</style>
