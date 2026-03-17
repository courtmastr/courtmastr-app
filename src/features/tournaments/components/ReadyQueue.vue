<script setup lang="ts">
import { computed } from 'vue';
import type { Match, Category } from '@/types';
import { useMatchIdentification } from '@/composables/useMatchIdentification';

interface Props {
  matches: Match[];
  categories: Category[];
  getParticipantName: (id: string | undefined) => string;
  getCategoryName: (id: string) => string;
  selectedMatchKey?: string | null;
  enableAssign?: boolean;
}

const { formatMatchNumber } = useMatchIdentification();

const props = defineProps<Props>();

interface QueueMatchRef {
  matchId: string;
  categoryId: string;
  levelId?: string;
}

const emit = defineEmits<{
  select: [ref: QueueMatchRef];
  assign: [ref: QueueMatchRef];
}>();

// Sort queue by planned time first so released matches return to planned slot.
// Fallback to legacy scheduledTime, then round and match number.
const sortedMatches = computed(() => {
  return [...props.matches]
    .filter(m => m.status === 'ready' || m.status === 'scheduled')
    .sort((a, b) => {
      const aTime = (a.plannedStartAt ?? a.scheduledTime)?.getTime() ?? Number.POSITIVE_INFINITY;
      const bTime = (b.plannedStartAt ?? b.scheduledTime)?.getTime() ?? Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return aTime - bTime;

      if (a.round !== b.round) return a.round - b.round;
      if (a.matchNumber !== b.matchNumber) return a.matchNumber - b.matchNumber;

      return 0;
    });
});

const readyCount = computed(() => 
  props.matches.filter(m => m.status === 'ready').length
);

const scheduledCount = computed(() => 
  props.matches.filter(m => m.status === 'scheduled').length
);

function getMatchPriorityLabel(match: Match): string {
  if (match.round === 1) return 'R1';
  if (match.round <= 3) return `R${match.round}`;
  return `R${match.round}`;
}

function getMatchKey(match: Match): string {
  return `${match.categoryId}-${match.id}`;
}

function isSelected(match: Match): boolean {
  return props.selectedMatchKey === getMatchKey(match);
}
</script>

<template>
  <div class="ready-queue">
    <!-- Header -->
    <div class="ready-queue__header d-flex align-center px-3 py-2 border-b">
      <v-icon
        size="16"
        class="mr-2"
        color="primary"
      >
        mdi-playlist-play
      </v-icon>
      <span class="font-weight-bold" style="font-size:13px;color:#0f172a;">Ready Queue</span>
      <v-spacer />
      <v-chip
        size="x-small"
        variant="tonal"
        color="warning"
        class="mr-1"
      >
        {{ readyCount }} ready
      </v-chip>
      <v-chip
        v-if="scheduledCount > 0"
        size="x-small"
        variant="tonal"
        color="primary"
      >
        {{ scheduledCount }} scheduled
      </v-chip>
    </div>

    <!-- Queue List -->
    <v-list
      density="compact"
      class="ready-queue__list pa-0"
    >
      <template
        v-for="(match, index) in sortedMatches"
        :key="getMatchKey(match)"
      >
        <v-list-item
          :class="['ready-queue__item', { 'ready-queue__item--selected': isSelected(match) }]"
          :active="isSelected(match)"
          @click="emit('select', { matchId: match.id, categoryId: match.categoryId, levelId: match.levelId })"
        >
          <template #prepend>
            <div class="d-flex flex-column align-center mr-3">
              <span class="text-caption font-weight-bold">{{ index + 1 }}</span>
              <v-chip
                size="x-small"
                :color="match.status === 'ready' ? 'warning' : 'info'"
                variant="tonal"
                label
                class="mt-1"
              >
                {{ getMatchPriorityLabel(match) }}
              </v-chip>
            </div>
          </template>

          <v-list-item-title class="text-body-2 font-weight-medium d-flex align-center">
            <v-chip
              size="x-small"
              variant="outlined"
              color="primary"
              class="mr-2"
            >
              {{ formatMatchNumber(match, categories) }}
            </v-chip>
            {{ getParticipantName(match.participant1Id) }}
          </v-list-item-title>
          
          <v-list-item-subtitle class="text-caption">
            vs {{ getParticipantName(match.participant2Id) }}
          </v-list-item-subtitle>
          
          <template #append>
            <div class="d-flex flex-column align-end">
              <span class="text-caption text-medium-emphasis">
                {{ getCategoryName(match.categoryId) }}
              </span>
              <v-btn
                v-if="match.status === 'ready' && props.enableAssign !== false"
                size="x-small"
                variant="tonal"
                color="success"
                class="mt-1"
                prepend-icon="mdi-plus"
                @click.stop="emit('assign', { matchId: match.id, categoryId: match.categoryId, levelId: match.levelId })"
              >
                Assign
              </v-btn>
            </div>
          </template>
        </v-list-item>

        <v-divider v-if="index < sortedMatches.length - 1" />
      </template>
    </v-list>

    <!-- Empty State -->
    <div
      v-if="sortedMatches.length === 0"
      class="ready-queue__empty text-center pa-6"
    >
      <v-icon
        size="40"
        color="grey-lighten-1"
        class="mb-3"
      >
        mdi-playlist-check
      </v-icon>
      <div class="text-body-2 text-medium-emphasis">
        No matches ready
      </div>
      <div class="text-caption text-medium-emphasis mt-1">
        All caught up!
      </div>
    </div>
  </div>
</template>

<style scoped>
.ready-queue {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

.ready-queue__header {
  flex-shrink: 0;
}

.ready-queue__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ready-queue__item {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.ready-queue__item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.ready-queue__item--selected {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.ready-queue__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

@media (prefers-reduced-motion: reduce) {
  .ready-queue__item {
    transition: none;
  }
}
</style>
