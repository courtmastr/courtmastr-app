import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Match } from '@/types';
import SelectMatchForCourtDialog from '@/features/tournaments/dialogs/SelectMatchForCourtDialog.vue';

const assignCourt = vi.fn();
const showToast = vi.fn();

vi.mock('@/stores/matches', () => ({
  useMatchStore: () => ({
    assignCourt,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    showToast,
  }),
}));

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: 'match-2',
  tournamentId: 't-1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 2,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  participant1Id: 'reg-1',
  participant2Id: 'reg-2',
  status: 'ready',
  scores: [],
  createdAt: new Date('2026-04-01T10:00:00.000Z'),
  updatedAt: new Date('2026-04-01T10:00:00.000Z'),
  ...overrides,
});

describe('SelectMatchForCourtDialog', () => {
  beforeEach(() => {
    assignCourt.mockReset();
    showToast.mockReset();
    assignCourt.mockResolvedValue(undefined);
  });

  it('treats same match ids from different level scopes as distinct selections', async () => {
    const wrapper = mount(SelectMatchForCourtDialog, {
      props: {
        modelValue: true,
        courtId: 'court-1',
        courtName: 'Court 1',
        tournamentId: 't-1',
        matches: [
          makeMatch({
            id: '2',
            levelId: 'level-1',
            participant1Id: 'reg-a1',
            participant2Id: 'reg-a2',
          }),
          makeMatch({
            id: '2',
            levelId: 'level-2',
            participant1Id: 'reg-b1',
            participant2Id: 'reg-b2',
          }),
          makeMatch({
            id: '2',
            levelId: 'level-3',
            participant1Id: 'reg-c1',
            participant2Id: 'reg-c2',
          }),
        ],
        getParticipantName: (id?: string) => id ?? 'Unknown',
        getCategoryName: () => "Men's Doubles",
        getMatchScopeLabel: (match: Match) => ({
          'level-1': 'Advanced',
          'level-2': 'Intermediate',
          'level-3': 'Beginner',
        }[match.levelId ?? ''] ?? null),
        getMatchDisplayCode: (match: Match) => ({
          'level-1': 'MD21',
          'level-2': 'MD22',
          'level-3': 'MD23',
        }[match.levelId ?? ''] ?? 'MD00'),
      },
      global: {
        stubs: {
          BaseDialog: {
            props: ['modelValue', 'title'],
            template: `
              <div class="base-dialog">
                <div class="dialog-title">{{ title }}</div>
                <slot />
                <slot name="actions" />
              </div>
            `,
          },
          'v-alert': { template: '<div><slot /></div>' },
          'v-list': { template: '<div><slot /></div>' },
          'v-list-item': {
            props: ['active'],
            template: `
              <button class="match-row" :data-active="String(active)" @click="$emit('click')">
                <slot name="prepend" />
                <slot name="title" />
                <slot name="subtitle" />
                <slot name="append" />
              </button>
            `,
          },
          'v-chip': { template: '<span class="chip"><slot /></span>' },
          'v-icon': { template: '<i class="selected-icon" />' },
          'v-btn': {
            props: ['disabled'],
            template: '<button class="action-btn" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
          },
          'v-spacer': { template: '<span />' },
        },
      },
    });

    expect(wrapper.text()).toContain('Advanced');
    expect(wrapper.text()).toContain('Intermediate');
    expect(wrapper.text()).toContain('Beginner');
    expect(wrapper.text()).toContain('MD21');
    expect(wrapper.text()).toContain('MD22');
    expect(wrapper.text()).toContain('MD23');

    const rows = wrapper.findAll('.match-row');
    await rows[1].trigger('click');

    expect(wrapper.findAll('.selected-icon')).toHaveLength(1);

    const assignButton = wrapper.findAll('.action-btn').find((node) => node.text() === 'Assign to Court');
    expect(assignButton).toBeDefined();
    await assignButton!.trigger('click');

    expect(assignCourt).toHaveBeenCalledWith('t-1', '2', 'court-1', 'cat-1', 'level-2');
    expect(showToast).toHaveBeenCalledWith('success', 'Match assigned to court!');
  });
});
