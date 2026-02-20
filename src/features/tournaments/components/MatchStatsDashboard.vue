<template>
  <v-row>
    <!-- Completion Percentage -->
    <v-col
      cols="6"
      md="3"
    >
      <v-card
        variant="tonal"
        color="primary"
      >
        <v-card-text class="text-center">
          <v-icon
            size="36"
            class="mb-2"
          >
            mdi-chart-pie
          </v-icon>
          <div class="text-h4">
            {{ stats.completionPercentage }}%
          </div>
          <div class="text-caption">
            Completion
          </div>
        </v-card-text>
      </v-card>
    </v-col>

    <!-- Average Duration -->
    <v-col
      cols="6"
      md="3"
    >
      <v-card
        variant="tonal"
        color="info"
      >
        <v-card-text class="text-center">
          <v-icon
            size="36"
            class="mb-2"
          >
            mdi-clock-outline
          </v-icon>
          <div class="text-h4">
            {{ stats.avgDuration }}m
          </div>
          <div class="text-caption">
            Avg Duration
          </div>
        </v-card-text>
      </v-card>
    </v-col>

    <!-- Court Utilization -->
    <v-col
      cols="6"
      md="3"
    >
      <v-card
        variant="tonal"
        color="success"
      >
        <v-card-text class="text-center">
          <v-icon
            size="36"
            class="mb-2"
          >
            mdi-stadium
          </v-icon>
          <div class="text-h4">
            {{ stats.courtUtilization }}%
          </div>
          <div class="text-caption">
            Court Utilization
          </div>
        </v-card-text>
      </v-card>
    </v-col>

    <!-- Time Remaining -->
    <v-col
      cols="6"
      md="3"
    >
      <v-card
        variant="tonal"
        color="warning"
      >
        <v-card-text class="text-center">
          <v-icon
            size="36"
            class="mb-2"
          >
            mdi-timer-sand
          </v-icon>
          <div class="text-h4">
            {{ stats.estimatedTimeRemaining }}
          </div>
          <div class="text-caption">
            Est. Time Remaining
          </div>
        </v-card-text>
      </v-card>
    </v-col>

    <!-- Recent Completions -->
    <v-col
      cols="12"
      md="6"
    >
      <v-card>
        <v-card-title>Recent Completions</v-card-title>
        <v-list v-if="stats.recentCompletions.length > 0">
          <v-list-item
            v-for="match in stats.recentCompletions"
            :key="match.id"
            :subtitle="`${match.score || 'N/A'} • ${formatTime(match.completedAt)}`"
          >
            <v-list-item-title>
              {{ getMatchDisplayName(match) }}
            </v-list-item-title>
          </v-list-item>
        </v-list>
        <v-card-text
          v-else
          class="text-center text-grey"
        >
          No completed matches yet
        </v-card-text>
      </v-card>
    </v-col>

    <!-- Queue Stats -->
    <v-col
      cols="12"
      md="6"
    >
      <v-card>
        <v-card-title>Queue Status</v-card-title>
        <v-card-text>
          <v-row>
            <v-col
              cols="6"
              class="text-center"
            >
              <div class="text-h3">
                {{ stats.queueLength }}
              </div>
              <div class="text-caption">
                In Queue
              </div>
            </v-col>
            <v-col
              cols="6"
              class="text-center"
            >
              <div class="text-h3">
                {{ stats.inProgress }}
              </div>
              <div class="text-caption">
                In Progress
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import type { Match, Court } from '@/types';

const props = defineProps<{
  matches: Match[];
  courts: Court[];
}>();

const { getParticipantName } = useParticipantResolver();
const { getMatchDisplayName } = useMatchDisplay();

const stats = computed(() => {
  const total = props.matches.length;
  const completed = props.matches.filter(m => m.status === 'completed').length;
  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const completedMatches = props.matches.filter(m => m.status === 'completed' && m.startedAt && m.completedAt);
  const durations = completedMatches.map(m => {
    const start = m.startedAt instanceof Date ? m.startedAt : new Date(m.startedAt);
    const end = m.completedAt instanceof Date ? m.completedAt : new Date(m.completedAt);
    return (end.getTime() - start.getTime()) / (1000 * 60);
  });
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 30;

  const activeCourts = props.courts.filter(c => c.status === 'in_use').length;
  const totalCourts = props.courts.filter(c => c.status !== 'maintenance').length;
  const courtUtilization = totalCourts > 0 ? Math.round((activeCourts / totalCourts) * 100) : 0;

  const remaining = total - completed;
  const estimatedMinutes = activeCourts > 0
    ? Math.round((remaining / activeCourts) * avgDuration)
    : remaining * avgDuration;

  const queueLength = props.matches.filter(m => m.status === 'scheduled' && !m.courtId).length;
  const inProgress = props.matches.filter(m => m.status === 'in_progress').length;

  const recentCompletions = props.matches
    .filter(m => m.status === 'completed')
    .sort((a, b) => {
      const aTime = a.completedAt?.toDate ? a.completedAt.toDate() : new Date(a.completedAt);
      const bTime = b.completedAt?.toDate ? b.completedAt.toDate() : new Date(b.completedAt);
      return bTime.getTime() - aTime.getTime();
    })
    .slice(0, 5);

  return {
    completionPercentage,
    avgDuration,
    courtUtilization,
    estimatedTimeRemaining: formatDuration(estimatedMinutes),
    queueLength,
    inProgress,
    recentCompletions,
  };
});

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatTime(timestamp: any): string {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1m ago';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
</script>
