<script setup lang="ts">
interface Props {
  query: string;
}

defineProps<Props>();
</script>

<template>
  <v-card
    class="help-empty-state"
    rounded="lg"
    variant="outlined"
  >
    <v-card-text class="text-center py-10">
      <v-icon
        icon="mdi-file-search-outline"
        size="48"
        color="primary"
        class="mb-3"
      />
      <h2 class="help-empty-state__title">
        No help topics found
      </h2>
      <p class="help-empty-state__body">
        No topic matches "{{ query }}". Try a role filter, a feature name, or a task like score, check-in, schedule, or bracket.
      </p>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.help-empty-state {
  border-color: rgba(var(--v-theme-on-surface), 0.12);
}

.help-empty-state__title {
  margin: 0 0 8px;
  font-size: 1.25rem;
  line-height: 1.35;
}

.help-empty-state__body {
  max-width: 640px;
  margin: 0 auto;
  line-height: 1.6;
  color: rgba(var(--v-theme-on-surface), 0.72);
}
</style>
