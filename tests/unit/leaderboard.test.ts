import { describe, it, expect } from 'vitest';
import type { LeaderboardEntry } from '../../src/types/leaderboard';
import type { ResolvedMatch } from '../../src/types/leaderboard';
import type { Registration, Player, Category, Match } from '../../src/types';
import {
  aggregateStats,
  resolveParticipantName,
  applyEliminationStatus,
  sortWithBWFTiebreaker,
  resolveTieGroup,
  resolvePartialTies,
  findHeadToHeadMatch,
  groupByDescending,
  matchesToResolvedMatches,
  generateLeaderboard,
} from '../../src/composables/useLeaderboard';

// ============================================
// Test Helpers
// ============================================

function makeReg(id: string, categoryId = 'cat1', playerId?: string): Registration {
  return {
    id,
    tournamentId: 't1',
    categoryId,
    participantType: 'player',
    playerId: playerId ?? id,
    status: 'approved',
    registeredBy: 'admin',
    registeredAt: new Date(),
  };
}

function makePlayer(id: string, first: string, last: string): Player {
  return {
    id,
    firstName: first,
    lastName: last,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeCategory(id: string, format: string): Category {
  return {
    id,
    tournamentId: 't1',
    name: `Category ${id}`,
    type: 'singles',
    gender: 'men',
    ageGroup: 'open',
    format: format as Category['format'],
    seedingEnabled: false,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeMatch(
  id: string,
  p1: string,
  p2: string,
  winner: string,
  games: [number, number][],
  opts: Partial<ResolvedMatch> = {}
): ResolvedMatch {
  return {
    id,
    categoryId: 'cat1',
    participant1Id: p1,
    participant2Id: p2,
    winnerId: winner,
    scores: games.map((g, i) => ({
      gameNumber: i + 1,
      score1: g[0],
      score2: g[1],
      winnerId: g[0] > g[1] ? p1 : p2,
      isComplete: true,
    })),
    round: 1,
    ...opts,
  };
}

function makeEntry(
  id: string,
  matchPoints: number,
  overrides: Partial<LeaderboardEntry> = {}
): LeaderboardEntry {
  return {
    rank: 0,
    registrationId: id,
    participantName: id,
    participantType: 'player',
    categoryId: 'cat1',
    categoryName: 'Cat 1',
    matchesPlayed: 0,
    matchesWon: 0,
    matchesLost: 0,
    matchPoints,
    gamesWon: 0,
    gamesLost: 0,
    gameDifference: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifference: 0,
    winRate: 0,
    eliminated: false,
    ...overrides,
  };
}

function makeStoreMatch(
  id: string,
  categoryId: string,
  p1: string,
  p2: string,
  winner: string,
  games: [number, number][],
  matchNumber = 1
): Match {
  return {
    id,
    tournamentId: 't1',
    categoryId,
    round: 1,
    matchNumber,
    bracketPosition: { bracket: 'winners', round: 1, position: matchNumber },
    participant1Id: p1,
    participant2Id: p2,
    winnerId: winner,
    status: 'completed',
    scores: games.map((g, i) => ({
      gameNumber: i + 1,
      score1: g[0],
      score2: g[1],
      winnerId: g[0] > g[1] ? p1 : p2,
      isComplete: true,
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ============================================
// resolveParticipantName
// ============================================

describe('resolveParticipantName', () => {
  it('returns full names for doubles when partnerPlayerId exists', () => {
    const reg = {
      ...makeReg('r1', 'cat1', 'p1'),
      partnerPlayerId: 'p2',
      teamName: 'Baker / Baker',
    };
    const players = [makePlayer('p1', 'Alex', 'Baker'), makePlayer('p2', 'Blake', 'Baker')];
    expect(resolveParticipantName(reg, players)).toBe('Alex Baker / Blake Baker');
  });

  it('returns teamName when present', () => {
    const reg = { ...makeReg('r1'), teamName: 'Dream Team', teamId: 't1' };
    expect(resolveParticipantName(reg, [])).toBe('Dream Team');
  });

  it('returns full player name from players list', () => {
    const reg = makeReg('r1', 'cat1', 'p1');
    const players = [makePlayer('p1', 'Alice', 'Smith')];
    expect(resolveParticipantName(reg, players)).toBe('Alice Smith');
  });

  it('returns "Unknown" when player not found', () => {
    const reg = makeReg('r1', 'cat1', 'p999');
    expect(resolveParticipantName(reg, [])).toBe('Unknown');
  });

  it('returns "Unknown" when no playerId and no teamName', () => {
    const reg = { ...makeReg('r1'), playerId: undefined };
    expect(resolveParticipantName(reg, [])).toBe('Unknown');
  });
});

// ============================================
// groupByDescending
// ============================================

describe('groupByDescending', () => {
  it('groups and sorts descending', () => {
    const items = [
      { id: 'a', pts: 5 },
      { id: 'b', pts: 3 },
      { id: 'c', pts: 5 },
      { id: 'd', pts: 1 },
    ];
    const groups = groupByDescending(items, (x) => x.pts);
    expect(groups).toHaveLength(3);
    expect(groups[0].map((x) => x.id).sort()).toEqual(['a', 'c']);
    expect(groups[1].map((x) => x.id)).toEqual(['b']);
    expect(groups[2].map((x) => x.id)).toEqual(['d']);
  });

  it('returns single group when all values equal', () => {
    const items = [{ v: 1 }, { v: 1 }, { v: 1 }];
    const groups = groupByDescending(items, (x) => x.v);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });
});

// ============================================
// aggregateStats
// ============================================

describe('aggregateStats', () => {
  const catMap = new Map([['cat1', makeCategory('cat1', 'round_robin')]]);
  const players = [
    makePlayer('alice', 'Alice', 'A'),
    makePlayer('bob', 'Bob', 'B'),
  ];

  it('initializes all registrations with zero stats', () => {
    const regs = [makeReg('r1', 'cat1', 'alice'), makeReg('r2', 'cat1', 'bob')];
    const map = aggregateStats(regs, [], catMap, players);
    expect(map.size).toBe(2);
    const r1 = map.get('r1')!;
    expect(r1.matchesPlayed).toBe(0);
    expect(r1.matchPoints).toBe(0);
    expect(r1.eliminated).toBe(false);
    expect(r1.participantName).toBe('Alice A');
  });

  it('awards 2 pts for win, 1 pt for loss', () => {
    const regs = [makeReg('r1', 'cat1', 'alice'), makeReg('r2', 'cat1', 'bob')];
    const match = makeMatch('m1', 'r1', 'r2', 'r1', [[21, 15], [21, 18]]);
    const map = aggregateStats(regs, [match], catMap, players);

    const r1 = map.get('r1')!;
    const r2 = map.get('r2')!;
    expect(r1.matchesWon).toBe(1);
    expect(r1.matchPoints).toBe(2);
    expect(r2.matchesLost).toBe(1);
    expect(r2.matchPoints).toBe(1);
  });

  it('counts games won/lost from GameScore.winnerId', () => {
    const regs = [makeReg('r1', 'cat1', 'alice'), makeReg('r2', 'cat1', 'bob')];
    // r1 wins 2-1
    const match = makeMatch('m1', 'r1', 'r2', 'r1', [
      [21, 15],  // r1 wins game 1
      [18, 21],  // r2 wins game 2
      [21, 19],  // r1 wins game 3
    ]);
    const map = aggregateStats(regs, [match], catMap, players);

    expect(map.get('r1')!.gamesWon).toBe(2);
    expect(map.get('r1')!.gamesLost).toBe(1);
    expect(map.get('r2')!.gamesWon).toBe(1);
    expect(map.get('r2')!.gamesLost).toBe(2);
  });

  it('aggregates points correctly: score1 goes to p1, score2 to p2', () => {
    const regs = [makeReg('r1', 'cat1', 'alice'), makeReg('r2', 'cat1', 'bob')];
    const match = makeMatch('m1', 'r1', 'r2', 'r1', [[21, 15], [21, 18]]);
    const map = aggregateStats(regs, [match], catMap, players);

    expect(map.get('r1')!.pointsFor).toBe(21 + 21);   // 42
    expect(map.get('r1')!.pointsAgainst).toBe(15 + 18); // 33
    expect(map.get('r2')!.pointsFor).toBe(15 + 18);    // 33
    expect(map.get('r2')!.pointsAgainst).toBe(21 + 21); // 42
  });

  it('computes derived fields correctly', () => {
    const regs = [makeReg('r1', 'cat1', 'alice'), makeReg('r2', 'cat1', 'bob')];
    const match = makeMatch('m1', 'r1', 'r2', 'r1', [[21, 15], [21, 18]]);
    const map = aggregateStats(regs, [match], catMap, players);

    const r1 = map.get('r1')!;
    expect(r1.gameDifference).toBe(2 - 0);   // won both games
    expect(r1.pointDifference).toBe(42 - 33);
    expect(r1.winRate).toBe(100);
  });

  it('win rate rounds to 2 decimal places', () => {
    const regs = [makeReg('r1', 'cat1', 'alice'), makeReg('r2', 'cat1', 'bob'), makeReg('r3', 'cat1', 'alice')];
    // r1 wins 1 of 3 (33.33%)
    const catMap2 = new Map([['cat1', makeCategory('cat1', 'round_robin')]]);
    const m1 = makeMatch('m1', 'r1', 'r2', 'r2', [[15, 21], [15, 21]]);
    const m2 = makeMatch('m2', 'r1', 'r3', 'r3', [[15, 21], [15, 21]]);
    const m3 = makeMatch('m3', 'r1', 'r2', 'r1', [[21, 15], [21, 18]]);
    const map = aggregateStats(regs, [m1, m2, m3], catMap2, players);

    expect(map.get('r1')!.winRate).toBe(33.33);
  });

  it('treats walkover same as regular match', () => {
    const regs = [makeReg('r1', 'cat1', 'alice'), makeReg('r2', 'cat1', 'bob')];
    const walkover: ResolvedMatch = {
      id: 'w1',
      categoryId: 'cat1',
      participant1Id: 'r1',
      participant2Id: 'r2',
      winnerId: 'r1',
      scores: [],
      round: 1,
    };
    const map = aggregateStats(regs, [walkover], catMap, players);
    expect(map.get('r1')!.matchPoints).toBe(2);
    expect(map.get('r2')!.matchPoints).toBe(1);
  });

  it('skips match and warns when participant not in statsMap', () => {
    const regs = [makeReg('r1', 'cat1', 'alice')]; // r2 not registered
    const match = makeMatch('m1', 'r1', 'r_unknown', 'r1', [[21, 15]]);
    const map = aggregateStats(regs, [match], catMap, players);
    // Should not throw and r1 stats stay at 0 (match skipped)
    expect(map.get('r1')!.matchesPlayed).toBe(0);
  });
});

// ============================================
// applyEliminationStatus
// ============================================

describe('applyEliminationStatus', () => {
  function makeSingleElimMap(ids: string[]): Map<string, LeaderboardEntry> {
    const map = new Map<string, LeaderboardEntry>();
    ids.forEach((id) => map.set(id, makeEntry(id, 0)));
    return map;
  }

  it('does nothing for round_robin', () => {
    const statsMap = makeSingleElimMap(['r1', 'r2']);
    const match = makeMatch('m1', 'r1', 'r2', 'r1', [[21, 15]]);
    applyEliminationStatus(statsMap, [match], 'round_robin');
    expect(statsMap.get('r1')!.eliminated).toBe(false);
    expect(statsMap.get('r2')!.eliminated).toBe(false);
  });

  it('single_elimination: loser is eliminated with round recorded', () => {
    const statsMap = makeSingleElimMap(['r1', 'r2']);
    const match = makeMatch('m1', 'r1', 'r2', 'r1', [[21, 15]], { round: 2 });
    applyEliminationStatus(statsMap, [match], 'single_elimination');
    expect(statsMap.get('r2')!.eliminated).toBe(true);
    expect(statsMap.get('r2')!.eliminationRound).toBe(2);
    expect(statsMap.get('r1')!.eliminated).toBe(false);
  });

  it('single_elimination: winner is never eliminated', () => {
    const statsMap = makeSingleElimMap(['r1', 'r2', 'r3']);
    const m1 = makeMatch('m1', 'r1', 'r2', 'r1', [[21, 15]]);
    const m2 = makeMatch('m2', 'r1', 'r3', 'r1', [[21, 15]]);
    applyEliminationStatus(statsMap, [m1, m2], 'single_elimination');
    expect(statsMap.get('r1')!.eliminated).toBe(false);
  });

  it('double_elimination: winners bracket loss does NOT eliminate', () => {
    const statsMap = makeSingleElimMap(['r1', 'r2']);
    const match: ResolvedMatch = {
      ...makeMatch('m1', 'r1', 'r2', 'r1', [[21, 15]]),
      bracket: 'winners',
    };
    applyEliminationStatus(statsMap, [match], 'double_elimination');
    expect(statsMap.get('r2')!.eliminated).toBe(false);
  });

  it('double_elimination: losers bracket loss DOES eliminate', () => {
    const statsMap = makeSingleElimMap(['r1', 'r2']);
    const match: ResolvedMatch = {
      ...makeMatch('m1', 'r1', 'r2', 'r1', [[21, 15]]),
      bracket: 'losers',
    };
    applyEliminationStatus(statsMap, [match], 'double_elimination');
    expect(statsMap.get('r2')!.eliminated).toBe(true);
  });

  it('double_elimination: finals loss eliminates', () => {
    const statsMap = makeSingleElimMap(['r1', 'r2']);
    const match: ResolvedMatch = {
      ...makeMatch('m1', 'r1', 'r2', 'r1', [[21, 15]]),
      bracket: 'finals',
    };
    applyEliminationStatus(statsMap, [match], 'double_elimination');
    expect(statsMap.get('r2')!.eliminated).toBe(true);
  });

  it('pool_to_elimination: treated as single elimination', () => {
    const statsMap = makeSingleElimMap(['r1', 'r2']);
    const match = makeMatch('m1', 'r1', 'r2', 'r1', [[21, 15]]);
    applyEliminationStatus(statsMap, [match], 'pool_to_elimination');
    expect(statsMap.get('r2')!.eliminated).toBe(true);
  });
});

// ============================================
// findHeadToHeadMatch
// ============================================

describe('findHeadToHeadMatch', () => {
  const m = makeMatch('m1', 'r1', 'r2', 'r1', [[21, 15]]);

  it('finds match in original order', () => {
    expect(findHeadToHeadMatch('r1', 'r2', [m])).toBe(m);
  });

  it('finds match in reversed order', () => {
    expect(findHeadToHeadMatch('r2', 'r1', [m])).toBe(m);
  });

  it('returns undefined when no match exists', () => {
    expect(findHeadToHeadMatch('r1', 'r3', [m])).toBeUndefined();
  });
});

// ============================================
// BWF Tiebreaker: resolveTieGroup
// ============================================

describe('resolveTieGroup — two-way tie', () => {
  it('resolves by head-to-head when direct match exists', () => {
    const a = makeEntry('alice', 5);
    const b = makeEntry('bob', 5);
    const h2h = makeMatch('m1', 'alice', 'bob', 'alice', [[21, 15]]);

    const { resolved, resolution } = resolveTieGroup([a, b], [h2h], 1);

    expect(resolved[0].registrationId).toBe('alice');
    expect(resolved[1].registrationId).toBe('bob');
    expect(resolution!.step).toBe('head_to_head');
    expect(resolution!.headToHeadMatchId).toBe('m1');
  });

  it('resolves when participants appear in reversed order in match', () => {
    const a = makeEntry('alice', 5);
    const b = makeEntry('bob', 5);
    const h2h = makeMatch('m1', 'bob', 'alice', 'alice', [[21, 15]]);

    const { resolved } = resolveTieGroup([a, b], [h2h], 1);
    expect(resolved[0].registrationId).toBe('alice');
  });

  it('falls through to game difference when no h2h match', () => {
    const a = makeEntry('alice', 5, { gameDifference: 3 });
    const b = makeEntry('bob', 5, { gameDifference: 1 });

    const { resolved, resolution } = resolveTieGroup([a, b], [], 1);
    expect(resolved[0].registrationId).toBe('alice');
    expect(resolution!.step).toBe('game_difference');
  });
});

describe('resolveTieGroup — three-way tie', () => {
  it('resolves fully by game difference', () => {
    const a = makeEntry('a', 5, { gameDifference: 3 });
    const b = makeEntry('b', 5, { gameDifference: 1 });
    const c = makeEntry('c', 5, { gameDifference: -1 });

    const { resolved } = resolveTieGroup([a, b, c], [], 1);
    expect(resolved.map((e) => e.registrationId)).toEqual(['a', 'b', 'c']);
  });

  it('partially resolves by game diff, recurses for sub-group (Art. 16.2.3.1)', () => {
    // a is resolved first, b and c still tied by game diff
    const a = makeEntry('a', 5, { gameDifference: 3 });
    const b = makeEntry('b', 5, { gameDifference: 1 });
    const c = makeEntry('c', 5, { gameDifference: 1 });
    // b beat c head-to-head
    const h2h = makeMatch('m1', 'b', 'c', 'b', [[21, 18]]);

    const { resolved } = resolveTieGroup([a, b, c], [h2h], 1);
    expect(resolved[0].registrationId).toBe('a');
    expect(resolved[1].registrationId).toBe('b');
    expect(resolved[2].registrationId).toBe('c');
  });

  it('falls through to point difference when game diff all equal', () => {
    const a = makeEntry('a', 5, { gameDifference: 0, pointDifference: 10 });
    const b = makeEntry('b', 5, { gameDifference: 0, pointDifference: 5 });
    const c = makeEntry('c', 5, { gameDifference: 0, pointDifference: -2 });

    const { resolved, resolution } = resolveTieGroup([a, b, c], [], 1);
    expect(resolved.map((e) => e.registrationId)).toEqual(['a', 'b', 'c']);
    expect(resolution!.step).toBe('point_difference');
  });

  it('equal standing when all tiebreakers exhausted', () => {
    const a = makeEntry('a', 5, { gameDifference: 0, pointDifference: 0 });
    const b = makeEntry('b', 5, { gameDifference: 0, pointDifference: 0 });

    const { resolved, resolution } = resolveTieGroup([a, b], [], 1);
    expect(resolved).toHaveLength(2);
    expect(resolution!.step).toBe('equal');
  });
});

// ============================================
// sortWithBWFTiebreaker — Scenario Tests
// ============================================

describe('sortWithBWFTiebreaker', () => {
  it('Scenario A: clear winner, no ties', () => {
    const alice = makeEntry('alice', 6, { matchesWon: 3 });
    const bob = makeEntry('bob', 5, { matchesWon: 2 });
    const charlie = makeEntry('charlie', 4, { matchesWon: 1 });
    const dan = makeEntry('dan', 3, { matchesWon: 0 });

    const { sorted } = sortWithBWFTiebreaker([alice, bob, charlie, dan], []);
    expect(sorted.map((e) => e.registrationId)).toEqual(['alice', 'bob', 'charlie', 'dan']);
    expect(sorted[0].rank).toBe(1);
    expect(sorted[3].rank).toBe(4);
  });

  it('Scenario B: two-way tie resolved by h2h', () => {
    const alice = makeEntry('alice', 5);
    const bob = makeEntry('bob', 5);
    const h2h = makeMatch('m1', 'alice', 'bob', 'alice', [[21, 18]]);

    const { sorted, resolutions } = sortWithBWFTiebreaker([alice, bob], [h2h]);
    expect(sorted[0].registrationId).toBe('alice');
    expect(sorted[0].rank).toBe(1);
    expect(sorted[1].rank).toBe(2);
    expect(resolutions[0].step).toBe('head_to_head');
  });

  it('Scenario C: three-way tie, game difference fully resolves', () => {
    const alice = makeEntry('alice', 5, { gameDifference: 2 });
    const bob = makeEntry('bob', 5, { gameDifference: 1 });
    const charlie = makeEntry('charlie', 5, { gameDifference: 0 });

    const { sorted } = sortWithBWFTiebreaker([alice, bob, charlie], []);
    expect(sorted.map((e) => e.registrationId)).toEqual(['alice', 'bob', 'charlie']);
  });

  it('Scenario D: three-way tie, partial game diff then h2h subset', () => {
    const alice = makeEntry('alice', 5, { gameDifference: 2 });
    const bob = makeEntry('bob', 5, { gameDifference: 1 });
    const charlie = makeEntry('charlie', 5, { gameDifference: 1 });
    const h2h = makeMatch('m1', 'bob', 'charlie', 'bob', [[21, 18]]);

    const { sorted } = sortWithBWFTiebreaker([alice, bob, charlie], [h2h]);
    expect(sorted[0].registrationId).toBe('alice');
    expect(sorted[1].registrationId).toBe('bob');
    expect(sorted[2].registrationId).toBe('charlie');
    expect(sorted[0].rank).toBe(1);
    expect(sorted[1].rank).toBe(2);
    expect(sorted[2].rank).toBe(3);
  });

  it('Scenario E: complete deadlock — equal standing', () => {
    // Players must have matchesPlayed > 0 so the equal-standing resolution is recorded.
    // (Pre-match equal standing — all zeros — is suppressed as it's not a meaningful tie.)
    const alice = makeEntry('alice', 5, { gameDifference: 0, pointDifference: 0, matchesPlayed: 3 });
    const bob = makeEntry('bob', 5, { gameDifference: 0, pointDifference: 0, matchesPlayed: 3 });

    const { sorted, resolutions } = sortWithBWFTiebreaker([alice, bob], []);
    expect(sorted).toHaveLength(2);
    expect(resolutions[0].step).toBe('equal');
    // BWF Art. 16.2.4.2: equal standing → both get the SAME rank
    expect(sorted[0].rank).toBe(1);
    expect(sorted[1].rank).toBe(1);
  });

  it('assigns ranks correctly across multiple non-tied groups', () => {
    const a = makeEntry('a', 8);
    const b = makeEntry('b', 6);
    const c = makeEntry('c', 4);
    const d = makeEntry('d', 2);

    const { sorted } = sortWithBWFTiebreaker([d, b, a, c], []); // pass in random order
    expect(sorted[0].registrationId).toBe('a');
    expect(sorted[0].rank).toBe(1);
    expect(sorted[1].rank).toBe(2);
    expect(sorted[2].rank).toBe(3);
    expect(sorted[3].rank).toBe(4);
  });

  it('produces tiebreaker resolutions for each resolved tie', () => {
    const a = makeEntry('a', 5, { gameDifference: 2 });
    const b = makeEntry('b', 5, { gameDifference: 1 });
    const h2h = makeMatch('m1', 'a', 'b', 'a', [[21, 15]]);

    const { resolutions } = sortWithBWFTiebreaker([a, b], [h2h]);
    expect(resolutions.length).toBeGreaterThan(0);
    expect(resolutions[0].tiedRank).toBe(1);
    expect(resolutions[0].registrationIds).toContain('a');
    expect(resolutions[0].registrationIds).toContain('b');
  });
});

// ============================================
// resolvePartialTies
// ============================================

describe('resolvePartialTies', () => {
  it('single-member groups get ranked without recursion', () => {
    const a = makeEntry('a', 5);
    const b = makeEntry('b', 5);
    const groups = [[a], [b]]; // already split into single groups

    const { resolved } = resolvePartialTies(groups, [], 1, 'game_difference');
    expect(resolved[0].registrationId).toBe('a');
    expect(resolved[0].rank).toBe(1);
    expect(resolved[1].rank).toBe(2);
  });

  it('multi-member sub-group recurses into full BWF procedure', () => {
    const a = makeEntry('a', 5);
    const b = makeEntry('b', 5);
    const h2h = makeMatch('m1', 'a', 'b', 'a', [[21, 15]]);
    const groups = [[a, b]]; // one group still tied

    const { resolved } = resolvePartialTies(groups, [h2h], 1, 'game_difference');
    expect(resolved[0].registrationId).toBe('a');
    expect(resolved[1].registrationId).toBe('b');
  });
});

// ============================================
// Edge Cases
// ============================================

describe('edge cases', () => {
  it('single participant gets rank 1', () => {
    const a = makeEntry('a', 4);
    const { sorted } = sortWithBWFTiebreaker([a], []);
    expect(sorted[0].rank).toBe(1);
  });

  it('empty entries list returns empty sorted', () => {
    const { sorted, resolutions } = sortWithBWFTiebreaker([], []);
    expect(sorted).toHaveLength(0);
    expect(resolutions).toHaveLength(0);
  });

  it('aggregateStats with no matches keeps all counters at zero', () => {
    const catMap = new Map([['cat1', makeCategory('cat1', 'single_elimination')]]);
    const regs = [makeReg('r1', 'cat1', 'p1')];
    const players = [makePlayer('p1', 'Alice', 'A')];
    const map = aggregateStats(regs, [], catMap, players);
    const entry = map.get('r1')!;

    expect(entry.matchesPlayed).toBe(0);
    expect(entry.gamesWon).toBe(0);
    expect(entry.pointsFor).toBe(0);
    expect(entry.winRate).toBe(0);
    expect(entry.eliminated).toBe(false);
  });

  it('all participants tied on all metrics → equal standing for all', () => {
    // Three players, all stats identical, no h2h data. matchesPlayed > 0 so resolution is recorded.
    const a = makeEntry('a', 4, { gameDifference: 0, pointDifference: 0, matchesPlayed: 2 });
    const b = makeEntry('b', 4, { gameDifference: 0, pointDifference: 0, matchesPlayed: 2 });
    const c = makeEntry('c', 4, { gameDifference: 0, pointDifference: 0, matchesPlayed: 2 });

    const { sorted, resolutions } = sortWithBWFTiebreaker([a, b, c], []);
    expect(sorted).toHaveLength(3);
    expect(resolutions[0].step).toBe('equal');
    // BWF Art. 16.2.4.2: all three share rank 1
    expect(sorted.every((e) => e.rank === 1)).toBe(true);
  });
});

// ============================================
// matchesToResolvedMatches (bridge function)
// ============================================

describe('matchesToResolvedMatches', () => {
  function makeStoreMatch(overrides: Record<string, unknown> = {}): any {
    return {
      id: 'm1',
      categoryId: 'cat1',
      participant1Id: 'r1',
      participant2Id: 'r2',
      winnerId: 'r1',
      status: 'completed',
      scores: [{ gameNumber: 1, score1: 21, score2: 15, winnerId: 'r1', isComplete: true }],
      round: 1,
      matchNumber: 1,
      bracketPosition: { bracket: 'winners', round: 1, position: 1 },
      completedAt: new Date('2026-02-01'),
      ...overrides,
    };
  }

  it('converts completed matches to ResolvedMatch[]', () => {
    const matches = [makeStoreMatch()];
    const resolved = matchesToResolvedMatches(matches);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toEqual({
      id: 'm1',
      categoryId: 'cat1',
      participant1Id: 'r1',
      participant2Id: 'r2',
      winnerId: 'r1',
      scores: matches[0].scores,
      round: 1,
      bracket: 'winners',
      completedAt: new Date('2026-02-01'),
    });
  });

  it('includes walkover matches', () => {
    const matches = [makeStoreMatch({ status: 'walkover', scores: [] })];
    const resolved = matchesToResolvedMatches(matches);
    expect(resolved).toHaveLength(1);
  });

  it('filters out non-completed/walkover statuses', () => {
    const matches = [
      makeStoreMatch({ status: 'scheduled' }),
      makeStoreMatch({ id: 'm2', status: 'in_progress' }),
      makeStoreMatch({ id: 'm3', status: 'ready' }),
    ];
    const resolved = matchesToResolvedMatches(matches);
    expect(resolved).toHaveLength(0);
  });

  it('filters out matches with missing winnerId', () => {
    const matches = [makeStoreMatch({ winnerId: null })];
    const resolved = matchesToResolvedMatches(matches);
    expect(resolved).toHaveLength(0);
  });

  it('filters out matches with missing participant1Id', () => {
    const matches = [makeStoreMatch({ participant1Id: null })];
    const resolved = matchesToResolvedMatches(matches);
    expect(resolved).toHaveLength(0);
  });

  it('filters out matches with missing participant2Id', () => {
    const matches = [makeStoreMatch({ participant2Id: null })];
    const resolved = matchesToResolvedMatches(matches);
    expect(resolved).toHaveLength(0);
  });

  it('maps bracketPosition.bracket correctly', () => {
    const matches = [
      makeStoreMatch({ bracketPosition: { bracket: 'losers', round: 2, position: 3 } }),
    ];
    const resolved = matchesToResolvedMatches(matches);
    expect(resolved[0].bracket).toBe('losers');
  });

  it('handles undefined bracketPosition gracefully', () => {
    const matches = [makeStoreMatch({ bracketPosition: undefined })];
    const resolved = matchesToResolvedMatches(matches);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].bracket).toBeUndefined();
  });

  it('preserves all score objects', () => {
    const scores = [
      { gameNumber: 1, score1: 21, score2: 15, winnerId: 'r1', isComplete: true },
      { gameNumber: 2, score1: 18, score2: 21, winnerId: 'r2', isComplete: true },
      { gameNumber: 3, score1: 21, score2: 19, winnerId: 'r1', isComplete: true },
    ];
    const matches = [makeStoreMatch({ scores })];
    const resolved = matchesToResolvedMatches(matches);
    expect(resolved[0].scores).toHaveLength(3);
    expect(resolved[0].scores).toEqual(scores);
  });
});

describe('generateLeaderboard', () => {
  it('includes category summaries for tournament scope', async () => {
    const categories = [
      makeCategory('cat1', 'round_robin'),
      makeCategory('cat2', 'single_elimination'),
    ];
    const players = [
      makePlayer('p1', 'Alice', 'A'),
      makePlayer('p2', 'Bob', 'B'),
      makePlayer('p3', 'Cara', 'C'),
      makePlayer('p4', 'Dan', 'D'),
    ];
    const registrations = [
      makeReg('r1', 'cat1', 'p1'),
      makeReg('r2', 'cat1', 'p2'),
      makeReg('r3', 'cat2', 'p3'),
      makeReg('r4', 'cat2', 'p4'),
    ];
    const matches = [
      makeStoreMatch('m1', 'cat1', 'r1', 'r2', 'r1', [[21, 17], [21, 19]], 1),
      makeStoreMatch('m2', 'cat2', 'r3', 'r4', 'r3', [[21, 14], [21, 16]], 2),
    ];

    const leaderboard = await generateLeaderboard('t1', undefined, undefined, {
      matches,
      registrations,
      categories,
      players,
    });

    expect(leaderboard.scope).toBe('tournament');
    expect(leaderboard.categories).toBeDefined();
    expect(leaderboard.categories).toHaveLength(2);
    expect(leaderboard.categories!.map((c) => c.categoryId).sort()).toEqual(['cat1', 'cat2']);
  });

  it('respects tournament categoryIds filter and returns matching category summaries', async () => {
    const categories = [
      makeCategory('cat1', 'round_robin'),
      makeCategory('cat2', 'single_elimination'),
    ];
    const players = [
      makePlayer('p1', 'Alice', 'A'),
      makePlayer('p2', 'Bob', 'B'),
      makePlayer('p3', 'Cara', 'C'),
      makePlayer('p4', 'Dan', 'D'),
    ];
    const registrations = [
      makeReg('r1', 'cat1', 'p1'),
      makeReg('r2', 'cat1', 'p2'),
      makeReg('r3', 'cat2', 'p3'),
      makeReg('r4', 'cat2', 'p4'),
    ];
    const matches = [
      makeStoreMatch('m1', 'cat1', 'r1', 'r2', 'r1', [[21, 17], [21, 19]], 1),
      makeStoreMatch('m2', 'cat2', 'r3', 'r4', 'r3', [[21, 14], [21, 16]], 2),
    ];

    const leaderboard = await generateLeaderboard(
      't1',
      undefined,
      { categoryIds: ['cat1'] },
      { matches, registrations, categories, players }
    );

    expect(leaderboard.entries.every((entry) => entry.categoryId === 'cat1')).toBe(true);
    expect(leaderboard.categories).toHaveLength(1);
    expect(leaderboard.categories![0].categoryId).toBe('cat1');
  });
});
