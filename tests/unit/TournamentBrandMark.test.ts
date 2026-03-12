import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TournamentBrandMark from '@/components/common/TournamentBrandMark.vue';

describe('TournamentBrandMark', () => {
  it('renders the tournament logo when a logo URL is provided', () => {
    const wrapper = mount(TournamentBrandMark, {
      props: {
        tournamentName: 'Spring Open',
        logoUrl: 'https://example.com/logo.png',
      },
      global: {
        stubs: {
          'v-img': {
            props: ['src', 'alt'],
            template: '<img :src="src" :alt="alt">',
          },
          'v-icon': {
            props: ['icon'],
            template: '<span>{{ icon }}</span>',
          },
        },
      },
    });

    const image = wrapper.get('img');
    expect(image.attributes('src')).toBe('https://example.com/logo.png');
    expect(image.attributes('alt')).toBe('Spring Open logo');
  });

  it('falls back to the configured icon when no logo is available', () => {
    const wrapper = mount(TournamentBrandMark, {
      props: {
        tournamentName: 'Spring Open',
        fallbackIcon: 'mdi-badminton',
      },
      global: {
        stubs: {
          'v-img': {
            props: ['src', 'alt'],
            template: '<img :src="src" :alt="alt">',
          },
          'v-icon': {
            props: ['icon'],
            template: '<span>{{ icon }}</span>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('mdi-badminton');
    expect(wrapper.find('img').exists()).toBe(false);
  });
});
