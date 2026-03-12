<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVolunteerAccessStore } from '@/stores/volunteerAccess';
import type { VolunteerRole } from '@/types';

const route = useRoute();
const router = useRouter();
const volunteerAccessStore = useVolunteerAccessStore();

const pin = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);

const tournamentId = computed(() => route.params.tournamentId as string);
const volunteerRole = computed(() => route.meta.volunteerRole as VolunteerRole | undefined);

const roleTitle = computed(() => (
  volunteerRole.value === 'scorekeeper'
    ? 'Scorekeeper PIN Access'
    : 'Front Desk PIN Access'
));

const roleDescription = computed(() => (
  volunteerRole.value === 'scorekeeper'
    ? 'Enter the scoring PIN to open the scorekeeper workspace.'
    : 'Enter the front-desk PIN to open the check-in workspace.'
));

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
    console.error('Error starting volunteer session:', sessionError);
    error.value = sessionError instanceof Error
      ? sessionError.message
      : 'Failed to start volunteer session';
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <v-container class="py-8">
    <v-row justify="center">
      <v-col
        cols="12"
        sm="8"
        md="5"
      >
        <v-card elevation="4">
          <v-card-title class="text-h5 font-weight-bold">
            {{ roleTitle }}
          </v-card-title>
          <v-card-subtitle>
            Tournament {{ tournamentId }}
          </v-card-subtitle>
          <v-card-text>
            <p class="text-body-2 mb-4">
              {{ roleDescription }}
            </p>

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
              :disabled="submitting"
              @keyup.enter="submitPin"
            />

            <v-btn
              block
              color="primary"
              :loading="submitting"
              :disabled="!pin.trim() || submitting"
              @click="submitPin"
            >
              Enter Volunteer Mode
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
