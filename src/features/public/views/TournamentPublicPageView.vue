<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { gsap } from 'gsap';
import { usePublicSnapshot } from '@/composables/usePublicSnapshot';
import PublicPageHeader from '@/features/public/components/snapshot/PublicPageHeader.vue';
import CategorySelector from '@/features/public/components/snapshot/CategorySelector.vue';
import ScheduleTab from '@/features/public/components/snapshot/ScheduleTab.vue';
import PoolsTab from '@/features/public/components/snapshot/PoolsTab.vue';
import StandingsTab from '@/features/public/components/snapshot/StandingsTab.vue';
import BracketTab from '@/features/public/components/snapshot/BracketTab.vue';
import AddToHomeScreen from '@/features/public/components/snapshot/AddToHomeScreen.vue';

const route = useRoute();
const router = useRouter();
const { snapshot, loading, error, notFound, loadBySlug } = usePublicSnapshot();

const selectedCategoryId = ref<string>('');
const activeTab = ref(0);
const tabTransitionName = ref('tab-right');
const pageRef = ref<HTMLElement | null>(null);
const indicatorRef = ref<HTMLElement | null>(null);

let ctx: ReturnType<typeof gsap.context> | null = null;
let manifestBlobUrl: string | null = null;

function switchTab(i: number) {
  if (i === 3 && snapshot.value) {
    void router.push({
      name: 'public-bracket',
      params: { tournamentId: snapshot.value.meta.tournamentId },
      query: selectedCategoryId.value ? { category: selectedCategoryId.value } : undefined,
    });
    return;
  }

  tabTransitionName.value = i > activeTab.value ? 'tab-right' : 'tab-left';
  activeTab.value = i;
  // GSAP animate the sliding indicator
  if (indicatorRef.value) {
    gsap.to(indicatorRef.value, {
      x: i * 100 + '%',
      duration: 0.38,
      ease: 'back.out(1.4)',
    });
  }
}

const tabs = [
  { label: 'Schedule', icon: 'mdi-calendar' },
  { label: 'Pools', icon: 'mdi-account-group' },
  { label: 'Standings', icon: 'mdi-podium' },
  { label: 'Bracket', icon: 'mdi-tournament' },
];

const selectedCategory = computed(() =>
  snapshot.value?.categories.find((c) => c.id === selectedCategoryId.value)
);

// Run page-load entrance timeline once snapshot arrives
watch(snapshot, async (val) => {
  if (!val) return;
  await nextTick();
  if (!pageRef.value) return;

  ctx?.revert();
  ctx = gsap.context(() => {
    const mm = gsap.matchMedia();
    mm.add(
      { reduce: '(prefers-reduced-motion: reduce)' },
      (context) => {
        const { reduce } = (context as unknown as { conditions: { reduce: boolean } }).conditions;
        if (reduce) return;

        // Shuttlecock one-shot
        gsap.fromTo('.shuttle-fly',
          { x: -60, y: 0, rotation: -42, autoAlpha: 0 },
          { x: '112vw', y: '-58vh', rotation: 8, autoAlpha: 0,
            duration: 2.2, ease: 'power1.inOut', delay: 0.6,
            keyframes: [
              { autoAlpha: 0.95, duration: 0.13 },
              { x: '48vw', y: '-32vh', rotation: -18, autoAlpha: 0.9, duration: 0.87 },
              { x: '112vw', y: '-58vh', rotation: 8, autoAlpha: 0, duration: 1.2 },
            ],
          },
        );

        // Page entrance sequence
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from('.pub-header',    { y: -24, autoAlpha: 0, duration: 0.45 })
          .from('.cat-selector',  { y: 12, autoAlpha: 0, duration: 0.3 }, '-=0.1')
          .from('.pub-tabs',      { y: 10, autoAlpha: 0, duration: 0.3 }, '-=0.1')
          .from('.tab-pane',      { y: 16, autoAlpha: 0, duration: 0.35 }, '-=0.05')
          .from('.pub-footer',    { autoAlpha: 0, duration: 0.3 }, '-=0.1');
      },
    );
  }, pageRef.value);
}, { once: true });

// Inject a tournament-specific web app manifest so "Add to Home Screen" installs
// this tournament page — not the CourtMastr admin app.
watch(snapshot, (val) => {
  if (!val) return;

  const name = val.meta.name;
  const manifest = {
    name,
    short_name: name.length > 15 ? name.slice(0, 15) : name,
    description: `Live scores and schedule for ${name}`,
    start_url: window.location.pathname,
    scope: '/t/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0a1628',
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };

  if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  manifestBlobUrl = URL.createObjectURL(blob);

  // Replace the site-wide manifest so the install prompt uses tournament details
  document.querySelector('link[rel="manifest"]')?.remove();
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = manifestBlobUrl;
  document.head.appendChild(link);

  // iOS Safari uses document.title as the home screen app label
  document.title = name;
}, { once: true });

onMounted(async () => {
  const slug = route.params.slug as string;
  await loadBySlug(slug);
  if (snapshot.value?.categories.length) {
    selectedCategoryId.value = snapshot.value.categories[0].id;
  }
});

onUnmounted(() => {
  ctx?.revert();
  if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
});
</script>

<template>
  <div
    ref="pageRef"
    class="pub-page"
  >
    <!-- Loading -->
    <div
      v-if="loading"
      class="pub-page__state"
    >
      <v-progress-circular
        indeterminate
        color="primary"
        size="40"
      />
      <p class="mt-3">
        Loading tournament...
      </p>
    </div>

    <!-- Not found / not published -->
    <div
      v-else-if="notFound"
      class="pub-page__state"
    >
      <v-icon
        size="56"
        color="grey"
      >
        mdi-calendar-remove
      </v-icon>
      <h2 class="pub-page__state-title">
        Not published yet
      </h2>
      <p class="pub-page__state-sub">
        The organizer hasn't published this tournament's schedule yet. Check back soon.
      </p>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="pub-page__state"
    >
      <v-icon
        size="56"
        color="error"
      >
        mdi-alert-circle
      </v-icon>
      <h2 class="pub-page__state-title">
        Couldn't load tournament
      </h2>
      <p class="pub-page__state-sub">
        {{ error }}
      </p>
    </div>

    <!-- Content -->
    <template v-else-if="snapshot">
      <!-- Shuttlecock fly-through on load -->
      <div
        class="shuttle-fly"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 40"
          width="30"
          height="50"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse
            cx="12"
            cy="36"
            rx="5.5"
            ry="3.8"
            fill="white"
            opacity="0.95"
          />
          <ellipse
            cx="12"
            cy="33.5"
            rx="5.5"
            ry="2.8"
            fill="white"
            opacity="0.65"
          />
          <path
            d="M6.5,32 L9.5,11 L14.5,11 L17.5,32 Z"
            fill="rgba(255,255,255,0.2)"
            stroke="rgba(255,255,255,0.5)"
            stroke-width="0.5"
          />
          <line
            x1="12"
            y1="11"
            x2="3"
            y2="1"
            stroke="white"
            stroke-width="0.9"
            opacity="0.9"
          />
          <line
            x1="12"
            y1="11"
            x2="7"
            y2="-0.5"
            stroke="white"
            stroke-width="0.9"
            opacity="0.9"
          />
          <line
            x1="12"
            y1="11"
            x2="12"
            y2="-1.5"
            stroke="white"
            stroke-width="0.9"
            opacity="0.9"
          />
          <line
            x1="12"
            y1="11"
            x2="17"
            y2="-0.5"
            stroke="white"
            stroke-width="0.9"
            opacity="0.9"
          />
          <line
            x1="12"
            y1="11"
            x2="21"
            y2="1"
            stroke="white"
            stroke-width="0.9"
            opacity="0.9"
          />
          <path
            d="M3,1 Q12,-4 21,1"
            stroke="rgba(255,255,255,0.7)"
            stroke-width="0.9"
            fill="rgba(255,255,255,0.07)"
          />
        </svg>
      </div>

      <PublicPageHeader :meta="snapshot.meta" />

      <CategorySelector
        v-if="snapshot.categories.length > 1"
        v-model="selectedCategoryId"
        :categories="snapshot.categories"
      />

      <!-- Tab bar -->
      <div class="pub-tabs">
        <button
          v-for="(tab, i) in tabs"
          :key="tab.label"
          class="pub-tab"
          :class="{ 'pub-tab--active': activeTab === i }"
          @click="switchTab(i)"
        >
          <v-icon size="18">
            {{ tab.icon }}
          </v-icon>
          <span>{{ tab.label }}</span>
        </button>
        <div
          ref="indicatorRef"
          class="pub-tab__indicator"
        />
      </div>

      <!-- Tab content -->
      <template v-if="selectedCategory">
        <Transition
          :name="tabTransitionName"
          mode="out-in"
        >
          <div
            :key="activeTab"
            class="tab-pane"
          >
            <ScheduleTab
              v-if="activeTab === 0"
              :matches="selectedCategory.schedule"
            />
            <PoolsTab
              v-else-if="activeTab === 1"
              :pools="selectedCategory.pools"
            />
            <StandingsTab
              v-else-if="activeTab === 2"
              :standings="selectedCategory.standings"
            />
            <BracketTab
              v-else-if="activeTab === 3"
              :bracket="selectedCategory.bracket"
            />
          </div>
        </Transition>
      </template>
      <div
        v-else
        class="pub-page__state"
      >
        <v-icon
          size="32"
          color="grey"
        >
          mdi-information
        </v-icon>
        <p>Select a division above</p>
      </div>

      <AddToHomeScreen />

      <!-- Footer -->
      <footer class="pub-footer">
        <v-icon
          size="13"
          class="mr-1"
          style="color:#3b82f6"
        >
          mdi-badminton
        </v-icon>
        Powered by <strong>CourtMastr</strong>
      </footer>
    </template>
  </div>
</template>

<style scoped>
/* ── Page ──────────────────────────────────────── */
.pub-page {
  background-color: #0f172a;
  min-height: 100dvh;
  color: #f8fafc;
  overflow-x: hidden;
  /* subtle court-line grid in background */
  background-image:
    repeating-linear-gradient(0deg,   transparent, transparent 79px, rgba(255,255,255,0.02) 79px, rgba(255,255,255,0.02) 80px),
    repeating-linear-gradient(90deg,  transparent, transparent 79px, rgba(255,255,255,0.02) 79px, rgba(255,255,255,0.02) 80px);
}

/* ── Empty / error states ──────────────────────── */
.pub-page__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 24px 16px;
  text-align: center;
  color: rgba(255,255,255,0.5);
}
.pub-page__state-title {
  font-size: 18px;
  font-weight: 600;
  color: #e6edf3;
  margin: 12px 0 6px;
}
.pub-page__state-sub {
  font-size: 13px;
  color: rgba(255,255,255,0.5);
  max-width: 280px;
}

/* ── Tab bar ───────────────────────────────────── */
.pub-tabs {
  display: flex;
  background: #1e293b;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  position: sticky;
  top: 0;
  z-index: 10;
}
.pub-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 4px;
  min-height: 56px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,0.38);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease;
  touch-action: manipulation;
  position: relative;
}
.pub-tab:active {
  background: rgba(255,255,255,0.04);
}
.pub-tab--active {
  color: #3b82f6;
}
.pub-tab:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: -3px;
  border-radius: 4px;
}
.pub-tab--active .v-icon {
  filter: drop-shadow(0 0 5px rgba(59,130,246,0.6));
}

/* Sliding indicator — child of .pub-tabs, spans 25%; position driven by GSAP */
.pub-tab__indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 25%;
  height: 3px;
  background: linear-gradient(90deg, #3b82f6 0%, #f59e0b 100%);
  border-radius: 2px 2px 0 0;
  box-shadow: 0 0 10px 1px rgba(59,130,246,0.5);
  pointer-events: none;
}

/* ── Tab content transitions ───────────────────── */
.tab-pane { min-height: 200px; }

.tab-right-enter-active { transition: opacity 0.2s ease, transform 0.22s ease; }
.tab-right-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.tab-right-enter-from   { opacity: 0; transform: translateX(28px); }
.tab-right-leave-to     { opacity: 0; transform: translateX(-28px); }

.tab-left-enter-active  { transition: opacity 0.2s ease, transform 0.22s ease; }
.tab-left-leave-active  { transition: opacity 0.15s ease, transform 0.15s ease; }
.tab-left-enter-from    { opacity: 0; transform: translateX(-28px); }
.tab-left-leave-to      { opacity: 0; transform: translateX(28px); }

/* ── Shuttlecock fly-through — position/opacity driven by GSAP ── */
.shuttle-fly {
  position: fixed;
  bottom: 28vh;
  left: -60px;
  pointer-events: none;
  z-index: 9999;
  visibility: hidden; /* GSAP autoAlpha will unhide it */
  filter: drop-shadow(0 0 10px rgba(88,166,255,0.5));
}

/* ── Footer ────────────────────────────────────── */
.pub-footer {
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 20px 16px;
  text-align: center;
  font-size: 11px;
  color: rgba(255,255,255,0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.3px;
}
.pub-footer strong {
  color: #3b82f6;
  font-weight: 700;
  margin-left: 3px;
}

/* ── Reduced-motion: Vue transitions still respect this ──────── */
@media (prefers-reduced-motion: reduce) {
  .tab-right-enter-active,
  .tab-right-leave-active,
  .tab-left-enter-active,
  .tab-left-leave-active  { transition: none; }
}
</style>
