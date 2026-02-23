import type {
  PoolTeam,
  PoolPlan,
  PoolAssignmentResult,
  PoolAssignmentConfig,
  ShuffledSerpentineOptions,
} from '@/types/poolAssignment';

// ============================================
// Seeded Random Number Generator
// ============================================

/**
 * Linear Congruential Generator (LCG) for reproducible random numbers
 * Uses parameters from Numerical Recipes (a=1664525, c=1013904223, m=2^32)
 */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Get next random number between 0 and 1
   */
  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  /**
   * Shuffle array in place using Fisher-Yates algorithm
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Select n random items from array without replacement
   */
  sample<T>(array: T[], n: number): T[] {
    if (n >= array.length) {
      return this.shuffle(array);
    }
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, n);
  }
}

// ============================================
// Pool Plan Computation (Model A Compatible)
// ============================================

/**
 * Compute pool plan parameters from N (teams) and K (teams per pool)
 * Model A compatible: determines number of pools, tiers, byes, and seeding suggestions
 */
export function computePoolPlan(N: number, K: number): PoolPlan {
  if (N <= 0) {
    throw new Error('N must be positive');
  }
  if (K < 2) {
    throw new Error('K must be at least 2');
  }

  const P = Math.ceil(N / K);
  const tiers = K;
  const byes = P * K - N;

  // Minimum seeding suggestions
  const minSeedOptions = {
    basic: P,
    better: Math.min(2 * P, N),
    strong: Math.min(3 * P, N),
    best: N,
  };

  return {
    N,
    K,
    P,
    tiers,
    byes,
    minSeedOptions,
  };
}

// ============================================
// Classic Serpentine Assignment
// ============================================

/**
 * Classic serpentine (snake) distribution of teams into pools
 * Teams must be pre-sorted strongest to weakest (seed 1..N, unseeded at end)
 * Deterministic: same input always produces same output
 */
export function assignClassicSerpentine(
  teamsSortedBySeed: PoolTeam[],
  P: number
): string[][] {
  if (P < 2) {
    throw new Error('P must be at least 2');
  }
  if (teamsSortedBySeed.length === 0) {
    throw new Error('teamsSortedBySeed cannot be empty');
  }

  const pools: string[][] = Array.from({ length: P }, () => []);

  for (let s = 0; s < teamsSortedBySeed.length; s++) {
    const round = Math.floor(s / P);
    const pos = s % P;

    // Serpentine direction: even rounds go forward, odd rounds go backward
    const poolIndex = round % 2 === 0 ? pos : P - 1 - pos;

    pools[poolIndex].push(teamsSortedBySeed[s].id);
  }

  return pools;
}

// ============================================
// Shuffled Serpentine — Model A
// ============================================

const DEFAULT_CONFIG: PoolAssignmentConfig = {
  byeDistributionMode: 'lastTierSkip',
  byePoolSelection: 'rng',
};

/**
 * Model A shuffled serpentine pool assignment
 * Works for any N, handles byes, preserves strength banding
 * Reproducible when rngSeed is provided
 */
export function assignShuffledSerpentineModelA(
  teams: PoolTeam[],
  K: number,
  rngSeed?: number,
  options: ShuffledSerpentineOptions = {}
): PoolAssignmentResult {
  const N = teams.length;

  // Validation
  if (N <= 0) {
    throw new Error('N must be positive');
  }
  if (K < 2) {
    throw new Error('K must be at least 2');
  }

  const plan = computePoolPlan(N, K);
  const { P, tiers, byes } = plan;

  if (P < 2) {
    throw new Error('At least 2 pools required. Ensure N > K (since P = ceil(N/K)).');
  }

  // Initialize RNG
  const seed = rngSeed ?? Date.now();
  const rng = new SeededRng(seed);

  // Separate seeded and unseeded teams
  const seeded = teams.filter((t) => t.seed !== undefined && t.seed !== null);
  const unseeded = teams.filter((t) => t.seed === undefined || t.seed === null);

  // Sort seeded by seed ascending
  seeded.sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0));

  // Stabilize unseeded order (sort by id), then shuffle for reproducible randomness
  unseeded.sort((a, b) => a.id.localeCompare(b.id));
  rng.shuffle(unseeded);

  // Build ranked list: seeded first (by seed), then unseeded (shuffled)
  const rankedList = [...seeded, ...unseeded];

  // Build tiers
  const tiersList: PoolTeam[][] = [];
  let currentIndex = 0;

  for (let t = 0; t < tiers; t++) {
    const isLastTier = t === tiers - 1;
    const tierSize = isLastTier ? P - byes : P;

    if (tierSize <= 0) {
      continue;
    }

    const tierTeams = rankedList.slice(currentIndex, currentIndex + tierSize);
    if (tierTeams.length === 0) {
      break;
    }

    // Shuffle within tier
    const shuffledTier = rng.shuffle(tierTeams);
    tiersList.push(shuffledTier);

    currentIndex += tierSize;
  }

  // Verify we consumed exactly N teams
  const totalInTiers = tiersList.reduce((sum, tier) => sum + tier.length, 0);
  if (totalInTiers !== N) {
    throw new Error(`Tier consumption error: expected ${N} teams, got ${totalInTiers}`);
  }

  // Select bye pools if needed
  let byePools: Set<number> = new Set();
  if (byes > 0) {
    const byePoolSelection = options.byePoolSelection ?? DEFAULT_CONFIG.byePoolSelection;

    if (byePoolSelection === 'rng') {
      // Randomly select which pools get byes
      const poolIndices = Array.from({ length: P }, (_, i) => i);
      byePools = new Set(rng.sample(poolIndices, byes));
    } else {
      // Rotate based on rotateKey (explicit key for deterministic rotation)
      const rotateKey = options.rotateKey ?? rngSeed ?? 0;
      const startIndex = ((rotateKey % P) + P) % P; // handles negatives safely
      for (let i = 0; i < byes; i++) {
        byePools.add((startIndex + i) % P);
      }
    }
  }

  // Assign teams to pools with serpentine direction
  const pools: string[][] = Array.from({ length: P }, () => []);

  for (let t = 0; t < tiersList.length; t++) {
    const tier = tiersList[t];
    const isForward = t % 2 === 0;

    // Build pool order for this tier
    const poolOrder: number[] = [];
    if (isForward) {
      for (let i = 0; i < P; i++) {
        if (!byePools.has(i) || t < tiers - 1) {
          poolOrder.push(i);
        }
      }
    } else {
      for (let i = P - 1; i >= 0; i--) {
        if (!byePools.has(i) || t < tiers - 1) {
          poolOrder.push(i);
        }
      }
    }

    // Place tier teams into pools
    for (let i = 0; i < tier.length; i++) {
      const poolIndex = poolOrder[i % poolOrder.length];
      pools[poolIndex].push(tier[i].id);
    }
  }

  return {
    pools,
    byePools: Array.from(byePools).sort((a, b) => a - b),
    meta: {
      N,
      K,
      P,
      tiers,
      byes,
    },
    config: {
      byeDistributionMode: options.byeDistributionMode ?? DEFAULT_CONFIG.byeDistributionMode,
      byePoolSelection: options.byePoolSelection ?? DEFAULT_CONFIG.byePoolSelection,
    },
  };
}

// ============================================
// Utility Functions
// ============================================

/**
 * Validate pool assignment result
 * Returns validation errors or null if valid
 */
export function validatePoolAssignment(
  result: PoolAssignmentResult,
  teams: PoolTeam[],
  K: number
): string | null {
  const { pools } = result;
  const N = teams.length;
  const teamIds = new Set(teams.map((t) => t.id));

  // Collect all assigned IDs first
  const assignedIds: string[] = [];
  for (const pool of pools) {
    assignedIds.push(...pool);
  }

  // Check pool count
  const P = Math.ceil(N / K);
  if (pools.length !== P) {
    return `Pool count mismatch: expected ${P}, got ${pools.length}`;
  }

  // Check pool sizes
  for (let i = 0; i < pools.length; i++) {
    const size = pools[i].length;
    if (size !== K && size !== K - 1) {
      return `Invalid pool size for pool ${i}: ${size} (must be ${K} or ${K - 1})`;
    }
  }

  // Check team count
  if (assignedIds.length !== N) {
    return `Team count mismatch: expected ${N}, assigned ${assignedIds.length}`;
  }

  // Check for duplicates
  const assignedSet = new Set(assignedIds);
  if (assignedSet.size !== N) {
    return `Duplicate assignments detected: ${assignedIds.length} assignments for ${assignedSet.size} unique teams`;
  }

  // Check for unknown team IDs
  for (const id of assignedIds) {
    if (!teamIds.has(id)) {
      return `Unknown team ID assigned: ${id}`;
    }
  }

  // Check bye count
  const byes = P * K - N;
  const byeCount = pools.filter((pool) => pool.length === K - 1).length;
  if (byeCount !== byes) {
    return `Bye count mismatch: expected ${byes} pools with ${K - 1} teams, got ${byeCount}`;
  }

  return null;
}
