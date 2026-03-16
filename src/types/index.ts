// ============================================
// CourtMastr v2 - Core Type Definitions
// ============================================

export type {
  Brand,
  TournamentId,
  CategoryId,
  RegistrationId,
  MatchId,
  Result,
} from '@/types/advanced';

// User Roles
export type UserRole = 'admin' | 'organizer' | 'scorekeeper' | 'player' | 'viewer';
export type VolunteerRole = 'checkin' | 'scorekeeper';

export interface VolunteerSession {
  tournamentId: string;
  role: VolunteerRole;
  sessionToken: string;
  pinRevision: number;
  expiresAtMs: number;
}

export interface TournamentVolunteerAccessEntry {
  enabled: boolean;
  pinRevision: number;
  maskedPin?: string;
  updatedBy?: string;
  updatedAt?: Date;
}

export interface TournamentVolunteerAccess {
  checkin?: TournamentVolunteerAccessEntry;
  scorekeeper?: TournamentVolunteerAccessEntry;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  isActive?: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  activeOrgId?: string | null; // ADD THIS
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

export interface TournamentLogo {
  url: string;
  storagePath: string;
  uploadedAt?: Date;
}

export interface TournamentSponsor {
  id: string;
  name: string;
  logoUrl: string;
  logoPath: string;
  website?: string;
  displayOrder: number;
}

export type TournamentSponsorRecord = TournamentSponsor | string;

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  sport?: string | null; // Multi-sport support
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
  organizerIds?: string[];
  tournamentLogo?: TournamentLogo | null;
  sponsors?: TournamentSponsorRecord[];
  volunteerAccess?: TournamentVolunteerAccess;
  createdAt: Date;
  updatedAt: Date;
}

export interface TournamentSettings {
  minRestTimeMinutes: number; // Minimum rest time between matches for same player
  matchDurationMinutes: number; // Estimated match duration for scheduling
  bufferMinutes?: number; // Buffer between planned matches
  allowSelfRegistration: boolean;
  requireApproval: boolean;
  autoAssignEnabled?: boolean;
  autoStartEnabled?: boolean;
  autoReadyLeadMinutes?: number;
  emergencyScheduleBufferMinutes?: number;
  autoAssignDueWindowMinutes?: number;
  // Scoring settings
  gamesPerMatch: number; // Best of 1, 3, or 5
  pointsToWin: number; // Points needed to win a game
  mustWinBy: number; // Win by margin
  maxPoints: number | null; // Max points cap (null = no cap)
  rankingPresetDefault?: RankingPresetId;
  progressionModeDefault?: RankingProgressionMode;
}

// Category Types
export type CategoryType = 'singles' | 'doubles' | 'mixed_doubles';
export type CategoryGender = 'men' | 'women' | 'mixed' | 'open';
export type AgeGroup = 'open' | 'u10' | 'u12' | 'u15' | 'u18' | 'u21' | 'senior' | '35+' | '45+' | '55+';
export type PoolPhase = 'pool' | 'elimination';
export type LevelingMode = 'pool_position' | 'global_bands';
export type LevelEliminationFormat = 'single_elimination' | 'double_elimination' | 'playoff_8';
export type LevelingStatus = 'not_started' | 'configured' | 'generated';
export type PoolSeedingMethod = 'serpentine' | 'random_in_tiers' | 'fully_random';
export type RankingPresetId = 'courtmaster_default' | 'bwf_strict' | 'simple_ladder';
export type RankingProgressionMode = 'carry_forward' | 'phase_reset';

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
  stageId?: number | null;
  poolStageId?: number | null;
  eliminationStageId?: number | null;
  poolPhase?: PoolPhase | null;
  poolGroupCount?: number | null;
  poolQualifiersPerGroup?: number | null;
  poolQualifiedRegistrationIds?: string[];
  teamsPerPool?: number | null;
  poolSeedingMethod?: PoolSeedingMethod | null;
  levelingEnabled?: boolean | null;
  levelingStatus?: LevelingStatus | null;
  recommendedLevelMode?: LevelingMode | null;
  selectedLevelMode?: LevelingMode | null;
  levelCount?: number | null;
  levelsVersion?: number | null;
  poolCompletedAt?: Date | null;
  rankingPresetOverride?: RankingPresetId | null;
  progressionModeOverride?: RankingProgressionMode | null;
  checkInOpen?: boolean; // true = check-in is open and accepting arrivals
  checkInClosedAt?: Date | null; // timestamp when check-in was closed
  createdAt: Date;
  updatedAt: Date;
}

export interface LevelDefinition {
  id: string;
  name: string;
  order: number;
  eliminationFormat: LevelEliminationFormat;
  participantCount: number;
  stageId?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LevelAssignment {
  id: string; // registrationId
  registrationId: string;
  levelId: string;
  levelName: string;
  sourceMode: LevelingMode;
  poolId?: string;
  poolLabel?: string;
  poolRank?: number;
  globalRank?: number;
  levelSeed?: number | null;
  overridden: boolean;
  overriddenBy?: string;
  overriddenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LevelGenerationConfig {
  mode: LevelingMode;
  levelCount: number;
  levelNames: string[];
  recommendedMode: LevelingMode;
  poolMappings?: Array<{
    poolId: string;
    rank1LevelId: string;
    rank2LevelId: string;
    rank3PlusLevelId: string;
  }>;
  globalBands?: number[];
  createdBy: string;
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

// Tournament status display labels
export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  'draft': 'Draft',
  'registration': 'Registration Open',
  'active': 'Active',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
};

// Category type display labels
export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  'singles': 'Singles',
  'doubles': 'Doubles',
  'mixed_doubles': 'Mixed Doubles',
};

// Category gender display labels
export const CATEGORY_GENDER_LABELS: Record<CategoryGender, string> = {
  'men': "Men's",
  'women': "Women's",
  'mixed': 'Mixed',
  'open': 'Open',
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
  isCheckedIn?: boolean; // Fast-path check-in flag (set alongside status='checked_in')
  participantPresence?: Record<string, boolean>; // Per-player presence map used by self check-in kiosk
  checkInSource?: 'admin' | 'kiosk'; // Origin of latest check-in transition
  checkedInAt?: Date; // Timestamp when registration became fully checked in
  paymentStatus?: PaymentStatus; // Payment tracking
  paymentNote?: string; // e.g., "Paid via Venmo", "Cash collected"
  seed?: number;
  bibNumber?: number | null; // Bib number assigned to participant
  registeredBy: string; // User ID who created the registration
  registeredAt: Date;
  createdAt?: Date;
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
  levelId?: string;
  stageId?: string;
  round: number;
  matchNumber: number; // Position in bracket
  bracketPosition: BracketPosition;
  participant1Id?: string; // Registration ID
  participant2Id?: string; // Registration ID
  winnerId?: string; // Registration ID of winner
  status: MatchStatus;
  groupId?: string;         // pool / round-robin group identifier (from brackets-manager group_id)
  courtId?: string;
  scheduledTime?: Date;
  // Time-first scheduling fields (source-of-truth for player communication)
  plannedStartAt?: Date;
  plannedEndAt?: Date;
  scheduleVersion?: number;
  scheduleStatus?: 'draft' | 'published';
  lockedTime?: boolean;       // if true, re-schedule runs skip this match
  plannedCourtId?: string | null;
  publishedAt?: Date;
  publishedBy?: string;
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
  categoryName?: string;
  courtName?: string;
  score?: string;
  calledAt?: Date;
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

// Review Types
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ReviewSource = 'public' | 'authenticated';

export interface ReviewRecord {
  id: string;
  status: ReviewStatus;
  rating: number;
  quote: string;
  displayName: string;
  organization?: string;
  source: ReviewSource;
  submitterUserId?: string | null;
  submitterEmail?: string | null;
  tournamentId?: string;
  tournamentName?: string;
  isFeatured?: boolean;
  moderationNote?: string;
  moderatedByUserId?: string;
  moderatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmitReviewPayload {
  rating: number;
  quote: string;
  displayName: string;
  organization?: string;
  source?: ReviewSource;
  tournamentId?: string;
  tournamentName?: string;
}

export interface SubmitReviewResponse {
  success: boolean;
  reviewId: string;
  status: ReviewStatus;
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

export interface MatchEvent {
  id: string;
  type: 'court_assigned' | 'match_announced' | 'match_started' | 'match_completed' | 'match_delayed' | 'walkover' | string;
  title: string;
  description?: string;
  timestamp: Date;
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

// Re-export pool assignment types
export type {
  PoolTeam,
  PoolPlan,
  MinSeedOptions,
  PoolAssignmentResult,
  PoolAssignmentConfig,
  ByeDistributionMode,
  ByePoolSelection,
  ShuffledSerpentineOptions,
  RngState,
} from './poolAssignment';

// ============================================
// Global Player Identity
// ============================================

export interface PlayerStats {
  wins: number;
  losses: number;
  gamesPlayed: number;
  tournamentsPlayed: number;
}

export interface PlayerSportStats {
  [categoryType: string]: PlayerStats; // 'singles' | 'doubles' | 'mixed'
}

export interface GlobalPlayer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailNormalized: string;
  phone?: string | null;
  skillLevel?: number | null;
  userId?: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  stats: {
    [sport: string]: PlayerSportStats | PlayerStats;
    overall: PlayerStats;
  };
}

// ============================================
// Organizations
// ============================================

export type OrgMemberRole = 'admin' | 'organizer';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  contactEmail?: string | null;
  timezone?: string | null;
  about?: string | null;
  website?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMember {
  uid: string;
  role: OrgMemberRole;
  joinedAt: Date;
}
