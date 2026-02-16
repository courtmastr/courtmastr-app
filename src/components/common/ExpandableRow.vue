<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
  item: Record<string, unknown>;
  isExpanded?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  toggle: [];
  action: [action: string, item: Record<string, unknown>];
}>();

const isOpen = computed(() => props.isExpanded ?? false);

function toggle() {
  emit('toggle');
}

function handleAction(action: string) {
  emit('action', action, props.item);
}
</script>

<template>
  <div class="expandable-row">
    <!-- Main Row (always visible) -->
    <div 
      class="expandable-row__main d-flex align-center pa-3"
      :class="{ 'expandable-row__main--expanded': isOpen }"
      @click="toggle"
    >
      <slot name="main" :item="item" :toggle="toggle" :is-open="isOpen" />
      
      <!-- Expand/Collapse Icon -->
      <v-btn
        icon
        variant="text"
        size="small"
        density="compact"
        class="ml-2"
        :class="{ 'expandable-row__chevron--rotated': isOpen }"
        @click.stop="toggle"
      >
        <v-icon>mdi-chevron-down</v-icon>
      </v-btn>
    </div>

    <!-- Expanded Details (collapsible) -->
    <v-expand-transition>
      <div v-show="isOpen" class="expandable-row__details bg-grey-lighten-4">
        <div class="pa-3">
          <slot name="details" :item="item" :handle-action="handleAction" />
        </div>
      </div>
    </v-expand-transition>
  </div>
</template>

<style scoped>
.expandable-row {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.expandable-row:last-child {
  border-bottom: none;
}

.expandable-row__main {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.expandable-row__main:hover {
  background-color: rgba(var(--v-theme-primary), 0.03);
}

.expandable-row__main--expanded {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.expandable-row__chevron--rotated :deep(.v-icon) {
  transform: rotate(180deg);
}

.expandable-row__details {
  border-top: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
