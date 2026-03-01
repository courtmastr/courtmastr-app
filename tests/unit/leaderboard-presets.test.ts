import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RANKING_PRESET,
  DEFAULT_RANKING_PROGRESSION,
  RANKING_PRESETS,
  resolveRankingPreset,
} from '@/features/leaderboard/rankingPresets';

describe('ranking presets', () => {
  it('defines default preset and progression mode', () => {
    expect(DEFAULT_RANKING_PRESET).toBe('courtmaster_default');
    expect(DEFAULT_RANKING_PROGRESSION).toBe('carry_forward');
  });

  it('contains required preset ids', () => {
    expect(Object.keys(RANKING_PRESETS).sort()).toEqual([
      'bwf_strict',
      'courtmaster_default',
      'simple_ladder',
    ]);
  });

  it('falls back to default for unknown preset ids', () => {
    const fallback = resolveRankingPreset('unknown_preset');
    expect(fallback.id).toBe('courtmaster_default');
  });
});
