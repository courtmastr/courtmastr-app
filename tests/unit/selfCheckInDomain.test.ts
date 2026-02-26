import { describe, expect, it } from 'vitest';
import type { Registration } from '@/types';
import {
  deriveRegistrationStatusFromPresence,
  getRequiredParticipantIds,
  normalizeSelfCheckInQuery,
} from '@/features/checkin/composables/selfCheckInDomain';

const makeRegistration = (
  overrides: Partial<Registration> = {}
): Registration => ({
  id: 'reg-1',
  tournamentId: 't-1',
  categoryId: 'cat-1',
  participantType: 'player',
  playerId: 'p1',
  status: 'approved',
  registeredBy: 'admin-1',
  registeredAt: new Date('2026-02-26T10:00:00.000Z'),
  participantPresence: { p1: true },
  checkInSource: 'kiosk',
  ...overrides,
});

describe('selfCheckInDomain', () => {
  it('returns both player and partner ids for doubles registration', () => {
    const registration = makeRegistration({
      participantType: 'team',
      partnerPlayerId: 'p2',
    });

    expect(getRequiredParticipantIds(registration)).toEqual(['p1', 'p2']);
  });

  it('keeps status approved when partner is still missing', () => {
    const registration = makeRegistration({
      participantType: 'team',
      partnerPlayerId: 'p2',
      status: 'approved',
    });

    expect(
      deriveRegistrationStatusFromPresence(registration, { p1: true })
    ).toBe('approved');
  });

  it('switches to checked_in when all required participants are present', () => {
    const registration = makeRegistration({
      participantType: 'team',
      partnerPlayerId: 'p2',
      status: 'approved',
    });

    expect(
      deriveRegistrationStatusFromPresence(registration, { p1: true, p2: true })
    ).toBe('checked_in');
  });

  it('keeps non-eligible statuses unchanged', () => {
    const registration = makeRegistration({
      status: 'no_show',
      participantType: 'team',
      partnerPlayerId: 'p2',
    });

    expect(
      deriveRegistrationStatusFromPresence(registration, { p1: true, p2: true })
    ).toBe('no_show');
  });

  it('normalizes search query safely', () => {
    expect(normalizeSelfCheckInQuery('  AAnya  ')).toBe('aanya');
  });
});
