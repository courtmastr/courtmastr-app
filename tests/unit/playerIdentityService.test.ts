import { describe, it, expect } from 'vitest';
import { rankCandidates } from '@/services/playerIdentityService';
import type { GlobalPlayer } from '@/types';

const makePlayer = (overrides: Partial<GlobalPlayer> = {}): GlobalPlayer => ({
  id: 'p1',
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice@test.com',
  emailNormalized: 'alice@test.com',
  phone: '555-1234',
  userId: null,
  isActive: true,
  isVerified: false,
  identityStatus: 'active',
  mergedIntoPlayerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  stats: { overall: { wins: 0, losses: 0, gamesPlayed: 0, tournamentsPlayed: 0 } },
  ...overrides,
});

describe('rankCandidates', () => {
  it('returns empty array when no players provided', () => {
    expect(rankCandidates([], { firstName: 'Alice', lastName: 'Smith' })).toEqual([]);
  });

  it('matches by userId first (highest priority)', () => {
    const players = [
      makePlayer({ id: 'p1', userId: 'u1' }),
      makePlayer({ id: 'p2', userId: 'u2' }),
    ];
    const results = rankCandidates(players, { userId: 'u1', firstName: 'Alice', lastName: 'Smith' });
    expect(results[0].player.id).toBe('p1');
    expect(results[0].matchedSignals).toContain('userId');
  });

  it('matches name+phone when both present', () => {
    const players = [makePlayer({ id: 'p1', phone: '555-1234' })];
    const results = rankCandidates(players, {
      firstName: 'Alice', lastName: 'Smith', phone: '555-1234',
    });
    expect(results[0].matchedSignals).toContain('name+phone');
  });

  it('matches name+email when phone absent', () => {
    const players = [makePlayer({ id: 'p1', email: 'alice@test.com', phone: null })];
    const results = rankCandidates(players, {
      firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com',
    });
    expect(results[0].matchedSignals).toContain('name+email');
  });

  it('skips tombstoned (merged) players', () => {
    const players = [makePlayer({ id: 'p1', identityStatus: 'merged' })];
    const results = rankCandidates(players, { firstName: 'Alice', lastName: 'Smith' });
    expect(results).toHaveLength(0);
  });

  it('skips inactive players', () => {
    const players = [makePlayer({ id: 'p1', isActive: false })];
    const results = rankCandidates(players, { firstName: 'Alice', lastName: 'Smith' });
    expect(results).toHaveLength(0);
  });

  it('email-only match has lower score than name match', () => {
    const players = [makePlayer({ id: 'p1', firstName: 'Bob', lastName: 'Jones' })];
    const results = rankCandidates(players, {
      firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com',
    });
    expect(results[0].matchedSignals).toContain('email');
    expect(results[0].matchScore).toBeLessThan(10);
  });
});
