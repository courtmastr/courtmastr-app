<script setup lang="ts">
import { computed } from 'vue';
import { differenceInMinutes } from 'date-fns';
import { useParticipantResolver } from '@/composables/useParticipantResolver';

interface Court {
  id: string;
  name: string;
  number: number;
}

interface Match {
  id: string;
  participant1Id: string;
  participant2Id: string;
  participant1Name?: string;
  participant2Name?: string;
  categoryName?: string;
  round?: number;
  queuedAt?: Date;
  status?: string;
}

type UrgencyLevel = 'urgent' | 'high' | 'normal';

interface MatchWithUrgency extends Match {
  urgency: UrgencyLevel;
  urgencyScore: number;
  waitMinutes: number;
}

const props = defineProps<{
  matches: Match[];
  availableCourts: Court[];
  autoAssignEnabled: boolean;
  autoStartEnabled: boolean;
}>();

const emit = defineEmits<{
  manualAssign: [matchId: string, courtId: string];
  toggleAutoAssign: [enabled: boolean];
  toggleAutoStart: [enabled: boolean];
}>();

const { getMatchupString } = useParticipantResolver();

function getWaitTime(match: Match): string {
  if (!match.queuedAt) return '';
  const minutes = differenceInMinutes(new Date(), match.queuedAt);
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
}

function getWaitMinutes(match: Match): number {
  if (!match.queuedAt) return 0;
  return differenceInMinutes(new Date(), match.queuedAt);
}

function getUrgency(match: Match): UrgencyLevel {
  const minutes = getWaitMinutes(match);
  const isReady = match.status === 'ready';
  const hasCourtsAvailable = props.availableCourts.length > 0;

  // URGENT: Ready status + courts available
  if (isReady && hasCourtsAvailable) {
    return 'urgent';
  }

  // HIGH: Waiting >15 minutes
  if (minutes >= 15) {
    return 'high';
  }

  // NORMAL: Everything else
  return 'normal';
}

function getUrgencyScore(match: Match): number {
  const urgency = getUrgency(match);
  const minutes = getWaitMinutes(match);

  // Scoring: Urgent = 1000+, High = 500+, Normal = wait minutes
  if (urgency === 'urgent') return 1000 + minutes;
  if (urgency === 'high') return 500 + minutes;
  return minutes;
}

function getUrgencyColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'urgent': return 'error';
    case 'high': return 'warning';
    case 'normal': return 'grey';
  }
}

function getUrgencyIcon(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'urgent': return 'mdi-alert-circle';
    case 'high': return 'mdi-clock-alert';
    case 'normal': return 'mdi-clock-outline';
  }
}

 function getUrgencyLabel(urgency: UrgencyLevel): string {
   switch (urgency) {
     case 'urgent': return '🔴 URGENT';
     case 'high': return '🟡 HIGH';
     case 'normal': return '⚪ NORMAL';
   }
 }

// Sort matches by urgency (highest urgency score first)
const sortedMatches = computed<MatchWithUrgency[]>(() => {
  return props.matches
    .map(match => ({
      ...match,
      urgency: getUrgency(match),
      urgencyScore: getUrgencyScore(match),
      waitMinutes: getWaitMinutes(match)
    }))
    .sort((a, b) => b.urgencyScore - a.urgencyScore);
});
</script>

<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon start>
        mdi-format-list-numbered
      </v-icon>
      Match Queue
      <v-spacer />
      <v-chip
        size="small"
        color="primary"
        variant="tonal"
      >
        {{ matches.length }} Waiting
      </v-chip>
    </v-card-title>

    <v-divider />

    <v-card-text>
      <!-- Auto-Assign Toggle -->
      <div class="mb-4">
        <div class="d-flex flex-wrap gap-4">
          <v-switch
            :model-value="autoAssignEnabled"
            color="primary"
            label="Auto-assign matches"
            hide-details
            density="compact"
            @update:model-value="emit('toggleAutoAssign', !!$event)"
          />
          <v-switch
            :model-value="autoStartEnabled"
            color="success"
            label="Auto-start matches"
            hide-details
            density="compact"
            @update:model-value="emit('toggleAutoStart', !!$event)"
          />
        </div>
        <div class="text-caption text-grey-darken-1 ml-2 mt-1">
          <span v-if="autoAssignEnabled && autoStartEnabled">
            Matches will be automatically assigned and started immediately.
          </span>
          <span v-else-if="autoAssignEnabled">
            Matches will be automatically assigned to courts but require manual start.
          </span>
          <span v-else>
            Manual assignment and start required.
          </span>
        </div>
      </div>

      <v-divider class="mb-4" />

      <!-- Queue List with Urgency Indicators -->
      <v-list
        v-if="sortedMatches.length > 0"
        class="pa-0"
      >
        <v-list-item
          v-for="(match, index) in sortedMatches"
          :key="match.id"
          class="match-queue-item px-0 py-2"
          :class="`urgency-${match.urgency}`"
        >
          <template #prepend>
            <div class="d-flex flex-column align-center mr-4">
              <v-avatar
                size="44"
                :color="getUrgencyColor(match.urgency)"
                class="mb-1"
                :class="match.urgency === 'urgent' ? 'pulse-animation' : ''"
              >
                <v-icon
                  :icon="getUrgencyIcon(match.urgency)"
                  size="24"
                />
              </v-avatar>
              <span class="text-caption font-weight-bold">#{{ index + 1 }}</span>
            </div>
          </template>

          <div class="match-content">
            <!-- Urgency Badge -->
            <v-chip
              size="small"
              :color="getUrgencyColor(match.urgency)"
              variant="flat"
              class="mb-2"
              density="comfortable"
            >
              <v-icon
                start
                size="16"
              >
                {{ getUrgencyIcon(match.urgency) }}
              </v-icon>
              {{ getUrgencyLabel(match.urgency) }}
            </v-chip>

            <!-- Participants -->
            <v-list-item-title class="text-body-1 font-weight-medium mb-1">
              {{ getMatchupString(match) }}
            </v-list-item-title>

            <!-- Category and Wait Time -->
            <v-list-item-subtitle class="text-body-2">
              <template v-if="match.categoryName">
                <v-icon
                  size="16"
                  class="mr-1"
                >
                  mdi-tennis
                </v-icon>
                {{ match.categoryName }}
                <template v-if="match.round">
                  • Round {{ match.round }}
                </template>
              </template>
              <template v-if="match.queuedAt">
                <v-chip
                  size="small"
                  :color="getUrgencyColor(match.urgency)"
                  variant="tonal"
                  class="ml-2"
                >
                  <v-icon
                    start
                    size="16"
                  >
                    mdi-clock-outline
                  </v-icon>
                  Waiting {{ getWaitTime(match) }}
                </v-chip>
              </template>
            </v-list-item-subtitle>
            <!-- More prominent wait time display -->
            <div class="d-flex align-center mt-1">
              <v-icon
                :color="getUrgencyColor(match.urgency)"
                size="16"
              >
                mdi-clock-time-four
              </v-icon>
              <span 
                class="text-caption font-weight-medium ml-1" 
                :class="`text-${getUrgencyColor(match.urgency)}`"
              >
                Waited {{ getWaitTime(match) }}
              </span>
            </div>
          </div>

          <template #append>
            <v-menu>
              <template #activator="{ props: menuProps }">
                <v-btn
                  v-bind="menuProps"
                  :color="match.urgency === 'urgent' ? 'error' : 'primary'"
                  :variant="match.urgency === 'urgent' ? 'elevated' : 'tonal'"
                  :disabled="availableCourts.length === 0"
                  min-width="120"
                  class="assign-btn"
                >
                  <v-icon start>
                    mdi-court-sport
                  </v-icon>
                  Assign Court
                </v-btn>
              </template>
              <v-list density="comfortable">
                <v-list-item
                  v-for="court in availableCourts"
                  :key="court.id"
                  @click="emit('manualAssign', match.id, court.id)"
                >
                  <template #prepend>
                    <v-icon>mdi-court-sport</v-icon>
                  </template>
                  <v-list-item-title>{{ court.name }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </template>
        </v-list-item>
      </v-list>

      <!-- Empty State -->
      <v-alert
        v-else
        type="success"
        variant="tonal"
        icon="mdi-check-circle"
      >
        No matches waiting in queue
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.match-queue-item {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  min-height: 96px;
  padding-top: 16px !important;
  padding-bottom: 16px !important;
  transition: all 0.2s ease;
}

.match-queue-item:last-child {
  border-bottom: none;
}

.match-queue-item:hover {
  background-color: rgba(var(--v-theme-surface), 0.04);
}

/* Urgency-specific styling */
.match-queue-item.urgency-urgent {
  border-left: 4px solid rgb(var(--v-theme-error));
  background-color: rgba(var(--v-theme-error), 0.05);
}

.match-queue-item.urgency-high {
  border-left: 4px solid rgb(var(--v-theme-warning));
}

.match-queue-item.urgency-normal {
  border-left: 4px solid transparent;
}

.match-content {
  flex: 1;
  min-width: 0; /* Prevent flex overflow */
}

/* Touch-friendly button sizing */
.assign-btn {
  min-height: 44px !important;
  font-weight: 500;
}

.pulse-animation {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(var(--v-theme-error), 0.4);
  }
  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(var(--v-theme-error), 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(var(--v-theme-error), 0);
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .match-queue-item {
    flex-direction: column;
    align-items: flex-start !important;
  }

  .assign-btn {
    width: 100%;
    margin-top: 12px;
  }
}
</style>
