<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CheckInSearchRow, CheckInStatus } from '@/features/checkin/composables/checkInTypes';
import { rankItemsByQuery } from '@/features/checkin/composables/checkInSearchUtils';
import { useActiveIndexNavigation } from '@/features/checkin/composables/useActiveIndexNavigation';

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
  undoRemainingMs?: number;
}

interface Props {
  urgentItems: UrgentCheckInItem[];
  recentItems: RecentCheckInItem[];
  searchRows?: CheckInSearchRow[];
  loading?: boolean;
  pendingIds?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  searchRows: () => [],
  pendingIds: () => [],
});

const emit = defineEmits<{
  scanSubmit: [raw: string];
  quickCheckIn: [registrationId: string];
  undoItem: [registrationId: string];
  undoLatestShortcut: [];
}>();

const scanValue = ref('');
const {
  activeIndex: activeSuggestionIndex,
  resetActiveIndex,
  setActiveIndex,
  syncActiveIndex,
  moveActiveIndex,
} = useActiveIndexNavigation();

const searchSuggestions = computed<CheckInSearchRow[]>(() => {
  if (scanValue.value.trim().length < 2) return [];
  return rankItemsByQuery({
    items: props.searchRows,
    query: scanValue.value,
    getSearchText: (row) => row.name,
    limit: 8,
  });
});

watch(searchSuggestions, (rows) => {
  if (rows.length === 0) {
    resetActiveIndex();
    return;
  }

  syncActiveIndex(rows.length);
  if (activeSuggestionIndex.value === -1) {
    setActiveIndex(0, rows.length);
  }
});

const hasMultipleMatches = computed(
  () => scanValue.value.trim().length >= 2 && searchSuggestions.value.length > 1
);

const isPendingRow = (registrationId: string): boolean => props.pendingIds.includes(registrationId);

const canCheckInRow = (row: CheckInSearchRow): boolean =>
  row.status === 'approved' && !props.loading && !isPendingRow(String(row.id));

const clearScanInput = (): void => {
  scanValue.value = '';
  resetActiveIndex();
};

const submitScan = (): void => {
  const raw = scanValue.value.trim();
  if (!raw) return;
  if (props.loading) return;
  emit('scanSubmit', raw);
  clearScanInput();
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

const formatUndoCountdown = (remainingMs?: number): string => {
  if (!remainingMs || remainingMs <= 0) return '';
  return `${Math.ceil(remainingMs / 1000)}s`;
};

const focusSuggestion = (index: number): void => {
  setActiveIndex(index, searchSuggestions.value.length);
};

const emitQuickCheckIn = (row: CheckInSearchRow): void => {
  if (!canCheckInRow(row)) return;
  emit('quickCheckIn', String(row.id));
  clearScanInput();
};

const handleSuggestionCheckIn = (row: CheckInSearchRow, index: number): void => {
  focusSuggestion(index);
  emitQuickCheckIn(row);
};

const handleInputKeydown = (event: KeyboardEvent): void => {
  const key = event.key;
  const hasSuggestions = searchSuggestions.value.length > 0;

  if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'z') {
    event.preventDefault();
    emit('undoLatestShortcut');
    return;
  }

  if (key === 'ArrowDown') {
    if (!hasSuggestions) return;
    event.preventDefault();
    moveActiveIndex(1, searchSuggestions.value.length);
    return;
  }

  if (key === 'ArrowUp') {
    if (!hasSuggestions) return;
    event.preventDefault();
    moveActiveIndex(-1, searchSuggestions.value.length);
    return;
  }

  if (key === 'Escape') {
    if (!scanValue.value.trim()) return;
    event.preventDefault();
    clearScanInput();
    return;
  }

  if (key === 'Enter') {
    event.preventDefault();
    if (hasSuggestions && activeSuggestionIndex.value >= 0) {
      const row = searchSuggestions.value[activeSuggestionIndex.value];
      if (row) {
        emitQuickCheckIn(row);
      }
      return;
    }
    submitScan();
  }
};
</script>

<template>
  <div class="rapid-checkin-panel d-flex ga-4">
    <v-card
      class="rapid-checkin-panel__scanner pa-4"
      variant="outlined"
    >
      <div class="text-overline mb-2">
        Quick Input
      </div>
      <v-text-field
        v-model="scanValue"
        data-testid="scan-input"
        placeholder="Type player name, reg ID, or bib #"
        density="comfortable"
        variant="outlined"
        autofocus
        :loading="loading"
        prepend-inner-icon="mdi-qrcode-scan"
        @keydown="handleInputKeydown"
      />
      <div
        v-if="hasMultipleMatches"
        data-testid="rapid-search-collision-hint"
        class="text-caption text-medium-emphasis mb-2"
      >
        Multiple matches found. Use ↑/↓ then Enter to check in the correct participant.
      </div>
      <v-list
        v-if="searchSuggestions.length > 0"
        data-testid="rapid-search-results"
        density="compact"
        class="mb-3 border rounded suggestion-list"
      >
        <v-list-item
          v-for="(row, index) in searchSuggestions"
          :key="row.id"
          :active="index === activeSuggestionIndex"
          :class="{ 'rapid-checkin-panel__suggestion--active': index === activeSuggestionIndex }"
          class="suggestion-item"
          @mouseenter="focusSuggestion(index)"
          @click="focusSuggestion(index)"
        >
          <template #default>
            <div class="suggestion-content">
              <div class="suggestion-name">
                {{ row.name }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ row.category }} • Bib: {{ row.bibNumber ?? '---' }}
              </div>
            </div>
            <div class="suggestion-actions">
              <v-chip
                :color="getStatusColor(row.status)"
                size="x-small"
                variant="tonal"
                class="mb-1"
              >
                {{ getStatusLabel(row.status) }}
              </v-chip>
              <v-btn
                data-testid="search-suggestion-checkin-btn"
                size="small"
                color="primary"
                variant="text"
                :loading="isPendingRow(String(row.id))"
                :disabled="!canCheckInRow(row)"
                @click="handleSuggestionCheckIn(row, index)"
              >
                Check In
              </v-btn>
            </div>
          </template>
        </v-list-item>
      </v-list>
      <div class="text-caption text-medium-emphasis mb-3">
        Tip: Press <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Z</kbd> to undo latest check-in.
      </div>
      <v-btn
        data-testid="scan-submit-btn"
        color="primary"
        block
        :disabled="!scanValue.trim() || loading"
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
                Undo ({{ formatUndoCountdown(item.undoRemainingMs) }})
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
  flex: 0 0 440px;
}

.rapid-checkin-panel__lists {
  min-width: 0;
  flex: 1;
}

.rapid-checkin-panel__suggestion--active {
  background: rgba(var(--v-theme-primary), 0.08);
}

.suggestion-item {
  padding-top: 8px;
  padding-bottom: 8px;
}

.suggestion-item :deep(.v-list-item__content) {
  overflow: visible;
}

/* Full-width row: name on left, actions on right */
.suggestion-item :deep(.v-list-item__content) > template,
.suggestion-item > .v-list-item__content {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.suggestion-content {
  flex: 1;
  min-width: 0;
}

.suggestion-name {
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.35;
  white-space: normal;
  word-break: break-word;
  color: rgba(var(--v-theme-on-surface), 1);
}

.suggestion-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.urgent-item-actions {
  min-width: 220px;
}

kbd {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.18);
  border-radius: 4px;
  padding: 0 0.3rem;
  font-family: inherit;
  font-size: 0.72rem;
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
