import { describe, it, expect } from 'vitest';
import { resolveMatchScoringConfig } from '@/features/scoring/utils/validation';
import type { CategoryScoringSource } from '@/features/scoring/utils/validation';
import type { ScoringConfig } from '@/types';

const POOL_CONFIG: ScoringConfig = { gamesPerMatch: 1, pointsToWin: 15, mustWinBy: 2, maxPoints: null };
const ELIM_CONFIG: ScoringConfig = { gamesPerMatch: 3, pointsToWin: 21, mustWinBy: 2, maxPoints: 30 };

describe('elimination scoring phase routing', () => {
  it('returns elimination config for elimination stageId when enabled', () => {
    const category: CategoryScoringSource = {
      scoringOverrideEnabled: true,
      scoringConfig: POOL_CONFIG,
      eliminationScoringEnabled: true,
      eliminationScoringConfig: ELIM_CONFIG,
      eliminationStageId: 2,
    };
    const result = resolveMatchScoringConfig(POOL_CONFIG, category, '2');
    expect(result.pointsToWin).toBe(21);
    expect(result.gamesPerMatch).toBe(3);
  });

  it('returns pool config for pool stageId even when elimination scoring enabled', () => {
    const category: CategoryScoringSource = {
      scoringOverrideEnabled: true,
      scoringConfig: POOL_CONFIG,
      eliminationScoringEnabled: true,
      eliminationScoringConfig: ELIM_CONFIG,
      eliminationStageId: 2,
    };
    const result = resolveMatchScoringConfig(POOL_CONFIG, category, '1');
    expect(result.pointsToWin).toBe(15);
    expect(result.gamesPerMatch).toBe(1);
  });

  it('returns pool config when eliminationScoringEnabled is false', () => {
    const category: CategoryScoringSource = {
      scoringOverrideEnabled: true,
      scoringConfig: POOL_CONFIG,
      eliminationScoringEnabled: false,
      eliminationScoringConfig: ELIM_CONFIG,
      eliminationStageId: 2,
    };
    const result = resolveMatchScoringConfig(POOL_CONFIG, category, '2');
    expect(result.pointsToWin).toBe(15);
  });

  it('returns pool config when stageId is undefined', () => {
    const category: CategoryScoringSource = {
      scoringOverrideEnabled: true,
      scoringConfig: POOL_CONFIG,
      eliminationScoringEnabled: true,
      eliminationScoringConfig: ELIM_CONFIG,
      eliminationStageId: 2,
    };
    const result = resolveMatchScoringConfig(POOL_CONFIG, category, undefined);
    expect(result.pointsToWin).toBe(15);
  });

  it('falls back to tournament config when no category data', () => {
    const result = resolveMatchScoringConfig({ pointsToWin: 11 }, undefined, '2');
    expect(result.pointsToWin).toBe(11);
  });
});
