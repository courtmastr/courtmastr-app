<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

interface BeforeInstallPromptEvent extends Event {
  prompt(): void;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'cm_a2hs_v1';
const show = ref(false);
const isIOS = ref(false);
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let installHandler: ((e: Event) => void) | null = null;

function dismiss(): void {
  show.value = false;
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* private browsing */ }
}

async function install(): Promise<void> {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') dismiss();
  deferredPrompt = null;
}

onMounted(() => {
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
  } catch { /* private browsing - show anyway */ }

  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone
  ) return;

  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  isIOS.value = iOS;

  if (iOS) {
    timer = setTimeout(() => { show.value = true; }, 4000);
  } else {
    installHandler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      timer = setTimeout(() => { show.value = true; }, 4000);
    };
    window.addEventListener('beforeinstallprompt', installHandler);
  }
});

onUnmounted(() => {
  if (timer) clearTimeout(timer);
  if (installHandler) window.removeEventListener('beforeinstallprompt', installHandler);
});
</script>

<template>
  <Transition name="a2hs">
    <div
      v-if="show"
      class="a2hs-banner"
      role="banner"
      aria-label="Add to home screen suggestion"
    >
      <div class="a2hs-banner__inner">
        <v-icon
          class="a2hs-banner__sport"
          size="20"
        >
          mdi-badminton
        </v-icon>
        <p class="a2hs-banner__msg">
          <template v-if="isIOS">
            Follow live scores - tap
            <v-icon
              size="13"
              class="a2hs-banner__share-icon"
            >
              mdi-export-variant
            </v-icon>
            then <b>Add to Home Screen</b>
          </template>
          <template v-else>
            Add <b>CourtMastr</b> to your home screen for live scores
          </template>
        </p>
        <button
          v-if="!isIOS"
          class="a2hs-banner__btn"
          @click="install"
        >
          Add
        </button>
        <button
          class="a2hs-banner__dismiss"
          aria-label="Dismiss"
          @click="dismiss"
        >
          <v-icon size="14">
            mdi-close
          </v-icon>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.a2hs-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(10, 22, 40, 0.97);
  border-top: 1px solid rgba(59, 130, 246, 0.2);
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.a2hs-banner__inner {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 480px;
  margin: 0 auto;
}

.a2hs-banner__sport {
  color: #3b82f6;
  flex-shrink: 0;
}

.a2hs-banner__msg {
  flex: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
  margin: 0;
}

.a2hs-banner__msg b {
  color: #fff;
  font-weight: 600;
}

.a2hs-banner__share-icon {
  color: #3b82f6 !important;
  vertical-align: middle;
  margin: 0 1px;
}

.a2hs-banner__btn {
  flex-shrink: 0;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  min-height: 36px;
  touch-action: manipulation;
}

.a2hs-banner__btn:active {
  background: #2563eb;
}

.a2hs-banner__dismiss {
  flex-shrink: 0;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  min-width: 36px;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  border-radius: 6px;
  padding: 0;
}

.a2hs-banner__dismiss:active {
  color: rgba(255, 255, 255, 0.7);
}

.a2hs-enter-active {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}
.a2hs-leave-active {
  transition: transform 0.2s ease-in, opacity 0.2s ease-in;
}
.a2hs-enter-from,
.a2hs-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
