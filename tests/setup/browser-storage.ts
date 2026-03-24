import { beforeEach } from 'vitest';

interface MemoryStorage extends Storage {
  clear: () => void;
}

const createMemoryStorage = (): MemoryStorage => {
  const store = new Map<string, string>();

  return {
    get length(): number {
      return store.size;
    },
    clear(): void {
      store.clear();
    },
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    setItem(key: string, value: string): void {
      store.set(key, String(value));
    },
  };
};

const ensureStorage = (name: 'localStorage' | 'sessionStorage'): Storage => {
  const existing = globalThis[name];

  if (
    existing
    && typeof existing.getItem === 'function'
    && typeof existing.setItem === 'function'
    && typeof existing.removeItem === 'function'
    && typeof existing.clear === 'function'
    && typeof existing.key === 'function'
  ) {
    return existing;
  }

  const nextStorage = createMemoryStorage();
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: nextStorage,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, {
      configurable: true,
      writable: true,
      value: nextStorage,
    });
  }

  return nextStorage;
};

const localStorageRef = ensureStorage('localStorage');
const sessionStorageRef = ensureStorage('sessionStorage');

beforeEach(() => {
  localStorageRef.clear();
  sessionStorageRef.clear();
});
