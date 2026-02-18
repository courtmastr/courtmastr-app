<script setup lang="ts">
import { ref, computed } from 'vue';
import ExpandableRow from './ExpandableRow.vue';

export interface Column {
  key: string;
  title: string;
  width?: string;
  align?: 'start' | 'center' | 'end';
  sortable?: boolean;
  essential?: boolean; // Always visible
}

interface Props<T = Record<string, unknown>> {
  items: T[];
  columns: Column[];
  itemsPerPage?: number;
  showExpand?: boolean;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  itemsPerPage: 25,
  showExpand: true,
  compact: true,
});

const emit = defineEmits<{
  sort: [key: string, direction: 'asc' | 'desc'];
  rowClick: [item: Record<string, unknown>];
  rowAction: [action: string, item: Record<string, unknown>];
}>();

const expandedItems = ref<Set<string | number>>(new Set());
const currentPage = ref(1);
const sortKey = ref<string | null>(null);
const sortDirection = ref<'asc' | 'desc'>('asc');

function isExpanded<T extends Record<string, unknown>>(item: T): boolean {
  return expandedItems.value.has(item.id as string | number);
}

function toggleExpand<T extends Record<string, unknown>>(item: T) {
  const id = item.id as string | number;
  if (expandedItems.value.has(id)) {
    expandedItems.value.delete(id);
  } else {
    expandedItems.value.add(id);
  }
}

const essentialColumns = computed(() => 
  props.columns.filter(col => col.essential !== false)
);

const totalPages = computed(() => 
  Math.ceil(props.items.length / props.itemsPerPage)
);

const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * props.itemsPerPage;
  const end = start + props.itemsPerPage;
  return props.items.slice(start, end);
});

function handleSort(column: Column) {
  if (!column.sortable) return;
  
  if (sortKey.value === column.key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = column.key;
    sortDirection.value = 'asc';
  }
  
  emit('sort', sortKey.value, sortDirection.value);
}

function getSortIcon(column: Column): string {
  if (sortKey.value !== column.key) return 'mdi-sort';
  return sortDirection.value === 'asc' ? 'mdi-sort-ascending' : 'mdi-sort-descending';
}
</script>

<template>
  <div
    class="compact-data-table"
    :class="{ 'compact-data-table--compact': compact }"
  >
    <!-- Header Row -->
    <div class="compact-data-table__header d-flex align-center px-3 py-2 bg-surface border-b text-caption font-weight-medium text-grey">
      <div
        v-for="column in essentialColumns"
        :key="column.key"
        class="compact-data-table__cell"
        :class="[`compact-data-table__cell--${column.align || 'start'}`]"
        :style="{ width: column.width || 'auto', flex: column.width ? 'none' : '1' }"
      >
        <div
          class="d-flex align-center gap-1"
          :class="{ 'cursor-pointer': column.sortable }"
          @click="handleSort(column)"
        >
          {{ column.title }}
          <v-icon
            v-if="column.sortable"
            size="14"
            :icon="getSortIcon(column)"
            class="text-grey"
          />
        </div>
      </div>
      
      <!-- Actions Column -->
      <div
        class="compact-data-table__cell compact-data-table__cell--end"
        style="width: 100px; flex: none;"
      >
        Actions
      </div>
      
      <!-- Expand Column (if enabled) -->
      <div
        v-if="showExpand"
        class="compact-data-table__cell"
        style="width: 40px; flex: none;"
      />
    </div>

    <!-- Data Rows -->
    <div class="compact-data-table__body">
      <expandable-row
        v-for="item in paginatedItems"
        :key="item.id as string | number"
        :item="item"
        :is-expanded="isExpanded(item)"
        @toggle="toggleExpand(item)"
        @action="(action, item) => emit('rowAction', action, item)"
      >
        <template #main="{ item: rowItem, isOpen }">
          <div class="d-flex align-center flex-grow-1">
            <div
              v-for="column in essentialColumns"
              :key="column.key"
              class="compact-data-table__cell"
              :class="[`compact-data-table__cell--${column.align || 'start'}`]"
              :style="{ width: column.width || 'auto', flex: column.width ? 'none' : '1' }"
            >
              <slot
                :name="`cell-${column.key}`"
                :item="rowItem"
                :value="rowItem[column.key]"
              >
                {{ rowItem[column.key] }}
              </slot>
            </div>
            
            <!-- Actions Cell -->
            <div
              class="compact-data-table__cell compact-data-table__cell--end"
              style="width: 100px; flex: none;"
            >
              <slot
                name="actions"
                :item="rowItem"
              />
            </div>
          </div>
        </template>

        <template #details="{ item: rowItem, handleAction }">
          <div class="d-flex flex-wrap gap-4">
            <slot
              name="details"
              :item="rowItem"
              :handle-action="handleAction"
            />
          </div>
        </template>
      </expandable-row>
    </div>

    <!-- Empty State -->
    <v-alert
      v-if="items.length === 0"
      type="info"
      variant="tonal"
      class="ma-4"
    >
      No items to display
    </v-alert>

    <!-- Pagination -->
    <div
      v-if="totalPages > 1"
      class="compact-data-table__pagination d-flex align-center justify-center pa-3"
    >
      <v-pagination
        v-model="currentPage"
        :length="totalPages"
        :total-visible="5"
        density="compact"
        rounded
      />
    </div>
  </div>
</template>

<style scoped>
.compact-data-table {
  width: 100%;
  overflow-x: hidden;
}

.compact-data-table--compact .compact-data-table__cell {
  padding: 4px 8px;
  font-size: 0.875rem;
}

.compact-data-table__header {
  position: sticky;
  top: 0;
  z-index: 1;
}

.compact-data-table__cell {
  padding: 8px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compact-data-table__cell--start {
  text-align: left;
  justify-content: flex-start;
}

.compact-data-table__cell--center {
  text-align: center;
  justify-content: center;
}

.compact-data-table__cell--end {
  text-align: right;
  justify-content: flex-end;
}

.compact-data-table__pagination {
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.cursor-pointer {
  cursor: pointer;
}
</style>
