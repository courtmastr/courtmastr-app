<script setup lang="ts">
import ReviewList from '@/features/reviews/components/ReviewList.vue';
import type { ReviewRecord } from '@/types';

interface PublicTrustReviewsSectionProps {
  reviews: ReviewRecord[];
  fallbackMarker?: string;
}

withDefaults(defineProps<PublicTrustReviewsSectionProps>(), {
  fallbackMarker: '',
});

defineEmits<{
  leaveReview: [];
}>();
</script>

<template>
  <section class="public-trust-reviews">
    <div class="public-trust-reviews__intro">
      <p class="text-overline public-trust-reviews__eyebrow mb-1">
        Community Voices
      </p>
      <h2 class="public-trust-reviews__title">
        Trusted by clubs and associations running live tournament days.
      </h2>
      <p class="public-trust-reviews__subtitle">
        {{ fallbackMarker || 'Only approved reviews are shown publicly.' }}
      </p>
      <v-btn
        variant="outlined"
        class="mt-2"
        @click="$emit('leaveReview')"
      >
        Leave a Review
      </v-btn>
    </div>

    <ReviewList
      :reviews="reviews"
      title="Community Voices"
      empty-message="No approved reviews yet. Be the first to leave feedback."
      :max-items="3"
      moving
      compact
    />
  </section>
</template>

<style scoped>
.public-trust-reviews {
  display: grid;
  gap: 16px;
}

.public-trust-reviews__intro {
  max-width: 760px;
}

.public-trust-reviews__eyebrow {
  letter-spacing: 0.14em;
  color: rgba(var(--v-theme-primary), 0.9);
}

.public-trust-reviews__title {
  margin: 0;
  font-family: 'Barlow Condensed', 'Avenir Next Condensed', sans-serif;
  font-size: clamp(1.7rem, 3vw, 2.3rem);
  line-height: 0.98;
}

.public-trust-reviews__subtitle {
  margin: 10px 0 0;
  color: rgba(var(--v-theme-on-surface), 0.68);
  text-wrap: pretty;
}
</style>
