import { functions, httpsCallable } from '@/services/firebase';
import type { SubmitReviewPayload, SubmitReviewResponse } from '@/types';

const submitReviewCallable = httpsCallable<SubmitReviewPayload, SubmitReviewResponse>(
  functions,
  'submitReview'
);

export const submitReview = async (
  payload: SubmitReviewPayload
): Promise<SubmitReviewResponse> => {
  const response = await submitReviewCallable(payload);
  return response.data;
};
