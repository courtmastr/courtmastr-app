<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useCheckInHistory } from '@/features/checkin/composables/useCheckInHistory';
import { formatCheckInDateKey } from '@/features/checkin/utils/checkInDateKey';

const { rows, loading, error, selectedDate, canGoForward, goBack, goForward, refresh } =
  useCheckInHistory();

const dateLabel = computed(() => {
  const today = new Date();
  const isToday = formatCheckInDateKey(selectedDate.value) === formatCheckInDateKey(today);
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(selectedDate.value);
  return isToday ? `${label} · Today` : label;
});

const checkedInCount = computed(() => rows.value.filter(r => !r.isPartial).length);

function formatTime(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function chipColor(source: 'admin' | 'kiosk' | 'partial'): string {
  if (source === 'admin') return 'primary';
  if (source === 'kiosk') return 'success';
  return 'warning';
}

async function handlePrevDay() {
  goBack();
  await refresh();
}

async function handleNextDay() {
  goForward();
  await refresh();
}

onMounted(() => {
  refresh();
});
</script>

<template>
  <div class="checkin-history-panel">
    <!-- Date nav bar -->
    <div class="checkin-history-panel__nav pa-3 d-flex align-center justify-space-between">
      <div class="d-flex align-center ga-2">
        <v-btn
          icon="mdi-chevron-left"
          variant="tonal"
          size="small"
          density="comfortable"
          aria-label="Previous day"
          @click="handlePrevDay"
        />
        <div>
          <div class="text-subtitle-2 font-weight-bold">
            {{ dateLabel }}
          </div>
          <div class="text-caption text-medium-emphasis">
            {{ checkedInCount }} checked in
          </div>
        </div>
        <v-btn
          icon="mdi-chevron-right"
          variant="tonal"
          size="small"
          density="comfortable"
          :disabled="!canGoForward"
          aria-label="Next day"
          @click="handleNextDay"
        />
      </div>
      <v-btn
        prepend-icon="mdi-refresh"
        variant="tonal"
        color="primary"
        size="small"
        :loading="loading"
        @click="refresh()"
      >
        Refresh
      </v-btn>
    </div>

    <v-progress-linear
      v-if="loading"
      indeterminate
      color="primary"
    />

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mx-3 mb-2"
    >
      {{ error }}
    </v-alert>

    <!-- Empty state -->
    <div
      v-if="!loading && rows.length === 0"
      class="checkin-history-panel__empty d-flex flex-column align-center justify-center pa-8 text-center"
    >
      <v-icon
        icon="mdi-calendar-blank"
        size="48"
        color="medium-emphasis"
        class="mb-3"
      />
      <div class="text-body-2 text-medium-emphasis">
        No check-ins recorded for this day
      </div>
    </div>

    <!-- Row list -->
    <v-list
      v-else
      density="comfortable"
      class="checkin-history-panel__list pa-2"
    >
      <div
        v-for="row in rows"
        :key="row.registrationId"
        class="checkin-history-panel__row mb-2 rounded-lg pa-3 d-flex align-center justify-space-between"
        :class="
          row.isPartial
            ? 'checkin-history-panel__row--partial'
            : 'checkin-history-panel__row--full'
        "
      >
        <div class="flex-grow-1 mr-3">
          <div class="text-subtitle-2 font-weight-bold">
            {{ row.displayName }}
          </div>
          <div
            class="text-caption"
            :class="row.isPartial ? 'text-warning' : 'text-medium-emphasis'"
          >
            {{ row.categoryName }}
            <template v-if="row.isPartial">
              · <span class="font-weight-medium">waiting for {{ row.partnerName ?? 'partner' }}</span>
            </template>
          </div>
        </div>
        <div class="d-flex align-center ga-2 flex-shrink-0">
          <v-chip
            :color="chipColor(row.source)"
            variant="tonal"
            size="small"
            label
          >
            {{ row.source }}
          </v-chip>
          <div
            class="text-caption font-weight-bold"
            :class="row.isPartial ? 'text-warning' : 'text-medium-emphasis'"
            style="min-width: 56px; text-align: right"
          >
            {{ formatTime(row.checkedInAt) }}
          </div>
        </div>
      </div>
    </v-list>
  </div>
</template>

<style scoped>
.checkin-history-panel {
  background: rgb(var(--v-theme-surface));
}

.checkin-history-panel__nav {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
}

.checkin-history-panel__row {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-left-width: 3px;
  background: rgb(var(--v-theme-surface));
}

.checkin-history-panel__row--full {
  border-left-color: rgb(var(--v-theme-success));
}

.checkin-history-panel__row--partial {
  border-left-color: rgb(var(--v-theme-warning));
  background: rgba(var(--v-theme-warning), 0.05);
}

.checkin-history-panel__empty {
  min-height: 200px;
}
</style>
