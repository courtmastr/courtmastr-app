import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ReviewCard from '@/features/reviews/components/ReviewCard.vue';

describe('ReviewCard', () => {
  it('renders quote metadata without date label', () => {
    const wrapper = mount(ReviewCard, {
      props: {
        review: {
          id: 'review-1',
          status: 'approved',
          rating: 5,
          quote: 'Great tournament flow.',
          displayName: 'Organizer Team',
          organization: 'MCIA',
          source: 'public',
          createdAt: new Date('2026-03-14T00:00:00.000Z'),
          updatedAt: new Date('2026-03-14T00:00:00.000Z'),
        },
      },
      global: {
        stubs: {
          'v-card': {
            template: '<article><slot /></article>',
          },
          'v-card-text': {
            template: '<div><slot /></div>',
          },
          'v-icon': true,
        },
      },
    });

    expect(wrapper.text()).toContain('Organizer Team');
    expect(wrapper.text()).toContain('MCIA');
    expect(wrapper.text()).not.toContain('Mar');
    expect(wrapper.find('.review-card__date').exists()).toBe(false);
  });
});
