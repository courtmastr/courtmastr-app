import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import TournamentSettingsView from '@/features/tournaments/views/TournamentSettingsView.vue';

const mockDeps = vi.hoisted(() => ({
  fetchTournament: vi.fn(),
  updateTournament: vi.fn(),
  updateCategory: vi.fn(),
  deleteTournament: vi.fn(),
  addOrganizer: vi.fn(),
  removeOrganizer: vi.fn(),
  fetchUsers: vi.fn(),
  showToast: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  advanceState: vi.fn(),
  transitionTo: vi.fn(),
  callableFactory: vi.fn(),
  setVolunteerPin: vi.fn(),
  revealVolunteerPin: vi.fn(),
  assertCanEditScoring: vi.fn(),
}));

const runtime = {
  currentTournament: {
    id: 't1',
    name: 'Spring Open',
    description: '',
    sport: 'badminton',
    format: 'single_elimination',
    status: 'draft',
    state: 'DRAFT',
    startDate: new Date('2026-03-15T00:00:00.000Z'),
    endDate: new Date('2026-03-16T00:00:00.000Z'),
    settings: {
      minRestTimeMinutes: 15,
      matchDurationMinutes: 30,
      allowSelfRegistration: true,
      requireApproval: true,
      gamesPerMatch: 3,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
      rankingPresetDefault: 'courtmaster_default',
      progressionModeDefault: 'carry_forward',
    },
    createdBy: 'user-1',
    organizerIds: ['user-1'],
    volunteerAccess: {
      checkin: {
        enabled: true,
        pinRevision: 1,
        maskedPin: '**29',
      },
    },
    createdAt: new Date('2026-03-01T00:00:00.000Z'),
    updatedAt: new Date('2026-03-01T00:00:00.000Z'),
  },
  categories: [] as Array<Record<string, unknown>>,
};

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { tournamentId: 't1' },
  }),
  useRouter: () => ({
    push: mockDeps.push,
    back: mockDeps.back,
  }),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    get currentTournament() {
      return runtime.currentTournament;
    },
    get categories() {
      return runtime.categories;
    },
    fetchTournament: mockDeps.fetchTournament,
    updateTournament: mockDeps.updateTournament,
    updateCategory: mockDeps.updateCategory,
    deleteTournament: mockDeps.deleteTournament,
    addOrganizer: mockDeps.addOrganizer,
    removeOrganizer: mockDeps.removeOrganizer,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'user-1' },
    userRole: 'admin',
    isAdmin: true,
  }),
}));

vi.mock('@/stores/users', () => ({
  useUserStore: () => ({
    users: [],
    fetchUsers: mockDeps.fetchUsers,
  }),
}));

vi.mock('@/composables/useTournamentStateAdvance', () => ({
  useTournamentStateAdvance: () => ({
    advanceState: mockDeps.advanceState,
    getNextState: () => 'REG_OPEN',
    transitionTo: mockDeps.transitionTo,
  }),
}));

vi.mock('@/guards/tournamentState', () => ({
  getTournamentStateLabel: () => runtime.currentTournament.state === 'LIVE' ? 'Live' : 'Draft',
  normalizeTournamentState: () => runtime.currentTournament.state,
  assertCanEditScoring: mockDeps.assertCanEditScoring,
  isScoringLocked: () => runtime.currentTournament.state === 'LIVE',
}));

vi.mock('@/features/scoring/utils/validation', () => ({
  sanitizeScoringConfig: (config: Record<string, unknown>) => ({
    gamesPerMatch: Number(config.gamesPerMatch ?? 3),
    pointsToWin: Number(config.pointsToWin ?? 21),
    mustWinBy: Number(config.mustWinBy ?? 2),
    maxPoints: config.maxPoints == null ? null : Number(config.maxPoints),
  }),
}));

vi.mock('@/services/firebase', () => ({
  functions: { __mock: true },
  httpsCallable: mockDeps.callableFactory,
}));

interface TournamentSettingsVm {
  volunteerAccessForms: Record<string, { pin: string }>;
  saveVolunteerPin: (role: 'checkin' | 'scorekeeper') => Promise<void>;
}

const mountView = () => shallowMount(TournamentSettingsView, {
  global: {
    stubs: [
      'StateBanner',
      'v-container',
      'v-row',
      'v-col',
      'v-btn',
      'v-card',
      'v-card-title',
      'v-card-text',
      'v-card-actions',
      'v-icon',
      'v-text-field',
      'v-textarea',
      'v-switch',
      'v-select',
      'v-expansion-panels',
      'v-expansion-panel',
      'v-expansion-panel-title',
      'v-expansion-panel-text',
      'v-list',
      'v-list-item',
      'v-alert',
      'v-chip',
      'v-divider',
      'v-dialog',
      'v-spacer',
      'v-autocomplete',
    ],
  },
});

describe('TournamentSettingsView volunteer access', () => {
  beforeEach(() => {
    runtime.currentTournament.state = 'DRAFT';
    runtime.categories = [];
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.updateTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.updateCategory.mockReset().mockResolvedValue(undefined);
    mockDeps.deleteTournament.mockReset().mockResolvedValue(undefined);
    mockDeps.addOrganizer.mockReset().mockResolvedValue(undefined);
    mockDeps.removeOrganizer.mockReset().mockResolvedValue(undefined);
    mockDeps.fetchUsers.mockReset().mockResolvedValue(undefined);
    mockDeps.showToast.mockReset();
    mockDeps.push.mockReset();
    mockDeps.back.mockReset();
    mockDeps.advanceState.mockReset();
    mockDeps.transitionTo.mockReset();
    mockDeps.assertCanEditScoring.mockReset();
    mockDeps.setVolunteerPin.mockReset().mockResolvedValue({
      data: {
        role: 'checkin',
        enabled: true,
        pinRevision: 2,
        maskedPin: '**29',
      },
    });
    mockDeps.revealVolunteerPin.mockReset();
    mockDeps.callableFactory.mockReset().mockImplementation((_functions: unknown, name: string) => {
      if (name === 'setVolunteerPin') {
        return mockDeps.setVolunteerPin;
      }

      if (name === 'revealVolunteerPin') {
        return mockDeps.revealVolunteerPin;
      }

      return vi.fn();
    });
  });

  it('parses startDate as local midnight and endDate as local end-of-day on save', async () => {
    const wrapper = mountView();
    await flushPromises();
    const vm = wrapper.vm as any;

    // Simulate user picking dates from the date input (bare YYYY-MM-DD strings)
    vm.startDate = '2026-04-18';
    vm.endDate = '2026-04-20';

    await vm.saveBasicInfoSection();

    const call = mockDeps.updateTournament.mock.calls[0][1];
    const start: Date = call.startDate;
    const end: Date = call.endDate;

    // Start date must be local midnight (hour 0), not UTC midnight
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(3); // April = 3
    expect(start.getDate()).toBe(18);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);

    // End date must be local end-of-day (23:59:59), not midnight
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(3);
    expect(end.getDate()).toBe(20);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });

  it('saves LIVE category scoring overrides without touching tournament defaults or branding validation', async () => {
    runtime.currentTournament.state = 'LIVE';
    runtime.categories = [{
      id: 'cat-1',
      name: 'Mixed Doubles',
      format: 'single_elimination',
      scoringOverrideEnabled: false,
      scoringConfig: null,
      eliminationScoringEnabled: false,
      eliminationScoringConfig: null,
    }];

    const wrapper = mountView();
    await flushPromises();
    const vm = wrapper.vm as any;

    vm.brandingDraft = {
      ...vm.brandingDraft,
      sponsors: [{
        id: 'sponsor-1',
        name: 'Broken Sponsor',
        logoUrl: '',
        logoPath: null,
        displayOrder: 0,
      }],
    };
    vm.categoryScoringOverrides['cat-1'].enabled = true;
    vm.categoryScoringOverrides['cat-1'].preset = 'custom';
    vm.categoryScoringOverrides['cat-1'].config.pointsToWin = 15;
    vm.categoryScoringOverrides['cat-1'].config.maxPoints = null;

    await vm.saveScoringSection();

    expect(mockDeps.assertCanEditScoring).not.toHaveBeenCalled();
    expect(mockDeps.updateTournament).not.toHaveBeenCalled();
    expect(mockDeps.updateCategory).toHaveBeenCalledWith(
      't1',
      'cat-1',
      expect.objectContaining({
        scoringOverrideEnabled: true,
        scoringConfig: expect.objectContaining({
          gamesPerMatch: 3,
          pointsToWin: 15,
          mustWinBy: 2,
          maxPoints: null,
        }),
        eliminationScoringEnabled: false,
        eliminationScoringConfig: null,
      })
    );
    expect(mockDeps.showToast).toHaveBeenCalledWith('success', 'Scoring settings saved');
    expect(mockDeps.showToast).not.toHaveBeenCalledWith(
      'error',
      expect.stringContaining('Sponsor')
    );
  });

  it('saves a check-in PIN through the callable and refreshes the tournament', async () => {
    const wrapper = mountView();
    await flushPromises();
    const vm = wrapper.vm as unknown as TournamentSettingsVm;

    vm.volunteerAccessForms.checkin.pin = '4829';
    await vm.saveVolunteerPin('checkin');

    expect(mockDeps.setVolunteerPin).toHaveBeenCalledWith({
      tournamentId: 't1',
      role: 'checkin',
      pin: '4829',
      enabled: true,
    });
    expect(mockDeps.fetchTournament).toHaveBeenCalledWith('t1');
    expect(mockDeps.showToast).toHaveBeenCalledWith('success', 'Check-in PIN saved');
  });
});
