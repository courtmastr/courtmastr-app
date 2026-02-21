<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useNotificationStore } from '@/stores/notifications';
import type { Category, ScoringConfig } from '@/types';
import { SCORING_PRESETS } from '@/types';
import {
  getTournamentStateLabel,
  normalizeTournamentState,
  assertCanEditScoring,
  isScoringLocked,
} from '@/guards/tournamentState';
import { useTournamentStateAdvance } from '@/composables/useTournamentStateAdvance';
import { sanitizeScoringConfig } from '@/features/scoring/utils/validation';
import StateBanner from '@/features/tournaments/components/StateBanner.vue';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/users';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const notificationStore = useNotificationStore();
const authStore = useAuthStore();
const userStore = useUserStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const isAdmin = computed(() => authStore.isAdmin);
const showUnlockDialog = ref(false);

const { advanceState, getNextState, transitionTo } = useTournamentStateAdvance(tournamentId);

const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const loading = ref(false);

interface CategoryScoringOverrideForm {
  enabled: boolean;
  preset: string;
  config: ScoringConfig;
}

const cloneScoringConfig = (config: ScoringConfig): ScoringConfig => ({
  gamesPerMatch: config.gamesPerMatch,
  pointsToWin: config.pointsToWin,
  mustWinBy: config.mustWinBy,
  maxPoints: config.maxPoints,
});

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
  maxPoints: 30 as number | null,
});

const initialScoringConfig = ref<ScoringConfig>(sanitizeScoringConfig(settings.value));
const categoryScoringOverrides = ref<Record<string, CategoryScoringOverrideForm>>({});
const initialCategoryScoringOverrides = ref<Record<string, CategoryScoringOverrideForm>>({});

// Scoring preset options
const scoringPresets = [
  { title: '21x3 (Best of 3, first to 21)', value: 'badminton_standard' },
  { title: '21x1 (Single game, first to 21)', value: 'badminton_single_game' },
  { title: '15x3 (Best of 3, first to 15)', value: 'badminton_short' },
  { title: 'Custom', value: 'custom' },
];

const selectedPreset = ref('badminton_standard');

// Games per match options
const gamesOptions = [
  { title: 'Single Game', value: 1 },
  { title: 'Best of 3', value: 3 },
  { title: 'Best of 5', value: 5 },
];

const maxPointsInput = computed({
  get: () => settings.value.maxPoints == null ? '' : String(settings.value.maxPoints),
  set: (value: string | number | null) => {
    if (value == null || value === '') {
      settings.value.maxPoints = null;
      selectedPreset.value = 'custom';
      return;
    }

    const parsed = Number(value);
    settings.value.maxPoints = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
    selectedPreset.value = 'custom';
  },
});

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
function detectPreset(config: ScoringConfig): string {
  const presetKeys = ['badminton_standard', 'badminton_single_game', 'badminton_short'];
  for (const key of presetKeys) {
    const preset = SCORING_PRESETS[key];
    if (
      config.gamesPerMatch === preset.gamesPerMatch &&
      config.pointsToWin === preset.pointsToWin &&
      config.mustWinBy === preset.mustWinBy &&
      config.maxPoints === preset.maxPoints
    ) {
      return key;
    }
  }
  return 'custom';
}

const tournamentState = computed(() => normalizeTournamentState(tournament.value));
const scoringLocked = computed(() => tournament.value ? isScoringLocked(tournamentState.value) : false);
const scoringLockLabel = computed(() => getTournamentStateLabel(tournamentState.value));
const hasCategories = computed(() => categories.value.length > 0);

const cloneOverrideRecord = (
  source: Record<string, CategoryScoringOverrideForm>
): Record<string, CategoryScoringOverrideForm> => {
  const cloned: Record<string, CategoryScoringOverrideForm> = {};
  Object.entries(source).forEach(([categoryId, override]) => {
    cloned[categoryId] = {
      enabled: override.enabled,
      preset: override.preset,
      config: cloneScoringConfig(override.config),
    };
  });
  return cloned;
};

const buildCategoryScoringForm = (category: Category, fallbackConfig: ScoringConfig): CategoryScoringOverrideForm => {
  const effectiveConfig = category.scoringOverrideEnabled
    ? sanitizeScoringConfig(
      category.scoringConfig ?? {
        gamesPerMatch: category.gamesPerMatch,
        pointsToWin: category.pointsToWin,
        mustWinBy: category.mustWinBy,
        maxPoints: category.maxPoints,
      },
      fallbackConfig
    )
    : fallbackConfig;

  return {
    enabled: Boolean(category.scoringOverrideEnabled),
    preset: detectPreset(effectiveConfig),
    config: cloneScoringConfig(effectiveConfig),
  };
};

function applyCategoryPreset(categoryId: string, presetKey: string): void {
  if (presetKey === 'custom') return;

  const preset = SCORING_PRESETS[presetKey];
  const form = categoryScoringOverrides.value[categoryId];
  if (!preset || !form) return;

  form.config = sanitizeScoringConfig(preset, sanitizeScoringConfig(settings.value));
}

const hasTournamentScoringChanged = (): boolean => {
  const current = sanitizeScoringConfig(settings.value);
  const baseline = initialScoringConfig.value;

  return (
    current.gamesPerMatch !== baseline.gamesPerMatch
    || current.pointsToWin !== baseline.pointsToWin
    || current.mustWinBy !== baseline.mustWinBy
    || current.maxPoints !== baseline.maxPoints
  );
};

const hasCategoryScoringChanged = (): boolean => {
  const current = JSON.stringify(cloneOverrideRecord(categoryScoringOverrides.value));
  const baseline = JSON.stringify(cloneOverrideRecord(initialCategoryScoringOverrides.value));
  return current !== baseline;
};

// Populate form when tournament/category data loads
watch([tournament, categories], ([t, nextCategories]) => {
  if (t) {
    name.value = t.name;
    description.value = t.description || '';
    location.value = t.location || '';
    startDate.value = t.startDate.toISOString().split('T')[0];
    endDate.value = t.endDate.toISOString().split('T')[0];
    registrationDeadline.value = t.registrationDeadline
      ? t.registrationDeadline.toISOString().split('T')[0]
      : '';

    const normalizedScoringConfig = sanitizeScoringConfig(t.settings);

    settings.value = {
      minRestTimeMinutes: t.settings.minRestTimeMinutes || 15,
      matchDurationMinutes: t.settings.matchDurationMinutes || 30,
      allowSelfRegistration: t.settings.allowSelfRegistration ?? true,
      requireApproval: t.settings.requireApproval ?? true,
      gamesPerMatch: normalizedScoringConfig.gamesPerMatch,
      pointsToWin: normalizedScoringConfig.pointsToWin,
      mustWinBy: normalizedScoringConfig.mustWinBy,
      maxPoints: normalizedScoringConfig.maxPoints,
    };

    selectedPreset.value = detectPreset(normalizedScoringConfig);
    initialScoringConfig.value = cloneScoringConfig(normalizedScoringConfig);

    const categoryOverrides: Record<string, CategoryScoringOverrideForm> = {};
    nextCategories.forEach((category) => {
      categoryOverrides[category.id] = buildCategoryScoringForm(category, normalizedScoringConfig);
    });
    categoryScoringOverrides.value = categoryOverrides;
    initialCategoryScoringOverrides.value = cloneOverrideRecord(categoryOverrides);
  }
}, { immediate: true });

onMounted(async () => {
  if (!tournament.value) {
    await tournamentStore.fetchTournament(tournamentId.value);
  }
  if (canManageOrganizers.value) {
    await userStore.fetchUsers();
  }
});

async function saveSettings() {
  loading.value = true;
  try {
    if ((hasTournamentScoringChanged() || hasCategoryScoringChanged()) && tournament.value) {
      assertCanEditScoring(tournamentState.value);
    }

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

    await Promise.all(
      categories.value.map(async (category) => {
        const override = categoryScoringOverrides.value[category.id];
        if (!override) return;

        const overrideConfig = sanitizeScoringConfig(override.config, sanitizeScoringConfig(settings.value));
        await tournamentStore.updateCategory(tournamentId.value, category.id, {
          scoringOverrideEnabled: override.enabled,
          scoringConfig: override.enabled ? overrideConfig : null,
        });
      })
    );

    initialScoringConfig.value = sanitizeScoringConfig(settings.value);
    initialCategoryScoringOverrides.value = cloneOverrideRecord(categoryScoringOverrides.value);
    notificationStore.showToast('success', 'Settings saved successfully!');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save settings';
    notificationStore.showToast('error', message);
  } finally {
    loading.value = false;
  }
}

// Co-organizer management
const canManageOrganizers = computed(() => {
  if (!tournament.value) return false;
  if (authStore.userRole === 'admin') return true;
  const uid = authStore.currentUser?.id;
  if (!uid) return false;
  const ids = tournament.value.organizerIds ?? [];
  return ids.includes(uid) || tournament.value.createdBy === uid;
});

const organizerUsers = computed(() => {
  const ids = tournament.value?.organizerIds ?? [];
  return userStore.users.filter((u) => ids.includes(u.id));
});

const addableOrganizers = computed(() => {
  const ids = tournament.value?.organizerIds ?? [];
  return userStore.users.filter(
    (u) => (u.role === 'organizer' || u.role === 'admin') && !ids.includes(u.id)
  );
});

const selectedOrganizerToAdd = ref<string | null>(null);
const organizerLoading = ref(false);

async function addOrganizerToTournament(): Promise<void> {
  if (!selectedOrganizerToAdd.value) return;
  organizerLoading.value = true;
  try {
    await tournamentStore.addOrganizer(tournamentId.value, selectedOrganizerToAdd.value);
    selectedOrganizerToAdd.value = null;
    notificationStore.showToast('success', 'Organizer added');
  } catch {
    notificationStore.showToast('error', 'Failed to add organizer');
  } finally {
    organizerLoading.value = false;
  }
}

async function removeOrganizerFromTournament(userId: string): Promise<void> {
  const ids = tournament.value?.organizerIds ?? [];
  if (ids.length <= 1) {
    notificationStore.showToast('error', 'Cannot remove the last organizer');
    return;
  }
  organizerLoading.value = true;
  try {
    await tournamentStore.removeOrganizer(tournamentId.value, userId);
    notificationStore.showToast('success', 'Organizer removed');
  } catch {
    notificationStore.showToast('error', 'Failed to remove organizer');
  } finally {
    organizerLoading.value = false;
  }
}

const showDeleteDialog = ref(false);
const typedDeleteName = ref('');
const deleteConfirmEnabled = computed(
  () => typedDeleteName.value === tournament.value?.name
);

function deleteTournament() {
  typedDeleteName.value = '';
  showDeleteDialog.value = true;
}

async function confirmDelete() {
  loading.value = true;
  try {
    await tournamentStore.deleteTournament(tournamentId.value);
    showDeleteDialog.value = false;
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
      <v-col
        cols="12"
        lg="8"
      >
        <!-- Header -->
        <div class="d-flex align-center mb-6">
          <v-btn
            icon="mdi-arrow-left"
            variant="text"
            aria-label="Go back"
            @click="router.back()"
          />
          <div class="ml-2">
            <h1 class="text-h5 font-weight-bold">
              Tournament Settings
            </h1>
            <p class="text-body-2 text-grey">
              {{ tournament.name }}
            </p>
          </div>
        </div>

        <!-- State Banner -->
        <StateBanner
          v-if="tournament"
          :state="tournament.state || 'DRAFT'"
          :next-state="getNextState(tournament.state || 'DRAFT')"
          :is-admin="isAdmin"
          @advance="advanceState"
          @unlock="showUnlockDialog = true"
          @revert="transitionTo('LIVE')"
        />

        <!-- Basic Info -->
        <v-card class="mb-4">
          <v-card-title>Basic Information</v-card-title>
          <v-card-text>
            <v-text-field
              v-model="name"
              label="Tournament Name"
              data-testid="tournament-name"
              required
            />
            <v-textarea
              v-model="description"
              label="Description"
              data-testid="tournament-description"
              rows="3"
            />
            <v-text-field
              v-model="location"
              label="Location"
              data-testid="tournament-location"
              prepend-inner-icon="mdi-map-marker"
            />
            <v-row>
              <v-col
                cols="12"
                md="4"
              >
                <v-text-field
                  v-model="startDate"
                  label="Start Date"
                  data-testid="tournament-start-date"
                  type="date"
                  required
                />
              </v-col>
              <v-col
                cols="12"
                md="4"
              >
                <v-text-field
                  v-model="endDate"
                  label="End Date"
                  data-testid="tournament-end-date"
                  type="date"
                  required
                />
              </v-col>
              <v-col
                cols="12"
                md="4"
              >
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
              <v-col
                cols="12"
                md="6"
              >
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
              <v-col
                cols="12"
                md="6"
              >
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
            <v-icon start>
              mdi-scoreboard
            </v-icon>
            Scoring Settings
          </v-card-title>
          <v-card-text>
            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              These settings apply to all matches in this tournament.
            </v-alert>
            <v-alert
              v-if="scoringLocked"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-4"
            >
              Scoring format is locked while tournament state is <strong>{{ scoringLockLabel }}</strong>.
            </v-alert>

            <v-select
              v-model="selectedPreset"
              :items="scoringPresets"
              item-title="title"
              item-value="value"
              label="Scoring Preset"
              variant="outlined"
              :disabled="scoringLocked"
              @update:model-value="applyPreset"
            />

            <v-divider class="my-4" />

            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <v-select
                  v-model="settings.gamesPerMatch"
                  :items="gamesOptions"
                  item-title="title"
                  item-value="value"
                  label="Games Per Match"
                  variant="outlined"
                  :disabled="scoringLocked"
                  @update:model-value="selectedPreset = 'custom'"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model.number="settings.pointsToWin"
                  label="Points to Win Game"
                  type="number"
                  min="5"
                  max="30"
                  variant="outlined"
                  hint="e.g., 21 for badminton, 11 for pickleball"
                  persistent-hint
                  :disabled="scoringLocked"
                  @update:model-value="selectedPreset = 'custom'"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model.number="settings.mustWinBy"
                  label="Win By Margin"
                  type="number"
                  min="1"
                  max="5"
                  variant="outlined"
                  hint="Must win by this many points (typically 2)"
                  persistent-hint
                  :disabled="scoringLocked"
                  @update:model-value="selectedPreset = 'custom'"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="maxPointsInput"
                  label="Max Points Cap"
                  type="number"
                  max="50"
                  variant="outlined"
                  hint="Optional. Leave blank to disable cap."
                  persistent-hint
                  clearable
                  :disabled="scoringLocked"
                />
              </v-col>
            </v-row>

            <!-- Preview -->
            <v-card
              variant="outlined"
              class="mt-4 pa-3 bg-grey-lighten-5"
            >
              <div class="text-subtitle-2 mb-2">
                Match Format Preview
              </div>
              <div class="text-body-2">
                <v-icon
                  size="small"
                  class="mr-1"
                >
                  mdi-information
                </v-icon>
                {{ settings.gamesPerMatch === 1 ? 'Single game' : `Best of ${settings.gamesPerMatch} games` }},
                first to <strong>{{ settings.pointsToWin }}</strong> points,
                win by <strong>{{ settings.mustWinBy }}</strong>,
                <template v-if="settings.maxPoints == null">
                  with <strong>no points cap</strong>.
                </template>
                <template v-else>
                  max <strong>{{ settings.maxPoints }}</strong> points.
                </template>
              </div>
              <div class="text-caption text-grey mt-1">
                Example: At {{ settings.pointsToWin - 1 }}-{{ settings.pointsToWin - 1 }},
                <template v-if="settings.maxPoints == null">
                  play continues until someone leads by {{ settings.mustWinBy }}.
                </template>
                <template v-else>
                  play continues until someone leads by {{ settings.mustWinBy }} or reaches {{ settings.maxPoints }}.
                </template>
              </div>
            </v-card>

            <v-divider class="my-4" />

            <div class="d-flex align-center justify-space-between mb-3">
              <div class="text-subtitle-2">
                Category Overrides (Optional)
              </div>
              <v-chip
                size="small"
                color="info"
                variant="tonal"
              >
                Uses tournament defaults when disabled
              </v-chip>
            </div>

            <v-alert
              v-if="!hasCategories"
              type="info"
              variant="tonal"
              density="compact"
            >
              No categories found for this tournament.
            </v-alert>

            <v-expansion-panels
              v-else
              variant="accordion"
            >
              <v-expansion-panel
                v-for="category in categories"
                :key="category.id"
              >
                <v-expansion-panel-title>
                  <div class="d-flex align-center w-100">
                    <span>{{ category.name }}</span>
                    <v-chip
                      class="ml-3"
                      size="x-small"
                      :color="categoryScoringOverrides[category.id]?.enabled ? 'info' : 'grey'"
                      variant="tonal"
                    >
                      {{ categoryScoringOverrides[category.id]?.enabled ? 'Override enabled' : 'Tournament default' }}
                    </v-chip>
                  </div>
                </v-expansion-panel-title>
                <v-expansion-panel-text v-if="categoryScoringOverrides[category.id]">
                  <v-switch
                    v-model="categoryScoringOverrides[category.id].enabled"
                    label="Use category-specific scoring"
                    color="primary"
                    :disabled="scoringLocked"
                  />

                  <template v-if="categoryScoringOverrides[category.id].enabled">
                    <v-select
                      v-model="categoryScoringOverrides[category.id].preset"
                      :items="scoringPresets"
                      item-title="title"
                      item-value="value"
                      label="Category Scoring Preset"
                      variant="outlined"
                      density="compact"
                      :disabled="scoringLocked"
                      @update:model-value="(value) => applyCategoryPreset(category.id, String(value))"
                    />

                    <v-row>
                      <v-col
                        cols="12"
                        md="6"
                      >
                        <v-select
                          v-model="categoryScoringOverrides[category.id].config.gamesPerMatch"
                          :items="gamesOptions"
                          item-title="title"
                          item-value="value"
                          label="Games Per Match"
                          variant="outlined"
                          density="compact"
                          :disabled="scoringLocked"
                          @update:model-value="categoryScoringOverrides[category.id].preset = 'custom'"
                        />
                      </v-col>
                      <v-col
                        cols="12"
                        md="6"
                      >
                        <v-text-field
                          v-model.number="categoryScoringOverrides[category.id].config.pointsToWin"
                          label="Points to Win"
                          type="number"
                          min="1"
                          variant="outlined"
                          density="compact"
                          :disabled="scoringLocked"
                          @update:model-value="categoryScoringOverrides[category.id].preset = 'custom'"
                        />
                      </v-col>
                    </v-row>

                    <v-row>
                      <v-col
                        cols="12"
                        md="6"
                      >
                        <v-text-field
                          v-model.number="categoryScoringOverrides[category.id].config.mustWinBy"
                          label="Win By"
                          type="number"
                          min="1"
                          variant="outlined"
                          density="compact"
                          :disabled="scoringLocked"
                          @update:model-value="categoryScoringOverrides[category.id].preset = 'custom'"
                        />
                      </v-col>
                      <v-col
                        cols="12"
                        md="6"
                      >
                        <v-text-field
                          :model-value="categoryScoringOverrides[category.id].config.maxPoints ?? ''"
                          label="Max Points Cap"
                          type="number"
                          variant="outlined"
                          density="compact"
                          clearable
                          :disabled="scoringLocked"
                          @update:model-value="(value) => {
                            categoryScoringOverrides[category.id].config.maxPoints = value === '' || value == null ? null : Number(value);
                            categoryScoringOverrides[category.id].preset = 'custom';
                          }"
                        />
                      </v-col>
                    </v-row>
                  </template>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
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
        <div class="d-flex justify-end">
          <v-btn
            color="primary"
            :loading="loading"
            @click="saveSettings"
          >
            Save Changes
          </v-btn>
        </div>

        <!-- Co-Organizers -->
        <v-card
          v-if="canManageOrganizers"
          class="mt-6"
          variant="outlined"
        >
          <v-card-title class="d-flex align-center pa-4 pb-2">
            <v-icon
              start
              icon="mdi-account-multiple"
            />
            Co-Organizers
          </v-card-title>
          <v-card-text>
            <!-- Current organizers list -->
            <v-list
              v-if="organizerUsers.length > 0"
              lines="one"
              class="mb-4"
            >
              <v-list-item
                v-for="user in organizerUsers"
                :key="user.id"
                :title="user.displayName"
                :subtitle="user.email"
                prepend-icon="mdi-account"
              >
                <template #append>
                  <v-btn
                    icon="mdi-close"
                    variant="text"
                    size="small"
                    color="error"
                    :disabled="organizerLoading || (tournament?.organizerIds?.length ?? 0) <= 1"
                    :title="(tournament?.organizerIds?.length ?? 0) <= 1 ? 'Cannot remove the last organizer' : 'Remove organizer'"
                    @click="removeOrganizerFromTournament(user.id)"
                  />
                </template>
              </v-list-item>
            </v-list>
            <p
              v-else
              class="text-medium-emphasis text-body-2 mb-4"
            >
              No organizers assigned yet.
            </p>

            <!-- Add organizer -->
            <div class="d-flex align-center gap-2">
              <v-autocomplete
                v-model="selectedOrganizerToAdd"
                :items="addableOrganizers"
                item-title="displayName"
                item-value="id"
                label="Add organizer"
                placeholder="Search by name..."
                variant="outlined"
                density="compact"
                clearable
                hide-details
                :item-props="(u) => ({ subtitle: u.email })"
              />
              <v-btn
                color="primary"
                variant="elevated"
                :disabled="!selectedOrganizerToAdd || organizerLoading"
                :loading="organizerLoading"
                @click="addOrganizerToTournament"
              >
                Add
              </v-btn>
            </div>
          </v-card-text>
        </v-card>

        <!-- Danger Zone -->
        <v-card
          class="mt-6"
          variant="outlined"
          color="error"
        >
          <v-card-title class="d-flex align-center text-error pa-4 pb-2">
            <v-icon
              start
              icon="mdi-alert"
              color="error"
            />
            Danger Zone
          </v-card-title>
          <v-card-text>
            <div class="d-flex flex-column flex-sm-row align-sm-center justify-space-between gap-3">
              <div>
                <div class="text-subtitle-2 font-weight-medium">
                  Delete this tournament
                </div>
                <div class="text-body-2 text-medium-emphasis">
                  Permanently remove this tournament and all its data. This cannot be undone.
                </div>
              </div>
              <v-btn
                color="error"
                variant="elevated"
                prepend-icon="mdi-delete"
                data-testid="delete-tournament-btn"
                :loading="loading"
                @click="deleteTournament"
              >
                Delete Tournament
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Delete Confirmation Dialog -->
    <v-dialog
      v-model="showDeleteDialog"
      data-testid="delete-tournament-dialog"
      max-width="500"
    >
      <v-card>
        <v-card-title class="text-h5 text-error">
          <v-icon
            start
            icon="mdi-alert"
            color="error"
          />
          Delete Tournament?
        </v-card-title>
        
        <v-card-text>
          <v-alert
            type="error"
            variant="tonal"
            border="start"
            class="mb-4"
          >
            <strong>Warning:</strong> This action cannot be undone. All matches, players, and data associated with this tournament will be permanently removed.
          </v-alert>
          <p class="text-body-2 mb-2">
            Type <strong>{{ tournament.name }}</strong> to confirm:
          </p>
          <v-text-field
            v-model="typedDeleteName"
            variant="outlined"
            density="compact"
            placeholder="Tournament name"
            :error="typedDeleteName.length > 0 && !deleteConfirmEnabled"
            hide-details
            autofocus
          />
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="loading"
            @click="showDeleteDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            variant="elevated"
            :loading="loading"
            :disabled="!deleteConfirmEnabled"
            @click="confirmDelete"
          >
            Delete Permanently
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
