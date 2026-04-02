// Registration Store - Pinia store for player/team registration management
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  db,
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  functions,
  httpsCallable,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';
import type { Registration, RegistrationStatus, Player } from '@/types';
import { useAuditStore } from '@/stores/audit';
import { useAuthStore } from '@/stores/auth';
import { useVolunteerAccessStore } from '@/stores/volunteerAccess';
import { usePlayersStore } from '@/stores/players';
import { PLAYER_IDENTITY_V2 } from '@/config/featureFlags';

type VolunteerCheckInAction = 'check_in' | 'undo_check_in' | 'assign_bib';

export const useRegistrationStore = defineStore('registrations', () => {
  // State
  const registrations = ref<Registration[]>([]);
  const players = ref<Player[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Real-time listeners
  let registrationsUnsubscribe: (() => void) | null = null;
  let playersUnsubscribe: (() => void) | null = null;

  // Getters
  const pendingRegistrations = computed(() =>
    registrations.value.filter((r) => r.status === 'pending')
  );

  const approvedRegistrations = computed(() =>
    registrations.value.filter((r) => r.status === 'approved')
  );

  const checkedInRegistrations = computed(() =>
    registrations.value.filter((r) => r.status === 'checked_in')
  );

  const registrationsByCategory = computed(() => {
    const grouped: Record<string, Registration[]> = {};
    for (const reg of registrations.value) {
      if (!grouped[reg.categoryId]) {
        grouped[reg.categoryId] = [];
      }
      grouped[reg.categoryId].push(reg);
    }
    return grouped;
  });

  const getVolunteerSessionToken = (
    tournamentId: string,
    role: 'checkin' | 'scorekeeper',
  ): string | null => {
    const volunteerAccessStore = useVolunteerAccessStore();
    if (!volunteerAccessStore.hasValidSession(tournamentId, role)) {
      return null;
    }

    return volunteerAccessStore.currentSession?.sessionToken ?? null;
  };

  const applyVolunteerCheckInAction = async (
    tournamentId: string,
    registrationId: string,
    action: VolunteerCheckInAction,
    bibNumber?: number,
  ): Promise<boolean> => {
    const sessionToken = getVolunteerSessionToken(tournamentId, 'checkin');
    if (!sessionToken) {
      return false;
    }

    const volunteerCheckInFn = httpsCallable(functions, 'applyVolunteerCheckInAction');
    await volunteerCheckInFn({
      tournamentId,
      registrationId,
      action,
      bibNumber,
      sessionToken,
    });
    return true;
  };

  // Fetch registrations for a tournament
  async function fetchRegistrations(tournamentId: string, categoryId?: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      let q;
      if (categoryId) {
        q = query(
          collection(db, `tournaments/${tournamentId}/registrations`),
          where('categoryId', '==', categoryId),
          orderBy('registeredAt', 'desc')
        );
      } else {
        q = query(
          collection(db, `tournaments/${tournamentId}/registrations`),
          orderBy('registeredAt', 'desc')
        );
      }

      const snapshot = await getDocs(q);
      registrations.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Registration[];
    } catch (err) {
      console.error('Error fetching registrations:', err);
      error.value = 'Failed to load registrations';
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to real-time registration updates
  function subscribeRegistrations(tournamentId: string, categoryId?: string): void {
    if (registrationsUnsubscribe) registrationsUnsubscribe();

    let q;
    if (categoryId) {
      q = query(
        collection(db, `tournaments/${tournamentId}/registrations`),
        where('categoryId', '==', categoryId),
        orderBy('registeredAt', 'desc')
      );
    } else {
      q = query(
        collection(db, `tournaments/${tournamentId}/registrations`),
        orderBy('registeredAt', 'desc')
      );
    }

    registrationsUnsubscribe = onSnapshot(q, (snapshot) => {
      registrations.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Registration[];
    }, (err) => {
      console.error('Error in registrations subscription:', err);
      error.value = 'Lost connection to registrations';
    });
  }

  // Fetch players for a tournament
  async function fetchPlayers(tournamentId: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const q = query(
        collection(db, `tournaments/${tournamentId}/players`),
        orderBy('lastName'),
        orderBy('firstName')
      );

      const snapshot = await getDocs(q);
      players.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Player[];
    } catch (err) {
      console.error('Error fetching players:', err);
      error.value = 'Failed to load players';
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to players
  function subscribePlayers(tournamentId: string): void {
    if (playersUnsubscribe) playersUnsubscribe();

    const q = query(
      collection(db, `tournaments/${tournamentId}/players`),
      orderBy('lastName'),
      orderBy('firstName')
    );

    playersUnsubscribe = onSnapshot(q, (snapshot) => {
      players.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Player[];
    });
  }

  // Add a player — creates global player record then writes tournament mirror
  async function addPlayer(
    tournamentId: string,
    playerData: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const playersStore = usePlayersStore();
      const email = playerData.email?.trim() || '';
      if (!email && !PLAYER_IDENTITY_V2) throw new Error('Player email is required');

      // Step 1: Find or create global player (atomic via runTransaction)
      const globalPlayerId = await playersStore.findOrCreateByEmail(email, {
        firstName: playerData.firstName,
        lastName: playerData.lastName,
        phone: playerData.phone ?? undefined,
        skillLevel: playerData.skillLevel ?? undefined,
      });

      // Step 2: Write tournament mirror using setDoc — ID must match global player ID
      await setDoc(
        doc(db, `tournaments/${tournamentId}/players`, globalPlayerId),
        {
          ...playerData,
          id: globalPlayerId,
          globalPlayerId,
          emailNormalized: email.toLowerCase().trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      return globalPlayerId;
    } catch (err) {
      console.error('Error adding player:', err);
      throw err;
    }
  }

  // Update a player
  async function updatePlayer(
    tournamentId: string,
    playerId: string,
    updates: Partial<Player>
  ): Promise<void> {
    try {
      const normalizedEmail = updates.email?.toLowerCase().trim();
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/players`, playerId),
        {
          ...updates,
          ...(normalizedEmail !== undefined ? { emailNormalized: normalizedEmail } : {}),
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error('Error updating player:', err);
      throw err;
    }
  }

  // Delete a player
  async function deletePlayer(tournamentId: string, playerId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, `tournaments/${tournamentId}/players`, playerId));
      players.value = players.value.filter((p) => p.id !== playerId);
    } catch (err) {
      console.error('Error deleting player:', err);
      throw err;
    }
  }

  // Bulk import players
  async function bulkImportPlayers(
    tournamentId: string,
    playersData: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<string[]> {
    const playerIds: string[] = [];

    for (const playerData of playersData) {
      try {
        const id = await addPlayer(tournamentId, playerData);
        playerIds.push(id);
      } catch (err) {
        console.error('Error importing player:', playerData, err);
      }
    }

    return playerIds;
  }

  // Create registration
  async function createRegistration(
    tournamentId: string,
    registrationData: Omit<Registration, 'id' | 'registeredAt' | 'approvedAt' | 'approvedBy'>
  ): Promise<string> {
    try {
      // Filter out undefined values
      const safeData = Object.entries(registrationData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      const docRef = await addDoc(
        collection(db, `tournaments/${tournamentId}/registrations`),
        {
          ...safeData,
          registeredAt: serverTimestamp(),
        }
      );
      return docRef.id;
    } catch (err) {
      console.error('Error creating registration:', err);
      throw err;
    }
  }

  // Update registration status
  async function updateRegistrationStatus(
    tournamentId: string,
    registrationId: string,
    status: RegistrationStatus,
    approvedBy?: string
  ): Promise<void> {
    try {
      const updates: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };

      if (status === 'approved' && approvedBy) {
        updates.approvedAt = serverTimestamp();
        updates.approvedBy = approvedBy;
      }

      await updateDoc(
        doc(db, `tournaments/${tournamentId}/registrations`, registrationId),
        updates
      );
    } catch (err) {
      console.error('Error updating registration status:', err);
      throw err;
    }
  }

  // Approve registration
  async function approveRegistration(
    tournamentId: string,
    registrationId: string,
    approvedBy: string
  ): Promise<void> {
    await updateRegistrationStatus(tournamentId, registrationId, 'approved', approvedBy);
  }

  // Reject registration
  async function rejectRegistration(
    tournamentId: string,
    registrationId: string
  ): Promise<void> {
    await updateRegistrationStatus(tournamentId, registrationId, 'rejected');
  }

  // Check in registration
  async function checkInRegistration(
    tournamentId: string,
    registrationId: string
  ): Promise<void> {
    const registration = registrations.value.find(r => r.id === registrationId);
    const participantName = registration?.teamName || registration?.playerId || registrationId;

    const usedVolunteerCallable = await applyVolunteerCheckInAction(
      tournamentId,
      registrationId,
      'check_in',
    );
    if (!usedVolunteerCallable) {
      await updateRegistrationStatus(tournamentId, registrationId, 'checked_in');
    }

    const auditStore = useAuditStore();
    const authStore = useAuthStore();
    const actor = authStore.currentUser;

    if (actor) {
      await auditStore.logRegistrationCheckedIn(
        tournamentId,
        registrationId,
        participantName
      );
    }
  }

  // Undo check-in (return to approved)
  async function undoCheckInRegistration(
    tournamentId: string,
    registrationId: string,
    approvedBy?: string
  ): Promise<void> {
    const registration = registrations.value.find(r => r.id === registrationId);
    const participantName = registration?.teamName || registration?.playerId || registrationId;

    const usedVolunteerCallable = await applyVolunteerCheckInAction(
      tournamentId,
      registrationId,
      'undo_check_in',
    );
    if (!usedVolunteerCallable) {
      await updateRegistrationStatus(tournamentId, registrationId, 'approved', approvedBy);
    }

    const auditStore = useAuditStore();
    const authStore = useAuthStore();
    const actor = authStore.currentUser;

    if (actor) {
      await auditStore.logRegistrationCheckedInUndo(
        tournamentId,
        registrationId,
        participantName
      );
    }
  }

  // Withdraw registration
  async function withdrawRegistration(
    tournamentId: string,
    registrationId: string
  ): Promise<void> {
    await updateRegistrationStatus(tournamentId, registrationId, 'withdrawn');
  }

  // Reinstate withdrawn registration (return to approved)
  async function reinstateRegistration(
    tournamentId: string,
    registrationId: string,
    approvedBy?: string
  ): Promise<void> {
    await updateRegistrationStatus(tournamentId, registrationId, 'approved', approvedBy);
  }

  // Mark registration as no-show
  async function markNoShowRegistration(
    tournamentId: string,
    registrationId: string,
    markedBy?: string
  ): Promise<void> {
    const registration = registrations.value.find(r => r.id === registrationId);
    const participantName = registration?.teamName || registration?.playerId || registrationId;

    await updateRegistrationStatus(tournamentId, registrationId, 'no_show', markedBy);

    const auditStore = useAuditStore();
    const authStore = useAuthStore();
    const actor = authStore.currentUser;

    if (actor) {
      await auditStore.logRegistrationNoShow(
        tournamentId,
        registrationId,
        participantName
      );
    }
  }

  // Undo no-show (return to approved)
  async function undoNoShowRegistration(
    tournamentId: string,
    registrationId: string,
    approvedBy?: string
  ): Promise<void> {
    const registration = registrations.value.find(r => r.id === registrationId);
    const participantName = registration?.teamName || registration?.playerId || registrationId;

    await updateRegistrationStatus(tournamentId, registrationId, 'approved', approvedBy);

    const auditStore = useAuditStore();
    const authStore = useAuthStore();
    const actor = authStore.currentUser;

    if (actor) {
      await auditStore.logRegistrationNoShow(
        tournamentId,
        registrationId,
        participantName
      );
    }
  }

  // Assign bib number to registration
  async function assignBibNumber(
    tournamentId: string,
    registrationId: string,
    bibNumber: number
  ): Promise<void> {
    try {
      const usedVolunteerCallable = await applyVolunteerCheckInAction(
        tournamentId,
        registrationId,
        'assign_bib',
        bibNumber,
      );
      if (usedVolunteerCallable) {
        return;
      }

      await updateDoc(
        doc(db, `tournaments/${tournamentId}/registrations`, registrationId),
        {
          bibNumber,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error('Error assigning bib number:', err);
      throw err;
    }
  }

  // Set seed for registration
  async function setSeed(
    tournamentId: string,
    registrationId: string,
    seed: number
  ): Promise<void> {
    try {
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/registrations`, registrationId),
        {
          seed,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error('Error setting seed:', err);
      throw err;
    }
  }

  // Update seed for registration (can be null to clear)
  async function updateSeed(
    tournamentId: string,
    registrationId: string,
    seed: number | null
  ): Promise<void> {
    try {
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/registrations`, registrationId),
        {
          seed: seed,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error('Error updating seed:', err);
      throw err;
    }
  }

  // Batch update seeds efficiently using writeBatch
  async function batchUpdateSeeds(
    tournamentId: string,
    updates: { registrationId: string; seed: number | null }[]
  ): Promise<void> {
    if (!updates.length) return;

    try {
      const batch = writeBatch(db);
      for (const update of updates) {
        const ref = doc(db, `tournaments/${tournamentId}/registrations`, update.registrationId);
        batch.update(ref, {
          seed: update.seed,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();

      // We do not need to manually update local state since we use onSnapshot for registrations.
    } catch (err) {
      console.error('Error batch updating seeds:', err);
      throw err;
    }
  }

  // Update payment status
  async function updatePaymentStatus(
    tournamentId: string,
    registrationId: string,
    paymentStatus: 'unpaid' | 'paid' | 'partial' | 'refunded',
    paymentNote?: string
  ): Promise<void> {
    try {
      const updates: Record<string, unknown> = {
        paymentStatus,
        updatedAt: serverTimestamp(),
      };
      if (paymentNote !== undefined) {
        updates.paymentNote = paymentNote;
      }
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/registrations`, registrationId),
        updates
      );
    } catch (err) {
      console.error('Error updating payment status:', err);
      throw err;
    }
  }

  // Delete registration
  async function deleteRegistration(
    tournamentId: string,
    registrationId: string
  ): Promise<void> {
    try {
      await deleteDoc(doc(db, `tournaments/${tournamentId}/registrations`, registrationId));
      registrations.value = registrations.value.filter((r) => r.id !== registrationId);
    } catch (err) {
      console.error('Error deleting registration:', err);
      throw err;
    }
  }

  // Get player by ID
  function getPlayerById(playerId: string): Player | undefined {
    return players.value.find((p) => p.id === playerId);
  }

  // Cleanup subscriptions
  function unsubscribeAll(): void {
    if (registrationsUnsubscribe) {
      registrationsUnsubscribe();
      registrationsUnsubscribe = null;
    }
    if (playersUnsubscribe) {
      playersUnsubscribe();
      playersUnsubscribe = null;
    }
  }

  return {
    // State
    registrations,
    players,
    loading,
    error,
    // Getters
    pendingRegistrations,
    approvedRegistrations,
    checkedInRegistrations,
    registrationsByCategory,
    // Actions
    fetchRegistrations,
    subscribeRegistrations,
    fetchPlayers,
    subscribePlayers,
    addPlayer,
    updatePlayer,
    deletePlayer,
    bulkImportPlayers,
    createRegistration,
    updateRegistrationStatus,
    approveRegistration,
    rejectRegistration,
    checkInRegistration,
    undoCheckInRegistration,
    withdrawRegistration,
    reinstateRegistration,
    setSeed,
    updateSeed,
    batchUpdateSeeds,
    updatePaymentStatus,
    deleteRegistration,
    getPlayerById,
    markNoShowRegistration,
    undoNoShowRegistration,
    assignBibNumber,
    unsubscribeAll,
  };
});
