import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import TournamentCreateView from '@/features/tournaments/views/TournamentCreateView.vue';

const mockDeps = vi.hoisted(() => ({
  createTournament: vi.fn(),
  addCategory: vi.fn(),
  addCourt: vi.fn(),
  showToast: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => ({
    createTournament: mockDeps.createTournament,
    addCategory: mockDeps.addCategory,
    addCourt: mockDeps.addCourt,
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    currentUser: { id: 'user-1', role: 'admin' },
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockDeps.push,
    back: mockDeps.back,
  }),
}));

const mountView = () => shallowMount(TournamentCreateView, {
  global: {
    stubs: [
      'v-container',
      'v-row',
      'v-col',
      'v-btn',
      'v-stepper',
      'v-stepper-header',
      'v-stepper-item',
      'v-divider',
      'v-stepper-window',
      'v-stepper-window-item',
      'v-card',
      'v-card-text',
      'v-card-actions',
      'v-text-field',
      'v-textarea',
      'v-alert',
      'v-checkbox',
      'v-select',
      'v-switch',
      'v-tooltip',
      'v-spacer',
    ],
  },
});

const readValue = <T>(value: T | { value: T }): T => {
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value;
  }
  return value as T;
};

interface TournamentCreateVm {
  name: string;
  startDate: string;
  endDate: string;
  selectedCategories: string[];
  customCategories: Array<{ name: string; type: string; gender: string }>;
  courts: Array<{ name: string; number: number }>;
  currentStep: number;
  canContinue: boolean | { value: boolean };
  continueDisabledReason: string | { value: string };
  createTournament: () => Promise<void>;
}

describe('TournamentCreateView', () => {
  beforeEach(() => {
    mockDeps.createTournament.mockReset().mockResolvedValue('tournament-1');
    mockDeps.addCategory.mockReset().mockResolvedValue(undefined);
    mockDeps.addCourt.mockReset().mockResolvedValue(undefined);
    mockDeps.showToast.mockReset();
    mockDeps.push.mockReset().mockResolvedValue(undefined);
    mockDeps.back.mockReset();
  });

  it('parses startDate as local midnight and endDate as local end-of-day', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as any;

    vm.name = 'Spring Open';
    vm.startDate = '2026-04-18';
    vm.endDate = '2026-04-20';
    vm.selectedCategories = ['0'];
    vm.customCategories = [];
    vm.courts = [{ name: 'Court 1', number: 1 }];

    await vm.createTournament();

    const call = mockDeps.createTournament.mock.calls[0][0];
    const start: Date = call.startDate;
    const end: Date = call.endDate;

    // Start date must be local midnight (hour 0)
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(3); // April = 3
    expect(start.getDate()).toBe(18);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);

    // End date must be local end-of-day (hour 23)
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(3);
    expect(end.getDate()).toBe(20);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });

  it('requires at least one category before creating tournament', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as any;

    vm.name = 'Spring Open';
    vm.startDate = '2026-03-15';
    vm.endDate = '2026-03-16';
    vm.selectedCategories = [];
    vm.customCategories = [];

    await vm.createTournament();

    expect(mockDeps.createTournament).not.toHaveBeenCalled();
    expect(mockDeps.showToast).toHaveBeenCalledWith(
      'error',
      'Please select at least one category'
    );
  });

  it('creates tournament, categories, courts, then navigates to dashboard', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as any;

    vm.name = 'Spring Open';
    vm.description = 'A ranked event';
    vm.location = 'City Arena';
    vm.startDate = '2026-03-15';
    vm.endDate = '2026-03-16';
    vm.registrationDeadline = '2026-03-10';
    vm.selectedCategories = ['0']; // CATEGORY_TEMPLATES[0]
    vm.customCategories = [{
      name: 'U18 Singles',
      type: 'singles',
      gender: 'open',
    }];
    vm.courts = [
      { name: 'Court 1', number: 1 },
      { name: 'Court 2', number: 2 },
    ];

    await vm.createTournament();

    expect(mockDeps.createTournament).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Spring Open',
      createdBy: 'user-1',
      organizerIds: ['user-1'],
      format: 'single_elimination',
      status: 'draft',
      settings: expect.objectContaining({
        rankingPresetDefault: 'courtmaster_default',
        progressionModeDefault: 'carry_forward',
      }),
    }));
    expect(mockDeps.addCategory).toHaveBeenCalledTimes(2);
    expect(mockDeps.addCourt).toHaveBeenCalledTimes(2);
    expect(mockDeps.showToast).toHaveBeenCalledWith(
      'success',
      'Tournament created successfully!'
    );
    expect(mockDeps.push).toHaveBeenCalledWith('/tournaments/tournament-1');
  });

  it('maps continue state and disabled reason to the active step', () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as TournamentCreateVm;

    expect(readValue(vm.canContinue)).toBe(false);
    expect(readValue(vm.continueDisabledReason)).toContain('basic info');

    vm.name = 'Spring Open';
    vm.startDate = '2026-03-15';
    vm.endDate = '2026-03-16';

    expect(readValue(vm.canContinue)).toBe(true);
    expect(readValue(vm.continueDisabledReason)).toBe('');

    vm.currentStep = 2;
    vm.selectedCategories = [];
    vm.customCategories = [];

    expect(readValue(vm.canContinue)).toBe(false);
    expect(readValue(vm.continueDisabledReason)).toContain('category');

    vm.selectedCategories = ['0'];
    expect(readValue(vm.canContinue)).toBe(true);

    vm.currentStep = 3;
    vm.courts = [];

    expect(readValue(vm.canContinue)).toBe(false);
    expect(readValue(vm.continueDisabledReason)).toContain('court');
  });
});
