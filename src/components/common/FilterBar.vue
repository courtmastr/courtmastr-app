<script setup lang="ts">
import { computed } from 'vue';

interface FilterOption {
  title: string;
  value: string | null;
}

const props = withDefaults(defineProps<{
  search: string;
  category?: string | null;
  status?: string | null;
  court?: string | null;
  sort?: string | null;
  enableCategory?: boolean;
  enableStatus?: boolean;
  enableCourt?: boolean;
  categoryOptions?: FilterOption[];
  statusOptions?: FilterOption[];
  courtOptions?: FilterOption[];
  sortOptions?: FilterOption[];
  searchLabel?: string;
  searchPlaceholder?: string;
  hasActiveFilters?: boolean;
}>(), {
  category: null,
  status: null,
  court: null,
  sort: null,
  enableCategory: true,
  enableStatus: true,
  enableCourt: false,
  categoryOptions: () => [],
  statusOptions: () => [],
  courtOptions: () => [],
  sortOptions: () => [],
  searchLabel: 'Search',
  searchPlaceholder: '',
  hasActiveFilters: false,
});

const emit = defineEmits<{
  (e: 'update:search', value: string): void;
  (e: 'update:category', value: string | null): void;
  (e: 'update:status', value: string | null): void;
  (e: 'update:court', value: string | null): void;
  (e: 'update:sort', value: string | null): void;
  (e: 'clear'): void;
}>();

const showSort = computed(() => props.sortOptions.length > 0);
</script>

<template>
  <v-card
    class="mb-4"
    variant="outlined"
  >
    <v-card-text>
      <v-row
        align="end"
        class="ga-0"
      >
        <v-col
          cols="12"
          md="3"
        >
          <v-text-field
            :model-value="search"
            :label="searchLabel"
            prepend-inner-icon="mdi-magnify"
            :placeholder="searchPlaceholder"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            @update:model-value="(value: string | null | undefined) => emit('update:search', typeof value === 'string' ? value : '')"
          />
        </v-col>

        <v-col
          v-if="enableCategory"
          cols="12"
          sm="6"
          md="2"
        >
          <v-autocomplete
            :model-value="category"
            :items="categoryOptions"
            item-title="title"
            item-value="value"
            label="Category"
            no-filter
            clearable
            density="compact"
            variant="outlined"
            hide-details
            @update:model-value="(value: string | null) => emit('update:category', value)"
          />
        </v-col>

        <v-col
          v-if="enableStatus"
          cols="12"
          sm="6"
          md="2"
        >
          <v-autocomplete
            :model-value="status"
            :items="statusOptions"
            item-title="title"
            item-value="value"
            label="Status"
            no-filter
            clearable
            density="compact"
            variant="outlined"
            hide-details
            @update:model-value="(value: string | null) => emit('update:status', value)"
          />
        </v-col>

        <v-col
          v-if="enableCourt"
          cols="12"
          sm="6"
          md="2"
        >
          <v-autocomplete
            :model-value="court"
            :items="courtOptions"
            item-title="title"
            item-value="value"
            label="Court"
            no-filter
            clearable
            density="compact"
            variant="outlined"
            hide-details
            @update:model-value="(value: string | null) => emit('update:court', value)"
          />
        </v-col>

        <slot name="extra" />

        <v-col
          v-if="showSort"
          cols="12"
          sm="6"
          md="2"
        >
          <v-autocomplete
            :model-value="sort"
            :items="sortOptions"
            item-title="title"
            item-value="value"
            label="Sort"
            no-filter
            clearable
            density="compact"
            variant="outlined"
            hide-details
            @update:model-value="(value: string | null) => emit('update:sort', value)"
          />
        </v-col>

        <v-col
          cols="12"
          sm="6"
          md="1"
          class="d-flex align-center justify-end"
        >
          <v-btn
            variant="text"
            :color="hasActiveFilters ? 'primary' : 'grey'"
            prepend-icon="mdi-filter-off"
            size="small"
            @click="emit('clear')"
          >
            Clear Filters
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>
