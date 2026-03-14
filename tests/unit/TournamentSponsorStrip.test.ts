import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TournamentSponsorStrip from '@/components/common/TournamentSponsorStrip.vue';
import type { TournamentSponsor } from '@/types';

describe('TournamentSponsorStrip', () => {
  it('renders sponsor links for sponsors with websites and text fallbacks when logos are missing', () => {
    const sponsors: TournamentSponsor[] = [
      {
        id: 's1',
        name: 'Ace Sports',
        logoUrl: 'https://example.com/ace.png',
        logoPath: 'tournaments/t1/branding/sponsors/s1/ace.png',
        website: 'https://acesports.example.com',
        displayOrder: 0,
      },
      {
        id: 's2',
        name: 'Shuttle House',
        logoUrl: '',
        logoPath: '',
        displayOrder: 1,
      },
    ];

    const wrapper = mount(TournamentSponsorStrip, {
      props: { sponsors },
      global: {
        stubs: {
          'v-img': {
            props: ['src', 'alt'],
            template: '<img :src="src" :alt="alt">',
          },
        },
      },
    });

    const sponsorLink = wrapper.get('a');
    expect(sponsorLink.attributes('href')).toBe('https://acesports.example.com');
    expect(wrapper.get('img').attributes('src')).toBe('https://example.com/ace.png');
    expect(wrapper.text()).toContain('Shuttle House');
  });
});
