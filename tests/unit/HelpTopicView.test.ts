import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { shallowMount } from '@vue/test-utils';
import HelpTopicView from '@/features/help/views/HelpTopicView.vue';

const runtime = {
  topicSlug: 'score-matches',
  isAuthenticated: false,
  isAdmin: false,
};

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      topicSlug: runtime.topicSlug,
    },
  }),
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: runtime.isAuthenticated,
    isAdmin: runtime.isAdmin,
  }),
}));

const mountView = () => shallowMount(HelpTopicView, {
  global: {
    renderStubDefaultSlot: true,
    stubs: [
      'router-link',
      'v-container',
      'v-row',
      'v-col',
      'v-card',
      'v-card-title',
      'v-card-text',
      'v-alert',
      'v-img',
      'v-dialog',
      'v-chip',
      'v-icon',
      'v-btn',
      'v-divider',
      'v-spacer',
    ],
  },
});

describe('HelpTopicView', () => {
  beforeEach(() => {
    runtime.topicSlug = 'score-matches';
    runtime.isAuthenticated = false;
    runtime.isAdmin = false;
  });

  it('renders public user guidance for a topic', () => {
    const wrapper = mountView();

    expect(wrapper.text()).toContain('Score');
    expect(wrapper.text()).toContain('Before you start');
    expect(wrapper.text()).toContain('Step-by-step');
    expect(wrapper.text()).not.toContain('Source references');
  });

  it('shows source-backed technical notes only to admin users', () => {
    runtime.isAuthenticated = true;
    runtime.isAdmin = true;

    const wrapper = mountView();

    expect(wrapper.text()).toContain('Technical notes');
    expect(wrapper.text()).toContain('Source references');
  });

  it('opens a larger screenshot dialog from a topic screenshot', async () => {
    const wrapper = mountView();

    expect(wrapper.findAll('v-img-stub')).toHaveLength(1);

    await wrapper.get('[data-testid="help-screenshot-open"]').trigger('click');
    await nextTick();

    const dialog = wrapper.get('v-dialog-stub');
    expect(dialog.findAll('v-img-stub')).toHaveLength(1);
    expect(wrapper.text()).toContain('Scoring interface');
  });

  it('renders a safe not-found state for unknown topics', () => {
    runtime.topicSlug = 'missing-topic';

    const wrapper = mountView();

    expect(wrapper.text()).toContain('Help topic not found');
  });
});
