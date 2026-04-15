<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { gsap } from 'gsap';
import type { PoolSnapshot, MatchSnapshot } from '@/types';

interface Props {
  pools: PoolSnapshot[];
}

const props = defineProps<Props>();

const tabRef = ref<HTMLElement | null>(null);
let ctx: ReturnType<typeof gsap.context> | null = null;

onMounted(() => {
  if (!tabRef.value) return;
  ctx = gsap.context(() => {
    const mm = gsap.matchMedia();
    mm.add({ reduce: '(prefers-reduced-motion: reduce)' }, (context) => {
      const { reduce } = (context as { conditions: { reduce: boolean } }).conditions;
      if (reduce) return;
      // Pool cards stagger up
      gsap.from('.pool-card', {
        y: 24, autoAlpha: 0, scale: 0.97,
        duration: 0.45,
        ease: 'back.out(1.4)',
        stagger: { each: 0.1, from: 'start' },
      });
    });
  }, tabRef.value);
});

onUnmounted(() => { ctx?.revert(); });

// One accent colour per pool, cycling through a palette
const POOL_COLORS = [
  { accent: '#3b82f6', glow: 'rgba(59,130,246,0.15)', text: '#93c5fd' },   // blue
  { accent: '#8b5cf6', glow: 'rgba(139,92,246,0.15)',  text: '#c4b5fd' },   // violet
  { accent: '#10b981', glow: 'rgba(16,185,129,0.15)',  text: '#6ee7b7' },   // emerald
  { accent: '#f59e0b', glow: 'rgba(245,158,11,0.15)',  text: '#fcd34d' },   // amber
  { accent: '#ef4444', glow: 'rgba(239,68,68,0.15)',   text: '#fca5a5' },   // red
  { accent: '#06b6d4', glow: 'rgba(6,182,212,0.15)',   text: '#67e8f9' },   // cyan
];

interface PoolStanding {
  name: string;
  w: number;
  l: number;
  pd: number;
}

function buildPoolStandings(matches: MatchSnapshot[]): PoolStanding[] {
  const map = new Map<string, PoolStanding>();
  function ensure(name: string) {
    if (!map.has(name)) map.set(name, { name, w: 0, l: 0, pd: 0 });
  }
  for (const m of matches) {
    if (!m.player1 || !m.player2) continue;
    ensure(m.player1);
    ensure(m.player2);
    if (m.status !== 'completed' || !m.score) continue;
    let p1Total = 0, p2Total = 0, p1Sets = 0, p2Sets = 0;
    for (const set of m.score.split(/[,;]/).map((s) => s.trim())) {
      const parts = set.split(/[–-]/).map((x) => parseInt(x.trim(), 10));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        p1Total += parts[0]; p2Total += parts[1];
        if (parts[0] > parts[1]) p1Sets++; else if (parts[1] > parts[0]) p2Sets++;
      }
    }
    const p1 = map.get(m.player1)!;
    const p2 = map.get(m.player2)!;
    if (m.winnerId === m.player1 || p1Sets > p2Sets) { p1.w++; p2.l++; }
    else if (m.winnerId === m.player2 || p2Sets > p1Sets) { p2.w++; p1.l++; }
    p1.pd += p1Total - p2Total;
    p2.pd += p2Total - p1Total;
  }
  return [...map.values()].sort((a, b) => b.w - a.w || b.pd - a.pd);
}

const poolsWithMeta = computed(() =>
  props.pools.map((pool, i) => ({
    ...pool,
    color: POOL_COLORS[i % POOL_COLORS.length],
    standings: buildPoolStandings(pool.matches),
    upcoming: pool.matches.filter((m) => m.status === 'upcoming'),
  }))
);
</script>

<template>
  <div ref="tabRef" class="pools-tab">
    <div v-if="pools.length === 0" class="pools-tab__empty">
      <v-icon size="32" color="grey">mdi-account-group</v-icon>
      <p>No pool data available</p>
    </div>

    <div
      v-for="(pool, pi) in poolsWithMeta"
      :key="pool.label"
      class="pool-card"
      :style="{ '--accent': pool.color.accent, '--glow': pool.color.glow, '--text': pool.color.text, '--delay': `${pi * 60}ms` }"
    >
      <!-- Coloured top bar -->
      <div class="pool-card__bar" />

      <!-- Header -->
      <div class="pool-card__header">
        <div class="pool-card__title-row">
          <span class="pool-card__dot" />
          <span class="pool-card__name">{{ pool.label }}</span>
        </div>
        <span class="pool-card__meta">{{ pool.standings.length }} teams · {{ pool.matches.length }} matches</span>
      </div>

      <!-- Standings -->
      <div v-if="pool.standings.length" class="pool-standings">
        <div class="pool-standings__head">
          <span class="col-r">#</span>
          <span class="col-n">Team</span>
          <span class="col-s">W</span>
          <span class="col-s">L</span>
          <span class="col-s">PD</span>
        </div>
        <div
          v-for="(s, i) in pool.standings"
          :key="s.name"
          class="pool-standings__row"
          :class="{ 'pool-standings__row--leader': i === 0 }"
          :style="{ '--row-delay': `${pi * 60 + i * 40}ms` }"
        >
          <span class="col-r col-r--val" :class="{ 'col-r--leader': i === 0 }">{{ i + 1 }}</span>
          <span class="col-n col-n--val">{{ s.name }}</span>
          <span class="col-s col-s--w">{{ s.w }}</span>
          <span class="col-s col-s--l">{{ s.l }}</span>
          <span class="col-s" :class="s.pd >= 0 ? 'col-s--pos' : 'col-s--neg'">
            {{ s.pd >= 0 ? `+${s.pd}` : s.pd }}
          </span>
        </div>
      </div>

      <!-- Upcoming -->
      <div v-if="pool.upcoming.length" class="pool-upcoming">
        <div class="pool-upcoming__label">
          <v-icon size="10" class="mr-1">mdi-clock-outline</v-icon>Upcoming
        </div>
        <div v-for="m in pool.upcoming" :key="m.id" class="pool-upcoming__row">
          <span class="pool-upcoming__time">{{ m.time ?? '—' }}</span>
          <span class="pool-upcoming__vs">
            {{ m.player1 }}<em> vs </em>{{ m.player2 }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pools-tab {
  padding: 12px;
  background: transparent;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.pools-tab__empty {
  text-align: center;
  padding: 40px 16px;
  color: rgba(255,255,255,0.4);
  font-size: 13px;
}

/* ── Pool card ─────────────────────────── */
.pool-card {
  background: #1e293b;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: 0 0 0 0 var(--glow);
  transition: box-shadow 0.2s, border-color 0.2s;
}
.pool-card:hover {
  border-color: var(--accent);
  box-shadow: 0 0 18px 2px var(--glow);
}

/* Coloured top bar */
.pool-card__bar {
  height: 3px;
  background: var(--accent);
  opacity: 0.9;
}

/* Header */
.pool-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px 6px;
}
.pool-card__title-row {
  display: flex;
  align-items: center;
  gap: 7px;
}
.pool-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px 1px var(--accent);
  flex-shrink: 0;
}
.pool-card__name {
  font-size: 13px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: 0.4px;
}
.pool-card__meta {
  font-size: 10px;
  color: rgba(255,255,255,0.3);
}

/* ── Standings ─────────────────────────── */
.pool-standings {
  padding: 4px 0 6px;
}
.pool-standings__head {
  display: grid;
  grid-template-columns: 22px 1fr 28px 28px 38px;
  gap: 4px;
  padding: 2px 14px 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: rgba(255,255,255,0.25);
}
.pool-standings__row {
  display: grid;
  grid-template-columns: 22px 1fr 28px 28px 38px;
  gap: 4px;
  align-items: center;
  padding: 5px 14px;
  border-radius: 6px;
  margin: 1px 6px;
  transition: background 0.15s;
}
.pool-standings__row:hover {
  background: rgba(255,255,255,0.04);
}
.pool-standings__row--leader {
  background: var(--glow);
}

/* Columns */
.col-r { font-size: 11px; color: rgba(255,255,255,0.3); text-align: center; }
.col-r--val { font-weight: 700; }
.col-r--leader { color: var(--accent); }
.col-n { font-size: 10px; color: rgba(255,255,255,0.3); }
.col-n--val {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255,255,255,0.75);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pool-standings__row--leader .col-n--val {
  color: #e6edf3;
  font-weight: 700;
}
.col-s { font-size: 10px; color: rgba(255,255,255,0.25); text-align: right; }
.col-s--w  { font-size: 12px; color: #4ade80; font-weight: 700; text-align: right; }
.col-s--l  { font-size: 12px; color: #f87171; font-weight: 700; text-align: right; }
.col-s--pos { font-size: 12px; color: #4ade80; font-weight: 600; text-align: right; }
.col-s--neg { font-size: 12px; color: #f87171; font-weight: 600; text-align: right; }

/* ── Upcoming ──────────────────────────── */
.pool-upcoming {
  border-top: 1px solid rgba(255,255,255,0.05);
  padding: 6px 0 8px;
}
.pool-upcoming__label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: rgba(255,255,255,0.22);
  padding: 0 14px 4px;
  display: flex;
  align-items: center;
}
.pool-upcoming__row {
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 4px 14px;
  flex-wrap: wrap;
}
.pool-upcoming__time {
  font-size: 10px;
  color: rgba(255,255,255,0.35);
  white-space: nowrap;
  flex-shrink: 0;
}
.pool-upcoming__vs {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.pool-upcoming__vs em {
  font-style: normal;
  color: rgba(255,255,255,0.25);
  font-size: 10px;
}

/* reduced-motion handled by gsap.matchMedia() in script */
</style>
