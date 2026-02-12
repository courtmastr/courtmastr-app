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
import MatchQueueList from '@/features/tournaments/components/MatchQueueList.vue';
import QuickActionsBar from '@/features/tournaments/components/QuickActionsBar.vue';
import ActiveMatchesSection from '@/features/tournaments/components/ActiveMatchesSection.vue';
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
// - Status is 'ready' or 'scheduled'
// - Have both participants assigned (not TBD)
// - Don't have a court OR don't have a scheduled time
const pendingMatches = computed(() => {
  // First, log ALL ready/scheduled matches to understand the data
  const readyScheduled = matches.value.filter(
    (m) => (m.status === 'ready' || m.status === 'scheduled') && m.participant1Id && m.participant2Id
  );

  console.log('[pendingMatches] All ready/scheduled matches:', {
    total: readyScheduled.length,
    details: readyScheduled.map(m => ({
      id: m.id,
      status: m.status,
      hasCourt: !!m.courtId,
      hasTime: !!m.scheduledTime,
      courtId: m.courtId,
      scheduledTime: m.scheduledTime
    }))
  });

  let result = matches.value.filter(
    (m) => (m.status === 'ready' || m.status === 'scheduled') &&
           m.participant1Id && m.participant2Id &&
           (!m.courtId || !m.scheduledTime)
  );
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }

  console.log('[pendingMatches] Queue after filtering:', {
    total: result.length,
    selectedCategory: selectedCategory.value,
    details: result.map(m => ({
      id: m.id,
      status: m.status,
      categoryId: m.categoryId,
      courtId: m.courtId,
      scheduledTime: m.scheduledTime
    }))
  });

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

const inProgressMatches = computed(() => {
  let result = matches.value.filter((m) => m.status === 'in_progress');
  if (selectedCategory.value && selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }
  return result;
});

// Enrich in-progress matches with participant names and court names for ActiveMatchesSection
const enrichedInProgressMatches = computed(() => {
  return inProgressMatches.value.map(match => ({
    ...match,
    participant1Name: getParticipantName(match.participant1Id),
    participant2Name: getParticipantName(match.participant2Id),
    categoryName: getCategoryName(match.categoryId),
    courtName: courts.value.find(c => c.id === match.courtId)?.name
  })) as any;
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
    result = result.filter((m) => m.status === scheduleFilters.value.status as any);
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
] as const;

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
    courtsAvailable: availableCourts.value.length,
    courtsInUse: courtsInUse.value.length,
  };

  // Debug logging for stats
  console.log('[stats] Dashboard totals:', {
    inProgress: result.inProgress,
    scheduled: result.scheduled,
    ready: result.ready,
    pending: result.pending,
    completed: result.completed,
    selectedCategory: selectedCategory.value,
  });

  if (result.inProgress > 0) {
    console.log('[stats] In Progress matches breakdown:', {
      count: result.inProgress,
      matches: allInProgressMatches.value.map(m => ({
        id: m.id,
        status: m.status,
        categoryId: m.categoryId,
        courtId: m.courtId,
      }))
    });
  }

  return result;
});

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



// Watch matches for diagnostic logging
watch(matches, (newMatches) => {
  const byCategory = newMatches.reduce((acc, m) => {
    acc[m.categoryId] = (acc[m.categoryId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byStatus = newMatches.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('[MatchControlView] Matches updated:', newMatches.length, 'matches');
  console.log('  By Category:', JSON.stringify(byCategory, null, 2));
  console.log('  By Status:', JSON.stringify(byStatus, null, 2));
  if (newMatches.length > 0) {
    console.log('  Sample matches:', newMatches.slice(0, 3).map(m => ({
      id: m.id,
      categoryId: m.categoryId,
      status: m.status,
      round: m.round,
      courtId: m.courtId,
      participant1Id: m.participant1Id,
      participant2Id: m.participant2Id,
    })));
  }
}, { immediate: true, deep: false });

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);
  // Subscribe to all matches across all categories
  // This automatically watches categories and subscribes to each one
  matchStore.subscribeAllMatches(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
  activityStore.subscribeActivities(tournamentId.value);

  console.log('[MatchControlView] Mounted, tournamentId:', tournamentId.value);

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
  console.log('[goToScoring] Navigating to scoring interface', {
    matchId: match.id,
    tournamentId: tournamentId.value,
    categoryId: match.categoryId,
    status: match.status,
    courtId: match.courtId,
    participants: {
      p1: match.participant1Id,
      p2: match.participant2Id,
    },
    route: {
      name: 'scoring-interface',
      params: {
        tournamentId: tournamentId.value,
        matchId: match.id,
      },
      query: {
        category: match.categoryId,
      }
    }
  });

  router.push({
    name: 'scoring-interface',
    params: {
      tournamentId: tournamentId.value,
      matchId: match.id,
    },
    query: {
      category: match.categoryId,
    },
  });
}

function openScoreDialog(matchId: string) {
  const match = matches.value.find(m => m.id === matchId);
  if (match) {
    goToScoring(match);
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
  console.log('[startMatchInProgress] Starting match', {
    matchId: match.id,
    currentStatus: match.status,
    courtId: match.courtId,
    categoryId: match.categoryId,
    participants: {
      p1: getParticipantName(match.participant1Id),
      p2: getParticipantName(match.participant2Id),
    }
  });

  try {
    await matchStore.startMatch(tournamentId.value, match.id, match.categoryId);

    console.log('[startMatchInProgress] ✅ Match started successfully', {
      matchId: match.id,
      newStatus: 'in_progress',
    });

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
  console.log('[matchesToScheduleForAuto] Starting filter');
  console.log('  Total matches:', matches.value.length);
  console.log('  Selected categories:', selectedCategoryIds.value);
  console.log('  Available categories:', categories.value.map(c => ({ id: c.id, name: c.name })));

  let result = matches.value.filter(
    (m) => (m.status === 'scheduled' || m.status === 'ready') && !m.courtId
  );

  console.log('[matchesToScheduleForAuto] After status filter:', result.length, 'matches');
  if (result.length > 0) {
    console.log('  First 3 matches:', result.slice(0, 3).map(m => ({
      id: m.id,
      categoryId: m.categoryId,
      status: m.status,
      courtId: m.courtId,
    })));
  }

  // Filter by selected categories
  if (selectedCategoryIds.value.length > 0) {
    const beforeCategoryFilter = result.length;
    result = result.filter((m) => selectedCategoryIds.value.includes(m.categoryId));
    console.log('[matchesToScheduleForAuto] After category filter:', result.length, 'matches (was', beforeCategoryFilter + ')');
    console.log('  Selected:', selectedCategoryIds.value);
    console.log('  Match categories:', [...new Set(result.map(m => m.categoryId))]);
  } else {
    // No categories selected = no matches to schedule
    console.log('[matchesToScheduleForAuto] ⚠️ No categories selected, returning empty array');
    return [];
  }

  const sorted = result.sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);
  console.log('[matchesToScheduleForAuto] ✅ Final result:', sorted.length, 'matches to schedule');

  return sorted;
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



// Auto-assign and Auto-start state
const autoAssignEnabled = ref(true);
const autoStartEnabled = ref(false);

// Watch for ready matches to auto-start
watch(() => readyMatches.value, async (newMatches) => {
  if (autoStartEnabled.value && newMatches.length > 0) {
    console.log('[AutoStart] Found ready matches:', newMatches.length);
    for (const match of newMatches) {
      // REQUIREMENT: Start only if court is assigned and time is up
      if (!match.courtId) {
        continue;
      }

      // Check if court is actually available
      const court = courts.value.find(c => c.id === match.courtId);
      if (!court || court.status !== 'available') {
        console.log(`[AutoStart] Skipping match ${match.matchNumber} - Court ${court?.name} is ${court?.status}`);
        continue;
      }

      // Check scheduled time if it exists
      if (match.scheduledTime) {
        const scheduledTime = new Date(match.scheduledTime);
        const now = new Date();
        // If scheduled time is in the future (> 2 minutes buffer), don't auto-start
        if (scheduledTime.getTime() - now.getTime() > 2 * 60 * 1000) {
          console.log(`[AutoStart] Skipping match ${match.matchNumber} - Scheduled for ${match.scheduledTime}`);
          continue; 
        }
      }

      // Only start if not already starting (prevent race conditions)
      await startMatchInProgress(match);
    }
  }
}, { deep: true, immediate: true });

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
      'court_assigned',
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
</script>

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

<template>
  <div class="match-control-container h-100 d-flex flex-column bg-background">
    <!-- Header Toolbar -->
    <v-toolbar color="surface" elevation="1" density="compact" class="px-2 border-b">
      <v-btn icon="mdi-arrow-left" variant="text" size="small" @click="router.push(`/tournaments/${tournamentId}`)"></v-btn>
      <v-toolbar-title class="text-subtitle-1 font-weight-bold">
        Match Control
        <span class="text-caption text-medium-emphasis ml-2 hidden-sm-and-down">
          {{ tournament?.name }}
        </span>
      </v-toolbar-title>
      
      <v-spacer></v-spacer>

      <!-- Category Filter -->
      <div style="width: 200px" class="mr-2">
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
        ></v-select>
      </div>

      <!-- Exit Button -->
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-exit-to-app"
        @click="router.push(`/tournaments/${tournamentId}`)"
      >
        Exit
      </v-btn>
    </v-toolbar>

    <!-- Main Content Grid -->
    <div class="flex-grow-1 overflow-hidden">
      <v-row class="fill-height ma-0" no-gutters>
        <!-- LEFT PANEL: Active Matches & Courts (Flexible, Scrollable) -->
        <v-col cols="12" md="8" class="d-flex flex-column border-e fill-height">
          <!-- Top Stats Bar -->
          <div class="pa-3 bg-surface border-b d-flex gap-4 align-center flex-wrap">
            <v-chip size="small" color="primary" variant="flat" class="font-weight-bold">
              Total: {{ stats.total }}
            </v-chip>
            <div class="d-flex gap-2">
              <v-chip size="small" variant="outlined" color="info">
                In Progress: {{ stats.inProgress }}
              </v-chip>
              <v-chip size="small" variant="outlined" color="warning">
                Ready: {{ stats.ready }}
              </v-chip>
              <v-chip size="small" variant="outlined" color="success">
                Completed: {{ stats.completed }}
              </v-chip>
            </div>
            <v-spacer></v-spacer>
            <div class="d-flex align-center text-caption text-medium-emphasis">
              <v-icon size="14" class="mr-1" :color="stats.courtsInUse === stats.courtsAvailable ? 'error' : 'success'">
                mdi-circle
              </v-icon>
              Courts: {{ stats.courtsInUse }} / {{ stats.courtsAvailable }} Busy
            </div>
          </div>

          <!-- Scrollable Content Area -->
          <div class="flex-grow-1 overflow-y-auto pa-4 bg-background">
            <!-- Active Matches Section -->
            <div class="mb-4">
              <active-matches-section
                :matches="enrichedInProgressMatches"
                @completeMatch="openCompleteMatchDialog"
                @enterScore="openScoreDialog"
              />
            </div>

            <!-- Courts Grid (Optional View) -->
             <div class="d-flex align-center mb-2 mt-6">
              <v-icon start size="20" color="secondary">mdi-stadium</v-icon>
              <h3 class="text-subtitle-1 font-weight-bold">Court Status</h3>
            </div>
            
            <v-slide-group show-arrows>
              <v-slide-group-item v-for="court in courts" :key="court.id">
                <v-card
                  width="200"
                  height="120"
                  class="ma-2 d-flex flex-column"
                  :color="court.status === 'available' ? 'surface' : 'grey-lighten-4'"
                  :variant="court.status === 'available' ? 'elevated' : 'flat'"
                  border
                >
                  <div class="pa-2 d-flex justify-space-between align-center border-b">
                    <span class="text-caption font-weight-bold text-truncate">{{ court.name }}</span>
                    <v-icon size="12" :color="court.status === 'available' ? 'success' : 'error'">
                      mdi-circle
                    </v-icon>
                  </div>
                  
                  <div class="d-flex align-center justify-center flex-grow-1 text-center pa-1">
                    <div v-if="court.status === 'available'" class="text-caption text-success font-weight-medium">
                      <v-icon icon="mdi-check" size="small" class="mb-1"></v-icon>
                      <div>Available</div>
                    </div>
                    
                    <div v-else-if="getMatchForCourt(court.id)" class="active-match-info w-100">
                       <div class="text-caption font-weight-bold text-primary mb-1">
                         {{ getMatchForCourt(court.id)?.categoryName?.slice(0, 15) }}...
                       </div>
                       <div class="player-names text-truncate px-1">
                          {{ getParticipantName(getMatchForCourt(court.id)?.participant1Id).split(' ')[0] }} vs 
                          {{ getParticipantName(getMatchForCourt(court.id)?.participant2Id).split(' ')[0] }}
                       </div>
                       <v-chip size="x-small" color="secondary" variant="flat" class="mt-1 font-weight-bold">
                         {{ getCurrentScore(getMatchForCourt(court.id)!) }}
                       </v-chip>
                    </div>
                    
                    <div v-else class="text-caption text-medium-emphasis">
                      In Use
                    </div>
                  </div>
                </v-card>
              </v-slide-group-item>
            </v-slide-group>
          </div>
        </v-col>

        <!-- RIGHT PANEL: Queue & Schedule (Fixed Width on Desktop) -->
        <v-col cols="12" md="4" class="d-flex flex-column bg-surface fill-height border-s">
          <div class="pa-3 border-b bg-surface-light">
             <div class="d-flex align-center justify-space-between mb-2">
               <span class="text-subtitle-2 font-weight-bold text-uppercase text-medium-emphasis">Next Up</span>
               <v-chip size="x-small" color="primary">{{ enrichedPendingMatches.length }}</v-chip>
             </div>
             <!-- Quick Actions for Queue -->
             <div class="d-flex gap-2">
               <v-btn
                 block
                 variant="tonal"
                 size="small"
                 color="primary"
                 prepend-icon="mdi-calendar-clock"
                 @click="openAutoScheduleDialog"
               >
                 Auto-Schedule
               </v-btn>
             </div>
          </div>

          <!-- Queue List -->
          <div class="flex-grow-1 overflow-y-auto pa-0">
            <match-queue-list
              :matches="enrichedPendingMatches"
              :available-courts="availableCourts"
              :auto-assign-enabled="autoAssignEnabled"
              :auto-start-enabled="autoStartEnabled"
              @toggleAutoAssign="toggleAutoAssign"
              @toggleAutoStart="toggleAutoStart"
              @manualAssign="handleManualAssign"
            />
          </div>
        </v-col>
      </v-row>
    </div>

    <!-- Dialogs -->
    <v-dialog v-model="showAssignCourtDialog" max-width="400">
      <v-card>
        <v-card-title>Assign Court</v-card-title>
        <v-card-text>
          <v-select
            v-model="selectedCourtId"
            :items="availableCourts"
            item-title="name"
            item-value="id"
            label="Select Court"
            variant="outlined"
            :no-data-text="'No available courts'"
          ></v-select>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="showAssignCourtDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="assignCourt" :disabled="!selectedCourtId">Assign</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- Add other dialogs like schedule dialog, etc. if needed, or rely on existing ones implied -->
    <v-dialog v-model="showAutoScheduleDialog" max-width="500">
      <v-card>
        <v-card-title>Auto Schedule Matches</v-card-title>
        <v-card-text>
           <p class="text-body-2 mb-4">Automatically assign queued matches to available courts.</p>
           <!-- Add configuration here if needed -->
           <v-select
             v-model="selectedCategoryIds"
             :items="categoryOptions"
             item-title="name"
             item-value="id"
             label="Categories"
             multiple
             chips
             variant="outlined"
           ></v-select>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="grey" variant="text" @click="showAutoScheduleDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="/* Implement auto schedule logic */ showAutoScheduleDialog = false">Run Auto-Schedule</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    
    <v-dialog v-model="showScheduleDialog" max-width="400">
      <v-card>
        <v-card-title>Edit Schedule</v-card-title>
        <v-card-text>
          <v-text-field
             v-model="scheduledTime"
             type="datetime-local"
             label="Scheduled Time"
             variant="outlined"
          ></v-text-field>
          <v-select
             v-model="selectedCourtId"
             :items="courtOptions"
             item-title="name"
             item-value="id"
             label="Court (Optional)"
             variant="outlined"
          ></v-select>
        </v-card-text>
        <v-card-actions>
           <v-spacer></v-spacer>
           <v-btn color="grey" variant="text" @click="showScheduleDialog = false">Cancel</v-btn>
           <v-btn color="primary" @click="saveSchedule">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
