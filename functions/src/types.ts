// Shared types for Cloud Functions
// These mirror the frontend types for consistency

export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | 'pool_to_elimination';
export type MatchStatus = 'scheduled' | 'ready' | 'in_progress' | 'completed' | 'walkover' | 'cancelled';
export type VolunteerRole = 'checkin' | 'scorekeeper';
export type VolunteerCheckInAction = 'check_in' | 'undo_check_in' | 'assign_bib';

export interface VolunteerSessionPayload {
  tournamentId: string;
  role: VolunteerRole;
  pinRevision: number;
  issuedAtMs: number;
  expiresAtMs: number;
}

export interface VolunteerAccessEntry {
  encryptedPin: string;
  enabled: boolean;
  pinRevision: number;
  maskedPin?: string;
  updatedBy?: string;
}

export interface VolunteerAccessConfig {
  checkin?: VolunteerAccessEntry;
  scorekeeper?: VolunteerAccessEntry;
}

export interface BracketPosition {
  bracket: 'winners' | 'losers' | 'finals';
  round: number;
  position: number;
}

export interface GameScore {
  gameNumber: number;
  score1: number;
  score2: number;
  winnerId?: string;
  isComplete: boolean;
}

export interface Match {
  id?: string;
  tournamentId: string;
  categoryId: string;
  round: number;
  matchNumber: number;
  bracketPosition: BracketPosition;
  participant1Id?: string;
  participant2Id?: string;
  winnerId?: string;
  status: MatchStatus;
  courtId?: string;
  scheduledTime?: Date;
  startedAt?: Date;
  completedAt?: Date;
  scores: GameScore[];
  nextMatchId?: string;
  nextMatchSlot?: 'participant1' | 'participant2';
  isLosersBracket?: boolean;
  loserNextMatchId?: string;
  loserNextMatchSlot?: 'participant1' | 'participant2';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Registration {
  id: string;
  tournamentId: string;
  categoryId: string;
  playerId?: string;
  teamId?: string;
  seed?: number;
  status: string;
}

export interface Court {
  id: string;
  tournamentId: string;
  name: string;
  number: number;
  status: string;
}

export interface ScheduleSlot {
  courtId: string;
  matchId: string;
  startTime: Date;
  endTime: Date;
}

export interface BadmintonConfig {
  gamesPerMatch: number;
  pointsToWin: number;
  mustWinBy: number;
  maxPoints: number;
}

export const BADMINTON_CONFIG: BadmintonConfig = {
  gamesPerMatch: 3,
  pointsToWin: 21,
  mustWinBy: 2,
  maxPoints: 30,
};

export type PoolSeedingMethod = 'serpentine' | 'random_in_tiers' | 'fully_random';
export type LevelEliminationFormat = 'single_elimination' | 'double_elimination' | 'playoff_8';

export interface Category {
  id: string;
  name: string;
  format: TournamentFormat;
  teamsPerPool?: number;
  poolSeedingMethod?: PoolSeedingMethod;
  poolQualifiersPerGroup?: number;
  poolStageId?: number | null;
}
