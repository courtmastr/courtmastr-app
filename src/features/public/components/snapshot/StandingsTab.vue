<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import { gsap } from 'gsap';
import type { PlayerStanding } from '@/types';

interface Props {
  standings: PlayerStanding[];
}

const props = defineProps<Props>();

const search = ref('');
const tabRef = ref<HTMLElement | null>(null);
let ctx: ReturnType<typeof gsap.context> | null = null;

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return props.standings;
  return props.standings.filter((e) => e.name.toLowerCase().includes(q));
});

function animateRows() {
  nextTick(() => {
    if (!tabRef.value) return;
    ctx?.revert();
    ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add({ reduce: '(prefers-reduced-motion: reduce)' }, (context) => {
        const { reduce } = (context as unknown as { conditions: { reduce: boolean } }).conditions;
        if (reduce) return;
        gsap.from('.s-row:not(.s-row--head)', {
          x: -14, autoAlpha: 0,
          duration: 0.32,
          ease: 'power2.out',
          stagger: { each: 0.04, from: 'start' },
        });
      });
    }, tabRef.value);
  });
}

watch(() => props.standings, animateRows, { immediate: true });
watch(search, animateRows);
onUnmounted(() => { ctx?.revert(); });
</script>

<template>
  <div ref="tabRef" class="standings-tab">
    <div v-if="standings.length === 0" class="standings-tab__empty">
      <v-icon size="32" color="grey">mdi-podium</v-icon>
      <p>No standings yet</p>
    </div>

    <template v-else>
      <!-- Search -->
      <div class="standings-search">
        <v-icon size="16" color="grey" class="standings-search__icon">mdi-magnify</v-icon>
        <input
          v-model="search"
          class="standings-search__input"
          placeholder="Search player..."
          type="search"
        />
        <button v-if="search" class="standings-search__clear" aria-label="Clear search" @click="search = ''">
          <v-icon size="14">mdi-close</v-icon>
        </button>
      </div>

      <div v-if="filtered.length === 0" class="standings-tab__empty">
        <p>No players match "{{ search }}"</p>
      </div>

      <div class="standings-table">
        <!-- Header -->
        <div class="s-row s-row--head">
          <span class="s-col s-col--rank">#</span>
          <span class="s-col s-col--name">Participant</span>
          <span class="s-col s-col--num">MP</span>
          <span class="s-col s-col--wl">W–L</span>
          <span class="s-col s-col--setwl s-col--desktop">Set W–L</span>
          <span class="s-col s-col--pts s-col--desktop">Pts</span>
          <span class="s-col s-col--diff">+/−</span>
        </div>

        <!-- Rows -->
        <div
          v-for="entry in filtered"
          :key="entry.rank"
          class="s-row"
          :class="{ 's-row--top': entry.rank === 1, 's-row--alt': entry.rank % 2 === 0 }"
        >
          <span class="s-col s-col--rank" :class="{ 's-col--gold': entry.rank === 1, 's-col--silver': entry.rank === 2, 's-col--bronze': entry.rank === 3 }">
            {{ entry.rank }}
          </span>
          <span class="s-col s-col--name s-col--name-val">{{ entry.name }}</span>
          <span class="s-col s-col--num s-col--val">{{ entry.mp }}</span>
          <span class="s-col s-col--wl s-col--val">
            <span class="s-wl-w">{{ entry.wins }}</span>
            <span class="s-wl-sep">–</span>
            <span class="s-wl-l">{{ entry.losses }}</span>
          </span>
          <span class="s-col s-col--setwl s-col--val s-col--desktop">
            <span class="s-wl-w">{{ entry.setWins }}</span>
            <span class="s-wl-sep">/</span>
            <span class="s-wl-l">{{ entry.setLosses }}</span>
          </span>
          <span class="s-col s-col--pts s-col--val s-col--desktop">{{ entry.ptsFor }}/{{ entry.ptsAgainst }}</span>
          <span
            class="s-col s-col--diff s-col--val"
            :class="entry.pointsDiff >= 0 ? 's-pos' : 's-neg'"
          >{{ entry.pointsDiff >= 0 ? `+${entry.pointsDiff}` : entry.pointsDiff }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.standings-tab {
  background: transparent;
  min-height: 200px;
  padding: 12px 8px;
}
.standings-tab__empty {
  text-align: center;
  padding: 40px 16px;
  color: rgba(255,255,255,0.4);
  font-size: 13px;
}

.standings-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px;
  padding: 0 10px;
  margin-bottom: 10px;
  min-height: 48px;
  transition: border-color 0.15s;
}
.standings-search:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
}
.standings-search__icon { flex-shrink: 0; }
.standings-search__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e6edf3;
  font-size: 16px; /* ≥16px prevents iOS auto-zoom on focus */
  min-width: 0;
  padding: 0;
}
.standings-search__input::placeholder { color: rgba(255,255,255,0.3); }
.standings-search__clear {
  background: none;
  border: none;
  padding: 0 4px;
  min-width: 44px;
  min-height: 44px;
  cursor: pointer;
  color: rgba(255,255,255,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  border-radius: 6px;
}
.standings-search__clear:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 1px;
}

.standings-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Row — mobile-first: 5 columns */
.s-row {
  display: grid;
  grid-template-columns: 24px 1fr 28px 52px 40px;
  align-items: center;
  gap: 4px;
  padding: 10px 8px;
  border-radius: 6px;
  background: #161b22;
  min-height: 44px;
}
.s-row--head {
  background: transparent;
  padding: 4px 8px 6px;
  min-height: auto;
  animation: none;
}
.s-row--alt {
  background: #172033;
}
.s-row--top {
  border-left: 3px solid #f0c040;
}

/* Desktop: show extra columns */
@media (min-width: 540px) {
  .s-row {
    grid-template-columns: 24px 1fr 28px 52px 52px 56px 40px;
  }
  .s-col--desktop {
    display: flex;
  }
}

/* Header labels */
.s-row--head .s-col {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: rgba(255,255,255,0.3);
  text-align: right;
}
.s-row--head .s-col--rank,
.s-row--head .s-col--name { text-align: left; }

/* Hide extra columns on mobile */
.s-col--desktop {
  display: none;
}

/* Columns */
.s-col { font-size: 12px; color: rgba(255,255,255,0.55); text-align: right; }
.s-col--rank { text-align: left; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.4); }
.s-col--gold  { color: #f0c040; }
.s-col--silver { color: #b0bec5; }
.s-col--bronze { color: #cd7f32; }
.s-col--name  { text-align: left; }
.s-col--name-val {
  font-size: 12px;
  color: #e6edf3;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.s-col--val { color: rgba(255,255,255,0.75); }

/* W–L inline */
.s-col--wl, .s-col--setwl {
  display: flex;
  align-items: center;
  gap: 2px;
  justify-content: flex-end;
}
.s-wl-w { color: #4caf50; font-weight: 600; }
.s-wl-l { color: #ef5350; font-weight: 600; }
.s-wl-sep { color: rgba(255,255,255,0.25); font-size: 10px; }

/* Pts diff */
.s-pos { color: #4caf50; font-weight: 600; }
.s-neg { color: #ef5350; font-weight: 600; }

/* reduced-motion handled by gsap.matchMedia() in script */
</style>
