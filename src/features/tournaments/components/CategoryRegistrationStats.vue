<script setup lang="ts">
import { computed } from 'vue';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { FORMAT_LABELS, AGE_GROUP_LABELS } from '@/types';
import type { Category, Registration } from '@/types';

const props = defineProps<{
  tournamentId: string;
}>();

const registrationStore = useRegistrationStore();
const tournamentStore = useTournamentStore();

const categories = computed(() => tournamentStore.categories);
const registrations = computed(() => registrationStore.registrations);
const players = computed(() => registrationStore.players);

// Calculate stats for each category
const categoryStats = computed(() => {
  return categories.value.map((category) => {
    const categoryRegs = registrations.value.filter(
      (r) => r.categoryId === category.id
    );

    const pending = categoryRegs.filter((r) => r.status === 'pending').length;
    const approved = categoryRegs.filter((r) => r.status === 'approved').length;
    const checkedIn = categoryRegs.filter((r) => r.status === 'checked_in').length;
    const withdrawn = categoryRegs.filter((r) => r.status === 'withdrawn').length;
    const rejected = categoryRegs.filter((r) => r.status === 'rejected').length;

    const total = categoryRegs.length;
    const ready = approved + checkedIn; // Ready to play
    const seeded = categoryRegs.filter((r) => r.seed !== undefined && r.seed !== null).length;

    return {
      category,
      total,
      pending,
      approved,
      checkedIn,
      withdrawn,
      rejected,
      ready,
      seeded,
      registrations: categoryRegs,
    };
  });
});

// Overall tournament stats
const overallStats = computed(() => {
  const total = registrations.value.length;
  const pending = registrations.value.filter((r) => r.status === 'pending').length;
  const approved = registrations.value.filter((r) => r.status === 'approved').length;
  const checkedIn = registrations.value.filter((r) => r.status === 'checked_in').length;
  const ready = approved + checkedIn;

  return {
    total,
    pending,
    approved,
    checkedIn,
    ready,
    categories: categories.value.length,
    players: players.value.length,
  };
});

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    checked_in: 'info',
    withdrawn: 'grey',
    rejected: 'error',
  };
  return colors[status] || 'grey';
}

function getCategoryTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    singles: 'mdi-account',
    doubles: 'mdi-account-multiple',
    mixed_doubles: 'mdi-account-multiple-outline',
  };
  return icons[type] || 'mdi-account';
}

function canGenerateBracket(stats: typeof categoryStats.value[0]): boolean {
  return stats.category.status === 'setup' && stats.ready >= 2;
}

const emit = defineEmits<{
  (e: 'generate-bracket', categoryId: string): void;
  (e: 'regenerate-bracket', categoryId: string): void;
  (e: 'manage-registrations', categoryId: string): void;
  (e: 'manage-seeds', categoryId: string): void;
}>();

// Check if category has pending registrations that should be reviewed
function hasPendingWarning(stats: typeof categoryStats.value[0]): boolean {
  return stats.pending > 0 && stats.category.status === 'setup';
}

// Check if category needs seeding
function needsSeeding(stats: typeof categoryStats.value[0]): boolean {
  return stats.category.seedingEnabled && stats.seeded === 0 && stats.ready >= 4;
}

// Calculate bracket size info
function getBracketInfo(stats: typeof categoryStats.value[0]): { size: number; byes: number } {
  const ready = stats.ready;
  if (ready < 2) return { size: 0, byes: 0 };
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(ready)));
  const byes = bracketSize - ready;
  return { size: bracketSize, byes };
}

function hasCompletedMatches(categoryId: string): boolean {
  // Check if there are any completed matches for this category
  // We'll rely on the parent component to track this via matchStore
  return false; // Default - parent will provide actual logic
}
</script>

<template>
  <div class="category-stats">
    <!-- Overall Summary -->
    <v-row class="mb-4">
      <v-col
        cols="6"
        sm="4"
        md="2"
      >
        <v-card
          variant="tonal"
          color="primary"
        >
          <v-card-text class="text-center pa-3">
            <div class="text-h4 font-weight-bold">
              {{ overallStats.categories }}
            </div>
            <div class="text-caption">
              Categories
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="6"
        sm="4"
        md="2"
      >
        <v-card
          variant="tonal"
          color="info"
        >
          <v-card-text class="text-center pa-3">
            <div class="text-h4 font-weight-bold">
              {{ overallStats.total }}
            </div>
            <div class="text-caption">
              Total Registrations
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="6"
        sm="4"
        md="2"
      >
        <v-card
          variant="tonal"
          color="success"
        >
          <v-card-text class="text-center pa-3">
            <div class="text-h4 font-weight-bold">
              {{ overallStats.ready }}
            </div>
            <div class="text-caption">
              Ready to Play
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="6"
        sm="4"
        md="2"
      >
        <v-card
          variant="tonal"
          color="warning"
        >
          <v-card-text class="text-center pa-3">
            <div class="text-h4 font-weight-bold">
              {{ overallStats.pending }}
            </div>
            <div class="text-caption">
              Pending Approval
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="6"
        sm="4"
        md="2"
      >
        <v-card
          variant="tonal"
          color="secondary"
        >
          <v-card-text class="text-center pa-3">
            <div class="text-h4 font-weight-bold">
              {{ overallStats.checkedIn }}
            </div>
            <div class="text-caption">
              Checked In
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="6"
        sm="4"
        md="2"
      >
        <v-card variant="tonal">
          <v-card-text class="text-center pa-3">
            <div class="text-h4 font-weight-bold">
              {{ overallStats.players }}
            </div>
            <div class="text-caption">
              Total Players
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Category Cards -->
    <v-row>
      <v-col
        v-for="stats in categoryStats"
        :key="stats.category.id"
        cols="12"
        md="6"
        lg="4"
      >
        <v-card class="h-100">
          <v-card-title class="d-flex align-center">
            <v-icon
              :icon="getCategoryTypeIcon(stats.category.type)"
              class="mr-2"
            />
            <span class="flex-grow-1">{{ stats.category.name }}</span>
            <v-chip
              :color="stats.category.status === 'active' ? 'success' : 'grey'"
              size="small"
            >
              {{ stats.category.status }}
            </v-chip>
          </v-card-title>

          <v-card-subtitle class="pb-0">
            <v-chip
              size="x-small"
              variant="outlined"
              class="mr-1"
            >
              {{ FORMAT_LABELS[stats.category.format] || stats.category.format }}
            </v-chip>
            <v-chip
              v-if="stats.category.ageGroup && stats.category.ageGroup !== 'open'"
              size="x-small"
              variant="outlined"
            >
              {{ AGE_GROUP_LABELS[stats.category.ageGroup] || stats.category.ageGroup }}
            </v-chip>
            <v-chip
              v-if="stats.category.minGamesGuaranteed"
              size="x-small"
              variant="outlined"
              color="info"
            >
              Min {{ stats.category.minGamesGuaranteed }} games
            </v-chip>
          </v-card-subtitle>

          <v-card-text>
            <!-- Warning: Pending Registrations -->
            <v-alert
              v-if="hasPendingWarning(stats)"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-3"
            >
              <div class="d-flex align-center">
                <div class="flex-grow-1">
                  <strong>{{ stats.pending }} pending</strong> - these players won't be in the bracket until approved
                </div>
                <v-btn
                  size="x-small"
                  variant="text"
                  color="warning"
                  @click="emit('manage-registrations', stats.category.id)"
                >
                  Review
                </v-btn>
              </div>
            </v-alert>

            <!-- Warning: No Seeds Set -->
            <v-alert
              v-if="needsSeeding(stats)"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-3"
            >
              <div class="d-flex align-center">
                <div class="flex-grow-1">
                  <strong>No seeds set</strong> - top players should be seeded for fair brackets
                </div>
                <v-btn
                  size="x-small"
                  variant="text"
                  color="info"
                  @click="emit('manage-seeds', stats.category.id)"
                >
                  Set Seeds
                </v-btn>
              </div>
            </v-alert>

            <!-- Info: Bracket Size with Byes -->
            <v-alert
              v-if="stats.category.status === 'setup' && getBracketInfo(stats).byes > 0 && stats.ready >= 2"
              type="info"
              variant="tonal"
              density="compact"
              class="mb-3"
            >
              <div class="text-caption">
                <strong>{{ stats.ready }} players</strong> will create a bracket of {{ getBracketInfo(stats).size }} with <strong>{{ getBracketInfo(stats).byes }} bye{{ getBracketInfo(stats).byes > 1 ? 's' : '' }}</strong>.
                Top seeded players will get byes.
              </div>
            </v-alert>

            <!-- Registration Stats -->
            <div class="registration-stats my-3">
              <div class="d-flex justify-space-between align-center mb-2">
                <span class="text-body-2">Registrations</span>
                <span class="text-h6 font-weight-bold">{{ stats.total }}</span>
              </div>

              <!-- Status breakdown -->
              <div class="status-breakdown">
                <div class="status-row d-flex align-center mb-1">
                  <v-icon
                    size="16"
                    color="success"
                    class="mr-2"
                  >
                    mdi-check-circle
                  </v-icon>
                  <span class="text-body-2 flex-grow-1">Ready to play</span>
                  <v-chip
                    size="x-small"
                    color="success"
                    variant="tonal"
                  >
                    {{ stats.ready }}
                  </v-chip>
                </div>
                <div
                  v-if="stats.pending > 0"
                  class="status-row d-flex align-center mb-1"
                >
                  <v-icon
                    size="16"
                    color="warning"
                    class="mr-2"
                  >
                    mdi-clock-outline
                  </v-icon>
                  <span class="text-body-2 flex-grow-1">Pending approval</span>
                  <v-chip
                    size="x-small"
                    color="warning"
                    variant="tonal"
                  >
                    {{ stats.pending }}
                  </v-chip>
                </div>
                <div
                  v-if="stats.checkedIn > 0"
                  class="status-row d-flex align-center mb-1"
                >
                  <v-icon
                    size="16"
                    color="info"
                    class="mr-2"
                  >
                    mdi-check-decagram
                  </v-icon>
                  <span class="text-body-2 flex-grow-1">Checked in</span>
                  <v-chip
                    size="x-small"
                    color="info"
                    variant="tonal"
                  >
                    {{ stats.checkedIn }}
                  </v-chip>
                </div>
                <div
                  v-if="stats.seeded > 0"
                  class="status-row d-flex align-center mb-1"
                >
                  <v-icon
                    size="16"
                    color="primary"
                    class="mr-2"
                  >
                    mdi-seed
                  </v-icon>
                  <span class="text-body-2 flex-grow-1">Seeded</span>
                  <v-chip
                    size="x-small"
                    color="primary"
                    variant="tonal"
                  >
                    {{ stats.seeded }}
                  </v-chip>
                </div>
                <div
                  v-if="stats.withdrawn > 0"
                  class="status-row d-flex align-center mb-1"
                >
                  <v-icon
                    size="16"
                    color="grey"
                    class="mr-2"
                  >
                    mdi-account-remove
                  </v-icon>
                  <span class="text-body-2 flex-grow-1">Withdrawn</span>
                  <v-chip
                    size="x-small"
                    color="grey"
                    variant="tonal"
                  >
                    {{ stats.withdrawn }}
                  </v-chip>
                </div>
              </div>

              <!-- Progress bar for bracket readiness -->
              <div class="mt-3">
                <div class="d-flex justify-space-between text-caption mb-1">
                  <span>Bracket readiness</span>
                  <span>{{ stats.ready }} / {{ stats.category.maxParticipants || '∞' }}</span>
                </div>
                <v-progress-linear
                  :model-value="stats.category.maxParticipants ? (stats.ready / stats.category.maxParticipants) * 100 : 50"
                  :color="stats.ready >= 2 ? 'success' : 'warning'"
                  height="8"
                  rounded
                />
              </div>
            </div>
          </v-card-text>

          <v-divider />

          <v-card-actions>
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-account-group"
              @click="emit('manage-registrations', stats.category.id)"
            >
              Manage
            </v-btn>
            <v-btn
              v-if="stats.category.seedingEnabled && stats.ready >= 4"
              size="small"
              variant="text"
              prepend-icon="mdi-seed"
              data-testid="manage-seeds-btn"
              @click="emit('manage-seeds', stats.category.id)"
            >
              Seeds
            </v-btn>
            <v-spacer />
            <v-btn
              v-if="canGenerateBracket(stats)"
              size="small"
              color="primary"
              variant="tonal"
              prepend-icon="mdi-tournament"
              @click="emit('generate-bracket', stats.category.id)"
            >
              Generate Bracket
            </v-btn>
            <v-menu v-else-if="stats.category.status === 'active'">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  size="small"
                  color="success"
                  variant="tonal"
                >
                  <v-icon
                    start
                    size="16"
                  >
                    mdi-check
                  </v-icon>
                  Bracket Ready
                  <v-icon
                    end
                    size="16"
                  >
                    mdi-chevron-down
                  </v-icon>
                </v-btn>
              </template>
              <v-list density="compact">
                <v-list-item
                  prepend-icon="mdi-refresh"
                  @click="emit('regenerate-bracket', stats.category.id)"
                >
                  <v-list-item-title>Regenerate Bracket</v-list-item-title>
                  <v-list-item-subtitle>Fix progression links</v-list-item-subtitle>
                </v-list-item>
              </v-list>
            </v-menu>
            <v-chip
              v-else-if="stats.ready < 2"
              size="small"
              color="warning"
              variant="tonal"
            >
              Need {{ 2 - stats.ready }} more
            </v-chip>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Empty State -->
    <v-row v-if="categoryStats.length === 0">
      <v-col cols="12">
        <v-card class="text-center pa-8">
          <v-icon
            size="64"
            color="grey-lighten-1"
          >
            mdi-folder-open
          </v-icon>
          <p class="text-h6 mt-4">
            No categories created yet
          </p>
          <p class="text-body-2 text-grey">
            Add categories to start accepting registrations
          </p>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.registration-stats {
  background: rgba(var(--v-theme-surface-variant), 0.3);
  border-radius: 8px;
  padding: 12px;
}

.status-row {
  padding: 4px 0;
}
</style>
