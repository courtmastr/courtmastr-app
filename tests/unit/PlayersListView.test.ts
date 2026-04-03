import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { shallowMount } from '@vue/test-utils';
import PlayersListView from '@/features/players/views/PlayersListView.vue';
import type { GlobalPlayer } from '@/types';

const routerPush = vi.fn();

const mockPlayers: GlobalPlayer[] = [
  {
    id: 'p1',
    firstName: 'Alex',
    lastName: 'Able',
    email: 'alex@example.com',
    emailNormalized: 'alex@example.com',
    phone: '555-1001',
    skillLevel: 5,
    userId: null,
    isActive: true,
    isVerified: true,
    identityStatus: 'active',
    mergedIntoPlayerId: null,
    createdAt: new Date('2026-04-02T00:00:00.000Z'),
    updatedAt: new Date('2026-04-02T00:00:00.000Z'),
    stats: { overall: { wins: 4, losses: 1, gamesPlayed: 8, tournamentsPlayed: 2 } },
  },
  {
    id: 'p2',
    firstName: 'Morgan',
    lastName: 'Merged',
    email: 'morgan@example.com',
    emailNormalized: 'morgan@example.com',
    phone: '555-1002',
    skillLevel: 4,
    userId: null,
    isActive: false,
    isVerified: false,
    identityStatus: 'merged',
    mergedIntoPlayerId: 'p1',
    createdAt: new Date('2026-04-02T00:00:00.000Z'),
    updatedAt: new Date('2026-04-02T00:00:00.000Z'),
    stats: { overall: { wins: 1, losses: 3, gamesPlayed: 6, tournamentsPlayed: 2 } },
  },
];

vi.mock('@/config/featureFlags', () => ({
  PLAYER_IDENTITY_V2: true,
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock('@/stores/players', () => ({
  usePlayersStore: () => ({
    players: mockPlayers,
    fetchPlayers: vi.fn().mockResolvedValue(undefined),
    fetchOrgPlayers: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/stores/organizations', () => ({
  useOrganizationsStore: () => ({
    fetchOrgTournaments: vi.fn().mockResolvedValue(undefined),
    orgTournaments: [],
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'admin-1', role: 'admin', activeOrgId: null },
    isAdmin: true,
  }),
}));

vi.mock('@/composables/useAsyncOperation', () => ({
  useAsyncOperation: () => ({
    execute: (fn: () => Promise<void>) => fn(),
    loading: false,
  }),
}));

describe('PlayersListView', () => {
  beforeEach(() => {
    routerPush.mockReset().mockResolvedValue(undefined);
  });

  it('shows a single top-level merge action and merged-player status details', async () => {
    const passthroughStub = defineComponent({
      template: '<div v-bind="$attrs"><slot /></div>',
    });
    const buttonStub = defineComponent({
      template: '<button v-bind="$attrs"><slot /></button>',
    });

    const wrapper = shallowMount(PlayersListView, {
      global: {
        stubs: {
          'v-container': passthroughStub,
          'v-text-field': passthroughStub,
          'v-progress-circular': passthroughStub,
          'v-icon': passthroughStub,
          'v-chip': passthroughStub,
          'v-btn': buttonStub,
        },
      },
    });

    expect(wrapper.find('[data-testid="players-page-merge-link"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Player ID: p1');
    expect(wrapper.text()).toContain('Merged into: p1');
    expect(wrapper.text()).toContain('Merged');

    await wrapper.find('[data-testid="players-page-merge-link"]').trigger('click');

    expect(routerPush).toHaveBeenCalledWith({ name: 'player-merge' });
  });
});
