import { describe, it, expect, vi } from 'vitest';
import { useAsyncOperation } from '@/composables/useAsyncOperation';

describe('useAsyncOperation', () => {
  it('should initialize with null data, false loading, and null error', () => {
    const { data, loading, error } = useAsyncOperation<string>();
    
    expect(data.value).toBeNull();
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('should execute async operation and set data on success', async () => {
    const { data, loading, error, execute } = useAsyncOperation<string>();
    
    const operation = async () => 'test data';
    const result = await execute(operation);
    
    expect(result).toBe('test data');
    expect(data.value).toBe('test data');
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('should set loading to true during execution', async () => {
    const { loading, execute } = useAsyncOperation<string>();
    
    const operation = async () => {
      expect(loading.value).toBe(true);
      return 'data';
    };
    
    await execute(operation);
  });

  it('should handle errors and set error message', async () => {
    const { error, execute } = useAsyncOperation<string>();
    
    const operation = async () => {
      throw new Error('Test error');
    };
    
    try {
      await execute(operation);
    } catch (err) {
      // Expected to throw
    }
    
    expect(error.value).toBe('Test error');
  });

  it('should use custom error message when provided', async () => {
    const { error, execute } = useAsyncOperation<string>();
    
    const operation = async () => {
      throw new Error('Original error');
    };
    
    try {
      await execute(operation, undefined, 'Custom error message');
    } catch (err) {
      // Expected to throw
    }
    
    expect(error.value).toBe('Custom error message');
  });

  it('should call onSuccess callback on successful execution', async () => {
    const { execute } = useAsyncOperation<string>();
    const onSuccess = vi.fn();
    
    const operation = async () => 'success data';
    await execute(operation, { onSuccess });
    
    expect(onSuccess).toHaveBeenCalledWith('success data');
  });

  it('should call onError callback on failure', async () => {
    const { execute } = useAsyncOperation<string>();
    const onError = vi.fn();
    
    const operation = async () => {
      throw new Error('Test error');
    };
    
    try {
      await execute(operation, { onError });
    } catch (err) {
      // Expected to throw
    }
    
    expect(onError).toHaveBeenCalled();
  });

  it('should reset all state to initial values', async () => {
    const { data, loading, error, execute, reset } = useAsyncOperation<string>();
    
    await execute(async () => 'test data');
    expect(data.value).toBe('test data');
    
    reset();
    
    expect(data.value).toBeNull();
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
  });

  it('should handle non-Error thrown values', async () => {
    const { error, execute } = useAsyncOperation<string>();
    
    const operation = async () => {
      throw 'string error';
    };
    
    try {
      await execute(operation);
    } catch (err) {
      // Expected to throw
    }
    
    expect(error.value).toBe('string error');
  });

  it('should support generic types', async () => {
    interface TestData {
      id: number;
      name: string;
    }
    
    const { data, execute } = useAsyncOperation<TestData>();
    
    const operation = async () => ({ id: 1, name: 'Test' });
    await execute(operation);
    
    expect(data.value).toEqual({ id: 1, name: 'Test' });
    expect(data.value?.id).toBe(1);
    expect(data.value?.name).toBe('Test');
  });
});
