<script setup lang="ts">
import type { BracketSnapshot, MatchSnapshot } from '@/types';

interface Props {
  bracket?: BracketSnapshot;
}

defineProps<Props>();

function matchColor(match: MatchSnapshot): string {
  if (match.status === 'completed') return '#4caf50';
  if (match.status === 'in_progress') return '#ff9800';
  return 'rgba(255,255,255,0.15)';
}
</script>

<template>
  <div class="bracket-tab">
    <div v-if="!bracket || bracket.rounds.length === 0" class="bracket-tab__empty">
      <v-icon size="32" color="grey">mdi-tournament</v-icon>
      <p>Bracket not available yet</p>
    </div>

    <div v-else class="bracket-rounds">
      <div
        v-for="round in bracket.rounds"
        :key="round.label"
        class="bracket-round"
      >
        <div class="bracket-round__label">{{ round.label }}</div>
        <div
          v-for="match in round.matches"
          :key="match.id"
          class="bracket-match"
        >
          <div class="bracket-match__accent" :style="{ background: matchColor(match) }" />
          <div class="bracket-match__body">
            <div class="bracket-match__player" :class="{ 'bracket-match__player--winner': match.winnerId === match.player1 }">
              {{ match.player1 }}
            </div>
            <div class="bracket-match__divider" />
            <div class="bracket-match__player" :class="{ 'bracket-match__player--winner': match.winnerId === match.player2 }">
              {{ match.player2 }}
            </div>
            <div v-if="match.time" class="bracket-match__time">{{ match.time }}</div>
            <div v-if="match.score" class="bracket-match__score">{{ match.score }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bracket-tab {
  padding: 12px;
  background: #121212;
  min-height: 200px;
}
.bracket-tab__empty {
  text-align: center;
  padding: 40px 16px;
  color: rgba(255,255,255,0.4);
  font-size: 13px;
}
.bracket-rounds {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.bracket-round__label {
  font-size: 11px;
  font-weight: 700;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}
.bracket-match {
  display: flex;
  background: #1e1e2e;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 6px;
}
.bracket-match__accent {
  width: 3px;
  flex-shrink: 0;
}
.bracket-match__body {
  flex: 1;
  padding: 8px 10px;
}
.bracket-match__player {
  font-size: 13px;
  color: rgba(255,255,255,0.7);
  padding: 2px 0;
}
.bracket-match__player--winner {
  color: #e6edf3;
  font-weight: 600;
}
.bracket-match__divider {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin: 4px 0;
}
.bracket-match__time {
  font-size: 10px;
  color: rgba(255,255,255,0.35);
  margin-top: 4px;
}
.bracket-match__score {
  font-size: 11px;
  color: #4caf50;
  margin-top: 2px;
  font-weight: 600;
}
</style>
