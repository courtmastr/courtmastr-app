---
id: UI-001
title: BaseDialog Component
category: UI Components
status: Active
created: 2026-02-18
---

# BaseDialog Component

Standardized dialog wrapper for consistent dialog behavior across the application.

## Purpose

Replaces inline v-dialog boilerplate with a reusable component that enforces:
- Consistent styling (title, actions, spacing)
- Standard close/confirm behavior
- Loading state support
- Persistent mode support

## Location

`src/components/common/BaseDialog.vue`

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `boolean` | required | Controls dialog visibility (v-model) |
| `title` | `string` | required | Dialog title text |
| `maxWidth` | `string \| number` | `600` | Max width in pixels |
| `persistent` | `boolean` | `false` | Prevents closing on outside click or ESC |
| `loading` | `boolean` | `false` | Shows loading state on confirm button |
| `showClose` | `boolean` | `true` | Shows close icon in title bar |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `update:modelValue` | `boolean` | Emitted when dialog visibility changes |
| `confirm` | - | Emitted when confirm button clicked |
| `cancel` | - | Emitted when dialog closed (cancel/close icon) |

## Slots

| Slot | Description |
|------|-------------|
| `default` | Dialog content (between title and actions) |
| `title` | Override default title rendering |
| `actions` | Override default action buttons |

## Usage Examples

### Basic Usage
```vue
<script setup lang="ts">
import { ref } from 'vue';
import BaseDialog from '@/components/common/BaseDialog.vue';

const showDialog = ref(false);
const loading = ref(false);

async function save() {
  loading.value = true;
  await store.save();
  loading.value = false;
  showDialog.value = false;
}
</script>

<template>
  <v-btn @click="showDialog = true">Open</v-btn>
  
  <BaseDialog
    v-model="showDialog"
    title="Add Category"
    @confirm="save"
    :loading="loading"
  >
    <v-text-field v-model="form.name" label="Name" />
  </BaseDialog>
</template>
```

### Custom Actions
```vue
<BaseDialog v-model="showDialog" title="Confirm Delete">
  <p>Are you sure you want to delete this?</p>
  
  <template #actions>
    <v-spacer />
    <v-btn variant="text" @click="showDialog = false">Cancel</v-btn>
    <v-btn color="error" @click="deleteItem">Delete</v-btn>
  </template>
</BaseDialog>
```

### Persistent Dialog (No Outside Click)
```vue
<BaseDialog
  v-model="showDialog"
  title="Important Action"
  :persistent="true"
>
  <p>This dialog must be explicitly closed.</p>
</BaseDialog>
```

## Migration Guide

Replace inline v-dialog:
```diff
- <v-dialog v-model="showDialog" max-width="600" persistent>
-   <v-card>
-     <v-card-title>Add Item</v-card-title>
-     <v-card-text>...</v-card-text>
-     <v-card-actions>
-       <v-btn @click="showDialog = false">Cancel</v-btn>
-       <v-btn @click="save">Save</v-btn>
-     </v-card-actions>
-   </v-card>
- </v-dialog>

+ <BaseDialog
+   v-model="showDialog"
+   title="Add Item"
+   @confirm="save"
+ >
+   ...
+ </BaseDialog>
```

## Related Patterns

- [useDialogManager](./use-dialog-manager.md) - Manage multiple dialog states
- [EmptyState](./empty-state.md) - Empty state for lists in dialogs
