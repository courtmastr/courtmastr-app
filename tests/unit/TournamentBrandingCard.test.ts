import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TournamentBrandingCard from '@/features/tournaments/components/TournamentBrandingCard.vue';
import type { TournamentSponsor } from '@/types';

describe('TournamentBrandingCard', () => {
  it('blocks adding a twenty-first sponsor', async () => {
    const sponsors: TournamentSponsor[] = Array.from({ length: 20 }, (_, index) => ({
      id: `s${index}`,
      name: `Sponsor ${index}`,
      logoUrl: `https://example.com/${index}.png`,
      logoPath: `tournaments/t1/branding/sponsors/s${index}/${index}.png`,
      displayOrder: index,
    }));

    const wrapper = mount(TournamentBrandingCard, {
      props: {
        tournamentId: 't1',
        sponsors,
        tournamentLogo: null,
      },
      global: {
        stubs: {
          'v-card': { template: '<div><slot /></div>' },
          'v-card-title': { template: '<div><slot /></div>' },
          'v-card-text': { template: '<div><slot /></div>' },
          'v-alert': { template: '<div><slot /></div>' },
          'v-btn': {
            template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
          },
          'v-chip': { template: '<div><slot /></div>' },
          'v-col': { template: '<div><slot /></div>' },
          'v-divider': true,
          'v-file-input': true,
          'v-icon': { template: '<span><slot /></span>' },
          'v-img': true,
          'v-row': { template: '<div><slot /></div>' },
          'v-text-field': true,
        },
      },
    });

    await wrapper.get('[data-testid="add-sponsor"]').trigger('click');

    expect(wrapper.text()).toContain('You can add up to 20 sponsors');
  });
});
