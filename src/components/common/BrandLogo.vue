<script setup lang="ts">
import { computed } from 'vue';
import lockupLogo from '@/assets/brand/courtmaster-lockup.svg';
import markLogo from '@/assets/brand/courtmaster-mark.svg';
import markWhiteLogo from '@/assets/brand/courtmaster-mark-white.svg';

type BrandLogoVariant = 'lockup' | 'mark' | 'mark-white';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  width?: number;
  height?: number;
  alt?: string;
  decorative?: boolean;
  className?: string;
}

const props = withDefaults(defineProps<BrandLogoProps>(), {
  variant: 'lockup',
  width: 140,
  height: 28,
  alt: 'CourtMastr',
  decorative: false,
  className: '',
});

const logoByVariant: Record<BrandLogoVariant, string> = {
  lockup: lockupLogo,
  mark: markLogo,
  'mark-white': markWhiteLogo,
};

const logoSource = computed(() => logoByVariant[props.variant]);
const computedAlt = computed(() => (props.decorative ? '' : props.alt));
</script>

<template>
  <img
    :src="logoSource"
    :alt="computedAlt"
    :width="width"
    :height="height"
    :class="['brand-logo', className]"
    :aria-hidden="decorative ? 'true' : undefined"
  >
</template>

<style scoped>
.brand-logo {
  display: block;
  width: auto;
  max-width: 100%;
}
</style>
