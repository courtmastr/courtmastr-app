import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import ParticipantsView from '@/features/registration/views/ParticipantsView.vue';
import type { Category, Player, Registration } from '@/types';

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeRegistrations: vi.fn(),
  subscribePlayers: vi.fn(),
  updatePlayer: vi.fn(),
  deletePlayer: vi.fn(),
  addPlayer: vi.fn(),
  showToast: vi.fn(),
  back: vi.fn(),
}));

const mockCategories: Category[] = [
  {
    id: 'cat-ms',
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
    id: 'cat-md',
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
  {
    id: 'cat-mxd',
    tournamentId: 't1',
    name: 'Mixed Doubles',
    type: 'mixed_doubles',
    gender: 'mixed',
    ageGroup: 'open',
    format: 'single_elimination',
    seedingEnabled: true,
    status: 'registration',
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

const mockRegistrations: Registration[] = [
  {
    id: 'reg-singles',
    tournamentId: 't1',
    categoryId: 'cat-ms',
    participantType: 'player',
    playerId: 'p1',
    status: 'approved',
    registeredBy: 'admin-1',
    registeredAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedBy: 'admin-1',
  },
  {
    id: 'reg-doubles',
    tournamentId: 't1',
    categoryId: 'cat-md',
    participantType: 'team',
    playerId: 'p1',
    partnerPlayerId: 'p2',
    teamName: 'Alice / Bob',
    status: 'checked_in',
    registeredBy: 'admin-1',
    registeredAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedBy: 'admin-1',
  },
  {
    id: 'reg-mixed',
    tournamentId: 't1',
    categoryId: 'cat-mxd',
    participantType: 'team',
    playerId: 'p1',
    partnerPlayerId: 'p2',
    teamName: 'Alice / Bob MX',
    status: 'approved',
    registeredBy: 'admin-1',
    registeredAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedBy: 'admin-1',
  },
];

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
  }),
  useRouter: () => ({
    back: mockDeps.back,
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
        requireApproval: false,
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
    registrations: mockRegistrations,
    players: mockPlayers,
    loading: false,
    subscribeRegistrations: mockDeps.subscribeRegistrations,
    subscribePlayers: mockDeps.subscribePlayers,
    updatePlayer: mockDeps.updatePlayer,
    deletePlayer: mockDeps.deletePlayer,
    addPlayer: mockDeps.addPlayer,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

vi.mock('@/config/featureFlags', () => ({
  PLAYER_IDENTITY_V2: false,
}));

vi.mock('@/composables/usePlayerCandidatePicker', () => ({
  usePlayerCandidatePicker: () => ({
    candidates: { value: [] },
    selectedCandidate: { value: null },
    isLoading: { value: false },
    search: vi.fn(),
    selectExisting: vi.fn(),
    selectCreateNew: vi.fn(),
    reset: vi.fn(),
  }),
}));

const mountView = () => shallowMount(ParticipantsView, {
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
      'v-data-table',
      'v-avatar',
      'v-dialog',
      'v-text-field',
      'v-slider',
      'v-spacer',
      'filter-bar',
      'FilterBar',
      'StateBanner',
      'PlayerCandidateSuggestions',
    ],
  },
});

describe('ParticipantsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts total and checked-in stats as unique participants, not registrations', () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as {
      participantStats: {
        total: number;
        checkedIn: number;
        singles: number;
        doubles: number;
      };
      filteredParticipants: Player[];
    };

    expect(vm.filteredParticipants).toHaveLength(2);
    expect(vm.participantStats.total).toBe(2);
    expect(vm.participantStats.checkedIn).toBe(2);
    expect(vm.participantStats.singles).toBe(1);
    expect(vm.participantStats.doubles).toBe(2);
  });
});
