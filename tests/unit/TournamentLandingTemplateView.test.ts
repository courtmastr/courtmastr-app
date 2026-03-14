import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import type { Tournament } from '@/types';
import TournamentLandingTemplateView from '@/features/public/views/TournamentLandingTemplateView.vue';

const runtime = {
  queryTemplate: 'event-night',
  tournament: null as Tournament | null,
};

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeTournament: vi.fn(),
  unsubscribeTournament: vi.fn(),
  setMetadata: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
    query: runtime.queryTemplate ? { template: runtime.queryTemplate } : {},
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: runtime.tournament,
    fetchTournament: mockDeps.fetchTournament,
    subscribeTournament: mockDeps.subscribeTournament,
    unsubscribeAll: mockDeps.unsubscribeTournament,
  }),
}));

vi.mock('@/composables/usePublicPageMetadata', () => ({
  usePublicPageMetadata: mockDeps.setMetadata,
}));

const baseTournament = {
  id: 't1',
  name: 'Spring Invitational',
  sport: 'badminton',
  format: 'single_elimination',
  status: 'active',
  startDate: new Date('2026-04-10T09:00:00.000Z'),
  endDate: new Date('2026-04-10T17:00:00.000Z'),
  location: 'Chicago, IL',
  settings: {
    minRestTimeMinutes: 10,
    matchDurationMinutes: 25,
    allowSelfRegistration: true,
    requireApproval: true,
    gamesPerMatch: 3,
    pointsToWin: 21,
    mustWinBy: 2,
    maxPoints: 30,
  },
  createdBy: 'admin-1',
  createdAt: new Date('2026-03-01T10:00:00.000Z'),
  updatedAt: new Date('2026-03-01T10:00:00.000Z'),
} as unknown as Tournament;

const readString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value?: unknown }).value ?? '');
  }
  throw new Error('Expected string value');
};

const readBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    return Boolean((value as { value?: unknown }).value);
  }
  throw new Error('Expected boolean value');
};

const mountView = () =>
  shallowMount(TournamentLandingTemplateView, {
    global: {
      stubs: [
        'TournamentPublicShell',
        'v-row',
        'v-col',
        'v-card',
        'v-card-text',
        'v-icon',
        'v-btn',
        'v-chip',
        'v-divider',
      ],
    },
  });

describe('TournamentLandingTemplateView', () => {
  beforeEach(() => {
    runtime.queryTemplate = 'event-night';
    runtime.tournament = baseTournament;
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeTournament.mockReset();
    mockDeps.unsubscribeTournament.mockReset();
    mockDeps.setMetadata.mockReset();
  });

  it('loads tournament and resolves requested template variant', async () => {
    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      resolvedThemeKey: string | { value: string };
      notFound: boolean | { value: boolean };
    };

    expect(mockDeps.fetchTournament).toHaveBeenCalledWith('t1');
    expect(mockDeps.subscribeTournament).toHaveBeenCalledWith('t1');
    expect(readString(vm.resolvedThemeKey)).toBe('event-night');
    expect(readBoolean(vm.notFound)).toBe(false);
    expect(mockDeps.setMetadata).toHaveBeenCalledWith(expect.objectContaining({
      canonicalPath: '/tournaments/t1/landing',
    }));
  });

  it('falls back to classic template when query variant is invalid', async () => {
    runtime.queryTemplate = 'unknown-theme';

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      resolvedThemeKey: string | { value: string };
    };

    expect(readString(vm.resolvedThemeKey)).toBe('classic');
  });

  it('shows not-found state when tournament fetch fails', async () => {
    mockDeps.fetchTournament.mockRejectedValueOnce(new Error('missing'));

    const wrapper = mountView();
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      notFound: boolean | { value: boolean };
    };

    expect(readBoolean(vm.notFound)).toBe(true);
    expect(mockDeps.subscribeTournament).not.toHaveBeenCalled();
  });
});
