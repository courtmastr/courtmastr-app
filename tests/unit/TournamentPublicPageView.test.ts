import { flushPromises, shallowMount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TournamentPublicPageView from '@/features/public/views/TournamentPublicPageView.vue';

const runtime = vi.hoisted(() => ({
  ...(() => {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const vue = require('vue') as typeof import('vue');
    return {
      snapshot: vue.ref<null | {
        meta: { tournamentId: string; name: string };
        categories: Array<{
          id: string;
          name: string;
          schedule: unknown[];
          pools: unknown[];
          standings: unknown[];
          bracket?: { rounds: unknown[] };
        }>;
      }>(null),
      loading: vue.ref(false),
      error: vue.ref<string | null>(null),
      notFound: vue.ref(false),
    };
  })(),
  loadBySlug: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { slug: 'tnf' },
  }),
  useRouter: () => ({
    push: runtime.routerPush,
  }),
}));

vi.mock('gsap', () => ({
  gsap: {
    to: vi.fn(),
    from: vi.fn(),
    fromTo: vi.fn(),
    timeline: vi.fn(() => ({
      from: function () { return this; },
    })),
    matchMedia: vi.fn(() => ({
      add: vi.fn(),
    })),
    context: vi.fn((callback: () => void) => {
      callback();
      return { revert: vi.fn() };
    }),
  },
}));

vi.mock('@/composables/usePublicSnapshot', () => ({
  usePublicSnapshot: () => ({
    snapshot: runtime.snapshot,
    loading: runtime.loading,
    error: runtime.error,
    notFound: runtime.notFound,
    loadBySlug: runtime.loadBySlug,
  }),
}));

describe('TournamentPublicPageView', () => {
  beforeEach(() => {
    runtime.snapshot.value = {
      meta: {
        tournamentId: 't-1',
        name: 'TNF Badminton - 2026',
      },
      categories: [
        {
          id: 'cat-1',
          name: "Men's Doubles",
          schedule: [],
          pools: [],
          standings: [],
        },
      ],
    };
    runtime.loading.value = false;
    runtime.error.value = null;
    runtime.notFound.value = false;
    runtime.loadBySlug.mockReset().mockResolvedValue(undefined);
    runtime.routerPush.mockReset();
  });

  it('routes the snapshot bracket tab to the public live bracket page', async () => {
    const wrapper = shallowMount(TournamentPublicPageView, {
      global: {
        stubs: {
          PublicPageHeader: true,
          CategorySelector: true,
          ScheduleTab: true,
          PoolsTab: true,
          StandingsTab: true,
          BracketTab: true,
          AddToHomeScreen: true,
          Transition: false,
          'v-icon': true,
          'v-progress-circular': true,
        },
      },
    });

    await flushPromises();

    const vm = wrapper.vm as unknown as {
      activeTab: number;
      switchTab: (index: number) => void;
    };

    vm.switchTab(3);

    expect(runtime.routerPush).toHaveBeenCalledWith({
      name: 'public-bracket',
      params: { tournamentId: 't-1' },
      query: { category: 'cat-1' },
    });
    expect(vm.activeTab).toBe(0);
  });
});
