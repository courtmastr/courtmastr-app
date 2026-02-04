<template>
  <v-chip
    :color="color"
    variant="tonal"
    size="small"
    prepend-icon="mdi-clock-outline"
  >
    {{ label }}
  </v-chip>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  queuePosition: number;
  courtsAvailable: number;
  avgMatchDuration: number;
}>();

const estimatedMinutes = computed(() => {
  const matchesAhead = props.queuePosition - 1;
  if (matchesAhead <= 0) return 0;
  const rounds = Math.ceil(matchesAhead / Math.max(props.courtsAvailable, 1));
  return rounds * props.avgMatchDuration;
});

const color = computed(() => {
  if (estimatedMinutes.value < 15) return 'success';
  if (estimatedMinutes.value < 30) return 'warning';
  if (estimatedMinutes.value < 60) return 'orange';
  return 'error';
});

const label = computed(() => {
  if (estimatedMinutes.value === 0) return 'Next up';
  if (estimatedMinutes.value < 60) return `~${estimatedMinutes.value} min`;
  const hours = Math.floor(estimatedMinutes.value / 60);
  const mins = estimatedMinutes.value % 60;
  if (mins === 0) return `~${hours}h`;
  return `~${hours}h ${mins}m`;
});
</script>
