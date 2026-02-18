<template>
  <v-container fluid>
    <!-- Category Setup: Add / Edit / Delete -->
    <CategoryManagement :tournament-id="tournamentId" />

    <!-- Registration Stats, Bracket Readiness & Actions -->
    <CategoryRegistrationStats
      :tournament-id="tournamentId"
      class="mt-6"
      @generate-bracket="generateBracket"
      @create-levels="openCreateLevelsDialog"
      @regenerate-bracket="confirmRegenerateBracket"
      @manage-registrations="(categoryId) => router.push(`/tournaments/${tournamentId}/registrations?category=${categoryId}`)"
      @manage-seeds="openSeedingDialog"
    />

    <!-- Create Levels Dialog -->
    <CreateLevelsDialog
      v-if="createLevelsCategoryId"
      v-model="showCreateLevelsDialog"
      :tournament-id="tournamentId"
      :category-id="createLevelsCategoryId"
      :category-name="createLevelsCategoryName"
      @generated="handleLevelsGenerated"
    />

    <!-- Regenerate Bracket Confirmation Dialog -->
    <BaseDialog
      v-model="showRegenerateBracketDialog"
      title="Regenerate Bracket?"
      max-width="500"
      @confirm="regenerateBracket"
      @cancel="showRegenerateBracketDialog = false"
    >
      <div class="d-flex align-center">
        <v-icon
          color="warning"
          class="mr-2"
        >
          mdi-alert
        </v-icon>
        <span>Regenerate Bracket?</span>
      </div>
      <p class="mb-3">
        This will regenerate the bracket for this category with proper progression links.
      </p>
      <v-alert
        type="warning"
        variant="tonal"
        class="mb-3"
      >
        <strong>Warning:</strong> This will reset all matches and clear any existing scores.
        Only do this if bracket progression is broken.
      </v-alert>
      <p class="text-body-2 text-grey">
        Seeding and participant assignments will be preserved.
      </p>
      <template #actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="showRegenerateBracketDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="warning"
          variant="flat"
          :loading="regenerateInProgress"
          @click="regenerateBracket"
        >
          Regenerate Bracket
        </v-btn>
      </template>
    </BaseDialog>

    <!-- Seeding Dialog -->
    <v-dialog
      v-model="showSeedingDialog"
      max-width="600"
    >
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon class="mr-2">
            mdi-seed
          </v-icon>
          Manage Seeds
          <v-spacer />
          <v-chip
            size="small"
            color="primary"
            variant="tonal"
          >
            {{ seedingRegistrations.length }} players
          </v-chip>
        </v-card-title>

        <v-card-text>
          <v-alert
            type="info"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            <strong>Seeding tips:</strong>
            <ul class="text-body-2 mt-1 mb-0">
              <li>Seed your top 4 players to ensure they don't meet early</li>
              <li>Seeded players get favorable bracket positions (byes if available)</li>
              <li>Leave seed empty for unseeded players</li>
            </ul>
          </v-alert>

          <div class="d-flex gap-2 mb-4">
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-auto-fix"
              data-testid="auto-assign-seeds-btn"
              :loading="savingSeed"
              @click="autoAssignSeeds"
            >
              Auto-assign Top 4
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              color="error"
              prepend-icon="mdi-eraser"
              @click="clearAllSeeds"
            >
              Clear All
            </v-btn>
          </div>

          <v-list density="compact">
            <v-list-item
              v-for="(reg, index) in seedingRegistrations"
              :key="reg.id"
              :class="{ 'bg-primary-lighten-5': reg.seed !== null }"
            >
              <template #prepend>
                <v-avatar
                  :color="reg.seed !== null ? 'primary' : 'grey-lighten-2'"
                  size="32"
                  class="mr-3"
                >
                  <span
                    v-if="reg.seed !== null"
                    class="text-white font-weight-bold"
                  >
                    {{ reg.seed }}
                  </span>
                  <span
                    v-else
                    class="text-grey"
                  >{{ index + 1 }}</span>
                </v-avatar>
              </template>

              <v-list-item-title class="font-weight-medium">
                {{ reg.name }}
              </v-list-item-title>

              <template #append>
                <v-select
                  :model-value="reg.seed"
                  :items="[
                    { title: 'No seed', value: null },
                    { title: 'Seed #1', value: 1 },
                    { title: 'Seed #2', value: 2 },
                    { title: 'Seed #3', value: 3 },
                    { title: 'Seed #4', value: 4 },
                    { title: 'Seed #5', value: 5 },
                    { title: 'Seed #6', value: 6 },
                    { title: 'Seed #7', value: 7 },
                    { title: 'Seed #8', value: 8 },
                  ]"
                  item-title="title"
                  item-value="value"
                  variant="outlined"
                  density="compact"
                  hide-details
                  style="width: 120px"
                  :data-testid="`seed-input-${reg.id}`"
                  @update:model-value="(val) => saveSeed(reg.id, val)"
                />
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            data-testid="close-seeding-dialog-btn"
            @click="showSeedingDialog = false"
          >
            Done
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useNotificationStore } from '@/stores/notifications';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import CategoryManagement from '../components/CategoryManagement.vue';
import CategoryRegistrationStats from '../components/CategoryRegistrationStats.vue';
import CreateLevelsDialog from '../components/CreateLevelsDialog.vue';
import BaseDialog from '@/components/common/BaseDialog.vue';
import type { LevelDefinition } from '@/types';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const notificationStore = useNotificationStore();
const { getParticipantName } = useParticipantResolver();

const tournamentId = computed(() => route.params.tournamentId as string);
const registrations = computed(() => registrationStore.registrations);
const categories = computed(() => tournamentStore.categories);

// ── Bracket generation / regeneration ────────────────────────────────────────

const showRegenerateBracketDialog = ref(false);
const regenerateCategoryId = ref<string | null>(null);
const regenerateInProgress = ref(false);
const categoryLevels = ref<Record<string, LevelDefinition[]>>({});
const selectedLevelId = ref<string | null>(null);

async function generateBracket(categoryId: string) {
  try {
    await tournamentStore.generateBracket(tournamentId.value, categoryId);
    notificationStore.showToast('success', 'Bracket generated successfully!');
    await refreshCategoryLevels(categoryId);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to generate bracket');
  }
}

function confirmRegenerateBracket(categoryId: string) {
  regenerateCategoryId.value = categoryId;
  showRegenerateBracketDialog.value = true;
}

async function regenerateBracket() {
  if (!regenerateCategoryId.value) return;
  regenerateInProgress.value = true;
  try {
    await tournamentStore.regenerateBracket(tournamentId.value, regenerateCategoryId.value);
    notificationStore.showToast('success', 'Bracket regenerated successfully! Progression links updated.');
    showRegenerateBracketDialog.value = false;
    await refreshCategoryLevels(regenerateCategoryId.value);
  } catch (error) {
    console.error('Failed to regenerate bracket:', error);
    notificationStore.showToast('error', 'Failed to regenerate bracket');
  } finally {
    regenerateInProgress.value = false;
    regenerateCategoryId.value = null;
  }
}

async function refreshCategoryLevels(categoryId: string): Promise<void> {
  try {
    const levels = await tournamentStore.fetchCategoryLevels(tournamentId.value, categoryId);
    categoryLevels.value = { ...categoryLevels.value, [categoryId]: levels };
    if (levels.length > 0) {
      selectedLevelId.value = levels[0].id;
    }
  } catch (error) {
    console.error('Failed to fetch category levels:', error);
  }
}

// ── Create Levels dialog ──────────────────────────────────────────────────────

const showCreateLevelsDialog = ref(false);
const createLevelsCategoryId = ref<string | null>(null);

const createLevelsCategoryName = computed(() => {
  if (!createLevelsCategoryId.value) return '';
  return categories.value.find((c) => c.id === createLevelsCategoryId.value)?.name || '';
});

function openCreateLevelsDialog(categoryId: string): void {
  createLevelsCategoryId.value = categoryId;
  showCreateLevelsDialog.value = true;
}

async function handleLevelsGenerated(): Promise<void> {
  if (createLevelsCategoryId.value) {
    await refreshCategoryLevels(createLevelsCategoryId.value);
  }
  await tournamentStore.fetchTournament(tournamentId.value);
}

watch(showCreateLevelsDialog, (isOpen) => {
  if (!isOpen) createLevelsCategoryId.value = null;
});

// ── Seeding dialog ────────────────────────────────────────────────────────────

const showSeedingDialog = ref(false);
const seedingCategoryId = ref<string | null>(null);
const seedingRegistrations = ref<Array<{ id: string; name: string; seed: number | null }>>([]);
const savingSeed = ref(false);

function openSeedingDialog(categoryId: string) {
  seedingCategoryId.value = categoryId;

  const categoryRegs = registrations.value.filter(
    (r) => r.categoryId === categoryId && (r.status === 'approved' || r.status === 'checked_in')
  );

  seedingRegistrations.value = categoryRegs
    .map((r) => ({
      id: r.id,
      name: r.teamName || getParticipantName(r.id),
      seed: r.seed || null,
    }))
    .sort((a, b) => {
      if (a.seed !== null && b.seed !== null) return a.seed - b.seed;
      if (a.seed !== null) return -1;
      if (b.seed !== null) return 1;
      return a.name.localeCompare(b.name);
    });

  showSeedingDialog.value = true;
}

async function saveSeed(regId: string, seed: number | null) {
  savingSeed.value = true;
  try {
    await registrationStore.updateSeed(tournamentId.value, regId, seed);
    const reg = seedingRegistrations.value.find((r) => r.id === regId);
    if (reg) reg.seed = seed;
    notificationStore.showToast('success', 'Seed updated');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update seed');
  } finally {
    savingSeed.value = false;
  }
}

async function autoAssignSeeds() {
  savingSeed.value = true;
  try {
    for (let i = 0; i < Math.min(4, seedingRegistrations.value.length); i++) {
      const reg = seedingRegistrations.value[i];
      await registrationStore.updateSeed(tournamentId.value, reg.id, i + 1);
      reg.seed = i + 1;
    }
    for (let i = 4; i < seedingRegistrations.value.length; i++) {
      const reg = seedingRegistrations.value[i];
      if (reg.seed !== null) {
        await registrationStore.updateSeed(tournamentId.value, reg.id, null);
        reg.seed = null;
      }
    }
    notificationStore.showToast('success', 'Auto-assigned top 4 seeds');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to auto-assign seeds');
  } finally {
    savingSeed.value = false;
  }
}

function clearAllSeeds() {
  seedingRegistrations.value.forEach(async (reg) => {
    if (reg.seed !== null) {
      await registrationStore.updateSeed(tournamentId.value, reg.id, null);
      reg.seed = null;
    }
  });
  notificationStore.showToast('success', 'All seeds cleared');
}
</script>
