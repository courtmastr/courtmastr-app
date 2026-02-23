<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useNotificationStore } from '@/stores/notifications';
import BaseDialog from '@/components/common/BaseDialog.vue';
import type { Match } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  courtId: string | null;
  courtName: string;
  matches: Match[];
  tournamentId: string;
  getParticipantName: (id: string | undefined) => string;
  getCategoryName: (id: string) => string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'assigned': [];
}>();

const matchStore = useMatchStore();
const notificationStore = useNotificationStore();

const selectedMatchId = ref<string | null>(null);
const loading = ref(false);

// Reset selection when dialog opens
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) selectedMatchId.value = null;
});

const sortedMatches = computed(() => {
  return [...props.matches].sort((a, b) => {
    const aTime = (a.plannedStartAt ?? a.scheduledTime)?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTime = (b.plannedStartAt ?? b.scheduledTime)?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return a.round - b.round || a.matchNumber - b.matchNumber;
  });
});

const close = (): void => {
  emit('update:modelValue', false);
};

async function assignMatch(): Promise<void> {
  const match = props.matches.find(m => m.id === selectedMatchId.value);
  if (!match || !props.courtId) return;
  
  loading.value = true;
  try {
    await matchStore.assignCourt(
      props.tournamentId,
      match.id,
      props.courtId,
      match.categoryId,
      match.levelId
    );
    notificationStore.showToast('success', 'Match assigned to court!');
    emit('assigned');
    emit('update:modelValue', false);
  } catch (err: unknown) {
    console.error('Error assigning match:', err);
    const message = err instanceof Error ? err.message : 'Failed to assign match';
    notificationStore.showToast('error', message);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    :title="`Assign Match → ${courtName}`"
    max-width="520"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- Empty state -->
    <v-alert
      v-if="!sortedMatches.length"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      <div class="text-subtitle-2">
        No matches ready to assign.
      </div>
      <div class="text-body-2">
        Only published, scheduled, checked-in matches can be assigned to court.
      </div>
    </v-alert>

    <!-- Match list -->
    <v-list
      v-else
      density="compact"
      lines="two"
    >
      <v-list-item
        v-for="match in sortedMatches"
        :key="match.id"
        :active="selectedMatchId === match.id"
        active-color="primary"
        @click="selectedMatchId = match.id"
      >
        <template #prepend>
          <v-chip
            size="x-small"
            variant="tonal"
            color="primary"
          >
            {{ getCategoryName(match.categoryId) }}
          </v-chip>
        </template>

        <template #title>
          {{ getParticipantName(match.participant1Id) }} vs {{ getParticipantName(match.participant2Id) }}
        </template>

        <template #subtitle>
          R{{ match.round }} · Match #{{ match.matchNumber }}
        </template>

        <template #append>
          <v-icon
            v-if="selectedMatchId === match.id"
            icon="mdi-check-circle"
            color="primary"
            size="18"
          />
        </template>
      </v-list-item>
    </v-list>

    <template #actions>
      <v-spacer />
      <v-btn
        variant="text"
        :disabled="loading"
        @click="close"
      >
        Cancel
      </v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="loading"
        :disabled="!selectedMatchId || loading"
        @click="assignMatch"
      >
        Assign to Court
      </v-btn>
    </template>
  </BaseDialog>
</template>
