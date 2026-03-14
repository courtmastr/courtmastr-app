<script setup lang="ts">
import { computed } from 'vue';
import ReviewCard from '@/features/reviews/components/ReviewCard.vue';
import type { ReviewRecord } from '@/types';

interface ReviewListProps {
  reviews: ReviewRecord[];
  title?: string;
  emptyMessage?: string;
  compact?: boolean;
  maxItems?: number;
  moving?: boolean;
}

const props = withDefaults(defineProps<ReviewListProps>(), {
  title: 'Community Reviews',
  emptyMessage: 'No approved reviews yet.',
  compact: false,
  maxItems: 6,
  moving: false,
});

const visibleReviews = computed(() => props.reviews.slice(0, props.maxItems));
const shouldAnimate = computed(() => props.moving && visibleReviews.value.length > 1);
const marqueeReviews = computed(() => {
  if (!props.moving) return visibleReviews.value;
  return shouldAnimate.value
    ? [...visibleReviews.value, ...visibleReviews.value]
    : visibleReviews.value;
});
</script>

<template>
  <section class="review-list">
    <header class="review-list__header">
      <h2 class="review-list__title">
        {{ title }}
      </h2>
    </header>

    <p
      v-if="visibleReviews.length === 0"
      class="review-list__empty text-medium-emphasis"
      role="status"
    >
      {{ emptyMessage }}
    </p>

    <div
      v-else-if="moving"
      class="review-list__marquee"
      aria-live="polite"
    >
      <div
        class="review-list__marquee-track"
        :class="{ 'review-list__marquee-track--animate': shouldAnimate }"
      >
        <div
          v-for="(review, index) in marqueeReviews"
          :key="`${review.id}-${index}`"
          class="review-list__marquee-item"
          :aria-hidden="shouldAnimate && index >= visibleReviews.length ? 'true' : 'false'"
        >
          <ReviewCard
            :review="review"
            :compact="compact"
          />
        </div>
      </div>
    </div>

    <div
      v-else
      class="review-list__grid"
      :class="{ 'review-list__grid--compact': compact }"
    >
      <ReviewCard
        v-for="review in visibleReviews"
        :key="review.id"
        :review="review"
        :compact="compact"
      />
    </div>
  </section>
</template>

<style scoped>
.review-list {
  display: grid;
  gap: 16px;
}

.review-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.review-list__title {
  margin: 0;
  font-family: 'Barlow Condensed', 'Avenir Next Condensed', sans-serif;
  font-size: clamp(1.5rem, 3vw, 2rem);
  line-height: 1;
}

.review-list__empty {
  margin: 0;
  font-size: 0.95rem;
}

.review-list__grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.review-list__grid--compact {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.review-list__marquee {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 16px;
  padding: 12px;
  background: rgba(var(--v-theme-surface), 0.94);
}

.review-list__marquee-track {
  display: flex;
  gap: 12px;
  width: max-content;
}

.review-list__marquee-track--animate {
  animation: review-marquee 36s linear infinite;
}

.review-list__marquee:hover .review-list__marquee-track--animate {
  animation-play-state: paused;
}

.review-list__marquee-item {
  flex: 0 0 min(320px, calc(100vw - 64px));
}

.review-list__marquee-item :deep(.review-card) {
  height: 100%;
}

@keyframes review-marquee {
  from {
    transform: translateX(0);
  }

  to {
    transform: translateX(calc(-50% - 6px));
  }
}

@media (prefers-reduced-motion: reduce) {
  .review-list__marquee-track--animate {
    animation: none;
  }

  .review-list__marquee {
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }

  .review-list__marquee-item {
    scroll-snap-align: start;
  }
}
</style>
