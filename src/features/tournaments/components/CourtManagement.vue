<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTournamentStore } from '@/stores/tournaments';
import { useNotificationStore } from '@/stores/notifications';
import { useActivityStore } from '@/stores/activities';
import { useRegistrationStore } from '@/stores/registrations';
import { useMatchStore } from '@/stores/matches';
import type { Court, CourtStatus } from '@/types';

const props = defineProps<{
  tournamentId: string;
}>();

const tournamentStore = useTournamentStore();
const notificationStore = useNotificationStore();
const activityStore = useActivityStore();
const registrationStore = useRegistrationStore();
const matchStore = useMatchStore();

const courts = computed(() => tournamentStore.courts);

// Dialog state
const showDialog = ref(false);
const editingCourt = ref<Court | null>(null);
const loading = ref(false);

// Form state
const form = ref({
  name: '',
  number: 1,
  status: 'available' as CourtStatus,
});

const statusOptions: { value: CourtStatus; title: string; color: string }[] = [
  { value: 'available', title: 'Available', color: 'success' },
  { value: 'in_use', title: 'In Use', color: 'info' },
  { value: 'maintenance', title: 'Maintenance', color: 'warning' },
];

function openAddDialog() {
  editingCourt.value = null;
  const nextNumber = courts.value.length + 1;
  form.value = {
    name: `Court ${nextNumber}`,
    number: nextNumber,
    status: 'available',
  };
  showDialog.value = true;
}

function openEditDialog(court: Court) {
  editingCourt.value = court;
  form.value = {
    name: court.name,
    number: court.number,
    status: court.status,
  };
  showDialog.value = true;
}

async function saveCourt() {
  if (!form.value.name.trim()) {
    notificationStore.showToast('error', 'Court name is required');
    return;
  }

  loading.value = true;
  try {
    const courtData = {
      name: form.value.name,
      number: form.value.number,
      status: form.value.status,
    };

    if (editingCourt.value) {
      await tournamentStore.updateCourt(props.tournamentId, editingCourt.value.id, courtData);
      notificationStore.showToast('success', 'Court updated');
    } else {
      await tournamentStore.addCourt(props.tournamentId, courtData);
      notificationStore.showToast('success', 'Court added');
    }
    showDialog.value = false;
  } catch (error) {
    notificationStore.showToast('error', 'Failed to save court');
  } finally {
    loading.value = false;
  }
}

async function deleteCourt(court: Court) {
  if (court.status === 'in_use') {
    notificationStore.showToast('error', 'Cannot delete court while in use');
    return;
  }

  if (!confirm(`Delete "${court.name}"? This cannot be undone.`)) {
    return;
  }

  try {
    await tournamentStore.deleteCourt(props.tournamentId, court.id);
    notificationStore.showToast('success', 'Court deleted');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to delete court');
  }
}

// Helper to get participant name
function getParticipantName(registrationId: string | undefined): string {
  if (!registrationId) return 'TBD';
  const registration = registrationStore.registrations.find((r) => r.id === registrationId);
  if (!registration) return 'Unknown';

  if (registration.teamName) return registration.teamName;

  const player = registrationStore.players.find((p) => p.id === registration.playerId);
  if (player) return `${player.firstName} ${player.lastName}`;

  return 'Unknown';
}

async function toggleCourtStatus(court: Court) {
  try {
    if (court.status === 'available') {
      // Setting to maintenance - use special function that reassigns matches
      const result = await tournamentStore.setCourtMaintenance(props.tournamentId, court.id);

      // Log maintenance activity (non-blocking - don't fail if logging fails)
      activityStore.logCourtMaintenance(props.tournamentId, court.id, court.name)
        .catch((err) => console.warn('Activity logging failed:', err));

      // Log any reassigned matches (non-blocking)
      for (const reassigned of result.reassignedMatches) {
        const match = matchStore.matches.find((m) => m.id === reassigned.matchId);
        if (match) {
          const p1Name = getParticipantName(match.participant1Id);
          const p2Name = getParticipantName(match.participant2Id);
          activityStore.logMatchReassigned(
            props.tournamentId,
            match.id,
            p1Name,
            p2Name,
            court.name,
            reassigned.newCourtName,
            'Court under maintenance'
          ).catch((err) => console.warn('Activity logging failed:', err));
        }
      }

      if (result.reassignedMatches.length > 0) {
        notificationStore.showToast(
          'success',
          `${court.name} set to maintenance. ${result.reassignedMatches.length} match(es) reassigned.`
        );
      } else {
        notificationStore.showToast('success', `${court.name} set to maintenance`);
      }
    } else {
      // Restoring from maintenance to available
      await tournamentStore.restoreCourtFromMaintenance(props.tournamentId, court.id);
      // Log activity (non-blocking)
      activityStore.logCourtAvailable(props.tournamentId, court.id, court.name)
        .catch((err) => console.warn('Activity logging failed:', err));
      notificationStore.showToast('success', `${court.name} is now available`);
    }
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update court status');
  }
}

async function addMultipleCourts() {
  const count = prompt('How many courts to add?', '4');
  if (!count) return;

  const numCourts = parseInt(count);
  if (isNaN(numCourts) || numCourts < 1 || numCourts > 20) {
    notificationStore.showToast('error', 'Please enter a number between 1 and 20');
    return;
  }

  loading.value = true;
  try {
    const startNumber = courts.value.length + 1;
    for (let i = 0; i < numCourts; i++) {
      const courtNumber = startNumber + i;
      await tournamentStore.addCourt(props.tournamentId, {
        name: `Court ${courtNumber}`,
        number: courtNumber,
        status: 'available',
      });
    }
    notificationStore.showToast('success', `Added ${numCourts} courts`);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to add courts');
  } finally {
    loading.value = false;
  }
}

function getStatusColor(status: CourtStatus): string {
  return statusOptions.find(s => s.value === status)?.color || 'grey';
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="d-flex justify-space-between align-center mb-4">
      <h3 class="text-h6">Courts ({{ courts.length }})</h3>
      <div>
        <v-btn variant="outlined" class="mr-2" @click="addMultipleCourts" :loading="loading">
          Add Multiple
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-plus" data-testid="add-court-btn" @click="openAddDialog">
          Add Court
        </v-btn>
      </div>
    </div>

    <!-- Court Grid -->
    <v-row v-if="courts.length > 0">
      <v-col
        v-for="court in courts"
        :key="court.id"
        cols="6"
        sm="4"
        md="3"
      >
        <v-card
          :color="getStatusColor(court.status)"
          variant="tonal"
          class="court-card"
        >
          <v-card-item>
            <template #prepend>
              <v-icon size="32">mdi-badminton</v-icon>
            </template>
            <v-card-title>{{ court.name }}</v-card-title>
            <v-card-subtitle>
              <v-chip :color="getStatusColor(court.status)" size="x-small">
                {{ court.status }}
              </v-chip>
            </v-card-subtitle>
          </v-card-item>
          <v-card-actions>
            <v-btn
              v-if="court.status !== 'in_use'"
              size="small"
              variant="text"
              @click="toggleCourtStatus(court)"
            >
              {{ court.status === 'available' ? 'Set Maintenance' : 'Set Available' }}
            </v-btn>
            <v-spacer />
            <v-btn icon="mdi-pencil" size="small" variant="text" data-testid="edit-court-btn" @click="openEditDialog(court)" />
            <v-btn
              icon="mdi-delete"
              size="small"
              variant="text"
              color="error"
              data-testid="delete-court-btn"
              :disabled="court.status === 'in_use'"
              @click="deleteCourt(court)"
            />
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Empty State -->
    <v-card v-else class="text-center py-8">
      <v-icon size="48" color="grey-lighten-1">mdi-badminton</v-icon>
      <p class="text-body-2 text-grey mt-2">No courts configured. Add courts to start scheduling matches.</p>
      <v-btn color="primary" class="mt-4" @click="addMultipleCourts">
        Add Courts
      </v-btn>
    </v-card>

    <!-- Add/Edit Dialog -->
    <v-dialog v-model="showDialog" max-width="400" persistent>
      <v-card>
        <v-card-title>
          {{ editingCourt ? 'Edit Court' : 'Add Court' }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="form.name"
            label="Court Name"
            data-testid="court-name-input"
            placeholder="e.g., Court 1, Main Court, etc."
          />
          <v-text-field
            v-model.number="form.number"
            label="Court Number"
            type="number"
            min="1"
            hint="Used for ordering"
            persistent-hint
          />
          <v-select
            v-model="form.status"
            :items="statusOptions"
            item-title="title"
            item-value="value"
            label="Status"
          >
            <template #item="{ item, props }">
              <v-list-item v-bind="props">
                <template #prepend>
                  <v-icon :color="item.raw.color">mdi-circle</v-icon>
                </template>
              </v-list-item>
            </template>
          </v-select>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDialog = false">Cancel</v-btn>
          <v-btn color="primary" data-testid="save-court-btn" :loading="loading" @click="saveCourt">
            {{ editingCourt ? 'Update' : 'Add' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.court-card {
  transition: transform 0.2s;
}
.court-card:hover {
  transform: translateY(-2px);
}
</style>
