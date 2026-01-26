<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);

const features = [
  {
    icon: 'mdi-tournament',
    title: 'Tournament Management',
    description: 'Create and manage badminton tournaments with ease. Support for single and double elimination formats.',
  },
  {
    icon: 'mdi-scoreboard',
    title: 'Live Scoring',
    description: 'Mobile-optimized scoring interface for scorekeepers. Real-time score updates across all devices.',
  },
  {
    icon: 'mdi-calendar-clock',
    title: 'Smart Scheduling',
    description: 'Automated scheduling algorithm that respects player rest time and optimizes court usage.',
  },
  {
    icon: 'mdi-account-group',
    title: 'Easy Registration',
    description: 'Self-service registration for players or bulk import by administrators.',
  },
];
</script>

<template>
  <v-container>
    <!-- Hero Section -->
    <v-row class="py-12" align="center">
      <v-col cols="12" md="6">
        <h1 class="text-h2 font-weight-bold mb-4">
          Tournament Management
          <span class="text-primary">Made Simple</span>
        </h1>
        <p class="text-h6 text-grey-darken-1 mb-6">
          CourtMaster helps you organize and run badminton tournaments efficiently.
          From registration to final scores - all in one place.
        </p>
        <div class="d-flex gap-4">
          <v-btn
            v-if="!isAuthenticated"
            color="primary"
            size="x-large"
            to="/register"
          >
            Get Started
          </v-btn>
          <v-btn
            v-if="!isAuthenticated"
            variant="outlined"
            size="x-large"
            to="/login"
          >
            Sign In
          </v-btn>
          <v-btn
            v-else
            color="primary"
            size="x-large"
            to="/tournaments"
          >
            View Tournaments
          </v-btn>
        </div>
      </v-col>
      <v-col cols="12" md="6" class="text-center">
        <v-icon size="200" color="primary" class="hero-icon">mdi-trophy</v-icon>
      </v-col>
    </v-row>

    <!-- Features Section -->
    <v-row class="py-12">
      <v-col cols="12" class="text-center mb-8">
        <h2 class="text-h4 font-weight-bold">Everything You Need</h2>
        <p class="text-body-1 text-grey mt-2">
          Powerful features to make your tournament a success
        </p>
      </v-col>

      <v-col
        v-for="feature in features"
        :key="feature.title"
        cols="12"
        sm="6"
        md="3"
      >
        <v-card class="text-center pa-6 feature-card" height="100%">
          <v-icon size="48" color="primary" class="mb-4">{{ feature.icon }}</v-icon>
          <h3 class="text-h6 font-weight-bold mb-2">{{ feature.title }}</h3>
          <p class="text-body-2 text-grey">{{ feature.description }}</p>
        </v-card>
      </v-col>
    </v-row>

    <!-- CTA Section -->
    <v-row class="py-12">
      <v-col cols="12">
        <v-card color="primary" class="pa-8 text-center">
          <h2 class="text-h4 font-weight-bold text-white mb-4">
            Ready to run your tournament?
          </h2>
          <p class="text-body-1 text-white mb-6">
            Sign up today and start organizing your first tournament in minutes.
          </p>
          <v-btn
            v-if="!isAuthenticated"
            color="white"
            size="large"
            to="/register"
          >
            Create Free Account
          </v-btn>
          <v-btn
            v-else
            color="white"
            size="large"
            to="/tournaments/create"
          >
            Create Tournament
          </v-btn>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.hero-icon {
  opacity: 0.8;
}

.feature-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}
</style>
