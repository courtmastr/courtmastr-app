/* eslint-disable vue/one-component-per-file -- local component stubs keep this test self-contained */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { shallowMount } from '@vue/test-utils';
import type { Category } from '@/types';
import CategoriesView from '@/features/tournaments/views/CategoriesView.vue';

const baseDate = new Date('2026-02-27T09:00:00.000Z');

const baseCategory: Category = {
  id: 'cat-1',
  tournamentId: 't-1',
  name: "Men's Doubles",
  type: 'doubles',
  gender: 'men',
  ageGroup: 'open',
  format: 'pool_to_elimination',
  status: 'active',
  seedingEnabled: true,
  createdAt: baseDate,
  updatedAt: baseDate,
};

const mockDeps = vi.hoisted(() => ({
  routerPush: vi.fn(),
  fetchTournament: vi.fn(),
  fetchRegistrations: vi.fn(),
  subscribeAllMatches: vi.fn(),
  unsubscribeAllMatches: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't-1' },
    query: {},
  }),
  useRouter: () => ({
    push: mockDeps.routerPush,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'admin-1' },
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: [],
    subscribeAllMatches: mockDeps.subscribeAllMatches,
    unsubscribeAll: mockDeps.unsubscribeAllMatches,
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: {
      id: 't-1',
      startDate: baseDate,
      settings: { matchDurationMinutes: 20 },
    },
    categories: [baseCategory],
    courts: [],
    fetchTournament: mockDeps.fetchTournament,
    generateBracket: vi.fn(),
    regenerateBracket: vi.fn(),
    regeneratePools: vi.fn(),
    fetchCategoryLevels: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    fetchRegistrations: mockDeps.fetchRegistrations,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('@/composables/useMatchScheduler', () => ({
  useMatchScheduler: () => ({
    scheduleMatches: vi.fn(),
  }),
}));

vi.mock('@/composables/useTimeScheduler', () => ({
  useTimeScheduler: () => ({
    publish: vi.fn(),
    unpublish: vi.fn(),
  }),
}));

const CategoryRegistrationStatsStub = defineComponent({
  emits: ['view-draft-schedule'],
  template:
    '<button data-testid="view-draft-schedule" @click="$emit(\'view-draft-schedule\', { id: \'cat-1\' })">View Draft</button>',
});

const PassThroughStub = defineComponent({
  template: '<div><slot /></div>',
});

describe('CategoriesView draft schedule routing', () => {
  beforeEach(() => {
    mockDeps.routerPush.mockReset();
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchRegistrations.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeAllMatches.mockReset();
    mockDeps.unsubscribeAllMatches.mockReset();
  });

  it('routes to Match Control schedule draft filter when draft schedule view is requested', async () => {
    const wrapper = shallowMount(CategoriesView, {
      global: {
        stubs: {
          CategoryManagement: true,
          CategoryRegistrationStats: CategoryRegistrationStatsStub,
          PoolSchedulePanel: true,
          AutoScheduleDialog: true,
          CreateLevelsDialog: true,
          BaseDialog: true,
          ManageSeedsDialog: true,
          VContainer: PassThroughStub,
          VExpansionPanels: true,
          VExpansionPanel: true,
          VExpansionPanelTitle: true,
          VExpansionPanelText: true,
          VIcon: true,
          VSpacer: true,
          VBtn: true,
          VAlert: true,
        },
      },
    });

    await wrapper.get('[data-testid="view-draft-schedule"]').trigger('click');

    expect(mockDeps.routerPush).toHaveBeenCalledWith({
      path: '/tournaments/t-1/match-control',
      query: {
        view: 'schedule',
        category: 'cat-1',
        publicState: 'draft',
        scheduleLayout: 'full',
      },
    });
  });
});
