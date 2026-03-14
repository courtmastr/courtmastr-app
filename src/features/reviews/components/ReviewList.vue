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
}

const props = withDefaults(defineProps<ReviewListProps>(), {
  title: 'Community Reviews',
  emptyMessage: 'No approved reviews yet.',
  compact: false,
  maxItems: 6,
});

const visibleReviews = computed(() => props.reviews.slice(0, props.maxItems));
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
</style>
