import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDeps = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  setDoc: vi.fn(),
  scheduleTimes: vi.fn(),
  computeEpochs: vi.fn((matches: unknown) => matches),
  saveTimedSchedule: vi.fn(),
  adaptBracketsMatchToLegacyMatch: vi.fn(),
  buildMatchStructureMaps: vi.fn(() => ({
    roundNumberByRoundId: new Map(),
    bracketByRoundId: new Map(),
  })),
}));

vi.mock('@/services/firebase', () => ({
  db: { __name: 'mock-db' },
  collection: mockDeps.collection,
  doc: mockDeps.doc,
  getDocs: mockDeps.getDocs,
  getDoc: mockDeps.getDoc,
  updateDoc: mockDeps.updateDoc,
  writeBatch: mockDeps.writeBatch,
  query: mockDeps.query,
  where: mockDeps.where,
  Timestamp: {
    fromDate: (value: Date) => value,
  },
  serverTimestamp: mockDeps.serverTimestamp,
  setDoc: mockDeps.setDoc,
}));

vi.mock('@/stores/bracketMatchAdapter', () => ({
  adaptBracketsMatchToLegacyMatch: mockDeps.adaptBracketsMatchToLegacyMatch,
  buildMatchStructureMaps: mockDeps.buildMatchStructureMaps,
}));

vi.mock('@/composables/useTimeScheduler', () => ({
  scheduleTimes: mockDeps.scheduleTimes,
  computeEpochs: mockDeps.computeEpochs,
  saveTimedSchedule: mockDeps.saveTimedSchedule,
}));

import { useMatchScheduler } from '@/composables/useMatchScheduler';

interface MockDoc {
  id: string;
  data: Record<string, unknown>;
}

const makeSnapshot = (docs: MockDoc[]) => ({
  size: docs.length,
  docs: docs.map((entry) => ({
    id: entry.id,
    data: () => entry.data,
  })),
});

describe('useMatchScheduler BYE filtering', () => {
  beforeEach(() => {
    mockDeps.collection.mockReset().mockImplementation((_db, ...segments: string[]) => ({
      path: segments.join('/'),
    }));
    mockDeps.doc.mockReset().mockImplementation((_db, ...segments: string[]) => ({
      path: segments.join('/'),
    }));
    mockDeps.query.mockReset().mockImplementation((...args: unknown[]) => ({ args }));
    mockDeps.where.mockReset().mockImplementation((...args: unknown[]) => ({ args }));

    mockDeps.getDoc.mockReset().mockResolvedValue({
      exists: () => true,
      data: () => ({
        settings: {
          matchDurationMinutes: 30,
          minRestTimeMinutes: 15,
        },
      }),
    });

    mockDeps.getDocs.mockReset();
    mockDeps.getDocs
      .mockResolvedValueOnce(makeSnapshot([{ id: 'court-1', data: { number: 1, status: 'available' } }])) // courts
      .mockResolvedValueOnce(makeSnapshot([
        {
          id: 'bye-match',
          data: {
            id: 'bye-match',
            number: 1,
            participant1Id: 'reg-1',
            participant2Id: undefined,
            winnerId: 'reg-1',
            statusLabel: 'ready',
          },
        },
        {
          id: 'tbd-match',
          data: {
            id: 'tbd-match',
            number: 2,
            participant1Id: 'reg-2',
            participant2Id: undefined,
            winnerId: undefined,
            statusLabel: 'ready',
          },
        },
        {
          id: 'playable-match',
          data: {
            id: 'playable-match',
            number: 3,
            participant1Id: 'reg-3',
            participant2Id: 'reg-4',
            winnerId: undefined,
            statusLabel: 'ready',
          },
        },
      ])) // match
      .mockResolvedValueOnce(makeSnapshot([])) // registrations
      .mockResolvedValueOnce(makeSnapshot([])) // participants
      .mockResolvedValueOnce(makeSnapshot([])) // match_scores
      .mockResolvedValueOnce(makeSnapshot([])) // round
      .mockResolvedValueOnce(makeSnapshot([])); // group

    mockDeps.adaptBracketsMatchToLegacyMatch.mockReset().mockImplementation((bracketsMatch: Record<string, unknown>) => {
      const matchNumber = Number(bracketsMatch.number ?? 1);
      return {
        id: String(bracketsMatch.id),
        tournamentId: 't-1',
        categoryId: 'cat-1',
        round: 1,
        matchNumber,
        bracketPosition: {
          bracket: 'winners',
          round: 1,
          position: matchNumber,
        },
        participant1Id: bracketsMatch.participant1Id as string | undefined,
        participant2Id: bracketsMatch.participant2Id as string | undefined,
        winnerId: bracketsMatch.winnerId as string | undefined,
        status: (bracketsMatch.statusLabel as string) || 'ready',
        scores: [],
        createdAt: new Date('2026-02-27T09:00:00.000Z'),
        updatedAt: new Date('2026-02-27T09:00:00.000Z'),
      };
    });

    mockDeps.scheduleTimes.mockReset().mockImplementation((matches: Array<{ id: string }>) => ({
      planned: matches.map((match, index) => ({
        matchId: match.id,
        plannedStartAt: new Date(`2026-02-27T10:0${index}:00.000Z`),
        plannedEndAt: new Date(`2026-02-27T10:2${index}:00.000Z`),
      })),
      unscheduled: [],
      scheduleVersion: 1,
      stats: {
        totalMatches: matches.length,
        plannedCount: matches.length,
        unscheduledCount: 0,
        estimatedEndTime: new Date('2026-02-27T10:30:00.000Z'),
      },
    }));

    mockDeps.saveTimedSchedule.mockReset().mockResolvedValue(undefined);
  });

  it('excludes BYE matches but keeps TBD matches for scheduling', async () => {
    const scheduler = useMatchScheduler();

    const result = await scheduler.scheduleMatches('t-1', {
      categoryId: 'cat-1',
      startTime: new Date('2026-02-27T10:00:00.000Z'),
      dryRun: true,
    });

    const scheduleInput = mockDeps.scheduleTimes.mock.calls[0][0] as Array<{ id: string }>;
    const scheduleInputIds = scheduleInput.map((match) => match.id);

    expect(scheduleInputIds).toEqual(expect.arrayContaining(['tbd-match', 'playable-match']));
    expect(scheduleInputIds).not.toContain('bye-match');

    expect(result.scheduled.map((match) => match.matchId)).toEqual(
      expect.arrayContaining(['tbd-match', 'playable-match'])
    );
    expect(result.scheduled.map((match) => match.matchId)).not.toContain('bye-match');
    expect(result.stats.totalMatches).toBe(2);
  });
});
