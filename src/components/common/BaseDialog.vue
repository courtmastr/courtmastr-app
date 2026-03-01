<script setup lang="ts">
import { useId } from 'vue';

/**
 * BaseDialog.vue
 * 
 * Standardized dialog wrapper component using Vuetify's v-dialog.
 * Provides consistent modal behavior, styling, and event handling across the application.
 * 
 * @example
 * ```vue
 * <BaseDialog
 *   v-model="isOpen"
 *   title="Confirm Action"
 *   @confirm="handleConfirm"
 *   @cancel="handleCancel"
 * >
 *   <p>Are you sure you want to proceed?</p>
 * </BaseDialog>
 * ```
 */

interface Props {
  /** Controls dialog visibility */
  modelValue: boolean;
  /** Dialog title text */
  title: string;
  /** Maximum width of dialog (CSS value) */
  maxWidth?: string | number;
  /** Prevent closing by clicking outside or pressing ESC */
  persistent?: boolean;
  /** Show loading state on confirm button */
  loading?: boolean;
  /** Show close button in title bar */
  showClose?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  maxWidth: 600,
  persistent: false,
  loading: false,
  showClose: true,
});

const emit = defineEmits<{
  /** Emitted when dialog visibility should change */
  'update:modelValue': [value: boolean];
  /** Emitted when confirm button is clicked */
  'confirm': [];
  /** Emitted when cancel button is clicked or dialog is closed */
  'cancel': [];
}>();

const titleId = useId();

/**
 * Handle dialog close event
 * Emits both update:modelValue and cancel events
 */
function handleClose(): void {
  emit('update:modelValue', false);
  emit('cancel');
}

/**
 * Handle confirm button click
 * Emits confirm event (parent typically closes dialog after handling)
 */
function handleConfirm(): void {
  emit('confirm');
}

/**
 * Handle cancel button click
 * Closes dialog and emits cancel event
 */
function handleCancel(): void {
  handleClose();
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    :max-width="maxWidth"
    :persistent="persistent"
    :aria-labelledby="titleId"
    @update:model-value="(value) => emit('update:modelValue', value)"
  >
    <v-card>
      <!-- Title Section -->
      <v-card-title :id="titleId" class="d-flex align-center justify-space-between">
        <!-- Title Slot Override -->
        <slot name="title">
          {{ title }}
        </slot>

        <!-- Close Button -->
        <v-btn
          v-if="showClose"
          icon="mdi-close"
          variant="text"
          size="small"
          aria-label="Close dialog"
          @click="handleClose"
        />
      </v-card-title>

      <!-- Content Section -->
      <v-card-text>
        <slot />
      </v-card-text>

      <!-- Actions Section -->
      <v-card-actions>
        <slot name="actions">
          <v-spacer />
          <v-btn
            variant="text"
            @click="handleCancel"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :loading="loading"
            @click="handleConfirm"
          >
            Confirm
          </v-btn>
        </slot>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
