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

const poolSeedingOptions: { value: PoolSeedingMethod; title: string; subtitle: string }[] = [
  { value: 'serpentine', title: 'Balanced (Serpentine)', subtitle: 'Top seeds spread evenly across all pools' },
  { value: 'random_in_tiers', title: 'Random within Tiers', subtitle: 'Balanced tiers, randomised within each tier' },
  { value: 'fully_random', title: 'Fully Random', subtitle: 'Complete random draw, ignores seeding' },
];

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
      max-width="600"
      persistent
    >
      <v-card>
        <v-card-title>
          {{ editingCategory ? 'Edit Category' : 'Add Category' }}
        </v-card-title>
        <v-card-text>
          <v-row>
            <v-col
              cols="12"
              md="6"
            >
              <v-select
                v-model="form.type"
                :items="categoryTypes"
                item-title="title"
                item-value="value"
                label="Type"
                data-testid="category-type-select"
                @update:model-value="generateCategoryName"
              />
            </v-col>
            <v-col
              cols="12"
              md="6"
            >
              <v-select
                v-model="form.gender"
                :items="genderOptions"
                item-title="title"
                item-value="value"
                label="Gender"
                data-testid="category-gender-select"
                @update:model-value="generateCategoryName"
              />
            </v-col>
            <v-col
              cols="12"
              md="6"
            >
              <v-select
                v-model="form.ageGroup"
                :items="ageGroupOptions"
                item-title="title"
                item-value="value"
                label="Age Group"
                @update:model-value="generateCategoryName"
              />
            </v-col>
            <v-col
              cols="12"
              md="6"
            >
              <v-select
                v-model="form.format"
                :items="formatOptions"
                item-title="title"
                item-value="value"
                label="Format"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="form.name"
                label="Category Name"
                data-testid="category-name-input"
                hint="Auto-generated, but you can customize"
                persistent-hint
              />
            </v-col>
            <v-col
              cols="12"
              md="6"
            >
              <v-text-field
                v-model.number="form.maxParticipants"
                label="Max Participants"
                type="number"
                min="2"
                max="128"
              />
            </v-col>
            <v-col
              v-if="isRoundRobin"
              cols="12"
              md="6"
            >
              <v-text-field
                v-model.number="form.minGamesGuaranteed"
                label="Minimum Games Guaranteed"
                type="number"
                min="1"
                max="10"
                hint="Each participant plays at least this many games"
                persistent-hint
              />
            </v-col>

            <!-- Pool-to-Elimination configuration -->
            <template v-if="isPoolToElimination">
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model.number="form.teamsPerPool"
                  label="Teams per Pool"
                  type="number"
                  min="2"
                  max="16"
                  hint="Target number of players in each pool"
                  persistent-hint
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-select
                  v-model="form.poolSeedingMethod"
                  :items="poolSeedingOptions"
                  item-title="title"
                  item-value="value"
                  label="Pool Draw Method"
                  hint="How players are assigned to pools"
                  persistent-hint
                />
              </v-col>
            </template>

            <v-col cols="12">
              <v-switch
                v-model="form.seedingEnabled"
                label="Enable Seeding"
                hint="Allow manual seeding of participants"
                persistent-hint
                color="primary"
              />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="close('category')"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
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
