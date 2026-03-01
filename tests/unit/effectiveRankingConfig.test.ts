import { describe, it, expect } from 'vitest';
import { resolveEffectiveRankingConfig } from '@/features/leaderboard/effectiveRankingConfig';

describe('resolveEffectiveRankingConfig', () => {
  it('uses category overrides when present', () => {
    const cfg = resolveEffectiveRankingConfig(
      { rankingPresetDefault: 'courtmaster_default', progressionModeDefault: 'carry_forward' },
      { rankingPresetOverride: 'bwf_strict', progressionModeOverride: 'phase_reset' }
    );

    expect(cfg.preset).toBe('bwf_strict');
    expect(cfg.progressionMode).toBe('phase_reset');
  });

  it('falls back to tournament defaults, then system defaults', () => {
    const cfg = resolveEffectiveRankingConfig({}, {});

    expect(cfg.preset).toBe('courtmaster_default');
    expect(cfg.progressionMode).toBe('carry_forward');
  });
});
