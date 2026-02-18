<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useTournamentReadiness, type ReadinessItem } from '@/composables/useTournamentReadiness';

interface Props {
  tournamentId: string;
}

const props = defineProps<Props>();
const router = useRouter();

const { readiness } = useTournamentReadiness(computed(() => props.tournamentId));

const progressColor = computed(() => {
  if (readiness.value.progressPercent >= 80) return 'success';
  if (readiness.value.progressPercent >= 50) return 'warning';
  return 'info';
});

const completedItems = computed(() => 
  readiness.value.items.filter(item => item.completed)
);

const pendingItems = computed(() => 
  readiness.value.items.filter(item => !item.completed)
);

function navigateTo(route: string) {
  router.push(route);
}

function getItemColor(item: ReadinessItem): string {
  if (item.completed) return 'success';
  if (item.optional) return 'grey';
  return 'primary';
}
</script>

<template>
  <v-card variant="outlined">
    <v-card-title class="d-flex align-center py-3">
      <v-icon
        start
        color="primary"
        class="mr-2"
      >
        mdi-clipboard-check
      </v-icon>
      Setup Checklist
      <v-spacer />
      <v-chip
        :color="readiness.isReady ? 'success' : progressColor"
        size="small"
        variant="tonal"
      >
        {{ readiness.completedCount }}/{{ readiness.items.length }}
      </v-chip>
    </v-card-title>

    <v-card-text class="pt-0">
      <!-- Progress Bar -->
      <v-progress-linear
        v-model="readiness.progressPercent"
        :color="progressColor"
        height="8"
        rounded
        class="mb-4"
      />

      <!-- Completed Items (Collapsible) -->
      <v-expansion-panels
        v-if="completedItems.length > 0"
        variant="accordion"
        class="mb-2"
      >
        <v-expansion-panel>
          <v-expansion-panel-title>
            <div class="d-flex align-center">
              <v-icon
                color="success"
                class="mr-2"
              >
                mdi-check-circle
              </v-icon>
              <span class="text-body-2">Completed ({{ completedItems.length }})</span>
            </div>
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-list
              density="compact"
              class="pa-0"
            >
              <v-list-item
                v-for="item in completedItems"
                :key="item.id"
                :prepend-icon="item.icon"
                :title="item.label"
                :subtitle="item.description"
                class="text-success"
                @click="navigateTo(item.route)"
              >
                <template #prepend>
                  <v-icon color="success">
                    {{ item.icon }}
                  </v-icon>
                </template>
              </v-list-item>
            </v-list>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>

      <!-- Pending Items -->
      <v-list
        density="compact"
        class="pa-0"
      >
        <v-list-item
          v-for="item in pendingItems"
          :key="item.id"
          class="mb-1 rounded"
          :class="{ 'bg-grey-lighten-4': !item.optional }"
          @click="navigateTo(item.route)"
        >
          <template #prepend>
            <v-icon :color="getItemColor(item)">
              {{ item.completed ? 'mdi-check-circle' : item.icon }}
            </v-icon>
          </template>

          <v-list-item-title :class="{ 'text-grey': item.optional }">
            {{ item.label }}
            <v-chip
              v-if="item.optional"
              size="x-small"
              variant="tonal"
              color="grey"
              class="ml-2"
            >
              Optional
            </v-chip>
          </v-list-item-title>

          <v-list-item-subtitle class="text-caption">
            {{ item.description }}
          </v-list-item-subtitle>

          <template #append>
            <v-btn
              icon="mdi-chevron-right"
              variant="text"
              size="small"
              density="compact"
              :color="getItemColor(item)"
            />
          </template>
        </v-list-item>
      </v-list>

      <!-- Ready Message -->
      <v-alert
        v-if="readiness.isReady"
        type="success"
        variant="tonal"
        class="mt-4"
        density="compact"
      >
        <template #prepend>
          <v-icon>mdi-party-popper</v-icon>
        </template>
        Tournament is ready to start!
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.v-list-item {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.v-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
}
</style>
