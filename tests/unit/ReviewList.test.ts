import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ReviewList from '@/features/reviews/components/ReviewList.vue';
import type { ReviewRecord } from '@/types';

const createReview = (id: string): ReviewRecord => ({
  id,
  status: 'approved',
  rating: 5,
  quote: `${id} quote`,
  displayName: `${id} name`,
  organization: `${id} org`,
  source: 'public',
  createdAt: new Date('2026-03-14T00:00:00.000Z'),
  updatedAt: new Date('2026-03-14T00:00:00.000Z'),
});

const reviews = [createReview('r1'), createReview('r2')];

describe('ReviewList', () => {
  it('duplicates cards and enables marquee animation in moving mode', () => {
    const wrapper = mount(ReviewList, {
      props: {
        reviews,
        moving: true,
      },
      global: {
        stubs: {
          ReviewCard: {
            template: '<article class="review-card-stub">{{ review.id }}</article>',
            props: ['review', 'compact'],
          },
        },
      },
    });

    expect(wrapper.find('.review-list__marquee').exists()).toBe(true);
    expect(wrapper.find('.review-list__marquee-track--animate').exists()).toBe(true);
    expect(wrapper.findAll('.review-card-stub')).toHaveLength(4);
  });

  it('renders grid mode when moving is disabled', () => {
    const wrapper = mount(ReviewList, {
      props: {
        reviews,
        moving: false,
      },
      global: {
        stubs: {
          ReviewCard: {
            template: '<article class="review-card-stub">{{ review.id }}</article>',
            props: ['review', 'compact'],
          },
        },
      },
    });

    expect(wrapper.find('.review-list__grid').exists()).toBe(true);
    expect(wrapper.find('.review-list__marquee').exists()).toBe(false);
    expect(wrapper.findAll('.review-card-stub')).toHaveLength(2);
  });
});
