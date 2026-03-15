<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, useTemplateRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import CheckInList from '@/features/checkin/components/CheckInList.vue';
import { NAVIGATION_ICONS } from '@/constants/navigationIcons';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const registrations = computed(() => registrationStore.registrations);

const searchQuery = ref('');
const selectedCategory = ref<string>('all');
const selectedStatus = ref<string>('all');
const selectedSort = ref<string>('default');
const selectedRegistrationIds = ref<string[]>([]);
const bulkLoading = ref(false);
const searchInputRef = useTemplateRef('searchInput');

const checkInRegistrations = computed(() =>
  registrations.value.filter((registration) =>
    registration.status === 'approved' ||
    registration.status === 'checked_in' ||
    registration.status === 'no_show'
  )
);

const filteredRegistrations = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const result = checkInRegistrations.value.filter((registration) => {
    if (selectedCategory.value !== 'all' && registration.categoryId !== selectedCategory.value) {
      return false;
    }

    if (selectedStatus.value !== 'all' && registration.status !== selectedStatus.value) {
      return false;
    }

    if (!query) return true;

    const participantName = getParticipantName(registration.id).toLowerCase();
    const categoryName = getCategoryName(registration.categoryId).toLowerCase();
    return participantName.includes(query) || categoryName.includes(query);
  });

  const sorted = [...result];
  switch (selectedSort.value) {
    case 'name_asc':
      sorted.sort((a, b) => getParticipantName(a.id).localeCompare(getParticipantName(b.id)));
      return sorted;
    case 'name_desc':
      sorted.sort((a, b) => getParticipantName(b.id).localeCompare(getParticipantName(a.id)));
      return sorted;
    case 'category_asc':
      sorted.sort((a, b) => getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId)));
      return sorted;
    case 'status_asc':
      sorted.sort((a, b) => a.status.localeCompare(b.status));
      return sorted;
    default:
      return result;
  }
});

const stats = computed(() => {
  const relevant = checkInRegistrations.value;
  const approved = relevant.filter((registration) => registration.status === 'approved').length;
  const checkedIn = relevant.filter((registration) => registration.status === 'checked_in').length;
  const noShow = relevant.filter((registration) => registration.status === 'no_show').length;
  const total = relevant.length;
  const checkInRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

  return {
    total,
    approved,
    checkedIn,
    noShow,
    checkInRate,
  };
});

const categoryOptions = computed(() => [
  { title: 'All Categories', value: 'all' },
  ...categories.value.map((category) => ({ title: category.name, value: category.id })),
]);

const statusOptions = [
  { title: 'All Statuses', value: 'all' },
  { title: 'Approved', value: 'approved' },
  { title: 'Checked In', value: 'checked_in' },
  { title: 'No Show', value: 'no_show' },
];

const sortOptions = [
  { title: 'Default', value: 'default' },
  { title: 'Name (A-Z)', value: 'name_asc' },
  { title: 'Name (Z-A)', value: 'name_desc' },
  { title: 'Category (A-Z)', value: 'category_asc' },
  { title: 'Status (A-Z)', value: 'status_asc' },
];

const hasActiveFilters = computed(() => (
  Boolean(searchQuery.value.trim()) ||
  selectedCategory.value !== 'all' ||
  selectedStatus.value !== 'all' ||
  selectedSort.value !== 'default'
));

const canBulkCheckIn = computed(() =>
  selectedRegistrationIds.value.length > 0 &&
  selectedRegistrationIds.value.some((id) => {
    const reg = checkInRegistrations.value.find((r) => r.id === id);
    return reg?.status === 'approved';
  })
);

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
  
  // Auto-focus search on mount
  setTimeout(() => {
    searchInputRef.value?.focus?.();
  }, 100);
});

onUnmounted(() => {
  registrationStore.unsubscribeAll();
});

function getCategoryName(categoryId: string): string {
  const category = categories.value.find((item) => item.id === categoryId);
  return category?.name || 'Unknown Category';
}

function clearFilters(): void {
  searchQuery.value = '';
  selectedCategory.value = 'all';
  selectedStatus.value = 'all';
  selectedSort.value = 'default';
}

function handleSelect(registrationId: string, selected: boolean): void {
  if (selected) {
    if (!selectedRegistrationIds.value.includes(registrationId)) {
      selectedRegistrationIds.value = [...selectedRegistrationIds.value, registrationId];
    }
  } else {
    selectedRegistrationIds.value = selectedRegistrationIds.value.filter((id) => id !== registrationId);
  }
}

function handleSelectAll(selected: boolean): void {
  if (selected) {
    selectedRegistrationIds.value = filteredRegistrations.value.map((r) => r.id);
  } else {
    selectedRegistrationIds.value = [];
  }
}

async function handleCheckIn(registrationId: string): Promise<void> {
  const registration = checkInRegistrations.value.find((r) => r.id === registrationId);
  if (!registration || registration.status !== 'approved') return;

  try {
    await registrationStore.checkInRegistration(
      tournamentId.value,
      registrationId
    );
    notificationStore.showToast('success', `${getParticipantName(registrationId)} checked in`);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to check in participant');
  }
}

async function handleUndo(registrationId: string): Promise<void> {
  try {
    await registrationStore.undoCheckInRegistration(
      tournamentId.value,
      registrationId,
      authStore.currentUser?.id
    );
    notificationStore.showToast('success', 'Check-in removed');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to undo check-in');
  }
}

async function handleRestore(registrationId: string): Promise<void> {
  try {
    await registrationStore.undoNoShowRegistration(
      tournamentId.value,
      registrationId,
      authStore.currentUser?.id
    );
    notificationStore.showToast('success', 'Participant restored');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to restore participant');
  }
}

async function handleMarkNoShow(registrationId: string): Promise<void> {
  try {
    await registrationStore.markNoShowRegistration(
      tournamentId.value,
      registrationId,
      authStore.currentUser?.id
    );
    notificationStore.showToast('success', `${getParticipantName(registrationId)} marked as no-show`);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to mark no-show');
  }
}

async function handleUpdateBib(registrationId: string, bibNumber: number | null): Promise<void> {
  if (!bibNumber) return;

  try {
    await registrationStore.assignBibNumber(tournamentId.value, registrationId, bibNumber);
    notificationStore.showToast('success', 'Bib number updated');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update bib number';
    notificationStore.showToast('error', message);
  }
}

async function bulkCheckIn(): Promise<void> {
  const approvedIds = selectedRegistrationIds.value.filter((id) => {
    const reg = checkInRegistrations.value.find((r) => r.id === id);
    return reg?.status === 'approved';
  });

  if (approvedIds.length === 0) {
    notificationStore.showToast('error', 'No approved participants selected');
    return;
  }

  bulkLoading.value = true;
  let successCount = 0;

  for (const registrationId of approvedIds) {
    try {
      await registrationStore.checkInRegistration(
        tournamentId.value,
        registrationId
      );
      successCount++;
    } catch (error) {
      console.error('Bulk check-in failed:', error);
    }
  }

  bulkLoading.value = false;
  selectedRegistrationIds.value = [];
  notificationStore.showToast('success', `Checked in ${successCount} participant(s)`);
}

// Keyboard shortcut: / or Cmd+K to focus search
function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
    const target = event.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
      event.preventDefault();
      searchInputRef.value?.focus?.();
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <v-container
    fluid
    class="checkin-dashboard"
  >
    <!-- Header -->
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <div class="text-caption text-grey-darken-1">
          {{ tournament?.name }}
        </div>
        <h1 class="text-h4 font-weight-bold d-flex align-center ga-2">
          <v-icon :icon="NAVIGATION_ICONS.checkIn" size="26" color="success" />
          Player Check-in
        </h1>
      </div>
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        @click="router.push(`/tournaments/${tournamentId}/registrations`)"
      >
        Back to Registrations
      </v-btn>
    </div>

    <!-- Stats Cards -->
    <v-row class="mb-4">
      <v-col
        cols="6"
        md="3"
      >
        <v-card>
          <v-card-text>
            <div class="text-caption text-grey">
              Approved
            </div>
            <div class="text-h5 font-weight-bold">
              {{ stats.approved }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="6"
        md="3"
      >
        <v-card
          color="success"
          variant="tonal"
        >
          <v-card-text>
            <div class="text-caption">
              Checked In
            </div>
            <div class="text-h5 font-weight-bold">
              {{ stats.checkedIn }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="6"
        md="3"
      >
        <v-card
          color="error"
          variant="tonal"
        >
          <v-card-text>
            <div class="text-caption">
              No Show
            </div>
            <div class="text-h5 font-weight-bold">
              {{ stats.noShow }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="6"
        md="3"
      >
        <v-card>
          <v-card-text>
            <div class="text-caption text-grey">
              Check-in Rate
            </div>
            <div
              class="text-h5 font-weight-bold"
              :class="stats.checkInRate >= 80 ? 'text-success' : ''"
            >
              {{ stats.checkInRate }}%
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Main Content -->
    <v-card class="checkin-dashboard__main-card">
      <!-- Filters -->
      <v-card-text class="pb-0">
        <div class="d-flex align-center gap-2 mb-3">
          <v-text-field
            ref="searchInput"
            v-model="searchQuery"
            placeholder="Search participants..."
            prepend-inner-icon="mdi-magnify"
            hide-details
            density="compact"
            variant="outlined"
            clearable
            class="flex-grow-1"
            autofocus
          >
            <template #append-inner>
              <v-tooltip text="Press / to focus search">
                <template #activator="{ props: tooltipProps }">
                  <v-icon
                    v-bind="tooltipProps"
                    size="small"
                    color="grey"
                  >
                    mdi-keyboard-slash
                  </v-icon>
                </template>
              </v-tooltip>
            </template>
          </v-text-field>

          <v-select
            v-model="selectedCategory"
            :items="categoryOptions"
            item-title="title"
            item-value="value"
            placeholder="Category"
            hide-details
            density="compact"
            variant="outlined"
            clearable
            style="min-width: 150px"
          />

          <v-select
            v-model="selectedStatus"
            :items="statusOptions"
            item-title="title"
            item-value="value"
            placeholder="Status"
            hide-details
            density="compact"
            variant="outlined"
            clearable
            style="min-width: 130px"
          />

          <v-select
            v-model="selectedSort"
            :items="sortOptions"
            item-title="title"
            item-value="value"
            placeholder="Sort"
            hide-details
            density="compact"
            variant="outlined"
            style="min-width: 120px"
          />

          <v-btn
            v-if="hasActiveFilters"
            icon="mdi-close"
            variant="text"
            density="compact"
            aria-label="Clear filters"
            @click="clearFilters"
          />
        </div>
      </v-card-text>

      <v-divider />

      <!-- Bulk Actions Bar -->
      <div
        v-if="selectedRegistrationIds.length > 0"
        class="px-4 py-2 bg-primary-lighten-5 d-flex align-center"
      >
        <span class="text-body-2 font-weight-medium">{{ selectedRegistrationIds.length }} selected</span>
        <v-spacer />
        <v-btn
          v-if="canBulkCheckIn"
          color="success"
          size="small"
          :loading="bulkLoading"
          prepend-icon="mdi-check-all"
          @click="bulkCheckIn"
        >
          Check In Selected
        </v-btn>
      </div>

      <!-- Check-in List -->
      <check-in-list
        :registrations="filteredRegistrations"
        :selected-ids="selectedRegistrationIds"
        :get-participant-name="getParticipantName"
        :get-category-name="getCategoryName"
        @select="handleSelect"
        @select-all="handleSelectAll"
        @check-in="handleCheckIn"
        @undo="handleUndo"
        @restore="handleRestore"
        @mark-no-show="handleMarkNoShow"
        @update-bib="handleUpdateBib"
      />
    </v-card>
  </v-container>
</template>

<style scoped>
.checkin-dashboard {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.checkin-dashboard__main-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.checkin-dashboard__main-card :deep(.v-card-text) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.bg-primary-lighten-5 {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .checkin-dashboard {
    height: auto;
    overflow: visible;
  }
}
</style>
