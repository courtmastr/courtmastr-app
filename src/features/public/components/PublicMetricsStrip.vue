<script setup lang="ts">
interface MetricItem {
  label: string;
  value: string;
}

interface PublicMetricsStripProps {
  metrics: MetricItem[];
  helperText: string;
}

defineProps<PublicMetricsStripProps>();
</script>

<template>
  <section class="public-metrics-strip">
    <div class="public-metrics-strip__grid">
      <v-card
        v-for="metric in metrics"
        :key="metric.label"
        class="public-metrics-strip__item"
        elevation="0"
      >
        <v-card-text class="pa-4">
          <p class="public-metrics-strip__value mb-1">
            {{ metric.value }}
          </p>
          <p class="public-metrics-strip__label mb-0">
            {{ metric.label }}
          </p>
        </v-card-text>
      </v-card>
    </div>
    <p class="public-metrics-strip__helper text-medium-emphasis mt-3 mb-0">
      {{ helperText }}
    </p>
  </section>
</template>

<style scoped>
.public-metrics-strip__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 12px;
}

.public-metrics-strip__item {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 14px;
}

.public-metrics-strip__value {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: rgba(var(--v-theme-primary), 0.96);
  font-variant-numeric: tabular-nums;
}

.public-metrics-strip__label {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(var(--v-theme-on-surface), 0.56);
}

.public-metrics-strip__helper {
  margin: 0;
  font-size: 0.82rem;
}
</style>
