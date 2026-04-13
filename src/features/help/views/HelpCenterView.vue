<script setup lang="ts">
import { computed, ref } from 'vue';
import HelpRoleFilter from '@/features/help/components/HelpRoleFilter.vue';
import HelpSearchEmptyState from '@/features/help/components/HelpSearchEmptyState.vue';
import HelpTopicCard from '@/features/help/components/HelpTopicCard.vue';
import { helpTopics, searchHelpTopics } from '@/features/help/helpContent';
import type { HelpRole } from '@/features/help/helpTypes';

const searchQuery = ref('');
const selectedRole = ref<HelpRole | null>(null);

const filteredTopics = computed(() =>
  searchHelpTopics(searchQuery.value, selectedRole.value ?? undefined)
);

const resultSummary = computed(() => {
  if (!searchQuery.value.trim()) {
    return `${filteredTopics.value.length} topics available`;
  }

  return `${filteredTopics.value.length} topics for "${searchQuery.value.trim()}"`;
});
</script>

<template>
  <v-container class="help-center py-8 py-md-10">
    <section class="help-center__intro mb-8">
      <v-chip
        color="primary"
        variant="tonal"
        class="mb-4"
      >
        Help Center
      </v-chip>
      <h1 class="help-center__title">
        CourtMastr Help Center
      </h1>
      <p class="help-center__subtitle">
        Find step-by-step guides for tournament setup, check-in, scoring, public pages, overlays, reports, and platform administration.
      </p>
    </section>

    <v-card
      class="help-center__controls mb-8"
      rounded="lg"
      variant="outlined"
    >
      <v-card-text>
        <v-row dense>
          <v-col
            cols="12"
            md="5"
          >
            <v-text-field
              v-model="searchQuery"
              label="Search help topics"
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              density="comfortable"
              clearable
              hide-details
            />
          </v-col>
          <v-col
            cols="12"
            md="7"
          >
            <HelpRoleFilter v-model="selectedRole" />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <div class="d-flex align-center justify-space-between mb-4">
      <p class="help-center__result-summary">
        {{ resultSummary }}
      </p>
      <v-btn
        v-if="searchQuery || selectedRole"
        variant="text"
        color="primary"
        @click="searchQuery = ''; selectedRole = null"
      >
        Clear filters
      </v-btn>
    </div>

    <HelpSearchEmptyState
      v-if="filteredTopics.length === 0"
      :query="searchQuery"
    />

    <v-row
      v-else
      class="help-center__topics"
      dense
    >
      <v-col
        v-for="topic in filteredTopics"
        :key="topic.slug"
        cols="12"
        md="6"
        lg="4"
      >
        <HelpTopicCard :topic="topic" />
      </v-col>
    </v-row>

    <p class="help-center__coverage mt-8">
      {{ helpTopics.length }} guides are maintained from current CourtMastr routes, feature modules, stores, composables, tests, and feature-rule documentation.
    </p>
  </v-container>
</template>

<style scoped>
.help-center {
  max-width: 1240px;
}

.help-center__intro {
  max-width: 820px;
}

.help-center__title {
  margin: 0 0 12px;
  font-size: clamp(2rem, 5vw, 3.5rem);
  line-height: 1.08;
  font-weight: 800;
  color: rgba(var(--v-theme-on-surface), 0.94);
}

.help-center__subtitle {
  margin: 0;
  font-size: 1.08rem;
  line-height: 1.65;
  color: rgba(var(--v-theme-on-surface), 0.72);
}

.help-center__controls {
  border-color: rgba(var(--v-theme-on-surface), 0.12);
}

.help-center__result-summary,
.help-center__coverage {
  margin: 0;
  color: rgba(var(--v-theme-on-surface), 0.68);
}

.help-center__coverage {
  line-height: 1.6;
}
</style>
