import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import RegistrationManagementView from '@/features/registration/views/RegistrationManagementView.vue';
import type { Category, Player } from '@/types';

const candidatePickerState = vi.hoisted(() => ({
  candidates: { value: [] as unknown[] },
  selectedCandidate: { value: null as string | null },
  isLoading: { value: false },
  error: { value: null as string | null },
  search: vi.fn(),
  selectExisting: vi.fn(),
  selectCreateNew: vi.fn(),
  reset: vi.fn(),
}));

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeRegistrations: vi.fn(),
  subscribePlayers: vi.fn(),
  createRegistration: vi.fn(),
  approveRegistration: vi.fn(),
  rejectRegistration: vi.fn(),
  addPlayer: vi.fn(),
  updatePlayer: vi.fn(),
  deletePlayer: vi.fn(),
  checkInRegistration: vi.fn(),
  undoCheckInRegistration: vi.fn(),
  withdrawRegistration: vi.fn(),
  reinstateRegistration: vi.fn(),
  updatePaymentStatus: vi.fn(),
  showToast: vi.fn(),
  routerReplace: vi.fn(),
}));

const mockCategories: Category[] = [
  {
    id: 'cat-singles',
    tournamentId: 't1',
    name: "Men's Singles",
    type: 'singles',
    gender: 'men',
    ageGroup: 'open',
    format: 'single_elimination',
    seedingEnabled: true,
    status: 'setup',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: 'cat-doubles',
    tournamentId: 't1',
    name: "Men's Doubles",
    type: 'doubles',
    gender: 'men',
    ageGroup: 'open',
    format: 'single_elimination',
    seedingEnabled: true,
    status: 'setup',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

const mockPlayers: Player[] = [
  {
    id: 'p1',
    firstName: 'Alice',
    lastName: 'Anderson',
    email: 'alice@example.com',
    phone: '555-1001',
    skillLevel: 7,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: 'p2',
    firstName: 'Bob',
    lastName: 'Brown',
    email: 'bob@example.com',
    phone: '555-1002',
    skillLevel: 6,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
    query: {},
  }),
  useRouter: () => ({
    replace: mockDeps.routerReplace,
    push: vi.fn(),
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: {
      id: 't1',
      name: 'Spring Open',
      status: 'registration',
      state: 'REG_OPEN',
      settings: {
        allowSelfRegistration: true,
        requireApproval: true,
        minRestTimeMinutes: 15,
        matchDurationMinutes: 30,
        gamesPerMatch: 3,
        pointsToWin: 21,
        mustWinBy: 2,
        maxPoints: 30,
      },
    },
    categories: mockCategories,
    fetchTournament: mockDeps.fetchTournament,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    registrations: [],
    players: mockPlayers,
    loading: false,
    subscribeRegistrations: mockDeps.subscribeRegistrations,
    subscribePlayers: mockDeps.subscribePlayers,
    createRegistration: mockDeps.createRegistration,
    approveRegistration: mockDeps.approveRegistration,
    rejectRegistration: mockDeps.rejectRegistration,
    addPlayer: mockDeps.addPlayer,
    updatePlayer: mockDeps.updatePlayer,
    deletePlayer: mockDeps.deletePlayer,
    checkInRegistration: mockDeps.checkInRegistration,
    undoCheckInRegistration: mockDeps.undoCheckInRegistration,
    withdrawRegistration: mockDeps.withdrawRegistration,
    reinstateRegistration: mockDeps.reinstateRegistration,
    updatePaymentStatus: mockDeps.updatePaymentStatus,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'admin-1', role: 'admin' },
    isAdmin: true,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

vi.mock('@/config/featureFlags', () => ({
  PLAYER_IDENTITY_V2: true,
}));

vi.mock('@/composables/usePlayerCandidatePicker', () => ({
  usePlayerCandidatePicker: () => candidatePickerState,
}));

vi.mock('@/composables/useTournamentStateAdvance', () => ({
  useTournamentStateAdvance: () => ({
    advanceState: vi.fn(),
    getNextState: vi.fn(() => null),
    transitionTo: vi.fn(),
  }),
}));

const mountView = () => shallowMount(RegistrationManagementView, {
  global: {
    stubs: [
      'v-container',
      'v-row',
      'v-col',
      'v-card',
      'v-card-title',
      'v-card-text',
      'v-card-actions',
      'v-btn',
      'v-icon',
      'v-chip',
      'v-alert',
      'v-dialog',
      'v-text-field',
      'v-select',
      'v-checkbox',
      'v-switch',
      'v-divider',
      'v-list',
      'v-list-item',
      'v-menu',
      'v-spacer',
      'v-tabs',
      'v-tab',
      'v-window',
      'v-window-item',
      'v-tabs-window',
      'v-tabs-window-item',
      'v-data-table',
      'v-table',
      'v-tooltip',
      'v-slide-y-transition',
      'v-avatar',
      'v-list-item-title',
      'v-list-item-subtitle',
      'v-slider',
      'v-file-input',
      'v-sheet',
      'v-textarea',
      'v-progress-circular',
      'FilterBar',
      'StateBanner',
      'BaseDialog',
      'PlayerCandidateSuggestions',
    ],
  },
});

interface RegistrationManagementVm {
  newPlayer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    skillLevel: number;
  };
  addPlayer: () => Promise<void>;
  newRegistration: {
    playerId: string;
    categoryId: string;
    partnerPlayerId: string;
  };
  addRegistration: () => Promise<void>;
  approveRegistration: (registrationId: string) => Promise<void>;
}

describe('RegistrationManagementView', () => {
  beforeEach(() => {
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeRegistrations.mockReset();
    mockDeps.subscribePlayers.mockReset();
    mockDeps.createRegistration.mockReset().mockResolvedValue('reg-1');
    mockDeps.approveRegistration.mockReset().mockResolvedValue(undefined);
    mockDeps.rejectRegistration.mockReset().mockResolvedValue(undefined);
    mockDeps.addPlayer.mockReset().mockResolvedValue('player-3');
    mockDeps.showToast.mockReset();
    mockDeps.routerReplace.mockReset().mockResolvedValue(undefined);
    candidatePickerState.candidates.value = [];
    candidatePickerState.selectedCandidate.value = null;
    candidatePickerState.isLoading.value = false;
    candidatePickerState.error.value = null;
    candidatePickerState.search.mockReset();
    candidatePickerState.selectExisting.mockReset();
    candidatePickerState.selectCreateNew.mockReset();
    candidatePickerState.reset.mockReset();
  });

  it('passes the selected candidate id into addPlayer when linking an existing player', async () => {
    candidatePickerState.selectedCandidate.value = 'existing-player-9';
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as RegistrationManagementVm;

    vm.newPlayer.firstName = 'Alice';
    vm.newPlayer.lastName = 'Anderson';
    vm.newPlayer.email = 'alice@example.com';
    vm.newPlayer.phone = '555-1001';
    vm.newPlayer.skillLevel = 7;

    await vm.addPlayer();

    expect(mockDeps.addPlayer).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        firstName: 'Alice',
        lastName: 'Anderson',
        email: 'alice@example.com',
      }),
      'existing-player-9',
    );
  });

  it('requires partner selection for doubles registration', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as RegistrationManagementVm;

    vm.newRegistration.categoryId = 'cat-doubles';
    vm.newRegistration.playerId = 'p1';
    vm.newRegistration.partnerPlayerId = '';

    await vm.addRegistration();

    expect(mockDeps.createRegistration).not.toHaveBeenCalled();
    expect(mockDeps.showToast).toHaveBeenCalledWith(
      'error',
      'Please select a partner for doubles registration'
    );
  });

  it('creates doubles registration payload with team participant data', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as RegistrationManagementVm;

    vm.newRegistration.categoryId = 'cat-doubles';
    vm.newRegistration.playerId = 'p1';
    vm.newRegistration.partnerPlayerId = 'p2';

    await vm.addRegistration();

    expect(mockDeps.createRegistration).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        participantType: 'team',
        playerId: 'p1',
        partnerPlayerId: 'p2',
        teamName: 'Alice Anderson / Bob Brown',
        status: 'approved',
      })
    );
    expect(mockDeps.showToast).toHaveBeenCalledWith('success', 'Registration added');
  });

  it('routes approve action through registration store with actor id', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as RegistrationManagementVm;

    await vm.approveRegistration('reg-7');

    expect(mockDeps.approveRegistration).toHaveBeenCalledWith('t1', 'reg-7', 'admin-1');
    expect(mockDeps.showToast).toHaveBeenCalledWith('success', 'Registration approved');
  });
});
