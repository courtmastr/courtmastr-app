import { computed, type ComputedRef } from 'vue';
import type {
  Tournament,
  TournamentLogo,
  TournamentSponsor,
  TournamentSponsorRecord,
} from '@/types';

interface UseTournamentBrandingResult {
  normalizedSponsors: ComputedRef<TournamentSponsor[]>;
  sponsorNames: ComputedRef<string[]>;
  tournamentLogo: ComputedRef<TournamentLogo | null>;
  tournamentLogoUrl: ComputedRef<string>;
  hasTournamentLogo: ComputedRef<boolean>;
}

const normalizeSponsorRecord = (
  sponsor: TournamentSponsorRecord,
  index: number
): TournamentSponsor => {
  if (typeof sponsor === 'string') {
    return {
      id: `legacy-${index}`,
      name: sponsor,
      logoUrl: '',
      logoPath: '',
      displayOrder: index,
    };
  }

  return {
    ...sponsor,
    displayOrder: sponsor.displayOrder ?? index,
  };
};

export const useTournamentBranding = (
  tournament: ComputedRef<Tournament | null | undefined>
): UseTournamentBrandingResult => {
  const normalizedSponsors = computed<TournamentSponsor[]>(() => {
    const sponsorRecords = tournament.value?.sponsors ?? [];

    return sponsorRecords
      .map((sponsor, index) => normalizeSponsorRecord(sponsor, index))
      .sort((left, right) => {
        if (left.displayOrder !== right.displayOrder) {
          return left.displayOrder - right.displayOrder;
        }

        return left.name.localeCompare(right.name);
      });
  });

  const sponsorNames = computed<string[]>(() =>
    normalizedSponsors.value.map((sponsor) => sponsor.name)
  );

  const tournamentLogo = computed<TournamentLogo | null>(() =>
    tournament.value?.tournamentLogo ?? null
  );

  const tournamentLogoUrl = computed<string>(() =>
    tournamentLogo.value?.url ?? ''
  );

  const hasTournamentLogo = computed<boolean>(() =>
    tournamentLogoUrl.value.length > 0
  );

  return {
    normalizedSponsors,
    sponsorNames,
    tournamentLogo,
    tournamentLogoUrl,
    hasTournamentLogo,
  };
};
