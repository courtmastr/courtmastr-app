import { computed, ref } from 'vue';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWA_INSTALL_DISMISS_KEY = 'courtmastr:pwa-install-dismissed';

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);
const isInstalled = ref(false);
const dismissed = ref(false);

let listenersBound = false;

const readDismissedState = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(PWA_INSTALL_DISMISS_KEY) === '1';
};

const writeDismissedState = (value: boolean): void => {
  if (typeof window === 'undefined') return;

  if (value) {
    window.sessionStorage.setItem(PWA_INSTALL_DISMISS_KEY, '1');
    return;
  }

  window.sessionStorage.removeItem(PWA_INSTALL_DISMISS_KEY);
};

const detectInstalledState = (): boolean => {
  if (typeof window === 'undefined') return false;

  const standaloneMatch = typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  return standaloneMatch || iosStandalone;
};

const handleBeforeInstallPrompt = (event: Event): void => {
  const installEvent = event as BeforeInstallPromptEvent;
  installEvent.preventDefault();
  deferredPrompt.value = installEvent;
  dismissed.value = readDismissedState();
  isInstalled.value = detectInstalledState();
};

const handleAppInstalled = (): void => {
  deferredPrompt.value = null;
  isInstalled.value = true;
  dismissed.value = false;
  writeDismissedState(false);
};

const bindListeners = (): void => {
  if (typeof window === 'undefined' || listenersBound) return;

  dismissed.value = readDismissedState();
  isInstalled.value = detectInstalledState();

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
  window.addEventListener('appinstalled', handleAppInstalled);
  listenersBound = true;
};

const unbindListeners = (): void => {
  if (typeof window === 'undefined' || !listenersBound) return;

  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
  window.removeEventListener('appinstalled', handleAppInstalled);
  listenersBound = false;
};

export const resetPwaInstallPromptForTests = (): void => {
  unbindListeners();
  deferredPrompt.value = null;
  isInstalled.value = false;
  dismissed.value = false;
};

export const usePwaInstallPrompt = () => {
  bindListeners();

  const canInstall = computed(() => (
    deferredPrompt.value !== null
      && dismissed.value === false
      && isInstalled.value === false
  ));

  const dismiss = (): void => {
    dismissed.value = true;
    writeDismissedState(true);
  };

  const installApp = async (): Promise<boolean> => {
    if (!canInstall.value || !deferredPrompt.value) return false;

    const promptEvent = deferredPrompt.value;
    deferredPrompt.value = null;

    await promptEvent.prompt();
    const choice = await promptEvent.userChoice.catch(() => null);
    const accepted = choice?.outcome === 'accepted';

    if (!accepted) {
      dismissed.value = true;
      writeDismissedState(true);
      return false;
    }

    dismissed.value = false;
    writeDismissedState(false);
    return true;
  };

  return {
    canInstall,
    installApp,
    dismiss,
  };
};
