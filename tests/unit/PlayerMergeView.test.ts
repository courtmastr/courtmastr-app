import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import PlayerMergeView from '@/features/players/views/PlayerMergeView.vue';
import type { GlobalPlayer } from '@/types';

const mockPlayers: GlobalPlayer[] = [
  {
    id: 'player-source',
    firstName: 'Alex',
    lastName: 'Source',
    email: 'alex@example.com',
    emailNormalized: 'alex@example.com',
    phone: '555-1111',
    skillLevel: 5,
    userId: null,
    isActive: true,
    isVerified: false,
    identityStatus: 'active',
    mergedIntoPlayerId: null,
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    stats: {
      overall: { wins: 0, losses: 0, gamesPlayed: 0, tournamentsPlayed: 0 },
    },
  },
  {
    id: 'player-target',
    firstName: 'Taylor',
    lastName: 'Target',
    email: 'taylor@example.com',
    emailNormalized: 'taylor@example.com',
    phone: '555-2222',
    skillLevel: 6,
    userId: null,
    isActive: true,
    isVerified: true,
    identityStatus: 'active',
    mergedIntoPlayerId: null,
    createdAt: new Date('2026-04-02T12:00:00.000Z'),
    updatedAt: new Date('2026-04-02T12:00:00.000Z'),
    stats: {
      overall: { wins: 4, losses: 1, gamesPlayed: 10, tournamentsPlayed: 2 },
    },
  },
];

const mockDeps = vi.hoisted(() => {
  const fetchPlayers = vi.fn();
  const showToast = vi.fn();
  const routerPush = vi.fn();
  const routerBack = vi.fn();
  const executeMergeCallable = vi.fn();
  const httpsCallable = vi.fn(() => executeMergeCallable);

  return {
    fetchPlayers,
    showToast,
    routerPush,
    routerBack,
    executeMergeCallable,
    httpsCallable,
  };
});

vi.mock('@/config/featureFlags', () => ({
  PLAYER_IDENTITY_V2: true,
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {},
    query: {},
  }),
  useRouter: () => ({
    push: mockDeps.routerPush,
    back: mockDeps.routerBack,
  }),
}));

vi.mock('@/stores/players', () => ({
  usePlayersStore: () => ({
    players: mockPlayers,
    fetchPlayers: mockDeps.fetchPlayers,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

vi.mock('@/services/firebase', () => ({
  functions: {},
  httpsCallable: mockDeps.httpsCallable,
}));

const mountView = () => shallowMount(PlayerMergeView, {
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
      'v-autocomplete',
      'v-alert',
      'v-dialog',
      'v-spacer',
    ],
  },
});

interface PlayerMergeVm {
  sourcePlayerId: string | null;
  targetPlayerId: string | null;
  isConfirming: boolean;
  executeMerge: () => Promise<void>;
}

describe('PlayerMergeView', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDeps.fetchPlayers.mockReset().mockResolvedValue(undefined);
    mockDeps.showToast.mockReset();
    mockDeps.routerPush.mockReset().mockResolvedValue(undefined);
    mockDeps.routerBack.mockReset();
    mockDeps.executeMergeCallable.mockReset().mockResolvedValue({
      data: { success: true, targetPlayerId: 'player-target' },
    });
    mockDeps.httpsCallable.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads players on mount', () => {
    mountView();

    expect(mockDeps.fetchPlayers).toHaveBeenCalledOnce();
  });

  it('calls executeMerge and navigates back to the players list on success', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as PlayerMergeVm;

    vm.sourcePlayerId = 'player-source';
    vm.targetPlayerId = 'player-target';
    await vm.executeMerge();

    expect(mockDeps.httpsCallable).toHaveBeenCalledWith({}, 'executeMerge');
    expect(mockDeps.executeMergeCallable).toHaveBeenCalledWith({
      sourcePlayerId: 'player-source',
      targetPlayerId: 'player-target',
    });
    expect(mockDeps.showToast).toHaveBeenCalledWith('success', 'Players merged successfully');
    expect(mockDeps.routerPush).toHaveBeenCalledWith({ name: 'players-list' });
  });

  it('shows an error toast when merge execution fails', async () => {
    mockDeps.executeMergeCallable.mockRejectedValueOnce(new Error('permission denied'));

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as PlayerMergeVm;

    vm.sourcePlayerId = 'player-source';
    vm.targetPlayerId = 'player-target';
    await vm.executeMerge();

    expect(mockDeps.showToast).toHaveBeenCalledWith('error', 'Merge failed: permission denied');
  });
});
