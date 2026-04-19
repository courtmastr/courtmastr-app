import { describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import PreElimSnapshotSubTab from '@/features/brackets/components/PreElimSnapshotSubTab.vue';
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable.vue';

describe('PreElimSnapshotSubTab', () => {
  it('hides the status column for the pre-elim snapshot table', () => {
    const wrapper = shallowMount(PreElimSnapshotSubTab, {
      props: {
        entries: [],
        tiebreakerResolutions: [],
        bracketParticipantIds: new Set<string>(),
        loading: false,
      },
      global: {
        stubs: {
          'v-icon': true,
        },
      },
    });

    expect(wrapper.findComponent(LeaderboardTable).props('showStatus')).toBe(false);
  });
});
