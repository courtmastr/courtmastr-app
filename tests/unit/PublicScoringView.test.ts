import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import type { Match } from '@/types';
import PublicScoringView from '@/features/public/views/PublicScoringView.vue';

const runtime = {
  matches: [] as Match[],
  currentMatch: null as Match | null,
  canInstall: false,
};

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeTournament: vi.fn(),
  unsubscribeTournament: vi.fn(),
  subscribeAllMatches: vi.fn(),
  unsubscribeMatches: vi.fn(),
  subscribeMatch: vi.fn(),
  clearCurrentMatch: vi.fn(),
  startMatch: vi.fn(),
  updateScore: vi.fn(),
  decrementScore: vi.fn(),
  subscribeRegistrations: vi.fn(),
  subscribePlayers: vi.fn(),
  unsubscribeRegistrations: vi.fn(),
  installApp: vi.fn(),
  dismissInstallPrompt: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: { id: 't1', name: 'Spring Open' },
    categories: [{ id: 'cat-1', name: "Men's Singles" }],
    courts: [{ id: 'court-1', name: 'Court 1' }],
    fetchTournament: mockDeps.fetchTournament,
    subscribeTournament: mockDeps.subscribeTournament,
    unsubscribeAll: mockDeps.unsubscribeTournament,
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtime.matches,
    currentMatch: runtime.currentMatch,
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
    registrations: [],
    players: [],
    subscribeRegistrations: mockDeps.subscribeRegistrations,
    subscribePlayers: mockDeps.subscribePlayers,
    unsubscribeAll: mockDeps.unsubscribeRegistrations,
  }),
}));

vi.mock('@/composables/useParticipantResolver', () => ({
  useParticipantResolver: () => ({
    getParticipantName: (registrationId?: string) => registrationId ?? 'TBD',
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

const makeReadyMatch = (): Match => ({
  id: 'm1',
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
  status: 'ready',
  courtId: 'court-1',
  scores: [],
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
});

const mountView = () =>
  shallowMount(PublicScoringView, {
    global: {
      stubs: [
        'v-container',
        'v-row',
        'v-col',
        'v-card',
        'v-card-text',
        'v-card-item',
        'v-card-title',
        'v-card-subtitle',
        'v-list',
        'v-btn',
        'v-chip',
        'v-icon',
        'v-avatar',
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

describe('PublicScoringView', () => {
  beforeEach(() => {
    runtime.matches = [makeReadyMatch()];
    runtime.currentMatch = null;
    runtime.canInstall = false;

    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.unsubscribeTournament.mockReset();
    mockDeps.subscribeAllMatches.mockReset();
    mockDeps.unsubscribeMatches.mockReset();
    mockDeps.subscribeMatch.mockReset();
    mockDeps.clearCurrentMatch.mockReset();
    mockDeps.startMatch.mockReset().mockResolvedValue(undefined);
    mockDeps.updateScore.mockReset().mockResolvedValue(undefined);
    mockDeps.decrementScore.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeRegistrations.mockReset();
    mockDeps.subscribePlayers.mockReset();
    mockDeps.unsubscribeRegistrations.mockReset();
    mockDeps.installApp.mockReset().mockResolvedValue(true);
    mockDeps.dismissInstallPrompt.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows not-found state when tournament fetch fails', async () => {
    mockDeps.fetchTournament.mockRejectedValueOnce(new Error('missing'));

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as { notFound: boolean | { value: boolean } };
    expect(unwrapBoolean(vm.notFound)).toBe(true);
    expect(mockDeps.subscribeTournament).not.toHaveBeenCalled();
    expect(mockDeps.subscribeAllMatches).not.toHaveBeenCalled();
    expect(mockDeps.subscribeRegistrations).not.toHaveBeenCalled();
  });

  it('auto-starts ready match once before score updates', async () => {
    vi.useFakeTimers();

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      selectMatch: (match: Match) => void;
      addPoint: (participant: 'participant1' | 'participant2') => Promise<void>;
    };
    const match = makeReadyMatch();

    vm.selectMatch(match);

    const firstAdd = vm.addPoint('participant1');
    await vi.runAllTimersAsync();
    await firstAdd;

    await vm.addPoint('participant1');

    expect(mockDeps.startMatch).toHaveBeenCalledTimes(1);
    expect(mockDeps.updateScore).toHaveBeenCalledTimes(2);
  });

  it('exposes live-match state for shell live badge rendering', async () => {
    const liveMatch = makeReadyMatch();
    liveMatch.status = 'in_progress';
    runtime.matches = [liveMatch];

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      hasLiveMatches: boolean | { value: boolean };
    };

    expect(unwrapBoolean(vm.hasLiveMatches)).toBe(true);
  });

  it('exposes install prompt state for public scoring banner rendering', async () => {
    runtime.canInstall = true;

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      showInstallPrompt: boolean | { value: boolean };
    };

    expect(unwrapBoolean(vm.showInstallPrompt)).toBe(true);
  });
});
