---
id: COMP-001
title: useAsyncOperation Composable
category: Composables
status: Active
created: 2026-02-18
---

# useAsyncOperation Composable

Standardized async operation handling with loading states and error management.

## Purpose

Eliminates boilerplate try/catch/finally patterns in async operations:
- Loading state management
- Error handling
- Success callbacks
- Data storage

## Location

`src/composables/useAsyncOperation.ts`

## API

### State

| Property | Type | Description |
|----------|------|-------------|
| `data` | `Ref<T \| null>` | Operation result |
| `loading` | `Ref<boolean>` | Loading state |
| `error` | `Ref<string \| null>` | Error message |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `execute` | `(operation, callbacks?, errorMessage?) => Promise<T \| null>` | Execute async operation |
| `reset` | `() => void` | Reset all state |

### Interfaces

```typescript
interface AsyncOperationState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface AsyncOperationCallbacks<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}
```

## Usage Examples

### Basic Usage
```typescript
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import type { Match } from '@/types';

const { data, loading, error, execute } = useAsyncOperation<Match[]>();

async function loadMatches() {
  await execute(
    () => matchStore.fetchMatches(tournamentId),
    {
      errorMessage: 'Failed to load matches',
    }
  );
}
```

### With Callbacks
```typescript
const { loading, execute } = useAsyncOperation();

async function saveCategory() {
  await execute(
    () => tournamentStore.saveCategory(categoryData),
    {
      onSuccess: () => {
        notificationStore.showToast('success', 'Category saved');
        closeDialog();
      },
      onError: (err) => {
        notificationStore.showToast('error', err.message);
      },
    }
  );
}
```

### In Template
```vue
<template>
  <v-btn :loading="loading" @click="save">Save</v-btn>
  <v-alert v-if="error" type="error">{{ error }}</v-alert>
  <v-list v-if="data">
    <v-list-item v-for="item in data" :key="item.id">
      {{ item.name }}
    </v-list-item>
  </v-list>
</template>
```

### With Reset
```typescript
const { data, loading, error, execute, reset } = useAsyncOperation();

// Reset when leaving page
onUnmounted(() => {
  reset();
});
```

## Migration Guide

Replace inline async handling:
```diff
- const loading = ref(false);
- const error = ref<string | null>(null);
-
- async function save() {
-   loading.value = true;
-   error.value = null;
-   try {
-     await store.save();
-   } catch (err) {
-     error.value = 'Failed';
-   } finally {
-     loading.value = false;
-   }
- }

+ const { loading, error, execute } = useAsyncOperation();
+
+ async function save() {
+   await execute(() => store.save());
+ }
```

## When to Use

Use useAsyncOperation when:
- Managing async operation state (loading, error, data)
- Need consistent error handling
- Want to eliminate try/catch boilerplate
- Multiple async operations need similar handling

## When NOT to Use

Don't use when:
- Operation doesn't need loading state
- You need custom error recovery logic
- The operation is synchronous
- You need to handle multiple parallel operations (use Promise.all instead)

## Related Patterns

- [useDialogManager](./use-dialog-manager.md) - Manage dialog states during async operations
- [BaseDialog](./base-dialog.md) - Show loading state in dialogs
