<script setup lang="ts">
import { computed } from 'vue';

interface Court {
  id: string;
  name: string;
  number: number;
  status: 'available' | 'in_use' | 'maintenance';
}

interface Match {
  id: string;
  status: string;
  courtId?: string;
}

const props = defineProps<{
  courts: Court[];
  matches: Match[];
  autoAssignEnabled: boolean;
  selectedMatchCount?: number;
}>();

const emit = defineEmits<{
  toggleAutoAssign: [enabled: boolean];
  batchAssign: [];
  batchComplete: [];
  refreshData: [];
}>();

const availableCourtsCount = computed(() =>
  props.courts.filter(c => c.status === 'available').length
);

const activeCourtsCount = computed(() =>
  props.courts.filter(c => c.status === 'in_use').length
);

const maintenanceCourtsCount = computed(() =>
  props.courts.filter(c => c.status === 'maintenance').length
);

const needsCourtMatchesCount = computed(() =>
  props.matches.filter(m => m.status === 'scheduled' && !m.courtId).length
);

const scheduledMatchesCount = computed(() =>
  props.matches.filter(m => m.status === 'scheduled').length
);

const readyMatchesCount = computed(() =>
  props.matches.filter(m => m.status === 'ready').length
);

const inProgressMatchesCount = computed(() =>
  props.matches.filter(m => m.status === 'in_progress').length
);

const completedMatchesCount = computed(() =>
  props.matches.filter(m => m.status === 'completed').length
);

const pendingMatchesCount = computed(() =>
  props.matches.filter(m => m.status === 'scheduled' || m.status === 'ready').length
);
</script>

<template>
  <v-card
    class="quick-actions-bar mb-4"
    elevation="2"
  >
    <v-card-text class="pa-4">
      <div class="d-flex flex-wrap align-center ga-4">
        <!-- Left Section: Stats -->
        <div class="stats-section d-flex flex-wrap ga-3 flex-grow-1">
          <!-- Courts Stats -->
          <v-chip
            color="success"
            variant="tonal"
            size="default"
            class="stat-chip"
          >
            <v-icon start>
              mdi-check-circle
            </v-icon>
            <span class="font-weight-medium">{{ availableCourtsCount }} Courts Free</span>
          </v-chip>

          <v-chip
            color="info"
            variant="tonal"
            size="default"
            class="stat-chip"
          >
            <v-icon start>
              mdi-play-circle
            </v-icon>
            <span class="font-weight-medium">{{ activeCourtsCount }} Active</span>
          </v-chip>

          <v-chip
            v-if="maintenanceCourtsCount > 0"
            color="warning"
            variant="tonal"
            size="default"
            class="stat-chip"
          >
            <v-icon start>
              mdi-wrench
            </v-icon>
            <span class="font-weight-medium">{{ maintenanceCourtsCount }} Maintenance</span>
          </v-chip>

          <v-divider
            vertical
            class="mx-2"
          />

          <!-- Match Status Pills - Following feedback spec -->
          <v-chip
            :color="needsCourtMatchesCount > 0 ? 'error' : 'grey'"
            variant="tonal"
            size="default"
            class="stat-chip"
          >
            <v-icon start>
              mdi-help-circle
            </v-icon>
            <span class="font-weight-medium">{{ needsCourtMatchesCount }} Needs Court</span>
          </v-chip>

          <v-chip
            :color="scheduledMatchesCount > 0 ? 'info' : 'grey'"
            variant="tonal"
            size="default"
            class="stat-chip"
          >
            <v-icon start>
              mdi-timer-sand
            </v-icon>
            <span class="font-weight-medium">{{ scheduledMatchesCount }} Scheduled</span>
          </v-chip>

          <v-chip
            :color="readyMatchesCount > 0 ? 'warning' : 'grey'"
            variant="tonal"
            size="default"
            class="stat-chip"
          >
            <v-icon start>
              mdi-check
            </v-icon>
            <span class="font-weight-medium">{{ readyMatchesCount }} Ready</span>
          </v-chip>

          <v-chip
            :color="inProgressMatchesCount > 0 ? 'primary' : 'grey'"
            variant="tonal"
            size="default"
            class="stat-chip"
          >
            <v-icon start>
              mdi-tennis
            </v-icon>
            <span class="font-weight-medium">{{ inProgressMatchesCount }} Playing</span>
          </v-chip>

          <v-chip
            :color="completedMatchesCount > 0 ? 'success' : 'grey'"
            variant="tonal"
            size="default"
            class="stat-chip"
          >
            <v-icon start>
              mdi-check-all
            </v-icon>
            <span class="font-weight-medium">{{ completedMatchesCount }} Done</span>
          </v-chip>
        </div>

        <!-- Right Section: Actions -->
        <div class="actions-section d-flex flex-wrap ga-2">
          <!-- Auto-Assign Toggle -->
          <v-btn
            :color="autoAssignEnabled ? 'success' : 'grey'"
            :variant="autoAssignEnabled ? 'elevated' : 'tonal'"
            class="action-btn"
            @click="emit('toggleAutoAssign', !autoAssignEnabled)"
          >
            <v-icon start>
              {{ autoAssignEnabled ? 'mdi-robot' : 'mdi-robot-off' }}
            </v-icon>
            Auto-Assign {{ autoAssignEnabled ? 'ON' : 'OFF' }}
          </v-btn>

          <!-- Batch Actions (shown when matches selected) -->
          <template v-if="selectedMatchCount && selectedMatchCount > 0">
            <v-btn
              color="primary"
              variant="elevated"
              class="action-btn"
              :disabled="availableCourtsCount === 0"
              @click="emit('batchAssign')"
            >
              <v-icon start>
                mdi-court-sport
              </v-icon>
              Assign {{ selectedMatchCount }} Match{{ selectedMatchCount > 1 ? 'es' : '' }}
            </v-btn>

            <v-btn
              color="success"
              variant="tonal"
              class="action-btn"
              @click="emit('batchComplete')"
            >
              <v-icon start>
                mdi-check-circle
              </v-icon>
              Complete Selected
            </v-btn>
          </template>

          <!-- Refresh Button -->
          <v-btn
            variant="text"
            icon
            class="action-btn-icon"
            @click="emit('refreshData')"
          >
            <v-icon>mdi-refresh</v-icon>
          </v-btn>
        </div>
      </div>

      <!-- Auto-Assign Status Message -->
      <v-alert
        v-if="autoAssignEnabled"
        type="info"
        variant="tonal"
        density="compact"
        class="mt-3 mb-0"
      >
        <template #prepend>
          <v-icon>mdi-information</v-icon>
        </template>
        <span class="text-body-2">
          Auto-assignment is active. Matches will be automatically assigned to available courts.
          <strong>{{ availableCourtsCount }} courts</strong> ready for assignment.
        </span>
      </v-alert>

      <v-alert
        v-else-if="pendingMatchesCount > 0 && availableCourtsCount > 0"
        type="warning"
        variant="tonal"
        density="compact"
        class="mt-3 mb-0"
      >
        <template #prepend>
          <v-icon>mdi-alert</v-icon>
        </template>
        <span class="text-body-2">
          <strong>{{ pendingMatchesCount }} matches</strong> waiting with <strong>{{ availableCourtsCount }} courts</strong> available.
          Enable auto-assign or manually assign matches.
        </span>
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.quick-actions-bar {
  border-radius: 10px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.stats-section {
  min-width: 0; /* Prevent flex overflow */
}

.stat-chip {
  min-height: 36px;
  padding: 8px 12px;
}

.stat-chip :deep(.v-chip__content) {
  font-size: 0.875rem;
}

.action-btn {
  min-height: 44px;
  min-width: 120px;
  font-weight: 500;
}

.action-btn-icon {
  min-height: 44px;
  min-width: 44px;
}

/* Mobile responsive */
@media (max-width: 960px) {
  .stats-section {
    width: 100%;
  }

  .actions-section {
    width: 100%;
    justify-content: flex-start;
  }

  .action-btn {
    flex: 1;
  }
}

@media (max-width: 600px) {
  .stat-chip {
    font-size: 0.75rem;
  }

  .stat-chip :deep(.v-chip__content) {
    font-size: 0.75rem;
  }
}
</style>
