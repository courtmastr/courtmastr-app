import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ReviewFloatingCta from '@/features/reviews/components/ReviewFloatingCta.vue';

describe('ReviewFloatingCta', () => {
  it('renders floating CTA with accessible label', () => {
    const wrapper = mount(ReviewFloatingCta, {
      global: {
        stubs: {
          'v-btn': {
            template: '<button v-bind="$attrs"><slot /></button>',
          },
        },
      },
    });

    const button = wrapper.get('button[aria-label="Leave a review"]');
    expect(button).toBeTruthy();
    expect(button.text()).toContain('Share Feedback');
  });
});
