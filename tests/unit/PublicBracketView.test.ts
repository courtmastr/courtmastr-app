import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import PublicBracketView from '@/features/public/views/PublicBracketView.vue';

const runtime = {
  categories: [
    { id: 'cat-1', name: "Men's Singles" },
  ],
  canInstall: false,
};

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeTournament: vi.fn(),
  fetchCategoryLevels: vi.fn(),
  subscribeAllMatches: vi.fn(),
  unsubscribeMatches: vi.fn(),
  installApp: vi.fn(),
  dismissInstallPrompt: vi.fn(),
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

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: [],
    subscribeAllMatches: mockDeps.subscribeAllMatches,
    unsubscribeAll: mockDeps.unsubscribeMatches,
  }),
}));

vi.mock('@/composables/usePwaInstallPrompt', () => ({
  usePwaInstallPrompt: () => ({
    canInstall: {
      get value() {
        return runtime.canInstall;
      },
    },
    installApp: mockDeps.installApp,
    dismiss: mockDeps.dismissInstallPrompt,
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
        'v-btn',
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
    runtime.canInstall = false;
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.fetchCategoryLevels.mockReset().mockResolvedValue([]);
    mockDeps.subscribeAllMatches.mockReset();
    mockDeps.unsubscribeMatches.mockReset();
    mockDeps.installApp.mockReset().mockResolvedValue(true);
    mockDeps.dismissInstallPrompt.mockReset();
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

  it('exposes install prompt state for bracket spectator banner rendering', async () => {
    runtime.canInstall = true;

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      showInstallPrompt: boolean | { value: boolean };
    };

    expect(unwrapBoolean(vm.showInstallPrompt)).toBe(true);
  });
});
