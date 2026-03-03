import { describe, it, expect } from 'vitest';
import { isRoundRobinStage } from '@/features/brackets/utils/stageLayout';

describe('isRoundRobinStage', () => {
  it('returns true when first stage is round_robin', () => {
    expect(isRoundRobinStage([{ id: 1, type: 'round_robin' }])).toBe(true);
  });

  it('returns false when first stage is elimination', () => {
    expect(isRoundRobinStage([{ id: 1, type: 'single_elimination' }])).toBe(false);
  });

  it('returns false for empty stage arrays', () => {
    expect(isRoundRobinStage([])).toBe(false);
  });

  it('returns false when first stage has no type', () => {
    expect(isRoundRobinStage([{ id: 1 }])).toBe(false);
  });
});
