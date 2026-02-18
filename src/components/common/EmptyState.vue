<script setup lang="ts">
/**
 * EmptyState Component
 * 
 * Displays an empty state for lists with icon, title, optional message, and optional action.
 * Used when no data is available to display.
 */

interface ActionConfig {
  label: string;
  handler: () => void;
}

interface Props {
  /** Icon name (Material Design Icons) */
  icon?: string;
  /** Title text (required) */
  title: string;
  /** Optional message text */
  message?: string;
  /** Optional action button configuration */
  action?: ActionConfig;
  /** Background color */
  color?: string;
}

withDefaults(defineProps<Props>(), {
  icon: 'mdi-inbox-outline',
  message: undefined,
  action: undefined,
  color: 'grey-lighten-1'
});
</script>

<template>
  <div
    class="empty-state-container"
    :style="{ backgroundColor: `var(--v-${color})` }"
  >
    <div class="empty-state-content">
      <!-- Icon -->
      <v-icon
        :icon="icon"
        size="64"
        class="empty-state-icon"
      />

      <!-- Title -->
      <h2 class="empty-state-title">
        {{ title }}
      </h2>

      <!-- Message -->
      <p
        v-if="message"
        class="empty-state-message"
      >
        {{ message }}
      </p>

      <!-- Action Button -->
      <v-btn
        v-if="action"
        color="primary"
        variant="elevated"
        class="mt-4"
        @click="action.handler"
      >
        {{ action.label }}
      </v-btn>

      <!-- Slot for additional content -->
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty-state-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 2rem;
  border-radius: 8px;
}

.empty-state-content {
  text-align: center;
  max-width: 400px;
}

.empty-state-icon {
  color: rgba(0, 0, 0, 0.38);
  margin-bottom: 1rem;
}

.empty-state-title {
  font-size: 1.25rem;
  font-weight: 500;
  margin: 0 0 0.5rem 0;
  color: rgba(0, 0, 0, 0.87);
}

.empty-state-message {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.6);
  margin: 0.5rem 0 0 0;
  line-height: 1.5;
}
</style>
