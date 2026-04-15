<script setup lang="ts">
import type { TournamentSnapshot } from '@/types';

interface Props {
  meta: TournamentSnapshot['meta'];
}

const props = defineProps<Props>();

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
  <div class="pub-header">
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
  animation: headerSlideDown 0.5s cubic-bezier(0.34, 1.3, 0.64, 1) both,
             gradientShift 8s ease infinite;
  padding: 20px 16px 16px;
  position: relative;
  overflow: hidden;
}
@keyframes gradientShift {
  0%, 100% { background-position: 0% 50%; }
  50%       { background-position: 100% 50%; }
}
@keyframes headerSlideDown {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
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
  animation: courtReveal 0.7s ease both;
}
.court-line--center { left: 50%; transform: translateX(-50%); animation-delay: 0.5s; }
.court-line--left   { left: 18%;  animation-delay: 0.65s; }
.court-line--right  { right: 18%; animation-delay: 0.65s; }
@keyframes courtReveal {
  from { opacity: 0; transform: scaleY(0); transform-origin: top; }
  to   { opacity: 1; transform: scaleY(1); transform-origin: top; }
}
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
  animation: courtReveal 0.6s ease both;
  animation-delay: 0.8s;
}

.pub-header__inner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

/* Content entrance */
.pub-header__text {
  animation: fadeUp 0.5s ease both;
  animation-delay: 0.25s;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
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
