<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import { FORMAT_LABELS, AGE_GROUP_LABELS, CATEGORY_TYPE_LABELS } from '@/types';
import type { Category, CategoryType, Match, TournamentFormat } from '@/types';

const props = withDefaults(
  defineProps<{
    tournamentId: string;
    expandedPoolCategoryIds?: string[];
  }>(),
  {
    expandedPoolCategoryIds: () => [],
  }
);

const registrationStore = useRegistrationStore();
const tournamentStore = useTournamentStore();
const matchStore = useMatchStore();
const notificationStore = useNotificationStore();

const categories = computed(() => tournamentStore.categories);
const registrations = computed(() => registrationStore.registrations);
const players = computed(() => registrationStore.players);

// Defensive resolvers: Firestore documents may carry legacy field names.
function resolveCategoryFormat(category: Category): TournamentFormat {
  const raw = category as unknown as Record<string, unknown>;
  for (const key of ['format', 'categoryFormat', 'bracketFormat', 'eliminationFormat']) {
    const val = raw[key];
    if (typeof val === 'string' && FORMAT_LABELS[val as TournamentFormat]) {
      return val as TournamentFormat;
    }
  }
  return 'single_elimination';
}

function resolveCategoryType(category: Category): CategoryType {
  const raw = category as unknown as Record<string, unknown>;
  for (const key of ['type', 'eventType', 'categoryType']) {
    const val = raw[key];
    if (typeof val === 'string' && CATEGORY_TYPE_LABELS[val as CategoryType]) {
      return val as CategoryType;
    }
  }
  return 'singles';
}

type PhaseKey = 'setup' | 'schedule' | 'checkin' | 'pool' | 'levels' | 'elimination' | 'done';

interface PhaseStep {
  key: PhaseKey;
  label: string;
}

interface CategoryStats {
  category: Category;
  resolvedFormat: TournamentFormat;
  resolvedType: CategoryType;
  categoryMatches: Match[];
  matchesCount: number;
  hasPlannedTimes: boolean;
  allPlannedTimes: boolean;
  schedulePublished: boolean;
  scheduleDone: boolean;
  checkInStarted: boolean;
  hasBracket: boolean;
  total: number;
  pending: number;
  approved: number;
  checkedIn: number;
  withdrawn: number;
  rejected: number;
  ready: number;
  seeded: number;
  steps: PhaseStep[];
  currentPhase: PhaseKey;
  currentPhaseIdx: number;
}

interface StatusChip {
  label: string;
  color: string;
}

interface PublicationChip {
  label: string;
  color: string;
}

type PrimaryActionEvent =
  | 'setup-category'
  | 'manage-registrations'
  | 'generate-bracket'
  | 'view-bracket'
  | 'schedule-times'
  | 'open-checkin'
  | 'create-levels';

interface PrimaryAction {
  label: string;
  icon: string;
  color: string;
  event: PrimaryActionEvent;
  disabled?: boolean;
  disabledReason?: string;
}

interface PhaseContext {
  categoryMatches: Match[];
  hasBracket: boolean;
  checkInStarted: boolean;
  scheduleDone: boolean;
}

function getPhaseSteps(format: TournamentFormat): PhaseStep[] {
  if (format === 'pool_to_elimination') {
    return [
      { key: 'setup', label: 'Setup' },
      { key: 'schedule', label: 'Schedule' },
      { key: 'checkin', label: 'Check-in' },
      { key: 'pool', label: 'Pool Play' },
      { key: 'levels', label: 'Levels' },
      { key: 'elimination', label: 'Bracket' },
      { key: 'done', label: 'Done' },
    ];
  }
  return [
    { key: 'setup', label: 'Setup' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'checkin', label: 'Check-in' },
    { key: 'elimination', label: 'Bracket' },
    { key: 'done', label: 'Done' },
  ];
}

function hasBracketForCategory(category: Category, categoryMatches: Match[]): boolean {
  if (category.status === 'active' || category.status === 'completed') return true;
  if (category.stageId != null) return true;
  if (category.poolStageId != null) return true;
  if (category.eliminationStageId != null) return true;
  return categoryMatches.length > 0;
}

function getCurrentPhase(
  category: Category,
  format: TournamentFormat,
  phaseContext: PhaseContext
): PhaseKey {
  if (category.status === 'completed') return 'done';

  if (phaseContext.categoryMatches.length === 0 && category.status === 'setup') return 'setup';
  if (!phaseContext.scheduleDone && phaseContext.categoryMatches.length > 0) return 'schedule';
  if (!phaseContext.checkInStarted && category.status === 'setup') return 'checkin';

  if (format === 'pool_to_elimination') {
    if (category.poolPhase === 'pool' || category.status === 'setup') return 'pool';
    if (category.poolPhase === 'elimination') {
      const levelMatches = phaseContext.categoryMatches.filter((match) => Boolean(match.levelId));
      if (levelMatches.length === 0) return 'levels';
      return 'elimination';
    }
    return 'pool';
  }

  if (phaseContext.hasBracket || category.status === 'active') return 'elimination';
  return 'elimination';
}

function phaseIndex(steps: PhaseStep[], key: PhaseKey): number {
  return steps.findIndex((step) => step.key === key);
}

const categoryStats = computed<CategoryStats[]>(() => {
  return categories.value.map((category) => {
    const resolvedFormat = resolveCategoryFormat(category);
    const resolvedType = resolveCategoryType(category);
    const categoryRegs = registrations.value.filter((r) => r.categoryId === category.id);
    const categoryMatches = matchStore.matches.filter((match) => match.categoryId === category.id);

    let pending = 0;
    let approved = 0;
    let checkedIn = 0;
    let withdrawn = 0;
    let rejected = 0;
    let seeded = 0;
    for (const registration of categoryRegs) {
      if (registration.status === 'pending') pending++;
      else if (registration.status === 'approved') approved++;
      else if (registration.status === 'checked_in' || registration.isCheckedIn) checkedIn++;
      else if (registration.status === 'withdrawn') withdrawn++;
      else if (registration.status === 'rejected') rejected++;
      if (registration.seed != null) seeded++;
    }

    const total = categoryRegs.length;
    const ready = approved + checkedIn;
    const matchesCount = categoryMatches.length;
    const hasPlannedTimes = categoryMatches.some((match) => Boolean(match.plannedStartAt));
    const allPlannedTimes = matchesCount > 0 && categoryMatches.every((match) => Boolean(match.plannedStartAt));
    const schedulePublished = categoryMatches.some(
      (match) => match.scheduleStatus === 'published' || Boolean(match.publishedAt)
    );
    const scheduleDone = schedulePublished || allPlannedTimes;
    const checkInStarted = category.checkInOpen === true || checkedIn > 0;
    const hasBracket = hasBracketForCategory(category, categoryMatches);
    const steps = getPhaseSteps(resolvedFormat);
    const currentPhase = getCurrentPhase(category, resolvedFormat, {
      categoryMatches,
      hasBracket,
      checkInStarted,
      scheduleDone,
    });
    const currentPhaseIdx = phaseIndex(steps, currentPhase);

    return {
      category,
      resolvedFormat,
      resolvedType,
      categoryMatches,
      matchesCount,
      hasPlannedTimes,
      allPlannedTimes,
      schedulePublished,
      scheduleDone,
      checkInStarted,
      hasBracket,
      total,
      pending,
      approved,
      checkedIn,
      withdrawn,
      rejected,
      ready,
      seeded,
      steps,
      currentPhase,
      currentPhaseIdx,
    };
  });
});

const overallStats = computed(() => {
  let pending = 0;
  let approved = 0;
  let checkedIn = 0;
  for (const registration of registrations.value) {
    if (registration.status === 'pending') pending++;
    else if (registration.status === 'approved') approved++;
    else if (registration.status === 'checked_in' || registration.isCheckedIn) checkedIn++;
  }

  return {
    total: registrations.value.length,
    pending,
    approved,
    checkedIn,
    ready: approved + checkedIn,
    categories: categories.value.length,
    players: players.value.length,
  };
});

const emit = defineEmits<{
  (e: 'generate-bracket', categoryId: string): void;
  (e: 'create-levels', categoryId: string): void;
  (e: 'regenerate-bracket', categoryId: string): void;
  (e: 'manage-registrations', categoryId: string): void;
  (e: 'manage-seeds', categoryId: string): void;
  (e: 'edit-category', category: Category): void;
  (e: 'delete-category', category: Category): void;
  (e: 'setup-category', category: Category): void;
  (e: 'view-bracket', category: Category): void;
  (e: 'schedule-times', category: Category): void;
  (e: 'publish-schedule', category: Category): void;
  (e: 'unpublish-schedule', category: Category): void;
  (e: 'republish-schedule', category: Category): void;
  (e: 'view-public-schedule', category: Category): void;
}>();

function getCategoryTypeIcon(type: CategoryType): string {
  const icons: Record<CategoryType, string> = {
    singles: 'mdi-account',
    doubles: 'mdi-account-multiple',
    mixed_doubles: 'mdi-account-multiple-outline',
  };
  return icons[type];
}

function getFormatLabel(stats: CategoryStats): string {
  return FORMAT_LABELS[stats.resolvedFormat] || stats.resolvedFormat;
}

function isPoolFormat(stats: CategoryStats): boolean {
  return stats.resolvedFormat === 'pool_to_elimination';
}

function hasBracket(stats: CategoryStats): boolean {
  return stats.hasBracket;
}

function hasPendingWarning(stats: CategoryStats): boolean {
  return stats.pending > 0 && stats.category.status === 'setup';
}

function needsSeeding(stats: CategoryStats): boolean {
  return stats.category.seedingEnabled && stats.seeded === 0 && stats.ready >= 4;
}

function isScheduleAvailable(stats: CategoryStats): boolean {
  if (stats.category.status === 'completed') return false;
  return stats.matchesCount > 0 || stats.ready >= 2 || stats.checkInStarted || hasBracket(stats);
}

function isScheduleComplete(stats: CategoryStats): boolean {
  return stats.scheduleDone;
}

function canPublishSchedule(stats: CategoryStats): boolean {
  return stats.hasPlannedTimes || stats.matchesCount > 0;
}

function hasPublishedSchedule(stats: CategoryStats): boolean {
  return stats.schedulePublished;
}

function getPublicationChip(stats: CategoryStats): PublicationChip | null {
  if (!isScheduleAvailable(stats)) return null;
  if (hasPublishedSchedule(stats)) {
    return { label: 'Published', color: 'success' };
  }
  if (stats.hasPlannedTimes) {
    return { label: 'Not Published', color: 'warning' };
  }
  return { label: 'Not Scheduled', color: 'grey' };
}

function isPoolPanelExpanded(stats: CategoryStats): boolean {
  return props.expandedPoolCategoryIds.includes(stats.category.id);
}

function shouldShowCheckinNudge(stats: CategoryStats): boolean {
  if (stats.category.status !== 'setup') return false;
  if (stats.ready < 2) return false;
  if (!isScheduleComplete(stats)) return false;
  return stats.checkInStarted === false;
}

function needsLevelGeneration(stats: CategoryStats): boolean {
  const category = stats.category;
  if (category.status !== 'active') return false;
  if (stats.categoryMatches.length === 0) return false;

  const finishedStatuses = new Set(['completed', 'walkover', 'cancelled']);
  const hasUnfinished = stats.categoryMatches.some((match) => !finishedStatuses.has(match.status));
  if (hasUnfinished) return false;

  if (stats.resolvedFormat === 'pool_to_elimination' && category.poolPhase === 'pool') return true;
  if (stats.resolvedFormat === 'round_robin' && !category.levelingStatus) return true;

  return false;
}

function shouldShowLevelBanner(stats: CategoryStats): boolean {
  if (!needsLevelGeneration(stats)) return false;
  return !isPoolPanelExpanded(stats);
}

function getBracketInfo(stats: CategoryStats): { size: number; byes: number } {
  const ready = stats.ready;
  if (ready < 2) return { size: 0, byes: 0 };
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(ready)));
  const byes = bracketSize - ready;
  return { size: bracketSize, byes };
}

function getPoolGroupCount(stats: CategoryStats): number {
  const configuredGroupCount = stats.category.poolGroupCount;
  if (configuredGroupCount && configuredGroupCount > 0) {
    return configuredGroupCount;
  }
  return Math.max(1, Math.ceil(stats.ready / 4));
}

function canToggleCheckin(stats: CategoryStats): boolean {
  return stats.category.status === 'setup' && stats.ready >= 2;
}

function canGenerateBracket(stats: CategoryStats): boolean {
  if (stats.category.status !== 'setup') return false;
  if (stats.ready < 2) return false;
  if (!isScheduleComplete(stats)) return false;
  if (hasBracket(stats)) return false;
  if (isPoolFormat(stats) && stats.category.checkInOpen === true) return false;
  return true;
}

function canDeleteCategory(stats: CategoryStats): boolean {
  return stats.category.status === 'setup';
}

function getStatusChip(stats: CategoryStats): StatusChip {
  if (stats.category.status === 'completed') {
    return { label: 'Done', color: 'secondary' };
  }
  if (needsLevelGeneration(stats)) {
    return { label: 'Levels', color: 'success' };
  }
  if (hasBracket(stats)) {
    return { label: 'Bracket', color: 'success' };
  }
  if (!isScheduleComplete(stats) && isScheduleAvailable(stats)) {
    return { label: 'Schedule', color: 'primary' };
  }
  if (stats.checkInStarted) {
    return { label: 'Check-in', color: 'info' };
  }
  return { label: 'Setup', color: 'grey' };
}

const togglingCheckin = ref<string | null>(null);

async function toggleCheckin(categoryId: string, open: boolean): Promise<void> {
  togglingCheckin.value = categoryId;
  try {
    await tournamentStore.toggleCategoryCheckin(props.tournamentId, categoryId, open);
    notificationStore.showToast(
      'success',
      open ? 'Check-in is now open' : 'Check-in closed'
    );
  } catch {
    notificationStore.showToast('error', 'Failed to update check-in status');
  } finally {
    togglingCheckin.value = null;
  }
}

async function handleOpenCheckin(stats: CategoryStats): Promise<void> {
  if (canToggleCheckin(stats) && !stats.category.checkInOpen) {
    await toggleCheckin(stats.category.id, true);
  }
  emit('manage-registrations', stats.category.id);
}

function getPrimaryAction(stats: CategoryStats): PrimaryAction {
  if (!isScheduleComplete(stats) && isScheduleAvailable(stats)) {
    return {
      label: 'Schedule',
      icon: 'mdi-calendar-clock-outline',
      color: 'primary',
      event: 'schedule-times',
    };
  }

  if (
    isScheduleComplete(stats) &&
    stats.category.status === 'setup' &&
    !stats.checkInStarted &&
    stats.ready >= 2
  ) {
    return {
      label: 'Open Check-in',
      icon: 'mdi-account-check-outline',
      color: 'info',
      event: 'open-checkin',
    };
  }

  if (needsLevelGeneration(stats) && !isPoolPanelExpanded(stats)) {
    return {
      label: 'Create Levels',
      icon: 'mdi-layers-triple',
      color: 'success',
      event: 'create-levels',
    };
  }

  if (hasBracket(stats)) {
    return {
      label: 'View Bracket',
      icon: 'mdi-trophy-outline',
      color: 'success',
      event: 'view-bracket',
    };
  }

  if (canGenerateBracket(stats)) {
    return {
      label: 'Generate Bracket',
      icon: 'mdi-tournament',
      color: 'primary',
      event: 'generate-bracket',
    };
  }

  return {
    label: 'Setup',
    icon: 'mdi-cog-outline',
    color: 'primary',
    event: 'setup-category',
  };
}

function handlePrimaryAction(action: PrimaryAction, stats: CategoryStats): void {
  if (action.disabled) return;

  switch (action.event) {
    case 'setup-category':
      emit('setup-category', stats.category);
      break;
    case 'manage-registrations':
      emit('manage-registrations', stats.category.id);
      break;
    case 'generate-bracket':
      emit('generate-bracket', stats.category.id);
      break;
    case 'view-bracket':
      emit('view-bracket', stats.category);
      break;
    case 'schedule-times':
      emit('schedule-times', stats.category);
      break;
    case 'open-checkin':
      void handleOpenCheckin(stats);
      break;
    case 'create-levels':
      emit('create-levels', stats.category.id);
      break;
    default:
      break;
  }
}

interface SummaryCard {
  key: string;
  label: string;
  color?: string;
}

const summaryCards: SummaryCard[] = [
  { key: 'categories', label: 'Categories', color: 'primary' },
  { key: 'total', label: 'Total Registrations', color: 'info' },
  { key: 'ready', label: 'Ready to Play', color: 'success' },
  { key: 'pending', label: 'Pending Approval', color: 'warning' },
  { key: 'checkedIn', label: 'Checked In', color: 'secondary' },
  { key: 'players', label: 'Total Players' },
];

const categoryCardsWithAction = computed(() =>
  categoryStats.value.map((stats) => ({
    stats,
    action: getPrimaryAction(stats),
  }))
);
</script>

<template>
  <div class="category-stats">
    <v-row class="mb-4">
      <v-col
        v-for="card in summaryCards"
        :key="card.key"
        cols="6"
        sm="4"
        md="2"
      >
        <v-card
          variant="tonal"
          :color="card.color"
        >
          <v-card-text class="text-center pa-3">
            <div class="text-h4 font-weight-bold">
              {{ overallStats[card.key as keyof typeof overallStats] }}
            </div>
            <div class="text-caption">
              {{ card.label }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col
        v-for="{ stats, action } in categoryCardsWithAction"
        :key="stats.category.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card
          class="h-100 category-card"
          variant="outlined"
        >
          <v-card-title class="d-flex align-center py-2 pr-2">
            <v-icon
              :icon="getCategoryTypeIcon(stats.resolvedType)"
              class="mr-2"
            />
            <span class="flex-grow-1 text-subtitle-1 font-weight-medium text-truncate">
              {{ stats.category.name }}
            </span>
            <v-chip
              :color="getStatusChip(stats).color"
              size="small"
              class="mr-1"
            >
              {{ getStatusChip(stats).label }}
            </v-chip>
            <v-menu location="bottom end">
              <template #activator="{ props: menuProps }">
                <v-btn
                  v-bind="menuProps"
                  icon
                  size="small"
                  variant="text"
                  :aria-label="`Open actions menu for ${stats.category.name}`"
                >
                  <v-icon size="18">
                    mdi-dots-vertical
                  </v-icon>
                </v-btn>
              </template>

              <v-list
                density="compact"
                min-width="240"
              >
                <v-list-item
                  prepend-icon="mdi-account-group"
                  title="Manage"
                  @click="emit('manage-registrations', stats.category.id)"
                />
                <v-list-item
                  v-if="stats.category.seedingEnabled && stats.ready >= 4"
                  prepend-icon="mdi-seed"
                  title="Seeds"
                  data-testid="manage-seeds-btn"
                  @click="emit('manage-seeds', stats.category.id)"
                />
                <v-list-item
                  v-if="stats.category.status === 'setup'"
                  prepend-icon="mdi-cog-outline"
                  title="Setup"
                  @click="emit('setup-category', stats.category)"
                />
                <v-list-item
                  v-if="isScheduleAvailable(stats)"
                  prepend-icon="mdi-calendar-clock-outline"
                  title="Schedule Times"
                  @click="emit('schedule-times', stats.category)"
                />
                <v-list-item
                  v-if="canPublishSchedule(stats)"
                  prepend-icon="mdi-publish"
                  :title="hasPublishedSchedule(stats) ? 'Republish Schedule' : 'Publish Schedule'"
                  @click="hasPublishedSchedule(stats) ? emit('republish-schedule', stats.category) : emit('publish-schedule', stats.category)"
                />
                <v-list-item
                  v-if="hasPublishedSchedule(stats)"
                  prepend-icon="mdi-publish-off"
                  title="Unpublish Schedule"
                  @click="emit('unpublish-schedule', stats.category)"
                />
                <v-list-item
                  prepend-icon="mdi-open-in-new"
                  title="View Public Schedule"
                  :disabled="!hasPublishedSchedule(stats)"
                  @click="emit('view-public-schedule', stats.category)"
                />
                <v-list-item
                  v-if="canToggleCheckin(stats)"
                  :prepend-icon="stats.category.checkInOpen ? 'mdi-door-closed' : 'mdi-door-open'"
                  :title="stats.category.checkInOpen ? 'Close Check-in' : 'Open Check-in'"
                  :disabled="togglingCheckin === stats.category.id"
                  @click="toggleCheckin(stats.category.id, !stats.category.checkInOpen)"
                />
                <v-list-item
                  v-if="canGenerateBracket(stats)"
                  prepend-icon="mdi-tournament"
                  title="Generate Bracket"
                  @click="emit('generate-bracket', stats.category.id)"
                />
                <v-list-item
                  v-if="hasBracket(stats)"
                  prepend-icon="mdi-trophy-outline"
                  title="View Bracket"
                  @click="emit('view-bracket', stats.category)"
                />
                <v-list-item
                  v-if="needsLevelGeneration(stats)"
                  prepend-icon="mdi-layers-triple"
                  title="Create Levels"
                  @click="emit('create-levels', stats.category.id)"
                />
                <v-list-item
                  v-if="stats.category.status === 'active'"
                  prepend-icon="mdi-refresh"
                  title="Regenerate Bracket"
                  @click="emit('regenerate-bracket', stats.category.id)"
                />
                <v-divider class="my-1" />
                <v-list-item
                  prepend-icon="mdi-pencil"
                  title="Edit Category"
                  @click="emit('edit-category', stats.category)"
                />
                <v-list-item
                  prepend-icon="mdi-delete"
                  title="Delete Category"
                  :disabled="!canDeleteCategory(stats)"
                  @click="emit('delete-category', stats.category)"
                />
              </v-list>
            </v-menu>
          </v-card-title>

          <v-card-subtitle class="pt-0 pb-0">
            <v-chip
              size="x-small"
              variant="outlined"
              class="mr-1"
            >
              {{ getFormatLabel(stats) }}
            </v-chip>
            <v-chip
              size="x-small"
              variant="outlined"
              class="mr-1"
            >
              {{ CATEGORY_TYPE_LABELS[stats.resolvedType] }}
            </v-chip>
            <v-chip
              v-if="stats.category.ageGroup && stats.category.ageGroup !== 'open'"
              size="x-small"
              variant="outlined"
              class="mr-1"
            >
              {{ AGE_GROUP_LABELS[stats.category.ageGroup] || stats.category.ageGroup }}
            </v-chip>
            <v-chip
              v-if="getPublicationChip(stats)"
              size="x-small"
              variant="tonal"
              :color="getPublicationChip(stats)!.color"
            >
              {{ getPublicationChip(stats)!.label }}
            </v-chip>
          </v-card-subtitle>

          <div class="phase-stepper px-4 pt-2">
            <div class="d-flex align-center">
              <template
                v-for="(step, idx) in stats.steps"
                :key="step.key"
              >
                <div class="step-item d-flex flex-column align-center">
                  <div
                    class="step-dot"
                    :class="{
                      'step-dot--done': idx < stats.currentPhaseIdx,
                      'step-dot--active': idx === stats.currentPhaseIdx,
                      'step-dot--future': idx > stats.currentPhaseIdx,
                    }"
                  >
                    <v-icon
                      v-if="idx < stats.currentPhaseIdx"
                      size="10"
                      color="white"
                    >
                      mdi-check
                    </v-icon>
                  </div>
                  <span class="step-label text-caption">{{ step.label }}</span>
                </div>
                <div
                  v-if="idx < stats.steps.length - 1"
                  class="step-connector"
                  :class="{ 'step-connector--done': idx < stats.currentPhaseIdx }"
                />
              </template>
            </div>
          </div>

          <v-card-text class="pt-1 pb-1">
            <v-alert
              v-if="!isScheduleComplete(stats) && isScheduleAvailable(stats)"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-2"
              icon="mdi-calendar-clock-outline"
            >
              <div class="d-flex align-center">
                <div class="flex-grow-1">
                  <strong>Schedule matches</strong> and publish times so participants can plan arrivals.
                </div>
                <v-btn
                  size="x-small"
                  variant="text"
                  color="info"
                  @click="emit('schedule-times', stats.category)"
                >
                  Schedule
                </v-btn>
              </div>
            </v-alert>

            <v-alert
              v-if="hasPendingWarning(stats)"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-2"
            >
              <div class="d-flex align-center">
                <div class="flex-grow-1">
                  <strong>{{ stats.pending }} pending</strong> — won't be in the bracket until approved
                </div>
                <v-btn
                  size="x-small"
                  variant="text"
                  color="warning"
                  @click="emit('manage-registrations', stats.category.id)"
                >
                  Review
                </v-btn>
              </div>
            </v-alert>

            <v-alert
              v-if="needsSeeding(stats)"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-2"
            >
              <div class="d-flex align-center">
                <div class="flex-grow-1">
                  <strong>No seeds set</strong> — seed top players for fair brackets
                </div>
                <v-btn
                  size="x-small"
                  variant="text"
                  color="info"
                  @click="emit('manage-seeds', stats.category.id)"
                >
                  Set Seeds
                </v-btn>
              </div>
            </v-alert>

            <v-alert
              v-if="shouldShowCheckinNudge(stats)"
              type="info"
              variant="tonal"
              density="compact"
              icon="mdi-check-decagram"
              class="mb-2"
            >
              <div class="d-flex align-center">
                <div class="flex-grow-1">
                  <strong>Check-in players</strong> as they arrive before matches begin
                </div>
                <v-btn
                  size="x-small"
                  variant="text"
                  color="info"
                  @click="handleOpenCheckin(stats)"
                >
                  Go to Check-in
                </v-btn>
              </div>
            </v-alert>

            <v-alert
              v-if="isPoolFormat(stats) && stats.category.status === 'setup' && !hasBracket(stats) && stats.ready >= 2"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-2"
            >
              <div class="text-caption">
                <strong>{{ stats.ready }} teams</strong> · Pool play first, then elimination brackets.
                Estimated <strong>{{ getPoolGroupCount(stats) }} pools</strong> of ~{{ Math.ceil(stats.ready / getPoolGroupCount(stats)) }} teams.
              </div>
            </v-alert>

            <v-alert
              v-else-if="!isPoolFormat(stats) && stats.category.status === 'setup' && !hasBracket(stats) && getBracketInfo(stats).byes > 0 && stats.ready >= 2"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-2"
            >
              <div class="text-caption">
                <strong>{{ stats.ready }} players</strong> will create a bracket of {{ getBracketInfo(stats).size }} with
                <strong>{{ getBracketInfo(stats).byes }} bye{{ getBracketInfo(stats).byes > 1 ? 's' : '' }}</strong>.
                Top seeded players will get byes.
              </div>
            </v-alert>

            <v-alert
              v-if="shouldShowLevelBanner(stats)"
              type="success"
              variant="tonal"
              density="compact"
              class="mb-2"
              prominent
              border="start"
            >
              <div class="d-flex align-center flex-wrap ga-2">
                <div class="flex-grow-1">
                  <strong>All Pool Matches Complete!</strong>
                  <div class="text-caption">
                    Create levels to split players into elimination brackets.
                  </div>
                </div>
                <v-btn
                  size="small"
                  color="success"
                  variant="elevated"
                  prepend-icon="mdi-layers-triple"
                  @click="emit('create-levels', stats.category.id)"
                >
                  Create Levels
                </v-btn>
              </div>
            </v-alert>

            <div class="registration-stats mt-2">
              <div class="d-flex justify-space-between align-center mb-2">
                <span class="text-body-2 font-weight-medium">Registrations</span>
                <span class="text-subtitle-1 font-weight-bold">{{ stats.total }}</span>
              </div>

              <div class="status-breakdown">
                <div class="status-row d-flex align-center">
                  <v-icon
                    size="16"
                    color="success"
                    class="mr-2"
                  >
                    mdi-check-circle
                  </v-icon>
                  <span class="text-body-2 flex-grow-1">Ready to play</span>
                  <span class="status-value text-success">{{ stats.ready }}</span>
                </div>
                <div class="status-row d-flex align-center">
                  <v-icon
                    size="16"
                    color="info"
                    class="mr-2"
                  >
                    mdi-check-decagram
                  </v-icon>
                  <span class="text-body-2 flex-grow-1">Checked in</span>
                  <span class="status-value text-info">{{ stats.checkedIn }}</span>
                </div>
                <div class="status-row d-flex align-center">
                  <v-icon
                    size="16"
                    color="primary"
                    class="mr-2"
                  >
                    mdi-seed
                  </v-icon>
                  <span class="text-body-2 flex-grow-1">Seeded</span>
                  <span class="status-value text-primary">{{ stats.seeded }}</span>
                </div>
                <div
                  v-if="stats.pending > 0"
                  class="status-row d-flex align-center"
                >
                  <v-icon
                    size="16"
                    color="warning"
                    class="mr-2"
                  >
                    mdi-clock-outline
                  </v-icon>
                  <span class="text-body-2 flex-grow-1">Pending approval</span>
                  <span class="status-value text-warning">{{ stats.pending }}</span>
                </div>
              </div>

              <div class="mt-3">
                <div
                  v-if="isPoolFormat(stats)"
                  class="d-flex justify-space-between text-caption mb-1"
                >
                  <span>Check-in progress</span>
                  <span>{{ stats.checkedIn }} / {{ stats.ready }} checked in</span>
                </div>
                <div
                  v-else
                  class="d-flex justify-space-between text-caption mb-1"
                >
                  <span>Bracket readiness</span>
                  <span>{{ stats.ready }} / {{ stats.category.maxParticipants || '∞' }}</span>
                </div>
                <v-progress-linear
                  v-if="isPoolFormat(stats)"
                  :model-value="stats.ready > 0 ? (stats.checkedIn / stats.ready) * 100 : 0"
                  :color="stats.checkedIn > 0 ? 'info' : 'grey-lighten-2'"
                  height="8"
                  rounded
                />
                <v-progress-linear
                  v-else
                  :model-value="stats.category.maxParticipants ? (stats.ready / stats.category.maxParticipants) * 100 : 50"
                  :color="stats.ready >= 2 ? 'success' : 'warning'"
                  height="8"
                  rounded
                />
              </div>
            </div>
          </v-card-text>

          <v-divider />

          <v-card-actions class="card-primary-actions">
            <v-tooltip
              :text="action.disabledReason || ''"
              :disabled="!action.disabledReason"
              location="top"
            >
              <template #activator="{ props: tipProps }">
                <span
                  class="d-block w-100"
                  v-bind="tipProps"
                >
                  <v-btn
                    block
                    size="small"
                    :color="action.color"
                    variant="flat"
                    :prepend-icon="action.icon"
                    :disabled="action.disabled"
                    :aria-label="`${action.label} for ${stats.category.name}`"
                    @click="handlePrimaryAction(action, stats)"
                  >
                    {{ action.label }}
                  </v-btn>
                </span>
              </template>
            </v-tooltip>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-if="categoryStats.length === 0">
      <v-col cols="12">
        <v-card class="text-center pa-8">
          <v-icon
            size="64"
            color="grey-lighten-1"
          >
            mdi-folder-open
          </v-icon>
          <p class="text-h6 mt-4">
            No categories created yet
          </p>
          <p class="text-body-2 text-grey">
            Add categories to start accepting registrations
          </p>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.category-card {
  display: flex;
  flex-direction: column;
}

.card-primary-actions {
  margin-top: auto;
  padding: 10px 14px 14px;
}

.registration-stats {
  background: rgba(var(--v-theme-surface-variant), 0.26);
  border-radius: 8px;
  padding: 8px 10px;
}

.status-row {
  min-height: 24px;
  padding: 3px 0;
}

.status-value {
  font-weight: 600;
  min-width: 28px;
  text-align: right;
}

.phase-stepper {
  padding-bottom: 0;
}

.step-item {
  flex: 0 0 auto;
  min-width: 0;
}

.step-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  transition: background 0.2s, border-color 0.2s;
}

.step-dot--done {
  background: rgb(var(--v-theme-success));
  border-color: rgb(var(--v-theme-success));
}

.step-dot--active {
  background: rgb(var(--v-theme-primary));
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.2);
}

.step-dot--future {
  background: transparent;
  border-color: rgba(var(--v-theme-on-surface), 0.2);
}

.step-label {
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-top: 2px;
  white-space: nowrap;
}

.step-connector {
  flex: 1 1 auto;
  height: 2px;
  background: rgba(var(--v-theme-on-surface), 0.15);
  margin: 0 2px;
  margin-bottom: 13px;
  transition: background 0.2s;
}

.step-connector--done {
  background: rgb(var(--v-theme-success));
}
</style>
