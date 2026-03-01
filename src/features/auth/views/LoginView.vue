<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const isDev = import.meta.env.DEV;

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const loading = ref(false);

const error = computed(() => authStore.error);

const isFormValid = computed(() => {
  return email.value.length > 0 && password.value.length >= 6;
});

async function handleLogin() {
  if (!isFormValid.value) return;

  loading.value = true;
  authStore.clearError();

  try {
    await authStore.signIn(email.value, password.value);

    // Redirect to intended page or tournaments
    const redirect = route.query.redirect as string;
    router.push(redirect || '/tournaments');
  } catch (err) {
    // Error is handled by the store
  } finally {
    loading.value = false;
  }
}

async function handleGoogleLogin() {
  loading.value = true;
  authStore.clearError();

  try {
    await authStore.signInWithGoogle();
    const redirect = route.query.redirect as string;
    router.push(redirect || '/tournaments');
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
        md="5"
        lg="4"
      >
        <v-card elevation="8">
          <v-card-title class="text-center py-6">
            <div>
              <img
                src="@/assets/brand/courtmaster-mark.svg"
                alt="CourtMaster Logo"
                height="48"
                class="mb-2"
              >
              <h1 class="text-h5 font-weight-bold">
                CourtMaster
              </h1>
              <p class="text-body-2 text-grey mt-1">
                Sign in to continue
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

            <v-form
              data-testid="login-form"
              @submit.prevent="handleLogin"
            >
              <v-text-field
                v-model="email"
                data-testid="login-email"
                label="Email"
                type="email"
                prepend-inner-icon="mdi-email"
                autocomplete="email"
                required
                :disabled="loading"
              />

              <v-text-field
                v-model="password"
                data-testid="login-password"
                label="Password"
                :type="showPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                autocomplete="current-password"
                required
                :disabled="loading"
                @click:append-inner="showPassword = !showPassword"
              />

              <v-btn
                type="submit"
                data-testid="login-submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                :disabled="!isFormValid || loading"
                class="mt-4"
              >
                Sign In
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
                @click="handleGoogleLogin"
              >
                Continue with Google
              </v-btn>
            </v-form>
          </v-card-text>

          <v-divider />

          <v-card-actions class="px-6 py-4">
            <span class="text-body-2 text-grey">Don't have an account?</span>
            <v-spacer />
            <v-btn
              variant="text"
              color="primary"
              to="/register"
              :disabled="loading"
            >
              Create Account
            </v-btn>
          </v-card-actions>
        </v-card>

        <!-- Demo credentials hint -->
        <v-card
          v-if="isDev"
          class="mt-4"
          variant="tonal"
          color="info"
        >
          <v-card-text class="text-center">
            <p class="text-body-2 mb-2">
              <strong>Demo Credentials:</strong>
            </p>
            <p class="text-caption">
              Admin: admin@courtmastr.com / admin123<br>
              Scorekeeper: scorekeeper@courtmastr.com / score123
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
