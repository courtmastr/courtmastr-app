import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import type { Match, Registration } from '@/types';
import PublicBracketView from '@/features/public/views/PublicBracketView.vue';
import PublicScheduleView from '@/features/public/views/PublicScheduleView.vue';
import PublicScoringView from '@/features/public/views/PublicScoringView.vue';

const runtime = {
  matches: [] as Match[],
  registrations: [] as Registration[],
  players: [] as Array<{ id: string; firstName: string; lastName: string }>,
  categories: [{ id: 'cat-1', name: "Men's Singles" }],
};

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeTournament: vi.fn(),
  unsubscribeTournament: vi.fn(),
  fetchCategoryLevels: vi.fn(),
  subscribeAllMatches: vi.fn(),
  unsubscribeMatches: vi.fn(),
  subscribeMatch: vi.fn(),
  clearCurrentMatch: vi.fn(),
  startMatch: vi.fn(),
  updateScore: vi.fn(),
  decrementScore: vi.fn(),
  fetchRegistrations: vi.fn(),
  fetchPlayers: vi.fn(),
  subscribeRegistrations: vi.fn(),
  subscribePlayers: vi.fn(),
  unsubscribeRegistrations: vi.fn(),
  subscribeActivities: vi.fn(),
  unsubscribeActivities: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
    query: {},
  }),
  useRouter: () => ({
    push: mockDeps.routerPush,
    replace: mockDeps.routerReplace,
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: { id: 't1', name: 'Spring Open' },
    categories: runtime.categories,
    courts: [{ id: 'court-1', name: 'Court 1' }],
    loading: false,
    fetchTournament: mockDeps.fetchTournament,
    subscribeTournament: mockDeps.subscribeTournament,
    unsubscribeAll: mockDeps.unsubscribeTournament,
    fetchCategoryLevels: mockDeps.fetchCategoryLevels,
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtime.matches,
    inProgressMatches: runtime.matches.filter((match) => match.status === 'in_progress'),
    currentMatch: null,
    subscribeAllMatches: mockDeps.subscribeAllMatches,
    unsubscribeAll: mockDeps.unsubscribeMatches,
    subscribeMatch: mockDeps.subscribeMatch,
    clearCurrentMatch: mockDeps.clearCurrentMatch,
    startMatch: mockDeps.startMatch,
    updateScore: mockDeps.updateScore,
    decrementScore: mockDeps.decrementScore,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    registrations: runtime.registrations,
    players: runtime.players,
    fetchRegistrations: mockDeps.fetchRegistrations,
    fetchPlayers: mockDeps.fetchPlayers,
    subscribeRegistrations: mockDeps.subscribeRegistrations,
    subscribePlayers: mockDeps.subscribePlayers,
    unsubscribeAll: mockDeps.unsubscribeRegistrations,
  }),
}));

vi.mock('@/stores/activities', () => ({
  useActivityStore: () => ({
    recentActivities: [],
    subscribeActivities: mockDeps.subscribeActivities,
    unsubscribe: mockDeps.unsubscribeActivities,
  }),
}));

vi.mock('@/composables/useParticipantResolver', () => ({
  useParticipantResolver: () => ({
    getParticipantName: (registrationId?: string) => registrationId ?? 'TBD',
  }),
}));

vi.mock('@/composables/useDurationFormatter', () => ({
  useDurationFormatter: () => ({
    formatDuration: (minutes: number) => `${minutes} min`,
    formatDurationAgo: (minutes: number) => `${minutes} min ago`,
  }),
}));

const makeRegistration = (id: string): Registration => ({
  id,
  tournamentId: 't1',
  categoryId: 'cat-1',
  participantType: 'player',
  playerId: `p-${id}`,
  status: 'approved',
  registeredBy: 'admin-1',
  registeredAt: new Date('2026-02-27T09:00:00.000Z'),
});

const makeMatch = (
  id: string,
  status: Match['status'],
  scheduleStatus?: Match['scheduleStatus'],
  plannedStartAt?: Date,
  overrides: Partial<Match> = {},
): Match => ({
  id,
  tournamentId: 't1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: { bracket: 'winners', round: 1, position: 1 },
  participant1Id: 'reg-1',
  participant2Id: 'reg-2',
  status,
  scheduleStatus,
  plannedStartAt,
  courtId: 'court-1',
  scores: [],
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
  ...overrides,
});

const commonStubs = [
  'v-container',
  'v-row',
  'v-col',
  'v-card',
  'v-card-item',
  'v-card-title',
  'v-card-subtitle',
  'v-card-text',
  'v-card-actions',
  'v-btn',
  'v-icon',
  'v-chip',
  'v-chip-group',
  'v-select',
  'v-skeleton-loader',
  'v-alert',
  'v-tooltip',
  'v-list',
  'v-list-item',
  'v-list-item-title',
  'v-list-item-subtitle',
  'v-avatar',
  'v-text-field',
  'v-switch',
  'v-divider',
  'v-spacer',
  'BracketsManagerViewer',
  'ActivityFeed',
];

describe('public views integration', () => {
  beforeEach(() => {
    runtime.registrations = [makeRegistration('reg-1'), makeRegistration('reg-2')];
    runtime.players = [
      { id: 'p-reg-1', firstName: 'Alice', lastName: 'A' },
      { id: 'p-reg-2', firstName: 'Bob', lastName: 'B' },
    ];
    runtime.matches = [
      makeMatch('m-published', 'scheduled', 'published', new Date('2026-02-27T11:00:00.000Z')),
      makeMatch('m-ready', 'ready'),
    ];

    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.unsubscribeTournament.mockReset();
    mockDeps.fetchCategoryLevels.mockReset().mockResolvedValue([]);
    mockDeps.subscribeAllMatches.mockReset();
    mockDeps.unsubscribeMatches.mockReset();
    mockDeps.subscribeMatch.mockReset();
    mockDeps.clearCurrentMatch.mockReset();
    mockDeps.startMatch.mockReset().mockResolvedValue(undefined);
    mockDeps.updateScore.mockReset().mockResolvedValue(undefined);
    mockDeps.decrementScore.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchRegistrations.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchPlayers.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeRegistrations.mockReset();
    mockDeps.subscribePlayers.mockReset();
    mockDeps.unsubscribeRegistrations.mockReset();
    mockDeps.subscribeActivities.mockReset();
    mockDeps.unsubscribeActivities.mockReset();
    mockDeps.routerPush.mockReset();
    mockDeps.routerReplace.mockReset();
  });

  it('initializes all public views and wires expected subscriptions', async () => {
    const bracket = shallowMount(PublicBracketView, { global: { stubs: commonStubs } });
    const schedule = shallowMount(PublicScheduleView, { global: { stubs: commonStubs } });
    const scoring = shallowMount(PublicScoringView, { global: { stubs: commonStubs } });

    await flushPromises();

    expect(mockDeps.fetchTournament).toHaveBeenCalledTimes(3);
    expect(mockDeps.subscribeTournament).toHaveBeenCalledTimes(3);
    expect(mockDeps.fetchCategoryLevels).toHaveBeenCalledWith('t1', 'cat-1');
    expect(mockDeps.subscribeAllMatches).toHaveBeenCalledTimes(3);
    expect(mockDeps.fetchRegistrations).toHaveBeenCalledWith('t1');
    expect(mockDeps.fetchPlayers).toHaveBeenCalledWith('t1');
    expect(mockDeps.subscribeRegistrations).toHaveBeenCalledWith('t1');
    expect(mockDeps.subscribePlayers).toHaveBeenCalledWith('t1');
    expect(mockDeps.subscribeActivities).toHaveBeenCalledWith('t1', 40);

    const scheduleVm = schedule.vm as unknown as {
      hasPublishedSchedule: boolean | { value: boolean };
    };
    const hasPublished =
      typeof scheduleVm.hasPublishedSchedule === 'boolean'
        ? scheduleVm.hasPublishedSchedule
        : scheduleVm.hasPublishedSchedule.value;
    expect(hasPublished).toBe(true);

    const scoringVm = scoring.vm as unknown as {
      scorableMatches: Match[] | { value: Match[] };
    };
    const scorableMatches = Array.isArray(scoringVm.scorableMatches)
      ? scoringVm.scorableMatches
      : scoringVm.scorableMatches.value;
    expect(scorableMatches).toHaveLength(1);

    bracket.unmount();
    schedule.unmount();
    scoring.unmount();
  });

  it('prefers level labels over raw pool labels in public schedule and scoring views', async () => {
    runtime.matches = [
      makeMatch(
        'm-level',
        'ready',
        'published',
        new Date('2026-02-27T11:00:00.000Z'),
        {
          groupId: '0',
          levelId: 'level-advanced',
        },
      ),
    ];
    mockDeps.fetchCategoryLevels.mockReset().mockResolvedValue([
      {
        id: 'level-advanced',
        name: 'Advanced',
        order: 1,
        eliminationFormat: 'single_elimination',
        participantCount: 8,
        createdAt: new Date('2026-02-27T09:00:00.000Z'),
        updatedAt: new Date('2026-02-27T09:00:00.000Z'),
      },
    ]);

    const schedule = shallowMount(PublicScheduleView, { global: { stubs: commonStubs } });
    const scoring = shallowMount(PublicScoringView, { global: { stubs: commonStubs } });

    await flushPromises();

    const scheduleVm = schedule.vm as unknown as {
      filteredScheduleItems: Array<{ scopeLabel: string | null }> | { value: Array<{ scopeLabel: string | null }> };
      availableScopes: Array<{ title: string; value: string }> | { value: Array<{ title: string; value: string }> };
    };
    const filteredScheduleItems = Array.isArray(scheduleVm.filteredScheduleItems)
      ? scheduleVm.filteredScheduleItems
      : scheduleVm.filteredScheduleItems.value;
    const availableScopes = Array.isArray(scheduleVm.availableScopes)
      ? scheduleVm.availableScopes
      : scheduleVm.availableScopes.value;

    expect(filteredScheduleItems[0]?.scopeLabel).toBe('Advanced');
    expect(availableScopes).toContainEqual({
      title: 'Advanced',
      value: 'level:cat-1:level-advanced',
    });

    const scoringVm = scoring.vm as unknown as {
      getMatchScopeLabel: (match: Match) => string | null;
    };
    expect(scoringVm.getMatchScopeLabel(runtime.matches[0])).toBe('Advanced');

    schedule.unmount();
    scoring.unmount();
  });
});
