<script setup lang="ts">
import { computed } from 'vue';
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';
import { useAuthStore } from '@/stores/auth';

usePublicPageMetadata({
  title: 'About CourtMastr',
  description: 'Learn how Marvy Technologies built CourtMastr for reliable badminton tournament operations.',
  canonicalPath: '/about',
});

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);
const founderLinkedIn = 'https://www.linkedin.com/in/ramc46/';
const founderBlurb = 'RamC Venkatasamy is a technology leader focused on building AI-powered, cloud-native platforms that scale. With experience spanning State Farm, Amazon, and enterprise architecture, he brings deep expertise in agentic AI, data platforms, and event-driven systems to turn complex ideas into practical products.';
</script>

<template>
  <v-container class="py-10 about-view">
    <v-row justify="center">
      <v-col cols="12" md="10" lg="8">
        <v-card class="pa-6 pa-md-8 mb-6">
          <p class="text-overline about-view__eyebrow mb-2">
            Marvy Technologies
          </p>
          <h1 class="text-h3 mb-3 about-view__title">
            About CourtMastr
          </h1>
          <p class="text-body-1 text-medium-emphasis mb-4">
            CourtMastr is built by Marvy Technologies to give badminton organizers a reliable,
            real-time operating system for tournament day. We designed it around the moments that
            matter most: check-in flow, live scoring, scheduling pressure, and public visibility.
          </p>
          <p class="text-body-1 text-medium-emphasis mb-0">
            Our brand promise is simple: <strong>Run Every Rally.</strong>
          </p>
        </v-card>

        <v-row>
          <v-col cols="12" md="6">
            <v-card class="pa-5 h-100">
              <h2 class="text-h6 mb-2">
                Product Mission
              </h2>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Make tournament operations fast, clear, and dependable from first serve to final.
              </p>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card class="pa-5 h-100">
              <h2 class="text-h6 mb-2">
                Who We Serve
              </h2>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Clubs, organizers, federations, and volunteers who run competitive racket-sport events.
              </p>
            </v-card>
          </v-col>
        </v-row>

        <v-card class="pa-5 mt-6">
          <h2 class="text-h6 mb-2">
            Founder
          </h2>
          <p class="text-body-2 text-medium-emphasis mb-4">
            {{ founderBlurb }}
          </p>
          <p class="text-body-2 text-medium-emphasis mb-4">
            CourtMastr is led by RamC Venkatasamy and built by Marvy Technologies in the United States.
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

        <v-card class="pa-5 mt-6">
          <h2 class="text-h6 mb-2">
            Start With CourtMastr
          </h2>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Launch your next tournament with live schedules, public scoring, and a branded spectator experience.
          </p>
          <div class="d-flex flex-wrap ga-3">
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
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.about-view__eyebrow {
  letter-spacing: 0.14em;
  color: rgba(var(--v-theme-primary), 0.92);
}

.about-view__title {
  font-family: 'Barlow Condensed', 'Inter', sans-serif;
}
</style>
