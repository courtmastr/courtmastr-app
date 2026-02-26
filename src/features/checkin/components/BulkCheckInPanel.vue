<script setup lang="ts">
export interface BulkCheckInRow {
  id: string;
  name: string;
  category: string;
  bibNumber?: number | null;
  status?: string;
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

    <v-card variant="outlined">
      <v-list
        density="comfortable"
        class="py-0"
      >
        <v-list-item
          v-for="row in rows"
          :key="row.id"
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
            >
              Bib: {{ row.bibNumber ?? '---' }}
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
  z-index: 1;
}
</style>
