// ============================================
// CourtMaster v2 - Core Type Definitions
// ============================================

// User Roles
export type UserRole = 'admin' | 'organizer' | 'scorekeeper' | 'player' | 'viewer';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

// Tournament Types
export type TournamentStatus = 'draft' | 'registration' | 'active' | 'completed' | 'cancelled';
export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin' | 'pool_to_elimination';
export type TournamentLifecycleState =
  | 'DRAFT'
  | 'REG_OPEN'
  | 'REG_CLOSED'
  | 'SEEDING'
  | 'BRACKET_GENERATED'
  | 'BRACKET_LOCKED'
  | 'LIVE'
  | 'COMPLETED';

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  sport: 'badminton'; // Starting with badminton only
  format: TournamentFormat;
  status: TournamentStatus;
  state?: TournamentLifecycleState;
  startDate: Date;
  endDate: Date;
  registrationDeadline?: Date;
  location?: string;
  maxParticipants?: number;
  settings: TournamentSettings;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TournamentSettings {
  minRestTimeMinutes: number; // Minimum rest time between matches for same player
  matchDurationMinutes: number; // Estimated match duration for scheduling
  allowSelfRegistration: boolean;
  requireApproval: boolean;
  // Scoring settings
  gamesPerMatch: number; // Best of 1, 3, or 5
  pointsToWin: number; // Points needed to win a game
  mustWinBy: number; // Win by margin
  maxPoints: number | null; // Max points cap (null = no cap)
}

// Category Types
export type CategoryType = 'singles' | 'doubles' | 'mixed_doubles';
export type CategoryGender = 'men' | 'women' | 'mixed' | 'open';
export type AgeGroup = 'open' | 'u10' | 'u12' | 'u15' | 'u18' | 'u21' | 'senior' | '35+' | '45+' | '55+';

export interface Category {
  id: string;
  tournamentId: string;
  name: string;
  type: CategoryType;
  gender: CategoryGender;
  ageGroup: AgeGroup;
  format: TournamentFormat;
  maxParticipants?: number;
  minParticipants?: number;
  minGamesGuaranteed?: number; // For round robin - minimum games each participant plays
  seedingEnabled: boolean;
  scoringOverrideEnabled?: boolean;
  scoringConfig?: {
    gamesPerMatch?: number;
    pointsToWin?: number;
    mustWinBy?: number;
    maxPoints?: number | null;
  } | null;
  gamesPerMatch?: number;
  pointsToWin?: number;
  mustWinBy?: number;
  maxPoints?: number | null;
  status: 'setup' | 'registration' | 'active' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

// Predefined category templates
export const CATEGORY_TEMPLATES: Omit<Category, 'id' | 'tournamentId' | 'createdAt' | 'updatedAt' | 'status'>[] = [
  { name: "Men's Singles", type: 'singles', gender: 'men', ageGroup: 'open', format: 'single_elimination', seedingEnabled: true },
  { name: "Women's Singles", type: 'singles', gender: 'women', ageGroup: 'open', format: 'single_elimination', seedingEnabled: true },
  { name: "Men's Doubles", type: 'doubles', gender: 'men', ageGroup: 'open', format: 'single_elimination', seedingEnabled: true },
  { name: "Women's Doubles", type: 'doubles', gender: 'women', ageGroup: 'open', format: 'single_elimination', seedingEnabled: true },
  { name: "Mixed Doubles", type: 'mixed_doubles', gender: 'mixed', ageGroup: 'open', format: 'single_elimination', seedingEnabled: true },
];

// Age group display labels
export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  'open': 'Open',
  'u10': 'Under 10',
  'u12': 'Under 12',
  'u15': 'Under 15',
  'u18': 'Under 18',
  'u21': 'Under 21',
  'senior': 'Senior',
  '35+': '35+',
  '45+': '45+',
  '55+': '55+',
};

// Format display labels
export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  'single_elimination': 'Single Elimination',
  'double_elimination': 'Double Elimination',
  'round_robin': 'Round Robin',
  'pool_to_elimination': 'Pool Play to Elimination',
};

// Player/Team Types
export interface Player {
  id: string;
  userId?: string; // Link to auth user if self-registered
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  skillLevel?: number; // 1-10 for seeding purposes
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
  createdAt: Date;
  updatedAt: Date;
}

// Registration Types
export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'checked_in' | 'no_show';
export type PaymentStatus = 'unpaid' | 'paid' | 'partial' | 'refunded';

export interface Registration {
  id: string;
  tournamentId: string;
  categoryId: string;
  participantType: 'player' | 'team';
  playerId?: string;
  teamId?: string;
  partnerPlayerId?: string; // For doubles
  teamName?: string; // Display name for doubles teams
  status: RegistrationStatus;
  paymentStatus?: PaymentStatus; // Payment tracking
  paymentNote?: string; // e.g., "Paid via Venmo", "Cash collected"
  seed?: number;
  bibNumber?: number | null; // Bib number assigned to participant
  registeredBy: string; // User ID who created the registration
  registeredAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

// Court Types
export type CourtStatus = 'available' | 'in_use' | 'maintenance';

export interface Court {
  id: string;
  tournamentId: string;
  name: string;
  number: number;
  status: CourtStatus;
  currentMatchId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Match Types
export type MatchStatus = 'scheduled' | 'ready' | 'in_progress' | 'completed' | 'walkover' | 'cancelled';

export interface Match {
  id: string;
  tournamentId: string;
  categoryId: string;
  round: number;
  matchNumber: number; // Position in bracket
  bracketPosition: BracketPosition;
  participant1Id?: string; // Registration ID
  participant2Id?: string; // Registration ID
  winnerId?: string; // Registration ID of winner
  status: MatchStatus;
  courtId?: string;
  scheduledTime?: Date;
  startedAt?: Date;
  completedAt?: Date;
  scores: GameScore[];
  scoringConfig?: ScoringConfig;
  nextMatchId?: string; // Where winner advances to
  nextMatchSlot?: 'participant1' | 'participant2'; // Which slot in next match
  // For double elimination
  isLosersBracket?: boolean;
  loserNextMatchId?: string; // Where loser goes (double elim)
  loserNextMatchSlot?: 'participant1' | 'participant2';
  // Score correction tracking
  corrected?: boolean; // Whether this match has been corrected
  correctionCount?: number; // How many times the score has been corrected
  createdAt: Date;
  updatedAt: Date;
}

export interface BracketPosition {
  bracket: 'winners' | 'losers' | 'finals';
  round: number;
  position: number;
}

// Scoring Types
export interface GameScore {
  gameNumber: number;
  score1: number; // Participant 1 score
  score2: number; // Participant 2 score
  winnerId?: string;
  isComplete: boolean;
}

// Configurable scoring settings for tournament
export interface ScoringConfig {
  gamesPerMatch: number; // Best of 1, 3, or 5
  pointsToWin: number; // Points needed to win a game (e.g., 21, 15, 11)
  mustWinBy: number; // Win by margin (e.g., 2)
  maxPoints: number | null; // Cap on points (null = no cap)
}

// Default badminton config
export interface BadmintonMatchConfig {
  gamesPerMatch: 3; // Best of 3
  pointsToWin: 21;
  mustWinBy: 2;
  maxPoints: 30; // At 29-29, first to 30 wins
}

export const BADMINTON_CONFIG: BadmintonMatchConfig = {
  gamesPerMatch: 3,
  pointsToWin: 21,
  mustWinBy: 2,
  maxPoints: 30,
};

// Scoring presets
export const SCORING_PRESETS: Record<string, ScoringConfig> = {
  'badminton_standard': {
    gamesPerMatch: 3,
    pointsToWin: 21,
    mustWinBy: 2,
    maxPoints: 30,
  },
  'badminton_short': {
    gamesPerMatch: 3,
    pointsToWin: 15,
    mustWinBy: 2,
    maxPoints: 21,
  },
  'badminton_single_game': {
    gamesPerMatch: 1,
    pointsToWin: 21,
    mustWinBy: 2,
    maxPoints: 30,
  },
  'pickleball': {
    gamesPerMatch: 3,
    pointsToWin: 11,
    mustWinBy: 2,
    maxPoints: 15,
  },
  'table_tennis': {
    gamesPerMatch: 5,
    pointsToWin: 11,
    mustWinBy: 2,
    maxPoints: 15,
  },
};

// Schedule Types
export interface ScheduleSlot {
  id: string;
  tournamentId: string;
  courtId: string;
  matchId?: string;
  startTime: Date;
  endTime: Date;
  status: 'available' | 'scheduled' | 'in_progress' | 'completed';
}

// Notification Types
export type NotificationType = 'match_ready' | 'match_completed' | 'schedule_change' | 'registration_approved' | 'announcement';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

// Audit Log Types
export type AuditAction =
  | 'score_submit'
  | 'score_edit'
  | 'match_complete'
  | 'check_in'
  | 'check_in_undo'
  | 'no_show_mark'
  | 'no_show_restore'
  | 'court_assign'
  | 'court_release'
  | 'tournament_state_change'
  | 'tournament_state_unlock'
  | 'registration_approve'
  | 'registration_reject'
  | 'bracket_generate'
  | 'bracket_delete';

export type AuditEntityType = 'match' | 'registration' | 'court' | 'tournament' | 'bracket';

export interface AuditLog {
  id: string;
  tournamentId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditLogFilter {
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  actorId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Bracket Generation Types
export interface BracketGenerationRequest {
  tournamentId: string;
  categoryId: string;
  registrationIds: string[];
  format: TournamentFormat;
}

export interface ScheduleGenerationRequest {
  tournamentId: string;
  categoryIds: string[];
  courtIds: string[];
  startTime: Date;
  endTime: Date;
  minRestTimeMinutes: number;
  matchDurationMinutes: number;
}
