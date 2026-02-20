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
  <div class="home-view">
    <v-container>
      <!-- Hero Section -->
      <v-row
        class="hero-section py-16"
        align="center"
      >
        <v-col
          cols="12"
          md="6"
          class="hero-content fade-in"
        >
          <h1 class="hero-title mb-4">
            Tournament Management
            <span class="text-gradient">Made Simple</span>
          </h1>
          <p class="hero-subtitle mb-8">
            CourtMaster helps you organize and run badminton tournaments efficiently.
            From registration to final scores - all in one place.
          </p>
          <div class="d-flex flex-wrap gap-4">
            <v-btn
              v-if="!isAuthenticated"
              color="primary"
              size="x-large"
              elevation="4"
              class="cta-button"
              to="/register"
            >
              Get Started
              <v-icon end>
                mdi-arrow-right
              </v-icon>
            </v-btn>
            <v-btn
              v-if="!isAuthenticated"
              variant="outlined"
              size="x-large"
              class="outline-button"
              to="/login"
            >
              Sign In
            </v-btn>
            <v-btn
              v-else
              color="primary"
              size="x-large"
              elevation="4"
              class="cta-button"
              to="/tournaments"
            >
              View Tournaments
              <v-icon end>
                mdi-arrow-right
              </v-icon>
            </v-btn>
          </div>
        </v-col>
        <v-col
          cols="12"
          md="6"
          class="text-center hero-icon-col slide-up"
        >
          <div class="hero-icon-wrapper">
            <v-icon
              size="280"
              color="primary"
              class="hero-icon"
            >
              mdi-trophy
            </v-icon>
          </div>
        </v-col>
      </v-row>

      <!-- Features Section -->
      <v-row class="features-section py-16">
        <v-col
          cols="12"
          class="text-center mb-12"
        >
          <h2 class="section-title">
            Everything You Need
          </h2>
          <p class="section-subtitle mt-3">
            Powerful features to make your tournament a success
          </p>
        </v-col>

        <v-col
          v-for="(feature, index) in features"
          :key="feature.title"
          cols="12"
          sm="6"
          md="3"
          class="feature-col"
        >
          <v-card 
            class="feature-card pa-6" 
            height="100%"
            :style="{ animationDelay: `${index * 0.1}s` }"
            elevation="0"
          >
            <div
              :class="`icon-wrapper icon-${index}`"
              class="mb-4"
            >
              <v-icon
                size="42"
                color="white"
              >
                {{ feature.icon }}
              </v-icon>
            </div>
            <h3 class="feature-title mb-3">
              {{ feature.title }}
            </h3>
            <p class="feature-description">
              {{ feature.description }}
            </p>
          </v-card>
        </v-col>
      </v-row>

      <!-- CTA Section -->
      <v-row class="cta-section py-16">
        <v-col cols="12">
          <v-card
            class="cta-card pa-12 text-center"
            elevation="0"
          >
            <h2 class="cta-title mb-4">
              Ready to run your tournament?
            </h2>
            <p class="cta-subtitle mb-8">
              Sign up today and start organizing your first tournament in minutes.
            </p>
            <v-btn
              v-if="!isAuthenticated"
              color="white"
              size="x-large"
              elevation="4"
              class="cta-action-button"
              to="/register"
            >
              Create Free Account
              <v-icon end>
                mdi-arrow-right
              </v-icon>
            </v-btn>
            <v-btn
              v-else
              color="white"
              size="x-large"
              elevation="4"
              class="cta-action-button"
              to="/tournaments/create"
            >
              Create Tournament
              <v-icon end>
                mdi-plus-circle
              </v-icon>
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
  background: linear-gradient(135deg, #F8F9FA 0%, #E9ECEF 100%);
}

/* Hero Section */
.hero-section {
  min-height: 80vh;
  position: relative;
}

.hero-content {
  animation: fadeIn 0.8s ease-out;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: $font-weight-bold;
  line-height: $line-height-tight;
  color: $text-primary;
  
  @media (max-width: 960px) {
    font-size: 2.5rem;
  }
}

.text-gradient {
  background: $primary-gradient;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: inline-block;
}

.hero-subtitle {
  font-size: $font-size-lg;
  line-height: $line-height-relaxed;
  color: $text-secondary;
  max-width: 540px;
}

.cta-button {
  background: $primary-gradient !important;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.5px;
  transition: all 0.3s $transition-timing;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: $shadow-xl;
  }
}

.outline-button {
  border: 2px solid $primary-base;
  font-weight: $font-weight-semibold;
  
  &:hover {
    background-color: rgba($primary-base, 0.05);
    transform: translateY(-2px);
  }
}

.hero-icon-col {
  animation: slideUp 1s ease-out 0.3s both;
}

.hero-icon-wrapper {
  position: relative;
  display: inline-block;
  
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 380px;
    height: 380px;
    background: radial-gradient(circle, rgba($primary-base, 0.1) 0%, transparent 70%);
    border-radius: 50%;
    z-index: -1;
  }
}

.hero-icon {
  opacity: 0.9;
  filter: drop-shadow(0 10px 30px rgba($primary-base, 0.3));
}

/* Features Section */
.features-section {
  background-color: transparent;
}

.section-title {
  font-size: $font-size-2xl;
  font-weight: $font-weight-bold;
  color: $text-primary;
}

.section-subtitle {
  font-size: $font-size-lg;
  color: $text-secondary;
  max-width: 600px;
  margin: 0 auto;
}

.feature-col {
  animation: fadeIn 0.6s ease-out both;
}

.feature-card {
  text-align: center;
  background: $white;
  border: 1px solid $border-light;
  border-radius: $border-radius-lg;
  transition: all 0.3s $transition-timing;
  cursor: default;
  
  &:hover {
    transform: translateY(-8px);
    box-shadow: $shadow-xl;
    border-color: transparent;
  }
}

.icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: $border-radius-md;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  transition: transform 0.3s $transition-timing;
  
  &.icon-0 {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  
  &.icon-1 {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }
  
  &.icon-2 {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  }
  
  &.icon-3 {
    background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  }
}

.feature-card:hover .icon-wrapper {
  transform: scale(1.1) rotate(5deg);
}

.feature-title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.feature-description {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: $line-height-relaxed;
}

/* CTA Section */
.cta-section {
  padding-top: 80px;
  padding-bottom: 80px;
}

.cta-card {
  background: $primary-gradient;
  border-radius: $border-radius-xl;
  box-shadow: $shadow-2xl;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -20%;
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
    border-radius: 50%;
  }
}

.cta-title {
  font-size: $font-size-2xl;
  font-weight: $font-weight-bold;
  color: $white;
  position: relative;
  z-index: 1;
}

.cta-subtitle {
  font-size: $font-size-lg;
  color: rgba($white, 0.9);
  max-width: 600px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

.cta-action-button {
  background-color: $white !important;
  color: $primary-base !important;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.5px;
  position: relative;
  z-index: 1;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: $shadow-xl;
  }
}

/* Responsive */
@media (max-width: 960px) {
  .hero-section {
    min-height: auto;
    padding-top: 40px;
  }
  
  .hero-icon-wrapper::before {
    width: 280px;
    height: 280px;
  }
  
  .cta-card {
    padding: 48px 24px !important;
  }
}
</style>
