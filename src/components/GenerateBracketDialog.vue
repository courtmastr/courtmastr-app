<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTournamentSetup } from '@/composables/useTournamentSetup';
import { useTournamentStore } from '@/stores/tournaments';

const props = defineProps<{
  modelValue: boolean;
  tournamentId: string;
  categoryId: string;
  categoryName: string;
  categoryFormat: 'single_elimination' | 'double_elimination' | 'round_robin';
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'success': [result: { matchCount: number; scheduled: number }];
}>();

const tournamentStore = useTournamentStore();
const setup = useTournamentSetup();

// Form state
const options = ref({
  grandFinal: 'double' as 'simple' | 'double' | 'none',
  consolationFinal: true,
  autoSchedule: true,
  startTime: new Date(),
  selectedCourts: [] as string[],
});

// Computed properties for UI switches
// These handle the boolean ↔ enum conversion for better UX
const grandFinalReset = computed({
  get: () => options.value.grandFinal === 'double',
  set: (val: boolean) => {
    options.value.grandFinal = val ? 'double' : 'simple';
  }
});

const thirdPlaceMatch = computed({
  get: () => options.value.consolationFinal,
  set: (val: boolean) => {
    options.value.consolationFinal = val;
  }
});

// Computed
const courts = computed(() => tournamentStore.courts.filter(c => c.status !== 'maintenance'));

const allCourtsSelected = computed({
  get: () => options.value.selectedCourts.length === courts.value.length,
  set: (val) => {
    options.value.selectedCourts = val ? courts.value.map(c => c.id) : [];
  }
});

const canSubmit = computed(() => {
  if (setup.loading.value) return false;
  if (options.value.autoSchedule && options.value.selectedCourts.length === 0) return false;
  return true;
});

// Methods
async function onSubmit() {
  try {
    const result = await setup.setupCategory({
      tournamentId: props.tournamentId,
      categoryId: props.categoryId,
      format: props.categoryFormat,
      // Pass enum directly (only for double elimination)
      grandFinal: props.categoryFormat === 'double_elimination'
        ? options.value.grandFinal
        : undefined,
      // Pass boolean directly
      consolationFinal: options.value.consolationFinal,
      autoSchedule: options.value.autoSchedule,
      startTime: options.value.startTime,
      courtIds: options.value.selectedCourts,
    });

    emit('success', {
      matchCount: result.bracket.matchCount,
      scheduled: result.schedule.scheduled,
    });
    
    close();
  } catch (err) {
    // Error is already handled by the composable
    console.error('Failed to setup bracket:', err);
  }
}

function close() {
  emit('update:modelValue', false);
  // Reset form
  options.value = {
    grandFinal: 'double',
    consolationFinal: true,
    autoSchedule: true,
    startTime: new Date(),
    selectedCourts: courts.value.map(c => c.id),
  };
}


</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="600"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon
          icon="mdi-trophy"
          class="mr-2"
          color="primary"
        />
        Generate Bracket
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          :disabled="setup.loading.value"
          @click="close"
        />
      </v-card-title>

      <v-card-subtitle>
        {{ categoryName }}
        <v-chip
          size="x-small"
          class="ml-2"
          variant="tonal"
        >
          {{ categoryFormat.replace('_', ' ') }}
        </v-chip>
      </v-card-subtitle>

      <v-divider />

      <v-card-text class="pt-4">
        <!-- Progress overlay -->
        <v-overlay
          :model-value="setup.loading.value"
          class="align-center justify-center"
          contained
        >
          <v-card
            class="pa-4 text-center"
            width="300"
          >
            <v-progress-circular
              :model-value="setup.progress.value"
              size="64"
              width="6"
              color="primary"
              class="mb-4"
            >
              {{ setup.progress.value }}%
            </v-progress-circular>
            <div class="text-h6">
              {{ setup.step.value === 'generating' ? 'Generating Bracket...' : 'Scheduling Matches...' }}
            </div>
            <div class="text-caption text-grey mt-2">
              {{ setup.step.value === 'generating' ? 'Creating matches and pairings' : 'Assigning courts and times' }}
            </div>
          </v-card>
        </v-overlay>

        <!-- Error alert -->
        <v-alert
          v-if="setup.error.value"
          type="error"
          variant="tonal"
          class="mb-4"
          closable
          @click:close="setup.error.value = null"
        >
          {{ setup.error.value }}
        </v-alert>

        <!-- Bracket Options -->
        <div class="mb-4">
          <div class="text-subtitle-2 font-weight-medium mb-2">
            Bracket Options
          </div>
          
          <v-switch
            v-if="categoryFormat === 'double_elimination'"
            v-model="grandFinalReset"
            label="Grand Final Reset (if losers bracket winner wins first match)"
            hide-details
            density="compact"
          />
          
          <v-switch
            v-if="categoryFormat !== 'round_robin'"
            v-model="thirdPlaceMatch"
            label="Include Third Place Match"
            hide-details
            density="compact"
          />
        </div>

        <v-divider class="my-4" />

        <!-- Scheduling Options -->
        <div>
          <div class="d-flex align-center mb-2">
            <v-switch
              v-model="options.autoSchedule"
              label="Auto-schedule matches"
              hide-details
              density="compact"
            />
          </div>

          <template v-if="options.autoSchedule">
            <!-- Court Selection -->
            <div class="mb-4">
              <div class="d-flex align-center mb-2">
                <span class="text-subtitle-2 font-weight-medium">Courts</span>
                <v-spacer />
                <v-checkbox
                  v-model="allCourtsSelected"
                  label="All"
                  hide-details
                  density="compact"
                />
              </div>
              
              <v-chip-group
                v-model="options.selectedCourts"
                multiple
                column
              >
                <v-chip
                  v-for="court in courts"
                  :key="court.id"
                  :value="court.id"
                  filter
                  variant="outlined"
                  color="primary"
                >
                  <v-icon
                    start
                    icon="mdi-badminton"
                    size="small"
                  />
                  {{ court.name }}
                </v-chip>
              </v-chip-group>
              
              <div
                v-if="options.selectedCourts.length === 0"
                class="text-caption text-error mt-1"
              >
                Select at least one court
              </div>
            </div>

            <!-- Start Time -->
            <v-text-field
              v-model="options.startTime"
              label="Start Time"
              type="datetime-local"
              variant="outlined"
              density="compact"
              hide-details
              class="mb-2"
            />
          </template>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4">
        <v-btn
          variant="text"
          :disabled="setup.loading.value"
          @click="close"
        >
          Cancel
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          variant="elevated"
          :loading="setup.loading.value"
          :disabled="!canSubmit"
          prepend-icon="mdi-trophy"
          @click="onSubmit"
        >
          Generate & Schedule
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.v-overlay__content {
  background: transparent !important;
}
</style>
