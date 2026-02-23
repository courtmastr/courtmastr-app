// ============================================
// Pool Assignment Types
// ============================================

/**
 * Team/Registration data for pool assignment
 */
export interface PoolTeam {
  id: string;
  seed?: number | null;
}

/**
 * Configuration options for bye distribution
 */
export type ByeDistributionMode = 'lastTierSkip';

export type ByePoolSelection = 'rng' | 'rotate';

export interface PoolAssignmentConfig {
  byeDistributionMode: ByeDistributionMode;
  byePoolSelection: ByePoolSelection;
}

/**
 * Minimum seeding suggestions for UI/help text
 */
export interface MinSeedOptions {
  basic: number; // minSeed = P
  better: number; // betterSeed = min(2P, N)
  strong: number; // strongSeed = min(3P, N)
  best: number; // bestSeed = N
}

/**
 * Pool plan computed from N and K
 */
export interface PoolPlan {
  N: number; // Total teams
  K: number; // Desired teams per pool
  P: number; // Number of pools (ceil(N/K))
  tiers: number; // Always equals K
  byes: number; // Number of pools with K-1 teams (P*K - N)
  minSeedOptions: MinSeedOptions;
}

/**
 * Result of pool assignment
 */
export interface PoolAssignmentResult {
  pools: string[][]; // Array of pools, each pool is array of team IDs
  byePools: number[]; // Sorted array of pool indices that have byes (size K-1)
  meta: {
    N: number;
    K: number;
    P: number;
    tiers: number;
    byes: number;
  };
  config: PoolAssignmentConfig;
}

/**
 * Options for shuffled serpentine assignment
 */
export interface ShuffledSerpentineOptions {
  byeDistributionMode?: ByeDistributionMode;
  byePoolSelection?: ByePoolSelection;
  rotateKey?: number; // Explicit key for rotate mode (tournamentId hash / event number)
}

/**
 * Seeded random number generator state
 */
export interface RngState {
  seed: number;
}
