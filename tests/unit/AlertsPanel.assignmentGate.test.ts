import { describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import AlertsPanel from '@/features/tournaments/components/AlertsPanel.vue';

vi.mock('@/composables/useMatchDisplay', () => ({
  useMatchDisplay: () => ({
    getMatchDisplayName: (match: { id?: string }) => `Match ${match.id ?? ''}`,
  }),
}));

vi.mock('@/composables/useDurationFormatter', () => ({
  useDurationFormatter: () => ({
    formatDuration: (minutes: number) => `${Math.round(minutes)} min`,
  }),
}));

interface AlertsPanelVm {
  alerts: Array<{
    type: string;
    message: string;
  }>;
  handleAlertClick: (alert: { type: string; message: string }) => void;
}

const mountPanel = () =>
  shallowMount(AlertsPanel, {
    props: {
      courts: [],
      matches: [],
      assignmentGateSummary: {
        blocked: 6,
        blockedByCheckIn: 4,
        blockedBySchedule: 1,
        blockedByPublish: 1,
      },
      getCategoryName: () => 'Category',
    },
    global: {
      stubs: [
        'v-icon',
        'v-chip',
        'v-spacer',
        'v-list',
        'v-list-item',
        'v-list-item-title',
        'v-list-item-subtitle',
        'v-divider',
      ],
    },
  });

describe('AlertsPanel assignment gate alerts', () => {
  it('shows a blocker alert with check-in reason details', () => {
    const wrapper = mountPanel();
    const vm = wrapper.vm as unknown as AlertsPanelVm;

    const blockerAlert = vm.alerts.find((alert) => alert.type === 'assignment_blocked');
    expect(blockerAlert).toBeDefined();
    expect(blockerAlert?.message).toContain('waiting for check-in');
    expect(blockerAlert?.message).toContain('missing planned time');
    expect(blockerAlert?.message).toContain('not published');
  });

  it('emits goToCheckIn when assignment blocker alert is clicked', () => {
    const wrapper = mountPanel();
    const vm = wrapper.vm as unknown as AlertsPanelVm;

    const blockerAlert = vm.alerts.find((alert) => alert.type === 'assignment_blocked');
    expect(blockerAlert).toBeDefined();

    vm.handleAlertClick(blockerAlert!);

    expect(wrapper.emitted('goToCheckIn')).toBeTruthy();
    expect(wrapper.emitted('goToCheckIn')?.length).toBe(1);
  });
});
