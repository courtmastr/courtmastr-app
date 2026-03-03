import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import RapidCheckInPanel from '@/features/checkin/components/RapidCheckInPanel.vue';

const PassThroughStub = defineComponent({
  template: '<div><slot /><slot name="prepend" /><slot name="append" /></div>',
});

const VBtnStub = defineComponent({
  emits: ['click'],
  template: '<button @click="$emit(\'click\')"><slot /></button>',
});

const VListItemStub = defineComponent({
  props: {
    title: {
      type: String,
      default: '',
    },
    subtitle: {
      type: String,
      default: '',
    },
  },
  template: `
    <div>
      <div>{{ title }}</div>
      <div>{{ subtitle }}</div>
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

const mountPanel = () => mount(RapidCheckInPanel, {
  props: {
    urgentItems: [],
    recentItems: [],
    searchRows: [],
  },
  global: {
    stubs: {
      VCard: PassThroughStub,
      VBtn: VBtnStub,
      VList: PassThroughStub,
      VListItem: VListItemStub,
      VChip: PassThroughStub,
      VTextField: VTextFieldStub,
    },
  },
});

describe('RapidCheckInPanel', () => {
  it('emits scanSubmit when Enter is pressed in scanner input', async () => {
    const wrapper = mountPanel();

    const input = wrapper.find('[data-testid="scan-input"]');
    await input.setValue('reg:abc123');
    await input.trigger('keydown', { key: 'Enter' });

    expect(wrapper.emitted('scanSubmit')?.[0]).toEqual(['reg:abc123']);
  });

  it('emits undoItem when undo is clicked for recent row', async () => {
    const wrapper = mount(RapidCheckInPanel, {
      props: {
        urgentItems: [],
        recentItems: [
          {
            id: 'reg-1',
            name: 'Tejas M.',
            detail: 'Bib 102 • 10:42 AM',
            canUndo: true,
          },
        ],
      },
      global: {
        stubs: {
          VCard: PassThroughStub,
          VBtn: VBtnStub,
          VList: PassThroughStub,
          VListItem: VListItemStub,
          VChip: PassThroughStub,
          VTextField: VTextFieldStub,
        },
      },
    });

    const undoButton = wrapper.find('[data-testid="recent-undo-btn"]');
    await undoButton.trigger('click');

    expect(wrapper.emitted('undoItem')?.[0]).toEqual(['reg-1']);
  });

  it('shows search suggestions and emits quickCheckIn for a selected match', async () => {
    const wrapper = mount(RapidCheckInPanel, {
      props: {
        urgentItems: [],
        recentItems: [],
        searchRows: [
          {
            id: 'reg-1',
            name: 'Player Alpha',
            category: 'Mega Category Singles',
            status: 'approved',
          },
          {
            id: 'reg-2',
            name: 'Player Beta',
            category: 'Mega Category Singles',
            status: 'checked_in',
          },
        ],
      },
      global: {
        stubs: {
          VCard: PassThroughStub,
          VBtn: VBtnStub,
          VList: PassThroughStub,
          VListItem: VListItemStub,
          VChip: PassThroughStub,
          VTextField: VTextFieldStub,
        },
      },
    });

    const input = wrapper.find('[data-testid="scan-input"]');
    await input.setValue('alpha');

    expect(wrapper.find('[data-testid="rapid-search-results"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Player Alpha');

    const quickButton = wrapper.find('[data-testid="search-suggestion-checkin-btn"]');
    await quickButton.trigger('click');

    expect(wrapper.emitted('quickCheckIn')?.[0]).toEqual(['reg-1']);
  });

  it('shows disabled reason for urgent rows when check-in is blocked', () => {
    const wrapper = mount(RapidCheckInPanel, {
      props: {
        urgentItems: [
          {
            id: 'reg-9',
            title: 'Player Gamma vs Player Delta',
            subtitle: 'Court 2 • Match 15',
            canCheckIn: false,
            disabledReason: 'Waiting for scanner confirmation',
          },
        ],
        recentItems: [],
      },
      global: {
        stubs: {
          VCard: PassThroughStub,
          VBtn: VBtnStub,
          VList: PassThroughStub,
          VListItem: VListItemStub,
          VChip: PassThroughStub,
          VTextField: VTextFieldStub,
        },
      },
    });

    expect(wrapper.text()).toContain('Waiting for scanner confirmation');
  });
});
