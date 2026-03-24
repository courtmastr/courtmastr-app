import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CategoryProgressPanel from '@/features/tournaments/components/CategoryProgressPanel.vue';
import type { CategoryStageStatus } from '@/composables/useCategoryStageStatus';

const STUB_CARD = { template: '<div><slot /></div>' };

const mockStatuses: CategoryStageStatus[] = [
  {
    categoryId: 'cat1',
    categoryName: "Men's Singles",
    stageLabel: 'R3',
    nextMatchLabel: 'Chen vs Park',
    total: 24,
    completed: 18,
    remaining: 6,
    live: 2,
    upcoming: 4,
    nextRound: 3,
    needsLevelGeneration: false,
  },
  {
    categoryId: 'cat2',
    categoryName: "Women's Doubles",
    stageLabel: 'R1',
    nextMatchLabel: 'Kim/Lee vs Nguyen/Tran',
    total: 16,
    completed: 0,
    remaining: 16,
    live: 0,
    upcoming: 16,
    nextRound: 1,
    needsLevelGeneration: false,
  },
];

describe('CategoryProgressPanel', () => {
  const mountPanel = (statuses = mockStatuses) =>
    mount(CategoryProgressPanel, {
      props: { statuses },
      global: { stubs: { 'v-card': STUB_CARD } },
    });

  it('renders a row for each category', () => {
    const wrapper = mountPanel();
    expect(wrapper.findAll('.cp-row')).toHaveLength(2);
  });

  it('shows category names', () => {
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain("Men's Singles");
    expect(wrapper.text()).toContain("Women's Doubles");
  });

  it('shows completed / total fraction', () => {
    const wrapper = mountPanel();
    expect(wrapper.text()).toContain('18 / 24');
    expect(wrapper.text()).toContain('0 / 16');
  });

  it('sets progress bar width correctly', () => {
    const wrapper = mountPanel();
    const fills = wrapper.findAll('.cp-bar__fill');
    expect(fills[0].attributes('style')).toContain('width: 75%');
    expect(fills[1].attributes('style')).toContain('width: 0%');
  });

  it('renders empty state when no statuses', () => {
    const wrapper = mountPanel([]);
    expect(wrapper.find('.cp-empty').exists()).toBe(true);
    expect(wrapper.findAll('.cp-row')).toHaveLength(0);
  });

  it('handles total=0 without dividing by zero', () => {
    const zeroTotal: CategoryStageStatus = {
      ...mockStatuses[0],
      categoryId: 'cat3',
      total: 0,
      completed: 0,
    };
    const wrapper = mountPanel([zeroTotal]);
    const fill = wrapper.find('.cp-bar__fill');
    expect(fill.attributes('style')).toContain('width: 0%');
  });
});
