<script setup lang="ts">
import type { CategoryStageStatus } from '@/composables/useCategoryStageStatus';

const PROGRESS_COLORS = ['#16a34a', '#ea580c', '#1d4ed8', '#7c3aed', '#0891b2'];

defineProps<{
  statuses: CategoryStageStatus[];
}>();

function progressPercent(status: CategoryStageStatus): number {
  return status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0;
}

function colorForIndex(index: number): string {
  return PROGRESS_COLORS[index % PROGRESS_COLORS.length];
}
</script>

<template>
  <v-card
    class="category-progress-panel"
    variant="outlined"
  >
    <div class="cp-header">
      <span class="cp-title">Category Progress</span>
    </div>
    <div
      v-if="statuses.length === 0"
      class="cp-empty"
    >
      No categories yet
    </div>
    <div
      v-for="(status, index) in statuses"
      :key="status.categoryId"
      class="cp-row"
    >
      <div class="cp-row__top">
        <span class="cp-row__name">{{ status.categoryName }}</span>
        <span class="cp-row__fraction">{{ status.completed }} / {{ status.total }}</span>
      </div>
      <div class="cp-bar">
        <div
          class="cp-bar__fill"
          :style="{
            width: `${progressPercent(status)}%`,
            background: colorForIndex(index),
          }"
        />
      </div>
    </div>
  </v-card>
</template>

<style scoped lang="scss">
.category-progress-panel {
  border-radius: 10px !important;
  overflow: hidden;
}

.cp-header {
  padding: 10px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.cp-title {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.cp-empty {
  padding: 12px 14px;
  font-size: 12px;
  color: #94a3b8;
}

.cp-row {
  padding: 9px 14px;
  border-bottom: 1px solid #f1f5f9;

  &:last-child {
    border-bottom: none;
  }
}

.cp-row__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.cp-row__name {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.cp-row__fraction {
  font-size: 10px;
  color: #94a3b8;
}

.cp-bar {
  height: 4px;
  background: #f1f5f9;
  border-radius: 4px;
  overflow: hidden;
}

.cp-bar__fill {
  height: 100%;
  border-radius: 4px;
  transition: width 400ms ease;
}
</style>
