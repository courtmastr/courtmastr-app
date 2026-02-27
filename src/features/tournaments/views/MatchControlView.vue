<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useNotificationStore } from '@/stores/notifications';
import { useActivityStore } from '@/stores/activities';
import { useAuthStore } from '@/stores/auth';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useMatchSlotState } from '@/composables/useMatchSlotState';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import { useCategoryStageStatus } from '@/composables/useCategoryStageStatus';
import { useDialogManager } from '@/composables/useDialogManager';
import AssignCourtDialog from '@/features/tournaments/dialogs/AssignCourtDialog.vue';
import SelectMatchForCourtDialog from '@/features/tournaments/dialogs/SelectMatchForCourtDialog.vue';
import ScheduleMatchDialog from '@/features/tournaments/dialogs/ScheduleMatchDialog.vue';
import ManualScoreDialog from '@/features/tournaments/dialogs/ManualScoreDialog.vue';
import AutoScheduleDialog from '@/features/tournaments/dialogs/AutoScheduleDialog.vue';
import BaseDialog from '@/components/common/BaseDialog.vue';
import FilterBar from '@/components/common/FilterBar.vue';
import MatchQueueList from '@/features/tournaments/components/MatchQueueList.vue';
import CourtGrid from '@/features/tournaments/components/CourtGrid.vue';
import ReadyQueue from '@/features/tournaments/components/ReadyQueue.vue';
import AlertsPanel from '@/features/tournaments/components/AlertsPanel.vue';
import ScheduleGridView from '@/features/tournaments/components/ScheduleGridView.vue';
import { useTournamentStateAdvance } from '@/composables/useTournamentStateAdvance';
import type { Match } from '@/types';
import StateBanner from '@/features/tournaments/components/StateBanner.vue';
import type { ScheduleResult } from '@/composables/useMatchScheduler';
import {
  buildScheduleExportRows,
  downloadScheduleAsExcel,
} from '@/features/tournaments/utils/scheduleExport';
import {
  buildDisplayCodeMap,
  buildGlobalMatchKey,
} from '@/features/tournaments/utils/matchDisplayIdentity';
import {
  parseScheduleQueryCategory,
  parseScheduleQueryLayout,
  parseScheduleQueryPublicState,
} from './matchControlScheduleQuery';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const registrationStore = useRegistrationStore();
const notificationStore = useNotificationStore();
const activityStore = useActivityStore();
const authStore = useAuthStore();
const { getParticipantName } = useParticipantResolver();
const { getSlotLabel } = useMatchSlotState();
const { getMatchDisplayName } = useMatchDisplay();
const { open: openDialog, close: closeDialog, isOpen: isDialogOpen } = useDialogManager([
  'assignCourt', 'selectMatchForCourt', 'schedule', 'score', 'autoSchedule', 'release', 'reset', 'share'
]);

const isAdmin = computed(() => authStore.isAdmin);
const showUnlockDialog = ref(false);
const showCompleteTournamentDialog = ref(false);
const advanceLoading = ref(false);


const tournamentId = computed(() => route.params.tournamentId as string);

const autoScheduleResult = ref<ScheduleResult | null>(null);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const courts = computed(() => tournamentStore.courts);
const matches = computed(() => matchStore.matches);

interface MatchControlScheduleSettings {
  bufferMinutes?: number;
  autoReadyLeadMinutes?: number;
  emergencyScheduleBufferMinutes?: number;
  autoAssignDueWindowMinutes?: number;
}

const scheduleSettings = computed<MatchControlScheduleSettings>(
  () => (tournament.value?.settings ?? {}) as MatchControlScheduleSettings
);
const emergencyScheduleBufferMinutes = computed(() =>
  Math.max(1, Number(scheduleSettings.value.emergencyScheduleBufferMinutes ?? scheduleSettings.value.bufferMinutes ?? 10))
);
const autoAssignDueWindowMs = computed(() =>
  Math.max(1, Number(scheduleSettings.value.autoAssignDueWindowMinutes ?? scheduleSettings.value.bufferMinutes ?? 10)) * 60_000
);

const registrationsById = computed(() => {
  const lookup = new Map<string, { status?: string; isCheckedIn?: boolean }>();
  for (const registration of registrationStore.registrations) {
    lookup.set(registration.id, {
      status: registration.status,
      isCheckedIn: registration.isCheckedIn,
    });
  }
  return lookup;
});

const selectedCategory = ref<string>('all');
const viewMode = ref<'queue' | 'courts' | 'schedule' | 'command'>('command');

interface QueueMatchRef {
  matchId: string;
  categoryId: string;
  levelId?: string;
}

const scheduleFilters = ref({
  status: 'all' as 'all' | 'scheduled' | 'ready' | 'in_progress' | 'completed' | 'cancelled',
  publicState: 'all' as 'all' | 'published' | 'draft' | 'not_scheduled',
  courtId: 'all' as string,
  searchQuery: '',
  sortBy: 'time' as string,
  sortDesc: false,
});

const scheduleViewMode = ref<'compact' | 'full'>('compact');

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'grey',
  ready: 'warning',
  in_progress: 'info',
  completed: 'success',
  walkover: 'success',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'grey';
}

const publicStateQuickFilters = [
  { label: 'All', value: 'all' },
  { label: 'Published', value: 'published' },
  { label: 'Draft', value: 'draft' },
  { label: 'Not Scheduled', value: 'not_scheduled' },
] as const;

const { categoryStageStatuses } = useCategoryStageStatus(
  categories,
  matches,
  getParticipantName
);

const levelGenerationCategories = computed(() =>
  categoryStageStatuses.value.filter((s) => s.needsLevelGeneration)
);

// Dialog state
const selectedMatch = ref<Match | null>(null);
const selectedCourtId = ref<string | null>(null);
const assignIgnoreCheckInGate = ref(false);
const releaseTargetMatch = ref<Match | null>(null);
const releaseScoreHandling = ref<'keep' | 'clear'>('keep');
const showSchedulePublishNowDialog = ref(false);
const schedulePublishMatch = ref<Match | null>(null);
const schedulePublishStart = ref('');
const schedulePublishLoading = ref(false);

/** Create a writable computed that syncs a v-model boolean with the dialog manager. */
function dialogModel(name: string): ReturnType<typeof computed<boolean>> {
  return computed<boolean>({
    get: () => isDialogOpen(name),
    set: (value) => { if (value) openDialog(name); else closeDialog(name); },
  });
}

const showAssignCourtDialog = dialogModel('assignCourt');
const showSelectMatchForCourtDialog = dialogModel('selectMatchForCourt');
const showScheduleDialog = dialogModel('schedule');
const showManualScoreDialog = dialogModel('score');
const showAutoScheduleDialog = dialogModel('autoSchedule');
const showReleaseDialog = dialogModel('release');
const showResetDialog = dialogModel('reset');

const selectedCategoryIds = ref<string[]>([]);

function openAutoScheduleDialog(): void {
  if (categories.value.length > 0) {
    selectedCategoryIds.value = categories.value.map(c => c.id);
  }
  openDialog('autoSchedule');
}

watch(() => isDialogOpen('autoSchedule'), (open) => {
  if (!open) {
    selectedCategoryIds.value = [];
    autoScheduleResult.value = null;
  }
});

watch(showAssignCourtDialog, (open) => {
  if (!open) {
    assignIgnoreCheckInGate.value = false;
  }
});

watch(showReleaseDialog, (open) => {
  if (!open) {
    releaseTargetMatch.value = null;
    releaseScoreHandling.value = 'keep';
  }
});

const releaseHasInProgressScores = computed(() =>
  releaseTargetMatch.value?.status === 'in_progress' &&
  Array.isArray(releaseTargetMatch.value.scores) &&
  releaseTargetMatch.value.scores.length > 0
);

watch(showSchedulePublishNowDialog, (open) => {
  if (!open) {
    schedulePublishMatch.value = null;
    schedulePublishLoading.value = false;
  }
});

const VALID_VIEW_MODES = new Set(['queue', 'schedule', 'command']);

function resolveViewModeFromQuery(value: unknown): 'queue' | 'schedule' | 'command' | null {
  return typeof value === 'string' && VALID_VIEW_MODES.has(value)
    ? (value as 'queue' | 'schedule' | 'command')
    : null;
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

watch(
  () => route.query.category,
  (queryCategory) => {
    const value = Array.isArray(queryCategory) ? queryCategory[0] : queryCategory;
    selectedCategory.value = parseScheduleQueryCategory(value);
  },
  { immediate: true }
);

watch(
  () => route.query.publicState,
  (queryPublicState) => {
    const value = Array.isArray(queryPublicState) ? queryPublicState[0] : queryPublicState;
    scheduleFilters.value.publicState = parseScheduleQueryPublicState(value);
  },
  { immediate: true }
);

watch(
  () => route.query.scheduleLayout,
  (queryScheduleLayout) => {
    const value = Array.isArray(queryScheduleLayout) ? queryScheduleLayout[0] : queryScheduleLayout;
    scheduleViewMode.value = parseScheduleQueryLayout(value);
  },
  { immediate: true }
);

const pendingMatches = computed(() => {
  let result = matches.value.filter(
    (m) => (m.status === 'ready' || m.status === 'scheduled') &&
           m.participant1Id && m.participant2Id &&
           !m.courtId
  );
  if (selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }
  return result.sort((a, b) => {
    const aTime = (a.plannedStartAt ?? a.scheduledTime)?.getTime() ?? Infinity;
    const bTime = (b.plannedStartAt ?? b.scheduledTime)?.getTime() ?? Infinity;
    if (aTime !== bTime) return aTime - bTime;
    return a.round - b.round || a.matchNumber - b.matchNumber;
  });
});

const assignablePendingMatches = computed(() =>
  pendingMatches.value.filter((match) => canAssignCourtToMatch(match))
);

const enrichedPendingMatches = computed(() => {
  return pendingMatches.value.map(match => ({
    ...match,
    participant1Name: getParticipantName(match.participant1Id),
    participant2Name: getParticipantName(match.participant2Id),
    categoryName: getCategoryName(match.categoryId)
  })) as any;
});

const filteredMatches = computed(() => {
  let result = [...matches.value];

  if (selectedCategory.value !== 'all') {
    result = result.filter((m) => m.categoryId === selectedCategory.value);
  }
  if (scheduleFilters.value.status !== 'all') {
    result = result.filter((m) => m.status === scheduleFilters.value.status);
  }
  if (scheduleFilters.value.publicState !== 'all') {
    result = result.filter((m) => getMatchScheduleState(m) === scheduleFilters.value.publicState);
  }
  if (scheduleFilters.value.courtId !== 'all') {
    result = result.filter((m) => m.courtId === scheduleFilters.value.courtId);
  }
  if (scheduleFilters.value.searchQuery.trim()) {
    const query = scheduleFilters.value.searchQuery.toLowerCase();
    result = result.filter((m) => {
      const p1Name = getMatchParticipantLabel(m, 'participant1').toLowerCase();
      const p2Name = getMatchParticipantLabel(m, 'participant2').toLowerCase();
      const matchNumber = String(m.matchNumber);
      return p1Name.includes(query) || p2Name.includes(query) || matchNumber.includes(query);
    });
  }

  const { sortBy, sortDesc } = scheduleFilters.value;

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
        const aName = getMatchParticipantLabel(a, 'participant1');
        const bName = getMatchParticipantLabel(b, 'participant1');
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
        const aTime = getMatchScheduleTime(a)?.getTime();
        const bTime = getMatchScheduleTime(b)?.getTime();
        if (aTime == null && bTime == null) {
          comparison = 0;
        } else if (aTime == null) {
          comparison = 1;
        } else if (bTime == null) {
          comparison = -1;
        } else {
          comparison = aTime - bTime;
        }
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

const scheduleStatusFilterOptions = [
  { title: 'All Status', value: 'all' },
  { title: 'Scheduled', value: 'scheduled' },
  { title: 'Ready', value: 'ready' },
  { title: 'In Progress', value: 'in_progress' },
  { title: 'Completed', value: 'completed' },
  { title: 'Cancelled', value: 'cancelled' },
];

const categoryFilterOptions = computed(() => [
  { title: 'All Categories', value: 'all' },
  ...categories.value.map((category) => ({ title: category.name, value: category.id })),
]);

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

/** Maps "sortBy_direction" combo values to { sortBy, sortDesc } filter state. */
const SORT_VALUE_MAP: Record<string, { sortBy: string; sortDesc: boolean }> = {
  round_asc: { sortBy: 'round', sortDesc: false },
  round_desc: { sortBy: 'round', sortDesc: true },
  match_number_asc: { sortBy: 'matchNumber', sortDesc: false },
  match_number_desc: { sortBy: 'matchNumber', sortDesc: true },
  category_asc: { sortBy: 'category', sortDesc: false },
  participants_asc: { sortBy: 'participants', sortDesc: false },
  court_asc: { sortBy: 'court', sortDesc: false },
  time_asc: { sortBy: 'time', sortDesc: false },
  time_desc: { sortBy: 'time', sortDesc: true },
  status_asc: { sortBy: 'status', sortDesc: false },
};

const scheduleSortValue = computed<string>({
  get: () => {
    const { sortBy, sortDesc } = scheduleFilters.value;
    const suffix = sortDesc ? 'desc' : 'asc';
    const key = sortBy === 'matchNumber' ? `match_number_${suffix}` : `${sortBy}_${suffix}`;
    return key in SORT_VALUE_MAP ? key : 'time_asc';
  },
  set: (value) => {
    const mapped = SORT_VALUE_MAP[value] ?? SORT_VALUE_MAP.time_asc;
    scheduleFilters.value.sortBy = mapped.sortBy;
    scheduleFilters.value.sortDesc = mapped.sortDesc;
  },
});

const hasActiveScheduleFilters = computed(() => (
  selectedCategory.value !== 'all' ||
  scheduleFilters.value.status !== 'all' ||
  scheduleFilters.value.publicState !== 'all' ||
  scheduleFilters.value.courtId !== 'all' ||
  Boolean(scheduleFilters.value.searchQuery.trim()) ||
  scheduleSortValue.value !== 'time_asc'
));

const VALID_MATCH_STATUSES = new Set(['scheduled', 'ready', 'in_progress', 'completed', 'cancelled']);

function updateScheduleStatus(value: string | null): void {
  scheduleFilters.value.status = (value && VALID_MATCH_STATUSES.has(value))
    ? value as typeof scheduleFilters.value.status
    : 'all';
}

function resetScheduleFilters(): void {
  scheduleFilters.value = {
    status: 'all',
    publicState: 'all',
    courtId: 'all',
    searchQuery: '',
    sortBy: 'time',
    sortDesc: false,
  };
}

const availableCourts = computed(() =>
  courts.value.filter((c) => c.status === 'available')
);

const courtsInUse = computed(() =>
  courts.value.filter((c) => c.status === 'in_use')
);

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

const stats = computed(() => ({
  total: matches.value.length,
  pending: allPendingMatches.value.length,
  scheduled: allScheduledWithCourtMatches.value.length,
  ready: allReadyMatches.value.length,
  inProgress: allInProgressMatches.value.length,
  completed: allCompletedMatches.value.length,
  totalCourts: courts.value.length,
  courtsInUse: courtsInUse.value.length,
}));

const completionPercent = computed(() => {
  if (!stats.value.total) return 0;
  return Math.round((stats.value.completed / stats.value.total) * 100);
});

const tournamentHealth = computed(() => {
  const { inProgress, totalCourts, courtsInUse, pending } = stats.value;
  const courtsAvailable = totalCourts - courtsInUse;

  if (inProgress === 0 && pending === 0) {
    return { label: 'Idle', color: 'default', icon: 'mdi-circle-outline' };
  }
  if (courtsAvailable === 0 && inProgress > 0) {
    return { label: 'Healthy', color: 'success', icon: 'mdi-check-circle' };
  }
  if (pending > 8 && courtsAvailable > 0) {
    return { label: 'Backlog', color: 'error', icon: 'mdi-alert-circle' };
  }
  if (pending > 3 && courtsAvailable > 0) {
    return { label: 'Queue Building', color: 'warning', icon: 'mdi-alert' };
  }
  return { label: 'Healthy', color: 'success', icon: 'mdi-check-circle' };
});

const healthTooltip = computed(() => {
  const { label } = tournamentHealth.value;
  const blocked = stats.value.pending - assignablePendingMatches.value.length;

  if (label === 'Backlog') {
    if (blocked > 0 && assignablePendingMatches.value.length === 0) {
      return `${stats.value.pending} matches waiting - all blocked (players not checked in). Go to Check-in to mark players as present, or use "Assign Anyway (Admin)" from a match row's dropdown.`;
    }
    return `${stats.value.pending} matches ready to play but courts are idle. Assign matches to courts to keep pace.`;
  }
  if (label === 'Queue Building') {
    return `Queue is growing (${stats.value.pending} waiting). Assign matches to available courts.`;
  }
  if (label === 'Healthy') return 'Good flow - courts are active and matches are progressing.';
  if (label === 'Idle') return 'No matches are currently queued or in progress.';
  return '';
});

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);
  matchStore.subscribeAllMatches(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
  activityStore.subscribeActivities(tournamentId.value);

  setTimeout(() => matchStore.checkAndFixConsistency(tournamentId.value), 2000);
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  activityStore.unsubscribe();
});

function getCategoryName(categoryId: string): string {
  const category = categories.value.find((c) => c.id === categoryId);
  return category?.name || 'Unknown';
}

function getCourtName(courtId: string | undefined): string {
  if (!courtId) return '-';
  const court = courts.value.find((c) => c.id === courtId);
  return court?.name || 'Unknown';
}

const displayCodeMap = computed<Map<string, string>>(() =>
  buildDisplayCodeMap(matches.value, getCategoryName)
);

function getDisplayCode(match: Match): string {
  return displayCodeMap.value.get(buildGlobalMatchKey(match)) ?? match.id;
}

function getBracketCode(match: Match): string {
  if (match.bracketPosition?.bracket === 'losers') return 'LB';
  if (match.bracketPosition?.bracket === 'finals') return 'F';
  return 'WB';
}

function getMatchParticipantLabel(match: Match, slot: 'participant1' | 'participant2'): string {
  return getSlotLabel(match, slot, getParticipantName);
}

function getMatchScheduleTime(match: Match): Date | undefined {
  return match.plannedStartAt ?? match.scheduledTime;
}

function getMatchScheduleState(match: Match): 'published' | 'draft' | 'not_scheduled' {
  if (match.scheduleStatus === 'published' || match.publishedAt) return 'published';
  if (getMatchScheduleTime(match)) return 'draft';
  return 'not_scheduled';
}

const SCHEDULE_STATE_META: Record<string, { label: string; color: string; icon: string }> = {
  published: { label: 'Published', color: 'success', icon: 'mdi-eye-check' },
  draft: { label: 'Draft', color: 'warning', icon: 'mdi-file-document-edit-outline' },
  not_scheduled: { label: 'Not Scheduled', color: 'grey-darken-1', icon: 'mdi-eye-off-outline' },
};

function getMatchScheduleStateLabel(match: Match): string {
  return SCHEDULE_STATE_META[getMatchScheduleState(match)].label;
}

function getMatchScheduleStateColor(match: Match): string {
  return SCHEDULE_STATE_META[getMatchScheduleState(match)].color;
}

function getMatchScheduleStateIcon(match: Match): string {
  return SCHEDULE_STATE_META[getMatchScheduleState(match)].icon;
}

function getMatchParticipantsTooltip(match: Match): string {
  return `${getMatchParticipantLabel(match, 'participant1')} vs ${getMatchParticipantLabel(match, 'participant2')}`;
}

function canScoreMatch(match: Match): boolean {
  return match.status === 'in_progress';
}

function hasAssignmentEligibleStatus(match: Match): boolean {
  return match.status === 'scheduled' || match.status === 'ready';
}

function isRegistrationCheckedIn(registrationId: string | undefined): boolean {
  if (!registrationId) return false;
  const registration = registrationsById.value.get(registrationId);
  if (!registration) return false;
  return registration.status === 'checked_in' || registration.isCheckedIn === true;
}

function areMatchParticipantsCheckedIn(match: Match): boolean {
  return (
    isRegistrationCheckedIn(match.participant1Id) &&
    isRegistrationCheckedIn(match.participant2Id)
  );
}

function getMatchAssignBlockers(match: Match, allowAdminCheckInOverride = false): string[] {
  const blockers: string[] = [];
  if (!getMatchScheduleTime(match)) {
    blockers.push('Blocked: Not scheduled');
  }

  if (getMatchScheduleState(match) !== 'published') {
    blockers.push('Blocked: Not published');
  }

  if (!areMatchParticipantsCheckedIn(match)) {
    if (!(allowAdminCheckInOverride && isAdmin.value)) {
      blockers.push('Blocked: Players not checked-in');
    }
  }

  return blockers;
}

function getMatchAssignBlockersText(match: Match, allowAdminCheckInOverride = false): string {
  return getMatchAssignBlockers(match, allowAdminCheckInOverride).join(' • ');
}

function canAssignCourtToMatch(match: Match, allowAdminCheckInOverride = false): boolean {
  if (match.courtId) return false;
  if (!hasAssignmentEligibleStatus(match)) return false;
  return getMatchAssignBlockers(match, allowAdminCheckInOverride).length === 0;
}

function shouldShowBlockedAssign(match: Match): boolean {
  if (match.courtId) return false;
  if (!hasAssignmentEligibleStatus(match)) return false;
  return !canAssignCourtToMatch(match);
}

function canAdminAssignAnyway(match: Match): boolean {
  if (!isAdmin.value) return false;
  if (match.courtId) return false;
  if (!hasAssignmentEligibleStatus(match)) return false;
  if (canAssignCourtToMatch(match)) return false;

  const blockers = getMatchAssignBlockers(match);
  return blockers.length === 1 && blockers[0] === 'Blocked: Players not checked-in';
}

function getPrimaryRowAction(match: Match): 'score' | 'assign' | null {
  if (canAssignCourtToMatch(match)) return 'assign';
  if (canScoreMatch(match)) return 'score';
  return null;
}

function openPublicSchedulePage(): void {
  router.push(`/tournaments/${tournamentId.value}/schedule`);
}

function handleExcelExport(): void {
  const rows = buildScheduleExportRows(
    filteredMatches.value,
    (categoryId: string) => getCategoryName(categoryId),
    (registrationId: string | undefined) => getParticipantName(registrationId),
    (courtId: string | undefined) => getCourtName(courtId),
    { allMatches: matches.value },
  );
  downloadScheduleAsExcel(rows, tournament.value?.name ?? 'tournament');
}

function openAssignCourtDialog(match: Match, options: { ignoreCheckInGate?: boolean } = {}): void {
  if (!canAssignCourtToMatch(match, Boolean(options.ignoreCheckInGate))) {
    const blockedReason = getMatchAssignBlockersText(match, Boolean(options.ignoreCheckInGate));
    notificationStore.showToast('warning', blockedReason || 'Blocked: This match cannot be assigned');
    return;
  }

  selectedMatch.value = match;
  selectedCourtId.value = null;
  assignIgnoreCheckInGate.value = Boolean(options.ignoreCheckInGate);
  openDialog('assignCourt');
}

const courtToReleaseId = ref<string | null>(null);

async function releaseCourt(courtId: string) {
  const court = courts.value.find(c => c.id === courtId);
  if (!court) return;

  releaseTargetMatch.value = null;
  if (court.currentMatchId) {
    releaseTargetMatch.value = matches.value.find((match) =>
      match.id === court.currentMatchId &&
      match.courtId === court.id &&
      (match.status === 'in_progress' || match.status === 'ready' || match.status === 'scheduled')
    ) ?? null;
  }
  releaseScoreHandling.value = 'keep';

  courtToReleaseId.value = courtId;
  openDialog('release');
}

function getEmergencyScheduleStartValue(): string {
  const date = new Date(Date.now() + emergencyScheduleBufferMinutes.value * 60_000);
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function openSchedulePublishNowDialog(match: Match): void {
  schedulePublishMatch.value = match;
  schedulePublishStart.value = getEmergencyScheduleStartValue();
  showSchedulePublishNowDialog.value = true;
}

function setSchedulePublishToDefault(): void {
  schedulePublishStart.value = getEmergencyScheduleStartValue();
}

function canOpenSchedulePublishNow(match: Match): boolean {
  return getMatchScheduleState(match) !== 'published' || !getMatchScheduleTime(match);
}

async function confirmSchedulePublishNow(): Promise<void> {
  if (!schedulePublishMatch.value) return;
  if (!schedulePublishStart.value) {
    notificationStore.showToast('warning', 'Pick a planned start time');
    return;
  }

  const plannedStart = new Date(schedulePublishStart.value);
  if (Number.isNaN(plannedStart.getTime())) {
    notificationStore.showToast('error', 'Invalid planned start time');
    return;
  }

  schedulePublishLoading.value = true;
  try {
    await matchStore.saveManualPlannedTime(
      tournamentId.value,
      schedulePublishMatch.value.id,
      plannedStart,
      tournament.value?.settings?.matchDurationMinutes ?? 20,
      false,
      schedulePublishMatch.value.categoryId,
      schedulePublishMatch.value.levelId
    );
    await matchStore.publishMatchSchedule(
      tournamentId.value,
      schedulePublishMatch.value.id,
      schedulePublishMatch.value.categoryId,
      schedulePublishMatch.value.levelId,
      authStore.currentUser?.id ?? 'system'
    );
    notificationStore.showToast('success', 'Schedule published for this match');
    showSchedulePublishNowDialog.value = false;
    schedulePublishMatch.value = null;
  } catch (error) {
    console.error('Failed to schedule and publish match:', error);
    notificationStore.showToast('error', 'Failed to schedule and publish match');
  } finally {
    schedulePublishLoading.value = false;
  }
}

async function confirmReleaseCourt() {
  if (!courtToReleaseId.value) return;

  const courtId = courtToReleaseId.value;
  const court = courts.value.find(c => c.id === courtId);

  closeDialog('release');
  courtToReleaseId.value = null;

  if (!court) return;

  const match = releaseTargetMatch.value;

  try {
    if (court.currentMatchId) {
      if (match) {
        const shouldClearInProgressState = match.status === 'in_progress' && releaseScoreHandling.value === 'clear';
        await matchStore.unscheduleMatch(
          tournamentId.value,
          match.id,
          match.categoryId,
          court.id,
          match.levelId,
          {
            clearInProgressState: shouldClearInProgressState,
            returnStatus: 'ready',
          }
        );
        notificationStore.showToast(
          'success',
          shouldClearInProgressState
            ? 'Court released, scores cleared, and match moved to ready queue'
            : 'Court released and match moved to ready queue'
        );
        releaseTargetMatch.value = null;
        return;
      }
    }

    await tournamentStore.releaseCourtManual(tournamentId.value, courtId);
    notificationStore.showToast('success', 'Court released manually');
    releaseTargetMatch.value = null;
  } catch (error) {
    console.error('Failed to release court:', error);
    notificationStore.showToast('error', 'Failed to release court');
  }
}

function openAssignCourtDialogForCourt(courtId: string): void {
  selectedCourtId.value = courtId;
  openDialog('selectMatchForCourt');
}

function findMatchByRef(ref: QueueMatchRef): Match | undefined {
  return matches.value.find(
    (m) =>
      m.id === ref.matchId &&
      m.categoryId === ref.categoryId &&
      (m.levelId || null) === (ref.levelId || null)
  );
}

function selectMatchFromQueue(ref: QueueMatchRef): void {
  const match = findMatchByRef(ref);
  if (match) selectedMatch.value = match;
}

function openAssignCourtDialogFromQueue(ref: QueueMatchRef): void {
  const match = findMatchByRef(ref);
  if (match) openAssignCourtDialog(match);
}

function openScheduleDialog(match: Match) {
  selectedMatch.value = match;
  openDialog('schedule');
}



function openScoreDialog(matchId: string): void {
  const match = matches.value.find(m => m.id === matchId);
  if (!match) {
    console.error('[openScoreDialog] Match not found:', matchId);
    notificationStore.showToast('error', 'Match not found');
    return;
  }
  openManualScoreDialog(match);
}

// Alias: "Force Complete" opens the same score dialog
const openCompleteMatchDialog = openScoreDialog;

function openManualScoreDialog(match: Match): void {
  if (!match.participant1Id || !match.participant2Id) {
    console.error('[openManualScoreDialog] Match missing participants:', match.id);
    notificationStore.showToast(
      'error',
      `Cannot score match: ${getMatchDisplayName(match)}. Both players must be assigned first.`
    );
    return;
  }
  selectedMatch.value = match;
  openDialog('score');
}

const resettingSchedule = ref(false);

async function confirmResetSchedule(): Promise<void> {
  closeDialog('reset');
  const categoryIdsToReset = selectedCategoryIds.value;

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

const autoAssignEnabled = ref(true);

watch(() => tournament.value?.settings, (settings) => {
  if (settings && typeof settings.autoAssignEnabled !== 'undefined') {
    autoAssignEnabled.value = settings.autoAssignEnabled;
  }
}, { immediate: true });

watch(
  [() => autoAssignEnabled.value, () => availableCourts.value, () => pendingMatches.value],
  async ([isEnabled, freeCourts, pending]) => {
    if (!isEnabled || freeCourts.length === 0 || pending.length === 0) return;

    const now = Date.now();
    const match = (pending as typeof pendingMatches.value).find((m) => {
      if (!canAssignCourtToMatch(m)) return false;
      const plannedTime = getMatchScheduleTime(m);
      return Boolean(plannedTime && plannedTime.getTime() <= now + autoAssignDueWindowMs.value);
    });
    if (!match) return;

    const court = freeCourts[0];

    try {
      await matchStore.assignCourt(
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

async function confirmUnschedule(): Promise<void> {
  if (!matchToUnschedule.value) return;

  const ref = matchToUnschedule.value;
  const match = findMatchByRef(ref);

  showUnscheduleDialog.value = false;
  matchToUnschedule.value = null;

  if (!match) return;
  const { matchId, categoryId, levelId } = ref;

  try {
    await matchStore.unscheduleMatch(
      tournamentId.value,
      matchId,
      categoryId,
      undefined,
      levelId || match.levelId
    );
    notificationStore.showToast('success', 'Match unscheduled and moved to queue');
    activityStore.logActivity(
      tournamentId.value,
      'match_reassigned',
      `Unscheduled: ${getMatchParticipantLabel(match, 'participant1')} vs ${getMatchParticipantLabel(match, 'participant2')}`
    );
  } catch (error) {
    console.error('Failed to unschedule:', error);
    notificationStore.showToast('error', 'Failed to unschedule match');
  }
}

function toggleAutoAssign(enabled: boolean): void {
  autoAssignEnabled.value = enabled;
  tournamentStore.updateTournament(tournamentId.value, {
    settings: {
      ...(tournament.value?.settings || {}),
      autoAssignEnabled: enabled,
    } as any,
  });
}

const { advanceState: doAdvance, transitionTo, getNextState } = useTournamentStateAdvance(tournamentId);

async function advanceState(): Promise<void> {
  if (tournament.value?.state === 'LIVE') {
    showCompleteTournamentDialog.value = true;
    return;
  }
  await doAdvance();
}

async function confirmCompleteTournament(): Promise<void> {
  advanceLoading.value = true;
  try {
    await transitionTo('COMPLETED');
    showCompleteTournamentDialog.value = false;
  } catch (error) {
    notificationStore.showToast('error', 'Failed to complete tournament');
  } finally {
    advanceLoading.value = false;
  }
}

</script>

<template>
  <div class="match-control-container h-100 d-flex flex-column bg-background">
    <StateBanner
      v-if="tournament"
      :state="tournament.state || 'DRAFT'"
      :next-state="getNextState(tournament.state || 'DRAFT')"
      :is-admin="isAdmin"
      :live-stats="{
        inProgress: stats.inProgress,
        remaining: stats.total - stats.completed - stats.inProgress,
        courtsFree: stats.totalCourts - stats.courtsInUse,
        completed: stats.completed,
        total: stats.total
      }"
      @advance="advanceState"
      @unlock="showUnlockDialog = true"
      @revert="transitionTo('LIVE')"
    />

    <v-alert
      v-for="cat in levelGenerationCategories"
      :key="cat.categoryId"
      type="success"
      variant="tonal"
      prominent
      border="start"
      class="mx-2 mt-2"
      closable
    >
      <div class="d-flex align-center flex-wrap ga-2">
        <v-icon class="mr-1">
          mdi-trophy
        </v-icon>
        <div class="flex-grow-1">
          <strong>{{ cat.categoryName }} — all matches complete!</strong>
          <div class="text-caption">
            Go to Categories to create elimination levels.
          </div>
        </div>
        <v-btn
          size="small"
          color="success"
          variant="elevated"
          prepend-icon="mdi-layers-triple"
          @click="router.push(`/tournaments/${tournamentId}/categories`)"
        >
          Go to Categories
        </v-btn>
      </div>
    </v-alert>

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

      <v-tooltip
        :text="healthTooltip"
        location="bottom"
        max-width="320"
      >
        <template #activator="{ props: tooltipProps }">
          <v-chip
            v-bind="tooltipProps"
            :color="tournamentHealth.color"
            size="small"
            variant="tonal"
            class="mr-3 hidden-sm-and-down"
            :prepend-icon="tournamentHealth.icon"
          >
            {{ tournamentHealth.label }}
            <span
              class="ml-1 text-caption"
              style="opacity: 0.7"
            >{{ stats.courtsInUse }}/{{ stats.totalCourts }} courts</span>
          </v-chip>
        </template>
      </v-tooltip>

      <div
        v-if="viewMode !== 'schedule'"
        style="width: 200px"
        class="mr-2"
      >
        <v-select
          v-model="selectedCategory"
          :items="categoryFilterOptions"
          item-title="title"
          item-value="value"
          density="compact"
          variant="outlined"
          hide-details
          bg-color="surface"
          prepend-inner-icon="mdi-filter-variant"
          label="Category"
          class="category-select"
        />
      </div>

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

    <div class="d-flex align-center px-3 border-b bg-surface progress-strip">
      <span
        class="text-caption text-medium-emphasis"
        style="white-space: nowrap"
      >
        {{ stats.completed }}/{{ stats.total }} complete
      </span>
      <div class="progress-track-wrapper">
        <v-progress-linear
          :model-value="completionPercent"
          color="success"
          bg-color="surface-variant"
          rounded
          height="6"
          class="progress-track"
        />
      </div>
      <span
        class="text-caption font-weight-bold"
        style="min-width: 32px; text-align: right"
      >
        {{ completionPercent }}%
      </span>
    </div>

    <div class="flex-grow-1 overflow-hidden">
      <v-row
        v-if="viewMode === 'queue'"
        class="fill-height ma-0"
        no-gutters
      >
        <!-- Courts Panel -->
        <v-col
          cols="12"
          md="8"
          class="d-flex flex-column border-e fill-height"
        >
          <div class="flex-grow-1 overflow-y-auto pa-4 bg-background">
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

        <!-- Queue Panel -->
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

          <div class="flex-grow-1 overflow-y-auto pa-0">
            <match-queue-list
              :matches="enrichedPendingMatches"
              :available-courts="availableCourts"
              :auto-assign-enabled="autoAssignEnabled"
              :auto-start-enabled="false"
              :read-only="true"
            />
          </div>
        </v-col>
      </v-row>

      <div
        v-else-if="viewMode === 'schedule'"
        class="fill-height d-flex flex-column bg-background"
      >
        <div class="schedule-controls-sticky">
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
              @update:sort="scheduleSortValue = $event || 'time_asc'"
              @clear="resetScheduleFilters"
            />
          </div>

          <div class="px-4 py-2 bg-surface border-b">
            <div class="d-flex align-center justify-space-between flex-wrap ga-2">
              <div class="d-flex align-center flex-wrap ga-2">
                <span class="text-body-2 text-grey">{{ filteredMatches.length }} matches</span>
                <span class="text-caption text-medium-emphasis">Public</span>
                <v-btn-toggle
                  v-model="scheduleFilters.publicState"
                  mandatory
                  density="compact"
                  variant="outlined"
                  divided
                  class="schedule-public-toggle"
                >
                  <v-btn
                    v-for="filterOption in publicStateQuickFilters"
                    :key="filterOption.value"
                    :value="filterOption.value"
                    size="small"
                  >
                    {{ filterOption.label }}
                  </v-btn>
                </v-btn-toggle>
              </div>
              <div class="d-flex align-center ga-2 ml-auto schedule-toolbar-actions">
                <v-btn
                  size="small"
                  variant="outlined"
                  color="primary"
                  prepend-icon="mdi-calendar-account-outline"
                  @click="openPublicSchedulePage"
                >
                  Open Public Schedule
                </v-btn>
                <v-btn
                  v-if="scheduleViewMode === 'full'"
                  size="small"
                  variant="outlined"
                  color="success"
                  prepend-icon="mdi-microsoft-excel"
                  @click="handleExcelExport"
                >
                  Download Excel
                </v-btn>
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
            </div>
          </div>

          <div class="px-4 py-1 bg-surface border-b d-flex align-center flex-wrap ga-2 schedule-legend">
            <v-chip
              size="x-small"
              variant="tonal"
              prepend-icon="mdi-clock-outline"
            >
              Planned time uses plannedStartAt
            </v-chip>
            <v-chip
              size="x-small"
              color="success"
              variant="flat"
              prepend-icon="mdi-eye-check"
            >
              Published
            </v-chip>
            <v-chip
              size="x-small"
              color="warning"
              variant="flat"
              prepend-icon="mdi-file-document-edit-outline"
            >
              Draft
            </v-chip>
            <v-chip
              size="x-small"
              color="grey-darken-1"
              variant="flat"
              prepend-icon="mdi-eye-off-outline"
            >
              Not Scheduled
            </v-chip>
          </div>
        </div>

        <div
          v-if="scheduleViewMode === 'compact'"
          class="flex-grow-1 overflow-auto"
        >
          <v-data-table
            :items="filteredMatches"
            :headers="[
              { title: 'Code', key: 'displayCode', width: '88px', sortable: false },
              { title: 'Match', key: 'match', width: '34%', sortable: false },
              { title: 'Status', key: 'status', width: '100px', sortable: true },
              { title: 'Court', key: 'court', width: '120px', sortable: true },
              { title: 'Actions', key: 'actions', align: 'end', sortable: false },
            ]"
            :items-per-page="50"
            density="compact"
            class="fill-height schedule-table"
            fixed-header
            hover
            show-expand
            item-value="id"
          >
            <template #item.displayCode="{ item }">
              <span class="font-weight-bold text-primary text-caption">
                {{ getDisplayCode(item) }}
              </span>
            </template>

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
                <v-tooltip :text="getMatchParticipantsTooltip(item)">
                  <template #activator="{ props }">
                    <div
                      v-bind="props"
                      class="d-flex flex-column schedule-participants-cell"
                    >
                      <span
                        :class="{ 'font-weight-bold text-success': item.winnerId === item.participant1Id }"
                        class="text-body-2 schedule-participant-line"
                      >
                        {{ getMatchParticipantLabel(item, 'participant1') }}
                      </span>
                      <span
                        :class="{ 'font-weight-bold text-success': item.winnerId === item.participant2Id }"
                        class="text-body-2 schedule-participant-line"
                      >
                        {{ getMatchParticipantLabel(item, 'participant2') }}
                      </span>
                    </div>
                  </template>
                </v-tooltip>
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
              <div class="d-flex flex-column align-start ga-1 py-1">
                <v-chip
                  size="small"
                  :color="getStatusColor(item.status)"
                  variant="flat"
                  class="text-uppercase font-weight-bold"
                  style="font-size: 10px; height: 20px;"
                >
                  {{ item.status.replace('_', ' ') }}
                </v-chip>
                <v-chip
                  size="x-small"
                  variant="flat"
                  :color="getMatchScheduleStateColor(item)"
                  :prepend-icon="getMatchScheduleStateIcon(item)"
                  class="schedule-public-chip"
                >
                  {{ getMatchScheduleStateLabel(item) }}
                </v-chip>
              </div>
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
                  v-if="getPrimaryRowAction(item) === 'score'"
                  size="small"
                  color="primary"
                  variant="tonal"
                  prepend-icon="mdi-scoreboard"
                  @click.stop="openScoreDialog(item.id)"
                >
                  Score
                </v-btn>
                <v-btn
                  v-else-if="getPrimaryRowAction(item) === 'assign'"
                  size="small"
                  color="secondary"
                  variant="tonal"
                  prepend-icon="mdi-court-sport"
                  @click.stop="openAssignCourtDialog(item)"
                >
                  Assign
                </v-btn>
                <v-tooltip
                  v-else-if="shouldShowBlockedAssign(item)"
                  :text="getMatchAssignBlockersText(item)"
                >
                  <template #activator="{ props }">
                    <span v-bind="props">
                      <v-btn
                        size="small"
                        color="grey"
                        variant="tonal"
                        prepend-icon="mdi-lock-outline"
                        disabled
                      >
                        Assign
                      </v-btn>
                    </span>
                  </template>
                </v-tooltip>
                <v-menu>
                  <template #activator="{ props }">
                    <v-btn
                      icon="mdi-dots-vertical"
                      variant="text"
                      size="small"
                      :aria-label="`More actions for match ${item.id}`"
                      v-bind="props"
                    />
                  </template>
                  <v-list density="compact">
                    <v-list-item
                      v-if="canScoreMatch(item) && getPrimaryRowAction(item) !== 'score'"
                      prepend-icon="mdi-scoreboard"
                      title="Score"
                      @click="openScoreDialog(item.id)"
                    />
                    <v-list-item
                      v-if="canAssignCourtToMatch(item) && getPrimaryRowAction(item) !== 'assign'"
                      prepend-icon="mdi-court-sport"
                      title="Assign Court"
                      @click="openAssignCourtDialog(item)"
                    />
                    <v-list-item
                      v-if="canAdminAssignAnyway(item)"
                      prepend-icon="mdi-alert-decagram-outline"
                      title="Assign Anyway (Admin)"
                      @click="openAssignCourtDialog(item, { ignoreCheckInGate: true })"
                    />
                    <v-list-item
                      v-if="shouldShowBlockedAssign(item) && !canAdminAssignAnyway(item)"
                      prepend-icon="mdi-lock-outline"
                      :title="getMatchAssignBlockersText(item)"
                      disabled
                    />
                    <v-list-item
                      prepend-icon="mdi-pencil"
                      title="Edit Schedule"
                      @click="openScheduleDialog(item)"
                    />
                    <v-list-item
                      v-if="canOpenSchedulePublishNow(item)"
                      prepend-icon="mdi-calendar-check-outline"
                      title="Schedule + Publish Now"
                      @click="openSchedulePublishNowDialog(item)"
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
                    <div><strong>Code:</strong> {{ getDisplayCode(item) }}</div>
                    <div><strong>Match:</strong> {{ getBracketCode(item) }}-{{ item.matchNumber }}</div>
                    <div><strong>Round:</strong> {{ item.round }}</div>
                    <div><strong>Category:</strong> {{ getCategoryName(item.categoryId) }}</div>
                    <div v-if="getMatchScheduleTime(item)">
                      <strong>Planned:</strong>
                      {{ new Date(getMatchScheduleTime(item)!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}
                    </div>
                    <div><strong>Public:</strong> {{ getMatchScheduleStateLabel(item) }}</div>
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

        <div
          v-else
          class="flex-grow-1 overflow-auto"
        >
          <ScheduleGridView
            :matches="filteredMatches"
            :all-matches="matches"
            :courts="courts"
            :public-state="scheduleFilters.publicState"
            :get-category-name="getCategoryName"
            :get-participant-name="getParticipantName"
          />
        </div>
      </div>

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
                <div class="d-flex align-center px-4 py-3 gap-3">
                  <div class="d-flex flex-column">
                    <span class="text-subtitle-2 font-weight-bold">Command Center</span>
                    <span class="text-caption text-medium-emphasis">
                      Re-schedule, assign, and monitor match flow from one place.
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
                    Re-Schedule
                  </v-btn>
                </div>
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
                  <v-spacer />
                  <v-chip
                    size="small"
                    :color="courtsInUse.length === courts.length ? 'error' : 'success'"
                    variant="tonal"
                  >
                    Courts {{ availableCourts.length }} free / {{ courts.length }}
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
                    {{ availableCourts.length }} Available
                  </v-chip>
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    color="info"
                    class="ml-1"
                  >
                    {{ courtsInUse.length }} In Use
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
                  class="command-feed-card command-feed-queue"
                >
                  <ready-queue
                    :matches="pendingMatches"
                    :categories="categories"
                    :get-participant-name="getParticipantName"
                    :get-category-name="getCategoryName"
                    :enable-assign="false"
                    @select="selectMatchFromQueue"
                    @assign="openAssignCourtDialogFromQueue"
                  />
                </v-card>

                <v-card
                  variant="flat"
                  border
                  class="command-feed-card command-feed-alerts"
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

    <AssignCourtDialog
      v-model="showAssignCourtDialog"
      :match="selectedMatch"
      :initial-court-id="selectedCourtId"
      :tournament-id="tournamentId"
      :courts="courts"
      :ignore-check-in-gate="assignIgnoreCheckInGate"
      @assigned="showAssignCourtDialog = false"
    />

    <SelectMatchForCourtDialog
      v-model="showSelectMatchForCourtDialog"
      :court-id="selectedCourtId"
      :court-name="courts.find(c => c.id === selectedCourtId)?.name ?? ''"
      :matches="assignablePendingMatches"
      :tournament-id="tournamentId"
      :get-participant-name="getParticipantName"
      :get-category-name="getCategoryName"
      @assigned="showSelectMatchForCourtDialog = false"
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

    <BaseDialog
      v-model="showSchedulePublishNowDialog"
      title="Schedule + Publish Now"
      max-width="500"
      @cancel="showSchedulePublishNowDialog = false"
    >
      <div v-if="schedulePublishMatch">
        <div class="text-body-2 mb-3">
          {{ getMatchDisplayName(schedulePublishMatch) }}
        </div>
        <v-text-field
          v-model="schedulePublishStart"
          type="datetime-local"
          label="Planned Start Time"
          variant="outlined"
          class="mb-2"
        />
        <v-alert
          type="info"
          variant="tonal"
          density="compact"
          class="mb-2"
        >
          Publishing unlocks assignment and shows planned time on Public Schedule.
        </v-alert>
      </div>
      <template #actions>
        <v-spacer />
        <v-btn
          variant="text"
          :disabled="schedulePublishLoading"
          @click="setSchedulePublishToDefault"
        >
          Now + {{ emergencyScheduleBufferMinutes }} min
        </v-btn>
        <v-btn
          variant="text"
          :disabled="schedulePublishLoading"
          @click="showSchedulePublishNowDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="schedulePublishLoading"
          @click="confirmSchedulePublishNow"
        >
          Save + Publish
        </v-btn>
      </template>
    </BaseDialog>

    <ManualScoreDialog
      v-if="tournament"
      v-model="showManualScoreDialog"
      :match="selectedMatch"
      :tournament-id="tournamentId"
      :tournament="tournament"
      :categories="categories"
      @saved="showManualScoreDialog = false"
    />

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

    <BaseDialog
      v-model="showReleaseDialog"
      title="Release Court?"
      max-width="400"
      @cancel="showReleaseDialog = false"
    >
      <p
        v-if="releaseTargetMatch?.status === 'in_progress'"
        class="text-body-1"
      >
        This match is on court. Releasing will move it back to the ready queue.
      </p>
      <p
        v-else
        class="text-body-1"
      >
        Are you sure you want to release this court? If a match is currently assigned, it will be unscheduled.
      </p>
      <v-radio-group
        v-if="releaseHasInProgressScores"
        v-model="releaseScoreHandling"
        color="primary"
        hide-details
        class="mt-3"
      >
        <v-radio
          value="keep"
          label="Keep scores and continue later"
        />
        <v-radio
          value="clear"
          label="Clear scores and restart match"
        />
      </v-radio-group>
      <p
        v-if="releaseHasInProgressScores && releaseScoreHandling === 'clear'"
        class="text-caption text-warning mt-2"
      >
        Scores will be removed before this match returns to the ready queue.
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

    <v-dialog
      v-model="showCompleteTournamentDialog"
      max-width="480"
      persistent
    >
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon
            color="warning"
            class="mr-2"
          >
            mdi-flag-checkered
          </v-icon>
          Complete Tournament?
        </v-card-title>
        <v-card-text>
          <v-alert
            v-if="stats.total - stats.completed > 0"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            <strong>{{ stats.total - stats.completed }} matches are not yet completed</strong>
            ({{ stats.inProgress }} in progress, {{ stats.total - stats.completed - stats.inProgress }} pending).
            Completing the tournament now will finalize all results.
          </v-alert>
          <v-alert
            v-else
            type="success"
            variant="tonal"
            density="compact"
            class="mb-3"
          >
            All {{ stats.total }} matches are completed. The tournament is ready to finalize.
          </v-alert>
          <p class="text-body-2 text-medium-emphasis">
            This action marks the tournament as finished. Results will become final and no further scoring will be possible.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showCompleteTournamentDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="warning"
            variant="flat"
            :loading="advanceLoading"
            prepend-icon="mdi-flag-checkered"
            @click="confirmCompleteTournament"
          >
            Complete Tournament
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.text-gradient {
  color: $primary-base;
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
  color: $primary-base;
}

.v-btn {
  text-transform: none !important;
  letter-spacing: 0.3px;
}

.match-control-container {
  height: calc(100vh - 64px); // Adjust based on app header
}

.schedule-controls-sticky {
  position: sticky;
  top: 0;
  z-index: 6;
}

.schedule-toolbar-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.schedule-public-toggle :deep(.v-btn__content) {
  font-size: 0.75rem;
}

.schedule-legend :deep(.v-chip) {
  font-weight: $font-weight-medium;
}

.schedule-public-chip {
  font-weight: $font-weight-bold;
  letter-spacing: 0.2px;
}

.schedule-participants-cell {
  min-width: 0;
  max-width: 100%;
}

.schedule-participant-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  line-height: 1.2;
}

:deep(.schedule-table .v-table__wrapper > table > thead > tr > th) {
  position: sticky;
  top: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
}

:deep(.schedule-table .v-table__wrapper > table > tbody > tr > td) {
  padding-top: 6px !important;
  padding-bottom: 6px !important;
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

.progress-strip {
  min-height: 28px;
  gap: 8px;
}

.progress-track-wrapper {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
}

.progress-track {
  width: 100%;
  min-width: 0;
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
  min-width: 0;
  overflow: hidden;
  background: rgb(var(--v-theme-surface));
  border-radius: 10px;
}

.command-feed-queue {
  flex: 1 1 0;
  min-height: 220px;
}

.command-feed-alerts {
  flex: 0 1 auto;
  min-height: 120px;
  max-height: 280px;
}

@media (max-width: 960px) {
  .schedule-toolbar-actions {
    width: 100%;
    justify-content: space-between;
    margin-left: 0 !important;
  }

  .schedule-public-toggle {
    width: 100%;
  }

  .command-section-card {
    min-height: 420px;
  }

  .command-feed-queue {
    min-height: 300px;
  }

  .command-feed-alerts {
    min-height: 120px;
    max-height: 260px;
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
