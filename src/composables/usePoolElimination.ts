/**
 * usePoolElimination — pure ranking and cut logic for Pool → Elimination.
 *
 * Takes the ranked participant list produced by usePoolLeveling and applies
 * a cut, returning who advances and who is eliminated. All functions are pure
 * and have no side effects, making them straightforward to unit test.
 */

import type { PoolLevelParticipant } from './usePoolLeveling';
import type { LevelEliminationFormat, QualifierCutMode } from '@/types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EliminationPreview {
  advancing: PoolLevelParticipant[];
  eliminated: PoolLevelParticipant[];
  totalPlayers: number;
  suggestedFormat: LevelEliminationFormat;
  suggestedCount: number; // nearest clean bracket size ≤ totalPlayers
}

export interface FormatSuggestion {
  format: LevelEliminationFormat;
  label: string;
  isPerfectBracket: boolean; // true when N is an exact power of 2
}

// ---------------------------------------------------------------------------
// Format auto-detection
// ---------------------------------------------------------------------------

const PERFECT_BRACKET_SIZES = [2, 4, 8, 16, 32, 64];

export function suggestBracketFormat(n: number): FormatSuggestion {
  const isPerfect = PERFECT_BRACKET_SIZES.includes(n);

  if (isPerfect) {
    return {
      format: 'single_elimination',
      label: 'Single Elimination',
      isPerfectBracket: true,
    };
  }

  // Double elimination handles non-power-of-2 well (byes in loser bracket)
  if (n >= 6) {
    return {
      format: 'double_elimination',
      label: 'Double Elimination (recommended for non-bracket sizes)',
      isPerfectBracket: false,
    };
  }

  // For very small counts just use single elimination with byes
  return {
    format: 'single_elimination',
    label: 'Single Elimination',
    isPerfectBracket: false,
  };
}

/** Returns quick-pick chip values: all perfect bracket sizes ≤ totalPlayers, plus totalPlayers itself. */
export function quickPickSizes(totalPlayers: number): number[] {
  const sizes = PERFECT_BRACKET_SIZES.filter((n) => n <= totalPlayers);
  if (!sizes.includes(totalPlayers)) sizes.push(totalPlayers);
  return sizes;
}

/** Nearest perfect bracket size ≤ n, or n itself if none. */
export function nearestBracketSize(n: number): number {
  const candidates = PERFECT_BRACKET_SIZES.filter((s) => s <= n);
  return candidates.length > 0 ? candidates[candidates.length - 1] : n;
}

// ---------------------------------------------------------------------------
// Sort functions — one per QualifierCutMode
// ---------------------------------------------------------------------------

/**
 * global_top_n: sort purely by pre-computed globalRank (ascending).
 * globalRank is already assigned by usePoolLeveling based on matchPoints →
 * winRate → pointDifference → pointsFor → name.
 */
export function sortByGlobalTopN(
  participants: PoolLevelParticipant[],
): PoolLevelParticipant[] {
  return [...participants].sort((a, b) => a.globalRank - b.globalRank);
}

/**
 * pool_first_global: sort primarily by poolRank (ascending), break ties by
 * globalRank. This ensures every pool's rank-1 beats every pool's rank-2,
 * preventing a strong rank-2 from a stacked pool from pushing out a weak
 * rank-1 from an easier pool.
 */
export function sortByPoolFirstGlobal(
  participants: PoolLevelParticipant[],
): PoolLevelParticipant[] {
  return [...participants].sort((a, b) => {
    if (a.poolRank !== b.poolRank) return a.poolRank - b.poolRank;
    return a.globalRank - b.globalRank;
  });
}

/**
 * top_n_per_pool: take the top `qualifiersPerPool` from each pool in pool-rank
 * order, then sort within each tier by globalRank. Mimics the legacy
 * poolQualifiersPerGroup behaviour.
 */
export function sortByTopNPerPool(
  participants: PoolLevelParticipant[],
  qualifiersPerPool: number,
): PoolLevelParticipant[] {
  // Separate advancing (within quota) from eliminated
  const advancing: PoolLevelParticipant[] = [];
  const eliminated: PoolLevelParticipant[] = [];

  for (const p of participants) {
    if (p.poolRank <= qualifiersPerPool) {
      advancing.push(p);
    } else {
      eliminated.push(p);
    }
  }

  // Sort advancing by poolRank tier then globalRank within tier
  advancing.sort((a, b) => {
    if (a.poolRank !== b.poolRank) return a.poolRank - b.poolRank;
    return a.globalRank - b.globalRank;
  });

  // Sort eliminated for display purposes
  eliminated.sort((a, b) => a.globalRank - b.globalRank);

  return [...advancing, ...eliminated];
}

// ---------------------------------------------------------------------------
// Main preview function
// ---------------------------------------------------------------------------

/**
 * computeEliminationPreview — applies a cut to the ranked participant list.
 *
 * For top_n_per_pool mode, `count` is treated as qualifiers-per-pool (not total),
 * so passing count=2 with 3 pools gives 6 advancing players.
 */
export function computeEliminationPreview(
  participants: PoolLevelParticipant[],
  count: number,
  mode: QualifierCutMode,
): EliminationPreview {
  const totalPlayers = participants.length;

  if (mode === 'top_n_per_pool') {
    const sorted = sortByTopNPerPool(participants, count);
    const advancing = sorted.filter((p) => p.poolRank <= count);
    const eliminated = sorted.filter((p) => p.poolRank > count);
    const n = advancing.length;
    return {
      advancing,
      eliminated,
      totalPlayers,
      suggestedFormat: suggestBracketFormat(n).format,
      suggestedCount: n,
    };
  }

  const sorted =
    mode === 'pool_first_global'
      ? sortByPoolFirstGlobal(participants)
      : sortByGlobalTopN(participants);

  const clampedCount = Math.min(Math.max(1, count), totalPlayers);
  const advancing = sorted.slice(0, clampedCount);
  const eliminated = sorted.slice(clampedCount);

  return {
    advancing,
    eliminated,
    totalPlayers,
    suggestedFormat: suggestBracketFormat(clampedCount).format,
    suggestedCount: clampedCount,
  };
}
