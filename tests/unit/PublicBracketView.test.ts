import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import PublicBracketView from '@/features/public/views/PublicBracketView.vue';

const runtime = {
  categories: [
    { id: 'cat-1', name: "Men's Singles" },
  ],
};

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeTournament: vi.fn(),
  fetchCategoryLevels: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: {
      id: 't1',
      name: 'Spring Open',
    },
    categories: runtime.categories,
    loading: false,
    fetchTournament: mockDeps.fetchTournament,
    subscribeTournament: mockDeps.subscribeTournament,
    fetchCategoryLevels: mockDeps.fetchCategoryLevels,
  }),
}));

const mountView = () =>
  shallowMount(PublicBracketView, {
    global: {
      stubs: [
        'v-container',
        'v-row',
        'v-col',
        'v-card',
        'v-card-text',
        'v-select',
        'v-icon',
        'v-skeleton-loader',
        'BracketsManagerViewer',
      ],
    },
  });

const unwrapBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    return Boolean((value as { value?: unknown }).value);
  }
  return false;
};

describe('PublicBracketView', () => {
  beforeEach(() => {
    runtime.categories = [{ id: 'cat-1', name: "Men's Singles" }];
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.fetchCategoryLevels.mockReset().mockResolvedValue([]);
  });

  it('marks tournament as not found when fetch fails', async () => {
    mockDeps.fetchTournament.mockRejectedValueOnce(new Error('missing'));

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as { notFound: boolean | { value: boolean } };
    expect(unwrapBoolean(vm.notFound)).toBe(true);
    expect(mockDeps.subscribeTournament).not.toHaveBeenCalled();
    expect(mockDeps.fetchCategoryLevels).not.toHaveBeenCalled();
  });

  it('loads first category levels after successful tournament fetch', async () => {
    runtime.categories = [
      { id: 'cat-1', name: "Men's Singles" },
      { id: 'cat-2', name: "Women's Singles" },
    ];
    mockDeps.fetchCategoryLevels.mockResolvedValueOnce([
      { id: 'level-1', name: 'Advanced' },
    ]);

    mountView();
    await flushPromises();

    expect(mockDeps.fetchTournament).toHaveBeenCalledWith('t1');
    expect(mockDeps.subscribeTournament).toHaveBeenCalledWith('t1');
    expect(mockDeps.fetchCategoryLevels).toHaveBeenCalledWith('t1', 'cat-1');
  });
});
