import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import SelfRegistrationView from '@/features/registration/views/SelfRegistrationView.vue';
import type { Category } from '@/types';

const pickerRuntime = vi.hoisted(() => ({
  callCount: 0,
  primary: {
    candidates: { value: [] as unknown[] },
    selectedCandidate: { value: null as string | null },
    isLoading: { value: false },
    error: { value: null as string | null },
    search: vi.fn(),
    selectExisting: vi.fn(),
    selectCreateNew: vi.fn(),
    reset: vi.fn(),
  },
  partner: {
    candidates: { value: [] as unknown[] },
    selectedCandidate: { value: null as string | null },
    isLoading: { value: false },
    error: { value: null as string | null },
    search: vi.fn(),
    selectExisting: vi.fn(),
    selectCreateNew: vi.fn(),
    reset: vi.fn(),
  },
}));

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  addPlayer: vi.fn(),
  createRegistration: vi.fn(),
  showToast: vi.fn(),
}));

const baseCategories: Category[] = [
  {
    id: 'cat-singles',
    tournamentId: 't1',
    name: "Men's Singles",
    type: 'singles',
    gender: 'men',
    ageGroup: 'open',
    format: 'single_elimination',
    seedingEnabled: true,
    status: 'registration',
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
    status: 'registration',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

const makeTournamentStore = (requireApproval: boolean) => ({
  currentTournament: {
    id: 't1',
    name: 'Spring Open',
    status: 'registration',
    settings: {
      allowSelfRegistration: true,
      requireApproval,
      minRestTimeMinutes: 15,
      matchDurationMinutes: 30,
      gamesPerMatch: 3,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
    },
    startDate: new Date('2026-04-12T00:00:00.000Z'),
    endDate: new Date('2026-04-13T00:00:00.000Z'),
  },
  categories: baseCategories,
  fetchTournament: mockDeps.fetchTournament,
});

let requireApproval = true;

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => makeTournamentStore(requireApproval),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    addPlayer: mockDeps.addPlayer,
    createRegistration: mockDeps.createRegistration,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'user-1', role: 'player' },
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
  usePlayerCandidatePicker: () => {
    const picker = pickerRuntime.callCount === 0 ? pickerRuntime.primary : pickerRuntime.partner;
    pickerRuntime.callCount += 1;
    return picker;
  },
}));

vi.mock('@/composables/useAsyncOperation', () => ({
  useAsyncOperation: () => ({
    loading: { value: false },
    execute: async <T>(operation: () => Promise<T>): Promise<T> => operation(),
  }),
}));

const mountView = () => shallowMount(SelfRegistrationView, {
  global: {
    stubs: [
      'v-container',
      'v-row',
      'v-col',
      'v-card',
      'v-card-title',
      'v-card-subtitle',
      'v-card-text',
      'v-btn',
      'v-icon',
      'v-alert',
      'v-progress-circular',
      'v-form',
      'v-text-field',
      'v-checkbox',
      'v-divider',
      'PlayerCandidateSuggestions',
    ],
  },
});

interface SelfRegistrationVm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  selectedCategories: string[];
  partnerName: string;
  partnerEmail: string;
  submitRegistration: () => Promise<void>;
}

describe('SelfRegistrationView', () => {
  beforeEach(() => {
    requireApproval = true;
    pickerRuntime.callCount = 0;
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.addPlayer.mockReset()
      .mockResolvedValueOnce('player-1')
      .mockResolvedValueOnce('partner-1');
    mockDeps.createRegistration.mockReset().mockResolvedValue('reg-1');
    mockDeps.showToast.mockReset();
    pickerRuntime.primary.candidates.value = [];
    pickerRuntime.primary.selectedCandidate.value = null;
    pickerRuntime.primary.isLoading.value = false;
    pickerRuntime.primary.error.value = null;
    pickerRuntime.primary.search.mockReset();
    pickerRuntime.primary.selectExisting.mockReset();
    pickerRuntime.primary.selectCreateNew.mockReset();
    pickerRuntime.primary.reset.mockReset();
    pickerRuntime.partner.candidates.value = [];
    pickerRuntime.partner.selectedCandidate.value = null;
    pickerRuntime.partner.isLoading.value = false;
    pickerRuntime.partner.error.value = null;
    pickerRuntime.partner.search.mockReset();
    pickerRuntime.partner.selectExisting.mockReset();
    pickerRuntime.partner.selectCreateNew.mockReset();
    pickerRuntime.partner.reset.mockReset();
  });

  it('creates partner registration for doubles and marks status pending when approval is required', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as SelfRegistrationVm;

    vm.firstName = 'Alice';
    vm.lastName = 'Anderson';
    vm.email = 'alice@example.com';
    vm.phone = '555-1000';
    vm.selectedCategories = ['cat-doubles'];
    vm.partnerName = 'Bob Brown';
    vm.partnerEmail = 'bob@example.com';

    await vm.submitRegistration();

    expect(mockDeps.addPlayer).toHaveBeenCalledTimes(2);
    expect(mockDeps.addPlayer).toHaveBeenNthCalledWith(
      1,
      't1',
      expect.objectContaining({
        firstName: 'Alice',
        lastName: 'Anderson',
        email: 'alice@example.com',
      }),
      null,
    );
    expect(mockDeps.addPlayer).toHaveBeenNthCalledWith(
      2,
      't1',
      expect.objectContaining({
        firstName: 'Bob',
        lastName: 'Brown',
        email: 'bob@example.com',
      }),
      null,
    );
    expect(mockDeps.createRegistration).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        categoryId: 'cat-doubles',
        playerId: 'player-1',
        partnerPlayerId: 'partner-1',
        status: 'pending',
      })
    );
    expect(mockDeps.showToast).toHaveBeenCalledWith(
      'success',
      'Registration submitted successfully!'
    );
  });

  it('auto-approves singles registration when tournament does not require approval', async () => {
    requireApproval = false;
    mockDeps.addPlayer.mockReset().mockResolvedValue('player-1');

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as SelfRegistrationVm;

    vm.firstName = 'Chris';
    vm.lastName = 'Carter';
    vm.email = 'chris@example.com';
    vm.phone = '555-2000';
    vm.selectedCategories = ['cat-singles'];
    vm.partnerName = '';
    vm.partnerEmail = '';

    await vm.submitRegistration();

    expect(mockDeps.addPlayer).toHaveBeenCalledTimes(1);
    expect(mockDeps.addPlayer).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        firstName: 'Chris',
        lastName: 'Carter',
        email: 'chris@example.com',
      }),
      null,
    );
    expect(mockDeps.createRegistration).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        categoryId: 'cat-singles',
        playerId: 'player-1',
        status: 'approved',
      })
    );
    const payload = mockDeps.createRegistration.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.partnerPlayerId).toBeUndefined();
  });
});
