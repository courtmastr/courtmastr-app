<template>
  <v-dialog
    :model-value="modelValue"
    max-width="500"
    persistent
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card>
      <v-card-title>Delay Match</v-card-title>

      <v-card-text v-if="match">
        <v-alert
          type="info"
          variant="tonal"
          class="mb-4"
        >
          Match will be moved to end of queue and court will be freed.
        </v-alert>

        <v-select
          v-model="delayMinutes"
          :items="delayOptions"
          item-title="label"
          item-value="value"
          label="Delay Duration"
          variant="outlined"
          class="mb-4"
        />

        <v-textarea
          v-model="reason"
          label="Reason"
          placeholder="e.g., Player rest, equipment issue, etc."
          rows="2"
          variant="outlined"
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
          color="warning"
          variant="elevated"
          @click="confirm"
        >
          Delay Match
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Match } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  match: Match | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [delayMinutes: number, reason: string];
}>();

const delayMinutes = ref(15);
const reason = ref('');

const delayOptions = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '60 minutes', value: 60 },
];

watch(() => props.modelValue, (open) => {
  if (open) {
    delayMinutes.value = 15;
    reason.value = '';
  }
});

function confirm() {
  emit('confirm', delayMinutes.value, reason.value);
}
</script>
