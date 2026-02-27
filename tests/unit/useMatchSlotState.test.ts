import { describe, expect, it } from 'vitest';
import type { Match } from '@/types';
import { useMatchSlotState } from '@/composables/useMatchSlotState';

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: 'm-1',
  tournamentId: 't-1',
  categoryId: 'c-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  status: 'ready',
  scores: [],
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
  ...overrides,
});

describe('useMatchSlotState', () => {
  const slotState = useMatchSlotState();

  it('returns resolved for populated slots', () => {
    const match = makeMatch({
      participant1Id: 'reg-1',
      participant2Id: 'reg-2',
    });

    expect(slotState.getSlotState(match, 'participant1')).toBe('resolved');
    expect(slotState.getSlotState(match, 'participant2')).toBe('resolved');
  });

  it('returns bye for missing slot when match is finalized with winner', () => {
    const match = makeMatch({
      participant1Id: 'reg-1',
      participant2Id: undefined,
      winnerId: 'reg-1',
    });

    expect(slotState.getSlotState(match, 'participant2')).toBe('bye');
    expect(slotState.isByeMatch(match)).toBe(true);
    expect(slotState.isSchedulableMatch(match)).toBe(false);
  });

  it('returns bye for missing slot when match status is walkover/completed', () => {
    const walkoverMatch = makeMatch({
      participant1Id: 'reg-1',
      participant2Id: undefined,
      status: 'walkover',
    });
    const completedMatch = makeMatch({
      participant1Id: 'reg-1',
      participant2Id: undefined,
      status: 'completed',
    });

    expect(slotState.getSlotState(walkoverMatch, 'participant2')).toBe('bye');
    expect(slotState.getSlotState(completedMatch, 'participant2')).toBe('bye');
  });

  it('returns tbd for missing slot when match is not finalized', () => {
    const match = makeMatch({
      participant1Id: 'reg-1',
      participant2Id: undefined,
      winnerId: undefined,
      status: 'ready',
    });

    expect(slotState.getSlotState(match, 'participant2')).toBe('tbd');
    expect(slotState.isByeMatch(match)).toBe(false);
    expect(slotState.isTbdMatch(match)).toBe(true);
    expect(slotState.isSchedulableMatch(match)).toBe(true);
  });

  it('returns tbd when both slots are missing', () => {
    const match = makeMatch({
      participant1Id: undefined,
      participant2Id: undefined,
    });

    expect(slotState.getSlotState(match, 'participant1')).toBe('tbd');
    expect(slotState.getSlotState(match, 'participant2')).toBe('tbd');
    expect(slotState.isByeMatch(match)).toBe(false);
    expect(slotState.isTbdMatch(match)).toBe(true);
  });

  it('getSlotLabel returns BYE/TBD/resolved name consistently', () => {
    const byeMatch = makeMatch({
      participant1Id: 'reg-1',
      participant2Id: undefined,
      winnerId: 'reg-1',
    });

    const tbdMatch = makeMatch({
      participant1Id: 'reg-1',
      participant2Id: undefined,
      status: 'ready',
    });

    const resolvedMatch = makeMatch({
      participant1Id: 'reg-1',
      participant2Id: 'reg-2',
    });

    const resolver = (registrationId: string | undefined): string => registrationId ? `Name:${registrationId}` : 'Unknown';

    expect(slotState.getSlotLabel(byeMatch, 'participant2', resolver)).toBe('BYE');
    expect(slotState.getSlotLabel(tbdMatch, 'participant2', resolver)).toBe('TBD');
    expect(slotState.getSlotLabel(resolvedMatch, 'participant1', resolver)).toBe('Name:reg-1');
  });

  it('isSchedulableMatch is false for terminal statuses even when no bye', () => {
    const cancelled = makeMatch({
      participant1Id: 'reg-1',
      participant2Id: 'reg-2',
      status: 'cancelled',
    });

    expect(slotState.isSchedulableMatch(cancelled)).toBe(false);
  });
});
