import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { shallowMount } from '@vue/test-utils';
import HelpCenterView from '@/features/help/views/HelpCenterView.vue';

const mountView = () => shallowMount(HelpCenterView, {
  global: {
    renderStubDefaultSlot: true,
    stubs: [
      'router-link',
      'v-container',
      'v-row',
      'v-col',
      'v-card',
      'v-card-text',
      'v-chip',
      'v-text-field',
      'v-icon',
      'v-btn-toggle',
      'v-btn',
      'HelpTopicCard',
      'HelpRoleFilter',
      'HelpSearchEmptyState',
    ],
  },
});

describe('HelpCenterView', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/help');
  });

  it('renders the help center with searchable topic cards', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as { searchQuery: string };

    expect(wrapper.text()).toContain('CourtMastr Help Center');
    expect(wrapper.findAll('help-topic-card-stub').length).toBeGreaterThan(0);

    vm.searchQuery = 'score';
    await nextTick();

    expect(wrapper.findAll('help-topic-card-stub').length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('score');
  });

  it('shows an empty state when search has no matching topics', async () => {
    const wrapper = mountView();
    const vm = wrapper.vm as unknown as { searchQuery: string };

    vm.searchQuery = 'zzzz-no-topic';
    await nextTick();

    expect(wrapper.find('help-search-empty-state-stub').exists()).toBe(true);
  });
});
