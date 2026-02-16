import type {
  Tournament,
  TournamentLifecycleState,
  TournamentStatus,
} from '@/types';

const TOURNAMENT_STATE_FLOW: TournamentLifecycleState[] = [
  'DRAFT',
  'REG_OPEN',
  'REG_CLOSED',
  'SEEDING',
  'BRACKET_GENERATED',
  'BRACKET_LOCKED',
  'LIVE',
  'COMPLETED',
];

const TOURNAMENT_STATE_LABELS: Record<TournamentLifecycleState, string> = {
  DRAFT: 'Draft',
  REG_OPEN: 'Registration Open',
  REG_CLOSED: 'Registration Closed',
  SEEDING: 'Seeding',
  BRACKET_GENERATED: 'Bracket Generated',
  BRACKET_LOCKED: 'Bracket Locked',
  LIVE: 'Live',
  COMPLETED: 'Completed',
};

const TOURNAMENT_STATE_DESCRIPTIONS: Record<TournamentLifecycleState, string> = {
  DRAFT: 'Configure tournament details, categories, and courts.',
  REG_OPEN: 'Registrations are open and roster is editable.',
  REG_CLOSED: 'No new registrations. Finalize participant list.',
  SEEDING: 'Set seeds before generating the final bracket.',
  BRACKET_GENERATED: 'Bracket exists but can still be adjusted.',
  BRACKET_LOCKED: 'Roster, seeding, and scoring format are locked.',
  LIVE: 'Tournament is live. Record and monitor match progress.',
  COMPLETED: 'Tournament is complete and results are final.',
};

const TOURNAMENT_STATE_COLORS: Record<TournamentLifecycleState, string> = {
  DRAFT: 'grey',
  REG_OPEN: 'info',
  REG_CLOSED: 'warning',
  SEEDING: 'primary',
  BRACKET_GENERATED: 'secondary',
  BRACKET_LOCKED: 'error',
  LIVE: 'success',
  COMPLETED: 'secondary',
};

const hasTournamentState = (state: string): state is TournamentLifecycleState => {
  return TOURNAMENT_STATE_FLOW.includes(state as TournamentLifecycleState);
};

export const inferTournamentStateFromStatus = (
  status?: TournamentStatus
): TournamentLifecycleState => {
  switch (status) {
    case 'registration':
      return 'REG_OPEN';
    case 'active':
      return 'LIVE';
    case 'completed':
    case 'cancelled':
      return 'COMPLETED';
    case 'draft':
    default:
      return 'DRAFT';
  }
};

export const normalizeTournamentState = (
  tournament?: Pick<Tournament, 'state' | 'status'> | null
): TournamentLifecycleState => {
  if (tournament?.state && hasTournamentState(tournament.state)) {
    return tournament.state;
  }
  return inferTournamentStateFromStatus(tournament?.status);
};

export const tournamentStateToStatus = (
  state: TournamentLifecycleState
): TournamentStatus => {
  switch (state) {
    case 'DRAFT':
      return 'draft';
    case 'REG_OPEN':
    case 'REG_CLOSED':
    case 'SEEDING':
    case 'BRACKET_GENERATED':
      return 'registration';
    case 'BRACKET_LOCKED':
    case 'LIVE':
      return 'active';
    case 'COMPLETED':
      return 'completed';
    default:
      return 'draft';
  }
};

export const getTournamentStateLabel = (
  state: TournamentLifecycleState
): string => TOURNAMENT_STATE_LABELS[state];

export const getTournamentStateDescription = (
  state: TournamentLifecycleState
): string => TOURNAMENT_STATE_DESCRIPTIONS[state];

export const getTournamentStateColor = (
  state: TournamentLifecycleState
): string => TOURNAMENT_STATE_COLORS[state];

export const getTournamentStateIndex = (
  state: TournamentLifecycleState
): number => TOURNAMENT_STATE_FLOW.indexOf(state);

export const getNextTournamentState = (
  state: TournamentLifecycleState
): TournamentLifecycleState | null => {
  const index = getTournamentStateIndex(state);
  if (index < 0 || index >= TOURNAMENT_STATE_FLOW.length - 1) return null;
  return TOURNAMENT_STATE_FLOW[index + 1];
};

export const canTransitionTournamentState = (
  current: TournamentLifecycleState,
  next: TournamentLifecycleState
): boolean => {
  if (current === next) return true;

  const currentIndex = getTournamentStateIndex(current);
  const nextIndex = getTournamentStateIndex(next);
  if (currentIndex < 0 || nextIndex < 0) return false;

  // Normal path: forward one step at a time.
  if (nextIndex === currentIndex + 1) return true;

  // Emergency unlock path.
  if (current === 'BRACKET_LOCKED' && next === 'BRACKET_GENERATED') return true;

  return false;
};

export const isEmergencyUnlockTransition = (
  current: TournamentLifecycleState,
  next: TournamentLifecycleState
): boolean => current === 'BRACKET_LOCKED' && next === 'BRACKET_GENERATED';

export const isRosterLocked = (state: TournamentLifecycleState): boolean =>
  getTournamentStateIndex(state) >= getTournamentStateIndex('REG_CLOSED');

export const isBracketLocked = (state: TournamentLifecycleState): boolean =>
  getTournamentStateIndex(state) >= getTournamentStateIndex('BRACKET_LOCKED');

export const isScoringLocked = (state: TournamentLifecycleState): boolean =>
  isBracketLocked(state);

export const assertCanEditRoster = (state: TournamentLifecycleState): void => {
  if (isRosterLocked(state)) {
    throw new Error('Roster changes are locked after registration closes.');
  }
};

export const assertCanEditBracket = (state: TournamentLifecycleState): void => {
  if (isBracketLocked(state)) {
    throw new Error('Bracket edits are locked because the bracket is locked.');
  }
};

export const assertCanEditScoring = (state: TournamentLifecycleState): void => {
  if (isScoringLocked(state)) {
    throw new Error('Scoring format is locked because the bracket is locked.');
  }
};

