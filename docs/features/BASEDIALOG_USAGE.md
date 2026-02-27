# BaseDialog.vue Component Usage Guide

## Overview

`BaseDialog.vue` is a standardized dialog wrapper component that provides consistent modal behavior across the CourtMaster application. It uses Vuetify 3's `v-dialog` component and follows the project's Vue 3 + TypeScript conventions.

## Basic Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import BaseDialog from '@/components/common/BaseDialog.vue';

const isDialogOpen = ref(false);

function handleConfirm() {
  console.log('User confirmed');
  isDialogOpen.value = false;
}

function handleCancel() {
  console.log('User cancelled');
  isDialogOpen.value = false;
}
</script>

<template>
  <div>
    <v-btn @click="isDialogOpen = true">Open Dialog</v-btn>

    <BaseDialog
      v-model="isDialogOpen"
      title="Confirm Action"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    >
      <p>Are you sure you want to proceed?</p>
    </BaseDialog>
  </div>
</template>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `boolean` | Required | Controls dialog visibility (use `v-model`) |
| `title` | `string` | Required | Dialog title text |
| `maxWidth` | `string \| number` | `600` | Maximum width of dialog (CSS value) |
| `persistent` | `boolean` | `false` | Prevent closing by clicking outside or pressing ESC |
| `loading` | `boolean` | `false` | Show loading state on confirm button |
| `showClose` | `boolean` | `true` | Show close button in title bar |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `update:modelValue` | `boolean` | Emitted when dialog visibility should change |
| `confirm` | None | Emitted when confirm button is clicked |
| `cancel` | None | Emitted when cancel button is clicked or dialog is closed |

## Slots

### Default Slot (Content)

The main content area of the dialog.

```vue
<BaseDialog v-model="isOpen" title="Example">
  <p>This is the dialog content</p>
  <v-text-field label="Name" />
</BaseDialog>
```

### Title Slot

Override the default title rendering.

```vue
<BaseDialog v-model="isOpen" title="Default Title">
  <template #title>
    <div class="d-flex align-center gap-2">
      <v-icon>mdi-alert</v-icon>
      <span>Custom Title</span>
    </div>
  </template>
</BaseDialog>
```

### Actions Slot

Override the default action buttons.

```vue
<BaseDialog v-model="isOpen" title="Example">
  <template #actions>
    <v-spacer />
    <v-btn variant="text" @click="isOpen = false">Discard</v-btn>
    <v-btn color="success" variant="elevated" @click="handleSave">Save</v-btn>
  </template>
</BaseDialog>
```

## Advanced Examples

### Confirmation Dialog with Loading State

```vue
<script setup lang="ts">
import { ref } from 'vue';
import BaseDialog from '@/components/common/BaseDialog.vue';

const isOpen = ref(false);
const isLoading = ref(false);

async function handleConfirm() {
  isLoading.value = true;
  try {
    await deleteItem();
    isOpen.value = false;
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <BaseDialog
    v-model="isOpen"
    title="Delete Item"
    :loading="isLoading"
    persistent
    @confirm="handleConfirm"
  >
    <p>This action cannot be undone. Are you sure?</p>
  </BaseDialog>
</template>
```

### Form Dialog with Custom Actions

```vue
<script setup lang="ts">
import { ref } from 'vue';
import BaseDialog from '@/components/common/BaseDialog.vue';

const isOpen = ref(false);
const formData = ref({ name: '', email: '' });

function handleConfirm() {
  // Save form data
  console.log('Saving:', formData.value);
  isOpen.value = false;
}
</script>

<template>
  <BaseDialog
    v-model="isOpen"
    title="Edit Profile"
    @confirm="handleConfirm"
  >
    <v-form>
      <v-text-field
        v-model="formData.name"
        label="Name"
        required
      />
      <v-text-field
        v-model="formData.email"
        label="Email"
        type="email"
        required
      />
    </v-form>

    <template #actions>
      <v-spacer />
      <v-btn variant="text" @click="isOpen = false">Cancel</v-btn>
      <v-btn color="primary" variant="elevated" @click="handleConfirm">
        Save Changes
      </v-btn>
    </template>
  </BaseDialog>
</template>
```

### Custom Width Dialog

```vue
<BaseDialog
  v-model="isOpen"
  title="Large Dialog"
  max-width="900"
>
  <p>This dialog is wider than the default 600px</p>
</BaseDialog>
```

### Dialog Without Close Button

```vue
<BaseDialog
  v-model="isOpen"
  title="Important Notice"
  :show-close="false"
  persistent
>
  <p>User must click a button to close this dialog</p>
</BaseDialog>
```

## TypeScript Support

The component is fully typed with TypeScript. All props and events are properly typed:

```typescript
interface Props {
  modelValue: boolean;
  title: string;
  maxWidth?: string | number;
  persistent?: boolean;
  loading?: boolean;
  showClose?: boolean;
}

// Events are properly typed in defineEmits
```

## Testing

The component includes comprehensive unit tests. Run tests with:

```bash
npm run test -- tests/unit/BaseDialog.test.ts
```

## Best Practices

1. **Always use `v-model`** for the `modelValue` prop
2. **Handle both `confirm` and `cancel` events** to ensure proper cleanup
3. **Use `persistent` prop** for critical confirmations (delete, etc.)
4. **Show loading state** during async operations with the `loading` prop
5. **Provide clear action labels** in custom action slots
6. **Keep dialog content concise** - use scrollable content for long forms

## Integration with Pinia Stores

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useMyStore } from '@/stores/myStore';
import BaseDialog from '@/components/common/BaseDialog.vue';

const store = useMyStore();
const isOpen = computed({
  get: () => store.isDialogOpen,
  set: (value) => store.setDialogOpen(value),
});

async function handleConfirm() {
  await store.saveData();
}
</script>

<template>
  <BaseDialog
    v-model="isOpen"
    title="Save Changes"
    :loading="store.isSaving"
    @confirm="handleConfirm"
  >
    <p>{{ store.dialogMessage }}</p>
  </BaseDialog>
</template>
```

## Accessibility

The component uses Vuetify's built-in accessibility features:
- Proper ARIA labels on buttons
- Keyboard navigation support (ESC to close, unless `persistent`)
- Focus management
- Semantic HTML structure

## Browser Support

Works in all modern browsers supported by Vue 3 and Vuetify 3:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
