import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attemptStaleChunkRecovery,
  beginServiceWorkerControllerRecovery,
  buildRecoveryUrl,
  clearServiceWorkerControllerRecoveryGuard,
  clearStaleChunkRecoveryGuard,
  isStaleChunkError,
} from '@/utils/staleCacheRecovery';

const createStorage = () => {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
};

const createTarget = () => {
  const sessionStorage = createStorage();
  const reload = vi.fn();
  const replace = vi.fn();

  return {
    location: {
      hash: '#panel',
      pathname: '/tournaments/abc',
      reload,
      replace,
      search: '?tab=schedule',
    },
    sessionStorage,
  };
};

describe('staleCacheRecovery', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('matches known stale chunk loader errors', () => {
    expect(isStaleChunkError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isStaleChunkError(new Error('ChunkLoadError: Loading chunk 42 failed.'))).toBe(true);
    expect(isStaleChunkError(new Error('Expected a JavaScript-or-Wasm module script'))).toBe(true);
    expect(isStaleChunkError(new Error('Some other navigation failure'))).toBe(false);
  });

  it('reloads once before redirecting to recovery', () => {
    const target = createTarget();

    expect(attemptStaleChunkRecovery(target)).toBe('reload');
    expect(target.location.reload).toHaveBeenCalledTimes(1);
    expect(target.location.replace).not.toHaveBeenCalled();

    expect(attemptStaleChunkRecovery(target)).toBe('recover');
    expect(target.location.replace).toHaveBeenCalledWith(
      buildRecoveryUrl('/tournaments/abc?tab=schedule#panel')
    );
  });

  it('tracks service worker controller reloads once per session', () => {
    const target = createTarget();

    expect(beginServiceWorkerControllerRecovery(target)).toBe(true);
    expect(beginServiceWorkerControllerRecovery(target)).toBe(false);

    clearServiceWorkerControllerRecoveryGuard(target);
    expect(beginServiceWorkerControllerRecovery(target)).toBe(true);
  });

  it('clears the stale chunk reload guard after a successful route load', () => {
    const target = createTarget();

    attemptStaleChunkRecovery(target);
    clearStaleChunkRecoveryGuard(target);

    expect(attemptStaleChunkRecovery(target)).toBe('reload');
  });
});
