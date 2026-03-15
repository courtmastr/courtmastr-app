<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useReviewStore } from '@/stores/reviews';
import type { ReviewRecord, ReviewStatus } from '@/types';
import { NAVIGATION_ICONS } from '@/constants/navigationIcons';

type ModerationFilter = ReviewStatus;

const authStore = useAuthStore();
const reviewStore = useReviewStore();
const activeFilter = ref<ModerationFilter>('pending');
const moderationNote = ref<Record<string, string>>({});
const updatingReviewId = ref<string | null>(null);

const queueByFilter = computed<Record<ModerationFilter, ReviewRecord[]>>(() => ({
  pending: reviewStore.pendingReviews,
  approved: reviewStore.approvedReviews,
  rejected: reviewStore.rejectedReviews,
}));

const filteredReviews = computed(() => queueByFilter.value[activeFilter.value]);

const setFilter = (value: ModerationFilter): void => {
  activeFilter.value = value;
};

const formatDate = (value: Date | undefined): string => {
  if (!value) return 'Unknown';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(value);
};

const moderate = async (
  reviewId: string,
  status: Exclude<ReviewStatus, 'pending'>
): Promise<void> => {
  if (updatingReviewId.value) return;

  updatingReviewId.value = reviewId;
  try {
    await reviewStore.moderateReview(reviewId, status, {
      moderationNote: moderationNote.value[reviewId]?.trim(),
      moderatedByUserId: authStore.currentUser?.id,
      isFeatured: false,
    });
  } finally {
    updatingReviewId.value = null;
  }
};

const toggleFeatured = async (review: ReviewRecord): Promise<void> => {
  if (updatingReviewId.value) return;

  updatingReviewId.value = review.id;
  try {
    await reviewStore.setFeatured(
      review.id,
      !review.isFeatured,
      authStore.currentUser?.id
    );
  } finally {
    updatingReviewId.value = null;
  }
};

onMounted(() => {
  reviewStore.subscribeApprovedReviews({ limitCount: 100 });
  reviewStore.subscribeModerationQueues();
});

onUnmounted(() => {
  reviewStore.unsubscribeAll();
});
</script>

<template>
  <v-container class="py-8 admin-reviews">
    <v-row justify="center">
      <v-col
        cols="12"
        xl="10"
      >
        <v-card
          class="pa-5 pa-md-6"
          elevation="0"
        >
          <div class="d-flex flex-wrap justify-space-between align-center ga-3 mb-5">
            <div>
              <p class="text-overline admin-reviews__eyebrow mb-1">
                Webapp Admin
              </p>
              <h1 class="text-h4 mb-1 d-flex align-center ga-2">
                <v-icon :icon="NAVIGATION_ICONS.reviewModeration" size="26" color="secondary" />
                Review Moderation
              </h1>
              <p class="text-body-2 text-medium-emphasis mb-0">
                Manage pending public reviews and curate approved testimonials.
              </p>
            </div>
            <v-chip
              color="primary"
              variant="tonal"
              label
            >
              {{ reviewStore.totalPending }} pending
            </v-chip>
          </div>

          <div class="d-flex flex-wrap ga-2 mb-5">
            <v-btn
              :variant="activeFilter === 'pending' ? 'flat' : 'outlined'"
              :color="activeFilter === 'pending' ? 'primary' : undefined"
              @click="setFilter('pending')"
            >
              Pending
            </v-btn>
            <v-btn
              :variant="activeFilter === 'approved' ? 'flat' : 'outlined'"
              :color="activeFilter === 'approved' ? 'primary' : undefined"
              @click="setFilter('approved')"
            >
              Approved
            </v-btn>
            <v-btn
              :variant="activeFilter === 'rejected' ? 'flat' : 'outlined'"
              :color="activeFilter === 'rejected' ? 'primary' : undefined"
              @click="setFilter('rejected')"
            >
              Rejected
            </v-btn>
          </div>

          <v-alert
            v-if="reviewStore.error"
            type="error"
            variant="tonal"
            class="mb-4"
          >
            {{ reviewStore.error }}
          </v-alert>

          <v-alert
            v-if="filteredReviews.length === 0"
            type="info"
            variant="tonal"
          >
            No reviews in this queue.
          </v-alert>

          <div
            v-for="review in filteredReviews"
            :key="review.id"
            class="mb-4"
          >
            <v-card
              class="admin-reviews__item"
              elevation="0"
            >
              <v-card-text class="pa-4">
                <div class="d-flex flex-wrap justify-space-between align-start ga-3">
                  <div>
                    <p class="mb-1 text-subtitle-1 font-weight-bold">
                      {{ review.displayName }}
                      <span
                        v-if="review.organization"
                        class="text-body-2 text-medium-emphasis"
                      >
                        · {{ review.organization }}
                      </span>
                    </p>
                    <p class="text-caption text-medium-emphasis mb-2">
                      {{ review.source }} · {{ formatDate(review.createdAt) }}
                    </p>
                    <p class="mb-0">
                      “{{ review.quote }}”
                    </p>
                  </div>
                  <v-chip
                    size="small"
                    variant="tonal"
                    color="amber-darken-2"
                  >
                    {{ review.rating }} / 5
                  </v-chip>
                </div>

                <v-text-field
                  v-if="activeFilter === 'pending'"
                  v-model="moderationNote[review.id]"
                  label="Moderation Note (optional)"
                  variant="outlined"
                  density="comfortable"
                  class="mt-4"
                />

                <div class="d-flex flex-wrap ga-2 mt-2">
                  <v-btn
                    v-if="activeFilter === 'pending'"
                    color="success"
                    :loading="updatingReviewId === review.id"
                    @click="moderate(review.id, 'approved')"
                  >
                    Approve
                  </v-btn>
                  <v-btn
                    v-if="activeFilter === 'pending'"
                    color="error"
                    variant="outlined"
                    :loading="updatingReviewId === review.id"
                    @click="moderate(review.id, 'rejected')"
                  >
                    Reject
                  </v-btn>

                  <v-btn
                    v-if="activeFilter === 'approved'"
                    variant="outlined"
                    :loading="updatingReviewId === review.id"
                    @click="toggleFeatured(review)"
                  >
                    {{ review.isFeatured ? 'Unfeature' : 'Feature on Home' }}
                  </v-btn>
                </div>
              </v-card-text>
            </v-card>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.admin-reviews__eyebrow {
  letter-spacing: 0.14em;
  color: rgba(var(--v-theme-primary), 0.9);
}

.admin-reviews__item {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.09);
  border-radius: 14px;
}
</style>
