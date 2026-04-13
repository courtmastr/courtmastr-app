<script setup lang="ts">
import type { HelpRole, HelpTopic } from '@/features/help/helpTypes';
import { HELP_ROLE_FILTERS } from '@/features/help/helpContent';

interface Props {
  topic: HelpTopic;
}

defineProps<Props>();

const getRoleLabel = (role: HelpRole): string =>
  HELP_ROLE_FILTERS.find((filter) => filter.value === role)?.label ?? role;
</script>

<template>
  <v-card
    class="help-topic-card h-100"
    :to="{ name: 'help-topic', params: { topicSlug: topic.slug } }"
    rounded="lg"
    variant="outlined"
  >
    <v-card-text class="help-topic-card__body">
      <div class="d-flex align-start justify-space-between ga-3 mb-3">
        <div>
          <h2 class="help-topic-card__title">
            {{ topic.title }}
          </h2>
          <p class="help-topic-card__summary">
            {{ topic.summary }}
          </p>
        </div>
        <v-icon
          icon="mdi-chevron-right"
          color="primary"
          aria-hidden="true"
        />
      </div>

      <div
        class="help-topic-card__roles"
        aria-label="Topic audience"
      >
        <v-chip
          v-for="role in topic.audience"
          :key="role"
          size="small"
          variant="tonal"
          color="primary"
        >
          {{ getRoleLabel(role) }}
        </v-chip>
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.help-topic-card {
  border-color: rgba(var(--v-theme-on-surface), 0.12);
  transition: border-color 160ms ease-out, box-shadow 160ms ease-out, transform 160ms ease-out;
}

.help-topic-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.4);
  box-shadow: 0 10px 24px rgba(var(--v-theme-on-surface), 0.1);
  transform: translateY(-1px);
}

.help-topic-card__body {
  min-height: 186px;
}

.help-topic-card__title {
  margin: 0 0 8px;
  font-size: 1.05rem;
  line-height: 1.3;
  font-weight: 700;
  color: rgba(var(--v-theme-on-surface), 0.92);
}

.help-topic-card__summary {
  margin: 0;
  line-height: 1.55;
  color: rgba(var(--v-theme-on-surface), 0.72);
}

.help-topic-card__roles {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
}

@media (prefers-reduced-motion: reduce) {
  .help-topic-card {
    transition: none;
  }

  .help-topic-card:hover {
    transform: none;
  }
}
</style>
