import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { shallowMount, type VueWrapper } from '@vue/test-utils';
import CreateLevelsDialog from '@/features/tournaments/components/CreateLevelsDialog.vue';

const runtime = vi.hoisted(() => ({
  loading: { value: false },
  error: { value: null as string | null },
  preview: { value: null as {
    pools: Array<{ id: string; label: string; participantCount: number }>;
    participants: Array<{
      registrationId: string;
      participantName: string;
      poolId: string;
      poolLabel: string;
      poolRank: number;
      globalRank: number;
      seed: number | null;
      matchesWon: number;
      matchPoints: number;
      winRate: number;
      pointDifference: number;
      pointsFor: number;
    }>;
    recommendedMode: 'pool_position' | 'global_bands';
    recommendationReason: string;
    suggestedGlobalBands: number[];
    defaultPoolMappings: Array<{
      poolId: string;
      rank1LevelId: string;
      rank2LevelId: string;
      rank3PlusLevelId: string;
    }>;
    pendingMatches: number;
  } | null },
}));

const mockDeps = vi.hoisted(() => ({
  generatePreview: vi.fn(),
  showToast: vi.fn(),
  generateCategoryLevels: vi.fn(),
}));

vi.mock('@/composables/usePoolLeveling', () => ({
  getDefaultLevelNames: (levelCount: number) =>
    Array.from({ length: levelCount }, (_, index) => `Level ${index + 1}`),
  assignByPoolPosition: (participants: Array<{ registrationId: string }>) => ({
    assignments: new Map(participants.map((participant) => [participant.registrationId, 'level-1'])),
    countsByLevelId: { 'level-1': participants.length },
  }),
  assignByGlobalBands: (participants: Array<{ registrationId: string }>) => ({
    assignments: new Map(participants.map((participant) => [participant.registrationId, 'level-1'])),
    countsByLevelId: { 'level-1': participants.length },
  }),
  usePoolLeveling: () => ({
    loading: runtime.loading,
    error: runtime.error,
    preview: runtime.preview,
    generatePreview: mockDeps.generatePreview,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    error: null,
    generateCategoryLevels: mockDeps.generateCategoryLevels,
  }),
}));

const BaseDialogStub = defineComponent({
  template: '<div><slot /><slot name="actions" /></div>',
});

const buildPreview = () => ({
  pools: [{ id: 'pool-1', label: 'Pool 1', participantCount: 4 }],
  participants: [
    {
      registrationId: 'reg-1',
      participantName: 'Team 1',
      poolId: 'pool-1',
      poolLabel: 'Pool 1',
      poolRank: 1,
      globalRank: 1,
      seed: 1,
      matchesWon: 3,
      matchPoints: 6,
      winRate: 1,
      pointDifference: 21,
      pointsFor: 63,
    },
  ],
  recommendedMode: 'pool_position' as const,
  recommendationReason: 'Pools are balanced.',
  suggestedGlobalBands: [1, 0, 0],
  defaultPoolMappings: [
    {
      poolId: 'pool-1',
      rank1LevelId: 'level-1',
      rank2LevelId: 'level-2',
      rank3PlusLevelId: 'level-3',
    },
  ],
  pendingMatches: 0,
});

const flushPreviewLoad = async (): Promise<void> => {
  await nextTick();
  await Promise.resolve();
  await nextTick();
};

const mountDialog = (modelValue: boolean): VueWrapper =>
  shallowMount(CreateLevelsDialog, {
    props: {
      modelValue,
      tournamentId: 't-1',
      categoryId: 'cat-1',
      categoryName: "Men's Doubles",
    },
    global: {
      stubs: {
        BaseDialog: BaseDialogStub,
        'v-alert': true,
        'v-row': true,
        'v-col': true,
        'v-select': true,
        'v-text-field': true,
        'v-radio-group': true,
        'v-radio': true,
        'v-card': true,
        'v-data-table': true,
        'v-btn': true,
        'v-spacer': true,
      },
    },
  });

describe('CreateLevelsDialog', () => {
  beforeEach(() => {
    runtime.loading.value = false;
    runtime.error.value = null;
    runtime.preview.value = null;
    mockDeps.generatePreview.mockReset().mockImplementation(async () => {
      const preview = buildPreview();
      runtime.preview.value = preview;
      return preview;
    });
    mockDeps.showToast.mockReset();
    mockDeps.generateCategoryLevels.mockReset();
  });

  it('loads preview immediately when mounted with dialog already open', async () => {
    mountDialog(true);
    await flushPreviewLoad();

    expect(mockDeps.generatePreview).toHaveBeenCalledTimes(1);
    expect(mockDeps.generatePreview).toHaveBeenCalledWith('t-1', 'cat-1', 3);
  });

  it('loads preview when dialog transitions from closed to open', async () => {
    const wrapper = mountDialog(false);
    await flushPreviewLoad();

    expect(mockDeps.generatePreview).not.toHaveBeenCalled();

    await wrapper.setProps({ modelValue: true });
    await flushPreviewLoad();

    expect(mockDeps.generatePreview).toHaveBeenCalledTimes(1);
    expect(mockDeps.generatePreview).toHaveBeenCalledWith('t-1', 'cat-1', 3);
  });
});
