/**
 * player-match-history integration tests
 *
 * Tests fetchPlayerMatchHistory with realistic mock data covering
 * the full cross-collection resolution path.
 *
 * Follows the same vi.mock pattern as other integration tests in this project.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TournamentHistoryEntry } from '@/types';

// ---------------------------------------------------------------------------
// Firebase mock (same pattern as correction.store.test.ts)
// ---------------------------------------------------------------------------

class MockTimestamp {
  constructor(private _d: Date = new Date()) {}
  toDate() { return this._d; }
}

const mockFn = vi.hoisted(() => ({
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  query: vi.fn((ref) => ref),
  where: vi.fn(),
  collection: vi.fn((_db: unknown, path: string) => ({ path })),
  collectionGroup: vi.fn((_db: unknown, name: string) => ({ name })),
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  db: {},
}));

vi.mock('@/services/firebase', () => ({
  db: mockFn.db,
  getDocs: mockFn.getDocs,
  getDoc: mockFn.getDoc,
  query: mockFn.query,
  where: mockFn.where,
  collection: mockFn.collection,
  collectionGroup: mockFn.collectionGroup,
  doc: mockFn.doc,
  Timestamp: MockTimestamp,
}));

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function qs(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
      exists: () => true,
    })),
    empty: docs.length === 0,
  };
}

function ds(id: string, data: Record<string, unknown> | null) {
  return { id, exists: () => data !== null, data: () => data ?? undefined };
}

function timestamp(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return { toDate: () => d };
}

// ---------------------------------------------------------------------------

describe('fetchPlayerMatchHistory — integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFn.getDocs.mockResolvedValue(qs([]));
    mockFn.getDoc.mockResolvedValue(ds('', null));
  });

  it('returns empty array when player has no registrations in any tournament', async () => {
    mockFn.getDocs.mockResolvedValue(qs([]));

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory('no-matches-player');
    expect(result).toEqual([]);
  });

  it('resolves a complete singles match history with player names', async () => {
    const PLAYER_ID = 'global-alice';
    const REG_ID = 'reg-alice';
    const T_ID = 'tournament-spring';
    const CAT_ID = 'cat-singles';
    const OPP_REG_ID = 'reg-bob';
    const OPP_PLAYER_ID = 'global-bob';

    const aliceReg = {
      id: REG_ID, tournamentId: T_ID, categoryId: CAT_ID,
      participantType: 'player', playerId: PLAYER_ID,
      status: 'approved', registeredBy: 'admin', registeredAt: timestamp(-5),
    };
    const bobReg = {
      id: OPP_REG_ID, tournamentId: T_ID, categoryId: CAT_ID,
      participantType: 'player', playerId: OPP_PLAYER_ID,
      status: 'approved', registeredBy: 'admin', registeredAt: timestamp(-5),
    };
    const match = {
      id: 'match-sf',
      participant1Id: REG_ID,
      participant2Id: OPP_REG_ID,
      winnerId: REG_ID,
      status: 'completed',
      scores: [
        { gameNumber: 1, score1: 21, score2: 15, isComplete: true },
        { gameNumber: 2, score1: 21, score2: 18, isComplete: true },
      ],
      completedAt: timestamp(-4),
    };
    const tournament = {
      id: T_ID, name: 'Spring Open 2026', startDate: timestamp(-7),
      sport: 'badminton', status: 'completed', format: 'single_elimination',
      settings: {}, createdBy: 'admin', endDate: timestamp(-6),
    };

    let callCount = 0;
    mockFn.getDocs.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return qs([{ id: REG_ID, data: aliceReg }]); // playerId collectionGroup
      if (callCount === 2) return qs([]);                                 // partnerPlayerId collectionGroup
      if (callCount === 3) return qs([                                    // tournament/players
        { id: PLAYER_ID, data: { firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com' } },
        { id: OPP_PLAYER_ID, data: { firstName: 'Bob', lastName: 'Jones', email: 'bob@test.com' } },
      ]);
      if (callCount === 4) return qs([                                    // tournament/registrations
        { id: REG_ID, data: aliceReg },
        { id: OPP_REG_ID, data: bobReg },
      ]);
      if (callCount === 5) return qs([                                    // tournament/categories
        { id: CAT_ID, data: { id: CAT_ID, name: "Men's Singles", type: 'singles', tournamentId: T_ID, gender: 'men', ageGroup: 'open' } },
      ]);
      if (callCount === 6) return qs([{ id: 'match-sf', data: match }]); // match_scores participant1Id
      if (callCount === 7) return qs([]);                                 // match_scores participant2Id
      return qs([]);
    });
    mockFn.getDoc.mockResolvedValue(ds(T_ID, tournament));

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result: TournamentHistoryEntry[] = await fetchPlayerMatchHistory(PLAYER_ID);

    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry.tournamentName).toBe('Spring Open 2026');
    expect(entry.sport).toBe('badminton');
    expect(entry.categoryName).toBe("Men's Singles");
    expect(entry.categoryType).toBe('singles');
    expect(entry.matches).toHaveLength(1);

    const m = entry.matches[0];
    expect(m.matchId).toBe('match-sf');
    expect(m.result).toBe('win');
    expect(m.opponentName).toBe('Bob Jones');
    expect(m.partnerName).toBeUndefined();
    expect(m.scores).toHaveLength(2);
    expect(m.scores[0]).toMatchObject({ gameNumber: 1, score1: 21, score2: 15 });
  });

  it('resolves doubles history with partner name and team opponent name', async () => {
    const ALICE_ID = 'global-alice';
    const BOB_ID = 'global-bob';
    const T_ID = 'tournament-doubles';
    const CAT_ID = 'cat-doubles';
    const TEAM_REG_ID = 'reg-alice-bob';
    const OPP_REG_ID = 'reg-charlie-dan';

    const aliceBobReg = {
      id: TEAM_REG_ID, tournamentId: T_ID, categoryId: CAT_ID,
      participantType: 'team', playerId: ALICE_ID, partnerPlayerId: BOB_ID,
      teamName: 'Smith / Jones',
      status: 'approved', registeredBy: 'admin', registeredAt: timestamp(-3),
    };
    const charlieDanReg = {
      id: OPP_REG_ID, tournamentId: T_ID, categoryId: CAT_ID,
      participantType: 'team', playerId: 'global-charlie', partnerPlayerId: 'global-dan',
      teamName: 'Davis / Evans',
      status: 'approved', registeredBy: 'admin', registeredAt: timestamp(-3),
    };
    const match = {
      id: 'match-final',
      participant1Id: TEAM_REG_ID, participant2Id: OPP_REG_ID,
      winnerId: TEAM_REG_ID, status: 'completed',
      scores: [{ gameNumber: 1, score1: 21, score2: 19, isComplete: true }],
      completedAt: timestamp(-1),
    };
    const tournament = {
      id: T_ID, name: 'Doubles Cup', startDate: timestamp(-5),
      sport: 'badminton', status: 'completed', format: 'single_elimination',
      settings: {}, createdBy: 'admin', endDate: timestamp(-4),
    };

    let callCount = 0;
    mockFn.getDocs.mockImplementation(async () => {
      callCount++;
      // Query as Bob (the partner)
      if (callCount === 1) return qs([]);                                           // playerId → none
      if (callCount === 2) return qs([{ id: TEAM_REG_ID, data: aliceBobReg }]);    // partnerPlayerId → team reg
      if (callCount === 3) return qs([                                              // players
        { id: ALICE_ID, data: { firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com' } },
        { id: BOB_ID, data: { firstName: 'Bob', lastName: 'Jones', email: 'bob@test.com' } },
        { id: 'global-charlie', data: { firstName: 'Charlie', lastName: 'Davis', email: 'charlie@test.com' } },
      ]);
      if (callCount === 4) return qs([                                              // registrations
        { id: TEAM_REG_ID, data: aliceBobReg },
        { id: OPP_REG_ID, data: charlieDanReg },
      ]);
      if (callCount === 5) return qs([                                              // categories
        { id: CAT_ID, data: { id: CAT_ID, name: "Men's Doubles", type: 'doubles', tournamentId: T_ID, gender: 'men', ageGroup: 'open' } },
      ]);
      if (callCount === 6) return qs([{ id: 'match-final', data: match }]);        // participant1Id match
      if (callCount === 7) return qs([]);                                           // participant2Id match
      return qs([]);
    });
    mockFn.getDoc.mockResolvedValue(ds(T_ID, tournament));

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    // Bob is querying HIS history
    const result = await fetchPlayerMatchHistory(BOB_ID);

    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry.categoryType).toBe('doubles');

    const m = entry.matches[0];
    expect(m.result).toBe('win');
    // Opponent team name comes from teamName field
    expect(m.opponentName).toBe('Davis / Evans');
    // Bob's partner is Alice (the primary player, since Bob queried as 'partner' role)
    expect(m.partnerName).toBe('Alice Smith');
  });

  it('returns two entries when player appears in two tournaments', async () => {
    const PLAYER_ID = 'global-alice';
    const REG1 = {
      id: 'reg-t1', tournamentId: 'tournament-a', categoryId: 'cat-1',
      participantType: 'player', playerId: PLAYER_ID,
      status: 'approved', registeredBy: 'admin', registeredAt: timestamp(-20),
    };
    const REG2 = {
      id: 'reg-t2', tournamentId: 'tournament-b', categoryId: 'cat-2',
      participantType: 'player', playerId: PLAYER_ID,
      status: 'approved', registeredBy: 'admin', registeredAt: timestamp(-5),
    };

    let callCount = 0;
    mockFn.getDocs.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return qs([
        { id: 'reg-t1', data: REG1 },
        { id: 'reg-t2', data: REG2 },
      ]);
      if (callCount === 2) return qs([]);
      // For each tournament: players, regs, cats, match x2 → 5 calls each × 2 tournaments = 10 more
      // All empty for simplicity
      return qs([]);
    });

    mockFn.getDoc.mockImplementation(async (ref: { path: string }) => {
      if (ref.path === 'tournaments/tournament-a') {
        return ds('tournament-a', {
          id: 'tournament-a', name: 'Tournament A', startDate: timestamp(-25),
          sport: 'badminton', status: 'completed', format: 'single_elimination',
          settings: {}, createdBy: 'admin', endDate: timestamp(-24),
        });
      }
      if (ref.path === 'tournaments/tournament-b') {
        return ds('tournament-b', {
          id: 'tournament-b', name: 'Tournament B', startDate: timestamp(-7),
          sport: 'badminton', status: 'completed', format: 'single_elimination',
          settings: {}, createdBy: 'admin', endDate: timestamp(-6),
        });
      }
      return ds('', null);
    });

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory(PLAYER_ID);

    // Should have 2 entries, sorted newest first
    expect(result).toHaveLength(2);
    expect(result[0].tournamentName).toBe('Tournament B');
    expect(result[1].tournamentName).toBe('Tournament A');
  });

  it('returns empty matches array when player is registered but has no completed matches', async () => {
    const PLAYER_ID = 'global-alice';
    const T_ID = 'tournament-pending';
    const CAT_ID = 'cat-singles';
    const REG_ID = 'reg-alice';

    const aliceReg = {
      id: REG_ID, tournamentId: T_ID, categoryId: CAT_ID,
      participantType: 'player', playerId: PLAYER_ID,
      status: 'approved', registeredBy: 'admin', registeredAt: timestamp(0),
    };
    const tournament = {
      id: T_ID, name: 'Live Tournament', startDate: timestamp(1),
      sport: 'badminton', status: 'active', format: 'single_elimination',
      settings: {}, createdBy: 'admin', endDate: timestamp(2),
    };

    let callCount = 0;
    mockFn.getDocs.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return qs([{ id: REG_ID, data: aliceReg }]);
      if (callCount === 2) return qs([]);
      if (callCount === 3) return qs([
        { id: PLAYER_ID, data: { firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com' } },
      ]);
      if (callCount === 4) return qs([{ id: REG_ID, data: aliceReg }]);
      if (callCount === 5) return qs([
        { id: CAT_ID, data: { id: CAT_ID, name: "Men's Singles", type: 'singles', tournamentId: T_ID, gender: 'men', ageGroup: 'open' } },
      ]);
      // No completed matches
      return qs([]);
    });
    mockFn.getDoc.mockResolvedValue(ds(T_ID, tournament));

    const { fetchPlayerMatchHistory } = await import('@/composables/usePlayerMatchHistory');
    const result = await fetchPlayerMatchHistory(PLAYER_ID);

    expect(result).toHaveLength(1);
    expect(result[0].matches).toHaveLength(0);
  });
});
