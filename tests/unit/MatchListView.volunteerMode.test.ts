import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import MatchListView from '@/features/scoring/views/MatchListView.vue';
import type { Match, VolunteerSession } from '@/types';

const routeState = vi.hoisted(() => ({
  meta: {} as Record<string, unknown>,
}));

const mockDeps = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerBack: vi.fn(),
  fetchTournament: vi.fn(),
  subscribeTournament: vi.fn(),
  tournamentUnsubscribe: vi.fn(),
  subscribeMatches: vi.fn(),
  matchUnsubscribe: vi.fn(),
  fetchRegistrations: vi.fn(),
  fetchPlayers: vi.fn(),
  registrationUnsubscribe: vi.fn(),
  showToast: vi.fn(),
  hasValidSession: vi.fn(),
}));

const volunteerSession: VolunteerSession = {
  tournamentId: 't1',
  role: 'scorekeeper',
  sessionToken: 'signed-token',
  pinRevision: 1,
  expiresAtMs: Date.now() + 60_000,
};

const sampleMatch: Match = {
  id: 'm1',
  tournamentId: 't1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 7,
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
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
    meta: routeState.meta,
  }),
  useRouter: () => ({
    push: mockDeps.routerPush,
    back: mockDeps.routerBack,
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: [sampleMatch],
    subscribeMatches: mockDeps.subscribeMatches,
    unsubscribeAll: mockDeps.matchUnsubscribe,
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: { id: 't1', name: 'Spring Open' },
    courts: [{ id: 'court-1', name: 'Court 1' }],
    categories: [{ id: 'cat-1', name: 'Mixed Doubles' }],
    fetchTournament: mockDeps.fetchTournament,
    subscribeTournament: mockDeps.subscribeTournament,
    unsubscribeAll: mockDeps.tournamentUnsubscribe,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    fetchRegistrations: mockDeps.fetchRegistrations,
    fetchPlayers: mockDeps.fetchPlayers,
    unsubscribeAll: mockDeps.registrationUnsubscribe,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

vi.mock('@/stores/volunteerAccess', () => ({
  useVolunteerAccessStore: () => ({
    currentSession: volunteerSession,
    hasValidSession: mockDeps.hasValidSession,
  }),
}));

vi.mock('@/composables/useParticipantResolver', () => ({
  useParticipantResolver: () => ({
    getParticipantName: (registrationId?: string) => {
      if (registrationId === 'reg-1') return 'Player One';
      if (registrationId === 'reg-2') return 'Player Two';
      return 'TBD';
    },
  }),
}));

interface MatchListVm {
  showManualScoreDialog: boolean;
  openScoreDialog: (match: Match) => void;
}

const mountView = () => shallowMount(MatchListView, {
  global: {
    stubs: [
      'v-container',
      'v-btn',
      'v-card',
      'v-card-title',
      'v-card-text',
      'v-chip',
      'v-icon',
      'v-list',
      'v-list-item',
      'v-list-item-title',
      'v-list-item-subtitle',
      'v-avatar',
      'v-col',
      'v-select',
      'filter-bar',
      'manual-score-dialog',
    ],
  },
});

describe('MatchListView volunteer scoring mode', () => {
  beforeEach(() => {
    routeState.meta = {};
    mockDeps.routerPush.mockReset();
    mockDeps.routerBack.mockReset();
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.tournamentUnsubscribe.mockReset();
    mockDeps.subscribeMatches.mockReset();
    mockDeps.matchUnsubscribe.mockReset();
    mockDeps.fetchRegistrations.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchPlayers.mockReset().mockResolvedValue(undefined);
    mockDeps.registrationUnsubscribe.mockReset();
    mockDeps.showToast.mockReset();
    mockDeps.hasValidSession.mockReset().mockReturnValue(false);
  });

  it('routes volunteer scorekeepers into the point-by-point scoring screen', () => {
    routeState.meta = {
      requiresVolunteerSession: true,
      volunteerRole: 'scorekeeper',
    };
    mockDeps.hasValidSession.mockReturnValue(true);

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as MatchListVm;

    vm.openScoreDialog(sampleMatch);

    expect(mockDeps.routerPush).toHaveBeenCalledWith({
      name: 'volunteer-scoring-match',
      params: { tournamentId: 't1', matchId: 'm1' },
      query: { category: 'cat-1' },
    });
    expect(vm.showManualScoreDialog).toBe(false);
  });

  it('keeps the manual score dialog for staff scoring routes', () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as MatchListVm;

    vm.openScoreDialog(sampleMatch);

    expect(mockDeps.routerPush).not.toHaveBeenCalled();
    expect(vm.showManualScoreDialog).toBe(true);
  });
});
