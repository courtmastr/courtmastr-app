import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useTournamentBranding } from '@/composables/useTournamentBranding';

describe('useTournamentBranding', () => {
  it('normalizes legacy string sponsors and sorts structured sponsors by display order', () => {
    const tournament = ref({
      id: 't1',
      name: 'Spring Open',
      sponsors: [
        'Legacy Sponsor',
        {
          id: 's2',
          name: 'B Sponsor',
          logoUrl: 'https://example.com/b.png',
          logoPath: 'tournaments/t1/branding/sponsors/s2/b.png',
          displayOrder: 2,
        },
        {
          id: 's1',
          name: 'A Sponsor',
          logoUrl: 'https://example.com/a.png',
          logoPath: 'tournaments/t1/branding/sponsors/s1/a.png',
          displayOrder: 1,
        },
      ],
      tournamentLogo: {
        url: 'https://example.com/logo.png',
        storagePath: 'tournaments/t1/branding/logo/logo.png',
      },
    });

    const { normalizedSponsors, sponsorNames, tournamentLogoUrl } = useTournamentBranding(
      computed(() => tournament.value as never)
    );

    expect(normalizedSponsors.value.map((item) => item.name)).toEqual([
      'Legacy Sponsor',
      'A Sponsor',
      'B Sponsor',
    ]);
    expect(sponsorNames.value).toEqual([
      'Legacy Sponsor',
      'A Sponsor',
      'B Sponsor',
    ]);
    expect(tournamentLogoUrl.value).toBe('https://example.com/logo.png');
  });
});
