<script setup lang="ts">
import { ref, computed } from 'vue';
import type { MatchSnapshot } from '@/types';

interface Props {
  matches: MatchSnapshot[];
}

const props = defineProps<Props>();

const search = ref('');

// Parse date from formatted string like "Apr 15, 10:00 AM" → "Apr 15"
function extractDate(time?: string): string {
  if (!time) return 'Unscheduled';
  const parts = time.split(',');
  return parts[0]?.trim() ?? 'Unscheduled';
}

function extractTime(time?: string): string {
  if (!time) return '';
  const parts = time.split(',');
  return parts[1]?.trim() ?? time;
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.matches;
  return props.matches.filter(
    (m) =>
      m.player1?.toLowerCase().includes(q) ||
      m.player2?.toLowerCase().includes(q) ||
      m.round?.toLowerCase().includes(q) ||
      m.poolLabel?.toLowerCase().includes(q)
  );
});

// Group by date
const groupedByDate = computed(() => {
  const map = new Map<string, MatchSnapshot[]>();
  for (const m of filtered.value) {
    const key = extractDate(m.time);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return [...map.entries()];
});
</script>

<template>
  <div class="schedule-tab">
    <!-- Search -->
    <div class="schedule-search">
      <v-icon size="16" class="schedule-search__icon">mdi-magnify</v-icon>
      <input
        v-model="search"
        class="schedule-search__input"
        placeholder="Search player, round, pool…"
        type="search"
      />
      <button v-if="search" class="schedule-search__clear" aria-label="Clear search" @click="search = ''">
        <v-icon size="14">mdi-close</v-icon>
      </button>
    </div>

    <!-- Empty -->
    <div v-if="matches.length === 0" class="schedule-empty">
      <v-icon size="40" color="grey">mdi-calendar-blank-outline</v-icon>
      <p>No schedule published yet</p>
    </div>
    <div v-else-if="filtered.length === 0" class="schedule-empty">
      <v-icon size="32" color="grey">mdi-account-search</v-icon>
      <p>No matches found for "{{ search }}"</p>
    </div>

    <!-- Date groups -->
    <div v-for="[date, dayMatches] in groupedByDate" :key="date" class="schedule-day">
      <!-- Day header -->
      <div class="schedule-day__header">
        <span class="schedule-day__date">{{ date }}</span>
        <span class="schedule-day__count">{{ dayMatches.length }} match{{ dayMatches.length !== 1 ? 'es' : '' }}</span>
      </div>

      <!-- Match cards -->
      <div
        v-for="(match, mi) in dayMatches"
        :key="match.id"
        class="match-card"
        :class="{
          'match-card--live': match.status === 'in_progress',
          'match-card--done': match.status === 'completed',
          'match-card--tbd': match.isTbd,
        }"
        :style="{ '--mi': mi }"
      >
        <!-- Left accent stripe -->
        <div class="match-card__stripe" />

        <div class="match-card__inner">
          <!-- Top row: time + badges + status -->
          <div class="match-card__meta">
            <span class="match-card__time">
              <v-icon size="11" class="mr-1" style="opacity:0.5">mdi-clock-outline</v-icon>
              {{ extractTime(match.time) }}
            </span>
            <div class="match-card__badges">
              <span v-if="match.court" class="badge badge--court">
                <v-icon size="9" class="mr-1">mdi-map-marker</v-icon>{{ match.court }}
              </span>
              <span v-if="match.poolLabel" class="badge badge--pool">{{ match.poolLabel }}</span>
              <span v-if="match.round && !match.isTbd" class="badge badge--round">{{ match.round }}</span>
              <span v-if="match.isTbd" class="badge badge--tbd">PLACEHOLDER</span>
            </div>
            <!-- Status pill -->
            <span
              v-if="match.status === 'in_progress'"
              class="status-pill status-pill--live"
            >
              <span class="live-dot" />LIVE
            </span>
            <span v-else-if="match.status === 'completed'" class="status-pill status-pill--done">
              <v-icon size="10" class="mr-1">mdi-check</v-icon>DONE
            </span>
          </div>

          <!-- Players row -->
          <div v-if="match.isTbd" class="match-card__tbd-block">
            <v-icon size="18" class="mr-2" style="color:#f59e0b">mdi-help-circle</v-icon>
            <span class="match-card__tbd-title">{{ match.round ?? 'TBD Match' }}</span>
            <span class="match-card__tbd-sub">Matchup to be determined</span>
          </div>
          <div v-else class="match-card__players">
            <span
              class="player"
              :class="{ 'player--winner': match.winnerId === match.player1 }"
            >{{ match.player1 }}</span>
            <span class="vs">VS</span>
            <span
              class="player"
              :class="{ 'player--winner': match.winnerId === match.player2 }"
            >{{ match.player2 }}</span>
          </div>

          <!-- Score -->
          <div v-if="match.score" class="match-card__score">
            {{ match.score }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Container ───────────────────────────────────────── */
.schedule-tab {
  padding: 10px 10px 24px;
  background: transparent;
  min-height: 300px;
}

/* ── Search bar ──────────────────────────────────────── */
.schedule-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 0 12px;
  margin-bottom: 14px;
  min-height: 48px;
  transition: border-color 0.15s;
}
.schedule-search:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
}
.schedule-search__icon { color: rgba(255,255,255,0.35); flex-shrink: 0; }
.schedule-search__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e6edf3;
  font-size: 16px; /* ≥16px prevents iOS auto-zoom on focus */
  min-width: 0;
  padding: 0;
}
.schedule-search__input::placeholder { color: rgba(255,255,255,0.25); }
.schedule-search__clear {
  background: none;
  border: none;
  padding: 0 4px;
  min-width: 44px;
  min-height: 44px;
  cursor: pointer;
  color: rgba(255,255,255,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  border-radius: 6px;
}
.schedule-search__clear:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
}

/* ── Empty state ─────────────────────────────────────── */
.schedule-empty {
  text-align: center;
  padding: 48px 16px;
  color: rgba(255,255,255,0.3);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* ── Day group ───────────────────────────────────────── */
.schedule-day { margin-bottom: 16px; }

.schedule-day__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 6px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  margin-bottom: 8px;
}
.schedule-day__date {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: #3b82f6;
}
.schedule-day__count {
  font-size: 10px;
  color: rgba(255,255,255,0.3);
}

/* ── Match card ──────────────────────────────────────── */
.match-card {
  display: flex;
  border-radius: 10px;
  margin-bottom: 7px;
  overflow: hidden;
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.06);
  transition: border-color 0.15s, transform 0.15s;
  animation: cardBounceIn 0.4s cubic-bezier(0.34, 1.4, 0.64, 1) both;
  animation-delay: calc(var(--mi, 0) * 45ms);
}
.match-card:hover {
  border-color: rgba(255,255,255,0.14);
  transform: translateY(-1px);
}
@keyframes cardBounceIn {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}

.match-card--live {
  border-color: rgba(255,152,0,0.5);
  background: #1a160d;
}
.match-card--done {
  opacity: 0.85;
}
.match-card--tbd {
  background: #16130a;
  border: 1.5px dashed rgba(245,158,11,0.5);
}

/* Accent stripe */
.match-card__stripe {
  width: 4px;
  flex-shrink: 0;
  background: rgba(255,255,255,0.1);
}
.match-card--live .match-card__stripe { background: #ff9800; }
.match-card--done .match-card__stripe { background: #4caf50; }
.match-card--tbd  .match-card__stripe { background: #f59e0b; }

.match-card__inner {
  flex: 1;
  padding: 10px 12px 8px;
}

/* ── Meta row ────────────────────────────────────────── */
.match-card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 7px;
  flex-wrap: wrap;
}
.match-card__time {
  font-size: 10px;
  color: rgba(255,255,255,0.45);
  display: flex;
  align-items: center;
  margin-right: 2px;
}

/* Badges */
.match-card__badges { display: flex; gap: 4px; flex-wrap: wrap; flex: 1; }
.badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  letter-spacing: 0.4px;
  display: flex;
  align-items: center;
}
.badge--pool    { background: rgba(56,139,253,0.18); color: #3b82f6; }
.badge--round   { background: rgba(163,113,247,0.18); color: #a78bfa; }
.badge--court   { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.5); }
.badge--tbd     { background: rgba(245,158,11,0.2); color: #f59e0b; letter-spacing: 0.8px; }

/* Status pills */
.status-pill {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.8px;
  padding: 2px 8px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  margin-left: auto;
}
.status-pill--live {
  background: rgba(255,152,0,0.2);
  color: #ff9800;
  border: 1px solid rgba(255,152,0,0.4);
}
.status-pill--done {
  background: rgba(76,175,80,0.15);
  color: #4caf50;
  border: 1px solid rgba(76,175,80,0.3);
}

/* Live pulsing dot */
.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff9800;
  margin-right: 5px;
  animation: pulse 1.2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.7); }
}

/* ── Players ─────────────────────────────────────────── */
.match-card__players {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.player {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255,255,255,0.65);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player--winner {
  color: #e6edf3;
  font-weight: 700;
}
.vs {
  font-size: 9px;
  font-weight: 800;
  color: rgba(255,255,255,0.2);
  letter-spacing: 1px;
  flex-shrink: 0;
}

/* ── Score ───────────────────────────────────────────── */
.match-card__score {
  font-size: 11px;
  font-weight: 700;
  color: #4caf50;
  letter-spacing: 0.3px;
}

/* ── Reduced motion ─────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .match-card { animation: none; }
}

/* ── TBD block ───────────────────────────────────────── */
.match-card__tbd-block {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 2px;
}
.match-card__tbd-title {
  font-size: 13px;
  font-weight: 800;
  color: #f59e0b;
  letter-spacing: 0.3px;
}
.match-card__tbd-sub {
  font-size: 10px;
  color: rgba(245,158,11,0.55);
  margin-left: 2px;
}
</style>
