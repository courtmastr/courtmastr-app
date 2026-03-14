import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { shallowMount } from '@vue/test-utils';
import ScoringInterfaceView from '@/features/scoring/views/ScoringInterfaceView.vue';
import type { Match, VolunteerSession } from '@/types';

const routeState = vi.hoisted(() => ({
  meta: {} as Record<string, unknown>,
  query: {} as Record<string, unknown>,
}));

const matchRef = ref<Match | null>(null);

const mockDeps = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerBack: vi.fn(),
  fetchTournament: vi.fn(),
  fetchMatch: vi.fn(),
  subscribeMatch: vi.fn(),
  clearCurrentMatch: vi.fn(),
  subscribeRegistrations: vi.fn(),
  subscribePlayers: vi.fn(),
  updateScore: vi.fn(),
  decrementScore: vi.fn(),
  completeCurrentGame: vi.fn(),
  logMatchCompleted: vi.fn(),
  logMatchStarted: vi.fn(),
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

const inProgressMatch: Match = {
  id: 'm1',
  tournamentId: 't1',
  categoryId: 'cat-1',
  round: 2,
  matchNumber: 4,
  bracketPosition: {
    bracket: 'winners',
    round: 2,
    position: 1,
  },
  participant1Id: 'reg-1',
  participant2Id: 'reg-2',
  status: 'in_progress',
  courtId: 'court-1',
  scores: [{
    gameNumber: 1,
    score1: 11,
    score2: 9,
    isComplete: false,
  }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1', matchId: 'm1' },
    meta: routeState.meta,
    query: routeState.query,
  }),
  useRouter: () => ({
    push: mockDeps.routerPush,
    back: mockDeps.routerBack,
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    get currentMatch() {
      return matchRef.value;
    },
    fetchMatch: mockDeps.fetchMatch,
    subscribeMatch: mockDeps.subscribeMatch,
    clearCurrentMatch: mockDeps.clearCurrentMatch,
    startMatch: vi.fn(),
    updateScore: mockDeps.updateScore,
    decrementScore: mockDeps.decrementScore,
    completeCurrentGame: mockDeps.completeCurrentGame,
    recordWalkover: vi.fn(),
    submitManualScores: vi.fn(),
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    courts: [{ id: 'court-1', name: 'Court 1' }],
    categories: [{ id: 'cat-1', name: 'Mixed Doubles' }],
    fetchTournament: mockDeps.fetchTournament,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    subscribeRegistrations: mockDeps.subscribeRegistrations,
    subscribePlayers: mockDeps.subscribePlayers,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

vi.mock('@/stores/activities', () => ({
  useActivityStore: () => ({
    logMatchCompleted: mockDeps.logMatchCompleted,
    logMatchStarted: mockDeps.logMatchStarted,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAdmin: false,
    isScorekeeper: false,
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

interface ScoringVm {
  canCorrectMatch: boolean;
  scoreEntryLocked: boolean;
  currentGameReadyToComplete: boolean;
  addPoint: (participant: 'participant1' | 'participant2') => Promise<void>;
  removePoint: (participant: 'participant1' | 'participant2') => Promise<void>;
  completeCurrentGame: () => Promise<void>;
  goBack: () => void;
}

const mountView = () => shallowMount(ScoringInterfaceView, {
  global: {
    stubs: [
      'v-container',
      'v-row',
      'v-col',
      'v-card',
      'v-card-text',
      'v-card-title',
      'v-btn',
      'v-icon',
      'v-chip',
      'v-spacer',
      'v-divider',
      'v-card-actions',
      'v-menu',
      'v-list',
      'v-list-item',
      'v-dialog',
      'v-alert',
      'v-progress-circular',
      'v-text-field',
      'score-correction-dialog',
    ],
  },
});

describe('ScoringInterfaceView volunteer mode', () => {
  beforeEach(() => {
    routeState.meta = {};
    routeState.query = { category: 'cat-1' };
    matchRef.value = inProgressMatch;
    mockDeps.routerPush.mockReset();
    mockDeps.routerBack.mockReset();
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchMatch.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeMatch.mockReset();
    mockDeps.clearCurrentMatch.mockReset();
    mockDeps.subscribeRegistrations.mockReset();
    mockDeps.subscribePlayers.mockReset();
    mockDeps.updateScore.mockReset().mockResolvedValue(undefined);
    mockDeps.decrementScore.mockReset().mockResolvedValue(undefined);
    mockDeps.completeCurrentGame.mockReset().mockResolvedValue(undefined);
    mockDeps.logMatchCompleted.mockReset().mockResolvedValue(undefined);
    mockDeps.logMatchStarted.mockReset().mockResolvedValue(undefined);
    mockDeps.showToast.mockReset();
    mockDeps.hasValidSession.mockReset().mockReturnValue(false);
  });

  it('returns volunteer scorekeepers to the kiosk match list', () => {
    routeState.meta = {
      requiresVolunteerSession: true,
      volunteerRole: 'scorekeeper',
    };
    mockDeps.hasValidSession.mockReturnValue(true);

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as ScoringVm;

    vm.goBack();

    expect(mockDeps.routerPush).toHaveBeenCalledWith({
      name: 'volunteer-scoring-kiosk',
      params: { tournamentId: 't1' },
    });
    expect(mockDeps.routerBack).not.toHaveBeenCalled();
  });

  it('allows volunteer scorekeepers to correct completed matches', () => {
    routeState.meta = {
      requiresVolunteerSession: true,
      volunteerRole: 'scorekeeper',
    };
    mockDeps.hasValidSession.mockReturnValue(true);
    matchRef.value = {
      ...inProgressMatch,
      status: 'completed',
      winnerId: 'reg-1',
      scores: [{
        gameNumber: 1,
        score1: 21,
        score2: 18,
        winnerId: 'reg-1',
        isComplete: true,
      }, {
        gameNumber: 2,
        score1: 21,
        score2: 17,
        winnerId: 'reg-1',
        isComplete: true,
      }],
    };

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as ScoringVm;

    expect(vm.canCorrectMatch).toBe(true);
  });

  it('locks point entry at game point and requires explicit complete-game action', async () => {
    matchRef.value = {
      ...inProgressMatch,
      scores: [{
        gameNumber: 1,
        score1: 21,
        score2: 19,
        isComplete: false,
      }],
    };

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as ScoringVm;

    expect(vm.scoreEntryLocked).toBe(true);
    expect(vm.currentGameReadyToComplete).toBe(true);

    await vm.addPoint('participant1');
    expect(mockDeps.updateScore).not.toHaveBeenCalled();

    await vm.removePoint('participant1');
    expect(mockDeps.decrementScore).toHaveBeenCalledTimes(1);

    await vm.completeCurrentGame();
    expect(mockDeps.completeCurrentGame).toHaveBeenCalledTimes(1);
  });
});
