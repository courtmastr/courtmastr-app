<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CheckInSearchRow, CheckInStatus } from '@/features/checkin/composables/checkInTypes';

export interface UrgentCheckInItem {
  id: string;
  title: string;
  subtitle: string;
  startsInLabel?: string;
  canCheckIn: boolean;
  disabledReason?: string;
}

export interface RecentCheckInItem {
  id: string;
  name: string;
  detail: string;
  canUndo: boolean;
}

interface Props {
  urgentItems: UrgentCheckInItem[];
  recentItems: RecentCheckInItem[];
  searchRows?: CheckInSearchRow[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  searchRows: () => [],
});

const emit = defineEmits<{
  scanSubmit: [raw: string];
  quickCheckIn: [registrationId: string];
  undoItem: [registrationId: string];
}>();

const scanValue = ref('');
const searchSuggestions = computed<CheckInSearchRow[]>(() => {
  const query = scanValue.value.trim().toLowerCase();
  if (query.length < 2) return [];

  return props.searchRows
    .filter((row) => row.name.toLowerCase().includes(query))
    .slice(0, 8);
});

const submitScan = (): void => {
  const raw = scanValue.value.trim();
  if (!raw) return;
  emit('scanSubmit', raw);
  scanValue.value = '';
};

const handleQuickCheckIn = (registrationId: string): void => {
  emit('quickCheckIn', registrationId);
};

const handleUndo = (registrationId: string): void => {
  emit('undoItem', registrationId);
};

const getStatusLabel = (status: CheckInStatus): string => {
  if (status === 'checked_in') return 'Checked In';
  if (status === 'no_show') return 'No Show';
  if (status === 'approved') return 'Approved';
  return status;
};

const getStatusColor = (status: CheckInStatus): string => {
  if (status === 'checked_in') return 'success';
  if (status === 'no_show') return 'error';
  if (status === 'approved') return 'primary';
  return 'default';
};

const handleSuggestionCheckIn = (row: CheckInSearchRow): void => {
  if (row.status !== 'approved') return;
  emit('quickCheckIn', row.id);
  scanValue.value = '';
};
</script>

<template>
  <div class="rapid-checkin-panel d-flex ga-4">
    <v-card
      class="rapid-checkin-panel__scanner pa-4"
      variant="outlined"
    >
      <div class="text-overline mb-2">
        Scanner Input
      </div>
      <v-text-field
        v-model="scanValue"
        data-testid="scan-input"
        placeholder="Scan QR or type Bib #"
        density="comfortable"
        variant="outlined"
        autofocus
        :loading="loading"
        prepend-inner-icon="mdi-qrcode-scan"
        @keydown.enter.prevent="submitScan"
      />
      <v-list
        v-if="searchSuggestions.length > 0"
        data-testid="rapid-search-results"
        density="compact"
        lines="two"
        class="mb-3 border rounded"
      >
        <v-list-item
          v-for="row in searchSuggestions"
          :key="row.id"
          :title="row.name"
          :subtitle="row.category"
        >
          <template #append>
            <v-chip
              :color="getStatusColor(row.status)"
              size="x-small"
              variant="tonal"
              class="mr-2"
            >
              {{ getStatusLabel(row.status) }}
            </v-chip>
            <v-btn
              data-testid="search-suggestion-checkin-btn"
              size="small"
              color="primary"
              variant="text"
              :disabled="row.status !== 'approved'"
              @click="handleSuggestionCheckIn(row)"
            >
              Check In
            </v-btn>
          </template>
        </v-list-item>
      </v-list>
      <v-btn
        data-testid="scan-submit-btn"
        color="primary"
        block
        :disabled="!scanValue.trim()"
        @click="submitScan"
      >
        Check In
      </v-btn>
    </v-card>

    <div class="rapid-checkin-panel__lists d-flex flex-column ga-4">
      <v-card
        class="pa-3"
        variant="outlined"
      >
        <div class="text-subtitle-2 mb-2">
          Now Playing (Next 30 mins)
        </div>
        <v-list
          density="compact"
          class="py-0"
        >
          <v-list-item
            v-for="item in props.urgentItems"
            :key="item.id"
            :title="item.title"
            :subtitle="item.subtitle"
          >
            <template #append>
              <div class="urgent-item-actions d-flex flex-column align-end">
                <div class="d-flex align-center">
                  <v-chip
                    v-if="item.startsInLabel"
                    color="error"
                    size="x-small"
                    label
                    class="mr-2"
                  >
                    {{ item.startsInLabel }}
                  </v-chip>
                  <v-btn
                    size="small"
                    :color="item.canCheckIn ? 'error' : 'default'"
                    :variant="item.canCheckIn ? 'elevated' : 'tonal'"
                    :disabled="!item.canCheckIn"
                    @click="handleQuickCheckIn(item.id)"
                  >
                    Check In
                  </v-btn>
                </div>
                <div
                  v-if="!item.canCheckIn && item.disabledReason"
                  class="text-caption text-medium-emphasis mt-1"
                >
                  {{ item.disabledReason }}
                </div>
              </div>
            </template>
          </v-list-item>
          <v-list-item
            v-if="props.urgentItems.length === 0"
            title="No urgent matches in next 30 minutes"
            subtitle="Use scanner input to check in players."
          />
        </v-list>
      </v-card>

      <v-card
        class="pa-3"
        variant="outlined"
      >
        <div class="text-subtitle-2 mb-2">
          Recent Check-ins
        </div>
        <v-list
          density="compact"
          class="py-0"
        >
          <v-list-item
            v-for="item in props.recentItems"
            :key="item.id"
            :title="item.name"
            :subtitle="item.detail"
          >
            <template #append>
              <v-btn
                v-if="item.canUndo"
                size="small"
                variant="text"
                data-testid="recent-undo-btn"
                @click="handleUndo(item.id)"
              >
                Undo
              </v-btn>
            </template>
          </v-list-item>
          <v-list-item
            v-if="props.recentItems.length === 0"
            title="No recent check-ins yet"
          />
        </v-list>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
.rapid-checkin-panel {
  width: 100%;
}

.rapid-checkin-panel__scanner {
  flex: 0 0 320px;
}

.rapid-checkin-panel__lists {
  min-width: 0;
  flex: 1;
}

.urgent-item-actions {
  min-width: 220px;
}

@media (max-width: 960px) {
  .rapid-checkin-panel {
    flex-direction: column;
  }

  .rapid-checkin-panel__scanner {
    flex-basis: auto;
  }
}
</style>
