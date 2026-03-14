import type {
  RankingPresetId,
  RankingProgressionMode,
} from '@/types';
import type { TieBreakerStep } from '@/types/leaderboard';

export interface RankingPresetDefinition {
  id: RankingPresetId;
  label: string;
  description: string;
  points: {
    win: number;
    loss: number;
    walkoverWin: number;
    walkoverLoss: number;
  };
  tieBreakOrder: TieBreakerStep[];
  normalizeByMatchesPlayed: boolean;
}

export const DEFAULT_RANKING_PRESET: RankingPresetId = 'courtmaster_default';
export const DEFAULT_RANKING_PROGRESSION: RankingProgressionMode = 'carry_forward';

export const RANKING_PRESETS: Record<RankingPresetId, RankingPresetDefinition> = {
  courtmaster_default: {
    id: 'courtmaster_default',
    label: 'CourtMastr Default',
    description: 'Current production ranking behavior with normalized GD/PD tie-breakers.',
    points: { win: 2, loss: 1, walkoverWin: 2, walkoverLoss: 1 },
    tieBreakOrder: ['head_to_head', 'game_difference', 'point_difference', 'equal'],
    normalizeByMatchesPlayed: true,
  },
  bwf_strict: {
    id: 'bwf_strict',
    label: 'BWF Strict',
    description: 'BWF-aligned points and tie-break ordering.',
    points: { win: 2, loss: 1, walkoverWin: 2, walkoverLoss: 1 },
    tieBreakOrder: ['head_to_head', 'game_difference', 'point_difference', 'equal'],
    normalizeByMatchesPlayed: true,
  },
  simple_ladder: {
    id: 'simple_ladder',
    label: 'Simple Ladder',
    description: 'Simplified ladder tie-break sequence using raw point difference.',
    points: { win: 2, loss: 1, walkoverWin: 2, walkoverLoss: 1 },
    tieBreakOrder: ['point_difference', 'equal'],
    normalizeByMatchesPlayed: false,
  },
};

export const resolveRankingPreset = (presetId?: string | null): RankingPresetDefinition => {
  if (presetId && presetId in RANKING_PRESETS) {
    return RANKING_PRESETS[presetId as RankingPresetId];
  }

  return RANKING_PRESETS[DEFAULT_RANKING_PRESET];
};
