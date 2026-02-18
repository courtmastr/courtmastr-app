---
id: UI-002
title: EmptyState Component
category: UI Components
status: Active
created: 2026-02-18
---

# EmptyState Component

Standardized empty state display for lists and data views.

## Purpose

Provides consistent empty state UX across the application:
- Icon + title + optional message
- Optional action button
- Consistent spacing and styling

## Location

`src/components/common/EmptyState.vue`

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `string` | `'mdi-inbox-outline'` | Material Design icon name |
| `title` | `string` | required | Empty state title |
| `message` | `string` | - | Optional descriptive message |
| `action` | `{ label: string; handler: () => void }` | - | Optional action button |
| `color` | `string` | `'grey-lighten-1'` | Icon color |

## Slots

| Slot | Description |
|------|-------------|
| `default` | Additional content below action button |

## Usage Examples

### Basic Empty State
```vue
<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue';
</script>

<template>
  <EmptyState
    title="No categories yet"
    message="Add your first category to get started"
  />
</template>
```

### With Action Button
```vue
<script setup lang="ts">
import { ref } from 'vue';
import EmptyState from '@/components/common/EmptyState.vue';

const showAddDialog = ref(false);

function createTournament() {
  showAddDialog.value = true;
}
</script>

<template>
  <EmptyState
    icon="mdi-folder-open-outline"
    title="No tournaments"
    message="Create your first tournament"
    :action="{ label: 'Create Tournament', handler: createTournament }"
  />
</template>
```

### Custom Icon and Color
```vue
<EmptyState
  icon="mdi-alert-circle"
  title="No results found"
  color="warning"
/>
```

### With Additional Content
```vue
<EmptyState title="No matches scheduled">
  <v-btn variant="text" to="/schedule">
    Go to Schedule
  </v-btn>
</EmptyState>
```

## Migration Guide

Replace inline empty states:
```diff
- <v-card-text class="text-center py-8">
-   <v-icon size="48" color="grey-lighten-1">mdi-folder-open</v-icon>
-   <p class="text-body-2 text-grey mt-2">No items</p>
- </v-card-text>

+ <EmptyState title="No items" />
```

## When to Use

Use EmptyState when:
- A list has no items
- Search returns no results
- A data view has no data
- User needs to take action to populate content

## Related Patterns

- [BaseDialog](./base-dialog.md) - Dialogs that may contain empty states
- [CompactDataTable](../components/common/CompactDataTable.vue) - Tables with built-in empty state support
