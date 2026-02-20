<script setup lang="ts">
import { computed } from 'vue';
import type { Court, Match } from '@/types';
import CourtCard from './CourtCard.vue';

interface Props {
  courts: Court[];
  matches: Match[];
  matchDurations?: Map<string, number>; // matchId -> duration in minutes
  getCategoryName: (id: string) => string;
  readOnly?: boolean; // Pass-through to CourtCard: hides action buttons
}

const props = defineProps<Props>();

const emit = defineEmits<{
  assign: [courtId: string];
  score: [matchId: string];
  release: [courtId: string];
}>();

// Get match assigned to a court
function getMatchForCourt(courtId: string): Match | undefined {
  return props.matches.find(m => 
    m.courtId === courtId && 
    (m.status === 'in_progress' || m.status === 'ready' || m.status === 'scheduled')
  );
}

// Sort courts by number ascending
const sortedCourts = computed(() => {
  return [...props.courts].sort((a, b) => (a.number || 0) - (b.number || 0));
});

// Filter out maintenance courts for display (optional - can be toggled)
const displayCourts = computed(() => sortedCourts.value);

const gridColumns = computed(() => {
  const count = displayCourts.value.length;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 4;
});
</script>

<template>
  <div class="court-grid">
    <div 
      class="court-grid__container"
      :style="{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }"
    >
      <court-card
        v-for="court in displayCourts"
        :key="court.id"
        :court="court"
        :match="getMatchForCourt(court.id)"
        :category-name="getCategoryName(getMatchForCourt(court.id)?.categoryId || '')"
        :match-duration="matchDurations?.get(getMatchForCourt(court.id)?.id || '')"
        :read-only="readOnly"
        @assign="emit('assign', $event)"
        @score="emit('score', $event)"
        @release="emit('release', $event)"
      />
    </div>
    
    <!-- Empty State -->
    <div
      v-if="displayCourts.length === 0"
      class="court-grid__empty text-center pa-8"
    >
      <v-icon
        size="48"
        color="grey-lighten-1"
        class="mb-4"
      >
        mdi-badminton
      </v-icon>
      <div class="text-h6 text-medium-emphasis mb-2">
        No Courts Configured
      </div>
      <div class="text-body-2 text-medium-emphasis">
        Add courts in tournament settings to start managing matches
      </div>
    </div>
  </div>
</template>

<style scoped>
.court-grid {
  height: 100%;
  overflow-y: auto;
}

.court-grid__container {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.court-grid__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  opacity: 0.7;
}

/* Responsive adjustments */
@media (max-width: 960px) {
  .court-grid__container {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

@media (max-width: 600px) {
  .court-grid__container {
    grid-template-columns: 1fr !important;
  }
}
</style>
