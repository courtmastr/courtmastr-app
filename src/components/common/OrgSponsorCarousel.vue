<script setup lang="ts">
import { computed, ref } from 'vue';
import type { OrgSponsor } from '@/types';

const props = defineProps<{
  sponsors: OrgSponsor[];
}>();

const failedLogos = ref<Set<string>>(new Set());

const sorted = computed(() =>
  [...props.sponsors].sort((a, b) => a.displayOrder - b.displayOrder)
);

// Duplicate for seamless infinite scroll
const items = computed(() => [...sorted.value, ...sorted.value]);

const onLogoError = (id: string) => {
  failedLogos.value = new Set([...failedLogos.value, id]);
};
</script>

<template>
  <section
    v-if="sponsors.length"
    class="org-sponsor-carousel"
  >
    <p class="org-sponsor-carousel__label">
      OUR SPONSORS
    </p>
    <div class="org-sponsor-carousel__track-wrap">
      <div class="org-sponsor-carousel__track">
        <component
          :is="item.website ? 'a' : 'div'"
          v-for="(item, i) in items"
          :key="`${item.id}-${i}`"
          :href="item.website || undefined"
          :target="item.website ? '_blank' : undefined"
          :rel="item.website ? 'noopener noreferrer' : undefined"
          class="org-sponsor-carousel__item"
          :class="{ 'org-sponsor-carousel__item--linked': !!item.website }"
          :aria-label="item.website ? `${item.name} (opens in new tab)` : item.name"
        >
          <img
            v-if="!failedLogos.has(item.id)"
            :src="item.logoUrl"
            :alt="item.name"
            class="org-sponsor-carousel__logo"
            loading="lazy"
            @error="onLogoError(item.id)"
          >
          <span
            v-else
            class="org-sponsor-carousel__name-fallback"
          >{{ item.name }}</span>
        </component>
      </div>
    </div>
  </section>
</template>

<style scoped>
.org-sponsor-carousel {
  background: #0B1120;
  border-top: 1px solid #1E293B;
  padding: 32px 0;
  overflow: hidden;
}

.org-sponsor-carousel__label {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #475569;
  text-transform: uppercase;
  margin-bottom: 20px;
}

.org-sponsor-carousel__track-wrap {
  overflow: hidden;
  /* fade edges */
  mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
}

.org-sponsor-carousel__track {
  display: flex;
  gap: 20px;
  width: max-content;
  animation: orgCarouselScroll 30s linear infinite;
}

.org-sponsor-carousel__track:hover {
  animation-play-state: paused;
}

@keyframes orgCarouselScroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

@media (prefers-reduced-motion: reduce) {
  .org-sponsor-carousel__track {
    animation: none;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
    padding: 0 24px;
  }
}

.org-sponsor-carousel__item {
  flex-shrink: 0;
  width: 160px;
  height: 80px;
  background: #1E293B;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  transition: border-color 200ms ease, background 200ms ease;
}

.org-sponsor-carousel__item--linked:hover,
.org-sponsor-carousel__item--linked:focus-visible {
  border-color: #3B82F6;
  background: #1E2D45;
  outline: none;
}
.org-sponsor-carousel__item--linked:focus-visible {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}

.org-sponsor-carousel__logo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  filter: brightness(0) invert(1);
  opacity: 0.7;
  transition: opacity 200ms ease;
}

.org-sponsor-carousel__item--linked:hover .org-sponsor-carousel__logo,
.org-sponsor-carousel__item--linked:focus-visible .org-sponsor-carousel__logo {
  opacity: 1;
}

.org-sponsor-carousel__name-fallback {
  font-size: 0.85rem;
  font-weight: 700;
  color: #64748B;
  text-align: center;
  line-height: 1.3;
  letter-spacing: 0.02em;
}
</style>
