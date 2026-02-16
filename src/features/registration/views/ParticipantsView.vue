<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import StateBanner from '@/features/tournaments/components/StateBanner.vue';
import { normalizeTournamentState } from '@/guards/tournamentState';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const players = computed(() => registrationStore.players);
const registrations = computed(() => registrationStore.registrations);
const loading = computed(() => registrationStore.loading);
const lifecycleState = computed(() => normalizeTournamentState(tournament.value));

// Filter state
const filterCategory = ref<string | null>(null);
const searchQuery = ref('');

// Dialog states
const showEditPlayerDialog = ref(false);
const showDeletePlayerDialog = ref(false);
const showAddPlayerDialog = ref(false);

// Edit/Delete state
const editingPlayer = ref<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  skillLevel: number;
} | null>(null);
const playerToDeleteId = ref<string | null>(null);

// New player form
const newPlayer = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  skillLevel: 5,
});

// Get approved/checked_in registrations (active participants)
const activeRegistrations = computed(() => {
  return registrations.value.filter(r => 
    r.status === 'approved' || r.status === 'checked_in'
  );
});

// Get player IDs from active registrations
const activePlayerIds = computed(() => {
  const ids = new Set<string>();
  activeRegistrations.value.forEach(reg => {
    if (reg.playerId) ids.add(reg.playerId);
    if (reg.partnerPlayerId) ids.add(reg.partnerPlayerId);
  });
  return ids;
});

// Filtered participants (players who are registered)
const filteredParticipants = computed(() => {
  let result = players.value.filter(p => activePlayerIds.value.has(p.id));

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((p) => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
      const email = (p.email || '').toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  }

  return result;
});

// Stats
const participantStats = computed(() => {
  return {
    total: activeRegistrations.value.length,
    checkedIn: activeRegistrations.value.filter(r => r.status === 'checked_in').length,
    singles: activeRegistrations.value.filter(r => !r.partnerPlayerId).length,
    doubles: activeRegistrations.value.filter(r => r.partnerPlayerId).length,
  };
});

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);
});

function getPlayerName(playerId: string): string {
  const player = players.value.find((p) => p.id === playerId);
  return player ? `${player.firstName} ${player.lastName}` : 'Unknown';
}

function getParticipantCategory(playerId: string): string {
  const reg = activeRegistrations.value.find(r => 
    r.playerId === playerId || r.partnerPlayerId === playerId
  );
  if (!reg) return '-';
  const category = categories.value.find(c => c.id === reg.categoryId);
  return category?.name || 'Unknown';
}

function getParticipantStatus(playerId: string): string {
  const reg = activeRegistrations.value.find(r => 
    r.playerId === playerId || r.partnerPlayerId === playerId
  );
  return reg?.status || 'unknown';
}

function openEditPlayerDialog(player: any) {
  editingPlayer.value = {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    email: player.email || '',
    phone: player.phone || '',
    skillLevel: player.skillLevel || 5,
  };
  showEditPlayerDialog.value = true;
}

async function savePlayer() {
  if (!editingPlayer.value) return;

  try {
    await registrationStore.updatePlayer(tournamentId.value, editingPlayer.value.id, {
      firstName: editingPlayer.value.firstName,
      lastName: editingPlayer.value.lastName,
      email: editingPlayer.value.email,
      phone: editingPlayer.value.phone,
      skillLevel: editingPlayer.value.skillLevel,
    });
    notificationStore.showToast('success', 'Player updated successfully');
    showEditPlayerDialog.value = false;
    editingPlayer.value = null;
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update player');
  }
}

function requestDeletePlayer(playerId: string) {
  playerToDeleteId.value = playerId;
  showDeletePlayerDialog.value = true;
}

async function confirmDeletePlayer() {
  if (!playerToDeleteId.value) return;
  showDeletePlayerDialog.value = false;
  try {
    await registrationStore.deletePlayer(tournamentId.value, playerToDeleteId.value);
    notificationStore.showToast('success', 'Player deleted');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to delete player');
  }
}

async function addPlayer() {
  try {
    await registrationStore.addPlayer(tournamentId.value, {
      firstName: newPlayer.value.firstName,
      lastName: newPlayer.value.lastName,
      email: newPlayer.value.email,
      phone: newPlayer.value.phone,
      skillLevel: newPlayer.value.skillLevel,
    });
    notificationStore.showToast('success', 'Player added successfully');
    showAddPlayerDialog.value = false;
    resetPlayerForm();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add player';
    notificationStore.showToast('error', message);
  }
}

function resetPlayerForm() {
  newPlayer.value = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    skillLevel: 5,
  };
}

function clearFilters() {
  searchQuery.value = '';
}
</script>

<template>
  <v-container fluid>
    <!-- Header -->
    <div class="compact-header mb-6">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div>
          <div class="d-flex align-center text-grey-darken-1 text-caption mb-1">
            <v-icon size="small" class="mr-1">mdi-home</v-icon>
            Home <v-icon size="small" class="mx-1">mdi-chevron-right</v-icon>
            Tournaments <v-icon size="small" class="mx-1">mdi-chevron-right</v-icon>
            {{ tournament?.name }}
          </div>
          <div class="d-flex align-center">
            <v-btn
              icon="mdi-arrow-left"
              variant="text"
              color="primary"
              class="mr-2"
              @click="router.back()"
            />
            <h1 class="text-h4 font-weight-bold text-gradient mb-0">
              Participants
            </h1>
          </div>
        </div>
        <div class="d-flex flex-column flex-sm-row gap-2">
          <v-btn
            variant="outlined"
            prepend-icon="mdi-account-plus"
            @click="showAddPlayerDialog = true"
          >
            Add Player
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-format-list-bulleted"
            :to="`/tournaments/${tournamentId}/registrations`"
          >
            Manage Registrations
          </v-btn>
        </div>
      </div>
    </div>

    <StateBanner
      :state="lifecycleState"
      :is-admin="false"
    />

    <!-- Stats Grid -->
    <v-row class="mb-6">
      <v-col cols="6" sm="3">
        <div class="stat-card pa-4 rounded-lg bg-surface">
          <div class="stat-icon-wrapper bg-primary-lighten-4 text-primary">
            <v-icon>mdi-account-group</v-icon>
          </div>
          <div class="text-h4 font-weight-bold mb-1">
            {{ participantStats.total }}
          </div>
          <div class="text-caption font-weight-medium text-grey text-uppercase">
            Total Participants
          </div>
        </div>
      </v-col>
      
      <v-col cols="6" sm="3">
        <div class="stat-card stat-success pa-4 rounded-lg bg-surface">
          <div class="stat-icon-wrapper">
            <v-icon>mdi-check-decagram</v-icon>
          </div>
          <div class="text-h4 font-weight-bold mb-1">
            {{ participantStats.checkedIn }}
          </div>
          <div class="text-caption font-weight-medium text-success text-uppercase">
            Checked In
          </div>
        </div>
      </v-col>

      <v-col cols="6" sm="3">
        <div class="stat-card stat-info pa-4 rounded-lg bg-surface">
          <div class="stat-icon-wrapper">
            <v-icon>mdi-account</v-icon>
          </div>
          <div class="text-h4 font-weight-bold mb-1">
            {{ participantStats.singles }}
          </div>
          <div class="text-caption font-weight-medium text-info text-uppercase">
            Singles
          </div>
        </div>
      </v-col>

      <v-col cols="6" sm="3">
        <div class="stat-card stat-secondary pa-4 rounded-lg bg-surface">
          <div class="stat-icon-wrapper">
            <v-icon>mdi-account-multiple</v-icon>
          </div>
          <div class="text-h4 font-weight-bold mb-1">
            {{ participantStats.doubles }}
          </div>
          <div class="text-caption font-weight-medium text-secondary text-uppercase">
            Doubles Teams
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Participants Table -->
    <v-card>
      <v-card-text class="pb-0">
        <v-row>
          <v-col cols="12" sm="6" md="4">
            <v-text-field
              v-model="searchQuery"
              prepend-inner-icon="mdi-magnify"
              label="Search participants"
              density="compact"
              variant="outlined"
              clearable
              hide-details
            />
          </v-col>
          <v-col
            cols="12"
            sm="6"
            md="8"
            class="d-flex align-center justify-end"
          >
            <v-btn
              v-if="searchQuery"
              variant="text"
              size="small"
              @click="clearFilters"
            >
              Clear Filters
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>

      <v-data-table
        :headers="[
          { title: 'Participant', key: 'name' },
          { title: 'Category', key: 'category' },
          { title: 'Status', key: 'status' },
          { title: 'Skill Level', key: 'skillLevel' },
          { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
        ]"
        :items="filteredParticipants"
        :loading="loading"
        hover
      >
        <template #item.name="{ item }">
          <div class="d-flex align-center py-2">
            <v-avatar size="36" color="primary" class="mr-3">
              <span class="text-caption">{{ item.firstName.charAt(0) }}</span>
            </v-avatar>
            <div>
              <div class="font-weight-medium">{{ item.firstName }} {{ item.lastName }}</div>
              <div class="text-caption text-grey">{{ item.email || 'No email' }}</div>
            </div>
          </div>
        </template>

        <template #item.category="{ item }">
          <v-chip size="small" variant="outlined">
            {{ getParticipantCategory(item.id) }}
          </v-chip>
        </template>

        <template #item.status="{ item }">
          <v-chip
            :color="getParticipantStatus(item.id) === 'checked_in' ? 'success' : 'info'"
            size="small"
            :prepend-icon="getParticipantStatus(item.id) === 'checked_in' ? 'mdi-check-decagram' : 'mdi-check'"
          >
            {{ getParticipantStatus(item.id) === 'checked_in' ? 'Checked In' : 'Approved' }}
          </v-chip>
        </template>

        <template #item.skillLevel="{ item }">
          <div class="d-flex align-center">
            <v-chip size="small" color="primary" variant="tonal" class="mr-2">
              {{ item.skillLevel || 5 }} / 10
            </v-chip>
            <v-progress-linear
              :model-value="((item.skillLevel || 5) / 10) * 100"
              color="primary"
              height="8"
              rounded
              style="width: 80px;"
            />
          </div>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex justify-end">
            <v-btn
              icon="mdi-pencil"
              size="small"
              variant="text"
              color="primary"
              title="Edit Player"
              @click="openEditPlayerDialog(item)"
            />
            <v-btn
              icon="mdi-delete"
              size="small"
              variant="text"
              color="error"
              title="Delete Player"
              @click="requestDeletePlayer(item.id)"
            />
          </div>
        </template>
      </v-data-table>

      <v-card-text v-if="filteredParticipants.length === 0 && !loading">
        <div class="text-center py-8 text-grey">
          <v-icon size="64">mdi-account-off</v-icon>
          <p class="mt-4 text-h6">No participants found</p>
          <p class="text-body-2">
            {{ searchQuery ? 'Try adjusting your search' : 'Add players and approve registrations to see participants here' }}
          </p>
          <v-btn
            v-if="!searchQuery"
            color="primary"
            class="mt-4"
            :to="`/tournaments/${tournamentId}/registrations`"
          >
            Go to Registrations
          </v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- Add Player Dialog -->
    <v-dialog v-model="showAddPlayerDialog" max-width="500">
      <v-card>
        <v-card-title>Add Player</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model="newPlayer.firstName"
                label="First Name"
                required
                variant="outlined"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="newPlayer.lastName"
                label="Last Name"
                required
                variant="outlined"
              />
            </v-col>
          </v-row>
          <v-text-field
            v-model="newPlayer.email"
            label="Email"
            type="email"
            variant="outlined"
            prepend-inner-icon="mdi-email"
          />
          <v-text-field
            v-model="newPlayer.phone"
            label="Phone"
            variant="outlined"
            prepend-inner-icon="mdi-phone"
          />
          <div class="mt-4">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-body-1">Skill Level</span>
              <v-chip color="primary" variant="tonal">
                {{ newPlayer.skillLevel }} / 10
              </v-chip>
            </div>
            <v-slider
              v-model="newPlayer.skillLevel"
              min="1"
              max="10"
              step="1"
              thumb-label="always"
              color="primary"
              track-color="grey-lighten-2"
            >
              <template #prepend>
                <span class="text-caption text-grey">Beginner</span>
              </template>
              <template #append>
                <span class="text-caption text-grey">Expert</span>
              </template>
            </v-slider>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showAddPlayerDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="addPlayer">Add Player</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Player Dialog -->
    <v-dialog v-model="showEditPlayerDialog" max-width="500">
      <v-card v-if="editingPlayer">
        <v-card-title>
          <v-icon start>mdi-account-edit</v-icon>
          Edit Player
        </v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model="editingPlayer.firstName"
                label="First Name"
                required
                variant="outlined"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="editingPlayer.lastName"
                label="Last Name"
                required
                variant="outlined"
              />
            </v-col>
          </v-row>
          <v-text-field
            v-model="editingPlayer.email"
            label="Email"
            type="email"
            variant="outlined"
            prepend-inner-icon="mdi-email"
          />
          <v-text-field
            v-model="editingPlayer.phone"
            label="Phone"
            variant="outlined"
            prepend-inner-icon="mdi-phone"
          />
          <div class="mt-4">
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-body-1">Skill Level</span>
              <v-chip color="primary" variant="tonal">
                {{ editingPlayer.skillLevel }} / 10
              </v-chip>
            </div>
            <v-slider
              v-model="editingPlayer.skillLevel"
              min="1"
              max="10"
              step="1"
              thumb-label="always"
              color="primary"
              track-color="grey-lighten-2"
            >
              <template #prepend>
                <span class="text-caption text-grey">Beginner</span>
              </template>
              <template #append>
                <span class="text-caption text-grey">Expert</span>
              </template>
            </v-slider>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showEditPlayerDialog = false">Cancel</v-btn>
          <v-btn color="primary" @click="savePlayer">Save Changes</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeletePlayerDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">
          <v-icon color="error" class="mr-2">mdi-alert</v-icon>
          Delete Player?
        </v-card-title>
        <v-card-text>
          This action cannot be undone. The player will be removed from the tournament.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDeletePlayerDialog = false">Cancel</v-btn>
          <v-btn color="error" variant="elevated" @click="confirmDeletePlayer">
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.compact-header {
  margin-bottom: $spacing-lg;
}

.text-gradient {
  background: $primary-gradient;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-card {
  transition: $transition-base;
  border: 1px solid $border-light;
  
  &:hover {
    box-shadow: $shadow-md;
    transform: translateY(-2px);
  }
}

.stat-icon-wrapper {
  width: 40px;
  height: 40px;
  border-radius: $border-radius-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $spacing-sm;
  background: rgba($success-base, 0.1);
  color: $success-base;
}

.stat-success .stat-icon-wrapper {
  background: rgba($success-base, 0.1);
  color: $success-base;
}

.stat-info .stat-icon-wrapper {
  background: rgba($info-base, 0.1);
  color: $info-base;
}

.stat-secondary .stat-icon-wrapper {
  background: rgba($secondary-base, 0.1);
  color: $secondary-base;
}
</style>
