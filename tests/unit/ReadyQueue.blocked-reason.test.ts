import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { Match } from '@/types';
import ReadyQueue from '@/features/tournaments/components/ReadyQueue.vue';

vi.mock('@/composables/useMatchIdentification', () => ({
  useMatchIdentification: () => ({
    formatMatchNumber: () => 'MD #2',
  }),
}));

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: 'match-1',
  tournamentId: 't1',
  categoryId: 'cat-1',
  round: 1,
  matchNumber: 2,
  bracketPosition: {
    bracket: 'winners',
    round: 1,
    position: 2,
  },
  participant1Id: 'reg-1',
  participant2Id: 'reg-2',
  status: 'ready',
  scheduleStatus: 'draft',
  scores: [],
  createdAt: new Date('2026-02-27T09:00:00.000Z'),
  updatedAt: new Date('2026-02-27T09:00:00.000Z'),
  ...overrides,
});

describe('ReadyQueue blocked reason messaging', () => {
  it('renders the full organizer-facing blocker summary when a ready match cannot be assigned', () => {
    const wrapper = mount(ReadyQueue, {
      props: {
        matches: [makeMatch()],
        categories: [
          {
            id: 'cat-1',
            tournamentId: 't1',
            name: "Men's Doubles",
            type: 'doubles',
            gender: 'men',
            ageGroup: 'open',
            format: 'pool_to_elimination',
            seedingEnabled: true,
            status: 'active',
            createdAt: new Date('2026-02-27T09:00:00.000Z'),
            updatedAt: new Date('2026-02-27T09:00:00.000Z'),
          },
        ],
        getParticipantName: (registrationId?: string) => registrationId ?? 'Unknown',
        getCategoryName: () => "Men's Doubles",
        canAssignMatch: () => false,
        getAssignBlockedReason: () => 'Waiting for check-in • Publish schedule first',
      },
      global: {
        stubs: {
          'v-icon': { template: '<i><slot /></i>' },
          'v-list': { template: '<div><slot /></div>' },
          'v-list-item': { template: '<div><slot name="prepend" /><slot /><slot name="append" /></div>' },
          'v-list-item-title': { template: '<div><slot /></div>' },
          'v-list-item-subtitle': { template: '<div><slot /></div>' },
          'v-divider': { template: '<hr />' },
          'v-chip': { template: '<span><slot /></span>' },
          'v-btn': { template: '<button><slot /></button>' },
          'v-spacer': { template: '<span />' },
        },
      },
    });

    expect(wrapper.text()).toContain('Waiting for check-in');
    expect(wrapper.text()).toContain('Publish schedule first');
    expect(wrapper.text()).not.toContain('Assign');
  });
});
