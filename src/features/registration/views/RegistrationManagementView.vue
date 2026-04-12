<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import { PLAYER_IDENTITY_V2 } from '@/config/featureFlags';
import { usePlayerCandidatePicker } from '@/composables/usePlayerCandidatePicker';
import BaseDialog from '@/components/common/BaseDialog.vue';
import FilterBar from '@/components/common/FilterBar.vue';
import PlayerCandidateSuggestions from '@/components/players/PlayerCandidateSuggestions.vue';

import StateBanner from '@/features/tournaments/components/StateBanner.vue';
import { FORMAT_LABELS, type Category } from '@/types';
import { useTournamentStateAdvance } from '@/composables/useTournamentStateAdvance';
import {
  parseImportText,
  normalizeEmail,
  buildPlayerNameKey,
  type ImportPreviewRow,
} from '@/features/registration/utils/csvParser';
import { logger } from '@/utils/logger';

const route = useRoute();
const router = useRouter();
const tournamentStore = useTournamentStore();
const registrationStore = useRegistrationStore();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const PLAYER_FLOW_TIPS = {
  import: 'Step 1: Import players from CSV/TXT or paste rows',
  addPlayer: 'Step 1: Add player profiles first',
  addRegistration: 'Step 2: Register added players into a category',
};

interface PlayerNameSource {
  id?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  displayName?: string;
  fullName?: string;
}


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
const importSourceLabel = ref('');
const pastedImportText = ref('');
const importMode = ref<'upload' | 'paste'>('upload');
const importPreview = ref<ImportPreviewRow[]>([]);
const importErrors = ref<string[]>([]);
const importing = ref(false);

const IMPORT_HEADER =
  'First Name,Last Name,Email,Phone,Skill Level (1-10),Category,Partner First Name,Partner Last Name,Partner Email,Partner Phone,Partner Skill Level (1-10)';
const IMPORT_SINGLES_EXAMPLE =
  "John,Doe,john@example.com,555-1234,7,Men's Singles,,,,,";
const IMPORT_DOUBLES_EXAMPLE =
  "Priya,Shah,priya@example.com,555-2001,8,Mixed Doubles,Arjun,Patel,arjun@example.com,555-2002,8";
const IMPORT_PLACEHOLDER = `${IMPORT_HEADER}\n${IMPORT_SINGLES_EXAMPLE}\n${IMPORT_DOUBLES_EXAMPLE}`;

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
const {
  candidates,
  selectedCandidate,
  isLoading: candidatesLoading,
  search: searchCandidates,
  selectExisting,
  selectCreateNew,
  reset: resetCandidates,
} = usePlayerCandidatePicker();

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

watch(showAddPlayerDialog, (isOpen) => {
  if (!isOpen) {
    resetCandidates();
  }
});

function getPlayerDisplayName(player: PlayerNameSource | undefined): string {
  if (!player) return 'Unknown';

  const firstLast = `${player.firstName || ''} ${player.lastName || ''}`.trim();
  if (firstLast) return firstLast;

  if (player.displayName?.trim()) return player.displayName.trim();
  if (player.name?.trim()) return player.name.trim();
  if (player.fullName?.trim()) return player.fullName.trim();

  return player.id ? `Player ${player.id}` : 'Unknown';
}

function getPlayerItemTitle(player: unknown): string {
  return getPlayerDisplayName(player as PlayerNameSource | undefined);
}

function getPlayerName(playerId: string | undefined): string {
  if (!playerId) return 'Unknown';
  const player = players.value.find((p) => p.id === playerId) as PlayerNameSource | undefined;
  return getPlayerDisplayName(player);
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
    }, PLAYER_IDENTITY_V2 ? selectedCandidate.value : undefined);
    notificationStore.showToast('success', 'Player added successfully');
    showAddPlayerDialog.value = false;
    resetPlayerForm();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add player';
    notificationStore.showToast('error', message);
  }
}

async function searchNewPlayerCandidates(): Promise<void> {
  if (!PLAYER_IDENTITY_V2) return;

  const firstName = newPlayer.value.firstName.trim();
  const lastName = newPlayer.value.lastName.trim();
  const email = newPlayer.value.email.trim();
  const phone = newPlayer.value.phone.trim();

  if (!firstName || !lastName || (!email && !phone)) {
    resetCandidates();
    return;
  }

  await searchCandidates({
    firstName,
    lastName,
    email: email || null,
    phone: phone || null,
  });
}

async function addRegistration() {
  try {
    if (!newRegistration.value.categoryId || !newRegistration.value.playerId) {
      notificationStore.showToast('error', 'Please select category and player');
      return;
    }

    if (isDoublesCategory.value && !newRegistration.value.partnerPlayerId) {
      notificationStore.showToast('error', 'Please select a partner for doubles registration');
      return;
    }

    if (
      isDoublesCategory.value &&
      newRegistration.value.playerId &&
      newRegistration.value.partnerPlayerId === newRegistration.value.playerId
    ) {
      notificationStore.showToast('error', 'Player and partner must be different');
      return;
    }

    const playerName = getPlayerName(newRegistration.value.playerId);
    const partnerName = isDoublesCategory.value ? getPlayerName(newRegistration.value.partnerPlayerId) : '';
    const teamName = isDoublesCategory.value
      ? `${playerName} / ${partnerName}`
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
    logger.error('Error adding registration:', error);
    const message = error instanceof Error ? error.message : 'Failed to add registration';
    notificationStore.showToast('error', message);
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
  resetCandidates();
}

function resetRegistrationForm() {
  newRegistration.value = {
    playerId: '',
    categoryId: '',
    partnerPlayerId: '',
  };
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

// File Import Functions (.csv and .txt)
function downloadTemplate() {
  const categoryNames = categories.value.map((c) => c.name).join(' | ');
  const csvContent = `${IMPORT_HEADER}
${IMPORT_SINGLES_EXAMPLE}
${IMPORT_DOUBLES_EXAMPLE}

# Instructions:
# - First Name and Last Name are required
# - Email is required (used for global player identity across tournaments)
# - Phone is optional
# - Skill Level should be 1-10 (defaults to 5 if empty)
# - Category must match one of your tournament categories exactly:
#   ${categoryNames}
# - For doubles/mixed doubles, provide partner columns in the same row
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
  importSourceLabel.value = '';
  importMode.value = 'upload';
  importErrors.value = [];
  importPreview.value = [];

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result as string;
    runParseImportText(text);
  };
  reader.readAsText(file);
}

function getCategoryById(categoryId: string | null): Category | undefined {
  if (!categoryId) return undefined;
  return categories.value.find((category) => category.id === categoryId);
}

function buildRegistrationKey(
  categoryId: string,
  playerId: string,
  partnerPlayerId?: string
): string {
  if (!partnerPlayerId) {
    return `${categoryId}|player|${playerId}`;
  }

  const sortedPair = [playerId, partnerPlayerId].sort().join('|');
  return `${categoryId}|team|${sortedPair}`;
}

function runParseImportText(text: string) {
  const result = parseImportText(text, categories.value);
  importErrors.value = result.errors;
  importPreview.value = result.preview;
}

function previewPastedData(): void {
  const text = pastedImportText.value.trim();
  if (!text) {
    notificationStore.showToast('error', 'Paste data first');
    return;
  }

  importFile.value = null;
  importSourceLabel.value = 'Pasted data';
  importMode.value = 'paste';
  importErrors.value = [];
  importPreview.value = [];
  runParseImportText(text);
}

interface ImportPlayerPayload {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  skillLevel?: number;
}

async function resolveOrCreateImportPlayer(
  player: ImportPlayerPayload,
  emailCache: Map<string, string>,
  nameCache: Map<string, string>,
): Promise<string> {
  const normalizedEmail = normalizeEmail(player.email);
  const nameKey = buildPlayerNameKey(player.firstName, player.lastName, player.phone);

  if (normalizedEmail && emailCache.has(normalizedEmail)) {
    return emailCache.get(normalizedEmail)!;
  }
  if (nameCache.has(nameKey)) {
    return nameCache.get(nameKey)!;
  }

  if (normalizedEmail) {
    const existingByEmail = players.value.find(
      (existingPlayer) => normalizeEmail(existingPlayer.email) === normalizedEmail
    );
    if (existingByEmail) {
      emailCache.set(normalizedEmail, existingByEmail.id);
      nameCache.set(nameKey, existingByEmail.id);
      return existingByEmail.id;
    }
  }

  const existingByName = players.value.find((existingPlayer) =>
    existingPlayer.firstName.trim().toLowerCase() === player.firstName.trim().toLowerCase() &&
    existingPlayer.lastName.trim().toLowerCase() === player.lastName.trim().toLowerCase() &&
    (player.phone ? (existingPlayer.phone || '').trim().toLowerCase() === player.phone.trim().toLowerCase() : true)
  );
  if (existingByName) {
    if (normalizedEmail) emailCache.set(normalizedEmail, existingByName.id);
    nameCache.set(nameKey, existingByName.id);
    return existingByName.id;
  }

  const playerId = await registrationStore.addPlayer(tournamentId.value, {
    firstName: player.firstName.trim(),
    lastName: player.lastName.trim(),
    email: player.email?.trim() || '',
    phone: player.phone?.trim() || '',
    skillLevel: player.skillLevel ?? 5,
  });

  if (normalizedEmail) emailCache.set(normalizedEmail, playerId);
  nameCache.set(nameKey, playerId);
  return playerId;
}

async function executeImport() {
  if (importPreview.value.length === 0) return;

  importing.value = true;
  let processedRowCount = 0;
  let registrationCount = 0;
  let errorCount = 0;
  const emailCache = new Map<string, string>();
  const nameCache = new Map<string, string>();
  const existingRegistrationKeys = new Set<string>();

  for (const registration of registrations.value) {
    if (
      !registration.categoryId ||
      !registration.playerId ||
      registration.status === 'rejected' ||
      registration.status === 'withdrawn'
    ) {
      continue;
    }
    existingRegistrationKeys.add(
      buildRegistrationKey(registration.categoryId, registration.playerId, registration.partnerPlayerId)
    );
  }

  try {
    for (const row of importPreview.value) {
      try {
        const playerId = await resolveOrCreateImportPlayer({
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          skillLevel: row.skillLevel,
        }, emailCache, nameCache);

        let partnerPlayerId: string | undefined;
        if (row.participantType === 'team') {
          partnerPlayerId = await resolveOrCreateImportPlayer({
            firstName: row.partnerFirstName,
            lastName: row.partnerLastName,
            email: row.partnerEmail,
            phone: row.partnerPhone,
            skillLevel: row.partnerSkillLevel ?? row.skillLevel,
          }, emailCache, nameCache);
        }

        // Create registration if category specified
        if (row.categoryId) {
          const category = getCategoryById(row.categoryId);
          const categoryIsDoubles = category?.type === 'doubles' || category?.type === 'mixed_doubles';
          const registrationKey = buildRegistrationKey(row.categoryId, playerId, partnerPlayerId);

          if (existingRegistrationKeys.has(registrationKey)) {
            errorCount++;
            continue;
          }

          const participantType: 'player' | 'team' = categoryIsDoubles ? 'team' : 'player';
          if (participantType === 'team' && !partnerPlayerId) {
            errorCount++;
            continue;
          }

          await registrationStore.createRegistration(tournamentId.value, {
            tournamentId: tournamentId.value,
            categoryId: row.categoryId,
            participantType,
            playerId: playerId,
            partnerPlayerId: participantType === 'team' ? partnerPlayerId : undefined,
            teamName: participantType === 'team' ? `${row.lastName} / ${row.partnerLastName}` : undefined,
            status: 'approved',
            registeredBy: authStore.currentUser?.id || '',
          });
          existingRegistrationKeys.add(registrationKey);
          registrationCount++;
        }

        processedRowCount++;
      } catch (err) {
        logger.error('Error importing row:', row, err);
        errorCount++;
      }
    }

    notificationStore.showToast(
      'success',
      `Processed ${processedRowCount} row(s), created ${registrationCount} registration(s)${errorCount > 0 ? ` (${errorCount} failed)` : ''}`
    );

    showImportDialog.value = false;
    resetImport();
  } catch (error) {
    notificationStore.showToast('error', 'Import failed');
  } finally {
    importing.value = false;
  }
}

function resetImport() {
  importFile.value = null;
  importSourceLabel.value = '';
  pastedImportText.value = '';
  importMode.value = 'upload';
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

const isAdmin = computed(() => authStore.isAdmin);
const showUnlockDialog = ref(false);

const { advanceState, getNextState, transitionTo } = useTournamentStateAdvance(tournamentId);
</script>

<template>
  <v-container fluid>
    <!-- State Banner -->
    <StateBanner
      v-if="tournament"
      :state="tournament.state || 'DRAFT'"
      :next-state="getNextState(tournament.state || 'DRAFT')"
      :is-admin="isAdmin"
      @advance="advanceState"
      @unlock="showUnlockDialog = true"
      @revert="transitionTo('LIVE')"
    />

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
              aria-label="Back to previous page"
              @click="router.back()"
            />
            <h1 class="text-h4 font-weight-bold text-gradient mb-0">
              Registration
            </h1>
          </div>
        </div>
        <div class="d-flex flex-column flex-sm-row gap-2">
          <v-tooltip
            :text="PLAYER_FLOW_TIPS.import"
            location="bottom"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                variant="outlined"
                prepend-icon="mdi-upload"
                @click="showImportDialog = true"
              >
                Import File
              </v-btn>
            </template>
          </v-tooltip>
          <v-tooltip
            :text="PLAYER_FLOW_TIPS.addPlayer"
            location="bottom"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                variant="outlined"
                prepend-icon="mdi-account-plus"
                @click="showAddPlayerDialog = true"
              >
                Add Player
              </v-btn>
            </template>
          </v-tooltip>
          <v-tooltip
            :text="PLAYER_FLOW_TIPS.addRegistration"
            location="bottom"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                color="primary"
                prepend-icon="mdi-plus"
                elevation="2"
                @click="showAddRegistrationDialog = true"
              >
                Add Registration
              </v-btn>
            </template>
          </v-tooltip>
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

          <v-data-table
            v-model:selected="selectedRegistrations"
            :items="filteredRegistrations"
            :headers="[
              { title: 'Participant', key: 'participant', sortable: true },
              { title: 'Category', key: 'category', sortable: true },
              { title: 'Status', key: 'status', sortable: true },
              { title: 'Actions', key: 'actions', sortable: false },
            ]"
            :loading="loading"
            class="elevation-1"
            show-expand
            item-value="id"
            show-select
          >
            <template #item.participant="{ item }">
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
            <template #item.category="{ item }">
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
            <template #item.status="{ item }">
              <v-chip
                :color="getStatusColor(item.status)"
                :prepend-icon="getStatusIcon(item.status)"
                size="small"
              >
                {{ item.status }}
              </v-chip>
            </template>
            <template #item.actions="{ item }">
              <div class="d-flex justify-end">
                <!-- Pending actions -->
                <template v-if="item.status === 'pending'">
                  <v-btn
                    icon="mdi-check"
                    size="small"
                    color="success"
                    variant="text"
                    title="Approve"
                    :aria-label="`Approve registration for ${getParticipantDisplay(item)}`"
                    @click="approveRegistration(item.id)"
                  />
                  <v-btn
                    icon="mdi-close"
                    size="small"
                    color="error"
                    variant="text"
                    title="Reject"
                    :aria-label="`Reject registration for ${getParticipantDisplay(item)}`"
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
                    :aria-label="`Check in ${getParticipantDisplay(item)}`"
                    @click="checkInRegistration(item.id)"
                  />
                  <v-btn
                    icon="mdi-account-remove"
                    size="small"
                    color="grey"
                    variant="text"
                    title="Withdraw"
                    :aria-label="`Withdraw ${getParticipantDisplay(item)}`"
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
                    :aria-label="`Undo check-in for ${getParticipantDisplay(item)}`"
                    @click="undoCheckInRegistration(item.id)"
                  />
                  <v-btn
                    icon="mdi-account-remove"
                    size="small"
                    color="grey"
                    variant="text"
                    title="Withdraw"
                    :aria-label="`Withdraw ${getParticipantDisplay(item)}`"
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
                    :aria-label="`Reinstate ${getParticipantDisplay(item)}`"
                    @click="reinstateRegistration(item.id)"
                  />
                </template>
              </div>
            </template>
            <template #expanded-row="{ columns, item }">
              <tr>
                <td
                  :colspan="columns.length"
                  class="bg-grey-lighten-5 pa-4"
                >
                  <div class="d-flex flex-wrap gap-4 text-body-2">
                    <div>
                      <strong>Payment:</strong> 
                      <v-chip
                        :color="getPaymentColor(item.paymentStatus)"
                        size="small"
                        class="cursor-pointer"
                        @click="togglePaymentStatus(item)"
                      >
                        {{ item.paymentStatus || 'unpaid' }}
                      </v-chip>
                    </div>
                    <div v-if="item.seed">
                      <strong>Seed:</strong> #{{ item.seed }}
                    </div>
                    <div><strong>Registered:</strong> {{ formatDate(item.createdAt) }}</div>
                  </div>
                </td>
              </tr>
            </template>
          </v-data-table>
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
                    size="small"
                    prepend-icon="mdi-check-decagram"
                    :aria-label="`Check in ${getParticipantDisplay(reg)}`"
                    @click="checkInRegistration(reg.id)"
                  >
                    Check In
                  </v-btn>
                  <v-btn
                    v-else-if="reg.status === 'checked_in'"
                    color="warning"
                    variant="tonal"
                    size="small"
                    prepend-icon="mdi-undo-variant"
                    :aria-label="`Undo check-in for ${getParticipantDisplay(reg)}`"
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
    <BaseDialog
      v-model="showAddPlayerDialog"
      title="Add Player"
      max-width="500"
      @confirm="addPlayer"
      @cancel="showAddPlayerDialog = false"
    >
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
        @blur="searchNewPlayerCandidates"
      />
      <v-text-field
        v-model="newPlayer.phone"
        label="Phone"
        @blur="searchNewPlayerCandidates"
      />
      <PlayerCandidateSuggestions
        v-if="PLAYER_IDENTITY_V2 && (candidatesLoading || candidates.length > 0)"
        :candidates="candidates"
        :selected-player-id="selectedCandidate"
        :is-loading="candidatesLoading"
        class="mb-4"
        @select-existing="selectExisting"
        @create-new="selectCreateNew"
      />
      <v-slider
        v-model="newPlayer.skillLevel"
        label="Skill Level"
        min="1"
        max="10"
        step="1"
        thumb-label
      />
    </BaseDialog>

    <!-- Add Registration Dialog -->
    <BaseDialog
      v-model="showAddRegistrationDialog"
      title="Add Registration"
      max-width="500"
      @confirm="addRegistration"
      @cancel="showAddRegistrationDialog = false"
    >
      <v-alert
        type="info"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        Flow: Step 1 add/import player, Step 2 register the player into a category.
      </v-alert>
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
        :item-title="getPlayerItemTitle"
        item-value="id"
        label="Player"
        required
      />
      <v-select
        v-if="isDoublesCategory"
        v-model="newRegistration.partnerPlayerId"
        :items="players.filter((p) => p.id !== newRegistration.playerId)"
        :item-title="getPlayerItemTitle"
        item-value="id"
        label="Partner"
        required
      />
    </BaseDialog>

    <!-- Bulk Check-In Confirmation Dialog -->
    <BaseDialog
      v-model="showBulkCheckInDialog"
      title="Confirm Bulk Check-In"
      max-width="400"
      @confirm="bulkCheckIn"
      @cancel="showBulkCheckInDialog = false"
    >
      <p>Are you sure you want to check in {{ selectedRegistrations.length }} participants?</p>
    </BaseDialog>

    <!-- Edit Player Dialog -->
    <BaseDialog
      v-model="showEditPlayerDialog"
      title="Edit Player"
      max-width="500"
      @confirm="savePlayer"
      @cancel="showEditPlayerDialog = false"
    >
      <v-row v-if="editingPlayer">
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
        v-if="editingPlayer"
        v-model="editingPlayer.email"
        label="Email"
        type="email"
        variant="outlined"
        prepend-inner-icon="mdi-email"
      />
      <v-text-field
        v-if="editingPlayer"
        v-model="editingPlayer.phone"
        label="Phone"
        variant="outlined"
        prepend-inner-icon="mdi-phone"
      />
      <div
        v-if="editingPlayer"
        class="mt-4"
      >
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
    </BaseDialog>

    <!-- Import Dialog -->
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
          Import Participants
          <v-tooltip
            text="Use same format for Upload and Paste. Doubles require partner columns."
            location="bottom"
          >
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon="mdi-information-outline"
                variant="text"
                size="small"
                class="ml-1"
                aria-label="Import format help"
              />
            </template>
          </v-tooltip>
          <v-spacer />
          <v-btn
            icon="mdi-close"
            variant="text"
            aria-label="Close import dialog"
            @click="showImportDialog = false; resetImport();"
          />
        </v-card-title>

        <v-card-text>
          <!-- Step 1: Download Template & Upload -->
          <div v-if="!importFile && !importSourceLabel">
            <v-alert
              type="info"
              variant="tonal"
              class="mb-4"
            >
              <div class="text-body-2">
                Use one format for Upload and Paste. Existing players are matched by email first, then by name + phone; the same player can register in Singles, Doubles, and Mixed Doubles.
              </div>
            </v-alert>

            <v-tabs
              v-model="importMode"
              color="primary"
              grow
              class="mb-4"
            >
              <v-tab value="upload">
                <v-icon start>
                  mdi-file-upload-outline
                </v-icon>
                Upload File
              </v-tab>
              <v-tab value="paste">
                <v-icon start>
                  mdi-content-paste
                </v-icon>
                Paste Data
              </v-tab>
            </v-tabs>

            <v-window v-model="importMode">
              <v-window-item value="upload">
                <v-card
                  variant="outlined"
                  class="pa-4"
                >
                  <div class="d-flex flex-wrap align-center justify-space-between gap-3 mb-4">
                    <div>
                      <div class="text-subtitle-2">
                        CSV/TXT Upload
                      </div>
                      <div class="text-caption text-grey">
                        Same format as paste mode
                      </div>
                    </div>
                    <v-btn
                      color="primary"
                      variant="outlined"
                      prepend-icon="mdi-download"
                      @click="downloadTemplate"
                    >
                      Download Template
                    </v-btn>
                  </div>

                  <v-file-input
                    label="Upload CSV or TXT File"
                    accept=".csv,.txt"
                    prepend-icon="mdi-file-document-outline"
                    variant="outlined"
                    @change="handleFileUpload"
                  />

                  <div class="text-caption text-grey mb-2">
                    Available categories
                  </div>
                  <div class="d-flex flex-wrap gap-2">
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
                </v-card>
              </v-window-item>

              <v-window-item value="paste">
                <v-card
                  variant="outlined"
                  class="pa-4 mb-4"
                >
                  <div class="text-subtitle-2 mb-2">
                    Format + Examples
                  </div>
                  <v-sheet
                    rounded="lg"
                    color="grey-lighten-4"
                    class="pa-3 mb-3"
                  >
                    <div class="text-caption font-weight-medium mb-1">
                      Header
                    </div>
                    <div class="text-caption import-code">
                      {{ IMPORT_HEADER }}
                    </div>
                  </v-sheet>

                  <v-sheet
                    rounded="lg"
                    color="grey-lighten-4"
                    class="pa-3 mb-3"
                  >
                    <div class="text-caption font-weight-medium mb-1">
                      Singles (one row)
                    </div>
                    <div class="text-caption import-code">
                      {{ IMPORT_SINGLES_EXAMPLE }}
                    </div>
                  </v-sheet>

                  <v-sheet
                    rounded="lg"
                    color="grey-lighten-4"
                    class="pa-3"
                  >
                    <div class="text-caption font-weight-medium mb-1">
                      Doubles (one row with partner columns)
                    </div>
                    <div class="text-caption import-code">
                      {{ IMPORT_DOUBLES_EXAMPLE }}
                    </div>
                  </v-sheet>
                </v-card>

                <v-textarea
                  v-model="pastedImportText"
                  label="Paste rows"
                  variant="outlined"
                  rows="8"
                  auto-grow
                  :placeholder="IMPORT_PLACEHOLDER"
                />
                <div class="d-flex justify-end">
                  <v-btn
                    color="primary"
                    prepend-icon="mdi-magnify"
                    @click="previewPastedData"
                  >
                    Preview Rows
                  </v-btn>
                </div>
              </v-window-item>
            </v-window>
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
              <span class="font-weight-medium">{{ importFile?.name || importSourceLabel }}</span>
              <v-spacer />
              <v-btn
                size="small"
                variant="text"
                @click="resetImport"
              >
                Start Over
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
              Preview ({{ importPreview.length }} row{{ importPreview.length === 1 ? '' : 's' }})
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
                  <td>
                    {{
                      row.participantType === 'team'
                        ? `${row.firstName} ${row.lastName} / ${row.partnerFirstName} ${row.partnerLastName}`
                        : `${row.firstName} ${row.lastName}`
                    }}
                  </td>
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
              No valid rows found. Please check the format.
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
            v-if="(importFile || importSourceLabel) && importPreview.length > 0"
            color="primary"
            :loading="importing"
            @click="executeImport"
          >
            Import {{ importPreview.length }} Rows
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Player Confirmation Dialog -->
    <BaseDialog
      v-model="showDeletePlayerDialog"
      title="Delete Player?"
      max-width="400"
      :persistent="true"
      @confirm="confirmDeletePlayer"
      @cancel="showDeletePlayerDialog = false"
    >
      <p>Are you sure? This will also affect any registrations for this player.</p>
      <template #actions>
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
      </template>
    </BaseDialog>

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

.import-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  line-break: anywhere;
}
</style>
