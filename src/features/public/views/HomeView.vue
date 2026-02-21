<script setup lang="ts">
import { computed } from 'vue';
import { Trophy, MonitorPlay, CalendarClock, Users } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);

const features = [
  {
    icon: Trophy,
    title: 'Tournament Management',
    description: 'Create and manage badminton tournaments with ease. Support for single and double elimination formats.',
  },
  {
    icon: MonitorPlay,
    title: 'Live Scoring',
    description: 'Mobile-optimized scoring interface for scorekeepers. Real-time score updates across all devices.',
  },
  {
    icon: CalendarClock,
    title: 'Smart Scheduling',
    description: 'Automated scheduling algorithm that respects player rest time and optimizes court usage.',
  },
  {
    icon: Users,
    title: 'Easy Registration',
    description: 'Self-service registration for players or bulk import by administrators.',
  },
];
</script>

<template>
  <div class="home-view">
    <v-container>
      <!-- Hero Section -->
      <v-row
        class="hero-section py-12"
        align="center"
      >
        <v-col
          cols="12"
          md="5"
          class="hero-content"
        >
          <h1 class="hero-title mb-6">
            The Professional Standard for
            <span class="text-primary">Tournament Management</span>
          </h1>
          <p class="hero-subtitle mb-8 text-body-1">
            CourtMaster provides organizers with a robust, reliable platform to schedule matches, manage registrations, and record live scores efficiently.
          </p>
          <div class="d-flex flex-wrap gap-4">
            <v-btn
              v-if="!isAuthenticated"
              color="primary"
              size="x-large"
              elevation="0"
              class="cta-button px-8 text-none font-weight-bold"
              to="/register"
            >
              Get Started
            </v-btn>
            <v-btn
              v-if="!isAuthenticated"
              variant="outlined"
              size="x-large"
              color="secondary"
              class="outline-button px-8 text-none font-weight-bold bg-white"
              to="/login"
            >
              Sign In
            </v-btn>
            <v-btn
              v-else
              color="primary"
              size="x-large"
              elevation="0"
              class="cta-button px-8 text-none font-weight-bold"
              to="/tournaments"
            >
              Go to Dashboard
            </v-btn>
          </div>
        </v-col>
        
        <v-col
          cols="12"
          md="7"
          class="hero-image-col pl-md-8 mt-10 mt-md-0"
        >
          <div class="dashboard-mockup rounded-lg overflow-hidden border">
            <img src="/app-screenshot.png" alt="CourtMaster Live Match Control" class="w-100 h-auto d-block" style="object-fit: cover;" />
          </div>
        </v-col>
      </v-row>

      <v-divider class="my-8"></v-divider>

      <!-- Credibility Section -->
      <v-row class="credibility-section py-4 mb-4">
        <v-col cols="12">
          <div class="d-flex flex-column flex-md-row justify-space-around align-center text-center gap-8">
            <div class="stat-block">
              <div class="text-h4 font-weight-bold text-primary mb-1">Reliable</div>
              <div class="text-subtitle-2 text-grey-darken-1 text-uppercase letter-spacing-1">Cloud Infrastructure</div>
            </div>
            <div class="stat-block">
              <div class="text-h4 font-weight-bold text-primary mb-1">Real-Time</div>
              <div class="text-subtitle-2 text-grey-darken-1 text-uppercase letter-spacing-1">Match Synchronization</div>
            </div>
            <div class="stat-block">
              <div class="text-h4 font-weight-bold text-primary mb-1">Secure</div>
              <div class="text-subtitle-2 text-grey-darken-1 text-uppercase letter-spacing-1">Role-Based Access</div>
            </div>
          </div>
        </v-col>
      </v-row>

      <!-- Features Section -->
      <v-row class="features-section py-16 bg-white rounded-xl border mt-8">
        <v-col
          cols="12"
          class="text-center mb-8"
        >
          <h2 class="section-title">
            Purpose-Built for Organizers
          </h2>
          <p class="section-subtitle mt-2">
            Every feature is designed to eliminate operational friction during tournaments.
          </p>
        </v-col>

        <v-col
          v-for="feature in features"
          :key="feature.title"
          cols="12"
          sm="6"
          md="3"
          class="feature-col px-4"
        >
          <div class="feature-item text-center">
            <div class="icon-wrapper bg-grey-lighten-4 mx-auto mb-4 d-flex align-center justify-center rounded-circle border" style="width: 64px; height: 64px;">
              <component
                :is="feature.icon"
                :size="32"
                class="text-primary"
              />
            </div>
            <h3 class="feature-title mb-2 text-subtitle-1 font-weight-bold">
              {{ feature.title }}
            </h3>
            <p class="feature-description text-body-2 text-grey-darken-1">
              {{ feature.description }}
            </p>
          </div>
        </v-col>
      </v-row>

      <!-- CTA Section -->
      <v-row class="cta-section py-16 mt-8">
        <v-col cols="12">
          <v-card
            class="cta-card pa-12 text-center bg-primary"
            elevation="0"
          >
            <h2 class="cta-title mb-4">
              Streamline Your Next Tournament
            </h2>
            <p class="cta-subtitle mb-8 text-primary-lighten-4">
              Deploy CourtMaster for your organization and experience frictionless match management.
            </p>
            <v-btn
              v-if="!isAuthenticated"
              color="white"
              size="x-large"
              elevation="0"
              class="cta-action-button text-primary font-weight-bold text-none"
              to="/register"
            >
              Start Organizing
            </v-btn>
            <v-btn
              v-else
              color="white"
              size="x-large"
              elevation="0"
              class="cta-action-button text-primary font-weight-bold text-none"
              to="/tournaments/create"
            >
              Create Tournament
            </v-btn>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.home-view {
  min-height: 100vh;
  background-color: $background;
  font-family: $font-family-base;
}

/* Hero Section */
.hero-section {
  min-height: 50vh;
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  line-height: $line-height-tight;
  color: $text-primary;
  letter-spacing: -0.02em;
  
  @media (max-width: 960px) {
    font-size: 2.25rem;
  }
}

.hero-subtitle {
  color: $text-secondary;
  max-width: 480px;
}

.cta-button {
  transition: all 0.2s ease;
  
  &:hover {
    background-color: $primary-dark !important;
  }
}

.outline-button {
  border: 1px solid $border;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: $background-dark !important;
  }
}

/* Dashboard Mockup */
.dashboard-mockup {
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.1);
}

.mockup-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.bg-primary-lighten-2 {
  background-color: rgba($primary-base, 0.1);
}

/* Details and Spacing */
.letter-spacing-1 {
  letter-spacing: 1px;
}

.section-title {
  font-size: $font-size-xl;
  font-weight: $font-weight-bold;
  color: $text-primary;
  letter-spacing: -0.01em;
}

.section-subtitle {
  color: $text-secondary;
}

/* CTA Section */
.cta-card {
  border-radius: $border-radius-lg;
}

.cta-title {
  font-size: $font-size-2xl;
  font-weight: $font-weight-bold;
  color: $white;
  letter-spacing: -0.02em;
}

@media (max-width: 960px) {
  .hero-section {
    text-align: center;
  }
  
  .hero-subtitle {
    margin: 0 auto;
  }
  
  .d-flex.flex-wrap {
    justify-content: center;
  }
}
</style>
