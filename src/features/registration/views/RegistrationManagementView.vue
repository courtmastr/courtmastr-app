<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import FilterBar from '@/components/common/FilterBar.vue';
import CompactDataTable from '@/components/common/CompactDataTable.vue';
import { FORMAT_LABELS } from '@/types';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const tournament = computed(() => tournamentStore.currentTournament);
const categories = computed(() => tournamentStore.categories);
const registrations = computed(() => registrationStore.registrations);
const players = computed(() => registrationStore.players);
const loading = computed(() => registrationStore.loading);

// Tab state
const tab = ref('registrations');

// Filter state
const filterCategory = ref<string | null>(null);
const filterStatus = ref<string | null>(null);
const searchQuery = ref('');
const filterSort = ref<string | null>('default');

// Dialog states
const showAddPlayerDialog = ref(false);
const showAddRegistrationDialog = ref(false);
const showBulkCheckInDialog = ref(false);
const showEditPlayerDialog = ref(false);
const showImportDialog = ref(false);
const showPaymentDialog = ref(false);
const showDeletePlayerDialog = ref(false);

// Delete player dialog state
const playerToDeleteId = ref<string | null>(null);

// Payment dialog state
const editingPayment = ref<{
  registrationId: string;
  participantName: string;
  paymentStatus: 'unpaid' | 'paid' | 'partial' | 'refunded';
  paymentNote: string;
} | null>(null);

// Import state
const importFile = ref<File | null>(null);
const importPreview = ref<any[]>([]);
const importErrors = ref<string[]>([]);
const importing = ref(false);

// Edit player state
const editingPlayer = ref<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  skillLevel: number;
} | null>(null);

// Selection for bulk actions
const selectedRegistrations = ref<string[]>([]);

// New player form
const newPlayer = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  skillLevel: 5,
});

// New registration form
const newRegistration = ref({
  playerId: '',
  categoryId: '',
  partnerPlayerId: '',
});

const selectedCategory = computed(() => {
  return categories.value.find((c) => c.id === newRegistration.value.categoryId);
});

const isDoublesCategory = computed(() => {
  return selectedCategory.value?.type === 'doubles' || selectedCategory.value?.type === 'mixed_doubles';
});

const categoryFilterOptions = computed(() => [
  { title: 'All Categories', value: null },
  ...categories.value.map((category) => ({ title: category.name, value: category.id })),
]);

const hasActiveRegistrationFilters = computed(() => (
  Boolean(filterCategory.value) ||
  Boolean(filterStatus.value) ||
  Boolean(searchQuery.value.trim()) ||
  (filterSort.value !== null && filterSort.value !== 'default')
));

// Filtered registrations
const filteredRegistrations = computed(() => {
  let result = registrations.value;

  // Filter by category
  if (filterCategory.value) {
    result = result.filter((r) => r.categoryId === filterCategory.value);
  }

  // Filter by status
  if (filterStatus.value) {
    if (filterStatus.value === 'bracket_ready') {
      // Special filter for bracket-ready (approved + checked_in)
      result = result.filter((r) => r.status === 'approved' || r.status === 'checked_in');
    } else {
      result = result.filter((r) => r.status === filterStatus.value);
    }
  }

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((r) => {
      const playerName = getPlayerName(r.playerId).toLowerCase();
      const partnerName = r.partnerPlayerId ? getPlayerName(r.partnerPlayerId).toLowerCase() : '';
      const teamName = r.teamName?.toLowerCase() || '';
      return playerName.includes(query) || partnerName.includes(query) || teamName.includes(query);
    });
  }

  const sorted = [...result];
  switch (filterSort.value) {
    case 'name_asc':
      sorted.sort((a, b) => getParticipantDisplay(a).localeCompare(getParticipantDisplay(b)));
      return sorted;
    case 'name_desc':
      sorted.sort((a, b) => getParticipantDisplay(b).localeCompare(getParticipantDisplay(a)));
      return sorted;
    case 'category_asc':
      sorted.sort((a, b) => getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId)));
      return sorted;
    case 'status_asc':
      sorted.sort((a, b) => a.status.localeCompare(b.status));
      return sorted;
    default:
      return result;
  }
});

// Stats - now category-aware when filtered
const registrationStats = computed(() => {
  const byCategory = new Map<string, { total: number; pending: number; approved: number; checkedIn: number; withdrawn: number; seeded: number }>();

  for (const cat of categories.value) {
    byCategory.set(cat.id, { total: 0, pending: 0, approved: 0, checkedIn: 0, withdrawn: 0, seeded: 0 });
  }

  for (const reg of registrations.value) {
    const catStats = byCategory.get(reg.categoryId);
    if (catStats) {
      catStats.total++;
      if (reg.status === 'pending') catStats.pending++;
      if (reg.status === 'approved') catStats.approved++;
      if (reg.status === 'checked_in') catStats.checkedIn++;
      if (reg.status === 'withdrawn') catStats.withdrawn++;
      if (reg.seed) catStats.seeded++;
    }
  }

  // If category is filtered, show stats for that category only
  const regsToCount = filterCategory.value
    ? registrations.value.filter((r) => r.categoryId === filterCategory.value)
    : registrations.value;

  return {
    total: regsToCount.length,
    pending: regsToCount.filter((r) => r.status === 'pending').length,
    approved: regsToCount.filter((r) => r.status === 'approved').length,
    checkedIn: regsToCount.filter((r) => r.status === 'checked_in').length,
    withdrawn: regsToCount.filter((r) => r.status === 'withdrawn').length,
    rejected: regsToCount.filter((r) => r.status === 'rejected').length,
    seeded: regsToCount.filter((r) => r.seed !== undefined && r.seed !== null).length,
    bracketReady: regsToCount.filter((r) => r.status === 'approved' || r.status === 'checked_in').length,
    paid: regsToCount.filter((r) => r.paymentStatus === 'paid').length,
    unpaid: regsToCount.filter((r) => !r.paymentStatus || r.paymentStatus === 'unpaid').length,
    byCategory,
  };
});

// Calculate bracket info for selected category
const bracketInfo = computed(() => {
  const ready = registrationStats.value.bracketReady;
  if (ready < 2) return { size: 0, byes: 0 };
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(ready)));
  const byes = bracketSize - ready;
  return { size: bracketSize, byes };
});

// Get selected category details
const selectedCategoryDetails = computed(() => {
  if (!filterCategory.value) return null;
  return categories.value.find((c) => c.id === filterCategory.value);
});

// Initialize from URL query params
onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  registrationStore.subscribeRegistrations(tournamentId.value);
  registrationStore.subscribePlayers(tournamentId.value);

  // Check for category filter in URL
  if (route.query.category) {
    filterCategory.value = route.query.category as string;
  }
});

// Watchers
watch(filterCategory, (newVal) => {
  // Update URL when filter changes
  router.replace({
    query: newVal ? { category: newVal } : {},
  });
});

function getPlayerName(playerId: string | undefined): string {
  if (!playerId) return 'Unknown';
  const player = players.value.find((p) => p.id === playerId);
  return player ? `${player.firstName} ${player.lastName}` : 'Unknown';
}

function getParticipantDisplay(registration: any): string {
  if (registration.teamName) {
    return registration.teamName;
  }
  const playerName = getPlayerName(registration.playerId);
  if (registration.partnerPlayerId) {
    return `${playerName} / ${getPlayerName(registration.partnerPlayerId)}`;
  }
  return playerName;
}

function getCategoryName(categoryId: string): string {
  const category = categories.value.find((c) => c.id === categoryId);
  return category?.name || 'Unknown';
}

function getCategory(categoryId: string) {
  return categories.value.find((c) => c.id === categoryId);
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

async function addRegistration() {
  try {
    const playerName = getPlayerName(newRegistration.value.playerId);
    const partnerName = isDoublesCategory.value ? getPlayerName(newRegistration.value.partnerPlayerId) : '';
    const teamName = isDoublesCategory.value
      ? `${playerName.split(' ').pop()} / ${partnerName.split(' ').pop()}`
      : null;

    await registrationStore.createRegistration(tournamentId.value, {
      tournamentId: tournamentId.value,
      categoryId: newRegistration.value.categoryId,
      participantType: isDoublesCategory.value ? 'team' : 'player',
      playerId: newRegistration.value.playerId,
      partnerPlayerId: isDoublesCategory.value ? newRegistration.value.partnerPlayerId : undefined,
      teamName: teamName || undefined,
      status: 'approved',
      registeredBy: authStore.currentUser?.id || '',
    });
    notificationStore.showToast('success', 'Registration added');
    showAddRegistrationDialog.value = false;
    resetRegistrationForm();
  } catch (error) {
    notificationStore.showToast('error', 'Failed to add registration');
  }
}

async function approveRegistration(registrationId: string) {
  try {
    await registrationStore.approveRegistration(
      tournamentId.value,
      registrationId,
      authStore.currentUser?.id || ''
    );
    notificationStore.showToast('success', 'Registration approved');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to approve registration');
  }
}

async function rejectRegistration(registrationId: string) {
  try {
    await registrationStore.rejectRegistration(tournamentId.value, registrationId);
    notificationStore.showToast('success', 'Registration rejected');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to reject registration');
  }
}

async function checkInRegistration(registrationId: string) {
  try {
    await registrationStore.checkInRegistration(tournamentId.value, registrationId);
    notificationStore.showToast('success', 'Checked in successfully');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to check in');
  }
}

async function undoCheckInRegistration(registrationId: string) {
  try {
    await registrationStore.undoCheckInRegistration(
      tournamentId.value,
      registrationId,
      authStore.currentUser?.id || ''
    );
    notificationStore.showToast('success', 'Check-in undone');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to undo check-in');
  }
}

async function withdrawRegistration(registrationId: string) {
  try {
    await registrationStore.withdrawRegistration(tournamentId.value, registrationId);
    notificationStore.showToast('success', 'Registration withdrawn');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to withdraw');
  }
}

async function reinstateRegistration(registrationId: string) {
  try {
    await registrationStore.reinstateRegistration(
      tournamentId.value,
      registrationId,
      authStore.currentUser?.id || ''
    );
    notificationStore.showToast('success', 'Registration reinstated');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to reinstate registration');
  }
}

function formatDate(value?: Date): string {
  if (!value) return 'N/A';
  return value.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function bulkCheckIn() {
  try {
    for (const regId of selectedRegistrations.value) {
      await registrationStore.checkInRegistration(tournamentId.value, regId);
    }
    notificationStore.showToast('success', `${selectedRegistrations.value.length} participants checked in`);
    selectedRegistrations.value = [];
    showBulkCheckInDialog.value = false;
  } catch (error) {
    notificationStore.showToast('error', 'Failed to check in some participants');
  }
}

async function bulkApprove() {
  try {
    for (const regId of selectedRegistrations.value) {
      await registrationStore.approveRegistration(
        tournamentId.value,
        regId,
        authStore.currentUser?.id || ''
      );
    }
    notificationStore.showToast('success', `${selectedRegistrations.value.length} registrations approved`);
    selectedRegistrations.value = [];
  } catch (error) {
    notificationStore.showToast('error', 'Failed to approve some registrations');
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

function resetRegistrationForm() {
  newRegistration.value = {
    playerId: '',
    categoryId: '',
    partnerPlayerId: '',
  };
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

// Payment Functions
function openPaymentDialog(registration: any) {
  editingPayment.value = {
    registrationId: registration.id,
    participantName: getParticipantDisplay(registration),
    paymentStatus: registration.paymentStatus || 'unpaid',
    paymentNote: registration.paymentNote || '',
  };
  showPaymentDialog.value = true;
}

async function togglePaymentStatus(registration: any) {
  const newStatus = registration.paymentStatus === 'paid' ? 'unpaid' : 'paid';
  try {
    await registrationStore.updatePaymentStatus(
      tournamentId.value,
      registration.id,
      newStatus
    );
    notificationStore.showToast('success', `Marked as ${newStatus}`);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update payment status');
  }
}

async function savePaymentStatus() {
  if (!editingPayment.value) return;

  try {
    await registrationStore.updatePaymentStatus(
      tournamentId.value,
      editingPayment.value.registrationId,
      editingPayment.value.paymentStatus,
      editingPayment.value.paymentNote
    );
    notificationStore.showToast('success', 'Payment status updated');
    showPaymentDialog.value = false;
    editingPayment.value = null;
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update payment status');
  }
}

function getPaymentColor(status: string | undefined): string {
  const colors: Record<string, string> = {
    paid: 'success',
    unpaid: 'error',
    partial: 'warning',
    refunded: 'grey',
  };
  return colors[status || 'unpaid'] || 'error';
}

function getPaymentIcon(status: string | undefined): string {
  const icons: Record<string, string> = {
    paid: 'mdi-check-circle',
    unpaid: 'mdi-close-circle',
    partial: 'mdi-circle-half-full',
    refunded: 'mdi-cash-refund',
  };
  return icons[status || 'unpaid'] || 'mdi-close-circle';
}

// CSV Import Functions
function downloadTemplate() {
  const categoryNames = categories.value.map((c) => c.name).join(' | ');
  const csvContent = `First Name,Last Name,Email,Phone,Skill Level (1-10),Category
John,Doe,john@example.com,555-1234,7,Mens Singles
Jane,Smith,jane@example.com,555-5678,8,Womens Singles
Mike,Johnson,mike@example.com,555-9012,6,Mens Singles

# Instructions:
# - First Name and Last Name are required
# - Email is optional but recommended
# - Phone is optional
# - Skill Level should be 1-10 (defaults to 5 if empty)
# - Category must match one of your tournament categories exactly:
#   ${categoryNames}
# - For doubles, create separate rows for each player with the same category
# - Delete these instruction lines before importing
`;

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tournament.value?.name || 'tournament'}_player_template.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  importFile.value = file;
  importErrors.value = [];
  importPreview.value = [];

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    parseCSV(text);
  };
  reader.readAsText(file);
}

function parseCSV(text: string) {
  const lines = text.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
  const errors: string[] = [];
  const preview: any[] = [];

  // Skip header row
  const dataLines = lines.slice(1);

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const values = line.split(',').map((v) => v.trim());

    if (values.length < 2) {
      errors.push(`Row ${i + 2}: Missing required fields (First Name, Last Name)`);
      continue;
    }

    const [firstName, lastName, email, phone, skillLevelStr, categoryName] = values;

    if (!firstName || !lastName) {
      errors.push(`Row ${i + 2}: First Name and Last Name are required`);
      continue;
    }

    const skillLevel = skillLevelStr ? parseInt(skillLevelStr, 10) : 5;
    if (isNaN(skillLevel) || skillLevel < 1 || skillLevel > 10) {
      errors.push(`Row ${i + 2}: Skill Level must be 1-10`);
      continue;
    }

    // Find matching category
    let matchedCategory = null;
    if (categoryName) {
      matchedCategory = categories.value.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );
      if (!matchedCategory) {
        errors.push(`Row ${i + 2}: Category "${categoryName}" not found`);
      }
    }

    preview.push({
      firstName,
      lastName,
      email: email || '',
      phone: phone || '',
      skillLevel,
      categoryName: categoryName || '',
      categoryId: matchedCategory?.id || null,
      valid: !categoryName || !!matchedCategory,
    });
  }

  importErrors.value = errors;
  importPreview.value = preview;
}

async function executeImport() {
  if (importPreview.value.length === 0) return;

  importing.value = true;
  let successCount = 0;
  let errorCount = 0;

  try {
    for (const row of importPreview.value) {
      try {
        // Create player
        const playerId = await registrationStore.addPlayer(tournamentId.value, {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          skillLevel: row.skillLevel,
        });

        // Create registration if category specified
        if (row.categoryId) {
          await registrationStore.createRegistration(tournamentId.value, {
            tournamentId: tournamentId.value,
            categoryId: row.categoryId,
            participantType: 'player',
            playerId: playerId,
            status: 'approved',
            registeredBy: authStore.currentUser?.id || '',
          });
        }

        successCount++;
      } catch (err) {
        console.error('Error importing row:', row, err);
        errorCount++;
      }
    }

    notificationStore.showToast(
      'success',
      `Imported ${successCount} players${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
    );

    // Reset import state
    showImportDialog.value = false;
    importFile.value = null;
    importPreview.value = [];
    importErrors.value = [];
  } catch (error) {
    notificationStore.showToast('error', 'Import failed');
  } finally {
    importing.value = false;
  }
}

function resetImport() {
  importFile.value = null;
  importPreview.value = [];
  importErrors.value = [];
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'error',
    withdrawn: 'grey',
    checked_in: 'info',
    no_show: 'error',
  };
  return colors[status] || 'grey';
}

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    pending: 'mdi-clock-outline',
    approved: 'mdi-check',
    rejected: 'mdi-close',
    withdrawn: 'mdi-account-remove',
    checked_in: 'mdi-check-decagram',
    no_show: 'mdi-account-cancel',
  };
  return icons[status] || 'mdi-help';
}

function clearFilters() {
  filterCategory.value = null;
  filterStatus.value = null;
  searchQuery.value = '';
  filterSort.value = 'default';
}

const statusOptions = [
  { title: 'All Statuses', value: null },
  { title: 'In Bracket (Approved + Checked In)', value: 'bracket_ready' },
  { title: 'Pending', value: 'pending' },
  { title: 'Approved', value: 'approved' },
  { title: 'Checked In', value: 'checked_in' },
  { title: 'No Show', value: 'no_show' },
  { title: 'Withdrawn', value: 'withdrawn' },
  { title: 'Rejected', value: 'rejected' },
];

const sortOptions = [
  { title: 'Default', value: 'default' },
  { title: 'Name (A-Z)', value: 'name_asc' },
  { title: 'Name (Z-A)', value: 'name_desc' },
  { title: 'Category (A-Z)', value: 'category_asc' },
  { title: 'Status (A-Z)', value: 'status_asc' },
];

const canCheckIn = computed(() => {
  return selectedRegistrations.value.every((id) => {
    const reg = registrations.value.find((r) => r.id === id);
    return reg?.status === 'approved';
  });
});

const canApprove = computed(() => {
  return selectedRegistrations.value.every((id) => {
    const reg = registrations.value.find((r) => r.id === id);
    return reg?.status === 'pending';
  });
});
</script>

<template>
  <v-container fluid>
    <!-- Header -->
    <!-- Compact Header -->
    <div class="compact-header mb-6">
      <div class="d-flex align-center justify-space-between flex-wrap gap-4">
        <div>
          <div class="d-flex align-center text-grey-darken-1 text-caption mb-1">
            <v-icon
              size="small"
              class="mr-1"
            >
              mdi-home
            </v-icon>
            Home <v-icon
              size="small"
              class="mx-1"
            >
              mdi-chevron-right
            </v-icon>
            Tournaments <v-icon
              size="small"
              class="mx-1"
            >
              mdi-chevron-right
            </v-icon>
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
              Registration
            </h1>
          </div>
        </div>
        <div class="d-flex flex-column flex-sm-row gap-2">
          <v-btn
            variant="outlined"
            prepend-icon="mdi-upload"
            @click="showImportDialog = true"
          >
            Import CSV
          </v-btn>
          <v-btn
            variant="outlined"
            prepend-icon="mdi-account-plus"
            @click="showAddPlayerDialog = true"
          >
            Add Player
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-plus"
            elevation="2"
            @click="showAddRegistrationDialog = true"
          >
            Add Registration
          </v-btn>
        </div>
      </div>
    </div>

    <!-- Category Header when filtered -->
    <v-card
      v-if="selectedCategoryDetails"
      class="mb-4"
      variant="outlined"
      color="primary"
    >
      <v-card-text>
        <div class="d-flex align-center mb-3">
          <v-icon
            size="24"
            class="mr-2"
          >
            mdi-tournament
          </v-icon>
          <div>
            <h2 class="text-h6 font-weight-bold">
              {{ selectedCategoryDetails.name }}
            </h2>
            <div class="text-caption text-grey">
              {{ FORMAT_LABELS[selectedCategoryDetails.format] || selectedCategoryDetails.format }}
              <span v-if="selectedCategoryDetails.seedingEnabled"> | Seeding enabled</span>
            </div>
          </div>
          <v-spacer />
          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-close"
            @click="filterCategory = null"
          >
            Show All
          </v-btn>
        </div>

        <!-- Bracket Summary -->
        <v-alert
          :type="registrationStats.bracketReady >= 2 ? 'success' : 'warning'"
          variant="tonal"
          density="compact"
          class="mb-0"
        >
          <div class="d-flex flex-wrap align-center gap-4">
            <div>
              <strong class="text-h5">{{ registrationStats.bracketReady }}</strong>
              <span class="text-body-2 ml-1">players in bracket</span>
            </div>
            <v-divider
              vertical
              class="mx-2"
            />
            <div
              v-if="registrationStats.pending > 0"
              class="text-warning"
            >
              <v-icon
                size="16"
                class="mr-1"
              >
                mdi-clock-outline
              </v-icon>
              <strong>{{ registrationStats.pending }}</strong> pending (won't be in bracket)
            </div>
            <div
              v-if="registrationStats.withdrawn > 0"
              class="text-grey"
            >
              <v-icon
                size="16"
                class="mr-1"
              >
                mdi-account-remove
              </v-icon>
              <strong>{{ registrationStats.withdrawn }}</strong> withdrawn
            </div>
            <v-divider
              v-if="bracketInfo.byes > 0"
              vertical
              class="mx-2"
            />
            <div
              v-if="bracketInfo.byes > 0"
              class="text-info"
            >
              <v-icon
                size="16"
                class="mr-1"
              >
                mdi-arrow-right-bold
              </v-icon>
              Bracket of {{ bracketInfo.size }} with <strong>{{ bracketInfo.byes }}</strong> bye{{ bracketInfo.byes > 1 ? 's' : '' }}
            </div>
            <div
              v-if="selectedCategoryDetails.seedingEnabled"
              class="text-primary"
            >
              <v-icon
                size="16"
                class="mr-1"
              >
                mdi-seed
              </v-icon>
              <strong>{{ registrationStats.seeded }}</strong> seeded
            </div>
          </div>
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Stats Grid -->
    <v-row class="mb-6">
      <v-col
        cols="6"
        sm="4"
        md="2"
      >
        <div
          class="stat-card pa-4 rounded-lg bg-surface cursor-pointer"
          @click="filterStatus = null"
        >
          <div class="stat-icon-wrapper bg-grey-lighten-4 text-grey-darken-1">
            <v-icon>mdi-account-group</v-icon>
          </div>
          <div class="text-h4 font-weight-bold mb-1">
            {{ registrationStats.total }}
          </div>
          <div class="text-caption font-weight-medium text-grey text-uppercase">
            Total
          </div>
        </div>
      </v-col>
      
      <v-col
        cols="6"
        sm="4"
        md="2"
      >
        <div class="stat-card stat-success pa-4 rounded-lg bg-surface">
          <div class="stat-icon-wrapper">
            <v-icon>mdi-check-decagram</v-icon>
          </div>
          <div class="text-h4 font-weight-bold mb-1">
            {{ registrationStats.bracketReady }}
          </div>
          <div class="text-caption font-weight-medium text-success text-uppercase">
            Bracket Ready
          </div>
        </div>
      </v-col>

      <v-col
        cols="6"
        sm="4"
        md="2"
      >
        <div
          class="stat-card stat-warning pa-4 rounded-lg bg-surface cursor-pointer"
          @click="filterStatus = filterStatus === 'pending' ? null : 'pending'"
        >
          <div class="stat-icon-wrapper">
            <v-icon>mdi-clock-outline</v-icon>
          </div>
          <div class="text-h4 font-weight-bold mb-1">
            {{ registrationStats.pending }}
          </div>
          <div class="text-caption font-weight-medium text-warning text-uppercase">
            Pending
          </div>
        </div>
      </v-col>

      <v-col
        cols="6"
        sm="4"
        md="2"
      >
        <div
          class="stat-card stat-info pa-4 rounded-lg bg-surface cursor-pointer"
          @click="filterStatus = filterStatus === 'approved' ? null : 'approved'"
        >
          <div class="stat-icon-wrapper">
            <v-icon>mdi-check</v-icon>
          </div>
          <div class="text-h4 font-weight-bold mb-1">
            {{ registrationStats.approved }}
          </div>
          <div class="text-caption font-weight-medium text-info text-uppercase">
            Approved
          </div>
        </div>
      </v-col>

      <v-col
        cols="6"
        sm="4"
        md="2"
      >
        <div
          class="stat-card stat-primary pa-4 rounded-lg bg-surface cursor-pointer"
          @click="filterStatus = filterStatus === 'checked_in' ? null : 'checked_in'"
        >
          <div class="stat-icon-wrapper">
            <v-icon>mdi-ticket-account</v-icon>
          </div>
          <div class="text-h4 font-weight-bold mb-1">
            {{ registrationStats.checkedIn }}
          </div>
          <div class="text-caption font-weight-medium text-primary text-uppercase">
            Checked In
          </div>
        </div>
      </v-col>

      <v-col
        cols="6"
        sm="4"
        md="2"
      >
        <div
          class="stat-card stat-secondary pa-4 rounded-lg bg-surface cursor-pointer"
          @click="filterStatus = filterStatus === 'withdrawn' ? null : 'withdrawn'"
        >
          <div class="stat-icon-wrapper">
            <v-icon>mdi-account-off</v-icon>
          </div>
          <div class="text-h4 font-weight-bold mb-1">
            {{ registrationStats.withdrawn }}
          </div>
          <div class="text-caption font-weight-medium text-secondary text-uppercase">
            Withdrawn
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Tabs -->
    <v-tabs
      v-model="tab"
      color="primary"
    >
      <v-tab value="registrations">
        <v-icon start>
          mdi-account-multiple
        </v-icon>
        Registrations
        <v-chip
          size="x-small"
          class="ml-2"
        >
          {{ filteredRegistrations.length }}
        </v-chip>
      </v-tab>
      <v-tab value="check-in">
        <v-icon start>
          mdi-check-decagram
        </v-icon>
        Check-In
      </v-tab>
    </v-tabs>

    <!-- Link to Participants Page -->
    <v-alert
      v-if="tab === 'registrations'"
      type="info"
      variant="tonal"
      density="compact"
      class="mt-4"
    >
      <div class="d-flex align-center justify-space-between">
        <span>View and manage your tournament participants</span>
        <v-btn
          variant="text"
          color="primary"
          size="small"
          :to="`/tournaments/${tournamentId}/participants`"
        >
          Go to Participants
          <v-icon end>
            mdi-arrow-right
          </v-icon>
        </v-btn>
      </div>
    </v-alert>

    <v-tabs-window v-model="tab">
      <!-- Registrations Tab -->
      <v-tabs-window-item value="registrations">
        <v-card class="mt-4">
          <!-- Filters -->
          <v-card-text class="pb-0">
            <filter-bar
              :search="searchQuery"
              :category="filterCategory"
              :status="filterStatus"
              :sort="filterSort"
              :enable-category="true"
              :enable-status="true"
              :enable-court="false"
              :category-options="categoryFilterOptions"
              :status-options="statusOptions"
              :sort-options="sortOptions"
              search-label="Search"
              search-placeholder="Search participant name"
              :has-active-filters="hasActiveRegistrationFilters"
              @update:search="searchQuery = $event"
              @update:category="filterCategory = $event"
              @update:status="filterStatus = $event"
              @update:sort="filterSort = $event"
              @clear="clearFilters"
            />

            <!-- Bulk Actions -->
            <v-slide-y-transition>
              <div
                v-if="selectedRegistrations.length > 0"
                class="mt-3 pa-3 bg-surface-variant rounded"
              >
                <div class="d-flex align-center">
                  <span class="text-body-2 mr-4">
                    {{ selectedRegistrations.length }} selected
                  </span>
                  <v-btn
                    v-if="canApprove"
                    size="small"
                    color="success"
                    variant="tonal"
                    prepend-icon="mdi-check"
                    class="mr-2"
                    @click="bulkApprove"
                  >
                    Approve All
                  </v-btn>
                  <v-btn
                    v-if="canCheckIn"
                    size="small"
                    color="info"
                    variant="tonal"
                    prepend-icon="mdi-check-decagram"
                    class="mr-2"
                    @click="showBulkCheckInDialog = true"
                  >
                    Check In All
                  </v-btn>
                  <v-spacer />
                  <v-btn
                    size="small"
                    variant="text"
                    @click="selectedRegistrations = []"
                  >
                    Clear Selection
                  </v-btn>
                </div>
              </div>
            </v-slide-y-transition>
          </v-card-text>

          <compact-data-table
            v-model:selected="selectedRegistrations"
            :items="filteredRegistrations"
            :columns="[
              { key: 'participant', title: 'Participant', width: '35%', essential: true },
              { key: 'category', title: 'Category', width: '20%', essential: true },
              { key: 'status', title: 'Status', width: '15%', essential: true },
              { key: 'actions', title: 'Actions', width: '30%', essential: true },
            ]"
            :loading="loading"
            show-select
          >
            <template #cell-participant="{ item }">
              <div class="d-flex align-center py-2">
                <v-avatar
                  size="36"
                  color="primary"
                  class="mr-3"
                >
                  <span class="text-caption">{{ getPlayerName(item.playerId).charAt(0) }}</span>
                </v-avatar>
                <div>
                  <div class="font-weight-medium">
                    {{ getParticipantDisplay(item) }}
                  </div>
                  <div class="text-caption text-grey">
                    {{ item.partnerPlayerId ? 'Doubles' : 'Singles' }}
                  </div>
                </div>
              </div>
            </template>
            <template #cell-category="{ item }">
              <v-chip
                size="small"
                variant="outlined"
              >
                {{ getCategoryName(item.categoryId) }}
              </v-chip>
              <div class="text-caption text-grey">
                {{ getCategory(item.categoryId)?.format ? FORMAT_LABELS[getCategory(item.categoryId)!.format] : '' }}
              </div>
            </template>
            <template #cell-status="{ item }">
              <v-chip
                :color="getStatusColor(item.status)"
                :prepend-icon="getStatusIcon(item.status)"
                size="small"
              >
                {{ item.status }}
              </v-chip>
            </template>
            <template #actions="{ item }">
              <div class="d-flex justify-end">
                <!-- Pending actions -->
                <template v-if="item.status === 'pending'">
                  <v-btn
                    icon="mdi-check"
                    size="small"
                    color="success"
                    variant="text"
                    title="Approve"
                    @click="approveRegistration(item.id)"
                  />
                  <v-btn
                    icon="mdi-close"
                    size="small"
                    color="error"
                    variant="text"
                    title="Reject"
                    @click="rejectRegistration(item.id)"
                  />
                </template>

                <!-- Approved actions -->
                <template v-if="item.status === 'approved'">
                  <v-btn
                    icon="mdi-check-decagram"
                    size="small"
                    color="info"
                    variant="text"
                    title="Check In"
                    @click="checkInRegistration(item.id)"
                  />
                  <v-btn
                    icon="mdi-account-remove"
                    size="small"
                    color="grey"
                    variant="text"
                    title="Withdraw"
                    @click="withdrawRegistration(item.id)"
                  />
                </template>

                <!-- Checked in - can only withdraw -->
                <template v-if="item.status === 'checked_in'">
                  <v-chip
                    size="x-small"
                    color="success"
                    variant="tonal"
                    class="mr-2"
                  >
                    <v-icon
                      start
                      size="12"
                    >
                      mdi-check
                    </v-icon>
                    Ready
                  </v-chip>
                  <v-btn
                    icon="mdi-undo-variant"
                    size="small"
                    color="warning"
                    variant="text"
                    title="Undo Check-In"
                    @click="undoCheckInRegistration(item.id)"
                  />
                  <v-btn
                    icon="mdi-account-remove"
                    size="small"
                    color="grey"
                    variant="text"
                    title="Withdraw"
                    @click="withdrawRegistration(item.id)"
                  />
                </template>

                <!-- Withdrawn actions -->
                <template v-if="item.status === 'withdrawn'">
                  <v-btn
                    icon="mdi-account-plus"
                    size="small"
                    color="success"
                    variant="text"
                    title="Reinstate"
                    @click="reinstateRegistration(item.id)"
                  />
                </template>
              </div>
            </template>
            <template #details="{ item }">
              <div class="d-flex flex-wrap gap-4 text-body-2">
                <div><strong>Payment:</strong> 
                  <v-chip
                    :color="getPaymentColor(item.paymentStatus)"
                    size="small"
                    class="cursor-pointer"
                    @click="togglePaymentStatus(item)"
                  >
                    {{ item.paymentStatus || 'unpaid' }}
                  </v-chip>
                </div>
                <div v-if="item.seed"><strong>Seed:</strong> #{{ item.seed }}</div>
                <div><strong>Registered:</strong> {{ formatDate(item.createdAt) }}</div>
              </div>
            </template>
          </compact-data-table>
        </v-card>
      </v-tabs-window-item>

      <!-- Check-In Tab -->
      <v-tabs-window-item value="check-in">
        <v-card class="mt-4">
          <v-card-title class="d-flex align-center">
            <v-icon start>
              mdi-check-decagram
            </v-icon>
            Quick Check-In
            <v-spacer />
            <v-chip
              color="success"
              variant="tonal"
            >
              {{ registrationStats.checkedIn }} / {{ registrationStats.approved + registrationStats.checkedIn }} checked in
            </v-chip>
          </v-card-title>

          <v-card-text>
            <v-text-field
              v-model="searchQuery"
              prepend-inner-icon="mdi-magnify"
              label="Search participant to check in..."
              variant="outlined"
              clearable
              autofocus
            />
          </v-card-text>

          <v-list>
            <template
              v-for="reg in filteredRegistrations.filter(r => r.status === 'approved' || r.status === 'checked_in')"
              :key="reg.id"
            >
              <v-list-item
                :class="{ 'bg-success-lighten-5': reg.status === 'checked_in' }"
              >
                <template #prepend>
                  <v-avatar
                    :color="reg.status === 'checked_in' ? 'success' : 'grey'"
                    size="40"
                  >
                    <v-icon
                      v-if="reg.status === 'checked_in'"
                      color="white"
                    >
                      mdi-check
                    </v-icon>
                    <span
                      v-else
                      class="text-caption"
                    >{{ getPlayerName(reg.playerId).charAt(0) }}</span>
                  </v-avatar>
                </template>

                <v-list-item-title class="font-weight-medium">
                  {{ getParticipantDisplay(reg) }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ getCategoryName(reg.categoryId) }}
                </v-list-item-subtitle>

                <template #append>
                  <v-btn
                    v-if="reg.status === 'approved'"
                    color="success"
                    variant="tonal"
                    prepend-icon="mdi-check-decagram"
                    @click="checkInRegistration(reg.id)"
                  >
                    Check In
                  </v-btn>
                  <v-chip
                    v-else
                    color="success"
                    variant="tonal"
                  >
                    <v-icon start>
                      mdi-check
                    </v-icon>
                    Checked In
                  </v-chip>
                  <v-btn
                    v-if="reg.status === 'checked_in'"
                    color="warning"
                    variant="tonal"
                    prepend-icon="mdi-undo-variant"
                    @click="undoCheckInRegistration(reg.id)"
                  >
                    Undo Check-In
                  </v-btn>
                </template>
              </v-list-item>
              <v-divider />
            </template>
          </v-list>

          <v-card-text v-if="filteredRegistrations.filter(r => r.status === 'approved' || r.status === 'checked_in').length === 0">
            <div class="text-center py-8 text-grey">
              <v-icon size="64">
                mdi-account-search
              </v-icon>
              <p class="mt-4">
                No approved registrations found
              </p>
            </div>
          </v-card-text>
        </v-card>
      </v-tabs-window-item>
    </v-tabs-window>

    <!-- Add Player Dialog -->
    <v-dialog
      v-model="showAddPlayerDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title>Add Player</v-card-title>
        <v-card-text>
          <v-row>
            <v-col cols="6">
              <v-text-field
                v-model="newPlayer.firstName"
                label="First Name"
                required
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="newPlayer.lastName"
                label="Last Name"
                required
              />
            </v-col>
          </v-row>
          <v-text-field
            v-model="newPlayer.email"
            label="Email"
            type="email"
          />
          <v-text-field
            v-model="newPlayer.phone"
            label="Phone"
          />
          <v-slider
            v-model="newPlayer.skillLevel"
            label="Skill Level"
            min="1"
            max="10"
            step="1"
            thumb-label
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showAddPlayerDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="addPlayer"
          >
            Add Player
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Add Registration Dialog -->
    <v-dialog
      v-model="showAddRegistrationDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title>Add Registration</v-card-title>
        <v-card-text>
          <v-select
            v-model="newRegistration.categoryId"
            :items="categories"
            item-title="name"
            item-value="id"
            label="Category"
            required
          />
          <v-select
            v-model="newRegistration.playerId"
            :items="players"
            :item-title="(p: any) => `${p.firstName} ${p.lastName}`"
            item-value="id"
            label="Player"
            required
          />
          <v-select
            v-if="isDoublesCategory"
            v-model="newRegistration.partnerPlayerId"
            :items="players.filter((p) => p.id !== newRegistration.playerId)"
            :item-title="(p: any) => `${p.firstName} ${p.lastName}`"
            item-value="id"
            label="Partner"
            required
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showAddRegistrationDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="addRegistration"
          >
            Add Registration
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Bulk Check-In Confirmation Dialog -->
    <v-dialog
      v-model="showBulkCheckInDialog"
      max-width="400"
    >
      <v-card>
        <v-card-title>Confirm Bulk Check-In</v-card-title>
        <v-card-text>
          Are you sure you want to check in {{ selectedRegistrations.length }} participants?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showBulkCheckInDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="info"
            @click="bulkCheckIn"
          >
            Check In All
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Player Dialog -->
    <v-dialog
      v-model="showEditPlayerDialog"
      max-width="500"
    >
      <v-card v-if="editingPlayer">
        <v-card-title>
          <v-icon start>
            mdi-account-edit
          </v-icon>
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
              <v-chip
                color="primary"
                variant="tonal"
              >
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
          <v-btn
            variant="text"
            @click="showEditPlayerDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="savePlayer"
          >
            Save Changes
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Import CSV Dialog -->
    <v-dialog
      v-model="showImportDialog"
      max-width="800"
      persistent
    >
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon start>
            mdi-upload
          </v-icon>
          Import Players from CSV
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            @click="showImportDialog = false; resetImport();"
          />
        </v-card-title>

        <v-card-text>
          <!-- Step 1: Download Template & Upload -->
          <div v-if="!importFile">
            <v-alert
              type="info"
              variant="tonal"
              class="mb-4"
            >
              <div class="font-weight-medium mb-2">
                CSV Format Instructions:
              </div>
              <ul class="text-body-2">
                <li>Columns: First Name, Last Name, Email, Phone, Skill Level (1-10), Category</li>
                <li>First Name and Last Name are required</li>
                <li>Category must match exactly one of your tournament categories</li>
                <li>Players will be auto-registered to the specified category</li>
              </ul>
            </v-alert>

            <div class="text-center py-4">
              <v-btn
                color="primary"
                variant="outlined"
                prepend-icon="mdi-download"
                class="mb-4"
                @click="downloadTemplate"
              >
                Download CSV Template
              </v-btn>

              <div class="text-body-2 text-grey mb-4">
                Your tournament categories:
              </div>
              <div class="d-flex flex-wrap justify-center gap-2 mb-6">
                <v-chip
                  v-for="cat in categories"
                  :key="cat.id"
                  size="small"
                  color="primary"
                  variant="tonal"
                >
                  {{ cat.name }}
                </v-chip>
              </div>

              <v-divider class="my-4" />

              <v-file-input
                label="Upload CSV File"
                accept=".csv"
                prepend-icon="mdi-file-delimited"
                variant="outlined"
                @change="handleFileUpload"
              />
            </div>
          </div>

          <!-- Step 2: Preview -->
          <div v-else>
            <div class="d-flex align-center mb-4">
              <v-icon
                color="success"
                class="mr-2"
              >
                mdi-file-check
              </v-icon>
              <span class="font-weight-medium">{{ importFile.name }}</span>
              <v-spacer />
              <v-btn
                size="small"
                variant="text"
                @click="resetImport"
              >
                Choose Different File
              </v-btn>
            </div>

            <!-- Errors -->
            <v-alert
              v-if="importErrors.length > 0"
              type="warning"
              variant="tonal"
              class="mb-4"
            >
              <div class="font-weight-medium mb-2">
                Issues found ({{ importErrors.length }}):
              </div>
              <ul class="text-body-2">
                <li
                  v-for="(error, idx) in importErrors.slice(0, 5)"
                  :key="idx"
                >
                  {{ error }}
                </li>
                <li v-if="importErrors.length > 5">
                  ... and {{ importErrors.length - 5 }} more
                </li>
              </ul>
            </v-alert>

            <!-- Preview Table -->
            <div class="text-subtitle-2 mb-2">
              Preview ({{ importPreview.length }} players to import)
            </div>
            <v-table
              density="compact"
              class="border rounded"
            >
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Skill</th>
                  <th>Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in importPreview.slice(0, 10)"
                  :key="idx"
                >
                  <td>{{ row.firstName }} {{ row.lastName }}</td>
                  <td>{{ row.email || '-' }}</td>
                  <td>{{ row.phone || '-' }}</td>
                  <td>
                    <v-chip
                      size="x-small"
                      color="primary"
                      variant="tonal"
                    >
                      {{ row.skillLevel }}
                    </v-chip>
                  </td>
                  <td>{{ row.categoryName || '-' }}</td>
                  <td>
                    <v-icon
                      v-if="row.valid"
                      color="success"
                      size="small"
                    >
                      mdi-check-circle
                    </v-icon>
                    <v-icon
                      v-else
                      color="warning"
                      size="small"
                    >
                      mdi-alert-circle
                    </v-icon>
                  </td>
                </tr>
                <tr v-if="importPreview.length > 10">
                  <td
                    colspan="6"
                    class="text-center text-grey"
                  >
                    ... and {{ importPreview.length - 10 }} more rows
                  </td>
                </tr>
              </tbody>
            </v-table>

            <v-alert
              v-if="importPreview.length === 0"
              type="error"
              variant="tonal"
              class="mt-4"
            >
              No valid rows found in the CSV file. Please check the format.
            </v-alert>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showImportDialog = false; resetImport();"
          >
            Cancel
          </v-btn>
          <v-btn
            v-if="importFile && importPreview.length > 0"
            color="primary"
            :loading="importing"
            @click="executeImport"
          >
            Import {{ importPreview.length }} Players
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Player Confirmation Dialog -->
    <v-dialog
      v-model="showDeletePlayerDialog"
      max-width="400"
      persistent
    >
      <v-card>
        <v-card-title>Delete Player?</v-card-title>
        <v-card-text>
          Are you sure? This will also affect any registrations for this player.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showDeletePlayerDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            @click="confirmDeletePlayer"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Payment Status Dialog -->
    <v-dialog
      v-model="showPaymentDialog"
      max-width="400"
    >
      <v-card v-if="editingPayment">
        <v-card-title>
          <v-icon start>
            mdi-cash
          </v-icon>
          Payment Status
        </v-card-title>
        <v-card-text>
          <div class="text-body-1 font-weight-medium mb-4">
            {{ editingPayment.participantName }}
          </div>

          <v-select
            v-model="editingPayment.paymentStatus"
            :items="[
              { title: 'Unpaid', value: 'unpaid' },
              { title: 'Paid', value: 'paid' },
              { title: 'Partial', value: 'partial' },
              { title: 'Refunded', value: 'refunded' },
            ]"
            item-title="title"
            item-value="value"
            label="Payment Status"
            variant="outlined"
          />

          <v-text-field
            v-model="editingPayment.paymentNote"
            label="Payment Note (optional)"
            placeholder="e.g., Paid via Venmo, Cash collected"
            variant="outlined"
            hint="Add details about how payment was made"
            persistent-hint
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showPaymentDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="savePaymentStatus"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

.bg-success-lighten-5 {
  background-color: rgba(var(--v-theme-success), 0.05);
}
</style>
