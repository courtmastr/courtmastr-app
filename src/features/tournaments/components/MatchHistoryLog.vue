<template>
  <v-card>
    <v-card-title class="d-flex align-center justify-space-between">
      <span>Match History</span>
      <v-btn
        icon="mdi-refresh"
        size="small"
        variant="text"
        aria-label="Refresh match history"
        @click="$emit('refresh')"
      />
    </v-card-title>

    <v-card-text>
      <v-timeline
        v-if="events.length > 0"
        side="end"
        density="compact"
      >
        <v-timeline-item
          v-for="event in events"
          :key="event.id"
          :dot-color="getEventColor(event.type)"
          size="small"
        >
          <template #opposite>
            <div class="text-caption">
              {{ formatTime(event.timestamp) }}
            </div>
          </template>

          <v-card variant="tonal">
            <v-card-text class="py-2">
              <div class="d-flex align-center">
                <v-icon
                  :color="getEventColor(event.type)"
                  size="small"
                  class="mr-2"
                >
                  {{ getEventIcon(event.type) }}
                </v-icon>
                <span class="font-weight-medium">{{ event.title }}</span>
              </div>
              <div
                v-if="event.description"
                class="text-caption text-grey mt-1"
              >
                {{ event.description }}
              </div>
            </v-card-text>
          </v-card>
        </v-timeline-item>
      </v-timeline>

      <div
        v-else
        class="text-center text-grey py-4"
      >
        <v-icon
          size="48"
          class="mb-2"
        >
          mdi-history
        </v-icon>
        <div>No events yet</div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { MatchEvent } from '@/types';

defineProps<{
  events: MatchEvent[];
}>();

defineEmits<{
  refresh: [];
}>();

function getEventColor(type: string): string {
  const colors: Record<string, string> = {
    court_assigned: 'primary',
    match_announced: 'purple',
    match_started: 'success',
    match_completed: 'success',
    match_delayed: 'warning',
    walkover: 'error',
  };
  return colors[type] || 'grey';
}

function getEventIcon(type: string): string {
  const icons: Record<string, string> = {
    court_assigned: 'mdi-badminton',
    match_announced: 'mdi-bullhorn',
    match_started: 'mdi-play-circle',
    match_completed: 'mdi-check-circle',
    match_delayed: 'mdi-clock-alert',
    walkover: 'mdi-flag',
  };
  return icons[type] || 'mdi-information';
}

function formatTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>
