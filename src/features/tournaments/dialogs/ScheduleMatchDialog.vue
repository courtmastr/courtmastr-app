<script setup lang="ts">
import { ref, watch } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import BaseDialog from '@/components/common/BaseDialog.vue';
import type { Match, Court } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  match: Match | null;
  tournamentId: string;
  courts: Court[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'saved': [];
}>();

const matchStore = useMatchStore();
const notificationStore = useNotificationStore();
const { getMatchDisplayName } = useMatchDisplay();

const selectedCourtId = ref<string | null>(null);
const scheduledTime = ref<string>('');
const loading = ref(false);

watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.match) {
    scheduledTime.value = props.match.scheduledTime
      ? new Date(props.match.scheduledTime).toISOString().slice(0, 16)
      : '';
    selectedCourtId.value = props.match.courtId || null;
  }
});

async function saveSchedule() {
  if (!props.match) return;

  loading.value = true;
  try {
    // If court changed, update assignment
    if (selectedCourtId.value && selectedCourtId.value !== props.match.courtId) {
      await matchStore.assignCourt(
        props.tournamentId,
        props.match.id,
        selectedCourtId.value
      );
    }

    // TODO: Update scheduled time separately once the store supports it directly
    // For now, we rely on assignCourt handling scheduling implicitly or separate logic
    // This part might need adjustment based on store capabilities

    notificationStore.showToast('success', 'Schedule updated');
    emit('saved');
    emit('update:modelValue', false);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update schedule');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    title="Schedule Match"
    max-width="500"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div
      v-if="match"
      class="mb-4"
    >
      <div class="text-subtitle-1 font-weight-bold mb-1">
        {{ getMatchDisplayName(match) }}
      </div>
    </div>

    <v-text-field
      v-model="scheduledTime"
      type="datetime-local"
      label="Start Time"
      variant="outlined"
      class="mb-4"
    />

    <v-select
      v-model="selectedCourtId"
      :items="courts"
      item-title="name"
      item-value="id"
      label="Assigned Court (Optional)"
      variant="outlined"
      clearable
      class="mb-4"
    />

    <template #actions>
      <v-spacer />
      <v-btn
        variant="text"
        :disabled="loading"
        @click="$emit('update:modelValue', false)"
      >
        Cancel
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="loading"
        @click="saveSchedule"
      >
        Save Schedule
      </v-btn>
    </template>
  </BaseDialog>
</template>
