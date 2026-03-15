<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useTournamentBranding } from '@/composables/useTournamentBranding';
import TournamentBrandMark from '@/components/common/TournamentBrandMark.vue';
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
const { tournamentLogoUrl } = useTournamentBranding(tournament);
const tournamentStartDateLabel = computed(() => {
  const startDate = tournament.value?.startDate;
  if (!startDate) return '';
  const normalizedStartDate = startDate instanceof Date ? startDate : new Date(startDate);
  if (Number.isNaN(normalizedStartDate.getTime())) return '';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(normalizedStartDate);
});

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
    <div
      class="frontdesk-checkin__ambient"
      aria-hidden="true"
    />

    <v-toolbar
      class="frontdesk-checkin__topbar px-3 px-sm-6"
      color="transparent"
      density="comfortable"
      elevation="0"
    >
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        class="frontdesk-checkin__back-btn"
        aria-label="Back to tournament dashboard"
        @click="router.push(`/tournaments/${tournamentId}`)"
      />
      <img
        src="/logo.svg"
        alt="CourtMastr"
        class="frontdesk-checkin__app-logo"
        width="28"
        height="28"
      >
      <v-toolbar-title class="frontdesk-checkin__toolbar-title">
        <span class="frontdesk-checkin__toolbar-heading">
          Front Desk
        </span>
        <span class="frontdesk-checkin__toolbar-subheading">
          {{ tournament?.name }}
        </span>
      </v-toolbar-title>
      <v-spacer />
      <v-chip
        size="small"
        color="primary"
        variant="tonal"
        class="mr-3 frontdesk-checkin__live-chip"
      >
        Live Ops
      </v-chip>
      <v-btn-toggle
        v-model="mode"
        mandatory
        density="comfortable"
        color="primary"
        variant="flat"
        class="frontdesk-checkin__mode-toggle"
      >
        <v-btn value="rapid">
          Rapid
        </v-btn>
        <v-btn value="bulk">
          Bulk
        </v-btn>
      </v-btn-toggle>
    </v-toolbar>

    <div class="frontdesk-checkin__body px-3 px-sm-6 py-5">
      <v-card
        class="frontdesk-checkin__hero mb-5"
        elevation="0"
      >
        <v-card-text class="pa-5 pa-sm-6">
          <div class="d-flex align-start flex-wrap ga-4">
            <div class="frontdesk-checkin__hero-brand">
              <TournamentBrandMark
                :tournament-name="tournament?.name || 'Tournament'"
                :logo-url="tournamentLogoUrl"
                fallback-icon="mdi-account-check"
                :width="88"
                :height="88"
                class="frontdesk-checkin__hero-mark"
              />
              <div class="frontdesk-checkin__hero-copy">
                <div class="text-overline frontdesk-checkin__eyebrow mb-1">
                  Tournament Operations
                </div>
                <div class="frontdesk-checkin__hero-tournament mb-1">
                  {{ tournament?.name }}
                </div>
                <div
                  v-if="tournamentStartDateLabel"
                  class="frontdesk-checkin__hero-date mb-2"
                >
                  {{ tournamentStartDateLabel }}
                </div>
                <h1 class="text-h4 frontdesk-checkin__title mb-2">
                  Check-In Command Center
                </h1>
                <p class="text-body-2 frontdesk-checkin__subtitle">
                  Fast intake, instant feedback, and branded arrival flow across tablet, desktop, and phone.
                </p>
              </div>
            </div>
            <v-spacer />
            <div class="frontdesk-checkin__hero-actions d-flex align-center ga-3 flex-wrap">
              <div class="frontdesk-checkin__bib-sheet px-3 py-2">
                <div class="text-caption text-medium-emphasis mb-1">
                  Bib Start
                </div>
                <v-text-field
                  v-model.number="bibStartFrom"
                  type="number"
                  min="1"
                  density="compact"
                  variant="outlined"
                  hide-details
                  class="frontdesk-checkin__bib-input"
                />
              </div>

              <div class="frontdesk-checkin__rate-ring d-flex flex-column align-center">
                <v-progress-circular
                  :model-value="stats.ratePercent"
                  :color="statsTone"
                  size="58"
                  width="5"
                >
                  {{ stats.ratePercent }}%
                </v-progress-circular>
                <span class="text-caption mt-1">Check-In Rate</span>
              </div>
            </div>
          </div>

          <div class="frontdesk-checkin__metrics mt-5">
            <div class="frontdesk-checkin__metric frontdesk-checkin__metric--approved px-4 py-3">
              <span class="text-caption text-medium-emphasis">Approved</span>
              <strong class="text-h5">{{ stats.approvedTotal }}</strong>
            </div>
            <div class="frontdesk-checkin__metric frontdesk-checkin__metric--checked px-4 py-3">
              <span class="text-caption text-medium-emphasis">Checked In</span>
              <strong class="text-h5">{{ stats.checkedIn }}</strong>
            </div>
            <div class="frontdesk-checkin__metric frontdesk-checkin__metric--noshow px-4 py-3">
              <span class="text-caption text-medium-emphasis">No Show</span>
              <strong class="text-h5">{{ stats.noShow }}</strong>
            </div>
            <div class="frontdesk-checkin__metric frontdesk-checkin__metric--throughput px-4 py-3">
              <span class="text-caption text-medium-emphasis">Last 5 Minutes</span>
              <strong class="text-h5">{{ throughput.checkInsLastFiveMinutes }}</strong>
            </div>
          </div>

          <div class="w-100 text-caption frontdesk-checkin__hero-footnote mt-4">
            Avg/check-in: {{
              throughput.avgSecondsPerCheckIn > 0
                ? `${throughput.avgSecondsPerCheckIn}s`
                : 'N/A'
            }}
          </div>
        </v-card-text>
      </v-card>

      <v-alert
        v-if="bulkUndoToken"
        type="info"
        variant="tonal"
        class="mb-4 frontdesk-checkin__undo-alert"
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

      <div class="frontdesk-checkin__panel-wrap">
        <rapid-check-in-panel
          v-if="mode === 'rapid'"
          class="frontdesk-checkin__panel"
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
          class="frontdesk-checkin__panel"
          :rows="bulkRows"
          :selected-ids="selectedIds"
          :loading="bulkLoading"
          @toggle-row="toggleSelectRow"
          @toggle-all="toggleSelectAll"
          @bulk-check-in="handleBulkCheckIn"
        />
      </div>
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
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    linear-gradient(165deg, rgba(var(--v-theme-primary), 0.08) 0%, rgba(var(--v-theme-surface), 0.92) 46%, rgba(var(--v-theme-secondary), 0.07) 100%);
}

.frontdesk-checkin__ambient {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 12% 10%, rgba(var(--v-theme-primary), 0.19), transparent 43%),
    radial-gradient(circle at 86% 14%, rgba(var(--v-theme-secondary), 0.18), transparent 38%),
    radial-gradient(circle at 48% 96%, rgba(var(--v-theme-info), 0.14), transparent 46%);
  z-index: 0;
}

.frontdesk-checkin__topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgba(var(--v-theme-surface), 0.78);
  backdrop-filter: blur(12px);
}

.frontdesk-checkin__back-btn {
  background: rgba(var(--v-theme-primary), 0.08);
}

.frontdesk-checkin__app-logo {
  margin-left: 8px;
  margin-right: 10px;
  filter: brightness(0) invert(1);
  background-color: rgba(var(--v-theme-primary), 0.9);
  border-radius: 8px;
  padding: 3px;
}

.frontdesk-checkin__toolbar-title {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.frontdesk-checkin__toolbar-heading {
  font-family: 'Barlow Condensed', 'Inter', sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.frontdesk-checkin__toolbar-subheading {
  font-size: 0.78rem;
  color: rgba(var(--v-theme-on-surface), 0.64);
}

.frontdesk-checkin__live-chip {
  font-weight: 600;
  letter-spacing: 0.04em;
}

.frontdesk-checkin__mode-toggle {
  border: 1px solid rgba(var(--v-theme-primary), 0.14);
  background: rgba(var(--v-theme-surface), 0.92);
}

.frontdesk-checkin__body {
  position: relative;
  z-index: 1;
  max-width: 1460px;
  margin: 0 auto;
}

.frontdesk-checkin__hero {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.09);
  border-radius: 24px;
  background:
    linear-gradient(145deg, rgba(var(--v-theme-surface), 0.96) 0%, rgba(var(--v-theme-surface), 0.89) 100%);
  box-shadow:
    0 24px 40px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.42);
  animation: frontdeskFadeIn 420ms ease-out both;
}

.frontdesk-checkin__hero-copy {
  max-width: 560px;
}

.frontdesk-checkin__hero-brand {
  display: flex;
  align-items: flex-start;
  gap: 18px;
  min-width: 0;
}

.frontdesk-checkin__hero-mark {
  flex-shrink: 0;
}

.frontdesk-checkin__eyebrow {
  letter-spacing: 0.14em;
  color: rgba(var(--v-theme-primary), 0.9);
}

.frontdesk-checkin__hero-tournament {
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.56);
}

.frontdesk-checkin__hero-date {
  font-size: 11px;
  color: #64748b;
}

.frontdesk-checkin__title {
  font-family: 'Barlow Condensed', 'Inter', sans-serif;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.01em;
}

.frontdesk-checkin__subtitle {
  color: rgba(var(--v-theme-on-surface), 0.72);
}

.frontdesk-checkin__bib-sheet {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background: rgba(var(--v-theme-surface), 0.9);
  border-radius: 16px;
}

.frontdesk-checkin__bib-input {
  width: 136px;
}

.frontdesk-checkin__rate-ring {
  min-width: 88px;
}

.frontdesk-checkin__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.frontdesk-checkin__metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgba(var(--v-theme-surface), 0.92);
  border-radius: 16px;
}

.frontdesk-checkin__metric strong {
  font-family: 'Barlow Condensed', 'Inter', sans-serif;
  line-height: 1;
}

.frontdesk-checkin__metric--approved {
  border-color: rgba(var(--v-theme-primary), 0.22);
}

.frontdesk-checkin__metric--checked {
  border-color: rgba(var(--v-theme-success), 0.3);
}

.frontdesk-checkin__metric--noshow {
  border-color: rgba(var(--v-theme-error), 0.3);
}

.frontdesk-checkin__metric--throughput {
  border-color: rgba(var(--v-theme-info), 0.26);
}

.frontdesk-checkin__hero-footnote {
  color: rgba(var(--v-theme-on-surface), 0.64);
}

.frontdesk-checkin__undo-alert {
  border-radius: 14px;
  border: 1px solid rgba(var(--v-theme-info), 0.2);
}

.frontdesk-checkin__panel-wrap {
  animation: frontdeskFadeIn 580ms ease-out both;
}

.frontdesk-checkin__panel {
  border-radius: 18px;
}

.frontdesk-checkin__overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  text-align: center;
  backdrop-filter: blur(3px);
}

.frontdesk-checkin__overlay--success {
  background: rgba(16, 185, 129, 0.56);
}

.frontdesk-checkin__overlay--error {
  background: rgba(239, 68, 68, 0.56);
}

@keyframes frontdeskFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 960px) {
  .frontdesk-checkin__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 599px) {
  .frontdesk-checkin__toolbar-title {
    gap: 0;
  }

  .frontdesk-checkin__toolbar-subheading {
    display: none;
  }

  .frontdesk-checkin__title {
    font-size: 2rem !important;
  }

  .frontdesk-checkin__hero-brand {
    flex-direction: column;
    gap: 14px;
  }

  .frontdesk-checkin__hero-mark {
    width: 72px;
    height: 72px;
  }

  .frontdesk-checkin__hero-actions {
    width: 100%;
    justify-content: space-between;
  }

  .frontdesk-checkin__metrics {
    grid-template-columns: 1fr;
  }
}
</style>
