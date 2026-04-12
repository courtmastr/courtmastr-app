<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import TournamentPublicShell from '@/components/common/TournamentPublicShell.vue';
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';
import { useTournamentStore } from '@/stores/tournaments';
import { useVolunteerAccessStore } from '@/stores/volunteerAccess';
import type { VolunteerRole } from '@/types';
import { logger } from '@/utils/logger';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const volunteerAccessStore = useVolunteerAccessStore();

const pin = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => {
  const currentTournament = tournamentStore.currentTournament;
  return currentTournament?.id === tournamentId.value ? currentTournament : null;
});
const tournamentName = computed(() => tournament.value?.name?.trim() || `Tournament ${tournamentId.value}`);
const volunteerRole = computed(() => route.meta.volunteerRole as VolunteerRole | undefined);

const roleTitle = computed(() => (
  volunteerRole.value === 'scorekeeper'
    ? 'Scorekeeper PIN Access'
    : 'Front Desk PIN Access'
));

const roleDescription = computed(() => (
  volunteerRole.value === 'scorekeeper'
    ? 'Enter the scoring PIN to unlock the live scorekeeper workspace on phone or tablet.'
    : 'Enter the front-desk PIN to launch the branded check-in workspace across kiosk devices.'
));

const roleEyebrow = computed(() => (
  volunteerRole.value === 'scorekeeper'
    ? 'Scorekeeper Access'
    : 'Front Desk Access'
));

usePublicPageMetadata({
  title: volunteerRole.value === 'scorekeeper' ? 'Scorekeeper Access' : 'Front Desk Access',
  description: 'Enter a volunteer PIN to access the CourtMastr event operations workspace.',
  canonicalPath: route.path,
  noIndex: true,
});

const kioskRouteName = computed(() => (
  volunteerRole.value === 'scorekeeper'
    ? 'volunteer-scoring-kiosk'
    : 'volunteer-checkin-kiosk'
));

const submitPin = async (): Promise<void> => {
  if (!pin.value.trim() || !volunteerRole.value) {
    return;
  }

  submitting.value = true;
  error.value = null;

  try {
    await volunteerAccessStore.requestSession({
      tournamentId: tournamentId.value,
      role: volunteerRole.value,
      pin: pin.value.trim(),
    });

    await router.push({
      name: kioskRouteName.value,
      params: { tournamentId: tournamentId.value },
    });
  } catch (sessionError) {
    logger.error('Error starting volunteer session:', sessionError);
    error.value = sessionError instanceof Error
      ? sessionError.message
      : 'Failed to start volunteer session';
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <TournamentPublicShell
    :tournament="tournament"
    :eyebrow="roleEyebrow"
    :page-title="roleTitle"
    :page-subtitle="roleDescription"
    :fallback-icon="volunteerRole === 'scorekeeper' ? 'mdi-scoreboard' : 'mdi-account-check'"
    :max-width="980"
    :show-sponsors="false"
  >
    <template #actions>
      <v-chip
        color="primary"
        variant="tonal"
        class="volunteer-access__action-chip"
      >
        {{ volunteerRole === 'scorekeeper' ? 'Phone-first scoring' : 'Front desk operations' }}
      </v-chip>
      <v-chip
        color="success"
        variant="outlined"
        class="volunteer-access__action-chip"
      >
        PIN Protected
      </v-chip>
    </template>

    <v-row justify="center">
      <v-col
        cols="12"
        md="8"
        lg="7"
      >
        <v-card
          class="volunteer-access__panel"
          elevation="0"
        >
          <v-card-text class="pa-5 pa-sm-6">
            <div class="volunteer-access__panel-copy mb-5">
              <div class="text-overline volunteer-access__panel-eyebrow mb-1">
                {{ tournamentName }}
              </div>
              <h2 class="text-h5 font-weight-bold volunteer-access__panel-title">
                Secure volunteer entry
              </h2>
              <p class="text-body-2 volunteer-access__panel-subtitle">
                Use the assigned PIN to enter the branded {{ volunteerRole === 'scorekeeper' ? 'scorekeeper' : 'front desk' }} workspace.
              </p>
            </div>

            <v-alert
              v-if="error"
              type="error"
              variant="tonal"
              class="mb-4"
            >
              {{ error }}
            </v-alert>

            <v-text-field
              v-model="pin"
              label="PIN"
              type="password"
              autocomplete="one-time-code"
              variant="outlined"
              density="comfortable"
              class="volunteer-access__pin-input"
              :disabled="submitting"
              @keyup.enter="submitPin"
            />

            <div class="volunteer-access__panel-actions mt-4">
              <v-btn
                block
                color="primary"
                size="large"
                class="volunteer-access__submit"
                :loading="submitting"
                :disabled="!pin.trim() || submitting"
                @click="submitPin"
              >
                Enter Volunteer Mode
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </TournamentPublicShell>
</template>

<style scoped>
.volunteer-access__action-chip {
  font-weight: 700;
  letter-spacing: 0.04em;
}

.volunteer-access__panel {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 26px;
  background:
    linear-gradient(145deg, rgba(var(--v-theme-surface), 0.97) 0%, rgba(var(--v-theme-surface), 0.91) 100%);
  box-shadow:
    0 24px 40px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.volunteer-access__panel-eyebrow {
  letter-spacing: 0.14em;
  color: rgba(var(--v-theme-primary), 0.9);
}

.volunteer-access__panel-title {
  font-family: 'Barlow Condensed', 'Avenir Next Condensed', sans-serif;
  line-height: 0.95;
}

.volunteer-access__panel-subtitle {
  color: rgba(var(--v-theme-on-surface), 0.68);
}

.volunteer-access__pin-input {
  max-width: 420px;
}

.volunteer-access__submit {
  min-height: 56px;
  border-radius: 16px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
</style>
