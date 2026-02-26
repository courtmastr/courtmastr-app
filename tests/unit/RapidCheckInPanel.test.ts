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
});
