// import.meta.env is Vite-specific; guard for Node.js contexts (seed scripts, tsx).
const _metaEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
const isDev = (_metaEnv.DEV as boolean | undefined) ?? true;
const isInfoEnabled = _metaEnv.VITE_ENABLE_INFO_LOGS === 'true';

export const logger = {
  debug: (...args: unknown[]): void => {
    if (isDev) console.debug(...args);
  },
  info: (...args: unknown[]): void => {
    if (isInfoEnabled) console.info(...args);
  },
  warn: (...args: unknown[]): void => {
    console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    console.error(...args);
  },
};
