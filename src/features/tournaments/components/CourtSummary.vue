<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  busyCourts: number;
  totalCourts: number;
  idleCourts: number;
  duplicateBusyAssignments?: number;
}

const props = withDefaults(defineProps<Props>(), {
  duplicateBusyAssignments: 0,
});

const hasDataIssue = computed(() => (props.duplicateBusyAssignments ?? 0) > 0);
const statusColor = computed(() => {
  if (props.totalCourts === 0) return 'warning';
  if (props.busyCourts >= props.totalCourts) return 'error';
  return 'success';
});
</script>

<template>
  <div
    class="d-flex align-center flex-wrap ga-2"
    role="status"
    aria-live="polite"
  >
    <v-chip
      size="small"
      variant="outlined"
      :color="statusColor"
      :aria-label="`Busy courts ${busyCourts} out of total ${totalCourts}`"
    >
      Busy: {{ busyCourts }} / Total: {{ totalCourts }}
    </v-chip>

    <v-chip
      size="small"
      variant="text"
      :aria-label="`Idle courts ${idleCourts}`"
    >
      Idle: {{ idleCourts }}
    </v-chip>

    <v-chip
      v-if="hasDataIssue"
      size="small"
      color="warning"
      variant="tonal"
      :aria-label="`Court assignment conflict detected on ${duplicateBusyAssignments} extra in-progress assignment records`"
    >
      Data Alert
    </v-chip>

    <span
      v-if="totalCourts === 0"
      class="text-caption text-medium-emphasis"
      aria-label="No active courts configured"
    >
      No active courts configured.
    </span>
  </div>
</template>
