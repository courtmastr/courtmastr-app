import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import CategoryManagement from '@/features/tournaments/components/CategoryManagement.vue';

const mockDeps = vi.hoisted(() => ({
  addCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    categories: [],
    addCategory: mockDeps.addCategory,
    updateCategory: mockDeps.updateCategory,
    deleteCategory: mockDeps.deleteCategory,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

const mountView = () => shallowMount(CategoryManagement, {
  props: {
    tournamentId: 't1',
  },
  global: {
    stubs: [
      'v-btn',
      'v-dialog',
      'v-card',
      'v-card-title',
      'v-card-text',
      'v-card-actions',
      'v-row',
      'v-col',
      'v-select',
      'v-text-field',
      'v-sheet',
      'v-list-item',
      'v-switch',
      'v-spacer',
      'BaseDialog',
    ],
  },
});

describe('category management integration', () => {
  beforeEach(() => {
    mockDeps.addCategory.mockReset().mockResolvedValue('cat-1');
    mockDeps.updateCategory.mockReset().mockResolvedValue(undefined);
    mockDeps.deleteCategory.mockReset().mockResolvedValue(undefined);
    mockDeps.showToast.mockReset();
  });

  it('persists round-robin settings with minGamesGuaranteed', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as any;

    vm.openAddDialog();
    vm.form.name = 'Round Robin Open';
    vm.form.type = 'singles';
    vm.form.gender = 'open';
    vm.form.format = 'round_robin';
    vm.form.minGamesGuaranteed = 4;

    await vm.saveCategory();

    expect(mockDeps.addCategory).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        name: 'Round Robin Open',
        format: 'round_robin',
        minGamesGuaranteed: 4,
      })
    );
  });

  it('persists pool-to-elimination settings with teamsPerPool and seeding method', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as any;

    vm.openAddDialog();
    vm.form.name = 'Pool Play Elite';
    vm.form.type = 'doubles';
    vm.form.gender = 'men';
    vm.form.format = 'pool_to_elimination';
    vm.form.teamsPerPool = 6;
    vm.form.poolSeedingMethod = 'fully_random';

    await vm.saveCategory();

    expect(mockDeps.addCategory).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        name: 'Pool Play Elite',
        format: 'pool_to_elimination',
        teamsPerPool: 6,
        poolSeedingMethod: 'fully_random',
      })
    );
  });
});
