/* eslint-disable vue/one-component-per-file -- local component stubs keep this test self-contained */
import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { flushPromises, shallowMount } from '@vue/test-utils';
import PlayerProfileView from '@/features/players/views/PlayerProfileView.vue';
import type { GlobalPlayer } from '@/types';

const playerRecord: GlobalPlayer = {
  id: 'player-source',
  firstName: 'Alex',
  lastName: 'Source',
  email: 'alex@example.com',
  emailNormalized: 'alex@example.com',
  phone: '555-1001',
  skillLevel: 5,
  userId: null,
  isActive: false,
  isVerified: true,
  identityStatus: 'merged',
  mergedIntoPlayerId: 'player-target',
  createdAt: new Date('2026-04-02T00:00:00.000Z'),
  updatedAt: new Date('2026-04-02T00:00:00.000Z'),
  stats: { overall: { wins: 5, losses: 2, gamesPlayed: 10, tournamentsPlayed: 3 } },
};

vi.mock('@/config/featureFlags', () => ({
  PLAYER_IDENTITY_V2: true,
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { playerId: 'player-source' },
  }),
}));

vi.mock('@/stores/players', () => ({
  usePlayersStore: () => ({
    fetchPlayerById: vi.fn().mockResolvedValue(playerRecord),
  }),
}));

vi.mock('@/composables/useAsyncOperation', () => ({
  useAsyncOperation: () => ({
    execute: (fn: () => Promise<void>) => fn(),
    loading: false,
  }),
}));

vi.mock('@/composables/usePlayerMatchHistory', () => ({
  usePlayerMatchHistory: () => ({
    history: [],
    loading: false,
    loadHistory: vi.fn(),
  }),
}));

describe('PlayerProfileView', () => {
  it('shows the player id and merged-into status in the profile header', async () => {
    const passthroughStub = defineComponent({
      template: '<div v-bind="$attrs"><slot /></div>',
    });
    const buttonStub = defineComponent({
      template: '<button v-bind="$attrs"><slot /></button>',
    });

    const wrapper = shallowMount(PlayerProfileView, {
      global: {
        stubs: {
          'v-container': passthroughStub,
          'v-progress-circular': passthroughStub,
          'v-icon': passthroughStub,
          'v-btn': buttonStub,
          'v-chip': passthroughStub,
          'v-tabs': passthroughStub,
          'v-tab': passthroughStub,
          'v-window': passthroughStub,
          'v-window-item': passthroughStub,
          'v-row': passthroughStub,
          'v-col': passthroughStub,
          'v-card': passthroughStub,
          'v-card-text': passthroughStub,
          'v-progress-linear': passthroughStub,
          'v-expansion-panels': passthroughStub,
          'v-expansion-panel': passthroughStub,
          'v-expansion-panel-title': passthroughStub,
          'v-expansion-panel-text': passthroughStub,
        },
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain('Player ID: player-source');
    expect(wrapper.text()).toContain('Merged into player-target');
  });
});
