import { describe, it, expect } from 'vitest';
import {
  SeededRng,
  computePoolPlan,
  assignClassicSerpentine,
  assignShuffledSerpentineModelA,
  validatePoolAssignment,
} from '@/utils/poolAssignment';
import type { PoolTeam } from '@/types/poolAssignment';

// ============================================
// Test Helpers
// ============================================

function createSeededTeams(count: number): PoolTeam[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `team-${i + 1}`,
    seed: i + 1,
  }));
}

// ============================================
// SeededRng Tests
// ============================================

describe('SeededRng', () => {
  it('should produce same sequence with same seed', () => {
    const rng1 = new SeededRng(12345);
    const rng2 = new SeededRng(12345);

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
  });

  it('should produce different sequences with different seeds', () => {
    const rng1 = new SeededRng(12345);
    const rng2 = new SeededRng(54321);

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    expect(seq1).not.toEqual(seq2);
  });

  it('should shuffle deterministically with same seed', () => {
    const rng1 = new SeededRng(99999);
    const rng2 = new SeededRng(99999);
    const arr = ['a', 'b', 'c', 'd', 'e'];

    const shuffled1 = rng1.shuffle(arr);
    const shuffled2 = rng2.shuffle(arr);

    expect(shuffled1).toEqual(shuffled2);
    expect(shuffled1).not.toEqual(arr);
    expect(shuffled1.sort()).toEqual(arr);
  });

  it('should sample deterministically with same seed', () => {
    const rng1 = new SeededRng(77777);
    const rng2 = new SeededRng(77777);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const sample1 = rng1.sample(arr, 5);
    const sample2 = rng2.sample(arr, 5);

    expect(sample1).toEqual(sample2);
    expect(sample1).toHaveLength(5);
  });

  it('should return all items when sample size equals array length', () => {
    const rng = new SeededRng(11111);
    const arr = [1, 2, 3, 4, 5];

    const sample = rng.sample(arr, 5);

    expect(sample.sort()).toEqual(arr.sort());
  });
});

// ============================================
// computePoolPlan Tests
// ============================================

describe('computePoolPlan', () => {
  it('should compute correct plan when N is divisible by K (no byes)', () => {
    const plan = computePoolPlan(16, 4);

    expect(plan.N).toBe(16);
    expect(plan.K).toBe(4);
    expect(plan.P).toBe(4);
    expect(plan.tiers).toBe(4);
    expect(plan.byes).toBe(0);
  });

  it('should compute correct plan when N is not divisible by K (with byes)', () => {
    const plan = computePoolPlan(14, 4);

    expect(plan.N).toBe(14);
    expect(plan.K).toBe(4);
    expect(plan.P).toBe(4);
    expect(plan.tiers).toBe(4);
    expect(plan.byes).toBe(2);
  });

  it('should compute correct plan for N=17, K=4', () => {
    const plan = computePoolPlan(17, 4);

    expect(plan.P).toBe(5);
    expect(plan.tiers).toBe(4);
    expect(plan.byes).toBe(3);
  });

  it('should return correct minimum seeding options', () => {
    const plan = computePoolPlan(20, 4);

    expect(plan.minSeedOptions.basic).toBe(5);
    expect(plan.minSeedOptions.better).toBe(10);
    expect(plan.minSeedOptions.strong).toBe(15);
    expect(plan.minSeedOptions.best).toBe(20);
  });

  it('should cap seeding options at N', () => {
    const plan = computePoolPlan(6, 4);

    expect(plan.P).toBe(2);
    expect(plan.minSeedOptions.better).toBe(4);
    expect(plan.minSeedOptions.strong).toBe(6);
    expect(plan.minSeedOptions.best).toBe(6);
  });

  it('should throw error for N <= 0', () => {
    expect(() => computePoolPlan(0, 4)).toThrow('N must be positive');
    expect(() => computePoolPlan(-1, 4)).toThrow('N must be positive');
  });

  it('should throw error for K < 2', () => {
    expect(() => computePoolPlan(10, 1)).toThrow('K must be at least 2');
    expect(() => computePoolPlan(10, 0)).toThrow('K must be at least 2');
  });

  it('should compute plan for various N/K combinations', () => {
    const testCases: Array<{ N: number; K: number; P: number; byes: number }> = [
      { N: 8, K: 4, P: 2, byes: 0 },
      { N: 10, K: 4, P: 3, byes: 2 },
      { N: 11, K: 4, P: 3, byes: 1 },
      { N: 12, K: 4, P: 3, byes: 0 },
      { N: 5, K: 3, P: 2, byes: 1 },
      { N: 6, K: 3, P: 2, byes: 0 },
      { N: 7, K: 4, P: 2, byes: 1 },
      { N: 8, K: 4, P: 2, byes: 0 },
    ];

    for (const { N, K, P, byes } of testCases) {
      const plan = computePoolPlan(N, K);
      expect(plan.P).toBe(P);
      expect(plan.byes).toBe(byes);
    }
  });
});

// ============================================
// assignClassicSerpentine Tests
// ============================================

describe('assignClassicSerpentine', () => {
  it('should assign teams in classic serpentine pattern', () => {
    const teams = createSeededTeams(8);
    const pools = assignClassicSerpentine(teams, 2);

    expect(pools).toHaveLength(2);
    // Round 0 (forward): team-1->pool0, team-2->pool1
    // Round 1 (backward): team-3->pool1, team-4->pool0
    // Round 2 (forward): team-5->pool0, team-6->pool1
    // Round 3 (backward): team-7->pool1, team-8->pool0
    expect(pools[0]).toEqual(['team-1', 'team-4', 'team-5', 'team-8']);
    expect(pools[1]).toEqual(['team-2', 'team-3', 'team-6', 'team-7']);
  });

  it('should handle 3 pools correctly', () => {
    const teams = createSeededTeams(9);
    const pools = assignClassicSerpentine(teams, 3);

    expect(pools).toHaveLength(3);
    // Round 0 (forward): 1->0, 2->1, 3->2
    // Round 1 (backward): 4->2, 5->1, 6->0
    // Round 2 (forward): 7->0, 8->1, 9->2
    expect(pools[0]).toEqual(['team-1', 'team-6', 'team-7']);
    expect(pools[1]).toEqual(['team-2', 'team-5', 'team-8']);
    expect(pools[2]).toEqual(['team-3', 'team-4', 'team-9']);
  });

  it('should be deterministic', () => {
    const teams = createSeededTeams(12);
    const pools1 = assignClassicSerpentine(teams, 3);
    const pools2 = assignClassicSerpentine(teams, 3);

    expect(pools1).toEqual(pools2);
  });

  it('should throw error for P < 2', () => {
    const teams = createSeededTeams(4);
    expect(() => assignClassicSerpentine(teams, 1)).toThrow('P must be at least 2');
  });

  it('should throw error for empty teams', () => {
    expect(() => assignClassicSerpentine([], 2)).toThrow('teamsSortedBySeed cannot be empty');
  });

  it('should handle uneven distribution', () => {
    const teams = createSeededTeams(7);
    const pools = assignClassicSerpentine(teams, 2);

    // Round 0 (forward): 1->0, 2->1
    // Round 1 (backward): 3->1, 4->0
    // Round 2 (forward): 5->0, 6->1
    // Round 3 (backward): 7->1 (since P-1-pos = 2-1-0 = 1)
    // pools[0] = [1, 4, 5] = 3 teams
    // pools[1] = [2, 3, 6, 7] = 4 teams
    expect(pools[0]).toHaveLength(3);
    expect(pools[1]).toHaveLength(4);
    expect(pools[0]).toEqual(['team-1', 'team-4', 'team-5']);
    expect(pools[1]).toEqual(['team-2', 'team-3', 'team-6', 'team-7']);
  });
});

// ============================================
// assignShuffledSerpentineModelA Tests
// ============================================

describe('assignShuffledSerpentineModelA', () => {
  it('should assign all teams exactly once', () => {
    const teams = createSeededTeams(12);
    const result = assignShuffledSerpentineModelA(teams, 4, 12345);

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toBeNull();
  });

  it('should be deterministic with same rngSeed', () => {
    const teams = createSeededTeams(12);
    const result1 = assignShuffledSerpentineModelA(teams, 4, 99999);
    const result2 = assignShuffledSerpentineModelA(teams, 4, 99999);

    expect(result1.pools).toEqual(result2.pools);
  });

  it('should produce different results with different seeds', () => {
    const teams = createSeededTeams(12);
    const result1 = assignShuffledSerpentineModelA(teams, 4, 11111);
    const result2 = assignShuffledSerpentineModelA(teams, 4, 22222);

    expect(result1.pools).not.toEqual(result2.pools);
  });

  it('should create pools of size K or K-1', () => {
    const teams = createSeededTeams(14);
    const result = assignShuffledSerpentineModelA(teams, 4, 12345);

    const poolSizes = result.pools.map((p) => p.length);
    expect(poolSizes.every((s) => s === 4 || s === 3)).toBe(true);
  });

  it('should create correct number of pools', () => {
    const teams = createSeededTeams(14);
    const result = assignShuffledSerpentineModelA(teams, 4, 12345);

    const plan = computePoolPlan(14, 4);
    expect(result.pools.length).toBe(plan.P);
  });

  it('should handle teams with no seeds', () => {
    const teams: PoolTeam[] = [
      { id: 'team-a' },
      { id: 'team-b' },
      { id: 'team-c' },
      { id: 'team-d' },
      { id: 'team-e' },
      { id: 'team-f' },
      { id: 'team-g' },
      { id: 'team-h' },
    ];

    const result = assignShuffledSerpentineModelA(teams, 4, 12345);

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toBeNull();
  });

  it('should handle mixed seeded and unseeded teams', () => {
    const teams: PoolTeam[] = [
      { id: 'seeded-1', seed: 1 },
      { id: 'seeded-2', seed: 2 },
      { id: 'seeded-3', seed: 3 },
      { id: 'unseeded-a' },
      { id: 'unseeded-b' },
      { id: 'unseeded-c' },
    ];

    const result = assignShuffledSerpentineModelA(teams, 3, 12345);

    const validation = validatePoolAssignment(result, teams, 3);
    expect(validation).toBeNull();
  });

  it('should handle byes correctly', () => {
    const teams = createSeededTeams(14);
    const result = assignShuffledSerpentineModelA(teams, 4, 12345);

    const plan = computePoolPlan(14, 4);
    const poolSizes = result.pools.map((p) => p.length);
    const byeCount = poolSizes.filter((s) => s === 3).length;

    expect(byeCount).toBe(plan.byes);
  });

  it('should throw error for N <= 0', () => {
    expect(() => assignShuffledSerpentineModelA([], 4, 12345)).toThrow('N must be positive');
  });

  it('should throw error for K < 2', () => {
    const teams = createSeededTeams(4);
    expect(() => assignShuffledSerpentineModelA(teams, 1, 12345)).toThrow('K must be at least 2');
  });

  it('should use rotate bye pool selection when specified', () => {
    const teams = createSeededTeams(14);
    const result = assignShuffledSerpentineModelA(teams, 4, 12345, {
      byePoolSelection: 'rotate',
    });

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toBeNull();
  });
});

// ============================================
// validatePoolAssignment Tests
// ============================================

describe('validatePoolAssignment', () => {
  it('should return null for valid assignment', () => {
    const teams = createSeededTeams(12);
    const result = assignShuffledSerpentineModelA(teams, 4, 12345);

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toBeNull();
  });

  it('should detect team count mismatch', () => {
    // N=12, K=4 -> P=3 pools, each should have 4 teams
    const teams = createSeededTeams(12);
    const result = {
      pools: [
        ['team-1', 'team-2', 'team-3', 'team-4'],
        ['team-5', 'team-6', 'team-7', 'team-8'],
        ['team-9', 'team-10', 'team-11'], // Missing team-12
      ],
      byePools: [] as number[],
      meta: { N: 12, K: 4, P: 3, tiers: 3, byes: 0 },
      config: { byeDistributionMode: 'lastTierSkip' as const, byePoolSelection: 'rng' as const },
    };

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toContain('Team count mismatch');
  });

  it('should detect duplicate assignments', () => {
    // N=4, K=4 -> P=1 pool
    const teams = createSeededTeams(4);
    const result = {
      pools: [['team-1', 'team-1', 'team-2', 'team-3']],
      byePools: [] as number[],
      meta: { N: 4, K: 4, P: 1, tiers: 1, byes: 0 },
      config: { byeDistributionMode: 'lastTierSkip' as const, byePoolSelection: 'rng' as const },
    };

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toContain('Duplicate');
  });

  it('should detect invalid pool sizes', () => {
    // N=8, K=4 -> P=2 pools
    const teams = createSeededTeams(8);
    const result = {
      pools: [
        ['team-1', 'team-2', 'team-3', 'team-4', 'team-extra'],
        ['team-5', 'team-6', 'team-7', 'team-8'],
      ],
      byePools: [] as number[],
      meta: { N: 8, K: 4, P: 2, tiers: 2, byes: 0 },
      config: { byeDistributionMode: 'lastTierSkip' as const, byePoolSelection: 'rng' as const },
    };

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toContain('Invalid pool size');
  });

  it('should detect incorrect pool count', () => {
    // N=12, K=4 -> P=3 pools expected
    const teams = createSeededTeams(12);
    const result = {
      pools: [['team-1', 'team-2', 'team-3', 'team-4']],
      byePools: [] as number[],
      meta: { N: 12, K: 4, P: 3, tiers: 3, byes: 0 },
      config: { byeDistributionMode: 'lastTierSkip' as const, byePoolSelection: 'rng' as const },
    };

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toContain('Pool count mismatch');
  });

  it('should detect unknown team IDs', () => {
    // N=4, K=4 -> P=1 pool
    const teams = createSeededTeams(4);
    const result = {
      pools: [['team-1', 'unknown-team', 'team-2', 'team-3']],
      byePools: [] as number[],
      meta: { N: 4, K: 4, P: 1, tiers: 1, byes: 0 },
      config: { byeDistributionMode: 'lastTierSkip' as const, byePoolSelection: 'rng' as const },
    };

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toContain('Unknown team ID');
  });
});

// ============================================
// Edge Cases Tests
// ============================================

describe('Edge Cases', () => {
  it('should handle minimum N with byes', () => {
    const teams = createSeededTeams(5);
    const result = assignShuffledSerpentineModelA(teams, 3, 12345);

    const validation = validatePoolAssignment(result, teams, 3);
    expect(validation).toBeNull();
  });

  it('should handle large N', () => {
    const teams = createSeededTeams(100);
    const result = assignShuffledSerpentineModelA(teams, 4, 12345);

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toBeNull();
  });

  it('should handle large K', () => {
    const teams = createSeededTeams(20);
    const result = assignShuffledSerpentineModelA(teams, 10, 12345);

    const validation = validatePoolAssignment(result, teams, 10);
    expect(validation).toBeNull();
  });

  it('should handle N just above multiple of K', () => {
    const teams = createSeededTeams(9);
    const result = assignShuffledSerpentineModelA(teams, 4, 12345);

    const plan = computePoolPlan(9, 4);
    expect(plan.P).toBe(3);
    expect(plan.byes).toBe(3);

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toBeNull();
  });

  it('should handle all unseeded teams', () => {
    const teams: PoolTeam[] = Array.from({ length: 15 }, (_, i) => ({
      id: `team-${i + 1}`,
    }));

    const result = assignShuffledSerpentineModelA(teams, 4, 12345);

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toBeNull();
  });

  it('should handle all seeded teams', () => {
    const teams = createSeededTeams(15);

    const result = assignShuffledSerpentineModelA(teams, 4, 12345);

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toBeNull();
  });

  it('should maintain strength banding in tiers', () => {
    const teams = createSeededTeams(8);

    const result = assignShuffledSerpentineModelA(teams, 4, 12345);

    // With K=4, P=2, we have 4 tiers.
    // Tier 0 should have seeds 1-2
    // Tier 1 should have seeds 3-4
    // Tier 2 should have seeds 5-6
    // Tier 3 should have seeds 7-8
    // Result pools[0] and pools[1] should each have exactly one from each tier.
    for (const pool of result.pools) {
      expect(pool.some(id => id === 'team-1' || id === 'team-2')).toBe(true);
      expect(pool.some(id => id === 'team-3' || id === 'team-4')).toBe(true);
      expect(pool.some(id => id === 'team-5' || id === 'team-6')).toBe(true);
      expect(pool.some(id => id === 'team-7' || id === 'team-8')).toBe(true);
    }

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toBeNull();
  });

  it('should apply serpentine direction skipping bye pools in last tier', () => {
    const teams = createSeededTeams(7);
    const result = assignShuffledSerpentineModelA(teams, 4, 12345, { byePoolSelection: 'rotate' });

    expect(result.pools[0].length).toBe(4);
    expect(result.pools[1].length).toBe(3);

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toBeNull();
  });

  it('should reject P < 2 (less than 2 pools)', () => {
    const teams = createSeededTeams(3);
    expect(() => assignShuffledSerpentineModelA(teams, 4, 12345)).toThrow('At least 2 pools required');
  });

  it('should accept N=5, K=4 (P=2 pools)', () => {
    const teams = createSeededTeams(5);
    const result = assignShuffledSerpentineModelA(teams, 4, 12345);
    expect(result.meta.P).toBe(2);
    expect(result.meta.byes).toBe(3);
  });

  it('should expose byePools in result', () => {
    const teams = createSeededTeams(71);
    const result = assignShuffledSerpentineModelA(teams, 4, 42);

    expect(result.meta.P).toBe(18);
    expect(result.meta.byes).toBe(1);
    expect(result.byePools).toHaveLength(1);
    expect(Array.isArray(result.byePools)).toBe(true);

    const byePoolIndex = result.byePools[0];
    expect(result.pools[byePoolIndex].length).toBe(3);

    result.pools.forEach((pool, idx) => {
      if (result.byePools.includes(idx)) {
        expect(pool.length).toBe(3);
      } else {
        expect(pool.length).toBe(4);
      }
    });
  });

  it('should be deterministic regardless of input array order', () => {
    const teams1 = [
      { id: 'a', seed: 1 },
      { id: 'b', seed: 2 },
      { id: 'c' },
      { id: 'd' },
      { id: 'e', seed: 3 },
      { id: 'f' },
    ];
    const teams2 = [
      { id: 'f' },
      { id: 'd' },
      { id: 'c' },
      { id: 'e', seed: 3 },
      { id: 'b', seed: 2 },
      { id: 'a', seed: 1 },
    ];

    const result1 = assignShuffledSerpentineModelA(teams1, 3, 99999);
    const result2 = assignShuffledSerpentineModelA(teams2, 3, 99999);

    expect(result1.pools).toEqual(result2.pools);
    expect(result1.byePools).toEqual(result2.byePools);
  });

  it('should support explicit rotateKey for deterministic rotation', () => {
    const teams = createSeededTeams(14);
    const result1 = assignShuffledSerpentineModelA(teams, 4, 12345, {
      byePoolSelection: 'rotate',
      rotateKey: 100,
    });
    const result2 = assignShuffledSerpentineModelA(teams, 4, 99999, {
      byePoolSelection: 'rotate',
      rotateKey: 100,
    });

    expect(result1.byePools).toEqual(result2.byePools);

    const result3 = assignShuffledSerpentineModelA(teams, 4, 12345, {
      byePoolSelection: 'rotate',
      rotateKey: 103,
    });

    expect(result1.byePools).not.toEqual(result3.byePools);
  });

  it('should handle byes=3 correctly (N=73, K=4)', () => {
    const teams = createSeededTeams(73);
    const result = assignShuffledSerpentineModelA(teams, 4, 42);

    expect(result.meta.P).toBe(19);
    expect(result.meta.byes).toBe(3);
    expect(result.byePools).toHaveLength(3);

    const poolsWith3 = result.pools.filter(p => p.length === 3).length;
    const poolsWith4 = result.pools.filter(p => p.length === 4).length;

    expect(poolsWith3).toBe(3);
    expect(poolsWith4).toBe(16);

    result.byePools.forEach(idx => {
      expect(result.pools[idx].length).toBe(3);
    });

    const validation = validatePoolAssignment(result, teams, 4);
    expect(validation).toBeNull();
  });
});
