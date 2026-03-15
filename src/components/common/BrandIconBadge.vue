<script setup lang="ts">
import { computed } from 'vue';

type BrandIconTone = 'primary' | 'secondary' | 'success';

interface BrandIconBadgeProps {
  icon: string;
  tone?: BrandIconTone;
  size?: number;
  iconSize?: number;
}

const props = withDefaults(defineProps<BrandIconBadgeProps>(), {
  tone: 'primary',
  size: 40,
  iconSize: 20,
});

const backgroundByTone: Record<BrandIconTone, string> = {
  primary: 'linear-gradient(135deg, rgba(var(--v-theme-primary), 0.96) 0%, rgba(var(--v-theme-info), 0.9) 100%)',
  secondary: 'linear-gradient(135deg, rgba(var(--v-theme-secondary), 0.95) 0%, rgba(var(--v-theme-warning), 0.9) 100%)',
  success: 'linear-gradient(135deg, rgba(var(--v-theme-success), 0.95) 0%, rgba(var(--v-theme-primary), 0.88) 100%)',
};

const badgeStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  background: backgroundByTone[props.tone],
}));
</script>

<template>
  <span
    class="brand-icon-badge"
    :style="badgeStyle"
    aria-hidden="true"
  >
    <v-icon
      :icon="icon"
      :size="iconSize"
    />
  </span>
</template>

<style scoped>
.brand-icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  color: #fff;
  box-shadow: 0 10px 20px rgba(var(--v-theme-primary), 0.16);
}
</style>
