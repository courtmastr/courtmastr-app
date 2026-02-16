<script setup lang="ts">
import { computed } from 'vue';
import type { TournamentActivity } from '@/stores/activities';

const props = defineProps<{
  activities: TournamentActivity[];
  maxItems?: number;
  title?: string;
  showTitle?: boolean;
}>();

const displayActivities = computed(() => {
  const max = props.maxItems || 10;
  return props.activities.slice(0, max);
});

function getActivityIcon(type: TournamentActivity['type']): string {
  switch (type) {
    case 'match_completed':
      return 'mdi-trophy';
    case 'match_started':
      return 'mdi-play-circle';
    case 'match_ready':
      return 'mdi-clock-check';
    case 'court_assigned':
      return 'mdi-arrow-right-bold';
    case 'court_maintenance':
      return 'mdi-wrench';
    case 'court_available':
      return 'mdi-check-circle';
    case 'match_reassigned':
      return 'mdi-swap-horizontal';
    case 'bracket_generated':
      return 'mdi-tournament';
    case 'tournament_started':
      return 'mdi-flag-checkered';
    case 'announcement':
      return 'mdi-bullhorn';
    default:
      return 'mdi-information';
  }
}

function getActivityColor(type: TournamentActivity['type']): string {
  switch (type) {
    case 'match_completed':
      return 'success';
    case 'match_started':
      return 'info';
    case 'match_ready':
      return 'warning';
    case 'court_assigned':
      return 'primary';
    case 'court_maintenance':
      return 'error';
    case 'court_available':
      return 'success';
    case 'match_reassigned':
      return 'warning';
    case 'bracket_generated':
      return 'primary';
    case 'tournament_started':
      return 'success';
    case 'announcement':
      return 'info';
    default:
      return 'grey';
  }
}

function formatTime(date: Date): string {
  if (!date) return '';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <v-card>
    <v-card-title v-if="showTitle !== false">
      <v-icon start>
        mdi-timeline-clock
      </v-icon>
      {{ title || 'Activity Feed' }}
    </v-card-title>

    <v-card-text
      v-if="displayActivities.length === 0"
      class="text-center py-6"
    >
      <v-icon
        size="48"
        color="grey-lighten-1"
      >
        mdi-timeline-clock-outline
      </v-icon>
      <p class="text-body-2 text-grey mt-2">
        No activity yet
      </p>
    </v-card-text>

    <v-list
      v-else
      density="compact"
      class="activity-list"
    >
      <v-list-item
        v-for="activity in displayActivities"
        :key="activity.id"
        class="activity-item"
      >
        <template #prepend>
          <v-avatar
            :color="getActivityColor(activity.type)"
            size="32"
            class="mr-3"
          >
            <v-icon
              size="18"
              color="white"
            >
              {{ getActivityIcon(activity.type) }}
            </v-icon>
          </v-avatar>
        </template>

        <v-list-item-title class="text-body-2">
          {{ activity.message }}
        </v-list-item-title>

        <v-list-item-subtitle class="text-caption">
          {{ formatTime(activity.createdAt) }}
          <span
            v-if="activity.details?.categoryName"
            class="ml-2"
          >
            <v-chip
              size="x-small"
              variant="outlined"
            >
              {{ activity.details.categoryName }}
            </v-chip>
          </span>
        </v-list-item-subtitle>
      </v-list-item>
    </v-list>
  </v-card>
</template>

<style scoped>
.activity-list {
  max-height: 400px;
  overflow-y: auto;
}

.activity-item {
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.05);
}

.activity-item:last-child {
  border-bottom: none;
}
</style>
