<script setup lang="ts">
import BrandIconBadge from '@/components/common/BrandIconBadge.vue';

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

interface PublicFeatureGridProps {
  features: FeatureItem[];
}

defineProps<PublicFeatureGridProps>();
</script>

<template>
  <section class="public-feature-grid">
    <header class="public-feature-grid__header">
      <h2 class="public-feature-grid__title">
        Built for real tournament pressure
      </h2>
      <p class="public-feature-grid__subtitle">
        Each workflow is designed to reduce manual coordination and keep players informed.
      </p>
    </header>

    <div class="public-feature-grid__grid">
      <v-card
        v-for="feature in features"
        :key="feature.title"
        class="public-feature-grid__item"
        elevation="0"
      >
        <v-card-text class="pa-5">
          <BrandIconBadge
            :icon="feature.icon"
            class="mb-3"
            tone="primary"
          />
          <h3 class="public-feature-grid__item-title mb-2">
            {{ feature.title }}
          </h3>
          <p class="public-feature-grid__item-description mb-0">
            {{ feature.description }}
          </p>
        </v-card-text>
      </v-card>
    </div>
  </section>
</template>

<style scoped>
.public-feature-grid {
  display: grid;
  gap: 18px;
}

.public-feature-grid__header {
  max-width: 700px;
}

.public-feature-grid__title {
  margin: 0;
  font-family: 'Barlow Condensed', 'Avenir Next Condensed', sans-serif;
  font-size: clamp(1.8rem, 3vw, 2.4rem);
  line-height: 0.95;
}

.public-feature-grid__subtitle {
  margin: 10px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.68);
  text-wrap: pretty;
}

.public-feature-grid__grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.public-feature-grid__item {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 16px;
}

.public-feature-grid__item-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.public-feature-grid__item-description {
  margin: 0;
  color: rgba(var(--v-theme-on-surface), 0.7);
  text-wrap: pretty;
}
</style>
