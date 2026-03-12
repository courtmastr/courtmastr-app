<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface TournamentBrandMarkProps {
  tournamentName: string;
  logoUrl?: string | null;
  fallbackIcon?: string;
  width?: number;
  height?: number;
}

const props = withDefaults(defineProps<TournamentBrandMarkProps>(), {
  logoUrl: null,
  fallbackIcon: 'mdi-trophy',
  width: 64,
  height: 64,
});

const imageFailed = ref(false);

const altText = computed(() => `${props.tournamentName} logo`);
const containerStyle = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
}));
const iconSize = computed(() => Math.max(20, Math.round(Math.min(props.width, props.height) * 0.46)));
const shouldRenderLogo = computed(() => Boolean(props.logoUrl) && !imageFailed.value);

watch(
  () => props.logoUrl,
  () => {
    imageFailed.value = false;
  },
  { immediate: true }
);

const handleImageError = (): void => {
  imageFailed.value = true;
};
</script>

<template>
  <div
    class="tournament-brand-mark"
    :style="containerStyle"
  >
    <v-img
      v-if="shouldRenderLogo"
      :src="props.logoUrl || undefined"
      :alt="altText"
      class="tournament-brand-mark__image"
      contain
      @error="handleImageError"
    />
    <div
      v-else
      class="tournament-brand-mark__fallback"
    >
      <v-icon
        :icon="fallbackIcon"
        :size="iconSize"
      />
    </div>
  </div>
</template>

<style scoped>
.tournament-brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background:
    linear-gradient(180deg, rgba(var(--v-theme-surface), 0.98) 0%, rgba(var(--v-theme-surface), 0.88) 100%),
    rgba(var(--v-theme-surface), 0.96);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.tournament-brand-mark__image {
  width: 100%;
  height: 100%;
}

.tournament-brand-mark__fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: rgb(var(--v-theme-primary));
}
</style>
