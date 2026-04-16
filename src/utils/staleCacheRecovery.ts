const STALE_CHUNK_RELOAD_KEY = 'cm_stale_chunk_reload_v1';
const SW_CONTROLLER_RELOAD_KEY = 'cm_sw_controller_reload_v1';

const STALE_CHUNK_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'chunkloaderror',
  'expected a javascript-or-wasm module script',
  'importing a module script failed',
  'failed to load module script',
];

interface StorageLike {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

interface LocationLike {
  hash: string;
  pathname: string;
  reload(): void;
  replace(url: string): void;
  search: string;
}

interface RecoveryWindowLike {
  location: LocationLike;
  sessionStorage?: StorageLike;
}

const getSessionStorage = (target?: RecoveryWindowLike): StorageLike | undefined => {
  if (target?.sessionStorage) {
    return target.sessionStorage;
  }

  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
};

const getRecoveryWindow = (): RecoveryWindowLike | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window;
};

const getCurrentPath = (target: RecoveryWindowLike): string =>
  `${target.location.pathname}${target.location.search}${target.location.hash}`;

const readGuard = (key: string, target?: RecoveryWindowLike): boolean =>
  getSessionStorage(target)?.getItem(key) === '1';

const writeGuard = (key: string, target?: RecoveryWindowLike): void => {
  getSessionStorage(target)?.setItem(key, '1');
};

const clearGuard = (key: string, target?: RecoveryWindowLike): void => {
  getSessionStorage(target)?.removeItem(key);
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  if (typeof error === 'string') {
    return error.toLowerCase();
  }

  return '';
};

export const buildRecoveryUrl = (returnTo: string): string =>
  `/recover.html?returnTo=${encodeURIComponent(returnTo)}`;

export const isStaleChunkError = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  return STALE_CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

export const attemptStaleChunkRecovery = (target?: RecoveryWindowLike): 'reload' | 'recover' => {
  const recoveryTarget = target ?? getRecoveryWindow();

  if (!recoveryTarget) {
    return 'recover';
  }

  if (readGuard(STALE_CHUNK_RELOAD_KEY, recoveryTarget)) {
    recoveryTarget.location.replace(buildRecoveryUrl(getCurrentPath(recoveryTarget)));
    return 'recover';
  }

  writeGuard(STALE_CHUNK_RELOAD_KEY, recoveryTarget);
  recoveryTarget.location.reload();
  return 'reload';
};

export const clearStaleChunkRecoveryGuard = (target?: RecoveryWindowLike): void => {
  clearGuard(STALE_CHUNK_RELOAD_KEY, target ?? getRecoveryWindow());
};

export const beginServiceWorkerControllerRecovery = (target?: RecoveryWindowLike): boolean => {
  const recoveryTarget = target ?? getRecoveryWindow();

  if (!recoveryTarget) {
    return false;
  }

  if (readGuard(SW_CONTROLLER_RELOAD_KEY, recoveryTarget)) {
    return false;
  }

  writeGuard(SW_CONTROLLER_RELOAD_KEY, recoveryTarget);
  return true;
};

export const clearServiceWorkerControllerRecoveryGuard = (target?: RecoveryWindowLike): void => {
  clearGuard(SW_CONTROLLER_RELOAD_KEY, target ?? getRecoveryWindow());
};

export {
  STALE_CHUNK_RELOAD_KEY,
  SW_CONTROLLER_RELOAD_KEY,
};
