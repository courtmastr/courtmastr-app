<script setup lang="ts">
import { useI18n } from '@/i18n';

interface PublicHeroSectionProps {
  isAuthenticated: boolean;
}

defineProps<PublicHeroSectionProps>();
const { t } = useI18n();
</script>

<template>
  <section class="public-hero">
    <p class="public-hero__eyebrow text-overline mb-2">
      {{ t('home.heroEyebrow') }}
    </p>
    <h1 class="public-hero__title mb-4">
      {{ t('home.heroTitle') }}
    </h1>
    <p class="public-hero__subtitle text-body-1 mb-6">
      {{ t('home.heroSubtitle') }}
    </p>

    <div class="d-flex flex-wrap ga-3">
      <v-btn
        v-if="!isAuthenticated"
        color="primary"
        size="large"
        to="/register"
      >
        {{ t('home.heroStartFreeBeta') }}
      </v-btn>
      <v-btn
        v-if="!isAuthenticated"
        variant="outlined"
        size="large"
        to="/login"
      >
        {{ t('home.heroSignIn') }}
      </v-btn>
      <v-btn
        v-else
        color="primary"
        size="large"
        to="/tournaments"
      >
        {{ t('home.heroGoToDashboard') }}
      </v-btn>
    </div>
  </section>
</template>

<style scoped>
.public-hero {
  padding: 8px 0 4px;
}

.public-hero__eyebrow {
  letter-spacing: 0.14em;
  color: rgba(var(--v-theme-primary), 0.9);
}

.public-hero__title {
  margin: 0;
  font-family: 'Barlow Condensed', 'Avenir Next Condensed', sans-serif;
  font-size: clamp(2.1rem, 4vw, 3.4rem);
  line-height: 0.95;
  text-wrap: balance;
}

.public-hero__subtitle {
  max-width: 760px;
  color: rgba(var(--v-theme-on-surface), 0.74);
  text-wrap: pretty;
}
</style>
