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
  template: '<button :data-title="title" :disabled="disabled" @click="$emit(\'click\')">{{ title }}</button>',
});

const baseDate = new Date('2026-02-27T09:00:00.000Z');

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  tournamentId: 't-1',
  name: "Men's Doubles",
  type: 'doubles',
  gender: 'men',
  ageGroup: 'open',
  format: 'pool_to_elimination',
  seedingEnabled: true,
  status: 'active',
  createdAt: baseDate,
  updatedAt: baseDate,
  ...overrides,
});

const makeRegistration = (id: string): Registration => ({
  id,
  tournamentId: 't-1',
  categoryId: 'cat-1',
  participantType: 'team',
  teamName: `Team ${id}`,
  status: 'approved',
  registeredBy: 'admin-1',
  registeredAt: baseDate,
});

const makePoolMatch = (id: string): Match => ({
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
  groupId: 'group-a',
  participant1Id: 'r1',
  participant2Id: 'r2',
  status: 'completed',
  scores: [],
  createdAt: baseDate,
  updatedAt: baseDate,
});

const makeDraftPoolMatch = (id: string): Match => ({
  ...makePoolMatch(id),
  status: 'scheduled',
  plannedStartAt: new Date('2026-02-27T10:00:00.000Z'),
  scheduleStatus: 'draft',
});

const makePublishedPoolMatch = (id: string): Match => ({
  ...makeDraftPoolMatch(id),
  scheduleStatus: 'published',
  publishedAt: new Date('2026-02-27T10:15:00.000Z'),
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

const getPrimaryActionButton = (wrapper: VueWrapper) =>
  wrapper.find('.card-primary-actions button');

describe('CategoryRegistrationStats pool-phase CTA regression', () => {
  beforeEach(() => {
    runtime.categories = [];
    runtime.registrations = [];
    runtime.players = [];
    runtime.matches = [];
    mockDeps.toggleCategoryCheckin.mockReset().mockResolvedValue(undefined);
    mockDeps.showToast.mockReset();
  });

  it('shows "Setup & Generate Levels" when pool is complete and only pool stageId exists', async () => {
    runtime.categories = [
      makeCategory({
        // Seeded pool state: pool stage exists and is written to stageId + poolStageId
        stageId: 10,
        poolStageId: 10,
        eliminationStageId: null,
        levelingStatus: null,
      }),
    ];
    runtime.registrations = [makeRegistration('r1'), makeRegistration('r2')];
    runtime.matches = [makePoolMatch('m1')];

    const wrapper = mountComponent();
    const actionButton = getPrimaryActionButton(wrapper);

    expect(actionButton.text()).toContain('Setup & Generate Levels');
    expect(actionButton.text()).not.toContain('View Bracket');

    await actionButton.trigger('click');
    expect(wrapper.emitted('create-levels')?.[0]).toEqual(['cat-1']);
  });

  it('shows and emits "View Draft Schedule" when draft schedule exists', async () => {
    runtime.categories = [makeCategory({ stageId: 10, poolStageId: 10, eliminationStageId: null })];
    runtime.registrations = [makeRegistration('r1'), makeRegistration('r2')];
    runtime.matches = [makeDraftPoolMatch('m1')];

    const wrapper = mountComponent();
    const draftButton = wrapper.find('button[data-title="View Draft Schedule"]');

    expect(draftButton.exists()).toBe(true);

    await draftButton.trigger('click');
    expect(wrapper.emitted('view-draft-schedule')?.[0]).toEqual([runtime.categories[0]]);
  });

  it('hides "View Draft Schedule" when schedule is already published', () => {
    runtime.categories = [makeCategory({ stageId: 10, poolStageId: 10, eliminationStageId: null })];
    runtime.registrations = [makeRegistration('r1'), makeRegistration('r2')];
    runtime.matches = [makePublishedPoolMatch('m1')];

    const wrapper = mountComponent();
    const draftButton = wrapper.find('button[data-title="View Draft Schedule"]');

    expect(draftButton.exists()).toBe(false);
  });
});
