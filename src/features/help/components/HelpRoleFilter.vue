<script setup lang="ts">
import type { HelpRole } from '@/features/help/helpTypes';
import { HELP_ROLE_FILTERS } from '@/features/help/helpContent';

const selectedRole = defineModel<HelpRole | null>({ default: null });
</script>

<template>
  <div class="help-role-filter">
    <p class="help-role-filter__label">
      Filter by role
    </p>
    <v-btn-toggle
      v-model="selectedRole"
      class="help-role-filter__toggle"
      color="primary"
      density="comfortable"
      divided
      rounded="lg"
      variant="outlined"
    >
      <v-btn
        :value="null"
        prepend-icon="mdi-view-grid-outline"
      >
        All
      </v-btn>
      <v-btn
        v-for="filter in HELP_ROLE_FILTERS"
        :key="filter.value"
        :value="filter.value"
        :prepend-icon="filter.icon"
      >
        {{ filter.label }}
      </v-btn>
    </v-btn-toggle>
  </div>
</template>

<style scoped>
.help-role-filter {
  min-width: 0;
}

.help-role-filter__label {
  margin: 0 0 8px;
  font-size: 0.875rem;
  font-weight: 700;
  color: rgba(var(--v-theme-on-surface), 0.76);
}

.help-role-filter__toggle {
  max-width: 100%;
  overflow-x: auto;
}

:deep(.v-btn) {
  min-height: 44px;
}
</style>
