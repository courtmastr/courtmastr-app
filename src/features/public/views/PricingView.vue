<script setup lang="ts">
import { computed } from 'vue';
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';
import { useAuthStore } from '@/stores/auth';

usePublicPageMetadata({
  title: 'Pricing',
  description: 'CourtMastr is currently Free Beta for tournament organizers. Paid plans are coming later.',
  canonicalPath: '/pricing',
});

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);
</script>

<template>
  <v-container class="py-10">
    <v-row justify="center">
      <v-col
        cols="12"
        md="10"
        lg="7"
      >
        <v-card class="pa-6 pa-md-8 pricing-hero">
          <p class="text-overline pricing-eyebrow mb-2">
            Pricing
          </p>
          <h1 class="text-h3 mb-3 pricing-title">
            Free Beta Access
          </h1>
          <p class="text-body-1 text-medium-emphasis mb-4">
            CourtMastr is currently free during our beta period. Run tournaments now and keep full access while we refine the platform.
          </p>
          <p class="text-body-2 text-medium-emphasis mb-4">
            by CourtMastr / powered by CourtMastr
          </p>

          <v-alert
            type="info"
            variant="tonal"
            class="mb-5"
          >
            Paid plans are coming later with transparent pricing for clubs and federations.
          </v-alert>

          <div class="d-flex flex-wrap ga-3 mb-5">
            <v-btn
              v-if="!isAuthenticated"
              color="primary"
              to="/register"
            >
              Start Free Beta
            </v-btn>
            <v-btn
              v-if="!isAuthenticated"
              variant="outlined"
              to="/login"
            >
              Sign In
            </v-btn>
            <v-btn
              v-else
              color="primary"
              to="/tournaments/create"
            >
              Create Tournament
            </v-btn>
          </div>

          <v-divider class="mb-4" />

          <h2 class="text-h6 mb-2">
            What You Get in Beta
          </h2>
          <ul class="pricing-list text-body-2 text-medium-emphasis">
            <li>Live scoring and public spectator pages</li>
            <li>Bracket and schedule management</li>
            <li>Self check-in and front-desk operations support</li>
            <li>OBS-ready overlays and branded tournament surfaces</li>
          </ul>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.pricing-hero {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.pricing-eyebrow {
  letter-spacing: 0.14em;
  color: rgba(var(--v-theme-primary), 0.92);
}

.pricing-title {
  font-family: 'Barlow Condensed', 'Inter', sans-serif;
}

.pricing-list {
  margin: 0;
  padding-left: 20px;
  display: grid;
  gap: 8px;
}
</style>
