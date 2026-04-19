import { describe, expect, it } from 'vitest';
import {
  buildPoolStandingsEntries,
  comparePoolStandingsEntries,
  sortRegistrationsForPoolStandings,
  toPoolStandingsParticipants,
  type PoolStandingsEntry,
} from '@/utils/poolStandings';

const makeEntry = (
  registrationId: string,
  overrides: Partial<PoolStandingsEntry> = {}
): PoolStandingsEntry => ({
  registrationId,
  participantName: registrationId,
  played: 3,
  matchesWon: 3,
  matchesLost: 0,
  matchPoints: 6,
  gamesWon: 6,
  gamesLost: 0,
  gameDifference: 6,
  pointsFor: 90,
  pointsAgainst: 59,
  pointDifference: 31,
  ...overrides,
});

describe('poolStandings', () => {
  it('prefers game difference before point difference', () => {
    const higherGameDiff = makeEntry('reg-1', {
      gameDifference: 6,
      pointDifference: 31,
      pointsFor: 90,
      pointsAgainst: 59,
    });
    const higherPointDiff = makeEntry('reg-2', {
      gameDifference: 5,
      pointDifference: 105,
      pointsFor: 105,
      pointsAgainst: 0,
    });

    const sorted = [higherPointDiff, higherGameDiff].sort(comparePoolStandingsEntries);

    expect(sorted.map((entry) => entry.registrationId)).toEqual(['reg-1', 'reg-2']);
  });

  it('counts games, points, and walkovers using the smart-bracket standings rules', () => {
    const standings = buildPoolStandingsEntries(
      [
        { registrationId: 'reg-1', participantName: 'Alpha' },
        { registrationId: 'reg-2', participantName: 'Bravo' },
        { registrationId: 'reg-3', participantName: 'Charlie' },
      ],
      [
        {
          participant1Id: 'reg-1',
          participant2Id: 'reg-2',
          winnerId: 'reg-1',
          status: 'completed',
          scores: [
            { score1: 21, score2: 18 },
            { score1: 21, score2: 19 },
          ],
        },
        {
          participant1Id: 'reg-1',
          participant2Id: undefined,
          winnerId: 'reg-1',
          status: 'walkover',
          scores: [],
        },
      ]
    );

    expect(standings[0]).toMatchObject({
      registrationId: 'reg-1',
      played: 2,
      matchesWon: 2,
      matchesLost: 0,
      matchPoints: 4,
      gamesWon: 2,
      gamesLost: 0,
      gameDifference: 2,
      pointsFor: 42,
      pointsAgainst: 37,
      pointDifference: 5,
    });

    expect(standings[1]).toMatchObject({
      registrationId: 'reg-2',
      played: 1,
      matchesWon: 0,
      matchesLost: 1,
      matchPoints: 1,
      gamesWon: 0,
      gamesLost: 2,
      gameDifference: -2,
      pointsFor: 37,
      pointsAgainst: 42,
      pointDifference: -5,
    });

    expect(standings[2]).toMatchObject({
      registrationId: 'reg-3',
      played: 0,
      matchesWon: 0,
      matchesLost: 0,
      matchPoints: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDifference: 0,
      pointDifference: 0,
    });
  });

  it('uses registeredAt-desc fallback order when all pool metrics are tied', () => {
    const participants = toPoolStandingsParticipants(
      [
        { id: 'reg-baker', registeredAt: new Date('2026-04-18T10:00:00.000Z') },
        { id: 'reg-harris', registeredAt: new Date('2026-04-18T10:05:00.000Z') },
      ],
      (registration) => registration.id,
    );

    const standings = buildPoolStandingsEntries(participants, []);

    expect(standings.map((entry) => entry.registrationId)).toEqual(['reg-harris', 'reg-baker']);
  });

  it('sorts raw registrations into the same fallback order used by smart-bracket standings', () => {
    const registrations = sortRegistrationsForPoolStandings([
      { id: 'reg-1', registeredAt: new Date('2026-04-18T10:00:00.000Z') },
      { id: 'reg-2', registeredAt: new Date('2026-04-18T10:05:00.000Z') },
      { id: 'reg-3', registeredAt: new Date('2026-04-18T10:05:00.000Z') },
    ]);

    expect(registrations.map((registration) => registration.id)).toEqual(['reg-2', 'reg-3', 'reg-1']);
  });
});
