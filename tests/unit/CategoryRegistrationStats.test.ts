import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount, type VueWrapper } from '@vue/test-utils';
import type { Category, Match, Player, Registration } from '@/types';
import CategoryRegistrationStats from '@/features/tournaments/components/CategoryRegistrationStats.vue';

const runtime = {
  categories: [] as Category[],
  registrations: [] as Registration[],
  players: [] as Player[],
  matches: [] as Match[],
};

const mockDeps = vi.hoisted(() => ({
  toggleCategoryCheckin: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    categories: runtime.categories,
    toggleCategoryCheckin: mockDeps.toggleCategoryCheckin,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    registrations: runtime.registrations,
    players: runtime.players,
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtime.matches,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

const PassThroughStub = defineComponent({
  template: '<div><slot /><slot name="append" /><slot name="prepend" /></div>',
});

const VMenuStub = defineComponent({
  template: '<div><slot name="activator" :props="{}" /><slot /></div>',
});

const VTooltipStub = defineComponent({
  template: '<div><slot name="activator" :props="{}" /><slot /></div>',
});

const VBtnStub = defineComponent({
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
    ariaLabel: {
      type: String,
      default: '',
    },
  },
  emits: ['click'],
  template: '<button :disabled="disabled" :aria-label="ariaLabel" @click="$emit(\'click\')"><slot /></button>',
});

const VListItemStub = defineComponent({
  props: {
    title: {
      type: String,
      default: '',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ title }}<slot /></button>',
});

const baseDate = new Date('2026-02-27T09:00:00.000Z');

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  tournamentId: 't-1',
  name: 'Open Category',
  type: 'singles',
  gender: 'open',
  ageGroup: 'open',
  format: 'pool_to_elimination',
  seedingEnabled: false,
  status: 'setup',
  createdAt: baseDate,
  updatedAt: baseDate,
  ...overrides,
});

const makeRegistration = (
  id: string,
  status: Registration['status'] = 'approved'
): Registration => ({
  id,
  tournamentId: 't-1',
  categoryId: 'cat-1',
  participantType: 'player',
  playerId: `p-${id}`,
  status,
  registeredBy: 'admin-1',
  registeredAt: baseDate,
});

const makeMatch = (id: string, overrides: Partial<Match> = {}): Match => ({
  id,
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
  createdAt: baseDate,
  updatedAt: baseDate,
  ...overrides,
});

const mountComponent = (): VueWrapper =>
  mount(CategoryRegistrationStats, {
    props: {
      tournamentId: 't-1',
      expandedPoolCategoryIds: [],
    },
    global: {
      stubs: {
        VRow: PassThroughStub,
        VCol: PassThroughStub,
        VCard: PassThroughStub,
        VCardTitle: PassThroughStub,
        VCardSubtitle: PassThroughStub,
        VCardText: PassThroughStub,
        VCardActions: PassThroughStub,
        VDivider: true,
        VIcon: true,
        VChip: PassThroughStub,
        VMenu: VMenuStub,
        VList: PassThroughStub,
        VListItem: VListItemStub,
        VAlert: PassThroughStub,
        VProgressLinear: true,
        VTooltip: VTooltipStub,
        VBtn: VBtnStub,
      },
    },
  });

const getPrimaryActionButton = (wrapper: VueWrapper): VueWrapper =>
  wrapper.find('.card-primary-actions button');

describe('CategoryRegistrationStats primary CTA behavior', () => {
  beforeEach(() => {
    runtime.categories = [];
    runtime.registrations = [];
    runtime.players = [];
    runtime.matches = [];
    mockDeps.toggleCategoryCheckin.mockReset().mockResolvedValue(undefined);
    mockDeps.showToast.mockReset();
  });

  it('shows level creation CTA when pool play is complete and levels are not started', async () => {
    runtime.categories = [
      makeCategory({
        name: 'Pool A',
        format: 'pool_to_elimination',
        poolStageId: 10,
      }),
    ];
    runtime.registrations = [makeRegistration('r1'), makeRegistration('r2')];
    runtime.matches = [
      makeMatch('m-pool-1', {
        groupId: 'g-1',
        status: 'completed',
      }),
    ];

    const wrapper = mountComponent();
    const actionButton = getPrimaryActionButton(wrapper);

    expect(actionButton.exists()).toBe(true);
    expect(actionButton.text()).toContain('Setup & Generate Levels');

    await actionButton.trigger('click');
    expect(wrapper.emitted('create-levels')?.[0]).toEqual(['cat-1']);
  });

  it('shows generate levels CTA when pool play is complete and leveling is configured', async () => {
    runtime.categories = [
      makeCategory({
        name: 'Pool B',
        format: 'pool_to_elimination',
        poolStageId: 10,
        levelingStatus: 'configured',
      }),
    ];
    runtime.registrations = [makeRegistration('r1'), makeRegistration('r2')];
    runtime.matches = [
      makeMatch('m-pool-1', {
        groupId: 'g-1',
        status: 'completed',
      }),
    ];

    const wrapper = mountComponent();
    const actionButton = getPrimaryActionButton(wrapper);

    expect(actionButton.text()).toContain('Generate Levels');

    await actionButton.trigger('click');
    expect(wrapper.emitted('create-levels')?.[0]).toEqual(['cat-1']);
  });

  it('shows level scheduling CTA once level matches exist after pool completion', async () => {
    runtime.categories = [
      makeCategory({
        name: 'Pool C',
        format: 'pool_to_elimination',
        poolStageId: 10,
        levelingStatus: 'generated',
      }),
    ];
    runtime.registrations = [makeRegistration('r1'), makeRegistration('r2')];
    runtime.matches = [
      makeMatch('m-pool-1', {
        groupId: 'g-1',
        status: 'completed',
      }),
      makeMatch('m-level-1', {
        levelId: 'level-1',
        status: 'ready',
      }),
    ];

    const wrapper = mountComponent();
    const actionButton = getPrimaryActionButton(wrapper);

    expect(actionButton.text()).toContain('Schedule Level Matches');

    await actionButton.trigger('click');
    expect(wrapper.emitted('schedule-times')?.[0]?.[0]).toMatchObject({ id: 'cat-1' });
    expect(wrapper.emitted('create-levels')).toBeUndefined();
  });

  it('uses pool-play CTA for round-robin categories before completion', async () => {
    runtime.categories = [
      makeCategory({
        name: 'Round Robin',
        format: 'round_robin',
        poolStageId: 20,
      }),
    ];
    runtime.registrations = [makeRegistration('r1'), makeRegistration('r2')];
    runtime.matches = [
      makeMatch('m-pool-1', {
        groupId: 'g-1',
        status: 'ready',
        plannedStartAt: baseDate,
        publishedAt: baseDate,
      }),
    ];

    const wrapper = mountComponent();
    const actionButton = getPrimaryActionButton(wrapper);

    expect(actionButton.text()).toContain('View Standings');

    await actionButton.trigger('click');
    expect(wrapper.emitted('view-bracket')?.[0]?.[0]).toMatchObject({ id: 'cat-1' });
  });

  it('shows setup CTA for single-elimination categories before bracket creation', () => {
    runtime.categories = [
      makeCategory({
        name: 'Singles',
        format: 'single_elimination',
        poolStageId: null,
      }),
    ];
    runtime.registrations = [makeRegistration('r1'), makeRegistration('r2')];

    const wrapper = mountComponent();
    const actionButton = getPrimaryActionButton(wrapper);

    expect(actionButton.text()).toContain('Setup Category');
  });

  it('shows publish CTA for single-elimination categories once elimination matches are scheduled', async () => {
    runtime.categories = [
      makeCategory({
        name: 'Singles',
        format: 'single_elimination',
      }),
    ];
    runtime.registrations = [makeRegistration('r1'), makeRegistration('r2')];
    runtime.matches = [
      makeMatch('m-elim-1', {
        status: 'ready',
        plannedStartAt: baseDate,
      }),
    ];

    const wrapper = mountComponent();
    const actionButton = getPrimaryActionButton(wrapper);

    expect(actionButton.text()).toContain('Publish Schedule');

    await actionButton.trigger('click');
    expect(wrapper.emitted('schedule-times')?.[0]?.[0]).toMatchObject({ id: 'cat-1' });
  });
});
