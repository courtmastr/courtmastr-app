import { beforeEach, describe, expect, it, vi } from 'vitest';

const collectionMock = vi.fn((_db: unknown, path: string) => ({ path }));
const docMock = vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }));
const getDocMock = vi.fn();
const getDocsMock = vi.fn();
const getDocsFromServerMock = vi.fn();
const updateDocMock = vi.fn();
const queryMock = vi.fn((target: { path: string }, ...constraints: unknown[]) => ({
  path: target.path,
  constraints,
}));
const whereMock = vi.fn((field: string, op: string, value: unknown) => ({ field, op, value }));
const serverTimestampMock = vi.fn(() => 'server-timestamp');
const storageRefMock = vi.fn((_storage: unknown, path: string) => ({ fullPath: path }));
const uploadBytesMock = vi.fn();
const getDownloadURLMock = vi.fn();

class MockTimestamp {
  constructor(private readonly date: Date) {}

  toDate(): Date {
    return this.date;
  }
}

vi.mock('@/services/firebase', () => ({
  db: {},
  storage: {},
  collection: collectionMock,
  doc: docMock,
  getDoc: getDocMock,
  getDocs: getDocsMock,
  getDocsFromServer: getDocsFromServerMock,
  updateDoc: updateDocMock,
  query: queryMock,
  where: whereMock,
  Timestamp: MockTimestamp,
  serverTimestamp: serverTimestampMock,
  ref: storageRefMock,
  uploadBytes: uploadBytesMock,
  getDownloadURL: getDownloadURLMock,
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'admin-user' },
  }),
}));

vi.mock('@/composables/useLeaderboard', () => ({
  resolveParticipantName: (registration: { teamName?: string; id: string }) =>
    registration.teamName ?? registration.id,
}));

const createDoc = (id: string, data: Record<string, unknown>) => ({
  id,
  data: () => data,
});

const createSnapshot = (docs: Array<{ id: string; data: () => Record<string, unknown> }>) => ({
  docs,
  empty: docs.length === 0,
});

describe('usePublishSnapshot standings', () => {
  let uploadedJson = '';

  beforeEach(() => {
    vi.clearAllMocks();
    uploadedJson = '';

    getDocMock.mockResolvedValue({
      id: 't-1',
      exists: () => true,
      data: () => ({
        name: 'Spring Open',
        sport: 'badminton',
        startDate: new Date('2026-04-18T10:00:00.000Z'),
        endDate: new Date('2026-04-20T18:00:00.000Z'),
        location: 'Chicago',
        createdBy: 'admin-user',
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
        updatedAt: new Date('2026-04-01T10:00:00.000Z'),
      }),
    });

    const docsByPath: Record<string, Array<{ id: string; data: () => Record<string, unknown> }>> = {
      'tournaments/t-1/categories': [
        createDoc('cat-1', {
          name: "Women's Doubles",
          format: 'pool_to_elimination',
          createdAt: new Date('2026-04-01T10:00:00.000Z'),
          updatedAt: new Date('2026-04-01T10:00:00.000Z'),
        }),
      ],
      'tournaments/t-1/registrations': [
        createDoc('reg-melanie', {
          categoryId: 'cat-1',
          participantType: 'team',
          teamName: 'Melanie Arteman / Donna Shippy',
          status: 'approved',
        }),
        createDoc('reg-jaishree', {
          categoryId: 'cat-1',
          participantType: 'team',
          teamName: 'Jaishree Arun / Devi Shakthi',
          status: 'approved',
        }),
        createDoc('reg-aruna', {
          categoryId: 'cat-1',
          participantType: 'team',
          teamName: 'Aruna Ravichandran / Shiwangee Samant',
          status: 'approved',
        }),
        createDoc('reg-ritika', {
          categoryId: 'cat-1',
          participantType: 'team',
          teamName: 'Ritika Panthula / Deepthi Rajagopal',
          status: 'approved',
        }),
      ],
      'tournaments/t-1/tbdSchedule': [],
      'tournaments/t-1/courts': [],
      'tournaments/t-1/categories/cat-1/group': [
        createDoc('group-1', { name: 'Group 1' }),
      ],
      'tournaments/t-1/categories/cat-1/participant': [
        createDoc('participant-1', { id: 1, name: 'reg-melanie' }),
        createDoc('participant-2', { id: 2, name: 'reg-jaishree' }),
        createDoc('participant-3', { id: 3, name: 'reg-aruna' }),
        createDoc('participant-4', { id: 4, name: 'reg-ritika' }),
      ],
      'tournaments/t-1/categories/cat-1/match': [
        createDoc('match-1', {
          number: 1,
          round_id: 1,
          group_id: 'group-1',
          opponent1: { id: 1 },
          opponent2: { id: 3 },
        }),
        createDoc('match-2', {
          number: 2,
          round_id: 1,
          group_id: 'group-1',
          opponent1: { id: 1 },
          opponent2: { id: 4 },
        }),
        createDoc('match-3', {
          number: 3,
          round_id: 1,
          group_id: 'group-1',
          opponent1: { id: 1 },
          opponent2: { id: 2 },
        }),
        createDoc('match-4', {
          number: 4,
          round_id: 1,
          group_id: 'group-1',
          opponent1: { id: 2 },
          opponent2: { id: 3 },
        }),
        createDoc('match-5', {
          number: 5,
          round_id: 1,
          group_id: 'group-1',
          opponent1: { id: 2 },
          opponent2: { id: 4 },
        }),
      ],
      'tournaments/t-1/categories/cat-1/match_scores': [
        createDoc('match-1', {
          status: 'completed',
          winnerId: 'reg-melanie',
          scores: [
            { score1: 21, score2: 5 },
            { score1: 21, score2: 5 },
          ],
        }),
        createDoc('match-2', {
          status: 'completed',
          winnerId: 'reg-melanie',
          scores: [
            { score1: 21, score2: 5 },
            { score1: 21, score2: 5 },
          ],
        }),
        createDoc('match-3', {
          status: 'completed',
          winnerId: 'reg-jaishree',
          scores: [
            { score1: 19, score2: 21 },
            { score1: 21, score2: 19 },
            { score1: 18, score2: 21 },
          ],
        }),
        createDoc('match-4', {
          status: 'completed',
          winnerId: 'reg-aruna',
          scores: [
            { score1: 20, score2: 22 },
          ],
        }),
        createDoc('match-5', {
          status: 'completed',
          winnerId: 'reg-jaishree',
          scores: [
            { score1: 21, score2: 0 },
            { score1: 21, score2: 0 },
          ],
        }),
      ],
    };

    getDocsMock.mockImplementation(async (ref: { path: string }) => {
      return createSnapshot(docsByPath[ref.path] ?? []);
    });
    getDocsFromServerMock.mockImplementation(async (ref: { path: string }) => {
      return createSnapshot(docsByPath[ref.path] ?? []);
    });

    uploadBytesMock.mockImplementation(async (_fileRef: unknown, blob: Blob) => {
      uploadedJson = await blob.text();
      return {};
    });

    getDownloadURLMock.mockResolvedValue('https://example.com/public-snapshots/t-1/latest.json');
    updateDocMock.mockResolvedValue(undefined);
  });

  it('publishes smart-bracket order and match points to the public standings snapshot', async () => {
    const { usePublishSnapshot } = await import('@/composables/usePublishSnapshot');
    const { publishSnapshot } = usePublishSnapshot();

    await publishSnapshot('t-1');

    const snapshot = JSON.parse(uploadedJson) as {
      categories: Array<{
        standings: Array<{
          rank: number;
          name: string;
          mp: number;
          wins: number;
          losses: number;
          setWins: number;
          setLosses: number;
          pointsDiff: number;
        }>;
      }>;
    };

    expect(snapshot.categories[0]?.standings.slice(0, 2)).toEqual([
      expect.objectContaining({
        rank: 1,
        name: 'Melanie Arteman / Donna Shippy',
        mp: 5,
        wins: 2,
        losses: 1,
        setWins: 5,
        setLosses: 2,
      }),
      expect.objectContaining({
        rank: 2,
        name: 'Jaishree Arun / Devi Shakthi',
        mp: 5,
        wins: 2,
        losses: 1,
        setWins: 4,
        setLosses: 2,
      }),
    ]);
  });
});
