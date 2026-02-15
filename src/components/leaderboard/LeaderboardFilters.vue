<script setup lang="ts">
import { ref, watch } from 'vue';
import type { LeaderboardOptions } from '@/types/leaderboard';

interface CategoryOption {
  categoryId: string;
  categoryName: string;
}

const props = defineProps<{
  categories?: CategoryOption[];
  tournamentWide?: boolean;
}>();

const emit = defineEmits<{
  'update:filters': [filters: LeaderboardOptions & { search?: string }];
}>();

const search = ref('');
const statusFilter = ref<'all' | 'active' | 'eliminated'>('all');
const selectedCategories = ref<string[]>([]);
const minimumMatches = ref(0);

const STATUS_OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Eliminated', value: 'eliminated' },
];

let searchTimeout: ReturnType<typeof setTimeout> | null = null;

function emitFilters() {
  const filters: LeaderboardOptions & { search?: string } = {};

  if (search.value.trim()) filters.search = search.value.trim();
  if (statusFilter.value === 'active') filters.includeEliminated = false;
  if (minimumMatches.value > 0) filters.minimumMatches = minimumMatches.value;
  if (selectedCategories.value.length) filters.categoryIds = selectedCategories.value;

  emit('update:filters', filters);
}

function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(emitFilters, 250);
}

watch([statusFilter, selectedCategories, minimumMatches], emitFilters, { deep: true });
</script>

<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-text class="pa-3">
      <v-row align="center" dense>
        <!-- Search -->
        <v-col cols="12" sm="4">
          <v-text-field
            v-model="search"
            density="compact"
            variant="outlined"
            prepend-inner-icon="mdi-magnify"
            label="Search participant"
            clearable
            hide-details
            @input="onSearchInput"
            @click:clear="() => { search = ''; emitFilters(); }"
          />
        </v-col>

        <!-- Status chip group -->
        <v-col cols="12" sm="4" class="d-flex align-center gap-1">
          <span class="text-caption text-medium-emphasis mr-2">Status:</span>
          <v-chip-group v-model="statusFilter" mandatory selected-class="text-primary">
            <v-chip
              v-for="opt in STATUS_OPTIONS"
              :key="opt.value"
              :value="opt.value"
              size="small"
              filter
            >
              {{ opt.label }}
            </v-chip>
          </v-chip-group>
        </v-col>

        <!-- Category filter (tournament-wide only) -->
        <v-col v-if="tournamentWide && categories?.length" cols="12" sm="4">
          <v-select
            v-model="selectedCategories"
            :items="categories"
            item-title="categoryName"
            item-value="categoryId"
            label="Categories"
            density="compact"
            variant="outlined"
            multiple
            chips
            closable-chips
            hide-details
          />
        </v-col>

        <!-- Minimum matches slider (shown only when meaningful) -->
        <v-col v-if="!tournamentWide" cols="12" sm="4" class="d-flex align-center">
          <span class="text-caption text-medium-emphasis mr-2 text-no-wrap">Min matches:</span>
          <v-slider
            v-model="minimumMatches"
            :min="0"
            :max="10"
            :step="1"
            density="compact"
            thumb-label
            hide-details
            class="flex-grow-1"
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>
