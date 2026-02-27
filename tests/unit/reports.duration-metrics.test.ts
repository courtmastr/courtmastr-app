import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DurationMetrics from '@/features/reports/components/DurationMetrics.vue';

const mountComponent = (overrides: Partial<InstanceType<typeof DurationMetrics>['$props']> = {}) =>
  mount(DurationMetrics, {
    props: {
      averageMinutes: 42,
      medianMinutes: 40,
      minMinutes: 30,
      maxMinutes: 55,
      configuredMinutes: 35,
      observedMatchCount: 5,
      excludedMatchCount: 1,
      ...overrides,
    },
    global: {
      stubs: ['v-tooltip', 'v-icon'],
    },
  });

describe('DurationMetrics', () => {
  it('renders minute values and observed/excluded counters', () => {
    const wrapper = mountComponent();
    const text = wrapper.text();

    expect(text).toContain('42 min');
    expect(text).toContain('40 min');
    expect(text).toContain('30 min');
    expect(text).toContain('55 min');
    expect(text).toContain('35 min');
    expect(text).toContain('Observed matches: 5');
    expect(text).toContain('Excluded: 1');
  });

  it('falls back to not-enough-data text for null durations', () => {
    const wrapper = mountComponent({
      averageMinutes: null,
      medianMinutes: null,
      minMinutes: null,
      maxMinutes: null,
      configuredMinutes: null,
      observedMatchCount: 0,
      excludedMatchCount: 0,
    });

    const text = wrapper.text();
    expect(text).toContain('Not enough data yet');
    expect(text).toContain('Observed matches: 0');
    expect(text).toContain('Excluded: 0');
  });
});
