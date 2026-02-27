import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import type { Match, Registration } from '@/types';
import TournamentSummaryView from '@/features/reports/views/TournamentSummaryView.vue';

const runtime = {
  tournament: {
    id: 't1',
    name: 'Spring Open',
    settings: {
      matchDurationMinutes: 30,
    },
  },
  categories: [
    {
      id: 'cat-1',
      tournamentId: 't1',
      name: "Men's Singles",
      type: 'singles',
      gender: 'men',
      ageGroup: 'open',
      format: 'round_robin',
      seedingEnabled: false,
      status: 'active',
      createdAt: new Date('2026-02-27T09:00:00.000Z'),
      updatedAt: new Date('2026-02-27T09:00:00.000Z'),
    },
  ],
  courts: [
    {
      id: 'court-1',
      tournamentId: 't1',
      name: 'Court 1',
      number: 1,
      status: 'available',
      createdAt: new Date('2026-02-27T09:00:00.000Z'),
      updatedAt: new Date('2026-02-27T09:00:00.000Z'),
    },
    {
      id: 'court-2',
      tournamentId: 't1',
      name: 'Court 2',
      number: 2,
      status: 'available',
      createdAt: new Date('2026-02-27T09:00:00.000Z'),
      updatedAt: new Date('2026-02-27T09:00:00.000Z'),
    },
  ],
  matches: [] as Match[],
  registrations: [] as Registration[],
};

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  subscribeAllMatches: vi.fn(),
  unsubscribeMatches: vi.fn(),
  subscribeRegistrations: vi.fn(),
  unsubscribeRegistrations: vi.fn(),
  showToast: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
  }),
  useRouter: () => ({
    push: mockDeps.routerPush,
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    currentTournament: runtime.tournament,
    categories: runtime.categories,
    courts: runtime.courts,
    fetchTournament: mockDeps.fetchTournament,
  }),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    matches: runtime.matches,
    subscribeAllMatches: mockDeps.subscribeAllMatches,
    unsubscribeAll: mockDeps.unsubscribeMatches,
  }),
}));

vi.mock('@/stores/registrations', () => ({
  useRegistrationStore: () => ({
    registrations: runtime.registrations,
    subscribeRegistrations: mockDeps.subscribeRegistrations,
    unsubscribeAll: mockDeps.unsubscribeRegistrations,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

interface TournamentSummaryVm {
  durationStats: {
    averageMinutes: number | null;
    medianMinutes: number | null;
    minMinutes: number | null;
    maxMinutes: number | null;
    observedCount: number;
    excludedCount: number;
  } | { value: TournamentSummaryVm['durationStats'] };
  exportSummaryCsv: () => void;
}

const makeRegistration = (id: string, status: Registration['status']): Registration => ({
  id,
  tournamentId: 't1',
  categoryId: 'cat-1',
  participantType: 'player',
  playerId: `p-${id}`,
  status,
  registeredBy: 'admin-1',
  registeredAt: new Date('2026-02-27T09:00:00.000Z'),
});

const makeMatch = (
  id: string,
  status: Match['status'],
  startedAt: Date | undefined,
  completedAt: Date | undefined
): Match => ({
  id,
  tournamentId: 't1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: 'reg-1',
  participant2Id: 'reg-2',
  status,
  courtId: 'court-1',
  startedAt,
  completedAt,
  scores: [],
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
});

const mountView = () =>
  shallowMount(TournamentSummaryView, {
    global: {
      stubs: [
        'v-container',
        'v-row',
        'v-col',
        'v-card',
        'v-card-title',
        'v-card-text',
        'v-btn',
        'v-icon',
        'v-tooltip',
        'v-divider',
        'v-list',
        'v-list-item',
        'v-data-table',
        'DurationMetrics',
      ],
    },
  });

const unwrapDurationStats = (vm: TournamentSummaryVm) => {
  const value = vm.durationStats as { value?: unknown };
  if (value && Object.prototype.hasOwnProperty.call(value, 'value')) {
    return value.value as {
      averageMinutes: number | null;
      medianMinutes: number | null;
      minMinutes: number | null;
      maxMinutes: number | null;
      observedCount: number;
      excludedCount: number;
    };
  }
  return vm.durationStats as {
    averageMinutes: number | null;
    medianMinutes: number | null;
    minMinutes: number | null;
    maxMinutes: number | null;
    observedCount: number;
    excludedCount: number;
  };
};

describe('TournamentSummaryView', () => {
  beforeEach(() => {
    runtime.matches = [];
    runtime.registrations = [
      makeRegistration('reg-1', 'approved'),
      makeRegistration('reg-2', 'checked_in'),
      makeRegistration('reg-3', 'no_show'),
    ];

    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeAllMatches.mockReset();
    mockDeps.unsubscribeMatches.mockReset();
    mockDeps.subscribeRegistrations.mockReset();
    mockDeps.unsubscribeRegistrations.mockReset();
    mockDeps.showToast.mockReset();
    mockDeps.routerPush.mockReset();
  });

  it('excludes invalid and >720 minute durations from KPI metrics', () => {
    runtime.matches = [
      makeMatch('m1', 'completed', new Date('2026-02-27T10:00:00.000Z'), new Date('2026-02-27T10:30:00.000Z')),
      makeMatch('m2', 'walkover', new Date('2026-02-27T11:00:00.000Z'), new Date('2026-02-27T12:00:00.000Z')),
      makeMatch('m3', 'completed', undefined, new Date('2026-02-27T12:00:00.000Z')),
      makeMatch('m4', 'completed', new Date('2026-02-27T13:00:00.000Z'), new Date('2026-02-27T12:50:00.000Z')),
      makeMatch('m5', 'completed', new Date('2026-02-26T00:00:00.000Z'), new Date('2026-02-26T13:30:00.000Z')),
    ];

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as TournamentSummaryVm;
    const stats = unwrapDurationStats(vm);

    expect(stats.observedCount).toBe(2);
    expect(stats.excludedCount).toBe(3);
    expect(stats.averageMinutes).toBe(45);
    expect(stats.medianMinutes).toBe(45);
    expect(stats.minMinutes).toBe(30);
    expect(stats.maxMinutes).toBe(60);
  });

  it('exports csv with duration metrics and shows success toast', async () => {
    runtime.matches = [
      makeMatch('m1', 'completed', new Date('2026-02-27T10:00:00.000Z'), new Date('2026-02-27T10:30:00.000Z')),
      makeMatch('m2', 'completed', undefined, new Date('2026-02-27T12:00:00.000Z')),
    ];

    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement('a');
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => (tagName === 'a' ? anchor : originalCreateElement(tagName)));

    let capturedBlob: Blob | null = null;
    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((blob: Blob | MediaSource) => {
        if (blob instanceof Blob) capturedBlob = blob;
        return 'blob:summary';
      });
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const wrapper = mountView();
    const vm = wrapper.vm as unknown as TournamentSummaryVm;
    vm.exportSummaryCsv();

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:summary');
    expect(mockDeps.showToast).toHaveBeenCalledWith('success', 'Summary report exported');
    expect(capturedBlob).not.toBeNull();
    const csvContent = await (capturedBlob as Blob).text();
    expect(csvContent).toContain('Observed Duration Count,1');
    expect(csvContent).toContain('Excluded Duration Count,1');

    createElementSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeObjectUrlSpy.mockRestore();
  });
});
