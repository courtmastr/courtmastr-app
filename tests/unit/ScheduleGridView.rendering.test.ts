import { describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import type { Court, Match } from '@/types';
import ScheduleGridView from '@/features/tournaments/components/ScheduleGridView.vue';

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: 'm-1',
  tournamentId: 't-1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 1,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 1,
  },
  status: 'ready',
  scores: [],
  plannedStartAt: new Date('2026-02-27T09:00:00.000Z'),
  plannedEndAt: new Date('2026-02-27T09:30:00.000Z'),
  createdAt: new Date('2026-02-27T08:00:00.000Z'),
  updatedAt: new Date('2026-02-27T08:00:00.000Z'),
  ...overrides,
});

const makeCourt = (): Court => ({
  id: 'court-1',
  tournamentId: 't-1',
  name: 'Court 1',
  number: 1,
  status: 'available',
  createdAt: new Date('2026-02-27T08:00:00.000Z'),
  updatedAt: new Date('2026-02-27T08:00:00.000Z'),
});

const mountGrid = (matches: Match[]) =>
  shallowMount(ScheduleGridView, {
    props: {
      matches,
      allMatches: matches,
      courts: [makeCourt()],
      publicState: 'all',
      getCategoryName: () => 'Category 1',
      getParticipantName: (registrationId: string | undefined) =>
        registrationId ? `Name:${registrationId}` : 'Unknown',
    },
    global: {
      stubs: [
        'v-alert',
        'v-icon',
        'v-tooltip',
        'v-btn-toggle',
        'v-btn',
        'v-chip',
        'v-list',
        'v-list-item',
        'v-expansion-panels',
        'v-expansion-panel',
        'v-expansion-panel-title',
        'v-expansion-panel-text',
      ],
    },
  });

describe('ScheduleGridView slot labels and schedulability', () => {
  it('renders BYE labels and keeps BYE matches out of scheduled grid cards', () => {
    const byeMatch = makeMatch({
      participant1Id: 'reg-1',
      participant2Id: undefined,
      winnerId: undefined,
      status: 'ready',
      scheduleStatus: 'draft',
    });

    const wrapper = mountGrid([byeMatch]);
    const vm = wrapper.vm as unknown as {
      getMatchLabel: (match: Match) => string;
      scheduledMatches: Match[];
      unscheduledMatches: Match[];
    };

    expect(vm.getMatchLabel(byeMatch)).toBe('Name:reg-1 vs BYE');
    expect(vm.scheduledMatches).toHaveLength(0);
    expect(vm.unscheduledMatches).toHaveLength(1);
  });

  it('keeps non-bye TBD placeholders schedulable and labeled as TBD', () => {
    const tbdMatch = makeMatch({
      round: 2,
      bracketPosition: {
        bracket: 'winners',
        round: 2,
        position: 1,
      },
      participant1Id: 'reg-1',
      participant2Id: undefined,
      winnerId: undefined,
      status: 'ready',
      scheduleStatus: 'draft',
    });

    const wrapper = mountGrid([tbdMatch]);
    const vm = wrapper.vm as unknown as {
      getMatchLabel: (match: Match) => string;
      scheduledMatches: Match[];
    };

    expect(vm.getMatchLabel(tbdMatch)).toBe('Name:reg-1 vs TBD');
    expect(vm.scheduledMatches).toHaveLength(1);
  });
});
