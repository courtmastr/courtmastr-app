import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDeps = vi.hoisted(() => ({
  callableFactory: vi.fn(),
  callableInvoke: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  functions: { __mock: true },
  httpsCallable: mockDeps.callableFactory,
}));

describe('reviewsService', () => {
  beforeEach(() => {
    mockDeps.callableFactory.mockReset();
    mockDeps.callableInvoke.mockReset();
    mockDeps.callableFactory.mockReturnValue(mockDeps.callableInvoke);
  });

  it('submits review payload through submitReview callable', async () => {
    const { submitReview } = await import('@/services/reviewsService');

    mockDeps.callableInvoke.mockResolvedValue({
      data: {
        success: true,
        reviewId: 'review-1',
        status: 'pending',
      },
    });

    await submitReview({
      quote: 'Great event flow and clear scheduling.',
      rating: 5,
      displayName: 'Alex Organizer',
      source: 'public',
    });

    expect(mockDeps.callableFactory).toHaveBeenCalledWith(
      { __mock: true },
      'submitReview'
    );
    expect(mockDeps.callableInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 5, source: 'public' })
    );
  });
});
