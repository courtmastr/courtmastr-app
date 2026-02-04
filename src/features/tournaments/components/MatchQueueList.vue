<script setup lang="ts">
import { computed } from 'vue';
import { differenceInMinutes } from 'date-fns';

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
}

const props = defineProps<{
  matches: Match[];
  availableCourts: Court[];
  autoAssignEnabled: boolean;
}>();

const emit = defineEmits<{
  manualAssign: [matchId: string, courtId: string];
  toggleAutoAssign: [enabled: boolean];
}>();

function getParticipantNames(match: Match): string {
  const p1 = match.participant1Name || 'Player 1';
  const p2 = match.participant2Name || 'Player 2';
  return `${p1} vs ${p2}`;
}

function getWaitTime(match: Match): string {
  if (!match.queuedAt) return '';
  const minutes = differenceInMinutes(new Date(), match.queuedAt);
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
}

function getWaitColor(match: Match): string {
  if (!match.queuedAt) return 'grey';
  const minutes = differenceInMinutes(new Date(), match.queuedAt);
  if (minutes < 5) return 'success';
  if (minutes < 15) return 'warning';
  return 'error';
}
</script>

<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon start>mdi-format-list-numbered</v-icon>
      Match Queue
      <v-spacer />
      <v-chip size="small" color="primary" variant="tonal">
        {{ matches.length }} Waiting
      </v-chip>
    </v-card-title>

    <v-divider />

    <v-card-text>
      <!-- Auto-Assign Toggle -->
      <div class="mb-4">
        <v-switch
          :model-value="autoAssignEnabled"
          color="primary"
          label="Auto-assign matches to courts"
          hide-details
          @update:model-value="emit('toggleAutoAssign', $event)"
        />
        <div class="text-caption text-grey-darken-1 ml-8">
          {{ autoAssignEnabled ? 'Matches will be automatically assigned when courts become available' : 'Manual assignment only' }}
        </div>
      </div>

      <v-divider class="mb-4" />

      <!-- Queue List -->
      <v-list v-if="matches.length > 0" density="compact" class="pa-0">
        <v-list-item
          v-for="(match, index) in matches"
          :key="match.id"
          class="px-0"
        >
          <template #prepend>
            <v-avatar size="32" color="primary" class="mr-3">
              <span class="font-weight-bold">{{ index + 1 }}</span>
            </v-avatar>
          </template>

          <v-list-item-title class="text-body-2 font-weight-medium">
            {{ getParticipantNames(match) }}
          </v-list-item-title>

          <v-list-item-subtitle class="text-caption">
            <template v-if="match.categoryName">
              {{ match.categoryName }}
              <template v-if="match.round">
                - Round {{ match.round }}
              </template>
            </template>
            <template v-if="match.queuedAt">
              <v-chip
                size="x-small"
                :color="getWaitColor(match)"
                variant="tonal"
                class="ml-2"
              >
                <v-icon start size="x-small">mdi-clock-outline</v-icon>
                {{ getWaitTime(match) }}
              </v-chip>
            </template>
          </v-list-item-subtitle>

          <template #append>
            <v-menu>
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  size="small"
                  color="primary"
                  variant="tonal"
                  :disabled="availableCourts.length === 0"
                >
                  Assign
                </v-btn>
              </template>
              <v-list density="compact">
                <v-list-item
                  v-for="court in availableCourts"
                  :key="court.id"
                  @click="emit('manualAssign', match.id, court.id)"
                >
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
.v-list-item {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.v-list-item:last-child {
  border-bottom: none;
}
</style>
