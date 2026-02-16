<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const loading = ref(false);
const submitted = ref(false);

// Form
const firstName = ref('');
const lastName = ref('');
const email = ref('');
const phone = ref('');
const selectedCategories = ref<string[]>([]);
const partnerName = ref('');
const partnerEmail = ref('');

const isRegistrationOpen = computed(() => {
  if (!tournament.value) return false;
  return tournament.value.status === 'registration' && tournament.value.settings.allowSelfRegistration;
});

const doublesCategories = computed(() => {
  return selectedCategories.value.filter((catId) => {
    const cat = categories.value.find((c) => c.id === catId);
    return cat?.type === 'doubles' || cat?.type === 'mixed_doubles';
  });
});

const needsPartner = computed(() => doublesCategories.value.length > 0);

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
});

async function submitRegistration() {
  if (!tournament.value) return;

  loading.value = true;

  try {
    // Create player record
    const playerId = await registrationStore.addPlayer(tournamentId.value, {
      firstName: firstName.value,
      lastName: lastName.value,
      email: email.value,
      phone: phone.value,
      userId: authStore.currentUser?.id,
    });

    // Create partner if needed
    let partnerPlayerId: string | undefined;
    if (needsPartner.value && partnerName.value) {
      const [pFirstName, ...pLastNameParts] = partnerName.value.split(' ');
      partnerPlayerId = await registrationStore.addPlayer(tournamentId.value, {
        firstName: pFirstName,
        lastName: pLastNameParts.join(' ') || '',
        email: partnerEmail.value,
      });
    }

    // Create registrations for each selected category
    for (const categoryId of selectedCategories.value) {
      const category = categories.value.find((c) => c.id === categoryId);
      const isDoubles = category?.type === 'doubles' || category?.type === 'mixed_doubles';

      const registrationData: any = {
        tournamentId: tournamentId.value,
        categoryId,
        participantType: 'player',
        playerId,
        status: tournament.value.settings.requireApproval ? 'pending' : 'approved',
        registeredBy: authStore.currentUser?.id || playerId,
      };

      if (isDoubles && partnerPlayerId) {
        registrationData.partnerPlayerId = partnerPlayerId;
      }

      await registrationStore.createRegistration(tournamentId.value, registrationData);
    }

    submitted.value = true;
    notificationStore.showToast('success', 'Registration submitted successfully!');
  } catch (error) {
    console.error('Error submitting registration:', error);
    notificationStore.showToast('error', 'Failed to submit registration');
  } finally {
    loading.value = false;
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col
        cols="12"
        md="8"
        lg="6"
      >
        <!-- Tournament Info -->
        <v-card
          v-if="tournament"
          class="mb-4"
        >
          <v-card-title class="text-h5">
            {{ tournament.name }}
          </v-card-title>
          <v-card-subtitle>
            {{ formatDate(tournament.startDate) }}
            <span v-if="tournament.location"> | {{ tournament.location }}</span>
          </v-card-subtitle>
          <v-card-text v-if="tournament.description">
            {{ tournament.description }}
          </v-card-text>
        </v-card>

        <!-- Registration Closed -->
        <v-alert
          v-if="tournament && !isRegistrationOpen"
          type="warning"
          class="mb-4"
        >
          Registration is currently closed for this tournament.
        </v-alert>

        <!-- Success Message -->
        <v-card
          v-else-if="submitted"
          class="text-center py-8"
        >
          <v-icon
            size="64"
            color="success"
          >
            mdi-check-circle
          </v-icon>
          <h2 class="text-h5 font-weight-bold mt-4">
            Registration Submitted!
          </h2>
          <p class="text-body-1 text-grey mt-2">
            {{ tournament?.settings.requireApproval
              ? 'Your registration is pending approval. You will be notified once approved.'
              : 'Your registration has been confirmed.' }}
          </p>
          <v-btn
            color="primary"
            class="mt-4"
            :to="`/tournaments/${tournamentId}/bracket`"
          >
            View Tournament
          </v-btn>
        </v-card>

        <!-- Registration Form -->
        <v-card v-else-if="isRegistrationOpen">
          <v-card-title>Register for Tournament</v-card-title>
          <v-card-text>
            <v-form @submit.prevent="submitRegistration">
              <h3 class="text-subtitle-1 font-weight-bold mb-3">
                Your Information
              </h3>

              <v-row>
                <v-col cols="6">
                  <v-text-field
                    v-model="firstName"
                    label="First Name"
                    required
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="lastName"
                    label="Last Name"
                    required
                  />
                </v-col>
              </v-row>

              <v-text-field
                v-model="email"
                label="Email"
                type="email"
                required
              />

              <v-text-field
                v-model="phone"
                label="Phone (optional)"
              />

              <v-divider class="my-4" />

              <h3 class="text-subtitle-1 font-weight-bold mb-3">
                Select Categories
              </h3>

              <v-checkbox
                v-for="category in categories"
                :key="category.id"
                v-model="selectedCategories"
                :value="category.id"
                :label="category.name"
                hide-details
                density="compact"
              />

              <template v-if="needsPartner">
                <v-divider class="my-4" />

                <h3 class="text-subtitle-1 font-weight-bold mb-3">
                  Partner Information
                </h3>
                <p class="text-body-2 text-grey mb-4">
                  You selected doubles categories. Please provide your partner's information.
                </p>

                <v-text-field
                  v-model="partnerName"
                  label="Partner's Full Name"
                  required
                />

                <v-text-field
                  v-model="partnerEmail"
                  label="Partner's Email (optional)"
                  type="email"
                />
              </template>

              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                class="mt-6"
                :loading="loading"
                :disabled="!firstName || !lastName || !email || selectedCategories.length === 0"
              >
                Submit Registration
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>

        <!-- Loading -->
        <v-card
          v-else
          class="text-center py-8"
        >
          <v-progress-circular
            indeterminate
            color="primary"
          />
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
