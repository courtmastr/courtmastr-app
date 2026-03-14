<script setup lang="ts">
import { computed } from 'vue';
import type { ReviewRecord } from '@/types';

interface ReviewCardProps {
  review: ReviewRecord;
  compact?: boolean;
}

const props = withDefaults(defineProps<ReviewCardProps>(), {
  compact: false,
});

const ratingLabel = computed(() => `Rated ${props.review.rating} out of 5`);
const formattedDate = computed(() => {
  if (!props.review.createdAt) return '';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(props.review.createdAt);
});
</script>

<template>
  <v-card
    class="review-card"
    :class="{ 'review-card--compact': compact }"
    elevation="0"
  >
    <v-card-text :class="compact ? 'pa-4' : 'pa-5'">
      <div
        class="review-card__rating"
        :aria-label="ratingLabel"
      >
        <v-icon
          v-for="star in 5"
          :key="star"
          size="16"
          :icon="star <= review.rating ? 'mdi-star' : 'mdi-star-outline'"
        />
      </div>

      <blockquote class="review-card__quote">
        “{{ review.quote }}”
      </blockquote>

      <div class="review-card__meta">
        <p class="review-card__name">
          {{ review.displayName }}
        </p>
        <p
          v-if="review.organization"
          class="review-card__organization"
        >
          {{ review.organization }}
        </p>
        <p
          v-if="formattedDate"
          class="review-card__date"
        >
          {{ formattedDate }}
        </p>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.review-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  border-radius: 18px;
  background: rgba(var(--v-theme-surface), 0.98);
}

.review-card__rating {
  display: inline-flex;
  gap: 2px;
  color: #d97706;
  margin-bottom: 8px;
}

.review-card__quote {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.88);
}

.review-card__meta {
  margin-top: 14px;
}

.review-card__name {
  margin: 0;
  font-weight: 700;
}

.review-card__organization,
.review-card__date {
  margin: 2px 0 0;
  font-size: 0.84rem;
  color: rgba(var(--v-theme-on-surface), 0.65);
}

.review-card--compact .review-card__quote {
  font-size: 0.92rem;
}
</style>
