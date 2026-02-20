<template>
  <v-card
    variant="tonal"
    :color="isPaused ? 'warning' : 'primary'"
    class="mb-4"
  >
    <v-card-text class="d-flex align-center justify-space-between">
      <div class="d-flex align-center">
        <v-icon
          size="large"
          class="mr-3"
        >
          {{ isPaused ? 'mdi-pause-circle' : 'mdi-play-circle' }}
        </v-icon>
        <div>
          <div class="text-h6">
            {{ isPaused ? 'PAUSED' : 'ACTIVE' }}
          </div>
          <div class="text-caption">
            <template v-if="processing">
              <v-progress-circular
                size="12"
                width="2"
                indeterminate
                class="mr-1"
              />
              Assigning...
            </template>
            <template v-else-if="lastAssignment">
              Last: {{ formatTime(lastAssignment) }}
            </template>
            <template v-else>
              Waiting for courts...
            </template>
          </div>
        </div>
      </div>

      <v-btn
        :color="isPaused ? 'success' : 'warning'"
        variant="elevated"
        @click="isPaused ? $emit('resume') : $emit('pause')"
      >
        <v-icon start>
          {{ isPaused ? 'mdi-play' : 'mdi-pause' }}
        </v-icon>
        {{ isPaused ? 'Resume' : 'Pause' }}
      </v-btn>
    </v-card-text>

    <v-alert
      v-if="isPaused"
      type="warning"
      variant="tonal"
      density="compact"
      class="mx-4 mb-4"
    >
      Auto-assignment is paused. Use manual assignment or click "Resume" to continue.
    </v-alert>
  </v-card>
</template>

<script setup lang="ts">
defineProps<{
  isPaused: boolean;
  processing: boolean;
  lastAssignment: Date | null;
}>();

defineEmits<{
  pause: [];
  resume: [];
}>();

function formatTime(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}
</script>
