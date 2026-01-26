<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useNotificationStore } from '@/stores/notifications';
import { SCORING_PRESETS } from '@/types';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const notificationStore = useNotificationStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const courts = computed(() => tournamentStore.courts);
const loading = ref(false);

// Form state
const name = ref('');
const description = ref('');
const location = ref('');
const startDate = ref('');
const endDate = ref('');
const registrationDeadline = ref('');
const settings = ref({
  minRestTimeMinutes: 15,
  matchDurationMinutes: 30,
  allowSelfRegistration: true,
  requireApproval: true,
  // Scoring settings with defaults
  gamesPerMatch: 3,
  pointsToWin: 21,
  mustWinBy: 2,
  maxPoints: 30,
});

// Scoring preset options
const scoringPresets = [
  { title: 'Badminton Standard (21 pts, best of 3)', value: 'badminton_standard' },
  { title: 'Badminton Short (15 pts, best of 3)', value: 'badminton_short' },
  { title: 'Badminton Single Game (21 pts, 1 game)', value: 'badminton_single_game' },
  { title: 'Pickleball (11 pts, best of 3)', value: 'pickleball' },
  { title: 'Table Tennis (11 pts, best of 5)', value: 'table_tennis' },
  { title: 'Custom', value: 'custom' },
];

const selectedPreset = ref('badminton_standard');

// Games per match options
const gamesOptions = [
  { title: 'Single Game', value: 1 },
  { title: 'Best of 3', value: 3 },
  { title: 'Best of 5', value: 5 },
];

function applyPreset(presetKey: string) {
  if (presetKey === 'custom') return;

  const preset = SCORING_PRESETS[presetKey];
  if (preset) {
    settings.value.gamesPerMatch = preset.gamesPerMatch;
    settings.value.pointsToWin = preset.pointsToWin;
    settings.value.mustWinBy = preset.mustWinBy;
    settings.value.maxPoints = preset.maxPoints;
  }
}

// Detect which preset matches current settings
function detectPreset() {
  for (const [key, preset] of Object.entries(SCORING_PRESETS)) {
    if (
      settings.value.gamesPerMatch === preset.gamesPerMatch &&
      settings.value.pointsToWin === preset.pointsToWin &&
      settings.value.mustWinBy === preset.mustWinBy &&
      settings.value.maxPoints === preset.maxPoints
    ) {
      return key;
    }
  }
  return 'custom';
}

// Populate form when tournament loads
watch(tournament, (t) => {
  if (t) {
    name.value = t.name;
    description.value = t.description || '';
    location.value = t.location || '';
    startDate.value = t.startDate.toISOString().split('T')[0];
    endDate.value = t.endDate.toISOString().split('T')[0];
    registrationDeadline.value = t.registrationDeadline
      ? t.registrationDeadline.toISOString().split('T')[0]
      : '';
    // Merge with defaults for scoring settings
    settings.value = {
      minRestTimeMinutes: t.settings.minRestTimeMinutes || 15,
      matchDurationMinutes: t.settings.matchDurationMinutes || 30,
      allowSelfRegistration: t.settings.allowSelfRegistration ?? true,
      requireApproval: t.settings.requireApproval ?? true,
      gamesPerMatch: t.settings.gamesPerMatch || 3,
      pointsToWin: t.settings.pointsToWin || 21,
      mustWinBy: t.settings.mustWinBy || 2,
      maxPoints: t.settings.maxPoints || 30,
    };
    selectedPreset.value = detectPreset();
  }
}, { immediate: true });

onMounted(async () => {
  if (!tournament.value) {
    await tournamentStore.fetchTournament(tournamentId.value);
  }
});

async function saveSettings() {
  loading.value = true;
  try {
    await tournamentStore.updateTournament(tournamentId.value, {
      name: name.value,
      description: description.value,
      location: location.value,
      startDate: new Date(startDate.value),
      endDate: new Date(endDate.value),
      registrationDeadline: registrationDeadline.value
        ? new Date(registrationDeadline.value)
        : undefined,
      settings: settings.value,
    });
    notificationStore.showToast('success', 'Settings saved successfully!');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to save settings');
  } finally {
    loading.value = false;
  }
}

async function deleteTournament() {
  if (!confirm('Are you sure you want to delete this tournament? This action cannot be undone.')) {
    return;
  }

  loading.value = true;
  try {
    await tournamentStore.deleteTournament(tournamentId.value);
    notificationStore.showToast('success', 'Tournament deleted');
    router.push('/tournaments');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to delete tournament');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <v-container v-if="tournament">
    <v-row justify="center">
      <v-col cols="12" lg="8">
        <!-- Header -->
        <div class="d-flex align-center mb-6">
          <v-btn icon="mdi-arrow-left" variant="text" @click="router.back()" />
          <div class="ml-2">
            <h1 class="text-h5 font-weight-bold">Tournament Settings</h1>
            <p class="text-body-2 text-grey">{{ tournament.name }}</p>
          </div>
        </div>

        <!-- Basic Info -->
        <v-card class="mb-4">
          <v-card-title>Basic Information</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="name"
              label="Tournament Name"
              required
            />
            <v-textarea
              v-model="description"
              label="Description"
              rows="3"
            />
            <v-text-field
              v-model="location"
              label="Location"
              prepend-inner-icon="mdi-map-marker"
            />
            <v-row>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="startDate"
                  label="Start Date"
                  type="date"
                  required
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="endDate"
                  label="End Date"
                  type="date"
                  required
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="registrationDeadline"
                  label="Registration Deadline"
                  type="date"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Scheduling Settings -->
        <v-card class="mb-4">
          <v-card-title>Scheduling Settings</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="settings.minRestTimeMinutes"
                  label="Minimum Rest Time (minutes)"
                  type="number"
                  min="5"
                  max="60"
                  hint="Time between matches for the same player"
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="settings.matchDurationMinutes"
                  label="Estimated Match Duration (minutes)"
                  type="number"
                  min="15"
                  max="90"
                  hint="Used for scheduling"
                  persistent-hint
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Scoring Settings -->
        <v-card class="mb-4">
          <v-card-title>
            <v-icon start>mdi-scoreboard</v-icon>
            Scoring Settings
          </v-card-title>
          <v-card-text>
            <v-alert type="info" variant="tonal" density="compact" class="mb-4">
              These settings apply to all matches in this tournament.
            </v-alert>

            <v-select
              v-model="selectedPreset"
              :items="scoringPresets"
              item-title="title"
              item-value="value"
              label="Scoring Preset"
              variant="outlined"
              @update:model-value="applyPreset"
            />

            <v-divider class="my-4" />

            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="settings.gamesPerMatch"
                  :items="gamesOptions"
                  item-title="title"
                  item-value="value"
                  label="Games Per Match"
                  variant="outlined"
                  @update:model-value="selectedPreset = 'custom'"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="settings.pointsToWin"
                  label="Points to Win Game"
                  type="number"
                  min="5"
                  max="30"
                  variant="outlined"
                  hint="e.g., 21 for badminton, 11 for pickleball"
                  persistent-hint
                  @update:model-value="selectedPreset = 'custom'"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="settings.mustWinBy"
                  label="Win By Margin"
                  type="number"
                  min="1"
                  max="5"
                  variant="outlined"
                  hint="Must win by this many points (typically 2)"
                  persistent-hint
                  @update:model-value="selectedPreset = 'custom'"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="settings.maxPoints"
                  label="Max Points Cap"
                  type="number"
                  min="15"
                  max="50"
                  variant="outlined"
                  hint="At deuce, first to this score wins (e.g., 30)"
                  persistent-hint
                  @update:model-value="selectedPreset = 'custom'"
                />
              </v-col>
            </v-row>

            <!-- Preview -->
            <v-card variant="outlined" class="mt-4 pa-3 bg-grey-lighten-5">
              <div class="text-subtitle-2 mb-2">Match Format Preview</div>
              <div class="text-body-2">
                <v-icon size="small" class="mr-1">mdi-information</v-icon>
                {{ settings.gamesPerMatch === 1 ? 'Single game' : `Best of ${settings.gamesPerMatch} games` }},
                first to <strong>{{ settings.pointsToWin }}</strong> points,
                win by <strong>{{ settings.mustWinBy }}</strong>,
                max <strong>{{ settings.maxPoints }}</strong> points.
              </div>
              <div class="text-caption text-grey mt-1">
                Example: At {{ settings.pointsToWin - 1 }}-{{ settings.pointsToWin - 1 }},
                play continues until someone leads by {{ settings.mustWinBy }} or reaches {{ settings.maxPoints }}.
              </div>
            </v-card>
          </v-card-text>
        </v-card>

        <!-- Registration Settings -->
        <v-card class="mb-4">
          <v-card-title>Registration Settings</v-card-title>
          <v-card-text>
            <v-switch
              v-model="settings.allowSelfRegistration"
              label="Allow Self-Registration"
              hint="Players can register themselves for the tournament"
              persistent-hint
              color="primary"
            />
            <v-switch
              v-model="settings.requireApproval"
              label="Require Admin Approval"
              hint="Registrations must be approved before being confirmed"
              persistent-hint
              color="primary"
              :disabled="!settings.allowSelfRegistration"
            />
          </v-card-text>
        </v-card>

        <!-- Actions -->
        <div class="d-flex justify-space-between">
          <v-btn
            color="error"
            variant="outlined"
            prepend-icon="mdi-delete"
            :loading="loading"
            @click="deleteTournament"
          >
            Delete Tournament
          </v-btn>
          <v-btn
            color="primary"
            :loading="loading"
            @click="saveSettings"
          >
            Save Changes
          </v-btn>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>
