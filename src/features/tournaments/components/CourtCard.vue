<script setup lang="ts">
import { computed } from 'vue';
import type { Court, Match } from '@/types';

interface Props {
  court: Court;
  match?: Match;
  participant1Name?: string;
  participant2Name?: string;
  categoryName?: string;
  matchDuration?: number; // in minutes
}

const props = defineProps<Props>();

const emit = defineEmits<{
  assign: [courtId: string];
  score: [matchId: string];
  release: [courtId: string];
}>();

const statusColor = computed(() => {
  switch (props.court.status) {
    case 'in_use':
      return 'success';
    case 'maintenance':
      return 'warning';
    case 'available':
    default:
      return 'grey';
  }
});

const statusLabel = computed(() => {
  switch (props.court.status) {
    case 'in_use':
      return 'In Use';
    case 'maintenance':
      return 'Maintenance';
    case 'available':
    default:
      return 'Available';
  }
});

const matchStatusColor = computed(() => {
  if (!props.match) return 'grey';
  switch (props.match.status) {
    case 'in_progress':
      return 'success';
    case 'ready':
      return 'warning';
    case 'scheduled':
      return 'info';
    default:
      return 'grey';
  }
});

const matchStatusLabel = computed(() => {
  if (!props.match) return 'No Match';
  switch (props.match.status) {
    case 'in_progress':
      return 'Live';
    case 'ready':
      return 'Ready';
    case 'scheduled':
      return 'Scheduled';
    default:
      return props.match.status;
  }
});

const hasMatch = computed(() => !!props.match);

const formattedDuration = computed(() => {
  if (!props.matchDuration || props.matchDuration <= 0) return '';
  const hours = Math.floor(props.matchDuration / 60);
  const minutes = props.matchDuration % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});
</script>

<template>
  <v-card
    :class="['court-card', `court-card--${court.status}`]"
    variant="outlined"
    :color="statusColor"
    density="compact"
  >
    <!-- Header: Court Name & Status -->
    <v-card-item class="pa-2 pb-1">
      <template #prepend>
        <v-icon :color="statusColor" size="20">mdi-badminton</v-icon>
      </template>
      <v-card-title class="text-subtitle-2 font-weight-bold px-0">
        {{ court.name }}
      </v-card-title>
      <template #append>
        <v-chip
          :color="statusColor"
          size="x-small"
          variant="tonal"
          label
        >
          {{ statusLabel }}
        </v-chip>
      </template>
    </v-card-item>

    <!-- Match Info -->
    <v-card-text class="pa-2 pt-0">
      <div v-if="hasMatch" class="match-info">
        <!-- Match Status Badge -->
        <div class="d-flex align-center mb-2">
          <v-chip
            :color="matchStatusColor"
            size="x-small"
            variant="tonal"
            label
            class="mr-2"
          >
            {{ matchStatusLabel }}
          </v-chip>
          <span v-if="matchDuration && matchDuration > 0" class="text-caption text-medium-emphasis">
            {{ formattedDuration }}
          </span>
        </div>

        <!-- Players -->
        <div class="players text-body-2">
          <div class="player-name text-truncate font-weight-medium">
            {{ participant1Name || 'TBD' }}
          </div>
          <div class="vs text-caption text-medium-emphasis my-1">vs</div>
          <div class="player-name text-truncate font-weight-medium">
            {{ participant2Name || 'TBD' }}
          </div>
        </div>

        <!-- Category -->
        <div v-if="categoryName" class="text-caption text-medium-emphasis mt-2 text-truncate">
          {{ categoryName }}
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state text-center py-4">
        <v-icon size="32" color="grey-lighten-1" class="mb-2">mdi-badminton</v-icon>
        <div class="text-caption text-medium-emphasis">No match assigned</div>
      </div>
    </v-card-text>

    <!-- Actions -->
    <v-card-actions class="pa-2 pt-0">
      <template v-if="hasMatch">
        <v-btn
          v-if="match?.status === 'in_progress' || match?.status === 'ready'"
          variant="tonal"
          color="primary"
          size="small"
          block
          prepend-icon="mdi-scoreboard"
          @click="emit('score', match!.id)"
        >
          Score
        </v-btn>
        <v-btn
          v-else-if="match?.status === 'scheduled'"
          variant="tonal"
          color="info"
          size="small"
          block
          prepend-icon="mdi-play"
          @click="emit('score', match!.id)"
        >
          Start
        </v-btn>
      </template>
      <template v-else-if="court.status === 'available'">
        <v-btn
          variant="outlined"
          color="success"
          size="small"
          block
          prepend-icon="mdi-plus"
          @click="emit('assign', court.id)"
        >
          Assign
        </v-btn>
      </template>
      <template v-else-if="court.status === 'in_use' && !hasMatch">
        <v-btn
          variant="outlined"
          color="warning"
          size="small"
          block
          @click="emit('release', court.id)"
        >
          Release
        </v-btn>
      </template>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.court-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
}

.court-card--in_use {
  border-left: 4px solid rgb(var(--v-theme-success));
}

.court-card--available {
  border-left: 4px solid rgb(var(--v-theme-grey));
}

.court-card--maintenance {
  border-left: 4px solid rgb(var(--v-theme-warning));
  opacity: 0.8;
}

.match-info {
  min-height: 100px;
}

.players {
  line-height: 1.3;
}

.player-name {
  max-width: 100%;
}

.vs {
  text-align: center;
}

.empty-state {
  opacity: 0.6;
}
</style>
