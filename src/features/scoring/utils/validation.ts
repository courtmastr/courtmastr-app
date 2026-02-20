import { BADMINTON_CONFIG } from '@/types';
import type { ScoringConfig } from '@/types';

interface GameValidationResult {
  isValid: boolean;
  message?: string;
}

interface ScoringSource {
  gamesPerMatch?: number;
  pointsToWin?: number;
  mustWinBy?: number;
  maxPoints?: number | null;
}

export interface CategoryScoringSource extends ScoringSource {
  scoringOverrideEnabled?: boolean;
  scoringConfig?: Partial<ScoringConfig> | null;
}

export interface TournamentScoringSource {
  settings?: Partial<ScoringConfig> | null;
}

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const normalizeGamesPerMatch = (value: unknown, fallback: number): number => {
  if (!isPositiveInteger(value)) return fallback;
  return value % 2 === 1 ? value : fallback;
};

const normalizeMaxPoints = (value: unknown, pointsToWin: number, fallback: number | null): number | null => {
  if (value == null || value === '') return null;
  if (!isPositiveInteger(value)) return fallback;
  return Math.max(value, pointsToWin);
};

export const sanitizeScoringConfig = (
  config?: Partial<ScoringConfig> | null,
  fallback: ScoringConfig = BADMINTON_CONFIG
): ScoringConfig => {
  const gamesPerMatch = normalizeGamesPerMatch(config?.gamesPerMatch, fallback.gamesPerMatch);
  const pointsToWin = isPositiveInteger(config?.pointsToWin) ? config.pointsToWin : fallback.pointsToWin;
  const mustWinBy = isPositiveInteger(config?.mustWinBy) ? config.mustWinBy : fallback.mustWinBy;
  const maxPoints = normalizeMaxPoints(config?.maxPoints, pointsToWin, fallback.maxPoints);

  return {
    gamesPerMatch,
    pointsToWin,
    mustWinBy,
    maxPoints,
  };
};

const extractCategoryScoringSource = (category?: CategoryScoringSource | null): ScoringSource | null => {
  if (!category) return null;

  if (category.scoringConfig) {
    return category.scoringConfig;
  }

  if (
    category.gamesPerMatch != null ||
    category.pointsToWin != null ||
    category.mustWinBy != null ||
    category.maxPoints != null
  ) {
    return {
      gamesPerMatch: category.gamesPerMatch,
      pointsToWin: category.pointsToWin,
      mustWinBy: category.mustWinBy,
      maxPoints: category.maxPoints ?? null,
    };
  }

  return null;
};

export const resolveScoringConfig = (
  tournament?: TournamentScoringSource | null,
  category?: CategoryScoringSource | null
): ScoringConfig => {
  const tournamentConfig = sanitizeScoringConfig(tournament?.settings ?? BADMINTON_CONFIG);
  const categoryConfigSource = extractCategoryScoringSource(category);

  if (category?.scoringOverrideEnabled && categoryConfigSource) {
    return sanitizeScoringConfig(categoryConfigSource, tournamentConfig);
  }

  return tournamentConfig;
};

export const getGamesNeeded = (config: ScoringConfig): number => Math.ceil(config.gamesPerMatch / 2);

export const validateCompletedGameScore = (
  score1: number,
  score2: number,
  config: ScoringConfig
): GameValidationResult => {
  if (score1 < 0 || score2 < 0) {
    return { isValid: false, message: 'Scores cannot be negative.' };
  }

  if (score1 === score2) {
    return { isValid: false, message: 'Game cannot end in a tie.' };
  }

  const maxScore = Math.max(score1, score2);
  const minScore = Math.min(score1, score2);
  const scoreDiff = maxScore - minScore;
  const hasWinningScore = maxScore >= config.pointsToWin;
  const hasWinningMargin = scoreDiff >= config.mustWinBy;
  const hasCap = config.maxPoints != null;
  const atCap = hasCap && maxScore >= config.maxPoints;

  if (hasCap && maxScore > config.maxPoints) {
    return { isValid: false, message: `Score cannot exceed ${config.maxPoints}.` };
  }

  if (!hasWinningScore) {
    return { isValid: false, message: `Winner must reach ${config.pointsToWin} points.` };
  }

  if (!atCap && !hasWinningMargin) {
    return { isValid: false, message: `Winner must lead by ${config.mustWinBy} points.` };
  }

  return { isValid: true };
};

export const getScoreInputMax = (config: ScoringConfig): number =>
  config.maxPoints ?? Math.max(config.pointsToWin + config.mustWinBy + 10, config.pointsToWin + 1);
