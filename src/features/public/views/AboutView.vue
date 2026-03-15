<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';
import BrandIconBadge from '@/components/common/BrandIconBadge.vue';
import PublicMarketingPageShell from '@/features/public/components/PublicMarketingPageShell.vue';
import { BRAND_COMPANY_NAME, BRAND_TAGLINE } from '@/constants/branding';

usePublicPageMetadata({
  title: 'About CourtMastr',
  description: `Learn how ${BRAND_COMPANY_NAME} built CourtMastr for reliable badminton tournament operations.`,
  canonicalPath: '/about',
});

interface AboutFocusArea {
  title: string;
  description: string;
  icon: string;
  tone: 'primary' | 'secondary' | 'success';
}

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);
const legalEntityName = BRAND_COMPANY_NAME;
const brandTagline = BRAND_TAGLINE;
const founderLinkedIn = 'https://www.linkedin.com/in/ramc46/';
const founderBlurb = 'RamC Venkatasamy is a technology leader focused on building AI-powered, cloud-native platforms that scale. With experience spanning State Farm, Amazon, and enterprise architecture, he brings deep expertise in agentic AI, data platforms, and event-driven systems to turn complex ideas into practical products.';
const aboutSubtitle = `CourtMastr is built by ${legalEntityName} to give badminton organizers a reliable, real-time operating system for tournament day.`;

const focusAreas: AboutFocusArea[] = [
  {
    title: 'Product Mission',
    description: 'Make tournament operations fast, clear, and dependable from first serve to final.',
    icon: 'mdi-target-account',
    tone: 'primary',
  },
  {
    title: 'Who We Serve',
    description: 'Clubs, organizers, federations, and volunteer teams running competitive racket-sport events.',
    icon: 'mdi-account-group',
    tone: 'secondary',
  },
  {
    title: 'Brand Promise',
    description: brandTagline,
    icon: 'mdi-lightning-bolt',
    tone: 'success',
  },
];
</script>

<template>
  <PublicMarketingPageShell
    eyebrow="About CourtMastr"
    title="Built for tournament day confidence"
    :subtitle="aboutSubtitle"
  >
    <template #actions>
      <v-btn
        v-if="!isAuthenticated"
        color="primary"
        to="/register"
      >
        Create Free Account
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
        to="/tournaments"
      >
        Go to Dashboard
      </v-btn>
    </template>

    <v-row class="about-view__highlights">
      <v-col
        v-for="area in focusAreas"
        :key="area.title"
        cols="12"
        md="4"
      >
        <v-card class="pa-5 h-100 about-view__surface">
          <div class="d-flex align-center ga-3 mb-3">
            <BrandIconBadge
              :icon="area.icon"
              :tone="area.tone"
            />
            <h2 class="text-h6 mb-0">
              {{ area.title }}
            </h2>
          </div>
          <p class="text-body-2 text-medium-emphasis mb-0">
            {{ area.description }}
          </p>
        </v-card>
      </v-col>
    </v-row>

    <v-card class="pa-5 about-view__surface">
      <div class="d-flex align-center ga-3 mb-3">
        <BrandIconBadge
          icon="mdi-account-tie"
          tone="primary"
        />
        <h2 class="text-h6 mb-0">
          Founder
        </h2>
      </div>
      <p class="text-body-2 text-medium-emphasis mb-4">
        {{ founderBlurb }}
      </p>
      <p class="text-body-2 text-medium-emphasis mb-4">
        CourtMastr is led by RamC Venkatasamy and built by {{ legalEntityName }} in the United States.
      </p>
      <v-btn
        variant="outlined"
        :href="founderLinkedIn"
        target="_blank"
        rel="noopener noreferrer"
      >
        View LinkedIn Profile
      </v-btn>
    </v-card>
  </PublicMarketingPageShell>
</template>

<style scoped>
.about-view__highlights {
  margin: 0;
}

.about-view__surface {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.98);
}
</style>
