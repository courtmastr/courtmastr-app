import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import type { ReviewRecord } from '@/types';
import AdminReviewsView from '@/features/reviews/views/AdminReviewsView.vue';

const runtime = {
  pendingReviews: [] as ReviewRecord[],
  approvedReviews: [] as ReviewRecord[],
  rejectedReviews: [] as ReviewRecord[],
  error: null as string | null,
};

const mockDeps = vi.hoisted(() => ({
  subscribeApprovedReviews: vi.fn(),
  subscribeModerationQueues: vi.fn(),
  moderateReview: vi.fn(),
  setFeatured: vi.fn(),
  unsubscribeAll: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: {
      id: 'admin-1',
      role: 'admin',
    },
  }),
}));

vi.mock('@/stores/reviews', () => ({
  useReviewStore: () => ({
    pendingReviews: runtime.pendingReviews,
    approvedReviews: runtime.approvedReviews,
    rejectedReviews: runtime.rejectedReviews,
    totalPending: runtime.pendingReviews.length,
    error: runtime.error,
    subscribeApprovedReviews: mockDeps.subscribeApprovedReviews,
    subscribeModerationQueues: mockDeps.subscribeModerationQueues,
    moderateReview: mockDeps.moderateReview,
    setFeatured: mockDeps.setFeatured,
    unsubscribeAll: mockDeps.unsubscribeAll,
  }),
}));

const buildReview = (id: string): ReviewRecord => ({
  id,
  status: 'pending',
  rating: 5,
  quote: 'Great event flow and player communication.',
  displayName: 'Alex Organizer',
  organization: 'MCIA',
  source: 'public',
  createdAt: new Date('2026-03-14T00:00:00.000Z'),
  updatedAt: new Date('2026-03-14T00:00:00.000Z'),
});

const mountView = () => shallowMount(AdminReviewsView, {
  global: {
    renderStubDefaultSlot: true,
    stubs: [
      'v-container',
      'v-row',
      'v-col',
      'v-card',
      'v-card-text',
      'v-alert',
      'v-chip',
      'v-btn',
      'v-text-field',
    ],
  },
});

describe('AdminReviewsView', () => {
  beforeEach(() => {
    runtime.pendingReviews = [buildReview('r1')];
    runtime.approvedReviews = [];
    runtime.rejectedReviews = [];
    runtime.error = null;

    mockDeps.subscribeApprovedReviews.mockReset();
    mockDeps.subscribeModerationQueues.mockReset();
    mockDeps.moderateReview.mockReset().mockResolvedValue(undefined);
    mockDeps.setFeatured.mockReset().mockResolvedValue(undefined);
    mockDeps.unsubscribeAll.mockReset();
  });

  it('subscribes moderation queues on mount', () => {
    mountView();

    expect(mockDeps.subscribeApprovedReviews).toHaveBeenCalledWith({ limitCount: 100 });
    expect(mockDeps.subscribeModerationQueues).toHaveBeenCalledTimes(1);
  });

  it('approves a pending review from action buttons', async () => {
    const wrapper = mountView();
    await flushPromises();

    const approveButton = wrapper
      .findAll('v-btn-stub')
      .find((button) => button.text().trim() === 'Approve');
    expect(approveButton).toBeTruthy();
    await approveButton?.trigger('click');
    await flushPromises();

    expect(mockDeps.moderateReview).toHaveBeenCalledWith(
      'r1',
      'approved',
      expect.objectContaining({ moderatedByUserId: 'admin-1' })
    );
  });
});
