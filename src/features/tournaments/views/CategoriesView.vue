<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { useMatchScheduler } from '@/composables/useMatchScheduler';
import {
  useTimeScheduler,
} from '@/composables/useTimeScheduler';
import BaseDialog from '@/components/common/BaseDialog.vue';
import AutoScheduleDialog from '../dialogs/AutoScheduleDialog.vue';
import CategoryManagement from '../components/CategoryManagement.vue';
import CategoryRegistrationStats from '../components/CategoryRegistrationStats.vue';
import CreateLevelsDialog from '../components/CreateLevelsDialog.vue';
import PoolSchedulePanel from '../components/PoolSchedulePanel.vue';
import ManageSeedsDialog from '../dialogs/ManageSeedsDialog.vue';
import type { Category, LevelDefinition, Match } from '@/types';

interface CategoryManagementExposed {
  openAddDialog: () => void;
  openEditDialog: (category: Category) => void;
  requestDeleteCategory: (category: Category) => void;
}

interface MatchScope {
  levelId?: string;
  matches: Match[];
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const matchStore = useMatchStore();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const notificationStore = useNotificationStore();
const timeScheduler = useTimeScheduler();
const scheduler = useMatchScheduler();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const categoryManagementRef = ref<CategoryManagementExposed | null>(null);

const poolCategories = computed(() =>
  categories.value.filter(
    (category) => category.format === 'pool_to_elimination' && category.poolStageId != null
  )
);

const expandedPoolPanels = ref<number[]>([]);
const expandedPoolCategoryIds = computed(() =>
  expandedPoolPanels.value
    .map((index) => poolCategories.value[index]?.id)
    .filter((id): id is string => Boolean(id))
);

watch(poolCategories, () => {
  expandedPoolPanels.value = expandedPoolPanels.value.filter(
    (index) => index >= 0 && index < poolCategories.value.length
  );
});

async function loadCategoriesContext(): Promise<void> {
  try {
    await Promise.all([
      tournamentStore.fetchTournament(tournamentId.value),
      registrationStore.fetchRegistrations(tournamentId.value),
    ]);
    matchStore.unsubscribeAll();
    matchStore.subscribeAllMatches(tournamentId.value);
  } catch (error) {
    console.error('Failed to load categories context:', error);
    notificationStore.showToast('error', 'Failed to load categories');
  }
}

onMounted(() => {
  void loadCategoriesContext();
});

watch(
  tournamentId,
  (newTournamentId, oldTournamentId) => {
    if (newTournamentId === oldTournamentId) return;
    void loadCategoriesContext();
  }
);

onUnmounted(() => {
  matchStore.unsubscribeAll();
});

function isFinishedMatch(match: Match): boolean {
  return match.status === 'completed' || match.status === 'walkover' || match.status === 'cancelled';
}

function getCategoryMatchScopes(
  categoryId: string,
  options: { schedulableOnly?: boolean } = {}
): MatchScope[] {
  const filteredMatches = matchStore.matches.filter((match) => {
    if (match.categoryId !== categoryId) return false;
    if (options.schedulableOnly && isFinishedMatch(match)) return false;
    return true;
  });

  const scopeMap = new Map<string, MatchScope>();
  for (const match of filteredMatches) {
    const key = match.levelId || 'base';
    const existing = scopeMap.get(key);
    if (existing) {
      existing.matches.push(match);
      continue;
    }
    scopeMap.set(key, {
      levelId: match.levelId,
      matches: [match],
    });
  }

  return [...scopeMap.values()].sort((a, b) => {
    const aKey = a.levelId || 'base';
    const bKey = b.levelId || 'base';
    if (aKey === 'base' && bKey !== 'base') return -1;
    if (aKey !== 'base' && bKey === 'base') return 1;
    return aKey.localeCompare(bKey);
  });
}

function getDefaultScheduleStart(): Date {
  if (tournament.value?.startDate instanceof Date) {
    return tournament.value.startDate;
  }
  return new Date();
}

function getPublishedByUser(): string {
  return authStore.currentUser?.id || 'system';
}

// Bracket generation / regeneration
const showRegenerateBracketDialog = ref(false);
const regenerateCategoryId = ref<string | null>(null);
const regenerateInProgress = ref(false);
const categoryLevels = ref<Record<string, LevelDefinition[]>>({});
const selectedLevelId = ref<string | null>(null);

async function generateBracket(categoryId: string): Promise<void> {
  try {
    await tournamentStore.generateBracket(tournamentId.value, categoryId);
    notificationStore.showToast('success', 'Bracket generated successfully!');
    await refreshCategoryLevels(categoryId);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to generate bracket');
  }
}

function openCategoryRegistrations(categoryId: string): void {
  router.push(`/tournaments/${tournamentId.value}/registrations?category=${categoryId}`);
}

function openCategoryEdit(category: Category): void {
  categoryManagementRef.value?.openEditDialog(category);
}

function openCategoryDelete(category: Category): void {
  categoryManagementRef.value?.requestDeleteCategory(category);
}

function viewCategoryBracket(category: Category): void {
  router.push(`/tournaments/${tournamentId.value}/categories/${category.id}/smart-bracket`);
}

function viewPublicSchedule(category: Category): void {
  router.push({
    path: `/tournaments/${tournamentId.value}/schedule`,
    query: { category: category.id },
  });
}

function confirmRegenerateBracket(categoryId: string): void {
  regenerateCategoryId.value = categoryId;
  showRegenerateBracketDialog.value = true;
}

async function regenerateBracket(): Promise<void> {
  if (!regenerateCategoryId.value) return;
  regenerateInProgress.value = true;
  try {
    await tournamentStore.regenerateBracket(tournamentId.value, regenerateCategoryId.value);
    notificationStore.showToast('success', 'Bracket regenerated successfully! Progression links updated.');
    showRegenerateBracketDialog.value = false;
    await refreshCategoryLevels(regenerateCategoryId.value);
  } catch (error) {
    console.error('Failed to regenerate bracket:', error);
    notificationStore.showToast('error', 'Failed to regenerate bracket');
  } finally {
    regenerateInProgress.value = false;
    regenerateCategoryId.value = null;
  }
}

// Regenerate Pools dialog
const showRegeneratePoolsDialog = ref(false);
const regeneratePoolsCategoryId = ref<string | null>(null);
const regeneratePoolsInProgress = ref(false);

function confirmRegeneratePools(categoryId: string): void {
  regeneratePoolsCategoryId.value = categoryId;
  showRegeneratePoolsDialog.value = true;
}

async function regeneratePools(): Promise<void> {
  if (!regeneratePoolsCategoryId.value) return;
  regeneratePoolsInProgress.value = true;
  try {
    await tournamentStore.regeneratePools(tournamentId.value, regeneratePoolsCategoryId.value);
    notificationStore.showToast('success', 'Pools regenerated successfully!');
    showRegeneratePoolsDialog.value = false;
  } catch (error) {
    console.error('Failed to regenerate pools:', error);
    notificationStore.showToast('error', 'Failed to regenerate pools');
  } finally {
    regeneratePoolsInProgress.value = false;
    regeneratePoolsCategoryId.value = null;
  }
}

async function refreshCategoryLevels(categoryId: string): Promise<void> {
  try {
    const levels = await tournamentStore.fetchCategoryLevels(tournamentId.value, categoryId);
    categoryLevels.value = { ...categoryLevels.value, [categoryId]: levels };
    if (levels.length > 0) {
      selectedLevelId.value = levels[0].id;
    }
  } catch (error) {
    console.error('Failed to fetch category levels:', error);
  }
}

// Create Levels dialog
const showCreateLevelsDialog = ref(false);
const createLevelsCategoryId = ref<string | null>(null);

const createLevelsCategoryName = computed(() => {
  if (!createLevelsCategoryId.value) return '';
  return categories.value.find((category) => category.id === createLevelsCategoryId.value)?.name || '';
});

function openCreateLevelsDialog(categoryId: string): void {
  createLevelsCategoryId.value = categoryId;
  showCreateLevelsDialog.value = true;
}

async function handleLevelsGenerated(): Promise<void> {
  if (createLevelsCategoryId.value) {
    await refreshCategoryLevels(createLevelsCategoryId.value);
  }
  await tournamentStore.fetchTournament(tournamentId.value);
}

watch(showCreateLevelsDialog, (isOpen) => {
  if (!isOpen) createLevelsCategoryId.value = null;
});

// Time scheduling / publish actions
const showScheduleDialog = ref(false);
const scheduleDialogInitialCategoryIds = ref<string[]>([]);
const activeCourtCount = computed(() =>
  Math.max(1, tournamentStore.courts.filter((court) => court.status !== 'maintenance').length)
);

function openScheduleDialog(category: Category): void {
  scheduleDialogInitialCategoryIds.value = [category.id];
  showScheduleDialog.value = true;
}

async function publishCategorySchedule(category: Category, force = false): Promise<void> {
  const scopes = getCategoryMatchScopes(category.id);
  if (scopes.length === 0) {
    notificationStore.showToast('error', 'No matches available to publish');
    return;
  }

  try {
    let publishedCount = 0;
    let autoScheduled = 0;
    let nextStart = getDefaultScheduleStart();

    for (const scope of scopes) {
      const scopeHasPlannedTimes = scope.matches.some((match) => Boolean(match.plannedStartAt));

      if (!scopeHasPlannedTimes) {
        const schedulableMatches = scope.matches.filter((match) => !isFinishedMatch(match));
        if (schedulableMatches.length === 0) continue;
        const scheduled = await scheduler.scheduleMatches(
          tournamentId.value,
          {
            categoryId: category.id,
            levelId: scope.levelId,
            startTime: nextStart,
            matchDurationMinutes: tournament.value?.settings?.matchDurationMinutes ?? 20,
            bufferMinutes: 5,
            concurrency: Math.max(1, activeCourtCount.value),
            respectDependencies: false,
          }
        );
        autoScheduled += scheduled.stats.scheduledCount;
        const scopeEnd = scheduled.scheduled.reduce<Date | null>((latest, entry) => {
          if (!latest || entry.estimatedEndTime > latest) return entry.estimatedEndTime;
          return latest;
        }, null);
        if (scopeEnd) {
          nextStart = new Date(scopeEnd.getTime() + 5 * 60_000);
        }
      }

      const published = await timeScheduler.publish(
        tournamentId.value,
        [category.id],
        getPublishedByUser(),
        scope.levelId,
        { force }
      );
      publishedCount += published.publishedCount;
    }

    if (publishedCount === 0) {
      notificationStore.showToast('warning', 'No planned match times available to publish');
      return;
    }

    const actionLabel = force ? 'Republished' : 'Published';
    if (autoScheduled > 0) {
      notificationStore.showToast(
        'success',
        `${actionLabel} schedule (${publishedCount} matches). Auto-scheduled ${autoScheduled} first.`
      );
      return;
    }

    notificationStore.showToast('success', `${actionLabel} schedule (${publishedCount} matches)`);
  } catch (error) {
    console.error('Failed to publish schedule:', error);
    notificationStore.showToast('error', 'Failed to publish schedule');
  }
}

async function unpublishCategorySchedule(category: Category): Promise<void> {
  const scopes = getCategoryMatchScopes(category.id);
  if (scopes.length === 0) {
    notificationStore.showToast('error', 'No matches available to unpublish');
    return;
  }

  try {
    let unpublishedCount = 0;
    for (const scope of scopes) {
      const unpublished = await timeScheduler.unpublish(
        tournamentId.value,
        [category.id],
        scope.levelId
      );
      unpublishedCount += unpublished.unpublishedCount;
    }

    if (unpublishedCount === 0) {
      notificationStore.showToast('warning', 'No published schedule entries found');
      return;
    }

    notificationStore.showToast('success', `Unpublished schedule (${unpublishedCount} matches)`);
  } catch (error) {
    console.error('Failed to unpublish schedule:', error);
    notificationStore.showToast('error', 'Failed to unpublish schedule');
  }
}

// Seeding dialog
const showSeedingDialog = ref(false);
const seedingCategoryId = ref<string | null>(null);

function openSeedingDialog(categoryId: string): void {
  seedingCategoryId.value = categoryId;
  showSeedingDialog.value = true;
}
</script>

<template>
  <v-container fluid>
    <CategoryManagement
      ref="categoryManagementRef"
      :tournament-id="tournamentId"
    />

    <CategoryRegistrationStats
      :tournament-id="tournamentId"
      :expanded-pool-category-ids="expandedPoolCategoryIds"
      class="mt-6"
      @generate-bracket="generateBracket"
      @create-levels="openCreateLevelsDialog"
      @regenerate-bracket="confirmRegenerateBracket"
      @regenerate-pools="confirmRegeneratePools"
      @manage-registrations="openCategoryRegistrations"
      @manage-seeds="openSeedingDialog"
      @setup-category="openCategoryEdit"
      @edit-category="openCategoryEdit"
      @delete-category="openCategoryDelete"
      @view-bracket="viewCategoryBracket"
      @view-public-schedule="viewPublicSchedule"
      @schedule-times="openScheduleDialog"
      @publish-schedule="publishCategorySchedule"
      @republish-schedule="(category) => publishCategorySchedule(category, true)"
      @unpublish-schedule="unpublishCategorySchedule"
    />

    <v-expansion-panels
      v-if="poolCategories.length > 0"
      v-model="expandedPoolPanels"
      class="mt-4"
      variant="accordion"
      multiple
    >
      <v-expansion-panel
        v-for="(cat, idx) in poolCategories"
        :key="'pool-' + cat.id"
        :value="idx"
      >
        <v-expansion-panel-title>
          <v-icon
            class="mr-2"
            size="18"
            color="primary"
          >
            mdi-table-tennis
          </v-icon>
          <span class="text-body-2 font-weight-medium">{{ cat.name }} — Pool Schedule</span>
          <v-spacer />
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <PoolSchedulePanel
            :tournament-id="tournamentId"
            :category-id="cat.id"
            :category-name="cat.name"
            @create-levels="openCreateLevelsDialog"
          />
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <AutoScheduleDialog
      v-model="showScheduleDialog"
      dialog-context="schedule"
      :initial-category-ids="scheduleDialogInitialCategoryIds"
      :tournament-id="tournamentId"
      :categories="categories"
      :courts="tournamentStore.courts"
    />

    <CreateLevelsDialog
      v-if="createLevelsCategoryId"
      v-model="showCreateLevelsDialog"
      :tournament-id="tournamentId"
      :category-id="createLevelsCategoryId"
      :category-name="createLevelsCategoryName"
      @generated="handleLevelsGenerated"
    />

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

    <BaseDialog
      v-model="showRegeneratePoolsDialog"
      title="Regenerate Pools?"
      max-width="500"
      @confirm="regeneratePools"
      @cancel="showRegeneratePoolsDialog = false"
    >
      <div class="d-flex align-center">
        <v-icon
          color="warning"
          class="mr-2"
        >
          mdi-alert
        </v-icon>
        <span>Regenerate Pools?</span>
      </div>
      <p class="mb-3">
        This will clear all existing pool assignments and schedule times, then create fresh pools.
      </p>
      <v-alert
        type="warning"
        variant="tonal"
        class="mb-3"
      >
        <strong>Warning:</strong> All pool match scores and schedule times will be lost.
        Only do this before publishing the schedule.
      </v-alert>
      <p class="text-body-2 text-grey">
        Seeding and registrations will be preserved.
      </p>
      <template #actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="showRegeneratePoolsDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="warning"
          variant="flat"
          :loading="regeneratePoolsInProgress"
          @click="regeneratePools"
        >
          Regenerate Pools
        </v-btn>
      </template>
    </BaseDialog>

    <ManageSeedsDialog
      v-model="showSeedingDialog"
      :tournament-id="tournamentId"
      :category-id="seedingCategoryId"
    />
  </v-container>
</template>
