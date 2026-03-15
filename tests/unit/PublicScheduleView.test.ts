import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import type { Match, Registration } from '@/types';
import PublicScheduleView from '@/features/public/views/PublicScheduleView.vue';

const runtime = {
  matches: [] as Match[],
  registrations: [] as Registration[],
  players: [] as Array<{ id: string; firstName: string; lastName: string }>,
  canInstall: false,
};

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeTournament: vi.fn(),
  unsubscribeTournament: vi.fn(),
  subscribeAllMatches: vi.fn(),
  unsubscribeMatches: vi.fn(),
  fetchRegistrations: vi.fn(),
  fetchPlayers: vi.fn(),
  subscribeActivities: vi.fn(),
  unsubscribeActivities: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  installApp: vi.fn(),
  dismissInstallPrompt: vi.fn(),
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
    categories: [{ id: 'cat-1', name: "Men's Singles" }],
    fetchTournament: mockDeps.fetchTournament,
    subscribeTournament: mockDeps.subscribeTournament,
    unsubscribeAll: mockDeps.unsubscribeTournament,
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtime.matches,
    inProgressMatches: runtime.matches.filter((match) => match.status === 'in_progress'),
    subscribeAllMatches: mockDeps.subscribeAllMatches,
    unsubscribeAll: mockDeps.unsubscribeMatches,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    registrations: runtime.registrations,
    players: runtime.players,
    fetchRegistrations: mockDeps.fetchRegistrations,
    fetchPlayers: mockDeps.fetchPlayers,
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

vi.mock('@/composables/usePwaInstallPrompt', () => ({
  usePwaInstallPrompt: () => ({
    canInstall: {
      get value() {
        return runtime.canInstall;
      },
    },
    installApp: mockDeps.installApp,
    dismiss: mockDeps.dismissInstallPrompt,
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
  scheduleStatus: Match['scheduleStatus'] | undefined,
  plannedStartAt: Date | undefined
): Match => ({
  id,
  tournamentId: 't1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: 'reg-1',
  participant2Id: 'reg-2',
  status: 'scheduled',
  plannedStartAt,
  scheduleStatus,
  scores: [],
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
});

const mountView = () =>
  shallowMount(PublicScheduleView, {
    global: {
      stubs: [
        'v-container',
        'v-row',
        'v-col',
        'v-card',
        'v-card-title',
        'v-card-text',
        'v-card-subtitle',
        'v-list',
        'v-list-item',
        'v-list-item-title',
        'v-list-item-subtitle',
        'v-chip',
        'v-btn',
        'v-icon',
        'v-select',
        'v-alert',
        'v-chip-group',
        'v-tooltip',
        'v-text-field',
        'v-switch',
        'v-divider',
        'v-spacer',
        'v-card-actions',
        'ActivityFeed',
      ],
    },
  });

const unwrapBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    return Boolean((value as { value?: unknown }).value);
  }
  return false;
};

const readBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    return Boolean((value as { value?: unknown }).value);
  }
  throw new Error('Expected boolean computed value');
};

const readArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && 'value' in value) {
    const unwrapped = (value as { value?: unknown }).value;
    if (Array.isArray(unwrapped)) return unwrapped as T[];
  }
  throw new Error('Expected array computed value');
};

describe('PublicScheduleView', () => {
  beforeEach(() => {
    runtime.registrations = [makeRegistration('reg-1'), makeRegistration('reg-2')];
    runtime.players = [
      { id: 'p-reg-1', firstName: 'Alice', lastName: 'A' },
      { id: 'p-reg-2', firstName: 'Bob', lastName: 'B' },
    ];
    runtime.matches = [];
    runtime.canInstall = false;

    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.unsubscribeTournament.mockReset();
    mockDeps.subscribeAllMatches.mockReset();
    mockDeps.unsubscribeMatches.mockReset();
    mockDeps.fetchRegistrations.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchPlayers.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeActivities.mockReset();
    mockDeps.unsubscribeActivities.mockReset();
    mockDeps.routerPush.mockReset();
    mockDeps.routerReplace.mockReset();
    mockDeps.installApp.mockReset().mockResolvedValue(true);
    mockDeps.dismissInstallPrompt.mockReset();
  });

  it('shows not-found state when tournament fetch fails', async () => {
    mockDeps.fetchTournament.mockRejectedValueOnce(new Error('missing'));

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as { notFound: boolean | { value: boolean } };
    expect(unwrapBoolean(vm.notFound)).toBe(true);
    expect(mockDeps.subscribeTournament).not.toHaveBeenCalled();
    expect(mockDeps.subscribeAllMatches).not.toHaveBeenCalled();
    expect(mockDeps.subscribeActivities).not.toHaveBeenCalled();
  });

  it('only treats published planned matches as public schedule entries', async () => {
    runtime.matches = [
      makeMatch('m1', 'published', new Date('2026-02-27T11:00:00.000Z')),
      makeMatch('m2', 'draft', new Date('2026-02-27T12:00:00.000Z')),
      makeMatch('m3', 'published', undefined),
    ];

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      hasPublishedSchedule: boolean | { value: boolean };
      publishedMatches: Match[] | { value: Match[] };
    };
    const hasPublishedSchedule = unwrapBoolean(vm.hasPublishedSchedule);
    const publishedMatches =
      Array.isArray(vm.publishedMatches)
        ? vm.publishedMatches
        : (vm.publishedMatches as { value: Match[] }).value;

    expect(hasPublishedSchedule).toBe(true);
    expect(publishedMatches).toHaveLength(1);
    expect(publishedMatches[0].id).toBe('m1');
  });

  it('does not show unpublished-schedule alert when live data is visible', async () => {
    const liveMatch = makeMatch('m-live', 'draft', new Date('2026-02-27T12:00:00.000Z'));
    liveMatch.status = 'in_progress';
    liveMatch.startedAt = new Date('2026-02-27T11:55:00.000Z');
    runtime.matches = [liveMatch];

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      hasPublishedSchedule: boolean | { value: boolean };
      nowPlayingItems: Match[] | { value: Match[] };
      shouldShowUnpublishedScheduleAlert: boolean | { value: boolean };
    };

    expect(unwrapBoolean(vm.hasPublishedSchedule)).toBe(false);
    expect(readArray<Match>(vm.nowPlayingItems)).toHaveLength(1);
    expect(readBoolean(vm.shouldShowUnpublishedScheduleAlert)).toBe(false);
  });

  it('exposes live-match status for header live badge rendering', async () => {
    const liveMatch = makeMatch('m-live', 'published', new Date('2026-02-27T12:00:00.000Z'));
    liveMatch.status = 'in_progress';
    runtime.matches = [liveMatch];

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      hasLiveMatches: boolean | { value: boolean };
    };

    expect(readBoolean(vm.hasLiveMatches)).toBe(true);
  });

  it('exposes install-prompt state for spectator install banner rendering', async () => {
    runtime.canInstall = true;

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      showInstallPrompt: boolean | { value: boolean };
    };

    expect(readBoolean(vm.showInstallPrompt)).toBe(true);
  });
});
