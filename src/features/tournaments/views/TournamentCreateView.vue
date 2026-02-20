<script setup lang="ts">
import { ref, computed, toRaw } from 'vue';
import { useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import { CATEGORY_TEMPLATES, CATEGORY_TYPE_LABELS, CATEGORY_GENDER_LABELS, type TournamentFormat, type TournamentSettings } from '@/types';

const categoryTypeItems = Object.entries(CATEGORY_TYPE_LABELS).map(([value, title]) => ({ value, title }));
const categoryGenderItems = Object.entries(CATEGORY_GENDER_LABELS).map(([value, title]) => ({ value, title }));

const router = useRouter();
const tournamentStore = useTournamentStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

// Form state
const currentStep = ref(1);
const loading = ref(false);

// Basic info
const name = ref('');
const description = ref('');
const location = ref('');
const startDate = ref('');
const endDate = ref('');
const registrationDeadline = ref('');

// Tournament format is configured later at category level
const DEFAULT_TOURNAMENT_FORMAT: TournamentFormat = 'single_elimination';
const selectedCategories = ref<string[]>([]);
const customCategories = ref<{ name: string; type: string; gender: string }[]>([]);

// Tournament settings
const settings = ref<TournamentSettings>({
  minRestTimeMinutes: 15,
  matchDurationMinutes: 30,
  allowSelfRegistration: true,
  requireApproval: true,
  // Badminton scoring defaults
  gamesPerMatch: 3,
  pointsToWin: 21,
  mustWinBy: 2,
  maxPoints: 30,
});

// Courts
const courts = ref<{ name: string; number: number }[]>([
  { name: 'Court 1', number: 1 },
]);

const categoryOptions = CATEGORY_TEMPLATES.map((cat, index) => ({
  value: index.toString(),
  title: cat.name,
  subtitle: `${cat.type} - ${cat.gender}`,
}));

const steps = [
  { title: 'Basic Info', icon: 'mdi-information' },
  { title: 'Categories', icon: 'mdi-tag-multiple' },
  { title: 'Courts', icon: 'mdi-grid' },
  { title: 'Settings', icon: 'mdi-cog' },
];

const endDateError = computed(() => {
  if (!startDate.value || !endDate.value) return '';
  const start = new Date(startDate.value);
  const end = new Date(endDate.value);
  if (end < start) {
    return 'End date must be after start date';
  }
  return '';
});

const registrationDeadlineError = computed(() => {
  if (!startDate.value || !registrationDeadline.value) return '';
  const start = new Date(startDate.value);
  const deadline = new Date(registrationDeadline.value);
  if (deadline > start) {
    return 'Registration deadline must be before start date';
  }
  return '';
});

const dateError = computed(() => {
  if (endDateError.value) {
    return endDateError.value;
  }

  if (registrationDeadlineError.value) {
    return registrationDeadlineError.value;
  }

  return '';
});

const endDateErrorMessages = computed(() => {
  return endDateError.value ? [endDateError.value] : [];
});

const registrationDeadlineErrorMessages = computed(() => {
  return registrationDeadlineError.value ? [registrationDeadlineError.value] : [];
});

const isStep1Valid = computed(() => {
  return name.value.length >= 3 && startDate.value && endDate.value && !dateError.value;
});

const isStep3Valid = computed(() => {
  return selectedCategories.value.length > 0 || customCategories.value.length > 0;
});

const isStep4Valid = computed(() => {
  return courts.value.length > 0;
});

function addCourt() {
  const nextNumber = courts.value.length + 1;
  courts.value.push({ name: `Court ${nextNumber}`, number: nextNumber });
}

function removeCourt(index: number) {
  courts.value.splice(index, 1);
  // Renumber courts
  courts.value.forEach((court, i) => {
    court.number = i + 1;
    if (court.name.startsWith('Court ')) {
      court.name = `Court ${i + 1}`;
    }
  });
}

function addCustomCategory() {
  customCategories.value.push({
    name: '',
    type: 'singles',
    gender: 'open',
  });
}

function removeCustomCategory(index: number) {
  customCategories.value.splice(index, 1);
}

async function createTournament() {
  if (!authStore.currentUser) {
    console.log('[createTournament] No current user, aborting');
    return;
  }

  if (loading.value) {
    console.log('[createTournament] Already loading, aborting');
    return;
  }

  // Validate required fields
  console.log('[createTournament] Validating fields:', { 
    name: name.value, 
    startDate: startDate.value, 
    endDate: endDate.value,
    selectedCategories: selectedCategories.value,
    customCategories: customCategories.value
  });
  
  if (!name.value || !startDate.value || !endDate.value) {
    console.log('[createTournament] Missing required fields');
    notificationStore.showToast('error', 'Please fill in all required fields');
    loading.value = false;
    return;
  }

  // Validate that at least one category is selected
  if (selectedCategories.value.length === 0 && customCategories.value.filter(c => c.name).length === 0) {
    console.log('[createTournament] No categories selected');
    notificationStore.showToast('error', 'Please select at least one category');
    loading.value = false;
    return;
  }

  loading.value = true;

  // Set a timeout to prevent infinite hanging
  const timeoutId = setTimeout(() => {
    console.error('[createTournament] TIMEOUT: Tournament creation taking too long');
    loading.value = false;
    notificationStore.showToast('error', 'Tournament creation timed out. Please try again.');
  }, 15000);

  try {
    console.log('[createTournament] Starting tournament creation...');

    // Create tournament
    console.log('[createTournament] About to call tournamentStore.createTournament...');
    console.log('[createTournament] Data:', {
      name: name.value,
      sport: 'badminton',
      format: DEFAULT_TOURNAMENT_FORMAT,
      status: 'draft',
      startDate: startDate.value,
      endDate: endDate.value,
      createdBy: authStore.currentUser?.id,
    });
    
    // Build tournament data, omitting undefined/null values
    // Use toRaw to convert Vue proxies to plain objects for Firestore
    const startDateObj = new Date(startDate.value);
    const endDateObj = new Date(endDate.value);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw new Error('Invalid date format');
    }

    const tournamentData: any = {
      name: name.value,
      sport: 'badminton',
      format: DEFAULT_TOURNAMENT_FORMAT,
      status: 'draft',
      startDate: startDateObj,
      endDate: endDateObj,
      settings: { ...toRaw(settings.value) },
      createdBy: authStore.currentUser.id,
    };

    // Only add optional fields if they have values
    if (description.value) {
      tournamentData.description = description.value;
    }
    if (location.value) {
      tournamentData.location = location.value;
    }
    if (registrationDeadline.value) {
      tournamentData.registrationDeadline = new Date(registrationDeadline.value);
    }

    console.log('[createTournament] About to call store...');
    const startTime = Date.now();
    const tournamentId = await tournamentStore.createTournament(tournamentData);
    console.log(`[createTournament] Store call completed in ${Date.now() - startTime}ms`);
    console.log('[createTournament] Tournament created:', tournamentId);

    // Add selected predefined categories
    console.log('[createTournament] Adding categories... selectedCategories:', selectedCategories.value);
    if (selectedCategories.value.length === 0) {
      console.log('[createTournament] WARNING: No categories selected!');
    }

    // Process categories in batches to avoid hanging
    const categoryPromises = selectedCategories.value.map(async (index) => {
      const template = CATEGORY_TEMPLATES[parseInt(index)];
      console.log('[createTournament] Adding category:', template.name);
      return tournamentStore.addCategory(tournamentId, {
        ...template,
        status: 'setup',
      });
    });

    // Add custom categories
    const customCategoryPromises = customCategories.value
      .filter(cat => cat.name)
      .map(async (customCat) => {
        return tournamentStore.addCategory(tournamentId, {
          name: customCat.name,
          type: customCat.type as 'singles' | 'doubles' | 'mixed_doubles',
          gender: customCat.gender as 'men' | 'women' | 'mixed' | 'open',
          ageGroup: 'open',
          format: DEFAULT_TOURNAMENT_FORMAT,
          seedingEnabled: true,
          status: 'setup',
        });
      });

    await Promise.all([...categoryPromises, ...customCategoryPromises]);
    console.log('[createTournament] Categories added');

    // Add courts
    console.log('[createTournament] Adding courts...');
    const courtPromises = courts.value.map(async (court) => {
      return tournamentStore.addCourt(tournamentId, {
        name: court.name,
        number: court.number,
        status: 'available',
      });
    });

    await Promise.all(courtPromises);
    console.log('[createTournament] Courts added');

    console.log('[createTournament] Showing success toast and navigating...');
    notificationStore.showToast('success', 'Tournament created successfully!');
    await router.push(`/tournaments/${tournamentId}`);
    console.log('[createTournament] Navigation complete');
    clearTimeout(timeoutId);
  } catch (error: any) {
    console.error('[createTournament] Error creating tournament:', error);
    clearTimeout(timeoutId);
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    notificationStore.showToast('error', `Failed to create tournament: ${errorMessage}`);
  } finally {
    console.log('[createTournament] Finally block - setting loading to false');
    loading.value = false;
  }
}

function nextStep() {
  if (currentStep.value < steps.length) {
    currentStep.value++;
  }
}

function prevStep() {
  if (currentStep.value > 1) {
    currentStep.value--;
  }
}

async function handleSubmit() {
  console.log(`[handleSubmit] Called, currentStep: ${currentStep.value}, steps.length: ${steps.length}, loading: ${loading.value}`);
  
  // Prevent double submission
  if (loading.value) {
    console.log('[handleSubmit] Already loading, ignoring duplicate submit');
    return;
  }

  if (currentStep.value < steps.length) {
    console.log('[handleSubmit] Advancing to next step');
    nextStep();
    return;
  }

  console.log('[handleSubmit] On final step, calling createTournament');
  try {
    await createTournament();
    console.log('[handleSubmit] createTournament completed');
  } catch (err) {
    console.error('[handleSubmit] Failed to create tournament:', err);
  }
  console.log('[handleSubmit] Finished');
}
</script>

<style scoped>
.action-bar {
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: rgb(var(--v-theme-surface));
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>

<template>
  <v-container>
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
            @click="router.back()"
          />
          <div class="ml-2">
            <h1 class="text-h5 font-weight-bold">
              Create Tournament
            </h1>
            <p class="text-body-2 text-grey">
              Set up a new badminton tournament
            </p>
          </div>
        </div>

        <!-- Stepper -->
        <form @submit.prevent="handleSubmit">
          <v-stepper
            v-model="currentStep"
            alt-labels
          >
            <v-stepper-header>
              <template
                v-for="(step, index) in steps"
                :key="index"
              >
                <v-stepper-item
                  :value="index + 1"
                  :title="step.title"
                  :icon="step.icon"
                  :complete="currentStep > index + 1"
                />
                <v-divider v-if="index < steps.length - 1" />
              </template>
            </v-stepper-header>

            <v-stepper-window>
              <!-- Step 1: Basic Info -->
              <v-stepper-window-item :value="1">
                <v-card flat>
                  <v-card-text>
                    <v-text-field
                      v-model="name"
                      data-testid="tournament-name"
                      label="Tournament Name"
                      placeholder="e.g., Summer Badminton Championship 2024"
                      required
                    />

                    <v-textarea
                      v-model="description"
                      data-testid="tournament-description"
                      label="Description"
                      placeholder="Brief description of the tournament..."
                      rows="3"
                    />

                    <v-text-field
                      v-model="location"
                      data-testid="tournament-location"
                      label="Location"
                      placeholder="e.g., City Sports Complex"
                      prepend-inner-icon="mdi-map-marker"
                    />

                    <v-row>
                      <v-col
                        cols="12"
                        md="6"
                      >
                        <v-text-field
                          v-model="startDate"
                          data-testid="tournament-start-date"
                          label="Start Date"
                          type="date"
                          required
                        />
                      </v-col>
                      <v-col
                        cols="12"
                        md="6"
                      >
                        <v-text-field
                          v-model="endDate"
                          data-testid="tournament-end-date"
                          label="End Date"
                          type="date"
                          :error-messages="endDateErrorMessages"
                          required
                        />
                      </v-col>
                    </v-row>

                    <v-text-field
                      v-model="registrationDeadline"
                      data-testid="tournament-registration-deadline"
                      label="Registration Deadline (Optional)"
                      type="date"
                      :error-messages="registrationDeadlineErrorMessages"
                    />

                    <v-alert
                      v-if="dateError"
                      type="error"
                      variant="tonal"
                      class="mt-4"
                      data-testid="date-error"
                    >
                      {{ dateError }}
                    </v-alert>
                  </v-card-text>
                </v-card>
              </v-stepper-window-item>

              <!-- Step 2: Categories -->
              <v-stepper-window-item :value="2">
                <v-card flat>
                  <v-card-text>
                    <h3 class="text-subtitle-1 font-weight-bold mb-4">
                      Select Categories
                    </h3>

                    <v-checkbox
                      v-for="option in categoryOptions"
                        :key="option.value"
                      v-model="selectedCategories"
                      :value="option.value"
                      :label="option.title"
                      hide-details
                      density="compact"
                    />

                    <v-divider class="my-4" />

                    <h3 class="text-subtitle-1 font-weight-bold mb-4">
                      Custom Categories
                    </h3>

                    <v-row
                      v-for="(cat, index) in customCategories"
                      :key="index"
                      align="center"
                    >
                      <v-col cols="5">
                        <v-text-field
                          v-model="cat.name"
                          label="Category Name"
                          placeholder="e.g., Under 18 Singles"
                          density="compact"
                          hide-details
                        />
                      </v-col>
                      <v-col cols="3">
                        <v-select
                          v-model="cat.type"
                          :items="categoryTypeItems"
                          item-title="title"
                          item-value="value"
                          label="Type"
                          density="compact"
                          hide-details
                        />
                      </v-col>
                      <v-col cols="3">
                        <v-select
                          v-model="cat.gender"
                          :items="categoryGenderItems"
                          item-title="title"
                          item-value="value"
                          label="Gender"
                          density="compact"
                          hide-details
                        />
                      </v-col>
                      <v-col cols="1">
                        <v-btn
                          icon="mdi-delete"
                          variant="text"
                          color="error"
                          size="small"
                          type="button"
                          @click="removeCustomCategory(index)"
                        />
                      </v-col>
                    </v-row>

                    <v-btn
                      variant="outlined"
                      prepend-icon="mdi-plus"
                      class="mt-4"
                      type="button"
                      @click="addCustomCategory"
                    >
                      Add Custom Category
                    </v-btn>
                  </v-card-text>
                </v-card>
              </v-stepper-window-item>

              <!-- Step 3: Courts -->
              <v-stepper-window-item :value="3">
                <v-card flat>
                  <v-card-text>
                    <h3 class="text-subtitle-1 font-weight-bold mb-4">
                      Courts
                    </h3>

                    <v-row
                      v-for="(court, index) in courts"
                      :key="index"
                      align="center"
                    >
                      <v-col cols="2">
                        <v-text-field
                          v-model.number="court.number"
                          label="Number"
                          type="number"
                          density="compact"
                          hide-details
                        />
                      </v-col>
                      <v-col cols="9">
                        <v-text-field
                          v-model="court.name"
                          label="Court Name"
                          density="compact"
                          hide-details
                        />
                      </v-col>
                      <v-col cols="1">
                        <v-btn
                          icon="mdi-delete"
                          variant="text"
                          color="error"
                          size="small"
                          type="button"
                          :disabled="courts.length === 1"
                          @click="removeCourt(index)"
                        />
                      </v-col>
                    </v-row>

                    <v-btn
                      variant="outlined"
                      prepend-icon="mdi-plus"
                      class="mt-4"
                      type="button"
                      @click="addCourt"
                    >
                      Add Court
                    </v-btn>
                  </v-card-text>
                </v-card>
              </v-stepper-window-item>

              <!-- Step 4: Settings -->
              <v-stepper-window-item :value="4">
                <v-card flat>
                  <v-card-text>
                    <h3 class="text-subtitle-1 font-weight-bold mb-4">
                      Tournament Settings
                    </h3>

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
              </v-stepper-window-item>
            </v-stepper-window>

            <!-- Navigation -->
            <v-card-actions class="pa-4 action-bar">
              <v-btn
                v-if="currentStep > 1"
                variant="text"
                type="button"
                @click="prevStep"
              >
                Back
              </v-btn>
              <v-spacer />
              <v-btn
                v-if="currentStep < steps.length"
                color="primary"
                type="button"
                :disabled="
                  (currentStep === 1 && !isStep1Valid) ||
                    (currentStep === 2 && !isStep3Valid) ||
                    (currentStep === 3 && !isStep4Valid)
                "
                @click="nextStep"
              >
                Continue
              </v-btn>
              <v-btn
                v-else
                color="primary"
                :loading="loading"
                type="submit"
              >
                Create Tournament
              </v-btn>
            </v-card-actions>
          </v-stepper>
        </form>
      </v-col>
    </v-row>
  </v-container>
</template>
