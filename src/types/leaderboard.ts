// ============================================
// CourtMaster v2 - Leaderboard Types
// ============================================

import type { GameScore } from '@/types';

export type LeaderboardScope = 'category' | 'tournament';

export type TieBreakerStep =
  | 'match_wins'
  | 'head_to_head'
  | 'game_difference'
  | 'point_difference'
  | 'equal';

/** UI loading state for the leaderboard generation pipeline. */
export type LeaderboardStage = 'idle' | 'fetching' | 'calculating' | 'sorting' | 'done' | 'error';

/** One row in the leaderboard table. */
export interface LeaderboardEntry {
  // Identity
  rank: number;                  // 1-based, assigned after sorting
  registrationId: string;        // Firestore registration doc ID
  participantName: string;       // Display name (player full name or team name)
  participantType: 'player' | 'team';
  categoryId: string;
  categoryName: string;

  // Match stats
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  matchPoints: number;           // 2×wins + 1×losses (BWF standard)

  // Game stats (BWF tiebreaker inputs)
  gamesWon: number;
  gamesLost: number;
  gameDifference: number;        // gamesWon - gamesLost

  // Point stats (BWF tiebreaker inputs)
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;       // pointsFor - pointsAgainst

  // Derived
  winRate: number;               // (matchesWon / matchesPlayed) × 100, rounded to 2dp

  // Elimination tracking (elimination formats only)
  eliminated: boolean;
  eliminationRound?: number;     // Round number where eliminated
  finalPlacement?: number;       // 1st, 2nd, 3rd, etc. (if tournament complete)

  // Timestamps
  lastMatchAt?: Date;
  firstMatchAt?: Date;
}

export interface Leaderboard {
  scope: LeaderboardScope;
  tournamentId: string;
  categoryId?: string;
  generatedAt: Date;

  entries: LeaderboardEntry[];   // Sorted, rank already assigned

  totalMatches: number;
  completedMatches: number;
  totalParticipants: number;
  activeParticipants: number;
  eliminatedParticipants: number;

  categories?: CategorySummary[]; // Tournament-wide only

  tiebreakerResolutions: TiebreakerResolution[];
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  format: string;
  totalParticipants: number;
  matchesCompleted: number;
  matchesTotal: number;
  topThree: Pick<LeaderboardEntry, 'rank' | 'participantName' | 'matchesWon' | 'matchPoints'>[];
}

export interface TiebreakerMetric {
  label: string;     // "Match Points" | "GD / match" | "PD / match"
  value: number;
  tied: boolean;     // true = equal, this step was skipped
  decided: boolean;  // true = this metric broke the tie
}

export interface TiebreakerEntryValues {
  registrationId: string;
  participantName: string;
  metrics: TiebreakerMetric[];
}

export interface TiebreakerResolution {
  tiedRank: number;
  registrationIds: string[];
  step: TieBreakerStep;
  description: string;
  resolvedOrder: string[];
  headToHeadMatchId?: string;
  // NEW — only populated for 2-entry resolutions
  resolvedValues?: TiebreakerEntryValues[];
}

export interface LeaderboardOptions {
  includeEliminated?: boolean;  // default: true
  minimumMatches?: number;      // default: 0
  categoryIds?: string[];       // tournament scope: filter to specific categories
}

export type ExportFormat = 'csv' | 'json'; // PDF deferred to P2

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
}

/**
 * Internal derived type — NOT a Firestore document.
 * Built by joining /match + /match_scores + /participant resolution.
 */
export interface ResolvedMatch {
  id: string;
  categoryId: string;
  participant1Id: string;        // Registration ID (resolved via participant.name)
  participant2Id: string;        // Registration ID (resolved via participant.name)
  winnerId: string;              // Registration ID (from match_scores.winnerId)
  scores: GameScore[];
  round: number;
  bracket?: 'winners' | 'losers' | 'finals';
  completedAt?: Date;
}

/** Source `/participant` doc used by leaderboard match resolution. */
export interface LeaderboardParticipantDoc {
  id: string | number;
  name: string;
}

/** Source `/match` doc used by leaderboard match resolution. */
export interface LeaderboardMatchDoc {
  id: string;
  round?: number;
  bracket?: 'winners' | 'losers' | 'finals';
  opponent1?: {
    id?: string | number;
    registrationId?: string;
  };
  opponent2?: {
    id?: string | number;
    registrationId?: string;
  };
}

/** Source `/match_scores` doc used by leaderboard match resolution. */
export interface LeaderboardMatchScoreDoc {
  id: string;
  winnerId?: string;
  status?: string;
  scores?: GameScore[];
  completedAt?: Date | { toDate?: () => Date };
}
