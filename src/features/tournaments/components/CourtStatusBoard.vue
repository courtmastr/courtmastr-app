<script setup lang="ts">
import { computed } from 'vue';
import { computed } from 'vue';
import { differenceInMinutes } from 'date-fns';
import CourtSummary from './CourtSummary.vue';

interface Court {
  id: string;
  name: string;
  number: number;
  status?: 'available' | 'in_use' | 'maintenance';
  currentMatchId?: string;
}

interface Match {
  id: string;
  participant1Id: string;
  participant2Id: string;
  participant1Name?: string;
  participant2Name?: string;
  startedAt?: Date;
}

const props = defineProps<{
  courts: Court[];
  matches: Match[];
  availableCourts: Court[];
  nextQueuedMatch: Match | null;
}>();

const busyCourts = computed(() => props.courts.filter(c => c.status === 'in_use').length);
const idleCourts = computed(() => props.availableCourts.length);

const emit = defineEmits<{
  assignNext: [courtId: string];
  releaseCourt: [courtId: string];
  setMaintenance: [courtId: string];
  restoreCourt: [courtId: string];
}>();

function getCourtColor(court: Court): string {
  if (!court.status || court.status === 'available') return 'success';
  if (court.status === 'in_use') return 'primary';
  if (court.status === 'maintenance') return 'warning';
  return 'grey';
}

function getCurrentMatch(court: Court): Match | null {
  if (!court.currentMatchId) return null;
  return props.matches.find(m => m.id === court.currentMatchId) || null;
}

function getMatchDuration(match: Match): string {
  if (!match.startedAt) return '';
  const minutes = differenceInMinutes(new Date(), match.startedAt);
  return `${minutes} min`;
}

function getParticipantNames(match: Match): string {
  const p1 = match.participant1Name || 'Player 1';
  const p2 = match.participant2Name || 'Player 2';
  return `${p1} vs ${p2}`;
}
</script>

<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon start>
        mdi-court-sport
      </v-icon>
      Court Status
      <v-spacer />
      <CourtSummary
        :busy-courts="busyCourts"
        :total-courts="courts.length"
        :idle-courts="idleCourts"
      />
    </v-card-title>

    <v-divider />

    <v-card-text>
      <v-row>
        <v-col
          v-for="court in courts"
          :key="court.id"
          cols="12"
          sm="6"
          md="4"
          lg="3"
        >
          <v-card
            :color="getCourtColor(court)"
            variant="tonal"
            elevation="2"
          >
            <v-card-title class="text-subtitle-1 d-flex align-center">
              <v-icon
                start
                size="small"
              >
                {{
                  court.status === 'available'
                    ? 'mdi-check-circle'
                    : court.status === 'in_use'
                      ? 'mdi-circle-slice-8'
                      : 'mdi-alert-circle'
                }}
              </v-icon>
              {{ court.name }}
              <v-spacer />
              <v-menu>
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon="mdi-dots-vertical"
                    size="default"
                    variant="text"
                    min-width="44"
                    min-height="44"
                  />
                </template>
                <v-list density="comfortable">
                  <v-list-item
                    v-if="court.status === 'in_use'"
                    @click="emit('releaseCourt', court.id)"
                  >
                    <v-list-item-title>
                      <v-icon
                        start
                        size="default"
                      >
                        mdi-close-circle
                      </v-icon>
                      Release Court
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item
                    v-if="court.status !== 'maintenance'"
                    @click="emit('setMaintenance', court.id)"
                  >
                    <v-list-item-title>
                      <v-icon
                        start
                        size="default"
                      >
                        mdi-wrench
                      </v-icon>
                      Set Maintenance
                    </v-list-item-title>
                  </v-list-item>
                  <v-list-item
                    v-if="court.status === 'maintenance'"
                    @click="emit('restoreCourt', court.id)"
                  >
                    <v-list-item-title>
                      <v-icon
                        start
                        size="default"
                      >
                        mdi-check
                      </v-icon>
                      Restore Court
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </v-card-title>

            <v-divider />

            <v-card-text>
              <!-- Available -->
              <div v-if="court.status === 'available' || !court.status">
                <div class="text-center py-2">
                  <v-icon
                    size="48"
                    color="success"
                  >
                    mdi-check-circle-outline
                  </v-icon>
                  <div class="text-caption mt-2">
                    Ready for match
                  </div>
                </div>

                <v-btn
                  v-if="nextQueuedMatch"
                  block
                  color="primary"
                  variant="elevated"
                  prepend-icon="mdi-play"
                  @click="emit('assignNext', court.id)"
                >
                  Assign Next Match
                </v-btn>
                <v-btn
                  v-else
                  block
                  color="grey"
                  variant="text"
                  disabled
                >
                  No Matches in Queue
                </v-btn>
              </div>

              <!-- In Use -->
              <div v-else-if="court.status === 'in_use'">
                <template v-if="getCurrentMatch(court)">
                  <div class="text-body-2 font-weight-medium mb-2">
                    {{ getParticipantNames(getCurrentMatch(court)!) }}
                  </div>
                  <div class="text-caption d-flex align-center">
                    <v-icon
                      start
                      size="small"
                    >
                      mdi-clock-outline
                    </v-icon>
                    Duration: {{ getMatchDuration(getCurrentMatch(court)!) }}
                  </div>
                </template>
                <div
                  v-else
                  class="text-caption text-center py-2"
                >
                  Match in progress
                </div>
              </div>

              <!-- Maintenance -->
              <div v-else-if="court.status === 'maintenance'">
                <div class="text-center py-2">
                  <v-icon
                    size="48"
                    color="warning"
                  >
                    mdi-wrench
                  </v-icon>
                  <div class="text-caption mt-2">
                    Under maintenance
                  </div>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Empty State -->
      <v-alert
        v-if="courts.length === 0"
        type="info"
        variant="tonal"
        text="No courts configured for this tournament"
      />
    </v-card-text>
  </v-card>
</template>

<style scoped>
.v-card {
  height: 100%;
}

/* Mobile responsive adjustments */
@media (max-width: 768px) {
  .v-card {
    margin-bottom: 12px;
  }
  
  /* Ensure proper spacing on mobile */
  :deep(.v-card-text) {
    padding: 12px !important;
  }
}
</style>
