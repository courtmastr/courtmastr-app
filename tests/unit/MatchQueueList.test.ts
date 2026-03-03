import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import MatchQueueList from '@/features/tournaments/components/MatchQueueList.vue';

vi.mock('@/composables/useParticipantResolver', () => ({
  useParticipantResolver: () => ({
    getMatchupString: (match: { participant1Id: string; participant2Id: string }) =>
      `${match.participant1Id} vs ${match.participant2Id}`,
  }),
}));

interface QueueVm {
  sortedMatches: Array<{ id: string; urgency: 'urgent' | 'high' | 'normal' }>;
}

const minutesAgo = (minutes: number): Date => new Date(Date.now() - minutes * 60_000);

describe('MatchQueueList urgency', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-03T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not mark fresh ready matches as urgent', () => {
    const wrapper = shallowMount(MatchQueueList, {
      props: {
        matches: [
          {
            id: 'm-fresh',
            participant1Id: 'reg-1',
            participant2Id: 'reg-2',
            status: 'ready',
            queuedAt: minutesAgo(2),
          },
          {
            id: 'm-waiting',
            participant1Id: 'reg-3',
            participant2Id: 'reg-4',
            status: 'ready',
            queuedAt: minutesAgo(18),
          },
          {
            id: 'm-long',
            participant1Id: 'reg-5',
            participant2Id: 'reg-6',
            status: 'scheduled',
            queuedAt: minutesAgo(20),
          },
        ],
        availableCourts: [{ id: 'court-1', name: 'Court 1', number: 1 }],
        autoAssignEnabled: false,
        autoStartEnabled: false,
      },
      global: {
        stubs: [
          'v-card',
          'v-card-title',
          'v-divider',
          'v-card-text',
          'v-switch',
          'v-list',
          'v-list-item',
          'v-avatar',
          'v-icon',
          'v-chip',
          'v-list-item-title',
          'v-list-item-subtitle',
          'v-btn',
          'v-menu',
          'v-alert',
          'v-spacer',
        ],
      },
    });

    const vm = wrapper.vm as unknown as QueueVm;
    const byId = new Map(vm.sortedMatches.map((match) => [match.id, match.urgency]));

    expect(byId.get('m-fresh')).toBe('normal');
    expect(byId.get('m-waiting')).toBe('urgent');
    expect(byId.get('m-long')).toBe('high');
  });
});
