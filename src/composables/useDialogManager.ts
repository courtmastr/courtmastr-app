import { ref, type Ref } from 'vue';
import { logger } from '@/utils/logger';

export interface DialogManager {
  dialogs: Ref<Record<string, boolean>>;
  open: (name: string) => void;
  close: (name: string) => void;
  toggle: (name: string) => void;
  isOpen: (name: string) => boolean;
}

/**
 * Composable for managing multiple dialog states in a component.
 * Replaces scattered boolean refs with a centralized dialog manager.
 * 
 * @example
 * const { dialogs, open, close } = useDialogManager(['addPlayer', 'editPlayer', 'deleteConfirm']);
 * 
 * // In template:
 * <v-dialog v-model="dialogs.addPlayer">
 * <v-btn @click="open('addPlayer')">Add Player</v-btn>
 * <v-btn @click="close('addPlayer')">Cancel</v-btn>
 */
export function useDialogManager(dialogNames?: string[]): DialogManager {
  // Initialize with provided names or empty object
  const dialogs = ref<Record<string, boolean>>(
    dialogNames 
      ? Object.fromEntries(dialogNames.map(name => [name, false]))
      : {}
  );

  function open(name: string): void {
    if (name in dialogs.value) {
      dialogs.value[name] = true;
    } else {
      logger.warn(`[useDialogManager] Dialog "${name}" not initialized`);
    }
  }

  function close(name: string): void {
    if (name in dialogs.value) {
      dialogs.value[name] = false;
    }
  }

  function toggle(name: string): void {
    if (name in dialogs.value) {
      dialogs.value[name] = !dialogs.value[name];
    }
  }

  function isOpen(name: string): boolean {
    return dialogs.value[name] ?? false;
  }

  return {
    dialogs,
    open,
    close,
    toggle,
    isOpen
  };
}
