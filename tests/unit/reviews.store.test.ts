import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '@/stores/reviews';

describe('useReviewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes empty review queues', () => {
    const store = useReviewStore();

    expect(store.pendingReviews).toEqual([]);
    expect(store.approvedReviews).toEqual([]);
    expect(store.rejectedReviews).toEqual([]);
    expect(store.totalPending).toBe(0);
  });
});
