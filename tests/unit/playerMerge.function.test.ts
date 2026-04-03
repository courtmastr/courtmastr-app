import { beforeEach, describe, expect, it, vi } from 'vitest';

const serverTimestampMock = vi.hoisted(() => vi.fn(() => 'SERVER_TIMESTAMP'));

vi.mock('firebase-functions', () => ({
  https: {
    onCall: (handler: unknown) => handler,
    HttpsError: class HttpsError extends Error {
      code: string;

      constructor(code: string, message: string) {
        super(message);
        this.name = 'HttpsError';
        this.code = code;
      }
    },
  },
}));

vi.mock('firebase-admin', () => ({
  firestore: vi.fn(),
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: serverTimestampMock,
  },
}));

import {
  buildMergeRegistrationPlan,
  executeMergeLogic,
  mergePlayerStats,
  type MergeDbAdapter,
  type MergePlayerRecord,
  type MergeRegistrationRecord,
} from '../../functions/src/playerMerge';

interface CapturedUpdate {
  path: string;
  data: Record<string, unknown>;
}

class FakeBatch {
  readonly updates: CapturedUpdate[] = [];
  commitCount = 0;

  update(ref: { path: string }, data: Record<string, unknown>): void {
    this.updates.push({ path: ref.path, data });
  }

  async commit(): Promise<void> {
    this.commitCount += 1;
  }
}

class FakeMergeDb implements MergeDbAdapter {
  readonly batch = new FakeBatch();

  constructor(
    private readonly players: Map<string, MergePlayerRecord>,
    private readonly primaryRegistrations: MergeRegistrationRecord[],
    private readonly partnerRegistrations: MergeRegistrationRecord[]
  ) {}

  async getPlayer(playerId: string): Promise<MergePlayerRecord | null> {
    return this.players.get(playerId) ?? null;
  }

  async findRegistrationsByPlayerId(playerId: string): Promise<MergeRegistrationRecord[]> {
    return this.primaryRegistrations.filter((registration) => registration.playerId === playerId);
  }

  async findRegistrationsByPartnerPlayerId(playerId: string): Promise<MergeRegistrationRecord[]> {
    return this.partnerRegistrations.filter(
      (registration) => registration.partnerPlayerId === playerId
    );
  }

  createBatch(): FakeBatch {
    return this.batch;
  }
}

const makePlayer = (overrides: Partial<MergePlayerRecord> = {}): MergePlayerRecord => ({
  id: 'player-1',
  identityStatus: 'active',
  isActive: true,
  stats: {
    overall: { wins: 1, losses: 2, gamesPlayed: 3, tournamentsPlayed: 4 },
    tennis: {
      singles: { wins: 1, losses: 0, gamesPlayed: 1, tournamentsPlayed: 1 },
    },
  },
  ...overrides,
});

const makeRegistration = (overrides: Partial<MergeRegistrationRecord> = {}): MergeRegistrationRecord => ({
  id: 'reg-1',
  ref: { id: 'reg-1', path: 'tournaments/t1/registrations/reg-1' },
  playerId: 'source-player',
  partnerPlayerId: null,
  ...overrides,
});

describe('playerMerge', () => {
  beforeEach(() => {
    serverTimestampMock.mockClear();
  });

  it('merges nested player stats without dropping categories', () => {
    const merged = mergePlayerStats(
      {
        overall: { wins: 2, losses: 1, gamesPlayed: 3, tournamentsPlayed: 4 },
        tennis: {
          singles: { wins: 1, losses: 0, gamesPlayed: 1, tournamentsPlayed: 1 },
        },
        badminton: { wins: 3, losses: 2, gamesPlayed: 5, tournamentsPlayed: 1 },
      },
      {
        overall: { wins: 5, losses: 6, gamesPlayed: 7, tournamentsPlayed: 8 },
        tennis: {
          singles: { wins: 4, losses: 2, gamesPlayed: 6, tournamentsPlayed: 2 },
          doubles: { wins: 1, losses: 1, gamesPlayed: 2, tournamentsPlayed: 1 },
        },
      }
    );

    expect(merged.overall).toEqual({
      wins: 7,
      losses: 7,
      gamesPlayed: 10,
      tournamentsPlayed: 12,
    });
    expect(merged.tennis).toEqual({
      singles: { wins: 5, losses: 2, gamesPlayed: 7, tournamentsPlayed: 3 },
      doubles: { wins: 1, losses: 1, gamesPlayed: 2, tournamentsPlayed: 1 },
    });
    expect(merged.badminton).toEqual({
      wins: 3,
      losses: 2,
      gamesPlayed: 5,
      tournamentsPlayed: 1,
    });
  });

  it('builds a deduplicated registration repoint plan', () => {
    const plan = buildMergeRegistrationPlan(
      [
        makeRegistration({ id: 'reg-1', playerId: 'source-player' }),
        makeRegistration({ id: 'reg-2', playerId: 'source-player' }),
      ],
      [
        makeRegistration({
          id: 'reg-1',
          playerId: 'target-player',
          partnerPlayerId: 'source-player',
        }),
        makeRegistration({ id: 'reg-3', partnerPlayerId: 'source-player', playerId: 'target-player' }),
      ],
      'source-player',
      'target-player'
    );

    expect(plan.primaryRegistrationCount).toBe(2);
    expect(plan.partnerRegistrationCount).toBe(2);
    expect(plan.repointedRegistrationCount).toBe(4);
    expect(plan.updates).toEqual([
      {
        registrationId: 'reg-1',
        updates: {
          playerId: 'target-player',
          partnerPlayerId: 'target-player',
        },
      },
      {
        registrationId: 'reg-2',
        updates: {
          playerId: 'target-player',
        },
      },
      {
        registrationId: 'reg-3',
        updates: {
          partnerPlayerId: 'target-player',
        },
      },
    ]);
  });

  it('repoints registrations and tombstones the source player', async () => {
    const db = new FakeMergeDb(
      new Map<string, MergePlayerRecord>([
        [
          'source-player',
          makePlayer({
            id: 'source-player',
            stats: {
              overall: { wins: 1, losses: 2, gamesPlayed: 3, tournamentsPlayed: 4 },
              tennis: {
                singles: { wins: 1, losses: 0, gamesPlayed: 1, tournamentsPlayed: 1 },
              },
            },
          }),
        ],
        [
          'target-player',
          makePlayer({
            id: 'target-player',
            stats: {
              overall: { wins: 10, losses: 5, gamesPlayed: 15, tournamentsPlayed: 6 },
              tennis: {
                singles: { wins: 2, losses: 1, gamesPlayed: 3, tournamentsPlayed: 2 },
              },
            },
          }),
        ],
      ]),
      [
        makeRegistration({ id: 'reg-1', playerId: 'source-player', ref: { id: 'reg-1', path: 'tournaments/t1/registrations/reg-1' } }),
        makeRegistration({ id: 'reg-2', playerId: 'source-player', ref: { id: 'reg-2', path: 'tournaments/t1/registrations/reg-2' } }),
      ],
      [
        makeRegistration({
          id: 'reg-3',
          playerId: 'other-player-1',
          partnerPlayerId: 'source-player',
          ref: { id: 'reg-3', path: 'tournaments/t1/registrations/reg-3' },
        }),
        makeRegistration({
          id: 'reg-4',
          playerId: 'other-player-2',
          partnerPlayerId: 'source-player',
          ref: { id: 'reg-4', path: 'tournaments/t1/registrations/reg-4' },
        }),
      ]
    );

    const result = await executeMergeLogic(
      {
        sourcePlayerId: 'source-player',
        targetPlayerId: 'target-player',
        requestedBy: 'admin-1',
      },
      db
    );

    expect(result).toEqual({
      sourcePlayerId: 'source-player',
      targetPlayerId: 'target-player',
      primaryRegistrationCount: 2,
      partnerRegistrationCount: 2,
      repointedRegistrationCount: 4,
    });
    expect(db.batch.commitCount).toBe(1);
    expect(db.batch.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'tournaments/t1/registrations/reg-3',
          data: {
            partnerPlayerId: 'target-player',
          },
        }),
        expect.objectContaining({
          path: 'tournaments/t1/registrations/reg-4',
          data: {
            partnerPlayerId: 'target-player',
          },
        }),
        expect.objectContaining({
          path: 'tournaments/t1/registrations/reg-2',
          data: {
            playerId: 'target-player',
          },
        }),
        expect.objectContaining({
          path: 'players/target-player',
          data: expect.objectContaining({
            stats: {
              overall: { wins: 11, losses: 7, gamesPlayed: 18, tournamentsPlayed: 10 },
              tennis: {
                singles: { wins: 3, losses: 1, gamesPlayed: 4, tournamentsPlayed: 3 },
              },
            },
          }),
        }),
        expect.objectContaining({
          path: 'players/source-player',
          data: expect.objectContaining({
            identityStatus: 'merged',
            mergedIntoPlayerId: 'target-player',
            isActive: false,
          }),
        }),
      ])
    );
  });

  it('rejects self-merges', async () => {
    const db = new FakeMergeDb(new Map<string, MergePlayerRecord>(), [], []);

    await expect(
      executeMergeLogic(
        {
          sourcePlayerId: 'same-player',
          targetPlayerId: 'same-player',
          requestedBy: 'admin-1',
        },
        db
      )
    ).rejects.toThrow('Cannot merge player with itself');
  });

  it('rejects merges for players paired in the same registration', async () => {
    const db = new FakeMergeDb(
      new Map<string, MergePlayerRecord>([
        ['source-player', makePlayer({ id: 'source-player' })],
        ['target-player', makePlayer({ id: 'target-player' })],
      ]),
      [
        makeRegistration({
          id: 'reg-shared',
          playerId: 'source-player',
          partnerPlayerId: 'target-player',
        }),
      ],
      []
    );

    await expect(
      executeMergeLogic(
        {
          sourcePlayerId: 'source-player',
          targetPlayerId: 'target-player',
          requestedBy: 'admin-1',
        },
        db
      )
    ).rejects.toThrow('Cannot merge players who are paired in the same registration');
  });
});
