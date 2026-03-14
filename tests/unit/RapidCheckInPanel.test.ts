import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import RapidCheckInPanel from '@/features/checkin/components/RapidCheckInPanel.vue';

const PassThroughStub = defineComponent({
  template: '<div><slot /><slot name="prepend" /><slot name="append" /></div>',
});

const VBtnStub = defineComponent({
  props: {
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['click'],
  template: '<button :disabled="disabled" @click="disabled ? undefined : $emit(\'click\')"><slot /></button>',
});

const VListItemStub = defineComponent({
  props: {
    active: {
      type: Boolean,
      default: false,
    },
  },
  template: `
    <div :data-active="active">
      <slot />
      <slot name="append" />
    </div>
  `,
});

const VTextFieldStub = defineComponent({
  name: 'VTextField',
  props: {
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue', 'keydown'],
  template: `
    <input
      v-bind="$attrs"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      @keydown="$emit('keydown', $event)"
    >
  `,
});

const mountPanel = (overrides: Record<string, unknown> = {}) => mount(RapidCheckInPanel, {
  props: {
    urgentItems: [],
    recentItems: [],
    searchRows: [],
    pendingIds: [],
    ...overrides,
  },
  global: {
    stubs: {
      VCard: PassThroughStub,
      VBtn: VBtnStub,
      VList: PassThroughStub,
      VListItem: VListItemStub,
      VListItemTitle: PassThroughStub,
      VListItemSubtitle: PassThroughStub,
      VChip: PassThroughStub,
      VTextField: VTextFieldStub,
    },
  },
});

describe('RapidCheckInPanel', () => {
  it('emits scanSubmit when Enter is pressed and no suggestions are active', async () => {
    const wrapper = mountPanel();
    const input = wrapper.find('[data-testid="scan-input"]');

    await input.setValue('reg:abc123');
    await input.trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('scanSubmit')?.[0]).toEqual(['reg:abc123']);
  });

  it('uses keyboard selection and emits quickCheckIn for active suggestion on Enter', async () => {
    const wrapper = mountPanel({
      searchRows: [
        { id: 'reg-1', name: 'Player Alpha', category: 'Singles', status: 'approved', bibNumber: 101 },
        { id: 'reg-2', name: 'Player Beta', category: 'Singles', status: 'approved', bibNumber: 102 },
      ],
    });

    const input = wrapper.find('[data-testid="scan-input"]');
    await input.setValue('player');
    await input.trigger('keydown', { key: 'ArrowDown' });
    await input.trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('quickCheckIn')?.[0]).toEqual(['reg-2']);
  });

  it('shows collision hint and clears suggestions on Escape', async () => {
    const wrapper = mountPanel({
      searchRows: [
        { id: 'reg-1', name: 'Aanya Karthik', category: 'Mixed Doubles', status: 'approved', bibNumber: 101 },
        { id: 'reg-2', name: 'Aanya Krishnan', category: 'Mixed Doubles', status: 'approved', bibNumber: 102 },
      ],
    });

    const input = wrapper.find('[data-testid="scan-input"]');
    await input.setValue('aanya');

    expect(wrapper.find('[data-testid="rapid-search-collision-hint"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="rapid-search-results"]').exists()).toBe(true);

    await input.trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('[data-testid="rapid-search-results"]').exists()).toBe(false);
  });

  it('emits undoLatestShortcut on Ctrl/Cmd+Z from input', async () => {
    const wrapper = mountPanel();
    const input = wrapper.find('[data-testid="scan-input"]');

    await input.trigger('keydown', { key: 'z', ctrlKey: true });
    await input.trigger('keydown', { key: 'z', metaKey: true });

    expect(wrapper.emitted('undoLatestShortcut')).toHaveLength(2);
  });

  it('blocks quick check-in for rows already pending', async () => {
    const wrapper = mountPanel({
      pendingIds: ['reg-1'],
      searchRows: [
        { id: 'reg-1', name: 'Player Alpha', category: 'Singles', status: 'approved', bibNumber: 101 },
      ],
    });

    const input = wrapper.find('[data-testid="scan-input"]');
    await input.setValue('alpha');

    const quickButton = wrapper.find('[data-testid="search-suggestion-checkin-btn"]');
    await quickButton.trigger('click');

    expect(wrapper.emitted('quickCheckIn')).toBeUndefined();
  });

  it('renders undo countdown copy for recent rows', () => {
    const wrapper = mountPanel({
      recentItems: [
        {
          id: 'reg-1',
          name: 'Tejas M.',
          detail: 'Bib 102 • 10:42 AM',
          canUndo: true,
          undoRemainingMs: 3200,
        },
      ],
    });

    expect(wrapper.text()).toContain('Undo (4s)');
  });
});
