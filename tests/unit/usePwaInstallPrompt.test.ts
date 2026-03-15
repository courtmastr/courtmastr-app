import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import {
  PWA_INSTALL_DISMISS_KEY,
  resetPwaInstallPromptForTests,
  usePwaInstallPrompt,
} from '@/composables/usePwaInstallPrompt';

interface MockBeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const Harness = defineComponent({
  setup() {
    return usePwaInstallPrompt();
  },
  template: '<div />',
});

const createPromptEvent = (
  outcome: 'accepted' | 'dismissed' = 'accepted',
): { event: MockBeforeInstallPromptEvent; prompt: ReturnType<typeof vi.fn> } => {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event('beforeinstallprompt') as MockBeforeInstallPromptEvent;

  Object.defineProperties(event, {
    prompt: {
      configurable: true,
      value: prompt,
    },
    userChoice: {
      configurable: true,
      value: Promise.resolve({ outcome, platform: 'web' }),
    },
  });

  return { event, prompt };
};

describe('usePwaInstallPrompt', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetPwaInstallPromptForTests();
  });

  afterEach(() => {
    resetPwaInstallPromptForTests();
    sessionStorage.clear();
  });

  it('captures the deferred install prompt and resolves accepted installs', async () => {
    const wrapper = mount(Harness);
    const { event, prompt } = createPromptEvent('accepted');

    window.dispatchEvent(event);
    await nextTick();

    const vm = wrapper.vm as unknown as {
      canInstall: boolean;
      installApp: () => Promise<boolean>;
    };

    expect(vm.canInstall).toBe(true);
    await expect(vm.installApp()).resolves.toBe(true);
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(vm.canInstall).toBe(false);
  });

  it('persists dismissals across mounts for the current session', async () => {
    const wrapper = mount(Harness);

    window.dispatchEvent(createPromptEvent('dismissed').event);
    await nextTick();

    const vm = wrapper.vm as unknown as {
      canInstall: boolean;
      dismiss: () => void;
    };

    expect(vm.canInstall).toBe(true);
    vm.dismiss();
    await nextTick();

    expect(vm.canInstall).toBe(false);
    expect(sessionStorage.getItem(PWA_INSTALL_DISMISS_KEY)).toBe('1');

    wrapper.unmount();

    const nextWrapper = mount(Harness);
    window.dispatchEvent(createPromptEvent('accepted').event);
    await nextTick();

    const nextVm = nextWrapper.vm as unknown as {
      canInstall: boolean;
    };

    expect(nextVm.canInstall).toBe(false);
  });
});
