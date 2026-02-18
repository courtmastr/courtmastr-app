<script setup lang="ts">
import { computed } from 'vue';
import type { Court, Match } from '@/types';

interface Alert {
  id: string;
  type: 'idle_court' | 'late_match' | 'unassigned_ready' | 'maintenance';
  severity: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  action?: {
    label: string;
    handler: () => void;
  };
  courtId?: string;
  matchId?: string;
}

interface Props {
  courts: Court[];
  matches: Match[];
  matchDurationMinutes?: number; // Configured expected duration
  idleThresholdMinutes?: number; // Threshold for idle court alert (default 10)
  lateThresholdMinutes?: number; // Threshold for late match (default 30)
  getParticipantName: (id: string | undefined) => string;
  getCategoryName: (id: string) => string;
}

const props = withDefaults(defineProps<Props>(), {
  matchDurationMinutes: 20,
  idleThresholdMinutes: 10,
  lateThresholdMinutes: 30,
});

const emit = defineEmits<{
  assignToCourt: [courtId: string];
  viewMatch: [matchId: string];
  releaseCourt: [courtId: string];
}>();

const now = computed(() => new Date());

// Calculate alerts based on current state
const alerts = computed((): Alert[] => {
  const result: Alert[] = [];

  // 1. Idle courts (available but no match assigned for > threshold)
  const availableCourts = props.courts.filter(c => c.status === 'available');
  
  for (const court of availableCourts) {
    // Check if court has been available for a while (using court.updatedAt if available)
    // For now, just alert on all available courts if there are ready matches
    const readyMatches = props.matches.filter(m => m.status === 'ready');
    if (readyMatches.length > 0) {
      result.push({
        id: `idle-${court.id}`,
        type: 'idle_court',
        severity: 'info',
        title: `${court.name} Available`,
        message: `Ready to assign matches`,
        courtId: court.id,
      });
    }
  }

  // 2. Late matches (in_progress for > threshold)
  const inProgressMatches = props.matches.filter(m => m.status === 'in_progress' && m.startedAt);
  
  for (const match of inProgressMatches) {
    const startTime = match.startedAt instanceof Date 
      ? match.startedAt 
      : match.startedAt ? new Date(match.startedAt) : new Date();
    const durationMinutes = (now.value.getTime() - startTime.getTime()) / (1000 * 60);
    
    if (durationMinutes > props.lateThresholdMinutes) {
      const court = props.courts.find(c => c.id === match.courtId);
      result.push({
        id: `late-${match.categoryId}-${match.id}`,
        type: 'late_match',
        severity: 'warning',
        title: 'Match Running Long',
        message: `${props.getParticipantName(match.participant1Id)} vs ${props.getParticipantName(match.participant2Id)} on ${court?.name || 'Unknown Court'} - ${Math.round(durationMinutes)} min`,
        matchId: match.id,
      });
    }
  }

  // 3. Unassigned ready matches (ready for > threshold without court)
  const readyMatches = props.matches.filter(m => m.status === 'ready' && !m.courtId);
  
  for (const match of readyMatches) {
    // If match has been ready for a while
    const readyTime = match.updatedAt instanceof Date 
      ? match.updatedAt 
      : match.updatedAt ? new Date(match.updatedAt) : null;
    
    if (readyTime) {
      const waitMinutes = (now.value.getTime() - readyTime.getTime()) / (1000 * 60);
      if (waitMinutes > props.idleThresholdMinutes) {
        result.push({
          id: `unassigned-${match.categoryId}-${match.id}`,
          type: 'unassigned_ready',
          severity: 'warning',
          title: 'Match Waiting for Court',
          message: `${props.getParticipantName(match.participant1Id)} vs ${props.getParticipantName(match.participant2Id)} waiting ${Math.round(waitMinutes)} min`,
          matchId: match.id,
        });
      }
    } else {
      // No ready timestamp - still show as waiting
      result.push({
        id: `unassigned-${match.categoryId}-${match.id}`,
        type: 'unassigned_ready',
        severity: 'info',
        title: 'Match Ready for Court',
        message: `${props.getParticipantName(match.participant1Id)} vs ${props.getParticipantName(match.participant2Id)} ready to assign`,
        matchId: match.id,
      });
    }
  }

  // 4. Courts in maintenance
  const maintenanceCourts = props.courts.filter(c => c.status === 'maintenance');
  
  for (const court of maintenanceCourts) {
    result.push({
      id: `maintenance-${court.id}`,
      type: 'maintenance',
      severity: 'info',
      title: `${court.name} in Maintenance`,
      message: 'Court unavailable for matches',
      courtId: court.id,
    });
  }

  // Sort by severity: error > warning > info
  const severityOrder = { error: 0, warning: 1, info: 2 };
  result.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return result;
});

const alertCount = computed(() => alerts.value.length);
const warningCount = computed(() => alerts.value.filter(a => a.severity === 'warning').length);
const errorCount = computed(() => alerts.value.filter(a => a.severity === 'error').length);

function getAlertIcon(type: Alert['type']): string {
  switch (type) {
    case 'idle_court':
      return 'mdi-badminton';
    case 'late_match':
      return 'mdi-clock-alert';
    case 'unassigned_ready':
      return 'mdi-account-clock';
    case 'maintenance':
      return 'mdi-wrench';
    default:
      return 'mdi-alert';
  }
}

function getAlertColor(severity: Alert['severity']): string {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
    default:
      return 'info';
  }
}

function handleAlertClick(alert: Alert) {
  if (alert.courtId && alert.type === 'idle_court') {
    emit('assignToCourt', alert.courtId);
  } else if (alert.matchId) {
    emit('viewMatch', alert.matchId);
  }
}
</script>

<template>
  <div class="alerts-panel">
    <!-- Header -->
    <div class="alerts-panel__header d-flex align-center px-3 py-2 bg-surface border-b">
      <v-icon
        size="20"
        class="mr-2"
        :color="errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'info'"
      >
        mdi-bell
      </v-icon>
      <span class="font-weight-medium">Alerts</span>
      <v-spacer />
      <v-chip 
        v-if="alertCount > 0" 
        size="x-small" 
        :color="errorCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'info'"
        variant="tonal"
      >
        {{ alertCount }}
      </v-chip>
      <v-chip
        v-else
        size="x-small"
        variant="tonal"
        color="success"
      >
        All Good
      </v-chip>
    </div>

    <!-- Alerts List -->
    <v-list
      density="compact"
      class="alerts-panel__list pa-0"
    >
      <template
        v-for="(alert, index) in alerts"
        :key="alert.id"
      >
        <v-list-item
          :class="['alerts-panel__item', `alerts-panel__item--${alert.severity}`]"
          @click="handleAlertClick(alert)"
        >
          <template #prepend>
            <v-icon
              :icon="getAlertIcon(alert.type)"
              :color="getAlertColor(alert.severity)"
              size="20"
              class="mr-2"
            />
          </template>

          <v-list-item-title class="text-body-2 font-weight-medium">
            {{ alert.title }}
          </v-list-item-title>
          
          <v-list-item-subtitle class="text-caption">
            {{ alert.message }}
          </v-list-item-subtitle>

          <template #append>
            <v-icon
              size="16"
              color="grey-lighten-1"
            >
              mdi-chevron-right
            </v-icon>
          </template>
        </v-list-item>

        <v-divider v-if="index < alerts.length - 1" />
      </template>
    </v-list>

    <!-- Empty State -->
    <div
      v-if="alerts.length === 0"
      class="alerts-panel__empty text-center pa-6"
    >
      <v-icon
        size="40"
        color="success"
        class="mb-3"
      >
        mdi-check-circle
      </v-icon>
      <div class="text-body-2 text-medium-emphasis">
        No alerts
      </div>
      <div class="text-caption text-medium-emphasis mt-1">
        Everything is running smoothly
      </div>
    </div>
  </div>
</template>

<style scoped>
.alerts-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-background));
}

.alerts-panel__header {
  flex-shrink: 0;
}

.alerts-panel__list {
  flex: 1;
  overflow-y: auto;
}

.alerts-panel__item {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.alerts-panel__item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}

.alerts-panel__item--error {
  border-left: 3px solid rgb(var(--v-theme-error));
}

.alerts-panel__item--warning {
  border-left: 3px solid rgb(var(--v-theme-warning));
}

.alerts-panel__item--info {
  border-left: 3px solid rgb(var(--v-theme-info));
}

.alerts-panel__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}
</style>
