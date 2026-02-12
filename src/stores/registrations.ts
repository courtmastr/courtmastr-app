// Registration Store - Pinia store for player/team registration management
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  db,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from '@/services/firebase';
import type { Registration, RegistrationStatus, Player } from '@/types';

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

  // Add a player
  async function addPlayer(
    tournamentId: string,
    playerData: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const normalizedEmail = playerData.email?.toLowerCase().trim() || '';
      if (normalizedEmail) {
        const existingPlayer = players.value.find(
          (p) => p.email?.toLowerCase().trim() === normalizedEmail
        );

        if (existingPlayer) {
          throw new Error(`A player with email "${playerData.email}" already exists`);
        }

        // Re-check against Firestore to avoid race conditions when local state is stale.
        const playersSnapshot = await getDocs(collection(db, `tournaments/${tournamentId}/players`));
        const duplicateInStore = playersSnapshot.docs.some((playerDoc) => {
          const playerEmail = playerDoc.data().email;
          return typeof playerEmail === 'string' && playerEmail.toLowerCase().trim() === normalizedEmail;
        });

        if (duplicateInStore) {
          throw new Error(`A player with email "${playerData.email}" already exists`);
        }
      }

      const docRef = await addDoc(
        collection(db, `tournaments/${tournamentId}/players`),
        {
          ...playerData,
          ...(normalizedEmail ? { emailNormalized: normalizedEmail } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      return docRef.id;
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
    await updateRegistrationStatus(tournamentId, registrationId, 'checked_in');
  }

  // Undo check-in (return to approved)
  async function undoCheckInRegistration(
    tournamentId: string,
    registrationId: string,
    approvedBy?: string
  ): Promise<void> {
    await updateRegistrationStatus(tournamentId, registrationId, 'approved', approvedBy);
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

  // Helper: Convert Firestore Timestamps to Dates
  function convertTimestamps(data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Timestamp) {
        result[key] = value.toDate();
      } else if (value && typeof value === 'object' && 'toDate' in value) {
        result[key] = (value as Timestamp).toDate();
      } else {
        result[key] = value;
      }
    }

    return result;
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
    updatePaymentStatus,
    deleteRegistration,
    getPlayerById,
    unsubscribeAll,
  };
});
