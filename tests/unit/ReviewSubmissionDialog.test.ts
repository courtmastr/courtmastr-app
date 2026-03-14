import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import ReviewSubmissionDialog from '@/features/reviews/components/ReviewSubmissionDialog.vue';

const runtime = {
  isAuthenticated: false,
  displayName: 'Test User',
};

const mockDeps = vi.hoisted(() => ({
  submitReview: vi.fn(),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: runtime.isAuthenticated,
    currentUser: {
      id: 'u1',
      displayName: runtime.displayName,
    },
  }),
}));

vi.mock('@/stores/reviews', () => ({
  useReviewStore: () => ({
    submitting: false,
    submitReview: mockDeps.submitReview,
  }),
}));

const mountView = () => shallowMount(ReviewSubmissionDialog, {
  props: {
    modelValue: true,
    tournamentId: 't1',
    tournamentName: 'Spring Open',
  },
  global: {
    renderStubDefaultSlot: true,
    stubs: [
      'v-dialog',
      'v-card',
      'v-card-title',
      'v-card-text',
      'v-card-actions',
      'v-select',
      'v-text-field',
      'v-textarea',
      'v-spacer',
      'v-btn',
    ],
  },
});

describe('ReviewSubmissionDialog', () => {
  beforeEach(() => {
    runtime.isAuthenticated = false;
    runtime.displayName = 'Test User';
    mockDeps.submitReview.mockReset().mockResolvedValue({
      success: true,
      reviewId: 'review-1',
      status: 'pending',
    });
  });

  it('validates required fields before submit', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as {
      submit: () => Promise<void>;
      errorMessage: string;
    };

    await vm.submit();

    expect(vm.errorMessage).toContain('Please enter your name.');
    expect(mockDeps.submitReview).not.toHaveBeenCalled();
  });

  it('submits review payload when inputs are valid', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as {
      rating: number;
      displayName: string;
      quote: string;
      organization: string;
      submit: () => Promise<void>;
    };

    vm.rating = 5;
    vm.displayName = 'Alex Organizer';
    vm.quote = 'Great event and smooth schedule management.';
    vm.organization = 'MCIA';

    await vm.submit();

    expect(mockDeps.submitReview).toHaveBeenCalledWith(
      expect.objectContaining({
        rating: 5,
        source: 'public',
        tournamentId: 't1',
      })
    );
  });
});
