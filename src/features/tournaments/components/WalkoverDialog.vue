<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="500" persistent>
    <v-card>
      <v-card-title>Record Walkover</v-card-title>

      <v-card-text v-if="match">
        <v-alert type="info" variant="tonal" class="mb-4">
          Records 21-0 score and advances winner. Court will be freed immediately.
        </v-alert>

        <div class="text-subtitle-1 mb-2">Select Winner:</div>

        <v-radio-group v-model="selectedWinner" class="mb-4">
          <v-radio :value="match.participant1Id">
            <template #label>
              {{ getParticipantName(match.participant1Id) }}
            </template>
          </v-radio>
          <v-radio :value="match.participant2Id">
            <template #label>
              {{ getParticipantName(match.participant2Id) }}
            </template>
          </v-radio>
        </v-radio-group>

        <v-textarea
          v-model="reason"
          label="Reason (optional)"
          placeholder="e.g., Player injury, no-show, etc."
          rows="2"
          variant="outlined"
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">Cancel</v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          :disabled="!selectedWinner"
          @click="confirm"
        >
          Record Walkover
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useParticipantResolver } from '@/composables/useParticipantResolver';
import type { Match } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  match: Match | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [winnerId: string, reason: string];
}>();

const { getParticipantName } = useParticipantResolver();

const selectedWinner = ref<string>('');
const reason = ref('');

watch(() => props.modelValue, (open) => {
  if (open) {
    selectedWinner.value = '';
    reason.value = '';
  }
});

function confirm() {
  if (selectedWinner.value) {
    emit('confirm', selectedWinner.value, reason.value);
  }
}
</script>
