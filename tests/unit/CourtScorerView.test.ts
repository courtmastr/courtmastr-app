import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import CourtScorerView from '@/features/scoring/views/CourtScorerView.vue';

const routeState = vi.hoisted(() => ({
  params: {
    tournamentId: 't1',
    courtId: 'court-1',
    matchId: undefined as string | undefined,
  },
  query: {} as Record<string, unknown>,
}));

const mockDeps = vi.hoisted(() => ({
  categories: [{ id: 'cat-1', name: 'Mixed Doubles' }],
  fetchTournament: vi.fn(),
  routerReplace: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  unsubscribeCourt: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({
    replace: mockDeps.routerReplace,
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    categories: mockDeps.categories,
    fetchTournament: mockDeps.fetchTournament,
  }),
}));

vi.mock('@/services/firebase', () => ({
  db: { __mock: true },
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (_db: unknown, path: string) => ({ path }),
  getDoc: mockDeps.getDoc,
  getDocs: mockDeps.getDocs,
  onSnapshot: mockDeps.onSnapshot,
}));

const mountView = () => shallowMount(CourtScorerView, {
  global: {
    stubs: [
      'v-icon',
      'v-progress-circular',
    ],
  },
});

describe('CourtScorerView', () => {
  beforeEach(() => {
    routeState.params = {
      tournamentId: 't1',
      courtId: 'court-1',
      matchId: undefined,
    };
    routeState.query = {};
    mockDeps.categories = [{ id: 'cat-1', name: 'Mixed Doubles' }];
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.routerReplace.mockReset().mockImplementation(async (location: Record<string, unknown>) => {
      routeState.params = {
        ...routeState.params,
        ...(location.params as Record<string, string | undefined> | undefined),
      };
      routeState.query = (location.query as Record<string, unknown> | undefined) ?? {};
    });
    mockDeps.getDoc.mockReset().mockImplementation(async (ref: { path: string }) => {
      if (ref.path.endsWith('/levels/level-a/match/m1')) {
        return { exists: () => true };
      }

      if (ref.path.endsWith('/levels/level-a/match_scores/m1')) {
        return {
          exists: () => true,
          data: () => ({
            courtId: 'court-1',
            status: 'in_progress',
            updatedAt: { toDate: () => new Date('2026-04-18T10:00:00.000Z') },
          }),
        };
      }

      return { exists: () => false };
    });
    mockDeps.getDocs.mockReset().mockResolvedValue({
      docs: [{ id: 'level-a' }],
    });
    mockDeps.onSnapshot.mockReset().mockImplementation((_ref: unknown, callback: (snap: {
      exists: () => boolean;
      id: string;
      data: () => Record<string, unknown>;
    }) => void) => {
      callback({
        exists: () => true,
        id: 'court-1',
        data: () => ({
          name: 'Court 1',
          currentMatchId: 'm1',
        }),
      });
      return mockDeps.unsubscribeCourt;
    });
    mockDeps.unsubscribeCourt.mockReset();
  });

  it('injects category and level query params before mounting the scorer route', async () => {
    mountView();
    await flushPromises();

    expect(mockDeps.routerReplace).toHaveBeenCalledWith({
      name: 'volunteer-court-scorer',
      params: {
        tournamentId: 't1',
        courtId: 'court-1',
        matchId: 'm1',
      },
      query: {
        category: 'cat-1',
        level: 'level-a',
      },
    });
    expect(routeState.query).toEqual({
      category: 'cat-1',
      level: 'level-a',
    });
  });

  it('prefers the court-matched active score document when match ids collide across categories', async () => {
    mockDeps.categories = [
      { id: 'cat-mixed', name: 'Mixed Doubles' },
      { id: 'cat-singles', name: 'Men\'s Singles' },
    ];
    routeState.params.matchId = undefined;
    routeState.query = {};
    mockDeps.getDocs.mockReset().mockResolvedValue({ docs: [] });
    mockDeps.getDoc.mockReset().mockImplementation(async (ref: { path: string }) => {
      if (ref.path.endsWith('/categories/cat-mixed/match/m3')) {
        return { exists: () => true };
      }

      if (ref.path.endsWith('/categories/cat-mixed/match_scores/m3')) {
        return {
          exists: () => true,
          data: () => ({
            courtId: 'court-1',
            status: 'in_progress',
            updatedAt: { toDate: () => new Date('2026-04-18T09:00:00.000Z') },
          }),
        };
      }

      if (ref.path.endsWith('/categories/cat-singles/match/m3')) {
        return { exists: () => true };
      }

      if (ref.path.endsWith('/categories/cat-singles/match_scores/m3')) {
        return {
          exists: () => true,
          data: () => ({
            courtId: 'court-1',
            status: 'in_progress',
            updatedAt: { toDate: () => new Date('2026-04-18T11:00:00.000Z') },
          }),
        };
      }

      return { exists: () => false };
    });
    mockDeps.onSnapshot.mockReset().mockImplementation((_ref: unknown, callback: (snap: {
      exists: () => boolean;
      id: string;
      data: () => Record<string, unknown>;
    }) => void) => {
      callback({
        exists: () => true,
        id: 'court-1',
        data: () => ({
          name: 'Court 1',
          currentMatchId: 'm3',
        }),
      });
      return mockDeps.unsubscribeCourt;
    });

    mountView();
    await flushPromises();

    expect(mockDeps.routerReplace).toHaveBeenCalledWith({
      name: 'volunteer-court-scorer',
      params: {
        tournamentId: 't1',
        courtId: 'court-1',
        matchId: 'm3',
      },
      query: {
        category: 'cat-singles',
      },
    });
    expect(routeState.query).toEqual({
      category: 'cat-singles',
    });
  });
});
