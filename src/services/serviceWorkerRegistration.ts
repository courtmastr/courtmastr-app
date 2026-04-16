import { logger } from '@/utils/logger';
import {
  beginServiceWorkerControllerRecovery,
  clearServiceWorkerControllerRecoveryGuard,
} from '@/utils/staleCacheRecovery';

const SERVICE_WORKER_URL = '/sw.js';

export const setupServiceWorkerRegistration = (): void => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const hadControllerAtStartup = Boolean(navigator.serviceWorker.controller);

  void (async () => {
    try {
      const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
        scope: '/',
        updateViaCache: 'none',
      });

      const updateRegistration = async (): Promise<void> => {
        try {
          await registration.update();
        } catch (error) {
          logger.warn('Service worker update check failed', error);
        }
      };

      await updateRegistration();

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void updateRegistration();
        }
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadControllerAtStartup) {
          return;
        }

        if (!beginServiceWorkerControllerRecovery()) {
          return;
        }

        logger.warn('Service worker controller changed, reloading current page');
        window.location.reload();
      });

      void navigator.serviceWorker.ready
        .then(() => {
          clearServiceWorkerControllerRecoveryGuard();
        })
        .catch((error) => {
          logger.warn('Service worker readiness check failed', error);
        });
    } catch (error) {
      logger.error('Service worker registration failed', error);
    }
  })();
};
