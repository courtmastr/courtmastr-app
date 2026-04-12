<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRegistrationStore } from '@/stores/registrations';
import { useNotificationStore } from '@/stores/notifications';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { logger } from '@/utils/logger';

const props = defineProps<{
  modelValue: boolean;
  tournamentId: string;
  categoryId: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const registrationStore = useRegistrationStore();
const notificationStore = useNotificationStore();
const { getParticipantName } = useParticipantResolver();

const savingSeed = ref(false);
const seedingRegistrations = ref<Array<{ id: string; name: string; seed: number | null }>>([]);
const pendingSeeds = reactive<Record<string, string | null>>({});

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

// Watch for dialog open to populate local state
watch(
  () => isOpen.value && props.categoryId,
  (shouldFetch) => {
    if (shouldFetch && props.categoryId) {
      const categoryRegistrations = registrationStore.registrations.filter(
        (registration) =>
          registration.categoryId === props.categoryId &&
          (registration.status === 'approved' || registration.status === 'checked_in')
      );

      seedingRegistrations.value = categoryRegistrations
        .map((registration) => ({
          id: registration.id,
          name: registration.teamName || getParticipantName(registration.id),
          seed: registration.seed || null,
        }))
        .sort((a, b) => {
          if (a.seed !== null && b.seed !== null) return a.seed - b.seed;
          if (a.seed !== null) return -1;
          if (b.seed !== null) return 1;
          return a.name.localeCompare(b.name);
        });
    } else {
      seedingRegistrations.value = [];
    }
  },
  { immediate: true }
);

function getUpdatesToShiftSeeds(
  registrations: typeof seedingRegistrations.value,
  targetSeed: number,
  excludeId: string
): { id: string; newSeed: number }[] {
  const updates: { id: string; newSeed: number }[] = [];
  let currentSeedToCheck = targetSeed;

  // Find if there's an existing registration with the target seed
  let collision = registrations.find(r => r.seed === currentSeedToCheck && r.id !== excludeId);

  while (collision) {
    currentSeedToCheck++;
    updates.push({ id: collision.id, newSeed: currentSeedToCheck });
    
    // Check if the NEW seed we just bounced this registration to causes ANOTHER collision
    const nextSeed = currentSeedToCheck;
    collision = registrations.find(r => r.seed === nextSeed && r.id !== excludeId && !updates.find(u => u.id === r.id));
  }

  return updates;
}

async function handleSeedInput(registrationId: string, newSeedVal: string | null): Promise<void> {
  const registration = seedingRegistrations.value.find((item) => item.id === registrationId);
  if (!registration) return;

  const parsedSeed = newSeedVal ? parseInt(newSeedVal, 10) : null;
  const oldSeed = registration.seed;
  
  if (parsedSeed === oldSeed || (Number.isNaN(parsedSeed) && oldSeed !== null)) {
      // Re-trigger reactivity if they typed nonsense or didn't change it to force UI back to original state
      registration.seed = oldSeed; 
      return;
  }

  savingSeed.value = true;
  try {
    const updatesToSave: { registrationId: string; seed: number | null }[] = [
      { registrationId: registration.id, seed: parsedSeed }
    ];

    // Auto-shifting logic if a valid seed was entered
    if (parsedSeed !== null) {
      const cascadingUpdates = getUpdatesToShiftSeeds(seedingRegistrations.value, parsedSeed, registration.id);
      
      for (const update of cascadingUpdates) {
         updatesToSave.push({ registrationId: update.id, seed: update.newSeed });
         // Predictively update local array for instant UI feedback
         const localReg = seedingRegistrations.value.find(r => r.id === update.id);
         if (localReg) localReg.seed = update.newSeed;
      }
    }

    // Predictively update the one we just changed
    registration.seed = parsedSeed;

    // Persist all via batch
    await registrationStore.batchUpdateSeeds(props.tournamentId, updatesToSave);

    // Re-sort the local array
    seedingRegistrations.value.sort((a, b) => {
      if (a.seed !== null && b.seed !== null) return a.seed - b.seed;
      if (a.seed !== null) return -1;
      if (b.seed !== null) return 1;
      return a.name.localeCompare(b.name);
    });

  } catch (error) {
    logger.error('Failed to update seed:', error);
    notificationStore.showToast('error', 'Failed to update seed');
  } finally {
    savingSeed.value = false;
  }
}

async function commitSeed(registrationId: string): Promise<void> {
  if (registrationId in pendingSeeds) {
    const val = pendingSeeds[registrationId];
    delete pendingSeeds[registrationId];
    await handleSeedInput(registrationId, val ?? null);
  }
}

function cancelSeed(registrationId: string): void {
  delete pendingSeeds[registrationId];
}

async function handleDone(): Promise<void> {
  await Promise.all(Object.keys(pendingSeeds).map(id => commitSeed(id)));
  isOpen.value = false;
}

async function autoAssignSeeds(): Promise<void> {
  savingSeed.value = true;
  try {
    const updates: { registrationId: string; seed: number | null }[] = [];
    
    for (let i = 0; i < Math.min(4, seedingRegistrations.value.length); i++) {
      const registration = seedingRegistrations.value[i];
      updates.push({ registrationId: registration.id, seed: i + 1 });
      registration.seed = i + 1;
    }
    
    for (let i = 4; i < seedingRegistrations.value.length; i++) {
      const registration = seedingRegistrations.value[i];
      if (registration.seed !== null) {
        updates.push({ registrationId: registration.id, seed: null });
        registration.seed = null;
      }
    }

    if (updates.length > 0) {
      await registrationStore.batchUpdateSeeds(props.tournamentId, updates);
    }
    
    notificationStore.showToast('success', 'Auto-assigned top 4 seeds');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to auto-assign seeds');
  } finally {
    savingSeed.value = false;
  }
}

async function autoAssignAllSeeds(): Promise<void> {
  savingSeed.value = true;
  try {
    const updates: { registrationId: string; seed: number | null }[] = [];
    for (let i = 0; i < seedingRegistrations.value.length; i++) {
      const registration = seedingRegistrations.value[i];
      updates.push({ registrationId: registration.id, seed: i + 1 });
      registration.seed = i + 1;
    }
    if (updates.length > 0) {
      await registrationStore.batchUpdateSeeds(props.tournamentId, updates);
    }
    notificationStore.showToast('success', `Auto-assigned all ${updates.length} seeds`);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to auto-assign seeds');
  } finally {
    savingSeed.value = false;
  }
}

async function clearAllSeeds(): Promise<void> {
  savingSeed.value = true;
  try {
    const updates: { registrationId: string; seed: number | null }[] = [];
    for (const registration of seedingRegistrations.value) {
      if (registration.seed !== null) {
        updates.push({ registrationId: registration.id, seed: null });
        registration.seed = null;
      }
    }

    if (updates.length > 0) {
      await registrationStore.batchUpdateSeeds(props.tournamentId, updates);
    }
    
    notificationStore.showToast('success', 'All seeds cleared');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to clear seeds');
  } finally {
    savingSeed.value = false;
  }
}
</script>

<template>
  <v-dialog
    v-model="isOpen"
    max-width="900"
    scrollable
  >
    <v-card height="80vh">
      <v-card-title class="d-flex align-center bg-surface py-3 px-4 border-b">
        <v-icon class="mr-2 text-primary">
          mdi-seed
        </v-icon>
        Manage Seeds
        <v-spacer />
        <v-chip
          size="small"
          color="primary"
          variant="tonal"
          class="font-weight-medium"
        >
          {{ seedingRegistrations.length }} players
        </v-chip>
      </v-card-title>

      <v-card-text class="pa-4 bg-background">
        <v-alert
          type="info"
          variant="tonal"
          class="mb-6 border"
        >
          <template #title>
            <div class="text-subtitle-1 font-weight-bold mb-1">
              Seeding tips
            </div>
          </template>
          <ul class="text-body-2 pl-4 mb-0">
            <li>Seed your top players (usually top 4 or top 8) to ensure they don't meet early</li>
            <li>Seeded players get favorable bracket positions (byes if available)</li>
            <li>Leave seed empty for unseeded players</li>
            <li><strong>Auto-shifting:</strong> Assigning a seed to a taken slot will bump existing seeds down automatically!</li>
          </ul>
        </v-alert>

        <v-card
          variant="outlined"
          class="mb-4 bg-surface"
        >
          <v-card-text class="d-flex align-center py-2 px-3">
            <v-btn
              size="small"
              variant="flat"
              color="primary"
              prepend-icon="mdi-auto-fix"
              data-testid="auto-assign-seeds-btn"
              :loading="savingSeed"
              class="mr-2"
              @click="autoAssignSeeds"
            >
              Auto-assign Top 4
            </v-btn>
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-auto-fix"
              :loading="savingSeed"
              class="mr-2"
              @click="autoAssignAllSeeds"
            >
              Auto-assign All
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
            <v-spacer />
            <span
              v-if="savingSeed"
              class="text-caption text-grey mr-2 d-flex align-center"
            >
              <v-progress-circular
                indeterminate
                size="16"
                width="2"
                class="mr-2"
              /> Saving...
            </span>
          </v-card-text>
        </v-card>

        <v-card
          variant="outlined"
          class="bg-surface overflow-hidden"
        >
          <v-list
            density="compact"
            class="py-0"
          >
            <template
              v-for="(reg, index) in seedingRegistrations"
              :key="reg.id"
            >
              <v-list-item
                :class="[
                  'py-2',
                  { 'bg-primary-lighten-5': reg.seed !== null }
                ]"
              >
                <template #prepend>
                  <v-avatar
                    :color="reg.seed !== null ? 'primary' : 'grey-lighten-3'"
                    size="36"
                    class="mr-4"
                  >
                    <span
                      v-if="reg.seed !== null"
                      class="text-white font-weight-bold text-subtitle-2"
                    >
                      {{ reg.seed }}
                    </span>
                    <span
                      v-else
                      class="text-grey-darken-1 text-caption"
                    >{{ index + 1 }}</span>
                  </v-avatar>
                </template>

                <v-list-item-title class="font-weight-medium text-body-1">
                  {{ reg.name }}
                </v-list-item-title>

                <template #append>
                  <v-text-field
                    :model-value="reg.id in pendingSeeds ? (pendingSeeds[reg.id] ?? '') : (reg.seed?.toString() || '')"
                    type="number"
                    variant="outlined"
                    density="compact"
                    hide-details
                    bg-color="surface"
                    placeholder="Unseeded"
                    style="width: 140px"
                    class="text-center-input"
                    :data-testid="`seed-input-${reg.id}`"
                    :min="1"
                    :max="seedingRegistrations.length"
                    @update:model-value="(val: string | null) => { pendingSeeds[reg.id] = val }"
                    @blur="commitSeed(reg.id)"
                    @keydown.enter="commitSeed(reg.id)"
                    @keydown.esc="cancelSeed(reg.id)"
                  >
                    <template #prepend-inner>
                      <v-icon
                        size="small"
                        color="grey"
                        class="mr-1"
                      >
                        mdi-pound
                      </v-icon>
                    </template>
                  </v-text-field>
                </template>
              </v-list-item>
              <v-divider v-if="index < seedingRegistrations.length - 1" />
            </template>
                
            <v-list-item
              v-if="seedingRegistrations.length === 0"
              class="py-4"
            >
              <v-list-item-title class="text-center text-grey">
                No checked-in or approved players found for this category.
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-card-text>

      <v-card-actions class="bg-surface py-3 px-4 border-t">
        <v-spacer />
        <v-btn
          variant="flat"
          color="primary"
          size="large"
          data-testid="close-seeding-dialog-btn"
          @click="handleDone"
        >
          Done
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* Remove the up/down arrows in standard webkit number inputs */
:deep(.text-center-input input[type=number]::-webkit-inner-spin-button), 
:deep(.text-center-input input[type=number]::-webkit-outer-spin-button) { 
  -webkit-appearance: none; 
  margin: 0; 
}
:deep(.text-center-input input) {
    text-align: center;
    font-weight: 600;
}
</style>
