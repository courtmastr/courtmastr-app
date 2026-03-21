/**
 * usePlayerMatchHistory unit tests
 *
 * Tests the fetchPlayerMatchHistory pure async function with mocked Firebase.
 * Follows the same mock pattern as matches.correction.store.test.ts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TournamentHistoryEntry } from '@/types';

// ---------------------------------------------------------------------------
// Firebase mock setup
// ---------------------------------------------------------------------------

class MockTimestamp {
  constructor(private _d: Date = new Date()) {}
  toDate() { return this._d; }
}

const mockDeps = vi.hoisted(() => ({
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  query: vi.fn((ref) => ref),
  where: vi.fn((...args) => ({ type: 'where', args })),
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  collectionGroup: vi.fn((_db: unknown, name: string) => ({ name })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  db: {},
}));

vi.mock('@/services/firebase', () => ({
  db: mockDeps.db,
  getDocs: mockDeps.getDocs,
  getDoc: mockDeps.getDoc,
  query: mockDeps.query,
  where: mockDeps.where,
  collection: mockDeps.collection,
  collectionGroup: mockDeps.collectionGroup,
  doc: mockDeps.doc,
  Timestamp: MockTimestamp,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQuerySnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
      exists: () => true,
    })),
    empty: docs.length === 0,
  };
}

function makeDocSnapshot(id: string, data: Record<string, unknown> | null) {
  return {
    id,
    exists: () => data !== null,
    data: () => data ?? undefined,
  };
}

function makeDate(daysFromNow: number): { toDate: () => Date } {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  // Return a Firestore Timestamp-like object
  return { toDate: () => d };
}

function makeTournament(id: string, name: string, daysFromNow = 0) {
  return {
    id,
    name,
    startDate: makeDate(daysFromNow),
    sport: 'badminton',
    status: 'completed',
    format: 'single_elimination',
    settings: {},
    createdBy: 'admin',
    endDate: makeDate(daysFromNow + 1),
  };
}

function makeRegistration(
  id: string,
  tournamentId: string,
  categoryId: string,
  playerId: string,
  opts: {
    participantType?: 'player' | 'team';
    partnerPlayerId?: string;
    teamName?: string;
  } = {}
) {
  return {
    id,
    tournamentId,
    categoryId,
    participantType: opts.participantType ?? 'player',
    playerId,
    partnerPlayerId: opts.partnerPlayerId,
    teamName: opts.teamName,
    status: 'approved',
    registeredBy: 'admin',
    registeredAt: makeDate(0),
  };
}

function makeMatch(
  id: string,
  participant1Id: string,
  participant2Id: string,
  winnerId: string,
  status: 'completed' | 'walkover' = 'completed',
  scores: Array<{ gameNumber: number; score1: number; score2: number; isComplete: boolean }> = []
) {
  return {
    id,
    participant1Id,
    participant2Id,
    winnerId,
    status,
    scores,
    completedAt: makeDate(0),
  };
}

function makePlayer(firstName: string, lastName: string) {
  return { firstName, lastName, email: `${firstName.toLowerCase()}@test.com` };
}

function makeCategory(id: string, name: string, type: 'singles' | 'doubles' | 'mixed_doubles' = 'singles') {
  return { id, name, type, tournamentId: 't1', gender: 'men', ageGroup: 'open' };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchPlayerMatchHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no registrations
    mockDeps.getDocs.mockResolvedValue(makeQuerySnapshot([]));
    mockDeps.getDoc.mockResolvedValue(makeDocSnapshot('', null));
  });

  it('returns empty array when player has no registrations', async () => {
    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory('player-xyz');
    expect(result).toEqual([]);
  });

  it('returns history for a singles player as primary registrant', async () => {
    const REG_ID = 'reg-alice';
    const T_ID = 't1';
    const CAT_ID = 'cat-singles';
    const PLAYER_ID = 'global-alice';
    const OPPONENT_REG_ID = 'reg-bob';
    const OPPONENT_PLAYER_ID = 'global-bob';

    const aliceReg = makeRegistration(REG_ID, T_ID, CAT_ID, PLAYER_ID);
    const bobReg = makeRegistration(OPPONENT_REG_ID, T_ID, CAT_ID, OPPONENT_PLAYER_ID);
    const match = makeMatch('match-1', REG_ID, OPPONENT_REG_ID, REG_ID, 'completed', [
      { gameNumber: 1, score1: 21, score2: 15, isComplete: true },
    ]);

    // Setup getDocs mock to return different data based on call order
    let callCount = 0;
    mockDeps.getDocs.mockImplementation(async () => {
      callCount++;
      // Call 1: collectionGroup registrations by playerId → alice's registration
      if (callCount === 1) return makeQuerySnapshot([{ id: REG_ID, data: aliceReg }]);
      // Call 2: collectionGroup registrations by partnerPlayerId → none
      if (callCount === 2) return makeQuerySnapshot([]);
      // Call 3: tournament/players
      if (callCount === 3) return makeQuerySnapshot([
        { id: PLAYER_ID, data: makePlayer('Alice', 'Smith') },
        { id: OPPONENT_PLAYER_ID, data: makePlayer('Bob', 'Jones') },
      ]);
      // Call 4: tournament/registrations
      if (callCount === 4) return makeQuerySnapshot([
        { id: REG_ID, data: aliceReg },
        { id: OPPONENT_REG_ID, data: bobReg },
      ]);
      // Call 5: tournament/categories
      if (callCount === 5) return makeQuerySnapshot([
        { id: CAT_ID, data: makeCategory(CAT_ID, "Men's Singles", 'singles') },
      ]);
      // Call 6: match_scores by participant1Id
      if (callCount === 6) return makeQuerySnapshot([{ id: 'match-1', data: match }]);
      // Call 7: match_scores by participant2Id
      if (callCount === 7) return makeQuerySnapshot([]);
      return makeQuerySnapshot([]);
    });

    mockDeps.getDoc.mockResolvedValue(
      makeDocSnapshot(T_ID, makeTournament(T_ID, 'Spring Open 2026', -10))
    );

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result: TournamentHistoryEntry[] = await fetchPlayerMatchHistory(PLAYER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].tournamentName).toBe('Spring Open 2026');
    expect(result[0].categoryType).toBe('singles');
    expect(result[0].matches).toHaveLength(1);
    expect(result[0].matches[0].result).toBe('win');
    expect(result[0].matches[0].opponentName).toBe('Bob Jones');
    expect(result[0].matches[0].partnerName).toBeUndefined();
  });

  it('marks a match as loss when opponent is the winnerId', async () => {
    const REG_ID = 'reg-alice';
    const T_ID = 't1';
    const CAT_ID = 'cat-singles';
    const PLAYER_ID = 'global-alice';
    const OPPONENT_REG_ID = 'reg-bob';
    const OPPONENT_PLAYER_ID = 'global-bob';

    const aliceReg = makeRegistration(REG_ID, T_ID, CAT_ID, PLAYER_ID);
    const bobReg = makeRegistration(OPPONENT_REG_ID, T_ID, CAT_ID, OPPONENT_PLAYER_ID);
    // Bob wins
    const match = makeMatch('match-1', REG_ID, OPPONENT_REG_ID, OPPONENT_REG_ID, 'completed');

    let callCount = 0;
    mockDeps.getDocs.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return makeQuerySnapshot([{ id: REG_ID, data: aliceReg }]);
      if (callCount === 2) return makeQuerySnapshot([]);
      if (callCount === 3) return makeQuerySnapshot([
        { id: PLAYER_ID, data: makePlayer('Alice', 'Smith') },
        { id: OPPONENT_PLAYER_ID, data: makePlayer('Bob', 'Jones') },
      ]);
      if (callCount === 4) return makeQuerySnapshot([
        { id: REG_ID, data: aliceReg },
        { id: OPPONENT_REG_ID, data: bobReg },
      ]);
      if (callCount === 5) return makeQuerySnapshot([
        { id: CAT_ID, data: makeCategory(CAT_ID, "Men's Singles", 'singles') },
      ]);
      if (callCount === 6) return makeQuerySnapshot([{ id: 'match-1', data: match }]);
      if (callCount === 7) return makeQuerySnapshot([]);
      return makeQuerySnapshot([]);
    });
    mockDeps.getDoc.mockResolvedValue(makeDocSnapshot(T_ID, makeTournament(T_ID, 'Spring Open', -10)));

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory(PLAYER_ID);

    expect(result[0].matches[0].result).toBe('loss');
  });

  it('marks a walkover match correctly', async () => {
    const REG_ID = 'reg-alice';
    const T_ID = 't1';
    const CAT_ID = 'cat-singles';
    const PLAYER_ID = 'global-alice';
    const OPPONENT_REG_ID = 'reg-bob';
    const OPPONENT_PLAYER_ID = 'global-bob';

    const aliceReg = makeRegistration(REG_ID, T_ID, CAT_ID, PLAYER_ID);
    const bobReg = makeRegistration(OPPONENT_REG_ID, T_ID, CAT_ID, OPPONENT_PLAYER_ID);
    const match = makeMatch('match-1', REG_ID, OPPONENT_REG_ID, REG_ID, 'walkover');

    let callCount = 0;
    mockDeps.getDocs.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return makeQuerySnapshot([{ id: REG_ID, data: aliceReg }]);
      if (callCount === 2) return makeQuerySnapshot([]);
      if (callCount === 3) return makeQuerySnapshot([
        { id: PLAYER_ID, data: makePlayer('Alice', 'Smith') },
        { id: OPPONENT_PLAYER_ID, data: makePlayer('Bob', 'Jones') },
      ]);
      if (callCount === 4) return makeQuerySnapshot([
        { id: REG_ID, data: aliceReg },
        { id: OPPONENT_REG_ID, data: bobReg },
      ]);
      if (callCount === 5) return makeQuerySnapshot([
        { id: CAT_ID, data: makeCategory(CAT_ID, "Men's Singles", 'singles') },
      ]);
      if (callCount === 6) return makeQuerySnapshot([{ id: 'match-1', data: match }]);
      if (callCount === 7) return makeQuerySnapshot([]);
      return makeQuerySnapshot([]);
    });
    mockDeps.getDoc.mockResolvedValue(makeDocSnapshot(T_ID, makeTournament(T_ID, 'Spring Open', -10)));

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory(PLAYER_ID);

    expect(result[0].matches[0].result).toBe('walkover');
  });

  it('returns history for doubles player as partner (not primary registrant)', async () => {
    const REG_ID = 'reg-team-ab';
    const T_ID = 't1';
    const CAT_ID = 'cat-doubles';
    const PRIMARY_PLAYER_ID = 'global-alice';
    const PARTNER_PLAYER_ID = 'global-bob'; // Bob is queried as partner
    const OPPONENT_REG_ID = 'reg-team-cd';

    const teamReg = makeRegistration(REG_ID, T_ID, CAT_ID, PRIMARY_PLAYER_ID, {
      participantType: 'team',
      partnerPlayerId: PARTNER_PLAYER_ID,
      teamName: 'Smith / Jones',
    });
    const opponentReg = makeRegistration(OPPONENT_REG_ID, T_ID, CAT_ID, 'global-charlie', {
      participantType: 'team',
      partnerPlayerId: 'global-dan',
      teamName: 'Davis / Evans',
    });
    const match = makeMatch('match-1', REG_ID, OPPONENT_REG_ID, REG_ID, 'completed');

    let callCount = 0;
    mockDeps.getDocs.mockImplementation(async () => {
      callCount++;
      // Call 1: playerId query → no primary registrations (Bob is the partner)
      if (callCount === 1) return makeQuerySnapshot([]);
      // Call 2: partnerPlayerId query → finds the team registration
      if (callCount === 2) return makeQuerySnapshot([{ id: REG_ID, data: teamReg }]);
      // Call 3: tournament/players
      if (callCount === 3) return makeQuerySnapshot([
        { id: PRIMARY_PLAYER_ID, data: makePlayer('Alice', 'Smith') },
        { id: PARTNER_PLAYER_ID, data: makePlayer('Bob', 'Jones') },
        { id: 'global-charlie', data: makePlayer('Charlie', 'Davis') },
      ]);
      // Call 4: tournament/registrations
      if (callCount === 4) return makeQuerySnapshot([
        { id: REG_ID, data: teamReg },
        { id: OPPONENT_REG_ID, data: opponentReg },
      ]);
      // Call 5: tournament/categories
      if (callCount === 5) return makeQuerySnapshot([
        { id: CAT_ID, data: makeCategory(CAT_ID, "Men's Doubles", 'doubles') },
      ]);
      // Call 6: match_scores participant1Id
      if (callCount === 6) return makeQuerySnapshot([{ id: 'match-1', data: match }]);
      // Call 7: match_scores participant2Id
      if (callCount === 7) return makeQuerySnapshot([]);
      return makeQuerySnapshot([]);
    });
    mockDeps.getDoc.mockResolvedValue(makeDocSnapshot(T_ID, makeTournament(T_ID, 'Doubles Cup', -5)));

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    // Query Bob's history (the partner)
    const result = await fetchPlayerMatchHistory(PARTNER_PLAYER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].categoryType).toBe('doubles');
    expect(result[0].matches[0].opponentName).toBe('Davis / Evans');
    // When role=partner, the "partner" from Bob's view is Alice (the primary player)
    expect(result[0].matches[0].partnerName).toBe('Alice Smith');
    expect(result[0].matches[0].result).toBe('win');
  });

  it('sorts multiple tournaments by startDate descending', async () => {
    const PLAYER_ID = 'global-alice';
    const REG1 = makeRegistration('reg-1', 't-old', 'cat-1', PLAYER_ID);
    const REG2 = makeRegistration('reg-2', 't-new', 'cat-1', PLAYER_ID);

    // t-old: 30 days ago, t-new: 10 days ago → t-new should come first
    let callCount = 0;
    mockDeps.getDocs.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return makeQuerySnapshot([
        { id: 'reg-1', data: REG1 },
        { id: 'reg-2', data: REG2 },
      ]);
      if (callCount === 2) return makeQuerySnapshot([]);
      // Per-tournament: need to handle both t-old and t-new
      // Return empty for players, registrations, categories, matches
      return makeQuerySnapshot([]);
    });

    let getDocCount = 0;
    mockDeps.getDoc.mockImplementation(async (ref: { path: string }) => {
      getDocCount++;
      if (ref?.path === 'tournaments/t-old') {
        return makeDocSnapshot('t-old', makeTournament('t-old', 'Old Tournament', -30));
      }
      if (ref?.path === 'tournaments/t-new') {
        return makeDocSnapshot('t-new', makeTournament('t-new', 'New Tournament', -10));
      }
      return makeDocSnapshot('', null);
    });

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory(PLAYER_ID);

    expect(result).toHaveLength(2);
    expect(result[0].tournamentName).toBe('New Tournament');
    expect(result[1].tournamentName).toBe('Old Tournament');
  });

  it('deduplicates matches that appear in both participant1Id and participant2Id queries', async () => {
    const REG_ID = 'reg-alice';
    const T_ID = 't1';
    const CAT_ID = 'cat-singles';
    const PLAYER_ID = 'global-alice';
    const OPPONENT_REG_ID = 'reg-bob';
    const OPPONENT_PLAYER_ID = 'global-bob';

    const aliceReg = makeRegistration(REG_ID, T_ID, CAT_ID, PLAYER_ID);
    const bobReg = makeRegistration(OPPONENT_REG_ID, T_ID, CAT_ID, OPPONENT_PLAYER_ID);
    const match = makeMatch('match-1', REG_ID, OPPONENT_REG_ID, REG_ID);

    let callCount = 0;
    mockDeps.getDocs.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return makeQuerySnapshot([{ id: REG_ID, data: aliceReg }]);
      if (callCount === 2) return makeQuerySnapshot([]);
      if (callCount === 3) return makeQuerySnapshot([
        { id: PLAYER_ID, data: makePlayer('Alice', 'Smith') },
        { id: OPPONENT_PLAYER_ID, data: makePlayer('Bob', 'Jones') },
      ]);
      if (callCount === 4) return makeQuerySnapshot([
        { id: REG_ID, data: aliceReg },
        { id: OPPONENT_REG_ID, data: bobReg },
      ]);
      if (callCount === 5) return makeQuerySnapshot([
        { id: CAT_ID, data: makeCategory(CAT_ID, "Men's Singles") },
      ]);
      // Both participant queries return the same match → should be deduplicated
      if (callCount === 6) return makeQuerySnapshot([{ id: 'match-1', data: match }]);
      if (callCount === 7) return makeQuerySnapshot([{ id: 'match-1', data: match }]);
      return makeQuerySnapshot([]);
    });
    mockDeps.getDoc.mockResolvedValue(makeDocSnapshot(T_ID, makeTournament(T_ID, 'Open')));

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory(PLAYER_ID);

    // Should have exactly 1 match, not 2
    expect(result[0].matches).toHaveLength(1);
  });
});
