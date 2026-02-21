<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTournamentStore } from '@/stores/tournaments';
import { useNotificationStore } from '@/stores/notifications';
import { useDialogManager } from '@/composables/useDialogManager';
import BaseDialog from '@/components/common/BaseDialog.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import type { Category, CategoryType, CategoryGender, AgeGroup, TournamentFormat, PoolSeedingMethod } from '@/types';
import { AGE_GROUP_LABELS, FORMAT_LABELS, CATEGORY_TYPE_LABELS } from '@/types';

const props = defineProps<{
  tournamentId: string;
}>();

const tournamentStore = useTournamentStore();
const notificationStore = useNotificationStore();

const categories = computed(() => tournamentStore.categories);

// Dialog state management
const { dialogs, open, close } = useDialogManager(['category', 'deleteCategory']);
const editingCategory = ref<Category | null>(null);
const loading = ref(false);
const categoryToDelete = ref<Category | null>(null);

// Form state
const form = ref({
  name: '',
  type: 'doubles' as CategoryType,
  gender: 'men' as CategoryGender,
  ageGroup: 'open' as AgeGroup,
  format: 'double_elimination' as TournamentFormat,
  maxParticipants: 32,
  minGamesGuaranteed: 3,
  seedingEnabled: true,
  teamsPerPool: 4,
  poolSeedingMethod: 'serpentine' as PoolSeedingMethod,
});

const categoryTypes: { value: CategoryType; title: string }[] = [
  { value: 'singles', title: 'Singles' },
  { value: 'doubles', title: 'Doubles' },
  { value: 'mixed_doubles', title: 'Mixed Doubles' },
];

const genderOptions: { value: CategoryGender; title: string }[] = [
  { value: 'men', title: 'Men' },
  { value: 'women', title: 'Women' },
  { value: 'mixed', title: 'Mixed' },
  { value: 'open', title: 'Open' },
];

const ageGroupOptions = Object.entries(AGE_GROUP_LABELS).map(([value, title]) => ({
  value: value as AgeGroup,
  title,
}));

const formatOptions = Object.entries(FORMAT_LABELS).map(([value, title]) => ({
  value: value as TournamentFormat,
  title,
}));

const isRoundRobin = computed(() => form.value.format === 'round_robin');
const isPoolToElimination = computed(() => form.value.format === 'pool_to_elimination');

// "Max Participants" means teams for doubles/mixed, players for singles
const maxEntriesLabel = computed(() =>
  form.value.type === 'singles' ? 'Max Players' : 'Max Teams'
);
const maxEntriesHint = computed(() =>
  form.value.type === 'singles'
    ? 'Maximum number of individual players that can register'
    : 'Each pair/team counts as 1 entry (e.g. 70 doubles teams = 70 entries)'
);

// Estimated pool count shown as a live hint under "Teams per Pool"
const estimatedPools = computed(() => {
  const teams = form.value.maxParticipants || 0;
  const perPool = form.value.teamsPerPool || 4;
  if (teams < 2 || perPool < 2) return null;
  return Math.max(1, Math.floor(teams / perPool));
});
const teamsPerPoolHint = computed(() => {
  if (estimatedPools.value === null) return 'Target entries per pool';
  return `With ${form.value.maxParticipants} max entries → ~${estimatedPools.value} pools`;
});

const poolSeedingOptions: { value: PoolSeedingMethod; title: string; subtitle: string }[] = [
  {
    value: 'serpentine',
    title: 'Balanced (Serpentine)',
    subtitle: 'Rank-sorted players snake across pools — Pool 1 gets seed #1, Pool 2 gets seed #2 … then reverses. Every pool ends up with one player from each skill tier.',
  },
  {
    value: 'random_in_tiers',
    title: 'Random within Tiers',
    subtitle: 'Players split into skill tiers (same size as pool count); within each tier the draw is random. Tier balance is maintained but there\'s a draw element — two top seeds could land in the same pool.',
  },
  {
    value: 'fully_random',
    title: 'Fully Random',
    subtitle: 'Complete blind draw. Seeds and rankings are ignored entirely. Any player can be placed in any pool.',
  },
];

const selectedSeedingOption = computed(() =>
  poolSeedingOptions.find(o => o.value === form.value.poolSeedingMethod)
);

function openAddDialog() {
  editingCategory.value = null;
  form.value = {
    name: '',
    type: 'doubles',
    gender: 'men',
    ageGroup: 'open',
    format: 'double_elimination',
    maxParticipants: 32,
    minGamesGuaranteed: 3,
    seedingEnabled: true,
    teamsPerPool: 4,
    poolSeedingMethod: 'serpentine',
  };
  open('category');
}

function openEditDialog(category: Category) {
  editingCategory.value = category;
  form.value = {
    name: category.name,
    type: category.type,
    gender: category.gender,
    ageGroup: category.ageGroup || 'open',
    format: category.format,
    maxParticipants: category.maxParticipants || 32,
    minGamesGuaranteed: category.minGamesGuaranteed || 3,
    seedingEnabled: category.seedingEnabled,
    teamsPerPool: category.teamsPerPool || 4,
    poolSeedingMethod: category.poolSeedingMethod || 'serpentine',
  };
  open('category');
}

async function saveCategory() {
  if (!form.value.name.trim()) {
    notificationStore.showToast('error', 'Category name is required');
    return;
  }

  loading.value = true;
  try {
    const categoryData = {
      name: form.value.name,
      type: form.value.type,
      gender: form.value.gender,
      ageGroup: form.value.ageGroup,
      format: form.value.format,
      maxParticipants: form.value.maxParticipants,
      seedingEnabled: form.value.seedingEnabled,
      status: 'setup' as const,
      ...(form.value.format === 'round_robin' && {
        minGamesGuaranteed: form.value.minGamesGuaranteed,
      }),
      ...(form.value.format === 'pool_to_elimination' && {
        teamsPerPool: form.value.teamsPerPool,
        poolSeedingMethod: form.value.poolSeedingMethod,
      }),
    };

    if (editingCategory.value) {
      await tournamentStore.updateCategory(props.tournamentId, editingCategory.value.id, categoryData as any);
      notificationStore.showToast('success', 'Category updated');
    } else {
      await tournamentStore.addCategory(props.tournamentId, categoryData as any);
      notificationStore.showToast('success', 'Category added');
    }
    close('category');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to save category');
  } finally {
    loading.value = false;
  }
}

function requestDeleteCategory(category: Category) {
  categoryToDelete.value = category;
  open('deleteCategory');
}

async function confirmDeleteCategory() {
  if (!categoryToDelete.value) return;
  close('deleteCategory');
  try {
    await tournamentStore.deleteCategory(props.tournamentId, categoryToDelete.value.id);
    notificationStore.showToast('success', 'Category deleted');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to delete category');
  }
}

function generateCategoryName() {
  const genderLabel = genderOptions.find(g => g.value === form.value.gender)?.title || '';
  const typeLabel = categoryTypes.find(t => t.value === form.value.type)?.title || '';
  const ageLabel = form.value.ageGroup !== 'open' ? AGE_GROUP_LABELS[form.value.ageGroup] : '';

  if (ageLabel) {
    form.value.name = `${genderLabel} ${typeLabel} ${ageLabel}`.replace('Mixed Mixed', 'Mixed');
  } else {
    form.value.name = `${genderLabel} ${typeLabel}`.replace('Mixed Mixed', 'Mixed');
  }
}

function getFormatColor(format: TournamentFormat): string {
  const colors: Record<TournamentFormat, string> = {
    'single_elimination': 'warning',
    'double_elimination': 'info',
    'round_robin': 'success',
    'pool_to_elimination': 'purple',
  };
  return colors[format] || 'grey';
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <h3 class="text-h6">
        Categories ({{ categories.length }})
      </h3>
      <v-btn
        color="primary"
        prepend-icon="mdi-plus"
        data-testid="add-category-btn"
        @click="openAddDialog"
      >
        Add Category
      </v-btn>
    </div>

    <!-- Category List -->
    <v-card v-if="categories.length > 0">
      <v-list>
        <v-list-item
          v-for="category in categories"
          :key="category.id"
          class="py-3"
        >
          <template #prepend>
            <v-avatar
              :color="getFormatColor(category.format)"
              class="mr-3"
            >
              <v-icon color="white">
                {{ category.type === 'singles' ? 'mdi-account' : 'mdi-account-multiple' }}
              </v-icon>
            </v-avatar>
          </template>

          <v-list-item-title class="font-weight-medium">
            {{ category.name }}
          </v-list-item-title>
          <v-list-item-subtitle>
            <v-chip
              size="x-small"
              class="mr-1"
              variant="outlined"
            >
              {{ FORMAT_LABELS[category.format] }}
            </v-chip>
            <v-chip
              size="x-small"
              class="mr-1"
              variant="outlined"
            >
              {{ CATEGORY_TYPE_LABELS[category.type] }}
            </v-chip>
            <v-chip
              v-if="category.ageGroup && category.ageGroup !== 'open'"
              size="x-small"
              variant="outlined"
            >
              {{ AGE_GROUP_LABELS[category.ageGroup] }}
            </v-chip>
            <span
              v-if="category.minGamesGuaranteed"
              class="text-caption ml-2"
            >
              (Min {{ category.minGamesGuaranteed }} games)
            </span>
          </v-list-item-subtitle>

          <template #append>
            <v-chip
              :color="category.status === 'active' ? 'success' : category.status === 'completed' ? 'secondary' : 'grey'"
              size="small"
              class="mr-2"
            >
              {{ category.status }}
            </v-chip>
            <v-btn
              icon="mdi-pencil"
              variant="text"
              size="small"
              data-testid="edit-category-btn"
              @click="openEditDialog(category)"
            />
            <v-btn
              icon="mdi-delete"
              variant="text"
              size="small"
              color="error"
              data-testid="delete-category-btn"
              :disabled="category.status !== 'setup'"
              @click="requestDeleteCategory(category)"
            />
          </template>
        </v-list-item>
      </v-list>
    </v-card>

    <!-- Empty State -->
    <EmptyState
      v-else
      icon="mdi-folder-open-outline"
      title="No categories yet"
      message="Add your first category to get started"
      :action="{ label: 'Add Category', handler: openAddDialog }"
    />

    <!-- Add/Edit Dialog -->
    <v-dialog
      v-model="dialogs.category"
      max-width="640"
      persistent
    >
      <v-card>
        <v-card-title class="pt-5 pb-1 px-6">
          {{ editingCategory ? 'Edit Category' : 'Add Category' }}
        </v-card-title>
        <v-card-text class="px-6 pt-3 pb-2">
          <!-- Category identity -->
          <v-row dense>
            <v-col cols="6">
              <v-select
                v-model="form.type"
                :items="categoryTypes"
                item-title="title"
                item-value="value"
                label="Type"
                density="comfortable"
                data-testid="category-type-select"
                @update:model-value="generateCategoryName"
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="form.gender"
                :items="genderOptions"
                item-title="title"
                item-value="value"
                label="Gender"
                density="comfortable"
                data-testid="category-gender-select"
                @update:model-value="generateCategoryName"
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="form.ageGroup"
                :items="ageGroupOptions"
                item-title="title"
                item-value="value"
                label="Age Group"
                density="comfortable"
                @update:model-value="generateCategoryName"
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="form.format"
                :items="formatOptions"
                item-title="title"
                item-value="value"
                label="Format"
                density="comfortable"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="form.name"
                label="Category Name"
                density="comfortable"
                hint="Auto-generated — tap to customise"
                data-testid="category-name-input"
              />
            </v-col>

            <!-- Capacity row: Max Teams/Players + format-specific sibling -->
            <v-col cols="6">
              <v-text-field
                v-model.number="form.maxParticipants"
                :label="maxEntriesLabel"
                :hint="maxEntriesHint"
                density="comfortable"
                type="number"
                min="2"
                max="128"
              />
            </v-col>
            <v-col
              v-if="isRoundRobin"
              cols="6"
            >
              <v-text-field
                v-model.number="form.minGamesGuaranteed"
                label="Min Games Guaranteed"
                density="comfortable"
                hint="Minimum matches per participant"
                type="number"
                min="1"
                max="10"
              />
            </v-col>
            <v-col
              v-if="isPoolToElimination"
              cols="6"
            >
              <v-text-field
                v-model.number="form.teamsPerPool"
                label="Teams per Pool"
                density="comfortable"
                :hint="teamsPerPoolHint"
                persistent-hint
                type="number"
                min="2"
                max="16"
              />
            </v-col>
          </v-row>

          <!-- Pool draw method — visually distinct section -->
          <v-sheet
            v-if="isPoolToElimination"
            rounded="lg"
            color="surface-variant"
            class="pa-4 mt-4"
          >
            <p class="text-caption font-weight-semibold text-uppercase text-medium-emphasis mb-3">
              Pool Draw Method
            </p>
            <v-select
              v-model="form.poolSeedingMethod"
              :items="poolSeedingOptions"
              item-title="title"
              item-value="value"
              label="Draw Method"
              density="comfortable"
              variant="outlined"
              bg-color="surface"
              hide-details
            >
              <template #item="{ item, props: itemProps }">
                <v-list-item
                  v-bind="itemProps"
                  :subtitle="item.raw.subtitle"
                />
              </template>
            </v-select>
            <p
              v-if="selectedSeedingOption"
              class="text-body-2 text-medium-emphasis mt-3 mb-0"
            >
              {{ selectedSeedingOption.subtitle }}
            </p>
          </v-sheet>

          <!-- Seeding toggle -->
          <v-switch
            v-model="form.seedingEnabled"
            label="Enable Seeding"
            density="comfortable"
            color="primary"
            hide-details
            class="mt-3"
          />
        </v-card-text>
        <v-card-actions class="px-6 pb-4">
          <v-spacer />
          <v-btn
            variant="text"
            @click="close('category')"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            data-testid="save-category-btn"
            :loading="loading"
            @click="saveCategory"
          >
            {{ editingCategory ? 'Update' : 'Add' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Category Confirmation Dialog -->
    <BaseDialog
      v-model="dialogs.deleteCategory"
      title="Delete Category?"
      max-width="400"
      :persistent="true"
      @confirm="confirmDeleteCategory"
      @cancel="close('deleteCategory')"
    >
      <p>Delete "{{ categoryToDelete?.name }}"? This cannot be undone.</p>
      <template #actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="close('deleteCategory')"
        >
          Cancel
        </v-btn>
        <v-btn
          color="error"
          @click="confirmDeleteCategory"
        >
          Delete
        </v-btn>
      </template>
    </BaseDialog>
  </div>
</template>
