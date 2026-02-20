<script setup lang="ts">
import { computed } from 'vue';
import type { CategoryStageStatus } from '@/composables/useCategoryStageStatus';

interface RunningStatusSummary {
  total: number;
  inProgress: number;
  ready: number;
  scheduled: number;
  blocked: number;
  completed: number;
  nextMatch: string;
}

const props = defineProps<{
  summary: RunningStatusSummary;
  categoryStatuses: CategoryStageStatus[];
}>();

const visibleStatuses = computed(() => props.categoryStatuses.slice(0, 6));

function getStageColor(stageLabel: string): string {
  if (stageLabel === 'Completed') return 'success';
  if (stageLabel.includes('Final')) return 'error';
  if (stageLabel.includes('Elimination')) return 'info';
  if (stageLabel.includes('Pool')) return 'warning';
  if (stageLabel === 'Not Started') return 'grey';
  return 'primary';
}
</script>

<template>
  <v-card
    class="running-status-board"
    variant="flat"
    border
  >
    <div class="d-flex flex-wrap align-center gap-2 px-4 pt-3 pb-2 border-b">
      <v-chip
        size="small"
        color="primary"
        variant="flat"
      >
        Total {{ summary.total }}
      </v-chip>
      <v-chip
        size="small"
        color="info"
        variant="tonal"
      >
        In Progress {{ summary.inProgress }}
      </v-chip>
      <v-chip
        size="small"
        color="warning"
        variant="tonal"
      >
        Ready {{ summary.ready }}
      </v-chip>
      <v-chip
        size="small"
        color="secondary"
        variant="tonal"
      >
        Scheduled {{ summary.scheduled }}
      </v-chip>
      <v-chip
        size="small"
        color="error"
        variant="tonal"
      >
        Blocked {{ summary.blocked }}
      </v-chip>
      <v-chip
        size="small"
        color="success"
        variant="tonal"
      >
        Completed {{ summary.completed }}
      </v-chip>
      <v-spacer />
      <span class="text-caption text-medium-emphasis">
        Next: <strong>{{ summary.nextMatch }}</strong>
      </span>
    </div>

    <div class="px-4 py-3">
      <div class="text-caption text-medium-emphasis mb-2">
        Running Status Board
      </div>
      <v-table density="compact">
        <thead>
          <tr>
            <th class="text-left">
              Category
            </th>
            <th class="text-left">
              Stage
            </th>
            <th class="text-left">
              Round
            </th>
            <th class="text-right">
              Remaining
            </th>
            <th class="text-left">
              Next Match
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="status in visibleStatuses"
            :key="status.categoryId"
          >
            <td>{{ status.categoryName }}</td>
            <td>
              <v-chip
                size="x-small"
                :color="getStageColor(status.stageLabel)"
                variant="tonal"
              >
                {{ status.stageLabel }}
              </v-chip>
            </td>
            <td>{{ status.nextRound ? `R${status.nextRound}` : '-' }}</td>
            <td class="text-right">
              {{ status.remaining }}
            </td>
            <td class="text-caption">
              {{ status.nextMatchLabel }}
            </td>
          </tr>
          <tr v-if="visibleStatuses.length === 0">
            <td
              colspan="5"
              class="text-center text-medium-emphasis"
            >
              No category status available
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>
  </v-card>
</template>

<style scoped>
.running-status-board {
  background: rgb(var(--v-theme-surface));
}

.gap-2 {
  gap: 8px;
}
</style>
