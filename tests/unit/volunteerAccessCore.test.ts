import { describe, expect, it } from 'vitest';
import {
  assertVolunteerSessionAccess,
  decryptPin,
  encryptPin,
  issueVolunteerSessionToken,
  verifyVolunteerSessionToken,
} from '../../functions/src/volunteerAccessCore';

describe('volunteerAccessCore', () => {
  it('round-trips an encrypted PIN', () => {
    const secret = 'pin-secret-123456789012345678901234';
    const encrypted = encryptPin('4829', secret);

    expect(encrypted).not.toBe('4829');
    expect(decryptPin(encrypted, secret)).toBe('4829');
  });

  it('rejects tampered volunteer session tokens', () => {
    const token = issueVolunteerSessionToken({
      tournamentId: 't1',
      role: 'checkin',
      pinRevision: 3,
      issuedAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
    }, 'session-secret');

    expect(() => verifyVolunteerSessionToken(`${token}x`, 'session-secret')).toThrow(/invalid/i);
  });

  it('rejects volunteer sessions whose pin revision no longer matches the tournament config', () => {
    expect(() => assertVolunteerSessionAccess({
      payload: {
        tournamentId: 't1',
        role: 'scorekeeper',
        pinRevision: 2,
        issuedAtMs: Date.now(),
        expiresAtMs: Date.now() + 60_000,
      },
      tournamentId: 't1',
      role: 'scorekeeper',
      accessEntry: {
        encryptedPin: 'encrypted-pin',
        enabled: true,
        pinRevision: 3,
      },
    })).toThrow(/expired/i);
  });

  it('accepts a volunteer session when tournament, role, and revision all match', () => {
    const payload = assertVolunteerSessionAccess({
      payload: {
        tournamentId: 't1',
        role: 'checkin',
        pinRevision: 5,
        issuedAtMs: Date.now(),
        expiresAtMs: Date.now() + 60_000,
      },
      tournamentId: 't1',
      role: 'checkin',
      accessEntry: {
        encryptedPin: 'encrypted-pin',
        enabled: true,
        pinRevision: 5,
      },
    });

    expect(payload.role).toBe('checkin');
    expect(payload.pinRevision).toBe(5);
  });
});
