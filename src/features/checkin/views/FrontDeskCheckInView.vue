<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import BulkCheckInPanel from '@/features/checkin/components/BulkCheckInPanel.vue';
import RapidCheckInPanel from '@/features/checkin/components/RapidCheckInPanel.vue';
import { useFrontDeskCheckInWorkflow } from '@/features/checkin/composables/useFrontDeskCheckInWorkflow';

type FrontDeskMode = 'rapid' | 'bulk';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const matchStore = useMatchStore();
const notificationStore = useNotificationStore();
const registrationStore = useRegistrationStore();
const tournamentStore = useTournamentStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);

const mode = ref<FrontDeskMode>('rapid');
const scanLoading = ref(false);
const bulkLoading = ref(false);
const selectedIds = ref<string[]>([]);
const pendingQuickCheckInIds = ref<string[]>([]);
const bibStartFrom = ref(101);

const scanOverlay = ref<{
  type: 'success' | 'error';
  title: string;
  subtitle?: string;
} | null>(null);
let overlayTimer: ReturnType<typeof setTimeout> | null = null;

const getCategoryName = (categoryId: string): string => {
  const category = categories.value.find((item) => item.id === categoryId);
  return category?.name ?? 'Unknown Category';
};

const workflow = useFrontDeskCheckInWorkflow({
  registrations: computed(() => registrationStore.registrations),
  matches: computed(() => matchStore.matches),
  getParticipantName,
  getCategoryName,
  checkInRegistration: async (registrationId: string) => {
    await registrationStore.checkInRegistration(tournamentId.value, registrationId);
  },
  undoCheckInRegistration: async (registrationId: string) => {
    await registrationStore.undoCheckInRegistration(
      tournamentId.value,
      registrationId,
      authStore.currentUser?.id
    );
  },
  assignBibNumber: async (registrationId: string, bibNumber: number) => {
    await registrationStore.assignBibNumber(tournamentId.value, registrationId, bibNumber);
  },
});

const urgentItems = workflow.urgentItems;
const recentItems = workflow.recentItems;
const bulkRows = workflow.bulkRows;
const stats = workflow.stats;
const throughput = workflow.throughput;
const bulkUndoToken = workflow.bulkUndoToken;

const statsTone = computed(() => {
  if (stats.value.ratePercent > 80) return 'success';
  if (stats.value.ratePercent >= 50) return 'warning';
  return 'error';
});

const showScanOverlay = (payload: { type: 'success' | 'error'; title: string; subtitle?: string }): void => {
  scanOverlay.value = payload;
  if (overlayTimer) clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => {
    scanOverlay.value = null;
  }, 1500);
};

const toggleSelectRow = (registrationId: string): void => {
  if (selectedIds.value.includes(registrationId)) {
    selectedIds.value = selectedIds.value.filter((id) => id !== registrationId);
  } else {
    selectedIds.value = [...selectedIds.value, registrationId];
  }
};

const toggleSelectAll = (): void => {
  if (selectedIds.value.length === bulkRows.value.length) {
    selectedIds.value = [];
  } else {
    selectedIds.value = bulkRows.value.map((row) => row.id);
  }
};

const handleScanSubmit = async (raw: string): Promise<void> => {
  scanLoading.value = true;
  try {
    const result = await workflow.processScan(raw, { bibStartFrom: bibStartFrom.value });
    showScanOverlay({
      type: 'success',
      title: `✓ ${result.name} Checked In`,
      subtitle: result.bibNumber ? `Bib #${result.bibNumber} assigned` : undefined,
    });
    notificationStore.showToast(
      'success',
      result.bibNumber ? `${result.name} checked in (Bib ${result.bibNumber})` : `${result.name} checked in`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process scan';
    showScanOverlay({
      type: 'error',
      title: '⚠ Check-in failed',
      subtitle: message,
    });
    notificationStore.showToast('error', message);
  } finally {
    scanLoading.value = false;
  }
};

const handleQuickCheckIn = async (registrationId: string): Promise<void> => {
  if (pendingQuickCheckInIds.value.includes(registrationId)) return;

  pendingQuickCheckInIds.value = [...pendingQuickCheckInIds.value, registrationId];
  try {
    const result = await workflow.checkInOne(registrationId, bibStartFrom.value);
    notificationStore.showToast('success', `${result.name} checked in`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check in participant';
    notificationStore.showToast('error', message);
  } finally {
    pendingQuickCheckInIds.value = pendingQuickCheckInIds.value.filter((id) => id !== registrationId);
  }
};

const handleUndoItem = async (registrationId: string): Promise<void> => {
  try {
    await workflow.undoItem(registrationId);
    notificationStore.showToast('success', 'Check-in removed');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to undo check-in';
    notificationStore.showToast('error', message);
  }
};

const handleBulkCheckIn = async (): Promise<void> => {
  if (selectedIds.value.length === 0) {
    notificationStore.showToast('warning', 'No participants selected');
    return;
  }

  bulkLoading.value = true;
  try {
    const result = await workflow.bulkCheckIn(selectedIds.value, bibStartFrom.value);
    const successCount = result.successIds.length;
    const failedCount = result.failed.length;

    if (failedCount > 0) {
      notificationStore.showToast(
        'warning',
        `${successCount} checked in, ${failedCount} failed. Retry failed participants.`
      );
      selectedIds.value = result.failed.map((failure) => failure.id);
    } else {
      notificationStore.showToast('success', `${successCount} participants checked in`);
      selectedIds.value = [];
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bulk check-in failed';
    notificationStore.showToast('error', message);
  } finally {
    bulkLoading.value = false;
  }
};

const handleBulkUndo = async (): Promise<void> => {
  try {
    const result = await workflow.undoBulk();
    notificationStore.showToast(
      'success',
      `Bulk undo complete (${result.successIds.length} restored)`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bulk undo failed';
    notificationStore.showToast('error', message);
  }
};

const handleUndoLatestShortcut = async (): Promise<void> => {
  try {
    await workflow.undoLatest();
    notificationStore.showToast('success', 'Last check-in undone');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to undo last check-in';
    notificationStore.showToast('warning', message);
  }
};

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
  matchStore.subscribeAllMatches(tournamentId.value);
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
  registrationStore.unsubscribeAll();
  matchStore.unsubscribeAll();
  if (overlayTimer) clearTimeout(overlayTimer);
});
</script>

<template>
  <v-container
    fluid
    class="frontdesk-checkin pa-0"
  >
    <v-toolbar
      class="frontdesk-checkin__topbar px-4"
      color="surface"
      density="comfortable"
      elevation="1"
    >
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        @click="router.push(`/tournaments/${tournamentId}`)"
      />
      <v-toolbar-title class="text-subtitle-1 font-weight-bold">
        Front Desk Check-in
        <span class="text-caption text-medium-emphasis ml-2">
          {{ tournament?.name }}
        </span>
      </v-toolbar-title>
      <v-spacer />
      <v-btn-toggle
        v-model="mode"
        mandatory
        density="comfortable"
        color="primary"
        variant="outlined"
      >
        <v-btn value="rapid">
          Rapid
        </v-btn>
        <v-btn value="bulk">
          Bulk
        </v-btn>
      </v-btn-toggle>
    </v-toolbar>

    <div class="frontdesk-checkin__body pa-4">
      <v-card
        class="mb-4"
        variant="outlined"
      >
        <v-card-text class="d-flex align-center ga-3 flex-wrap">
          <v-chip
            variant="tonal"
            size="small"
          >
            Approved: {{ stats.approvedTotal }}
          </v-chip>
          <v-chip
            color="success"
            variant="tonal"
            size="small"
          >
            Checked In: {{ stats.checkedIn }}
          </v-chip>
          <v-chip
            color="error"
            variant="tonal"
            size="small"
          >
            No Show: {{ stats.noShow }}
          </v-chip>
          <v-spacer />
          <div class="d-flex align-center ga-3">
            <v-text-field
              v-model.number="bibStartFrom"
              label="Bib Start"
              type="number"
              min="1"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 140px"
            />
            <v-progress-circular
              :model-value="stats.ratePercent"
              :color="statsTone"
              size="46"
              width="4"
            >
              {{ stats.ratePercent }}%
            </v-progress-circular>
          </div>
          <div class="w-100 text-caption text-medium-emphasis mt-1">
            Last 5 min: {{ throughput.checkInsLastFiveMinutes }}
            <span v-if="throughput.avgSecondsPerCheckIn > 0">
              • Avg/check-in: {{ throughput.avgSecondsPerCheckIn }}s
            </span>
          </div>
        </v-card-text>
      </v-card>

      <v-alert
        v-if="bulkUndoToken"
        type="info"
        variant="tonal"
        class="mb-4"
      >
        <div class="d-flex align-center ga-2">
          <span>Bulk undo available for 10 seconds.</span>
          <v-spacer />
          <v-btn
            size="small"
            variant="text"
            @click="handleBulkUndo"
          >
            Undo Bulk
          </v-btn>
        </div>
      </v-alert>

      <rapid-check-in-panel
        v-if="mode === 'rapid'"
        :urgent-items="urgentItems"
        :recent-items="recentItems"
        :search-rows="bulkRows"
        :loading="scanLoading"
        :pending-ids="pendingQuickCheckInIds"
        @scan-submit="handleScanSubmit"
        @quick-check-in="handleQuickCheckIn"
        @undo-item="handleUndoItem"
        @undo-latest-shortcut="handleUndoLatestShortcut"
      />

      <bulk-check-in-panel
        v-else
        :rows="bulkRows"
        :selected-ids="selectedIds"
        :loading="bulkLoading"
        @toggle-row="toggleSelectRow"
        @toggle-all="toggleSelectAll"
        @bulk-check-in="handleBulkCheckIn"
      />
    </div>

    <div
      v-if="scanOverlay"
      class="frontdesk-checkin__overlay"
      :class="scanOverlay.type === 'success' ? 'frontdesk-checkin__overlay--success' : 'frontdesk-checkin__overlay--error'"
    >
      <div class="text-h5 font-weight-bold">
        {{ scanOverlay.title }}
      </div>
      <div
        v-if="scanOverlay.subtitle"
        class="text-subtitle-1 mt-1"
      >
        {{ scanOverlay.subtitle }}
      </div>
    </div>
  </v-container>
</template>

<style scoped>
.frontdesk-checkin {
  min-height: 100vh;
  background: rgb(var(--v-theme-background));
}

.frontdesk-checkin__topbar {
  position: sticky;
  top: 0;
  z-index: 20;
}

.frontdesk-checkin__body {
  max-width: 1440px;
  margin: 0 auto;
}

.frontdesk-checkin__overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  text-align: center;
  backdrop-filter: blur(1px);
}

.frontdesk-checkin__overlay--success {
  background: rgba(16, 185, 129, 0.55);
}

.frontdesk-checkin__overlay--error {
  background: rgba(239, 68, 68, 0.55);
}
</style>
