import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import type { Match } from '@/types';
import BracketView from '@/features/brackets/components/BracketView.vue';
import DoubleEliminationBracket from '@/features/brackets/components/DoubleEliminationBracket.vue';

const runtime = {
  matches: [] as Match[],
};

const mockDeps = vi.hoisted(() => ({
  fetchMatches: vi.fn(),
  fetchRegistrations: vi.fn(),
  fetchPlayers: vi.fn(),
}));

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    toDataURL: () => 'data:image/png;base64,test',
  })),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtime.matches,
    fetchMatches: mockDeps.fetchMatches,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    fetchRegistrations: mockDeps.fetchRegistrations,
    fetchPlayers: mockDeps.fetchPlayers,
  }),
}));

vi.mock('@/composables/useParticipantResolver', () => ({
  useParticipantResolver: () => ({
    getParticipantName: (registrationId?: string) => registrationId ? `Player ${registrationId}` : 'Unknown',
  }),
}));

const makeMatch = (overrides: Partial<Match>): Match => ({
  id: 'm-1',
  tournamentId: 't-1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  status: 'ready',
  scores: [],
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
  ...overrides,
});

const stubs = [
  'v-progress-circular',
  'v-icon',
  'v-chip-group',
  'v-chip',
  'v-card',
  'v-divider',
  'v-btn',
  'v-row',
  'v-col',
  'v-progress-linear',
  'v-tabs',
  'v-tab',
  'v-tabs-window',
  'v-tabs-window-item',
  'v-card-text',
  'v-card-title',
];

describe('Bracket slot-state rendering', () => {
  beforeEach(() => {
    runtime.matches = [
      makeMatch({
        id: 'bye-match',
        matchNumber: 1,
        participant1Id: 'reg-1',
        participant2Id: undefined,
        winnerId: 'reg-1',
        status: 'completed',
      }),
      makeMatch({
        id: 'tbd-match',
        matchNumber: 2,
        participant1Id: 'reg-2',
        participant2Id: undefined,
        winnerId: undefined,
        status: 'ready',
      }),
    ];

    mockDeps.fetchMatches.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchRegistrations.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchPlayers.mockReset().mockResolvedValue(undefined);
  });

  it('BracketView renders BYE and TBD from shared slot-state rules', async () => {
    const wrapper = shallowMount(BracketView, {
      props: {
        tournamentId: 't-1',
        categoryId: 'cat-1',
      },
      global: {
        stubs,
        renderStubDefaultSlot: true,
      },
    });

    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('BYE');
    expect(text).toContain('TBD');
  });

  it('DoubleEliminationBracket renders BYE and TBD from shared slot-state rules', async () => {
    const wrapper = shallowMount(DoubleEliminationBracket, {
      props: {
        tournamentId: 't-1',
        categoryId: 'cat-1',
      },
      global: {
        stubs,
        renderStubDefaultSlot: true,
      },
    });

    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('BYE');
    expect(text).toContain('TBD');
  });
});
