import { computed, unref, type MaybeRef } from 'vue';
import {
  aggregateStats,
  applyEliminationStatus,
  matchesToResolvedMatches,
  resolveParticipantName,
  sortWithBWFTiebreaker,
} from '@/composables/useLeaderboard';
import {
  FORMAT_LABELS,
  type Category,
  type LevelDefinition,
  type Match,
  type Player,
  type Registration,
  type Tournament,
} from '@/types';

export interface HallOfChampionsCard {
  key: string;
  categoryId: string;
  categoryName: string;
  formatLabel: string;
  levelId?: string;
  levelLabel: string | null;
  championId: string;
  championName: string;
  runnerUpId: string | null;
  runnerUpName: string | null;
  runnerUpLabel: string;
  victoryLabel: string;
  seasonLabel: string;
  completedAt: Date | null;
}

export interface HallOfChampionsSource {
  tournament: MaybeRef<Tournament | null>;
  categories: MaybeRef<Category[]>;
  matches: MaybeRef<Match[]>;
  registrations: MaybeRef<Registration[]>;
  players: MaybeRef<Player[]>;
  levelDefinitionsByCategory?: MaybeRef<Record<string, LevelDefinition[]>>;
}

const COMPLETED_MATCH_STATUSES = new Set<Match['status']>(['completed', 'walkover']);
const ELIGIBLE_REGISTRATION_STATUSES = new Set<Registration['status']>(['approved', 'checked_in']);

const toReadableLevelLabel = (levelId: string): string => levelId
  .replace(/^level-/i, 'Level ')
  .replace(/[-_]+/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase());

const buildRegistrationNameMap = (
  registrations: Registration[],
  players: Player[],
): Map<string, string> => new Map(
  registrations.map((registration) => [
    registration.id,
    resolveParticipantName(registration, players),
  ]),
);

const resolveLevelLabel = (
  categoryId: string,
  levelId: string | undefined,
  levelDefinitionsByCategory: Record<string, LevelDefinition[]>,
): string | null => {
  if (!levelId) return null;

  const levelDefinition = levelDefinitionsByCategory[categoryId]?.find((level) => level.id === levelId);
  return levelDefinition?.name?.trim() || toReadableLevelLabel(levelId);
};

const resolveLevelOrder = (
  categoryId: string,
  levelId: string | undefined,
  levelDefinitionsByCategory: Record<string, LevelDefinition[]>,
): number => {
  if (!levelId) return 0;

  const levelDefinition = levelDefinitionsByCategory[categoryId]?.find((level) => level.id === levelId);
  return levelDefinition?.order ?? Number.MAX_SAFE_INTEGER;
};

const getSeasonLabel = (tournament: Tournament | null): string => {
  const year = tournament?.startDate instanceof Date && !Number.isNaN(tournament.startDate.getTime())
    ? tournament.startDate.getFullYear()
    : null;

  return year ? `${year} Title Holders` : 'Tournament Title Holders';
};

const getScopedMatches = (categoryMatches: Match[]): Array<{ levelId?: string; matches: Match[] }> => {
  const levelIds = [...new Set(
    categoryMatches
      .map((match) => match.levelId)
      .filter((levelId): levelId is string => Boolean(levelId))
  )];

  if (levelIds.length > 0) {
    return levelIds.map((levelId) => ({
      levelId,
      matches: categoryMatches.filter((match) => match.levelId === levelId),
    }));
  }

  return [{
    matches: categoryMatches.filter((match) => !match.levelId),
  }];
};

const pickDecisiveMatch = (matches: Match[]): Match | null => {
  const completedMatches = matches.filter((match) => (
    COMPLETED_MATCH_STATUSES.has(match.status)
      && Boolean(match.winnerId)
      && Boolean(match.participant1Id)
      && Boolean(match.participant2Id)
  ));

  if (completedMatches.length === 0) return null;

  return [...completedMatches].sort((left, right) => {
    const leftFinals = left.bracketPosition?.bracket === 'finals' ? 1 : 0;
    const rightFinals = right.bracketPosition?.bracket === 'finals' ? 1 : 0;
    if (leftFinals !== rightFinals) return rightFinals - leftFinals;

    if (left.round !== right.round) return right.round - left.round;

    const leftCompletedAt = left.completedAt?.getTime() ?? left.updatedAt.getTime();
    const rightCompletedAt = right.completedAt?.getTime() ?? right.updatedAt.getTime();
    if (leftCompletedAt !== rightCompletedAt) return rightCompletedAt - leftCompletedAt;

    return right.matchNumber - left.matchNumber;
  })[0];
};

const buildEliminationChampion = (input: {
  category: Category;
  matches: Match[];
  registrationNameMap: Map<string, string>;
  tournament: Tournament | null;
  levelDefinitionsByCategory: Record<string, LevelDefinition[]>;
  levelId?: string;
}): HallOfChampionsCard | null => {
  const decisiveMatch = pickDecisiveMatch(input.matches);
  if (!decisiveMatch?.winnerId) return null;

  const runnerUpId = decisiveMatch.winnerId === decisiveMatch.participant1Id
    ? decisiveMatch.participant2Id ?? null
    : decisiveMatch.participant1Id ?? null;

  return {
    key: `${input.category.id}:${input.levelId || 'base'}`,
    categoryId: input.category.id,
    categoryName: input.category.name,
    formatLabel: FORMAT_LABELS[input.category.format],
    levelId: input.levelId,
    levelLabel: resolveLevelLabel(
      input.category.id,
      input.levelId,
      input.levelDefinitionsByCategory,
    ),
    championId: decisiveMatch.winnerId,
    championName: input.registrationNameMap.get(decisiveMatch.winnerId) || 'TBD',
    runnerUpId,
    runnerUpName: runnerUpId ? input.registrationNameMap.get(runnerUpId) || 'TBD' : null,
    runnerUpLabel: 'Finalist',
    victoryLabel: decisiveMatch.bracketPosition?.bracket === 'finals'
      ? 'Won in the title match'
      : `Closed out Round ${decisiveMatch.round}`,
    seasonLabel: getSeasonLabel(input.tournament),
    completedAt: decisiveMatch.completedAt ?? null,
  };
};

const buildRoundRobinChampion = (input: {
  category: Category;
  matches: Match[];
  registrations: Registration[];
  players: Player[];
  tournament: Tournament | null;
}): HallOfChampionsCard | null => {
  if (input.category.status !== 'completed') return null;

  const eligibleRegistrations = input.registrations.filter((registration) => (
    registration.categoryId === input.category.id
      && ELIGIBLE_REGISTRATION_STATUSES.has(registration.status)
  ));
  const resolvedMatches = matchesToResolvedMatches(input.matches);

  if (eligibleRegistrations.length === 0 || resolvedMatches.length === 0) {
    return null;
  }

  const categoryMap = new Map([[input.category.id, input.category]]);
  const statsMap = aggregateStats(
    eligibleRegistrations,
    resolvedMatches,
    categoryMap,
    input.players,
  );

  applyEliminationStatus(statsMap, resolvedMatches, input.category.format);

  const rankedEntries = [...statsMap.values()].filter((entry) => entry.matchesPlayed > 0);
  if (rankedEntries.length === 0) return null;

  const { sorted } = sortWithBWFTiebreaker(rankedEntries, resolvedMatches);
  const champion = sorted[0];
  const runnerUp = sorted[1];

  if (!champion) return null;

  return {
    key: `${input.category.id}:base`,
    categoryId: input.category.id,
    categoryName: input.category.name,
    formatLabel: FORMAT_LABELS[input.category.format],
    levelLabel: null,
    championId: champion.registrationId,
    championName: champion.participantName,
    runnerUpId: runnerUp?.registrationId ?? null,
    runnerUpName: runnerUp?.participantName ?? null,
    runnerUpLabel: 'Second Place',
    victoryLabel: 'Finished first in the final standings',
    seasonLabel: getSeasonLabel(input.tournament),
    completedAt: null,
  };
};

export const buildHallOfChampions = (source: {
  tournament: Tournament | null;
  categories: Category[];
  matches: Match[];
  registrations: Registration[];
  players: Player[];
  levelDefinitionsByCategory?: Record<string, LevelDefinition[]>;
}): HallOfChampionsCard[] => {
  const levelDefinitionsByCategory = source.levelDefinitionsByCategory ?? {};
  const registrationNameMap = buildRegistrationNameMap(source.registrations, source.players);
  const categoryOrderMap = new Map(source.categories.map((category, index) => [category.id, index]));

  const champions = source.categories.flatMap((category) => {
    const categoryMatches = source.matches.filter((match) => match.categoryId === category.id);
    if (categoryMatches.length === 0) return [];

    if (category.format === 'round_robin') {
      const champion = buildRoundRobinChampion({
        category,
        matches: categoryMatches,
        registrations: source.registrations,
        players: source.players,
        tournament: source.tournament,
      });

      return champion ? [champion] : [];
    }

    return getScopedMatches(categoryMatches)
      .map(({ levelId, matches }) => buildEliminationChampion({
        category,
        matches,
        registrationNameMap,
        tournament: source.tournament,
        levelDefinitionsByCategory,
        levelId,
      }))
      .filter((card): card is HallOfChampionsCard => card !== null);
  });

  return champions.sort((left, right) => {
    const leftCategoryOrder = categoryOrderMap.get(left.categoryId) ?? Number.MAX_SAFE_INTEGER;
    const rightCategoryOrder = categoryOrderMap.get(right.categoryId) ?? Number.MAX_SAFE_INTEGER;
    if (leftCategoryOrder !== rightCategoryOrder) {
      return leftCategoryOrder - rightCategoryOrder;
    }

    const leftLevelOrder = resolveLevelOrder(left.categoryId, left.levelId, levelDefinitionsByCategory);
    const rightLevelOrder = resolveLevelOrder(right.categoryId, right.levelId, levelDefinitionsByCategory);
    if (leftLevelOrder !== rightLevelOrder) {
      return leftLevelOrder - rightLevelOrder;
    }

    return left.categoryName.localeCompare(right.categoryName);
  });
};

export const useHallOfChampions = (source: HallOfChampionsSource) => {
  const champions = computed(() => buildHallOfChampions({
    tournament: unref(source.tournament),
    categories: unref(source.categories),
    matches: unref(source.matches),
    registrations: unref(source.registrations),
    players: unref(source.players),
    levelDefinitionsByCategory: source.levelDefinitionsByCategory
      ? unref(source.levelDefinitionsByCategory)
      : undefined,
  }));

  const hasChampions = computed(() => champions.value.length > 0);
  const crownedDivisionCount = computed(() => champions.value.length);
  const crownedCategoryCount = computed(() => new Set(
    champions.value.map((champion) => champion.categoryId)
  ).size);

  return {
    champions,
    hasChampions,
    crownedDivisionCount,
    crownedCategoryCount,
  };
};
