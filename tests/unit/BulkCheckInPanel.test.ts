/* eslint-disable vue/one-component-per-file -- local component stubs keep this test self-contained */
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import BulkCheckInPanel from '@/features/checkin/components/BulkCheckInPanel.vue';

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
  template: '<button :disabled="disabled" v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
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
  emits: ['click'],
  template: `
    <div v-bind="$attrs" @click="$emit('click')">
      <slot name="prepend" />
      <div>{{ title }}</div>
      <div>{{ subtitle }}</div>
      <slot name="append" />
    </div>
  `,
});

const mountPanel = (selectedIds: string[] = []) => mount(BulkCheckInPanel, {
  props: {
    rows: [{ id: 'r1', name: 'Aanya K.', category: 'MD', bibNumber: null }],
    selectedIds,
  },
  global: {
    stubs: {
      VCard: PassThroughStub,
      VList: PassThroughStub,
      VListItem: VListItemStub,
      VBtn: VBtnStub,
      VChip: PassThroughStub,
      VSpacer: PassThroughStub,
      VCheckboxBtn: PassThroughStub,
    },
  },
});

describe('BulkCheckInPanel', () => {
  it('disables bulk check-in button when no rows are selected', () => {
    const wrapper = mountPanel([]);
    const button = wrapper.find('[data-testid="bulk-checkin-btn"]');
    expect(button.attributes('disabled')).toBeDefined();
  });

  it('emits bulkCheckIn when primary action is clicked', async () => {
    const wrapper = mountPanel(['r1']);
    const button = wrapper.find('[data-testid="bulk-checkin-btn"]');
    await button.trigger('click');

    expect(wrapper.emitted('bulkCheckIn')).toHaveLength(1);
  });

  it('styles checked-in rows with checked-in class', () => {
    const wrapper = mount(BulkCheckInPanel, {
      props: {
        rows: [{
          id: 'r1',
          name: 'Tejas M.',
          category: 'MD',
          bibNumber: 102,
          status: 'checked_in',
        }],
        selectedIds: [],
      },
      global: {
        stubs: {
          VCard: PassThroughStub,
          VList: PassThroughStub,
          VListItem: VListItemStub,
          VBtn: VBtnStub,
          VChip: PassThroughStub,
          VSpacer: PassThroughStub,
          VCheckboxBtn: PassThroughStub,
        },
      },
    });

    const row = wrapper.find('[data-testid="bulk-row-r1"]');
    expect(row.classes()).toContain('bulk-checkin-panel__row--checked_in');
  });
});
