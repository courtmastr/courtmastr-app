import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  addDoc,
  collection,
  db,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@/services/firebase';
import { submitReview as submitReviewCallable } from '@/services/reviewsService';
import type {
  ReviewRecord,
  ReviewStatus,
  SubmitReviewPayload,
  SubmitReviewResponse,
} from '@/types';
import { convertTimestamps } from '@/utils/firestore';
import { logger } from '@/utils/logger';

interface ReviewSubscriptionOptions {
  tournamentId?: string;
  featuredOnly?: boolean;
  limitCount?: number;
}

const toReviewRecord = (id: string, data: Record<string, unknown>): ReviewRecord => ({
  id,
  ...convertTimestamps(data),
}) as ReviewRecord;

export const useReviewStore = defineStore('reviews', () => {
  const pendingReviews = ref<ReviewRecord[]>([]);
  const approvedReviews = ref<ReviewRecord[]>([]);
  const rejectedReviews = ref<ReviewRecord[]>([]);
  const loading = ref(false);
  const submitting = ref(false);
  const error = ref<string | null>(null);

  let approvedUnsubscribe: (() => void) | null = null;
  let pendingUnsubscribe: (() => void) | null = null;
  let rejectedUnsubscribe: (() => void) | null = null;

  const featuredReviews = computed(() =>
    approvedReviews.value.filter((review) => review.isFeatured === true)
  );

  const totalPending = computed(() => pendingReviews.value.length);

  const unsubscribeApprovedReviews = (): void => {
    if (approvedUnsubscribe) {
      approvedUnsubscribe();
      approvedUnsubscribe = null;
    }
  };

  const unsubscribeModerationQueues = (): void => {
    if (pendingUnsubscribe) {
      pendingUnsubscribe();
      pendingUnsubscribe = null;
    }
    if (rejectedUnsubscribe) {
      rejectedUnsubscribe();
      rejectedUnsubscribe = null;
    }
  };

  const unsubscribeAll = (): void => {
    unsubscribeApprovedReviews();
    unsubscribeModerationQueues();
  };

  const subscribeApprovedReviews = (options: ReviewSubscriptionOptions = {}): void => {
    unsubscribeApprovedReviews();

    const constraints: Array<
      ReturnType<typeof where> | ReturnType<typeof orderBy> | ReturnType<typeof limit>
    > = [
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc'),
    ];

    if (options.tournamentId) {
      constraints.push(where('tournamentId', '==', options.tournamentId));
    }

    if (options.featuredOnly) {
      constraints.push(where('isFeatured', '==', true));
    }

    if (options.limitCount && options.limitCount > 0) {
      constraints.push(limit(options.limitCount));
    }

    loading.value = true;
    error.value = null;

    approvedUnsubscribe = onSnapshot(
      query(collection(db, 'reviews'), ...constraints),
      (snapshot) => {
        approvedReviews.value = snapshot.docs.map((reviewDoc) =>
          toReviewRecord(reviewDoc.id, reviewDoc.data())
        );
        loading.value = false;
      },
      (err) => {
        logger.error('Error subscribing approved reviews:', err);
        error.value = 'Unable to load approved reviews.';
        loading.value = false;
      }
    );
  };

  const subscribeModerationQueues = (): void => {
    unsubscribeModerationQueues();
    error.value = null;

    pendingUnsubscribe = onSnapshot(
      query(
        collection(db, 'reviews'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        pendingReviews.value = snapshot.docs.map((reviewDoc) =>
          toReviewRecord(reviewDoc.id, reviewDoc.data())
        );
      },
      (err) => {
        logger.error('Error subscribing pending reviews:', err);
        error.value = 'Unable to load pending reviews.';
      }
    );

    rejectedUnsubscribe = onSnapshot(
      query(
        collection(db, 'reviews'),
        where('status', '==', 'rejected'),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        rejectedReviews.value = snapshot.docs.map((reviewDoc) =>
          toReviewRecord(reviewDoc.id, reviewDoc.data())
        );
      },
      (err) => {
        logger.error('Error subscribing rejected reviews:', err);
        error.value = 'Unable to load rejected reviews.';
      }
    );
  };

  const submitReview = async (
    payload: SubmitReviewPayload
  ): Promise<SubmitReviewResponse> => {
    submitting.value = true;
    error.value = null;
    try {
      return await submitReviewCallable(payload);
    } catch (err) {
      logger.error('Error submitting review:', err);
      error.value = 'Failed to submit review.';
      throw err;
    } finally {
      submitting.value = false;
    }
  };

  const moderateReview = async (
    reviewId: string,
    status: Exclude<ReviewStatus, 'pending'>,
    options: {
      moderationNote?: string;
      isFeatured?: boolean;
      moderatedByUserId?: string;
    } = {}
  ): Promise<void> => {
    const payload: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
      moderatedAt: serverTimestamp(),
      isFeatured: options.isFeatured ?? false,
    };

    if (options.moderatedByUserId) {
      payload.moderatedByUserId = options.moderatedByUserId;
    }
    if (options.moderationNote) {
      payload.moderationNote = options.moderationNote.trim();
    }

    await updateDoc(doc(db, 'reviews', reviewId), payload);
  };

  const setFeatured = async (
    reviewId: string,
    isFeatured: boolean,
    moderatedByUserId?: string
  ): Promise<void> => {
    const payload: Record<string, unknown> = {
      isFeatured,
      updatedAt: serverTimestamp(),
    };

    if (moderatedByUserId) {
      payload.moderatedByUserId = moderatedByUserId;
      payload.moderatedAt = serverTimestamp();
    }

    await updateDoc(doc(db, 'reviews', reviewId), payload);
  };

  const addReviewFallback = async (review: Omit<ReviewRecord, 'id'>): Promise<void> => {
    await addDoc(collection(db, 'reviews'), {
      ...review,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  return {
    pendingReviews,
    approvedReviews,
    rejectedReviews,
    featuredReviews,
    loading,
    submitting,
    error,
    totalPending,
    subscribeApprovedReviews,
    subscribeModerationQueues,
    submitReview,
    moderateReview,
    setFeatured,
    addReviewFallback,
    unsubscribeApprovedReviews,
    unsubscribeModerationQueues,
    unsubscribeAll,
  };
});
