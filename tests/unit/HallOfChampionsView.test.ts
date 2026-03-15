import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import type {
  Category,
  LevelDefinition,
  Match,
  Player,
  Registration,
  Tournament,
} from '@/types';
import HallOfChampionsView from '@/features/public/views/HallOfChampionsView.vue';

const runtime = {
  tournament: null as Tournament | null,
  categories: [] as Category[],
  matches: [] as Match[],
  registrations: [] as Registration[],
  players: [] as Player[],
  levelDefinitions: {} as Record<string, LevelDefinition[]>,
};

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeTournament: vi.fn(),
  unsubscribeTournament: vi.fn(),
  fetchCategoryLevels: vi.fn(),
  subscribeAllMatches: vi.fn(),
  unsubscribeMatches: vi.fn(),
  subscribeRegistrations: vi.fn(),
  subscribePlayers: vi.fn(),
  unsubscribeRegistrations: vi.fn(),
  setMetadata: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
    query: {},
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: runtime.tournament,
    categories: runtime.categories,
    fetchTournament: mockDeps.fetchTournament,
    subscribeTournament: mockDeps.subscribeTournament,
    unsubscribeAll: mockDeps.unsubscribeTournament,
    fetchCategoryLevels: mockDeps.fetchCategoryLevels,
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtime.matches,
    subscribeAllMatches: mockDeps.subscribeAllMatches,
    unsubscribeAll: mockDeps.unsubscribeMatches,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    registrations: runtime.registrations,
    players: runtime.players,
    subscribeRegistrations: mockDeps.subscribeRegistrations,
    subscribePlayers: mockDeps.subscribePlayers,
    unsubscribeAll: mockDeps.unsubscribeRegistrations,
  }),
}));

vi.mock('@/composables/usePublicPageMetadata', () => ({
  usePublicPageMetadata: mockDeps.setMetadata,
}));

const baseTournament = {
  id: 't1',
  name: 'Spring Invitational',
  sport: 'badminton',
  format: 'single_elimination',
  status: 'active',
  startDate: new Date('2026-04-10T09:00:00.000Z'),
  endDate: new Date('2026-04-10T17:00:00.000Z'),
  location: 'Chicago, IL',
  settings: {
    minRestTimeMinutes: 10,
    matchDurationMinutes: 25,
    allowSelfRegistration: true,
    requireApproval: true,
    gamesPerMatch: 3,
    pointsToWin: 21,
    mustWinBy: 2,
    maxPoints: 30,
  },
  createdBy: 'admin-1',
  createdAt: new Date('2026-03-01T10:00:00.000Z'),
  updatedAt: new Date('2026-03-01T10:00:00.000Z'),
} as unknown as Tournament;

const makeCategory = (overrides: Partial<Category>): Category => ({
  id: 'cat-1',
  tournamentId: 't1',
  name: "Men's Singles",
  type: 'singles',
  gender: 'men',
  ageGroup: 'open',
  format: 'single_elimination',
  seedingEnabled: true,
  status: 'active',
  createdAt: new Date('2026-03-01T10:00:00.000Z'),
  updatedAt: new Date('2026-03-01T10:00:00.000Z'),
  ...overrides,
});

const makeRegistration = (
  id: string,
  categoryId: string,
  playerId: string,
  overrides: Partial<Registration> = {},
): Registration => ({
  id,
  tournamentId: 't1',
  categoryId,
  participantType: 'player',
  playerId,
  status: 'approved',
  registeredBy: 'admin-1',
  registeredAt: new Date('2026-03-01T10:00:00.000Z'),
  ...overrides,
});

const makePlayer = (id: string, firstName: string, lastName: string): Player => ({
  id,
  firstName,
  lastName,
  createdAt: new Date('2026-03-01T10:00:00.000Z'),
  updatedAt: new Date('2026-03-01T10:00:00.000Z'),
});

const makeMatch = (overrides: Partial<Match>): Match => ({
  id: 'match-1',
  tournamentId: 't1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: { bracket: 'winners', round: 1, position: 1 },
  participant1Id: 'reg-1',
  participant2Id: 'reg-2',
  winnerId: 'reg-1',
  status: 'completed',
  scores: [{
    gameNumber: 1,
    score1: 21,
    score2: 18,
    winnerId: 'reg-1',
    isComplete: true,
  }],
  createdAt: new Date('2026-04-10T15:00:00.000Z'),
  updatedAt: new Date('2026-04-10T15:00:00.000Z'),
  completedAt: new Date('2026-04-10T15:20:00.000Z'),
  ...overrides,
});

const mountView = () =>
  shallowMount(HallOfChampionsView, {
    global: {
      stubs: [
        'TournamentPublicShell',
        'v-row',
        'v-col',
        'v-card',
        'v-card-text',
        'v-icon',
        'v-chip',
        'v-btn',
        'v-avatar',
        'v-skeleton-loader',
      ],
    },
  });

const readBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    return Boolean((value as { value?: unknown }).value);
  }
  throw new Error('Expected boolean value');
};

const readArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object' && 'value' in value) {
    return ((value as { value?: unknown }).value ?? []) as T[];
  }
  throw new Error('Expected array value');
};

describe('HallOfChampionsView', () => {
  beforeEach(() => {
    runtime.tournament = baseTournament;
    runtime.categories = [
      makeCategory({ id: 'cat-elim', name: "Men's Singles" }),
      makeCategory({
        id: 'cat-rr',
        name: "Women's Singles",
        format: 'round_robin',
        status: 'completed',
      }),
      makeCategory({
        id: 'cat-level',
        name: 'Community Levels',
        format: 'pool_to_elimination',
      }),
    ];
    runtime.registrations = [
      makeRegistration('reg-1', 'cat-elim', 'p1'),
      makeRegistration('reg-2', 'cat-elim', 'p2'),
      makeRegistration('reg-3', 'cat-rr', 'p3'),
      makeRegistration('reg-4', 'cat-rr', 'p4'),
      makeRegistration('reg-5', 'cat-level', 'p5'),
      makeRegistration('reg-6', 'cat-level', 'p6'),
    ];
    runtime.players = [
      makePlayer('p1', 'Alice', 'Adams'),
      makePlayer('p2', 'Brooke', 'Brown'),
      makePlayer('p3', 'Carla', 'Cruz'),
      makePlayer('p4', 'Diana', 'Diaz'),
      makePlayer('p5', 'Evan', 'Edwards'),
      makePlayer('p6', 'Felix', 'Ford'),
    ];
    runtime.matches = [
      makeMatch({
        id: 'm-final',
        categoryId: 'cat-elim',
        round: 3,
        matchNumber: 7,
        bracketPosition: { bracket: 'finals', round: 3, position: 1 },
        participant1Id: 'reg-1',
        participant2Id: 'reg-2',
        winnerId: 'reg-1',
      }),
      makeMatch({
        id: 'm-rr',
        categoryId: 'cat-rr',
        round: 1,
        matchNumber: 1,
        bracketPosition: { bracket: 'winners', round: 1, position: 1 },
        participant1Id: 'reg-3',
        participant2Id: 'reg-4',
        winnerId: 'reg-3',
      }),
      makeMatch({
        id: 'm-level-final',
        categoryId: 'cat-level',
        levelId: 'level-1',
        round: 2,
        matchNumber: 4,
        bracketPosition: { bracket: 'finals', round: 2, position: 1 },
        participant1Id: 'reg-5',
        participant2Id: 'reg-6',
        winnerId: 'reg-5',
      }),
    ];
    runtime.levelDefinitions = {
      'cat-level': [{
        id: 'level-1',
        name: 'Advanced',
        order: 1,
        eliminationFormat: 'single_elimination',
        participantCount: 8,
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        updatedAt: new Date('2026-03-01T10:00:00.000Z'),
      }],
    };

    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.unsubscribeTournament.mockReset();
    mockDeps.fetchCategoryLevels.mockReset().mockImplementation(async (_tournamentId: string, categoryId: string) => (
      runtime.levelDefinitions[categoryId] ?? []
    ));
    mockDeps.subscribeAllMatches.mockReset();
    mockDeps.unsubscribeMatches.mockReset();
    mockDeps.subscribeRegistrations.mockReset();
    mockDeps.subscribePlayers.mockReset();
    mockDeps.unsubscribeRegistrations.mockReset();
    mockDeps.setMetadata.mockReset();
  });

  it('loads tournament data and resolves champions across elimination, round-robin, and level scopes', async () => {
    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      champions: Array<{
        categoryId: string;
        championName: string;
        runnerUpName: string | null;
        levelLabel: string | null;
      }> | { value: Array<{
        categoryId: string;
        championName: string;
        runnerUpName: string | null;
        levelLabel: string | null;
      }> };
    };

    const champions = readArray<{
      categoryId: string;
      championName: string;
      runnerUpName: string | null;
      levelLabel: string | null;
    }>(vm.champions);

    expect(mockDeps.fetchTournament).toHaveBeenCalledWith('t1');
    expect(mockDeps.subscribeTournament).toHaveBeenCalledWith('t1');
    expect(mockDeps.subscribeAllMatches).toHaveBeenCalledWith('t1');
    expect(mockDeps.subscribeRegistrations).toHaveBeenCalledWith('t1');
    expect(mockDeps.subscribePlayers).toHaveBeenCalledWith('t1');
    expect(mockDeps.fetchCategoryLevels).toHaveBeenCalledWith('t1', 'cat-level');
    expect(mockDeps.setMetadata).toHaveBeenCalledWith(expect.objectContaining({
      canonicalPath: '/tournaments/t1/champions',
    }));
    expect(champions).toHaveLength(3);
    expect(champions.find((entry) => entry.categoryId === 'cat-elim')).toMatchObject({
      championName: 'Alice Adams',
      runnerUpName: 'Brooke Brown',
    });
    expect(champions.find((entry) => entry.categoryId === 'cat-rr')).toMatchObject({
      championName: 'Carla Cruz',
      runnerUpName: 'Diana Diaz',
    });
    expect(champions.find((entry) => entry.categoryId === 'cat-level')).toMatchObject({
      championName: 'Evan Edwards',
      runnerUpName: 'Felix Ford',
      levelLabel: 'Advanced',
    });
  });

  it('exposes an empty champions state when no completed title holders exist yet', async () => {
    runtime.matches = [
      makeMatch({
        id: 'm-in-progress',
        categoryId: 'cat-elim',
        status: 'in_progress',
        winnerId: undefined,
      }),
    ];
    runtime.categories = [makeCategory({ id: 'cat-elim', name: "Men's Singles" })];

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      champions: unknown;
      hasChampions: boolean | { value: boolean };
    };

    expect(readArray(vm.champions)).toHaveLength(0);
    expect(readBoolean(vm.hasChampions)).toBe(false);
  });

  it('shows not-found state when tournament fetch fails', async () => {
    mockDeps.fetchTournament.mockRejectedValueOnce(new Error('missing'));

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      notFound: boolean | { value: boolean };
    };

    expect(readBoolean(vm.notFound)).toBe(true);
    expect(mockDeps.subscribeTournament).not.toHaveBeenCalled();
    expect(mockDeps.subscribeAllMatches).not.toHaveBeenCalled();
  });
});
