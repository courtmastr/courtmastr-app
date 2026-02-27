import { describe, expect, it } from 'vitest';
import {
  assignByGlobalBands,
  assignByPoolPosition,
  buildDefaultPoolMappings,
  type PoolLevelParticipant,
  type PoolSummary,
} from '@/composables/usePoolLeveling';

function makeParticipant(
  registrationId: string,
  poolId: string,
  poolRank: number,
  globalRank: number
): PoolLevelParticipant {
  return {
    registrationId,
    participantName: registrationId,
    poolId,
    poolLabel: poolId,
    poolRank,
    globalRank,
    seed: null,
    matchPoints: 0,
    winRate: 0,
    pointDifference: 0,
    pointsFor: 0,
  };
}

describe('usePoolLeveling assignment helpers', () => {
  it('buildDefaultPoolMappings maps rank 1/2/3+ to level 1/2/3', () => {
    const pools: PoolSummary[] = [
      { id: 'p1', label: 'Pool 1', participantCount: 4 },
      { id: 'p2', label: 'Pool 2', participantCount: 4 },
    ];

    const mappings = buildDefaultPoolMappings(pools, ['level-1', 'level-2', 'level-3']);

    expect(mappings).toHaveLength(2);
    expect(mappings[0]).toEqual({
      poolId: 'p1',
      rank1LevelId: 'level-1',
      rank2LevelId: 'level-2',
      rank3PlusLevelId: 'level-3',
    });
  });

  it('assignByPoolPosition applies per-pool rank mapping', () => {
    const participants = [
      makeParticipant('r1', 'p1', 1, 1),
      makeParticipant('r2', 'p1', 2, 2),
      makeParticipant('r3', 'p1', 3, 3),
      makeParticipant('r4', 'p2', 1, 4),
      makeParticipant('r5', 'p2', 2, 5),
      makeParticipant('r6', 'p2', 3, 6),
    ];

    const result = assignByPoolPosition(participants, [
      { poolId: 'p1', rank1LevelId: 'level-1', rank2LevelId: 'level-2', rank3PlusLevelId: 'level-3' },
      { poolId: 'p2', rank1LevelId: 'level-1', rank2LevelId: 'level-2', rank3PlusLevelId: 'level-3' },
    ]);

    expect(result.assignments.get('r1')).toBe('level-1');
    expect(result.assignments.get('r2')).toBe('level-2');
    expect(result.assignments.get('r3')).toBe('level-3');
    expect(result.countsByLevelId['level-1']).toBe(2);
    expect(result.countsByLevelId['level-2']).toBe(2);
    expect(result.countsByLevelId['level-3']).toBe(2);
  });

  it('assignByGlobalBands fills top/next/last and sends remainder to last level', () => {
    const participants = [
      makeParticipant('r1', 'p1', 1, 1),
      makeParticipant('r2', 'p1', 2, 2),
      makeParticipant('r3', 'p1', 3, 3),
      makeParticipant('r4', 'p2', 1, 4),
      makeParticipant('r5', 'p2', 2, 5),
    ];

    const result = assignByGlobalBands(participants, [1, 1], ['level-1', 'level-2']);

    expect(result.assignments.get('r1')).toBe('level-1');
    expect(result.assignments.get('r2')).toBe('level-2');
    expect(result.assignments.get('r3')).toBe('level-2');
    expect(result.assignments.get('r4')).toBe('level-2');
    expect(result.assignments.get('r5')).toBe('level-2');
    expect(result.countsByLevelId['level-1']).toBe(1);
    expect(result.countsByLevelId['level-2']).toBe(4);
  });

  it('buildDefaultPoolMappings falls back to first level when only one level exists', () => {
    const mappings = buildDefaultPoolMappings(
      [{ id: 'p1', label: 'Pool 1', participantCount: 3 }],
      ['level-1']
    );

    expect(mappings).toEqual([
      {
        poolId: 'p1',
        rank1LevelId: 'level-1',
        rank2LevelId: 'level-1',
        rank3PlusLevelId: 'level-1',
      },
    ]);
  });

  it('assignByPoolPosition skips participants whose pool has no mapping', () => {
    const participants = [
      makeParticipant('mapped', 'pool-a', 1, 1),
      makeParticipant('unmapped', 'pool-b', 1, 2),
    ];

    const result = assignByPoolPosition(participants, [
      {
        poolId: 'pool-a',
        rank1LevelId: 'level-1',
        rank2LevelId: 'level-2',
        rank3PlusLevelId: 'level-3',
      },
    ]);

    expect(result.assignments.get('mapped')).toBe('level-1');
    expect(result.assignments.has('unmapped')).toBe(false);
    expect(result.countsByLevelId).toEqual({ 'level-1': 1 });
  });

  it('assignByGlobalBands routes overflow to the final level when band slots are undersized', () => {
    const participants = [
      makeParticipant('r1', 'p1', 1, 1),
      makeParticipant('r2', 'p1', 2, 2),
      makeParticipant('r3', 'p2', 1, 3),
      makeParticipant('r4', 'p2', 2, 4),
    ];

    const result = assignByGlobalBands(participants, [1, 1, 0], [
      'level-1',
      'level-2',
      'level-3',
    ]);

    expect(result.assignments.get('r1')).toBe('level-1');
    expect(result.assignments.get('r2')).toBe('level-2');
    expect(result.assignments.get('r3')).toBe('level-3');
    expect(result.assignments.get('r4')).toBe('level-3');
    expect(result.countsByLevelId).toEqual({
      'level-1': 1,
      'level-2': 1,
      'level-3': 2,
    });
  });
});
