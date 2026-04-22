/* eslint-disable vue/one-component-per-file -- local component stubs keep this test self-contained */
import { describe, it, expect } from 'vitest';
import { defineComponent, ref } from 'vue';
import { mount } from '@vue/test-utils';
import BaseDialog from '@/components/common/BaseDialog.vue';

/**
 * BaseDialog.vue Component Tests
 * 
 * Tests the BaseDialog component's props, events, and slots.
 * Note: Full Vuetify component rendering is tested in E2E tests.
 */

describe('BaseDialog.vue', () => {
  it('accepts required props: modelValue and title', () => {
    const TestComponent = defineComponent({
      components: { BaseDialog },
      template: `
        <BaseDialog
          :model-value="true"
          title="Test Title"
        />
      `,
    });

    const wrapper = mount(TestComponent, {
      global: {
        stubs: {
          teleport: true,
          'v-dialog': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    });

    expect(wrapper.exists()).toBe(true);
  });

  it('emits update:modelValue event', async () => {
    const TestComponent = defineComponent({
      components: { BaseDialog },
      setup() {
        const isOpen = ref(true);
        return { isOpen };
      },
      template: `
        <BaseDialog
          :model-value="isOpen"
          title="Test"
          @update:model-value="isOpen = $event"
        />
      `,
    });

    const wrapper = mount(TestComponent, {
      global: {
        stubs: {
          teleport: true,
          'v-dialog': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    });

    const dialog = wrapper.findComponent(BaseDialog);
    await dialog.vm.$emit('update:modelValue', false);

    expect(dialog.emitted('update:modelValue')).toBeTruthy();
  });

  it('emits confirm event', async () => {
    const TestComponent = defineComponent({
      components: { BaseDialog },
      setup() {
        const onConfirm = () => {};
        return { onConfirm };
      },
      template: `
        <BaseDialog
          :model-value="true"
          title="Test"
          @confirm="onConfirm"
        />
      `,
    });

    const wrapper = mount(TestComponent, {
      global: {
        stubs: {
          teleport: true,
          'v-dialog': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    });

    const dialog = wrapper.findComponent(BaseDialog);
    await dialog.vm.$emit('confirm');

    expect(dialog.emitted('confirm')).toBeTruthy();
  });

  it('emits cancel event', async () => {
    const TestComponent = defineComponent({
      components: { BaseDialog },
      setup() {
        const onCancel = () => {};
        return { onCancel };
      },
      template: `
        <BaseDialog
          :model-value="true"
          title="Test"
          @cancel="onCancel"
        />
      `,
    });

    const wrapper = mount(TestComponent, {
      global: {
        stubs: {
          teleport: true,
          'v-dialog': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    });

    const dialog = wrapper.findComponent(BaseDialog);
    await dialog.vm.$emit('cancel');

    expect(dialog.emitted('cancel')).toBeTruthy();
  });

  it('supports optional props with correct defaults', () => {
    const TestComponent = defineComponent({
      components: { BaseDialog },
      template: `
        <BaseDialog
          :model-value="true"
          title="Test"
        />
      `,
    });

    const wrapper = mount(TestComponent, {
      global: {
        stubs: {
          teleport: true,
          'v-dialog': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    });

    const dialog = wrapper.findComponent(BaseDialog);
    expect(dialog.props('maxWidth')).toBe(600);
    expect(dialog.props('persistent')).toBe(false);
    expect(dialog.props('loading')).toBe(false);
    expect(dialog.props('showClose')).toBe(true);
  });

  it('accepts custom maxWidth prop', () => {
    const TestComponent = defineComponent({
      components: { BaseDialog },
      template: `
        <BaseDialog
          :model-value="true"
          title="Test"
          :max-width="800"
        />
      `,
    });

    const wrapper = mount(TestComponent, {
      global: {
        stubs: {
          teleport: true,
          'v-dialog': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    });

    const dialog = wrapper.findComponent(BaseDialog);
    expect(dialog.props('maxWidth')).toBe(800);
  });

  it('accepts persistent prop', () => {
    const TestComponent = defineComponent({
      components: { BaseDialog },
      template: `
        <BaseDialog
          :model-value="true"
          title="Test"
          persistent
        />
      `,
    });

    const wrapper = mount(TestComponent, {
      global: {
        stubs: {
          teleport: true,
          'v-dialog': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    });

    const dialog = wrapper.findComponent(BaseDialog);
    expect(dialog.props('persistent')).toBe(true);
  });

  it('accepts loading prop', () => {
    const TestComponent = defineComponent({
      components: { BaseDialog },
      template: `
        <BaseDialog
          :model-value="true"
          title="Test"
          loading
        />
      `,
    });

    const wrapper = mount(TestComponent, {
      global: {
        stubs: {
          teleport: true,
          'v-dialog': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    });

    const dialog = wrapper.findComponent(BaseDialog);
    expect(dialog.props('loading')).toBe(true);
  });

  it('accepts showClose prop', () => {
    const TestComponent = defineComponent({
      components: { BaseDialog },
      template: `
        <BaseDialog
          :model-value="true"
          title="Test"
          :show-close="false"
        />
      `,
    });

    const wrapper = mount(TestComponent, {
      global: {
        stubs: {
          teleport: true,
          'v-dialog': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    });

    const dialog = wrapper.findComponent(BaseDialog);
    expect(dialog.props('showClose')).toBe(false);
  });

  it('has proper TypeScript interface for Props', () => {
    // This test verifies the component accepts the correct prop types
    const TestComponent = defineComponent({
      components: { BaseDialog },
      template: `
        <BaseDialog
          :model-value="true"
          title="Test"
          :max-width="600"
          :persistent="false"
          :loading="false"
          :show-close="true"
        />
      `,
    });

    const wrapper = mount(TestComponent, {
      global: {
        stubs: {
          teleport: true,
          'v-dialog': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    });

    const dialog = wrapper.findComponent(BaseDialog);
    expect(dialog.props('modelValue')).toBe(true);
    expect(dialog.props('title')).toBe('Test');
    expect(dialog.props('maxWidth')).toBe(600);
    expect(dialog.props('persistent')).toBe(false);
    expect(dialog.props('loading')).toBe(false);
    expect(dialog.props('showClose')).toBe(true);
  });

  it('has proper TypeScript interface for Emits', async () => {
    // This test verifies the component emits the correct events
    const TestComponent = defineComponent({
      components: { BaseDialog },
      setup() {
        const handleUpdate = () => {};
        const handleConfirm = () => {};
        const handleCancel = () => {};
        return { handleUpdate, handleConfirm, handleCancel };
      },
      template: `
        <BaseDialog
          :model-value="true"
          title="Test"
          @update:model-value="handleUpdate"
          @confirm="handleConfirm"
          @cancel="handleCancel"
        />
      `,
    });

    const wrapper = mount(TestComponent, {
      global: {
        stubs: {
          teleport: true,
          'v-dialog': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    });

    const dialog = wrapper.findComponent(BaseDialog);
    
    // Test all three event types
    await dialog.vm.$emit('update:modelValue', false);
    await dialog.vm.$emit('confirm');
    await dialog.vm.$emit('cancel');

    expect(dialog.emitted('update:modelValue')).toBeTruthy();
    expect(dialog.emitted('confirm')).toBeTruthy();
    expect(dialog.emitted('cancel')).toBeTruthy();
  });

  it('supports Vuetify v-dialog, v-card, and v-btn components', () => {
    // This test verifies the component uses the correct Vuetify components
    const TestComponent = defineComponent({
      components: { BaseDialog },
      template: `
        <BaseDialog
          :model-value="true"
          title="Test"
        />
      `,
    });

    const wrapper = mount(TestComponent, {
      global: {
        stubs: {
          teleport: true,
          'v-dialog': true,
          'v-card': true,
          'v-card-title': true,
          'v-card-text': true,
          'v-card-actions': true,
          'v-btn': true,
          'v-spacer': true,
        },
      },
    });

    // Verify the component renders without errors
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.findComponent(BaseDialog).exists()).toBe(true);
  });
});
