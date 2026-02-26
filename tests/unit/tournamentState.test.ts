import { describe, expect, it } from 'vitest';
import {
  assertCanEditBracket,
  assertCanEditRoster,
  assertCanEditScoring,
  canTransitionTournamentState,
  getNextTournamentState,
  inferTournamentStateFromStatus,
  isBracketLocked,
  isEmergencyUnlockTransition,
  isRosterLocked,
  isScoringLocked,
  normalizeTournamentState,
  tournamentStateToStatus,
} from '@/guards/tournamentState';

describe('tournamentState guards', () => {
  it('maps status values to lifecycle defaults', () => {
    expect(inferTournamentStateFromStatus('registration')).toBe('REG_OPEN');
    expect(inferTournamentStateFromStatus('active')).toBe('LIVE');
    expect(inferTournamentStateFromStatus('completed')).toBe('COMPLETED');
    expect(inferTournamentStateFromStatus('draft')).toBe('DRAFT');
    expect(inferTournamentStateFromStatus(undefined)).toBe('DRAFT');
  });

  it('normalizes to explicit state when valid, else falls back to status', () => {
    expect(normalizeTournamentState({ state: 'SEEDING', status: 'draft' })).toBe('SEEDING');
    expect(normalizeTournamentState({ state: 'BAD_STATE' as never, status: 'active' })).toBe('LIVE');
    expect(normalizeTournamentState(null)).toBe('DRAFT');
  });

  it('maps lifecycle state to storage status', () => {
    expect(tournamentStateToStatus('DRAFT')).toBe('draft');
    expect(tournamentStateToStatus('REG_CLOSED')).toBe('registration');
    expect(tournamentStateToStatus('BRACKET_LOCKED')).toBe('active');
    expect(tournamentStateToStatus('COMPLETED')).toBe('completed');
  });

  it('returns the next state in sequence and null at terminal state', () => {
    expect(getNextTournamentState('DRAFT')).toBe('REG_OPEN');
    expect(getNextTournamentState('BRACKET_LOCKED')).toBe('LIVE');
    expect(getNextTournamentState('COMPLETED')).toBeNull();
  });

  it('allows only adjacent forward transitions and same-state no-op', () => {
    expect(canTransitionTournamentState('REG_OPEN', 'REG_CLOSED')).toBe(true);
    expect(canTransitionTournamentState('REG_OPEN', 'REG_OPEN')).toBe(true);
    expect(canTransitionTournamentState('DRAFT', 'SEEDING')).toBe(false);
  });

  it('allows emergency unlock BRACKET_LOCKED -> BRACKET_GENERATED only', () => {
    expect(canTransitionTournamentState('BRACKET_LOCKED', 'BRACKET_GENERATED')).toBe(true);
    expect(canTransitionTournamentState('LIVE', 'BRACKET_GENERATED')).toBe(false);
    expect(isEmergencyUnlockTransition('BRACKET_LOCKED', 'BRACKET_GENERATED')).toBe(true);
    expect(isEmergencyUnlockTransition('LIVE', 'BRACKET_GENERATED')).toBe(false);
  });

  it('enforces roster, bracket, and scoring lock boundaries', () => {
    expect(isRosterLocked('REG_OPEN')).toBe(false);
    expect(isRosterLocked('REG_CLOSED')).toBe(true);

    expect(isBracketLocked('BRACKET_GENERATED')).toBe(false);
    expect(isBracketLocked('BRACKET_LOCKED')).toBe(true);

    expect(isScoringLocked('BRACKET_GENERATED')).toBe(false);
    expect(isScoringLocked('LIVE')).toBe(true);
  });

  it('throws lock-specific edit errors once boundaries are crossed', () => {
    expect(() => assertCanEditRoster('REG_OPEN')).not.toThrow();
    expect(() => assertCanEditBracket('BRACKET_GENERATED')).not.toThrow();
    expect(() => assertCanEditScoring('SEEDING')).not.toThrow();

    expect(() => assertCanEditRoster('REG_CLOSED')).toThrow(/Roster changes are locked/i);
    expect(() => assertCanEditBracket('BRACKET_LOCKED')).toThrow(/Bracket edits are locked/i);
    expect(() => assertCanEditScoring('LIVE')).toThrow(/Scoring format is locked/i);
  });
});
