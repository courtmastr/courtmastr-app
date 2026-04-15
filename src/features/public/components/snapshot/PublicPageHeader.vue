<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { gsap } from 'gsap';
import type { TournamentSnapshot } from '@/types';

interface Props {
  meta: TournamentSnapshot['meta'];
}

const props = defineProps<Props>();
const headerRef = ref<HTMLElement | null>(null);
let ctx: ReturnType<typeof gsap.context> | null = null;

onMounted(() => {
  if (!headerRef.value) return;
  ctx = gsap.context(() => {
    const mm = gsap.matchMedia();
    mm.add({ reduce: '(prefers-reduced-motion: reduce)' }, (context) => {
      const { reduce } = (context as unknown as { conditions: { reduce: boolean } }).conditions;
      if (reduce) return;

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      // Header slides down
      tl.from('.pub-header', { y: -80, duration: 0.5, ease: 'back.out(1.2)' })
        // Court lines reveal (scaleY from top)
        .from('.court-line', {
          scaleY: 0,
          transformOrigin: 'top center',
          autoAlpha: 0,
          duration: 0.6,
          stagger: 0.12,
        }, '-=0.25')
        .from('.court-net', { scaleX: 0, transformOrigin: 'left center', autoAlpha: 0, duration: 0.5 }, '-=0.3')
        // Text content fades up
        .from('.pub-header__eyebrow', { y: 10, autoAlpha: 0, duration: 0.35 }, '-=0.2')
        .from('.pub-header__title',   { y: 14, autoAlpha: 0, duration: 0.4, ease: 'back.out(1.4)' }, '-=0.2')
        .from('.pub-header__meta',    { y: 8, autoAlpha: 0, duration: 0.3 }, '-=0.15')
        .from('.pub-header__badges',  { y: 6, autoAlpha: 0, duration: 0.3 }, '-=0.15')
        .from('.pub-header__logo',    { scale: 0.6, autoAlpha: 0, duration: 0.4, ease: 'back.out(1.7)' }, '-=0.55');
    });
  }, headerRef.value);
});

onUnmounted(() => {
  ctx?.revert();
});

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (s.getFullYear() !== e.getFullYear()) {
    opts.year = 'numeric';
  }
  const startStr = s.toLocaleDateString('en-US', opts);
  const endStr = e.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
</script>

<template>
  <div ref="headerRef" class="pub-header">
    <!-- Badminton court line decorations -->
    <div class="pub-header__court" aria-hidden="true">
      <div class="court-line court-line--center" />
      <div class="court-line court-line--left" />
      <div class="court-line court-line--right" />
      <div class="court-net" />
    </div>

    <div class="pub-header__inner">
      <div v-if="meta.logoUrl" class="pub-header__logo">
        <img :src="meta.logoUrl" alt="Tournament logo" class="pub-header__logo-img" />
      </div>
      <div class="pub-header__text">
        <div class="pub-header__eyebrow">
          <v-icon size="14" class="mr-1">mdi-badminton</v-icon>
          CourtMastr
        </div>
        <h1 class="pub-header__title">{{ meta.name }}</h1>
        <div class="pub-header__meta">
          <span v-if="meta.startDate && meta.endDate">
            <v-icon size="14" class="mr-1">mdi-calendar</v-icon>
            {{ formatDateRange(meta.startDate, meta.endDate) }}
          </span>
          <span v-if="meta.location" class="ml-3">
            <v-icon size="14" class="mr-1">mdi-map-marker</v-icon>
            {{ meta.location }}
          </span>
        </div>
        <div class="pub-header__badges mt-2">
          <v-chip size="x-small" color="success" variant="flat" class="mr-1">
            <v-icon start size="10">mdi-circle</v-icon>
            Live
          </v-chip>
          <v-chip size="x-small" variant="tonal" color="white">
            Updated {{ timeAgo(meta.pushedAt) }}
          </v-chip>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pub-header {
  background: linear-gradient(135deg, #1d4ed8 0%, #7c3aed 60%, #1d4ed8 100%);
  background-size: 200% 200%;
  /* gradient shimmer stays as CSS — only transforms handled by GSAP */
  animation: gradientShift 8s ease infinite;
  padding: 20px 16px 16px;
  position: relative;
  overflow: hidden;
}
@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50%       { background-position: 100% 50%; }
}

/* ── Court line decorations ──────────────────── */
.pub-header__court {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.court-line {
  position: absolute;
  top: 0; bottom: 0;
  width: 1.5px;
  background: rgba(255,255,255,0.12);
  visibility: hidden; /* GSAP autoAlpha manages visibility */
}
.court-line--center { left: 50%; transform: translateX(-50%); }
.court-line--left   { left: 18%; }
.court-line--right  { right: 18%; }
/* Net — horizontal dotted line in the middle */
.court-net {
  position: absolute;
  left: 0; right: 0;
  top: 50%;
  height: 1.5px;
  background: repeating-linear-gradient(
    90deg,
    rgba(255,255,255,0.25) 0px, rgba(255,255,255,0.25) 6px,
    transparent 6px, transparent 10px
  );
  visibility: hidden; /* GSAP autoAlpha manages visibility */
}

.pub-header__inner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.pub-header__text { /* entrance driven by GSAP */ }
.pub-header__logo-img {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: contain;
  background: rgba(255, 255, 255, 0.15);
  padding: 4px;
}
.pub-header__eyebrow {
  font-size: 11px;
  font-weight: 700;
  color: #f59e0b;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  text-shadow: 0 0 8px rgba(245,158,11,0.4);
}
.pub-header__title {
  font-size: clamp(16px, 5vw, 22px);
  font-weight: 700;
  color: #fff;
  margin: 0 0 4px;
  line-height: 1.2;
  word-break: break-word;
}
.pub-header__meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.pub-header__badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
</style>
