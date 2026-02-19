import { computed, type ComputedRef } from 'vue';
import type { Category, Match } from '@/types';

export interface CategoryStageStatus {
  categoryId: string;
  categoryName: string;
  stageLabel: string;
  nextMatchLabel: string;
  total: number;
  completed: number;
  remaining: number;
  live: number;
  upcoming: number;
  nextRound: number | null;
}

const FINISHED_MATCH_STATUSES = new Set<Match['status']>(['completed', 'walkover', 'cancelled']);

function isFinishedMatchStatus(status: Match['status']): boolean {
  return FINISHED_MATCH_STATUSES.has(status);
}

function hasAssignedParticipants(match: Match): boolean {
  return Boolean(match.participant1Id && match.participant2Id);
}

function formatMatchLabel(
  match: Match | undefined,
  getParticipantName: (id: string | undefined) => string
): string {
  if (!match) return '-';
  const p1 = getParticipantName(match.participant1Id);
  const p2 = getParticipantName(match.participant2Id);
  return `${p1} vs ${p2}`;
}

function getStageLabel(
  category: Category,
  categoryMatches: Match[],
  remainingMatches: Match[],
  nextRound: number | null
): string {
  if (categoryMatches.length === 0) {
    return 'Not Started';
  }
  if (remainingMatches.length === 0) {
    return 'Completed';
  }

  const rounds = categoryMatches.map((match) => match.round).filter((round) => round > 0);
  const maxRound = rounds.length > 0 ? Math.max(...rounds) : null;
  const finalsRemaining = remainingMatches.some(
    (match) => match.bracketPosition?.bracket === 'finals'
  );

  if (category.format === 'pool_to_elimination') {
    if (category.poolPhase === 'pool') {
      return nextRound ? `Pool Round ${nextRound}` : 'Pool Stage';
    }

    if (category.poolPhase === 'elimination') {
      if (finalsRemaining || (nextRound !== null && maxRound !== null && nextRound === maxRound)) {
        return 'Finals Phase';
      }
      return nextRound ? `Elimination Round ${nextRound}` : 'Elimination Stage';
    }
  }

  if (finalsRemaining || (nextRound !== null && maxRound !== null && nextRound === maxRound)) {
    return 'Finals Phase';
  }

  return nextRound ? `Round ${nextRound}` : 'In Progress';
}

export function useCategoryStageStatus(
  categories: ComputedRef<Category[]>,
  matches: ComputedRef<Match[]>,
  getParticipantName: (id: string | undefined) => string
): {
  queueMatches: ComputedRef<Match[]>;
  totalRemainingMatches: ComputedRef<number>;
  categoryStageStatuses: ComputedRef<CategoryStageStatus[]>;
} {
  const queueMatches = computed(() => {
    return matches.value
      .filter(
        (match) =>
          (match.status === 'ready' || match.status === 'scheduled') &&
          hasAssignedParticipants(match)
      )
      .sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);
  });

  const remainingMatches = computed(() => {
    return matches.value.filter(
      (match) => !isFinishedMatchStatus(match.status) && hasAssignedParticipants(match)
    );
  });

  const totalRemainingMatches = computed(() => remainingMatches.value.length);

  const categoryStageStatuses = computed(() => {
    return categories.value
      .map((category) => {
        const categoryMatchesAllScopes = matches.value.filter((match) => match.categoryId === category.id);
        const hasLevelMatches = categoryMatchesAllScopes.some((match) => Boolean(match.levelId));
        const categoryMatches = hasLevelMatches
          ? categoryMatchesAllScopes.filter((match) => Boolean(match.levelId))
          : categoryMatchesAllScopes;
        const categoryRemainingMatches = categoryMatches.filter(
          (match) => !isFinishedMatchStatus(match.status)
        );
        const actionableRemainingMatches = categoryRemainingMatches.filter(hasAssignedParticipants);
        const completed = categoryMatches.filter((match) => isFinishedMatchStatus(match.status)).length;
        const remaining = actionableRemainingMatches.length;
        const liveMatches = categoryMatches.filter(
          (match) => match.status === 'in_progress' && hasAssignedParticipants(match)
        );
        const upcomingMatches = categoryMatches
          .filter(
            (match) =>
              (match.status === 'ready' || match.status === 'scheduled') &&
              hasAssignedParticipants(match)
          )
          .sort((a, b) => a.round - b.round || a.matchNumber - b.matchNumber);
        const nextRounds = actionableRemainingMatches
          .map((match) => match.round)
          .filter((round) => round > 0);
        const nextRound = nextRounds.length > 0 ? Math.min(...nextRounds) : null;
        const stageLabel = getStageLabel(
          category,
          categoryMatches,
          actionableRemainingMatches,
          nextRound
        );
        const nextMatch = upcomingMatches[0] || liveMatches[0];
        const nextMatchLabel = nextMatch
          ? formatMatchLabel(nextMatch, getParticipantName)
          : remaining > 0
            ? 'Waiting on prior results'
            : '-';

        return {
          categoryId: category.id,
          categoryName: category.name,
          stageLabel,
          nextMatchLabel,
          total: categoryMatches.length,
          completed,
          remaining,
          live: liveMatches.length,
          upcoming: upcomingMatches.length,
          nextRound,
        } as CategoryStageStatus;
      })
      .sort((a, b) => b.remaining - a.remaining || a.categoryName.localeCompare(b.categoryName));
  });

  return {
    queueMatches,
    totalRemainingMatches,
    categoryStageStatuses,
  };
}
