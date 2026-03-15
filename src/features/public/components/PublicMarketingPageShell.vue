<script setup lang="ts">
import { computed } from 'vue';

interface PublicMarketingPageShellProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  maxWidth?: number;
}

const props = withDefaults(defineProps<PublicMarketingPageShellProps>(), {
  subtitle: '',
  maxWidth: 1080,
});

const containerStyle = computed(() => ({
  maxWidth: `${props.maxWidth}px`,
}));
</script>

<template>
  <section class="public-marketing-page-shell">
    <div
      class="public-marketing-page-shell__ambient"
      aria-hidden="true"
    />

    <v-container
      class="public-marketing-page-shell__container py-8 py-md-10"
      :style="containerStyle"
    >
      <v-card
        class="public-marketing-page-shell__hero"
        elevation="0"
      >
        <v-card-text class="pa-5 pa-md-7">
          <p class="text-overline public-marketing-page-shell__eyebrow mb-2">
            {{ eyebrow }}
          </p>
          <h1 class="public-marketing-page-shell__title mb-3">
            {{ title }}
          </h1>
          <p
            v-if="subtitle"
            class="text-body-1 public-marketing-page-shell__subtitle mb-0"
          >
            {{ subtitle }}
          </p>

          <div
            v-if="$slots.actions"
            class="public-marketing-page-shell__actions mt-5"
          >
            <slot name="actions" />
          </div>
        </v-card-text>
      </v-card>

      <div class="public-marketing-page-shell__content mt-6">
        <slot />
      </div>
    </v-container>
  </section>
</template>

<style scoped>
.public-marketing-page-shell {
  position: relative;
  min-height: 100%;
  background:
    linear-gradient(152deg, #f8fbff 0%, #eef4ff 32%, #fefcf8 63%, #edf8f2 100%);
  isolation: isolate;
}

.public-marketing-page-shell__ambient {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 12% 8%, rgba(var(--v-theme-primary), 0.18), transparent 34%),
    radial-gradient(circle at 88% 14%, rgba(var(--v-theme-secondary), 0.17), transparent 32%),
    radial-gradient(circle at 50% 100%, rgba(var(--v-theme-success), 0.08), transparent 30%);
}

.public-marketing-page-shell__container {
  position: relative;
}

.public-marketing-page-shell__hero {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 24px;
  background:
    linear-gradient(135deg, rgba(var(--v-theme-surface), 0.97) 0%, rgba(var(--v-theme-surface), 0.92) 100%);
  backdrop-filter: blur(4px);
}

.public-marketing-page-shell__eyebrow {
  letter-spacing: 0.14em;
  color: rgba(var(--v-theme-primary), 0.9);
}

.public-marketing-page-shell__title {
  margin: 0;
  font-family: 'Barlow Condensed', 'Avenir Next Condensed', sans-serif;
  font-size: clamp(2rem, 3.6vw, 3rem);
  line-height: 0.95;
  text-wrap: balance;
}

.public-marketing-page-shell__subtitle {
  max-width: 760px;
  color: rgba(var(--v-theme-on-surface), 0.72);
  text-wrap: pretty;
}

.public-marketing-page-shell__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.public-marketing-page-shell__content {
  position: relative;
  display: grid;
  gap: 16px;
}

@media (prefers-reduced-motion: reduce) {
  .public-marketing-page-shell__hero {
    backdrop-filter: none;
  }
}
</style>
