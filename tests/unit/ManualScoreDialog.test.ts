import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import ManualScoreDialog from '@/features/tournaments/dialogs/ManualScoreDialog.vue';
import type { Category, Match, Tournament } from '@/types';

const mockDeps = vi.hoisted(() => ({
  submitManualScores: vi.fn(),
  recordWalkover: vi.fn(),
  showToast: vi.fn(),
  logMatchCompleted: vi.fn(),
}));

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    submitManualScores: mockDeps.submitManualScores,
    recordWalkover: mockDeps.recordWalkover,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast: mockDeps.showToast,
  }),
}));

vi.mock('@/stores/activities', () => ({
  useActivityStore: () => ({
    logMatchCompleted: mockDeps.logMatchCompleted,
  }),
}));

vi.mock('@/composables/useMatchDisplay', () => ({
  useMatchDisplay: () => ({
    getMatchDisplayName: () => 'Quarterfinal 1',
  }),
}));

vi.mock('@/composables/useParticipantResolver', () => ({
  useParticipantResolver: () => ({
    getParticipantName: (registrationId?: string) => {
      if (registrationId === 'reg-1') return 'Player One';
      if (registrationId === 'reg-2') return 'Player Two';
      return 'Unknown';
    },
  }),
}));

const tournament = {
  id: 't1',
  name: 'Spring Open',
  format: 'single_elimination',
  status: 'active',
  startDate: new Date('2026-04-18T09:00:00.000Z'),
  endDate: new Date('2026-04-18T18:00:00.000Z'),
  settings: {
    minRestTimeMinutes: 15,
    matchDurationMinutes: 30,
    allowSelfRegistration: false,
    requireApproval: true,
    gamesPerMatch: 3,
    pointsToWin: 21,
    mustWinBy: 2,
    maxPoints: 30,
  },
  createdBy: 'admin-1',
  createdAt: new Date('2026-04-01T09:00:00.000Z'),
  updatedAt: new Date('2026-04-01T09:00:00.000Z'),
} as Tournament;

const category = {
  id: 'cat-1',
  tournamentId: 't1',
  name: 'Mixed Doubles',
  type: 'mixed_doubles',
  gender: 'mixed',
  ageGroup: 'open',
  format: 'single_elimination',
  createdAt: new Date('2026-04-01T09:00:00.000Z'),
  updatedAt: new Date('2026-04-01T09:00:00.000Z'),
} as Category;

const match = {
  id: 'm1',
  tournamentId: 't1',
  categoryId: 'cat-1',
  levelId: 'level-a',
  stageId: 'stage-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: 'reg-1',
  participant2Id: 'reg-2',
  status: 'ready',
  scores: [],
  createdAt: new Date('2026-04-18T09:00:00.000Z'),
  updatedAt: new Date('2026-04-18T09:00:00.000Z'),
} as Match;

const mountDialog = () => shallowMount(ManualScoreDialog, {
  props: {
    modelValue: true,
    match,
    tournamentId: 't1',
    tournament,
    categories: [category],
  },
  global: {
    stubs: {
      BaseDialog: {
        template: `
          <div class="base-dialog-stub">
            <slot />
            <slot name="actions" />
          </div>
        `,
      },
      WalkoverDialog: {
        name: 'WalkoverDialog',
        props: ['modelValue', 'match'],
        template: '<div class="walkover-dialog-stub" />',
      },
      'v-form': {
        template: '<form><slot /></form>',
      },
      'v-btn': {
        template: '<button @click="$emit(\'click\')"><slot /></button>',
      },
      'v-text-field': {
        template: '<input />',
      },
      'v-chip': {
        template: '<div><slot /></div>',
      },
      'v-icon': {
        template: '<i><slot /></i>',
      },
      'v-spacer': true,
    },
  },
});

describe('ManualScoreDialog', () => {
  beforeEach(() => {
    mockDeps.submitManualScores.mockReset();
    mockDeps.recordWalkover.mockReset().mockResolvedValue(undefined);
    mockDeps.showToast.mockReset();
    mockDeps.logMatchCompleted.mockReset();
  });

  it('opens the walkover dialog from the shared manual scoring actions', async () => {
    const wrapper = mountDialog();

    expect(wrapper.findComponent({ name: 'WalkoverDialog' }).props('modelValue')).toBe(false);

    await wrapper.find('button').trigger('click');

    expect(wrapper.findComponent({ name: 'WalkoverDialog' }).props('modelValue')).toBe(true);
  });

  it('records walkovers through the shared dialog flow', async () => {
    const wrapper = mountDialog();

    await wrapper.findComponent({ name: 'WalkoverDialog' }).vm.$emit('confirm', 'reg-2', 'No show');

    expect(mockDeps.recordWalkover).toHaveBeenCalledWith(
      't1',
      'm1',
      'reg-2',
      'cat-1',
      'level-a'
    );
    expect(mockDeps.showToast).toHaveBeenCalledWith('success', 'Walkover recorded');
    expect(wrapper.emitted('saved')).toHaveLength(1);
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });
});
