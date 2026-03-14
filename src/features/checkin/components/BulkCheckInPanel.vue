<script setup lang="ts">
import type { RegistrationStatus } from '@/types';

export interface BulkCheckInRow {
  id: string;
  name: string;
  category: string;
  bibNumber?: number | null;
  status?: RegistrationStatus;
}

interface Props {
  rows: BulkCheckInRow[];
  selectedIds: string[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  toggleRow: [registrationId: string];
  toggleAll: [];
  bulkCheckIn: [];
}>();

const isSelected = (registrationId: string): boolean => props.selectedIds.includes(registrationId);

const getStatusLabel = (status?: RegistrationStatus): string => {
  if (status === 'checked_in') return 'Checked In';
  if (status === 'no_show') return 'No Show';
  if (status === 'approved') return 'Approved';
  return status ?? 'Unknown';
};

const getStatusColor = (status?: RegistrationStatus): string => {
  if (status === 'checked_in') return 'success';
  if (status === 'no_show') return 'error';
  if (status === 'approved') return 'grey';
  return 'default';
};
</script>

<template>
  <div class="bulk-checkin-panel">
    <v-card
      class="bulk-checkin-panel__toolbar pa-3 mb-3"
      variant="outlined"
    >
      <div class="d-flex align-center ga-2">
        <v-btn
          variant="text"
          @click="emit('toggleAll')"
        >
          Select All ({{ rows.length }})
        </v-btn>
        <v-spacer />
        <v-btn
          data-testid="bulk-checkin-btn"
          color="primary"
          :loading="loading"
          :disabled="selectedIds.length === 0"
          @click="emit('bulkCheckIn')"
        >
          Check In Selected ({{ selectedIds.length }})
        </v-btn>
      </div>
    </v-card>

    <v-card
      class="bulk-checkin-panel__list"
      variant="outlined"
    >
      <v-list
        density="comfortable"
        class="py-0"
      >
        <v-list-item
          v-for="row in rows"
          :key="row.id"
          :data-testid="`bulk-row-${row.id}`"
          :class="[
            'bulk-checkin-panel__row',
            { 'bulk-checkin-panel__row--selected': isSelected(row.id) },
            `bulk-checkin-panel__row--${row.status ?? 'unknown'}`
          ]"
          :title="row.name"
          :subtitle="row.category"
          @click="emit('toggleRow', row.id)"
        >
          <template #prepend>
            <v-checkbox-btn
              :model-value="isSelected(row.id)"
              @update:model-value="emit('toggleRow', row.id)"
            />
          </template>

          <template #append>
            <v-chip
              size="small"
              variant="tonal"
              class="mr-2"
            >
              Bib: {{ row.bibNumber ?? '---' }}
            </v-chip>
            <v-chip
              size="small"
              :color="getStatusColor(row.status)"
              variant="tonal"
            >
              {{ getStatusLabel(row.status) }}
            </v-chip>
          </template>
        </v-list-item>
      </v-list>
    </v-card>
  </div>
</template>

<style scoped>
.bulk-checkin-panel {
  width: 100%;
}

.bulk-checkin-panel__toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  border-radius: 16px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background: rgba(var(--v-theme-surface), 0.93);
  backdrop-filter: blur(6px);
}

.bulk-checkin-panel__list {
  border-radius: 16px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.09);
  background: rgba(var(--v-theme-surface), 0.94);
}

.bulk-checkin-panel__row {
  cursor: pointer;
  transition: background-color 180ms ease, transform 180ms ease;
}

.bulk-checkin-panel__row:hover {
  background: rgba(var(--v-theme-primary), 0.06);
}

.bulk-checkin-panel__row--selected {
  background: rgba(var(--v-theme-primary), 0.12);
}

.bulk-checkin-panel__row--checked_in {
  background: rgba(var(--v-theme-success), 0.08);
  border-left: 4px solid rgb(var(--v-theme-success));
}

.bulk-checkin-panel__row--no_show {
  background: rgba(var(--v-theme-error), 0.06);
  border-left: 4px solid rgb(var(--v-theme-error));
}

@media (max-width: 599px) {
  .bulk-checkin-panel__toolbar,
  .bulk-checkin-panel__list {
    border-radius: 14px;
  }
}
</style>
