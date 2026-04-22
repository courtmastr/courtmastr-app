import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentUpdated: (_path: string, handler: unknown) => handler,
}));

vi.mock('firebase-admin', () => ({
  firestore: {
    FieldValue: {
      increment: vi.fn(),
      serverTimestamp: vi.fn(),
    },
  },
}));

import {
  applyMatchScoreDeltas,
  buildMatchScoreCollectionTargets,
  buildRegistrationLookup,
} from '../../functions/src/playerStats';

const getDelta = (
  deltas: Map<string, Map<string, Map<string, { wins: number; losses: number; gamesPlayed: number }>>>,
  playerId: string,
  sport = 'badminton',
  categoryType = 'doubles',
) => deltas.get(playerId)?.get(sport)?.get(categoryType);

describe('playerStats helpers', () => {
  it('builds registration lookups that keep doubles partners together', () => {
    const lookup = buildRegistrationLookup([
      {
        id: 'reg-team-1',
        playerId: 'player-a',
        partnerPlayerId: 'player-b',
        categoryId: 'cat-md',
      },
      {
        id: 'reg-singles-1',
        playerId: 'player-c',
        categoryId: 'cat-ms',
      },
    ]);

    expect(lookup.get('reg-team-1')).toEqual({
      playerIds: ['player-a', 'player-b'],
      categoryId: 'cat-md',
    });
    expect(lookup.get('reg-singles-1')).toEqual({
      playerIds: ['player-c'],
      categoryId: 'cat-ms',
    });
  });

  it('builds category and level match score collection targets', () => {
    const targets = buildMatchScoreCollectionTargets(
      'tournament-1',
      ['cat-a', 'cat-b'],
      {
        'cat-a': ['level-1', 'level-2'],
        'cat-b': [],
      }
    );

    expect(targets).toEqual([
      {
        categoryId: 'cat-a',
        path: 'tournaments/tournament-1/categories/cat-a/match_scores',
      },
      {
        categoryId: 'cat-a',
        levelId: 'level-1',
        path: 'tournaments/tournament-1/categories/cat-a/levels/level-1/match_scores',
      },
      {
        categoryId: 'cat-a',
        levelId: 'level-2',
        path: 'tournaments/tournament-1/categories/cat-a/levels/level-2/match_scores',
      },
      {
        categoryId: 'cat-b',
        path: 'tournaments/tournament-1/categories/cat-b/match_scores',
      },
    ]);
  });

  it('credits every player on a doubles registration when a match completes', () => {
    const registrationLookup = buildRegistrationLookup([
      {
        id: 'reg-winners',
        playerId: 'winner-a',
        partnerPlayerId: 'winner-b',
        categoryId: 'cat-md',
      },
      {
        id: 'reg-losers',
        playerId: 'loser-a',
        partnerPlayerId: 'loser-b',
        categoryId: 'cat-md',
      },
    ]);
    const categoryTypeMap = new Map([['cat-md', 'doubles']]);
    const deltas = new Map();

    applyMatchScoreDeltas(deltas, registrationLookup, categoryTypeMap, 'badminton', {
      categoryId: 'cat-md',
      participant1Id: 'reg-winners',
      participant2Id: 'reg-losers',
      winnerId: 'reg-winners',
      scores: [
        { score1: 21, score2: 14, isComplete: true },
        { score1: 18, score2: 21, isComplete: true },
        { score1: 21, score2: 16, isComplete: true },
      ],
    });

    expect(getDelta(deltas, 'winner-a')).toEqual({ wins: 1, losses: 0, gamesPlayed: 3 });
    expect(getDelta(deltas, 'winner-b')).toEqual({ wins: 1, losses: 0, gamesPlayed: 3 });
    expect(getDelta(deltas, 'loser-a')).toEqual({ wins: 0, losses: 1, gamesPlayed: 3 });
    expect(getDelta(deltas, 'loser-b')).toEqual({ wins: 0, losses: 1, gamesPlayed: 3 });
  });

  it('records walkovers without inventing game counts', () => {
    const registrationLookup = buildRegistrationLookup([
      {
        id: 'reg-a',
        playerId: 'player-a',
        categoryId: 'cat-singles',
      },
      {
        id: 'reg-b',
        playerId: 'player-b',
        categoryId: 'cat-singles',
      },
    ]);
    const categoryTypeMap = new Map([['cat-singles', 'singles']]);
    const deltas = new Map();

    applyMatchScoreDeltas(deltas, registrationLookup, categoryTypeMap, 'badminton', {
      categoryId: 'cat-singles',
      participant1Id: 'reg-a',
      participant2Id: 'reg-b',
      winnerId: 'reg-b',
      scores: [],
    });

    expect(getDelta(deltas, 'player-a', 'badminton', 'singles')).toEqual({
      wins: 0,
      losses: 1,
      gamesPlayed: 0,
    });
    expect(getDelta(deltas, 'player-b', 'badminton', 'singles')).toEqual({
      wins: 1,
      losses: 0,
      gamesPlayed: 0,
    });
  });
});
