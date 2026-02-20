<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Registration } from '@/types';
import CheckInRow from './CheckInRow.vue';

interface Props {
  registrations: Registration[];
  selectedIds: string[];
  getParticipantName: (id: string) => string;
  getCategoryName: (id: string) => string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [registrationId: string, selected: boolean];
  selectAll: [selected: boolean];
  checkIn: [registrationId: string];
  undo: [registrationId: string];
  restore: [registrationId: string];
  markNoShow: [registrationId: string];
  updateBib: [registrationId: string, bibNumber: number | null];
}
>();

const activeIndex = ref(-1);
const listRef = ref<HTMLElement | null>(null);

const allSelected = computed(() =>
  props.registrations.length > 0 &&
  props.registrations.every((r) => props.selectedIds.includes(r.id))
);

const someSelected = computed(() =>
  props.selectedIds.length > 0 && !allSelected.value
);

function isSelected(registrationId: string): boolean {
  return props.selectedIds.includes(registrationId);
}

function toggleSelection(registrationId: string) {
  const selected = !isSelected(registrationId);
  emit('select', registrationId, selected);
}

function toggleSelectAll() {
  emit('selectAll', !allSelected.value);
}

function handleKeydown(event: KeyboardEvent) {
  // Don't handle if user is typing in an input
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return;
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      navigateDown();
      break;
    case 'ArrowUp':
      event.preventDefault();
      navigateUp();
      break;
    case 'Enter':
      event.preventDefault();
      triggerPrimaryAction();
      break;
    case ' ':
      event.preventDefault();
      toggleCurrentSelection();
      break;
    case 'a':
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        toggleSelectAll();
      }
      break;
  }
}

function navigateDown() {
  if (props.registrations.length === 0) return;
  
  if (activeIndex.value < props.registrations.length - 1) {
    activeIndex.value++;
    scrollToActiveItem();
  }
}

function navigateUp() {
  if (props.registrations.length === 0) return;
  
  if (activeIndex.value > 0) {
    activeIndex.value--;
    scrollToActiveItem();
  } else if (activeIndex.value === -1) {
    // Start from bottom if nothing selected
    activeIndex.value = props.registrations.length - 1;
    scrollToActiveItem();
  }
}

function scrollToActiveItem() {
  // Use nextTick equivalent with setTimeout
  setTimeout(() => {
    const items = listRef.value?.querySelectorAll('.checkin-row');
    if (items && items[activeIndex.value]) {
      items[activeIndex.value].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 0);
}

function triggerPrimaryAction() {
  if (activeIndex.value >= 0 && activeIndex.value < props.registrations.length) {
    const registration = props.registrations[activeIndex.value];
    switch (registration.status) {
      case 'approved':
        emit('checkIn', registration.id);
        break;
      case 'checked_in':
        emit('undo', registration.id);
        break;
      case 'no_show':
        emit('restore', registration.id);
        break;
    }
  }
}

function toggleCurrentSelection() {
  if (activeIndex.value >= 0 && activeIndex.value < props.registrations.length) {
    const registration = props.registrations[activeIndex.value];
    toggleSelection(registration.id);
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div
    ref="listRef"
    class="checkin-list"
  >
    <!-- Header Row -->
    <div class="checkin-list__header d-flex align-center pa-3 bg-surface border-b">
      <v-checkbox-btn
        :model-value="allSelected"
        :indeterminate="someSelected"
        density="compact"
        hide-details
        @update:model-value="toggleSelectAll"
      />
      <span class="text-body-2 font-weight-medium ml-2">
        Select all ({{ registrations.length }})
      </span>
      <v-spacer />
      <v-chip
        v-if="selectedIds.length > 0"
        size="small"
        color="primary"
        variant="tonal"
      >
        {{ selectedIds.length }} selected
      </v-chip>
    </div>

    <!-- List Items -->
    <div
      v-if="registrations.length > 0"
      class="checkin-list__items"
    >
      <check-in-row
        v-for="(registration, index) in registrations"
        :key="registration.id"
        :registration="registration"
        :participant-name="getParticipantName(registration.id)"
        :category-name="getCategoryName(registration.categoryId)"
        :is-selected="isSelected(registration.id)"
        :is-active="index === activeIndex"
        :bib-number="registration.bibNumber"
        @select="(selected) => emit('select', registration.id, selected)"
        @check-in="emit('checkIn', registration.id)"
        @undo="emit('undo', registration.id)"
        @restore="emit('restore', registration.id)"
        @mark-no-show="emit('markNoShow', registration.id)"
        @update-bib="(bib) => emit('updateBib', registration.id, bib)"
        @click="activeIndex = index"
      />
    </div>

    <!-- Empty State -->
    <v-alert
      v-else
      type="info"
      variant="tonal"
      class="ma-4"
    >
      <template #prepend>
        <v-icon icon="mdi-account-search" />
      </template>
      No participants match the selected filters.
    </v-alert>

    <!-- Keyboard Shortcuts Help -->
    <div class="checkin-list__shortcuts px-3 py-2 text-caption text-medium-emphasis d-flex align-center gap-4">
      <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
      <span><kbd>Enter</kbd> Action</span>
      <span><kbd>Space</kbd> Select</span>
      <span><kbd>Ctrl+A</kbd> Select All</span>
    </div>
  </div>
</template>

<style scoped>
.checkin-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.checkin-list__header {
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 1;
}

.checkin-list__items {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkin-list__shortcuts {
  flex-shrink: 0;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
}

.checkin-list__shortcuts kbd {
  background: rgba(var(--v-theme-on-surface), 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.75rem;
}
</style>
