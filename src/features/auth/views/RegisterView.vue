<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import type { UserRole } from '@/types';

const router = useRouter();
const authStore = useAuthStore();

const displayName = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const showPassword = ref(false);
const loading = ref(false);
const acceptTerms = ref(false);
const selectedRole = ref('player');

const roleOptions = [
  { title: 'Player', value: 'player', description: 'Participate in tournaments' },
  { title: 'Tournament Organizer', value: 'organizer', description: 'Create and manage tournaments' },
  { title: 'Scorekeeper', value: 'scorekeeper', description: 'Record match scores' },
];

const error = computed(() => authStore.error);

const passwordsMatch = computed(() => {
  return password.value === confirmPassword.value;
});

const isFormValid = computed(() => {
  return (
    displayName.value.length >= 2 &&
    email.value.length > 0 &&
    password.value.length >= 6 &&
    passwordsMatch.value &&
    acceptTerms.value
  );
});

const passwordStrength = computed(() => {
  const pwd = password.value;
  if (pwd.length === 0) return { score: 0, text: '', color: 'grey' };
  if (pwd.length < 6) return { score: 20, text: 'Too short', color: 'error' };

  let score = 0;
  if (pwd.length >= 8) score += 25;
  if (/[A-Z]/.test(pwd)) score += 25;
  if (/[0-9]/.test(pwd)) score += 25;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 25;

  if (score < 50) return { score, text: 'Weak', color: 'error' };
  if (score < 75) return { score, text: 'Fair', color: 'warning' };
  return { score, text: 'Strong', color: 'success' };
});

async function handleRegister() {
  if (!isFormValid.value) return;

  loading.value = true;
  authStore.clearError();

  try {
    await authStore.register(email.value, password.value, displayName.value, selectedRole.value as UserRole);
    router.push('/tournaments');
  } catch (err) {
    // Error is handled by the store
  } finally {
    loading.value = false;
  }
}

async function handleGoogleRegister() {
  loading.value = true;
  authStore.clearError();

  try {
    await authStore.signInWithGoogle();
    router.push('/tournaments');
  } catch (err) {
    // Error is handled by the store
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <v-container
    class="fill-height"
    fluid
  >
    <v-row
      align="center"
      justify="center"
    >
      <v-col
        cols="12"
        sm="8"
        md="6"
        lg="5"
      >
        <v-card elevation="8">
          <v-card-title class="text-center py-6">
            <div>
              <v-icon
                size="48"
                color="primary"
                class="mb-2"
              >
                mdi-trophy
              </v-icon>
              <h1 class="text-h5 font-weight-bold">
                Create Account
              </h1>
              <p class="text-body-2 text-grey mt-1">
                Join CourtMaster today
              </p>
            </div>
          </v-card-title>

          <v-card-text class="px-6">
            <v-alert
              v-if="error"
              type="error"
              variant="tonal"
              class="mb-4"
              closable
              @click:close="authStore.clearError()"
            >
              {{ error }}
            </v-alert>

            <v-form @submit.prevent="handleRegister">
              <v-text-field
                v-model="displayName"
                label="Display Name"
                prepend-inner-icon="mdi-account"
                autocomplete="name"
                required
                :disabled="loading"
                hint="How others will see your name"
              />

              <v-text-field
                v-model="email"
                label="Email"
                type="email"
                prepend-inner-icon="mdi-email"
                autocomplete="email"
                required
                :disabled="loading"
              />

              <v-text-field
                v-model="password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                autocomplete="new-password"
                required
                :disabled="loading"
                @click:append-inner="showPassword = !showPassword"
              />

              <v-progress-linear
                v-if="password.length > 0"
                :model-value="passwordStrength.score"
                :color="passwordStrength.color"
                height="4"
                class="mb-1"
              />
              <p
                v-if="password.length > 0"
                class="text-caption mb-3"
                :class="`text-${passwordStrength.color}`"
              >
                Password strength: {{ passwordStrength.text }}
              </p>

              <v-text-field
                v-model="confirmPassword"
                label="Confirm Password"
                :type="showPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-check"
                autocomplete="new-password"
                required
                :disabled="loading"
                :error="confirmPassword.length > 0 && !passwordsMatch"
                :error-messages="confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : ''"
              />

              <v-select
                v-model="selectedRole"
                :items="roleOptions"
                item-title="title"
                item-value="value"
                label="I am a..."
                prepend-inner-icon="mdi-account-group"
                :disabled="loading"
                class="mb-2"
              >
                <template #item="{ props, item }">
                  <v-list-item v-bind="props">
                    <template #subtitle>
                      {{ item.raw.description }}
                    </template>
                  </v-list-item>
                </template>
              </v-select>

              <v-checkbox
                v-model="acceptTerms"
                :disabled="loading"
                density="compact"
              >
                <template #label>
                  <span class="text-body-2">
                    I agree to the
                    <a
                      href="#"
                      class="text-primary"
                    >Terms of Service</a>
                    and
                    <a
                      href="#"
                      class="text-primary"
                    >Privacy Policy</a>
                  </span>
                </template>
              </v-checkbox>

              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                :disabled="!isFormValid || loading"
                class="mt-2"
              >
                Create Account
              </v-btn>

              <div class="d-flex align-center my-4">
                <v-divider />
                <span class="mx-3 text-caption text-grey">or</span>
                <v-divider />
              </div>

              <v-btn
                variant="outlined"
                size="large"
                block
                prepend-icon="mdi-google"
                :loading="loading"
                :disabled="loading"
                @click="handleGoogleRegister"
              >
                Continue with Google
              </v-btn>
            </v-form>
          </v-card-text>

          <v-divider />

          <v-card-actions class="px-6 py-4">
            <span class="text-body-2 text-grey">Already have an account?</span>
            <v-spacer />
            <v-btn
              variant="text"
              color="primary"
              to="/login"
              :disabled="loading"
            >
              Sign In
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
