import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import type { PoolLevelPreview } from '@/composables/usePoolLeveling';
import PoolSchedulePanel from '@/features/tournaments/components/PoolSchedulePanel.vue';

interface MockRef<T> {
  __v_isRef: true;
  value: T;
}

const mockDeps = vi.hoisted(() => ({
  loading: { __v_isRef: true, value: false } as MockRef<boolean>,
  error: { __v_isRef: true, value: '' } as MockRef<string>,
  preview: { __v_isRef: true, value: null as PoolLevelPreview | null } as MockRef<PoolLevelPreview | null>,
  generatePreview: vi.fn(),
}));

vi.mock('@/composables/usePoolLeveling', () => ({
  usePoolLeveling: () => ({
    loading: mockDeps.loading,
    error: mockDeps.error,
    preview: mockDeps.preview,
    generatePreview: mockDeps.generatePreview,
  }),
}));

const PassThroughStub = defineComponent({
  template: '<div><slot /><slot name="append" /><slot name="prepend" /></div>',
});

const VBtnStub = defineComponent({
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
});

const basePreview = (pendingMatches: number): PoolLevelPreview => ({
  pools: [
    {
      id: 'g1',
      label: 'Pool A',
      participantCount: 2,
    },
  ],
  participants: [
    {
      registrationId: 'r1',
      participantName: 'Alpha Team',
      poolId: 'g1',
      poolLabel: 'Pool A',
      poolRank: 1,
      globalRank: 1,
      seed: 1,
      matchesWon: 1,
      matchPoints: 2,
      winRate: 1,
      pointDifference: 10,
      pointsFor: 21,
    },
    {
      registrationId: 'r2',
      participantName: 'Beta Team',
      poolId: 'g1',
      poolLabel: 'Pool A',
      poolRank: 2,
      globalRank: 2,
      seed: 2,
      matchesWon: 0,
      matchPoints: 0,
      winRate: 0,
      pointDifference: -10,
      pointsFor: 11,
    },
  ],
  recommendedMode: 'pool_position',
  recommendationReason: 'Balanced groups',
  suggestedGlobalBands: [2, 0, 0],
  defaultPoolMappings: [
    {
      poolId: 'g1',
      rank1LevelId: 'level-1',
      rank2LevelId: 'level-2',
      rank3PlusLevelId: 'level-3',
    },
  ],
  pendingMatches,
});

const mountPanel = () =>
  mount(PoolSchedulePanel, {
    props: {
      tournamentId: 't-1',
      categoryId: 'cat-1',
      categoryName: 'Open',
    },
    global: {
      stubs: {
        'v-icon': true,
        'v-spacer': true,
        'v-chip': PassThroughStub,
        'v-progress-circular': true,
        'v-alert': PassThroughStub,
        'v-btn': VBtnStub,
        'v-row': PassThroughStub,
        'v-col': PassThroughStub,
        'v-card': PassThroughStub,
        'v-card-title': PassThroughStub,
        'v-divider': true,
        'v-table': PassThroughStub,
        'v-pagination': true,
        'v-card-text': PassThroughStub,
      },
    },
  });

const findCreateLevelsButton = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll('button').find((button) => button.text().includes('Create Levels'));

describe('PoolSchedulePanel level-creation CTA', () => {
  beforeEach(() => {
    mockDeps.loading.value = false;
    mockDeps.error.value = '';
    mockDeps.preview.value = null;
    mockDeps.generatePreview.mockReset().mockResolvedValue(undefined);
  });

  it('disables Create Levels while pool matches are still pending', async () => {
    mockDeps.preview.value = basePreview(3);

    const wrapper = mountPanel();
    const createLevelsButton = findCreateLevelsButton(wrapper);

    expect(mockDeps.generatePreview).toHaveBeenCalledWith('t-1', 'cat-1', 3);
    expect(wrapper.text()).toContain('matches remaining');
    expect(createLevelsButton?.attributes('disabled')).toBeDefined();
  });

  it('enables Create Levels and emits create-levels once pool play is complete', async () => {
    mockDeps.preview.value = basePreview(0);

    const wrapper = mountPanel();
    const createLevelsButton = findCreateLevelsButton(wrapper);

    expect(wrapper.text()).toContain('All matches done');
    expect(createLevelsButton?.attributes('disabled')).toBeUndefined();
    expect(createLevelsButton).toBeDefined();

    await createLevelsButton?.trigger('click');
    expect(wrapper.emitted('create-levels')?.[0]).toEqual(['cat-1']);
  });
});
