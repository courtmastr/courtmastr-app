import type {
  Category,
  RankingPresetId,
  RankingProgressionMode,
  TournamentSettings,
} from '@/types';
import {
  DEFAULT_RANKING_PRESET,
  DEFAULT_RANKING_PROGRESSION,
  RANKING_PRESETS,
} from '@/features/leaderboard/rankingPresets';

export interface EffectiveRankingConfig {
  preset: RankingPresetId;
  progressionMode: RankingProgressionMode;
}

const isValidPresetId = (preset: unknown): preset is RankingPresetId => {
  return typeof preset === 'string' && preset in RANKING_PRESETS;
};

export const resolveEffectiveRankingConfig = (
  tournamentSettings: Partial<Pick<TournamentSettings, 'rankingPresetDefault' | 'progressionModeDefault'>>,
  categorySettings: Partial<Pick<Category, 'rankingPresetOverride' | 'progressionModeOverride'>>
): EffectiveRankingConfig => {
  const tournamentPreset = isValidPresetId(tournamentSettings.rankingPresetDefault)
    ? tournamentSettings.rankingPresetDefault
    : DEFAULT_RANKING_PRESET;

  const preset = isValidPresetId(categorySettings.rankingPresetOverride)
    ? categorySettings.rankingPresetOverride
    : tournamentPreset;

  const progressionMode = categorySettings.progressionModeOverride
    ?? tournamentSettings.progressionModeDefault
    ?? DEFAULT_RANKING_PROGRESSION;

  return {
    preset,
    progressionMode,
  };
};
