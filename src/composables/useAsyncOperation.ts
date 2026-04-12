import { ref, type Ref } from 'vue';
import { logger } from '@/utils/logger';

/**
 * State interface for async operations
 * @template T - The type of data returned by the async operation
 */
export interface AsyncOperationState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Callbacks for async operation execution
 * @template T - The type of data returned by the async operation
 */
export interface AsyncOperationCallbacks<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

/**
 * Composable for managing async operation state (loading, error, data).
 * Provides a reusable pattern for handling async operations with proper error handling.
 * 
 * @template T - The type of data returned by the async operation
 * @returns Object containing reactive state and control functions
 * 
 * @example
 * const { data, loading, error, execute, reset } = useAsyncOperation<Tournament>();
 * 
 * async function fetchTournament(id: string) {
 *   return await tournamentService.getTournament(id);
 * }
 * 
 * await execute(
 *   () => fetchTournament(tournamentId),
 *   {
 *     onSuccess: (tournament) => logger.debug('Loaded:', tournament),
 *     onError: (err) => logger.error('Failed:', err)
 *   },
 *   'Failed to load tournament'
 * );
 */
export function useAsyncOperation<T>() {
  const data = ref<T | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Execute an async operation with automatic state management
   * 
   * @param operation - Async function to execute
   * @param callbacks - Optional success/error callbacks
   * @param errorMessage - Custom error message to display on failure
   * @throws Re-throws the original error after logging
   */
  async function execute(
    operation: () => Promise<T>,
    callbacks?: AsyncOperationCallbacks<T>,
    errorMessage?: string
  ): Promise<T | null> {
    loading.value = true;
    error.value = null;

    try {
      const result = await operation();
      data.value = result;
      
      if (callbacks?.onSuccess) {
        callbacks.onSuccess(result);
      }
      
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      error.value = errorMessage || errorMsg;
      
      logger.error(`[useAsyncOperation] ${error.value}:`, err);
      
      if (callbacks?.onError && err instanceof Error) {
        callbacks.onError(err);
      }
      
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Reset all state to initial values
   */
  function reset(): void {
    data.value = null;
    loading.value = false;
    error.value = null;
  }

  return {
    data: data as Ref<T | null>,
    loading: loading as Ref<boolean>,
    error: error as Ref<string | null>,
    execute,
    reset
  };
}
