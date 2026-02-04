<template>
  <v-card class="mb-4">
    <v-card-title class="d-flex align-center justify-space-between">
      <span>Ready to Announce</span>
      <v-btn
        v-if="readyMatches.length > 0"
        variant="tonal"
        size="small"
        prepend-icon="mdi-bullhorn"
        @click="$emit('announceAll')"
      >
        Announce All
      </v-btn>
    </v-card-title>

    <v-list v-if="readyMatches.length > 0">
      <v-list-item
        v-for="match in readyMatches"
        :key="match.id"
        :subtitle="`${getCourtName(match.courtId)} • Round ${match.round}`"
      >
        <template #prepend>
          <v-icon v-if="match.calledAt" color="success">mdi-check-circle</v-icon>
          <v-icon v-else color="primary">mdi-bullhorn</v-icon>
        </template>

        <v-list-item-title>
          {{ getParticipantName(match.participant1Id) }} vs {{ getParticipantName(match.participant2Id) }}
        </v-list-item-title>

        <template #append>
          <v-btn
            v-if="!match.calledAt"
            variant="tonal"
            size="small"
            prepend-icon="mdi-bullhorn"
            @click="$emit('announce', match)"
          >
            Announce
          </v-btn>
          <span v-else class="text-caption text-grey">
            Called {{ formatTime(match.calledAt) }}
          </span>
        </template>
      </v-list-item>
    </v-list>

    <v-card-text v-else class="text-center text-grey py-4">
      <v-icon size="48" class="mb-2">mdi-bullhorn-outline</v-icon>
      <div>No matches ready to announce</div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Match } from '@/types';

const props = defineProps<{
  matches: Match[];
}>();

const emit = defineEmits<{
  announce: [match: Match];
  announceAll: [];
}>();

const readyMatches = computed(() => {
  return props.matches.filter(m => m.status === 'ready' && m.courtId);
});

function getParticipantName(id?: string): string {
  return id || 'TBD';
}

function getCourtName(id?: string): string {
  if (!id) return 'No Court';
  return `Court ${id.slice(-4)}`;
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
