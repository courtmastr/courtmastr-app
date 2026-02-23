<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import { useMatchDisplay } from '@/composables/useMatchDisplay';
import BaseDialog from '@/components/common/BaseDialog.vue';
import type { Match, Court } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  match: Match | null;
  initialCourtId?: string | null;
  tournamentId: string;
  courts: Court[];
  ignoreCheckInGate?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'assigned': [];
}>();

const matchStore = useMatchStore();
const notificationStore = useNotificationStore();
const { getMatchDisplayName } = useMatchDisplay();

const selectedCourtId = ref<string | null>(null);
const loading = ref(false);

const availableCourts = computed(() => 
  props.courts.filter(c => c.status === 'available' || c.id === props.initialCourtId)
);

// Reset state when dialog opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    selectedCourtId.value = props.initialCourtId || null;
  }
});

async function assignCourt() {
  if (!props.match || !selectedCourtId.value) return;

  loading.value = true;
  try {
    await matchStore.assignCourt(
      props.tournamentId,
      props.match.id,
      selectedCourtId.value,
      props.match.categoryId,
      props.match.levelId,
      { ignoreCheckInGate: props.ignoreCheckInGate === true }
    );
    notificationStore.showToast(
      'success',
      props.ignoreCheckInGate ? 'Court assigned with admin override' : 'Court assigned - match is now live'
    );
    emit('assigned');
    emit('update:modelValue', false);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to assign court';
    notificationStore.showToast('error', message);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    title="Assign Court"
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
      <div class="text-caption text-grey">
        Round {{ match.round }} • Match #{{ match.matchNumber }}
      </div>
    </div>

    <v-select
      v-model="selectedCourtId"
      :items="availableCourts"
      item-title="name"
      item-value="id"
      label="Select Court"
      variant="outlined"
      :loading="loading"
      hide-details="auto"
      class="mb-4"
    />

    <v-alert
      v-if="ignoreCheckInGate"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      Admin override: assigning before both players are checked in.
    </v-alert>

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
        :disabled="!selectedCourtId"
        @click="assignCourt"
      >
        Assign Court
      </v-btn>
    </template>
  </BaseDialog>
</template>
