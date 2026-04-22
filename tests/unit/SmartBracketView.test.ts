/* eslint-disable vue/one-component-per-file -- local component stubs keep this test self-contained */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { flushPromises, shallowMount } from '@vue/test-utils';
import SmartBracketView from '@/features/brackets/components/SmartBracketView.vue';

const runtime = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vue = require('vue') as typeof import('vue');
  return {
    categories: vue.ref<Array<Record<string, unknown>>>([]),
    currentTournament: vue.ref<Record<string, unknown> | null>(null),
    matches: vue.ref<Array<Record<string, unknown>>>([]),
    registrations: vue.ref<Array<Record<string, unknown>>>([]),
    players: vue.ref<Array<Record<string, unknown>>>([]),
    fetchTournament: vi.fn(),
    fetchMatches: vi.fn(),
    fetchRegistrations: vi.fn(),
    fetchPlayers: vi.fn(),
    getParticipantName: vi.fn(),
    routerPush: vi.fn(),
  };
});

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: runtime.routerPush }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    get categories() {
      return runtime.categories.value;
    },
    get currentTournament() {
      return runtime.currentTournament.value;
    },
    fetchTournament: runtime.fetchTournament,
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    get matches() {
      return runtime.matches.value;
    },
    fetchMatches: runtime.fetchMatches,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    get registrations() {
      return runtime.registrations.value;
    },
    get players() {
      return runtime.players.value;
    },
    fetchRegistrations: runtime.fetchRegistrations,
    fetchPlayers: runtime.fetchPlayers,
  }),
}));

vi.mock('@/composables/useParticipantResolver', () => ({
  useParticipantResolver: () => ({
    getParticipantName: runtime.getParticipantName,
  }),
}));

const PassThroughStub = defineComponent({
  template: '<div><slot /></div>',
});

const StandingsTabStub = defineComponent({
  props: {
    snapshotEntries: {
      type: Array,
      required: true,
    },
    snapshotLoading: {
      type: Boolean,
      required: true,
    },
    category: {
      type: Object,
      required: false,
      default: null,
    },
  },
  template: '<div class="snapshot-count">{{ snapshotEntries.length }}|{{ snapshotLoading ? "loading" : "ready" }}|{{ category?.id || "none" }}</div>',
});

describe('SmartBracketView', () => {
  beforeEach(() => {
    runtime.categories.value = [
      {
        id: 'other-cat',
        name: 'Other Category',
        format: 'single_elimination',
      },
    ];
    runtime.currentTournament.value = { id: 't-1' };
    runtime.matches.value = [];
    runtime.registrations.value = [];
    runtime.players.value = [];
    runtime.fetchTournament.mockReset().mockImplementation(async () => {
      runtime.categories.value = [
        {
          id: 'cat-1',
          name: "Men's Doubles",
          format: 'pool_to_elimination',
          poolPhase: 'elimination',
          poolStageId: 1,
        },
      ];
    });
    runtime.fetchMatches.mockReset().mockImplementation(async () => {
      runtime.matches.value = [
        {
          id: 'match-1',
          categoryId: 'cat-1',
          stageId: 1,
          participant1Id: 'reg-1',
          participant2Id: 'reg-2',
          winnerId: 'reg-1',
          status: 'completed',
          scores: [
            { score1: 21, score2: 18 },
            { score1: 21, score2: 19 },
          ],
          round: 1,
        },
      ];
    });
    runtime.fetchRegistrations.mockReset().mockImplementation(async () => {
      runtime.registrations.value = [
        {
          id: 'reg-1',
          categoryId: 'cat-1',
          status: 'approved',
          partnerPlayerId: 'p2',
          registeredAt: new Date('2026-04-18T10:05:00.000Z'),
        },
        {
          id: 'reg-2',
          categoryId: 'cat-1',
          status: 'approved',
          partnerPlayerId: 'p4',
          registeredAt: new Date('2026-04-18T10:00:00.000Z'),
        },
      ];
    });
    runtime.fetchPlayers.mockReset().mockResolvedValue(undefined);
    runtime.getParticipantName.mockReset().mockImplementation((registrationId: string) => {
      if (registrationId === 'reg-1') return 'Alpha / One';
      if (registrationId === 'reg-2') return 'Beta / Two';
      return registrationId;
    });
    runtime.routerPush.mockReset();
  });

  it('builds pre-elim snapshot rows from pool standings when the target category loads into elimination', async () => {
    const wrapper = shallowMount(SmartBracketView, {
      props: {
        tournamentId: 't-1',
        categoryId: 'cat-1',
      },
      global: {
        stubs: {
          RoundRobinStandings: true,
          PoolDrawTab: true,
          StandingsTab: StandingsTabStub,
          MatchesByRoundTab: true,
          'v-row': PassThroughStub,
          'v-col': PassThroughStub,
          'v-select': true,
          'v-card': PassThroughStub,
          'v-card-text': PassThroughStub,
          'v-chip': PassThroughStub,
          'v-icon': true,
          'v-tabs': PassThroughStub,
          'v-tab': PassThroughStub,
          'v-tabs-window': PassThroughStub,
          'v-tabs-window-item': PassThroughStub,
        },
      },
    });

    await flushPromises();

    expect(runtime.fetchTournament).toHaveBeenCalledWith('t-1');
    expect(runtime.fetchMatches).toHaveBeenCalledWith('t-1', 'cat-1');
    expect(runtime.fetchRegistrations).toHaveBeenCalledWith('t-1');
    expect(wrapper.find('.snapshot-count').text()).toBe('2|ready|cat-1');
  });
});
