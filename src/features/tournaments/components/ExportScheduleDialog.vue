<template>
  <v-dialog
    :model-value="modelValue"
    max-width="500"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>Export Schedule</v-card-title>

      <v-card-text>
        <v-select
          v-model="format"
          :items="formatOptions"
          item-title="label"
          item-value="value"
          label="Export Format"
          variant="outlined"
          class="mb-4"
        />

        <div class="text-subtitle-2 mb-2">
          Include:
        </div>
        <v-checkbox
          v-model="includeCompleted"
          label="Completed matches"
          density="compact"
        />
        <v-checkbox
          v-model="includeScheduled"
          label="Scheduled matches"
          density="compact"
        />
        <v-checkbox
          v-model="includeQueue"
          label="Queue (unassigned)"
          density="compact"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="$emit('update:modelValue', false)"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          @click="exportData"
        >
          <v-icon start>
            mdi-download
          </v-icon>
          Export
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Match } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  matches: Match[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const format = ref<'csv' | 'json' | 'print'>('csv');
const includeCompleted = ref(true);
const includeScheduled = ref(true);
const includeQueue = ref(true);

const formatOptions = [
  { label: 'CSV File', value: 'csv' },
  { label: 'JSON File', value: 'json' },
  { label: 'Print', value: 'print' },
];

function exportData() {
  const filteredMatches = props.matches.filter(m => {
    if (m.status === 'completed' && !includeCompleted.value) return false;
    if (m.status === 'scheduled' && m.courtId && !includeScheduled.value) return false;
    if (m.status === 'scheduled' && !m.courtId && !includeQueue.value) return false;
    return true;
  });

  if (format.value === 'csv') {
    exportCSV(filteredMatches);
  } else if (format.value === 'json') {
    exportJSON(filteredMatches);
  } else {
    window.print();
  }

  emit('update:modelValue', false);
}

function exportCSV(matches: Match[]) {
  const headers = ['Match #', 'Category', 'Round', 'Player 1', 'Player 2', 'Court', 'Time', 'Status', 'Score'];
  const rows = matches.map(m => [
    m.matchNumber,
    m.categoryName || 'Unknown',
    m.round,
    m.participant1Id || 'TBD',
    m.participant2Id || 'TBD',
    m.courtName || 'Unassigned',
    m.scheduledTime ? formatTime(m.scheduledTime) : 'N/A',
    m.status,
    m.score || 'N/A',
  ]);

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  downloadFile(csv, 'schedule.csv', 'text/csv');
}

function exportJSON(matches: Match[]) {
  const json = JSON.stringify(matches, null, 2);
  downloadFile(json, 'schedule.json', 'application/json');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatTime(timestamp: any): string {
  if (!timestamp) return 'N/A';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>
