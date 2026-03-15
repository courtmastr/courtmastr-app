<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';
import BrandIconBadge from '@/components/common/BrandIconBadge.vue';
import PublicMarketingPageShell from '@/features/public/components/PublicMarketingPageShell.vue';
import { BRAND_ATTRIBUTION, BRAND_POWERED_BY } from '@/constants/branding';

usePublicPageMetadata({
  title: 'Pricing',
  description: 'CourtMastr is currently Free Beta for tournament organizers. Paid plans are coming later.',
  canonicalPath: '/pricing',
});

interface BetaFeature {
  title: string;
  icon: string;
  tone: 'primary' | 'secondary' | 'success';
}

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);

const betaFeatures: BetaFeature[] = [
  {
    title: 'Live scoring and public spectator pages',
    icon: 'mdi-scoreboard',
    tone: 'primary',
  },
  {
    title: 'Bracket and schedule management',
    icon: 'mdi-tournament',
    tone: 'secondary',
  },
  {
    title: 'Self check-in and front-desk operations support',
    icon: 'mdi-account-check',
    tone: 'success',
  },
  {
    title: 'OBS-ready overlays and branded tournament surfaces',
    icon: 'mdi-cast-connected',
    tone: 'primary',
  },
];
</script>

<template>
  <PublicMarketingPageShell
    eyebrow="Pricing"
    title="Free Beta Access"
    subtitle="CourtMastr is currently free during beta while we harden tournament workflows with organizer feedback."
    :max-width="980"
  >
    <template #actions>
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
    </template>

    <v-card class="pa-6 pa-md-7 pricing-view__surface">
      <p class="text-body-2 text-medium-emphasis mb-4">
        {{ BRAND_ATTRIBUTION }} · {{ BRAND_POWERED_BY }}
      </p>

      <v-alert
        type="info"
        variant="tonal"
        class="mb-5"
      >
        Paid plans are coming later with transparent pricing for clubs and federations.
      </v-alert>

      <h2 class="text-h6 mb-3">
        What You Get in Beta
      </h2>
      <ul class="pricing-view__feature-list">
        <li
          v-for="feature in betaFeatures"
          :key="feature.title"
          class="pricing-view__feature-item"
        >
          <BrandIconBadge
            :icon="feature.icon"
            :tone="feature.tone"
            :size="34"
            :icon-size="18"
          />
          <span class="text-body-2 text-medium-emphasis">
            {{ feature.title }}
          </span>
        </li>
      </ul>
    </v-card>
  </PublicMarketingPageShell>
</template>

<style scoped>
.pricing-view__surface {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.98);
}

.pricing-view__feature-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 12px;
}

.pricing-view__feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
}
</style>
