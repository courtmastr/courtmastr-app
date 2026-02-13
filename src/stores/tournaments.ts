// Tournament Store - Pinia store for tournament management
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  httpsCallable,
  functions,
  type DocumentReference,
} from '@/services/firebase';
import { useMatchScheduler } from '@/composables/useMatchScheduler';
import { useBracketGenerator } from '@/composables/useBracketGenerator';

const USE_CLOUD_FUNCTION_FOR_BRACKETS = false;
const USE_CLOUD_FUNCTION_FOR_SCHEDULE = false;
import type {
  Tournament,
  TournamentStatus,
  Category,
  Court,
  Match,
} from '@/types';

export const useTournamentStore = defineStore('tournaments', () => {
  // State
  const tournaments = ref<Tournament[]>([]);
  const currentTournament = ref<Tournament | null>(null);
  const categories = ref<Category[]>([]);
  const courts = ref<Court[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Real-time listeners
  let tournamentsUnsubscribe: (() => void) | null = null;
  let categoriesUnsubscribe: (() => void) | null = null;
  let courtsUnsubscribe: (() => void) | null = null;

  // Getters
  const activeTournaments = computed(() =>
    tournaments.value.filter((t) => t.status === 'active')
  );

  const draftTournaments = computed(() =>
    tournaments.value.filter((t) => t.status === 'draft')
  );

  const registrationOpenTournaments = computed(() =>
    tournaments.value.filter((t) => t.status === 'registration')
  );

  const availableCourts = computed(() =>
    courts.value.filter((c) => c.status === 'available')
  );

  // Fetch all tournaments
  async function fetchTournaments(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const q = query(
        collection(db, 'tournaments'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      tournaments.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Tournament[];
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      error.value = 'Failed to load tournaments';
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to real-time tournament updates
  function subscribeTournaments(): void {
    if (tournamentsUnsubscribe) return;

    const q = query(
      collection(db, 'tournaments'),
      orderBy('createdAt', 'desc')
    );

    tournamentsUnsubscribe = onSnapshot(q, (snapshot) => {
      tournaments.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Tournament[];
    }, (err) => {
      console.error('Error in tournaments subscription:', err);
      error.value = 'Lost connection to tournaments';
    });
  }

  // Fetch single tournament with categories and courts
  async function fetchTournament(tournamentId: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));

      if (!tournamentDoc.exists()) {
        throw new Error('Tournament not found');
      }

      currentTournament.value = {
        id: tournamentDoc.id,
        ...convertTimestamps(tournamentDoc.data()),
      } as Tournament;

      // Fetch categories
      const categoriesSnapshot = await getDocs(
        collection(db, `tournaments/${tournamentId}/categories`)
      );
      categories.value = categoriesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Category[];

      // Fetch courts
      const courtsSnapshot = await getDocs(
        collection(db, `tournaments/${tournamentId}/courts`)
      );
      courts.value = courtsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Court[];

    } catch (err) {
      console.error('Error fetching tournament:', err);
      error.value = 'Failed to load tournament';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to tournament real-time updates
  function subscribeTournament(tournamentId: string): void {
    // Tournament subscription
    if (tournamentsUnsubscribe) tournamentsUnsubscribe();
    tournamentsUnsubscribe = onSnapshot(
      doc(db, 'tournaments', tournamentId),
      (doc) => {
        if (doc.exists()) {
          currentTournament.value = {
            id: doc.id,
            ...convertTimestamps(doc.data()),
          } as Tournament;
        }
      }
    );

    // Categories subscription
    if (categoriesUnsubscribe) categoriesUnsubscribe();
    categoriesUnsubscribe = onSnapshot(
      collection(db, `tournaments/${tournamentId}/categories`),
      (snapshot) => {
        categories.value = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...convertTimestamps(doc.data()),
        })) as Category[];
      }
    );

    // Courts subscription
    if (courtsUnsubscribe) courtsUnsubscribe();
    courtsUnsubscribe = onSnapshot(
      collection(db, `tournaments/${tournamentId}/courts`),
      (snapshot) => {
        courts.value = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...convertTimestamps(doc.data()),
        })) as Court[];
      }
    );
  }

  // Create tournament
  async function createTournament(
    tournamentData: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    loading.value = true;
    error.value = null;

    console.log('[tournamentStore.createTournament] db is:', db ? 'defined' : 'UNDEFINED');
    if (!db) {
      throw new Error('Firestore db is not initialized');
    }

    try {
      // Race addDoc against a timeout to prevent hanging
      const addDocPromise = addDoc(collection(db, 'tournaments'), {
        ...tournamentData,
        startDate: Timestamp.fromDate(tournamentData.startDate),
        endDate: Timestamp.fromDate(tournamentData.endDate),
        registrationDeadline: tournamentData.registrationDeadline
          ? Timestamp.fromDate(tournamentData.registrationDeadline)
          : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('addDoc timed out after 5s')), 5000);
      });
      
      const docRef = await Promise.race([addDocPromise, timeoutPromise]) as DocumentReference;
      return docRef.id;
    } catch (err) {
      console.error('Error creating tournament:', err);
      error.value = 'Failed to create tournament';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Update tournament
  async function updateTournament(
    tournamentId: string,
    updates: Partial<Tournament>
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const updateData: Record<string, unknown> = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      // Convert dates to Timestamps
      if (updates.startDate) {
        updateData.startDate = Timestamp.fromDate(updates.startDate);
      }
      if (updates.endDate) {
        updateData.endDate = Timestamp.fromDate(updates.endDate);
      }
      if (updates.registrationDeadline) {
        updateData.registrationDeadline = Timestamp.fromDate(updates.registrationDeadline);
      }

      await updateDoc(doc(db, 'tournaments', tournamentId), updateData);
    } catch (err) {
      console.error('Error updating tournament:', err);
      error.value = 'Failed to update tournament';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Update tournament status
  async function updateTournamentStatus(
    tournamentId: string,
    status: TournamentStatus
  ): Promise<void> {
    await updateTournament(tournamentId, { status });
  }

  // Delete tournament
  async function deleteTournament(tournamentId: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      await deleteDoc(doc(db, 'tournaments', tournamentId));
      tournaments.value = tournaments.value.filter((t) => t.id !== tournamentId);
      if (currentTournament.value?.id === tournamentId) {
        currentTournament.value = null;
      }
    } catch (err) {
      console.error('Error deleting tournament:', err);
      error.value = 'Failed to delete tournament';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Category management
  async function addCategory(
    tournamentId: string,
    categoryData: Omit<Category, 'id' | 'tournamentId' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(
        collection(db, `tournaments/${tournamentId}/categories`),
        {
          ...categoryData,
          tournamentId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      return docRef.id;
    } catch (err) {
      console.error('Error adding category:', err);
      throw err;
    }
  }

  async function updateCategory(
    tournamentId: string,
    categoryId: string,
    updates: Partial<Category>
  ): Promise<void> {
    try {
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/categories`, categoryId),
        {
          ...updates,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error('Error updating category:', err);
      throw err;
    }
  }

  async function deleteCategory(tournamentId: string, categoryId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, `tournaments/${tournamentId}/categories`, categoryId));
      categories.value = categories.value.filter((c) => c.id !== categoryId);
    } catch (err) {
      console.error('Error deleting category:', err);
      throw err;
    }
  }

  // Court management
  async function addCourt(
    tournamentId: string,
    courtData: Omit<Court, 'id' | 'tournamentId' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(
        collection(db, `tournaments/${tournamentId}/courts`),
        {
          ...courtData,
          tournamentId,
          status: 'available',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      return docRef.id;
    } catch (err) {
      console.error('Error adding court:', err);
      throw err;
    }
  }

  async function updateCourt(
    tournamentId: string,
    courtId: string,
    updates: Partial<Court>
  ): Promise<void> {
    try {
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/courts`, courtId),
        {
          ...updates,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error('Error updating court:', err);
      throw err;
    }
  }

  // Set court to maintenance and reassign any scheduled matches
  async function setCourtMaintenance(
    tournamentId: string,
    courtId: string,
    reason?: string
  ): Promise<{ reassignedMatches: Array<{ matchId: string; oldCourtId: string; newCourtId: string; newCourtName: string }> }> {
    const reassignedMatches: Array<{ matchId: string; oldCourtId: string; newCourtId: string; newCourtName: string }> = [];

    try {
      // Find matches scheduled for this court
      // Find available courts (excluding the one going to maintenance)
      const availableCourtsList = courts.value.filter(
        (c) => c.id !== courtId && c.status === 'available'
      );

      for (const category of categories.value) {
        const matchesQuery = query(
          collection(db, `tournaments/${tournamentId}/categories/${category.id}/match_scores`),
          where('courtId', '==', courtId)
        );
        const matchesSnapshot = await getDocs(matchesQuery);

        // Reassign each match to an available court
        for (const matchDoc of matchesSnapshot.docs) {
          if (availableCourtsList.length === 0) {
            // No courts available - just unassign the court from the match
            await updateDoc(matchDoc.ref, {
              courtId: null,
              updatedAt: serverTimestamp(),
            });
            reassignedMatches.push({
              matchId: matchDoc.id,
              oldCourtId: courtId,
              newCourtId: '',
              newCourtName: 'Queue (no courts available)',
            });
          } else {
            // Assign to first available court
            const newCourt = availableCourtsList[0];
            await updateDoc(matchDoc.ref, {
              courtId: newCourt.id,
              updatedAt: serverTimestamp(),
            });

            // Update new court status
            await updateDoc(
              doc(db, `tournaments/${tournamentId}/courts`, newCourt.id),
              {
                status: 'in_use',
                currentMatchId: matchDoc.id,
                updatedAt: serverTimestamp(),
              }
            );

            reassignedMatches.push({
              matchId: matchDoc.id,
              oldCourtId: courtId,
              newCourtId: newCourt.id,
              newCourtName: newCourt.name,
            });

            // Remove this court from available list for next iteration
            availableCourtsList.shift();
          }
        }
      }

      // Set the court to maintenance
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/courts`, courtId),
        {
          status: 'maintenance',
          currentMatchId: null,
          maintenanceReason: reason || null,
          updatedAt: serverTimestamp(),
        }
      );

      return { reassignedMatches };
    } catch (err) {
      console.error('Error setting court to maintenance:', err);
      throw err;
    }
  }

  // Restore court from maintenance to available
  async function restoreCourtFromMaintenance(
    tournamentId: string,
    courtId: string
  ): Promise<void> {
    try {
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/courts`, courtId),
        {
          status: 'available',
          maintenanceReason: null,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error('Error restoring court from maintenance:', err);
      throw err;
    }
  }

  /**
   * Assign a match to a court manually
   */
  async function assignMatchToCourt(
    tournamentId: string,
    matchId: string,
    courtId: string,
    categoryId: string
  ): Promise<void> {
    const batch = writeBatch(db);

    // Update match_scores
    const matchScoresPath = `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;
    batch.set(
      doc(db, matchScoresPath, matchId),
      {
        courtId,
        status: 'ready',
        assignedAt: serverTimestamp(),
        queuePosition: null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Update court
    batch.update(doc(db, `tournaments/${tournamentId}/courts`, courtId), {
      status: 'in_use',
      currentMatchId: matchId,
      assignedMatchId: matchId,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  }

  /**
   * Release a court back to available
   */
  async function releaseCourtManual(
    tournamentId: string,
    courtId: string
  ): Promise<void> {
    await updateDoc(doc(db, `tournaments/${tournamentId}/courts`, courtId), {
      status: 'available',
      currentMatchId: null,
      assignedMatchId: null,
      lastFreedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Get next match in queue
   */
  async function getNextQueuedMatch(
    tournamentId: string,
    categoryId?: string
  ): Promise<Match | null> {
    const matchScoresPath = categoryId
      ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
      : `tournaments/${tournamentId}/match_scores`;

    const q = query(
      collection(db, matchScoresPath),
      where('status', '==', 'scheduled'),
      where('courtId', '==', null),
      orderBy('queuePosition', 'asc'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const matchDoc = snapshot.docs[0];
    return { id: matchDoc.id, ...matchDoc.data() } as Match;
  }

  // Reset schedule for categories - clears court/time assignments for matches that haven't started
  // Accepts array of category IDs or 'all' for all categories
  async function resetScheduleForCategory(
    tournamentId: string,
    categoryIds: string[] | 'all'
  ): Promise<{ resetCount: number; skippedCount: number; releasedCourts: string[] }> {
    let resetCount = 0;
    let skippedCount = 0;
    const releasedCourts: string[] = [];
    const courtsToRelease = new Set<string>();

    try {
      const categoryIdsToReset = categoryIds === 'all'
        ? categories.value.map((category) => category.id)
        : categoryIds;

      for (const categoryId of categoryIdsToReset) {
        const matchesQuery = query(
          collection(db, `tournaments/${tournamentId}/categories/${categoryId}/match_scores`)
        );

        const matchesSnapshot = await getDocs(matchesQuery);

        // Reset each match
        for (const matchDoc of matchesSnapshot.docs) {
          const matchData = matchDoc.data();

          // Track courts that need to be released
          if (matchData.courtId) {
            courtsToRelease.add(matchData.courtId);
          }

          // Clear court and scheduled time assignments
          await updateDoc(matchDoc.ref, {
            courtId: null,
            scheduledTime: null,
            sequence: null, // Also clear sequence
            updatedAt: serverTimestamp(),
          });
          resetCount++;
        }
      }

      // Release all affected courts back to available
      for (const courtId of courtsToRelease) {
        await updateDoc(
          doc(db, `tournaments/${tournamentId}/courts`, courtId),
          {
            status: 'available',
            currentMatchId: null,
            updatedAt: serverTimestamp(),
          }
        );
        const court = courts.value.find((c) => c.id === courtId);
        if (court) {
          releasedCourts.push(court.name);
        }
      }

      // Count skipped (running/completed) matches from brackets-manager collection
      for (const categoryId of categoryIdsToReset) {
        const skippedQuery = query(
          collection(db, `tournaments/${tournamentId}/categories/${categoryId}/match`),
          where('status', 'in', [3, 4])
        );
        const skippedSnapshot = await getDocs(skippedQuery);
        skippedCount += skippedSnapshot.size;
      }

      return { resetCount, skippedCount, releasedCourts };
    } catch (err) {
      console.error('Error resetting schedule for category:', err);
      throw err;
    }
  }

  async function deleteCourt(tournamentId: string, courtId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, `tournaments/${tournamentId}/courts`, courtId));
      courts.value = courts.value.filter((c) => c.id !== courtId);
    } catch (err) {
      console.error('Error deleting court:', err);
      throw err;
    }
  }

  async function generateBracket(
    tournamentId: string,
    categoryId: string,
    options: {
      grandFinal?: 'simple' | 'double' | 'none';
      consolationFinal?: boolean;
    } = {}
  ): Promise<{ success: boolean; matchCount: number }> {
    if (USE_CLOUD_FUNCTION_FOR_BRACKETS) {
      loading.value = true;
      error.value = null;
      try {
        const generateBracketFn = httpsCallable(functions, 'generateBracket');
        await generateBracketFn({ tournamentId, categoryId, ...options });
        return { success: true, matchCount: 0 };
      } catch (err) {
        console.error('Error generating bracket:', err);
        error.value = err instanceof Error ? err.message : 'Failed to generate bracket';
        throw err;
      } finally {
        loading.value = false;
      }
    } else {
      const bracketGen = useBracketGenerator();
      try {
        const result = await bracketGen.generateBracket(tournamentId, categoryId, options);
        return result;
      } catch (err) {
        console.error('Error generating bracket:', err);
        error.value = bracketGen.error.value || 'Failed to generate bracket';
        throw err;
      }
    }
  }

  async function regenerateBracket(
    tournamentId: string,
    categoryId: string,
    options: {
      grandFinal?: 'simple' | 'double' | 'none';
      consolationFinal?: boolean;
    } = {}
  ): Promise<{ success: boolean; matchCount: number }> {
    if (USE_CLOUD_FUNCTION_FOR_BRACKETS) {
      const bracketGen = useBracketGenerator();
      loading.value = true;
      error.value = null;
      try {
        await bracketGen.deleteBracket(tournamentId, categoryId);
        const generateBracketFn = httpsCallable(functions, 'generateBracket');
        await generateBracketFn({ tournamentId, categoryId, ...options });
        return { success: true, matchCount: 0 };
      } catch (err) {
        console.error('Error regenerating bracket:', err);
        error.value = err instanceof Error ? err.message : 'Failed to regenerate bracket';
        throw err;
      } finally {
        loading.value = false;
      }
    } else {
      const bracketGen = useBracketGenerator();
      try {
        await bracketGen.deleteBracket(tournamentId, categoryId);
        const result = await bracketGen.generateBracket(tournamentId, categoryId, options);
        return result;
      } catch (err) {
        console.error('Error regenerating bracket:', err);
        error.value = bracketGen.error.value || 'Failed to regenerate bracket';
        throw err;
      }
    }
  }

  async function generateSchedule(
    tournamentId: string,
    options: {
      categoryId: string;
      courtIds?: string[];
      startTime?: Date;
    }
  ): Promise<{
    scheduled: number;
    unscheduled: number;
    unscheduledDetails?: Array<{ matchId: string; reason?: string; details?: Record<string, unknown> }>;
    stats?: {
      totalMatches: number;
      scheduledCount: number;
      unscheduledCount: number;
      courtUtilization: number;
      estimatedDuration: number;
    };
  }> {
    if (USE_CLOUD_FUNCTION_FOR_SCHEDULE) {
      loading.value = true;
      error.value = null;
      try {
        const generateScheduleFn = httpsCallable(functions, 'generateSchedule');
        await generateScheduleFn({ tournamentId, ...options });
        return { scheduled: 0, unscheduled: 0 };
      } catch (err) {
        console.error('Error generating schedule:', err);
        error.value = err instanceof Error ? err.message : 'Failed to generate schedule';
        throw err;
      } finally {
        loading.value = false;
      }
    } else {
      const scheduler = useMatchScheduler();
      try {
        const result = await scheduler.scheduleMatches(tournamentId, {
          categoryId: options.categoryId,
          courtIds: options.courtIds,
          startTime: options.startTime,
          respectDependencies: true,
        });
        return {
          scheduled: result.stats.scheduledCount,
          unscheduled: result.stats.unscheduledCount,
          unscheduledDetails: result.unscheduled,
          stats: result.stats,
        };
      } catch (err) {
        console.error('Error generating schedule:', err);
        error.value = scheduler.error.value || 'Failed to generate schedule';
        throw err;
      }
    }
  }
  
  async function clearSchedule(
    tournamentId: string,
    categoryId: string
  ): Promise<{ cleared: number }> {
    const scheduler = useMatchScheduler();
    return await scheduler.clearSchedule(tournamentId, categoryId);
  }

  // Update match schedule (court + time) without marking court as in_use
  // Used by auto-schedule to pre-assign courts and times for future matches
  async function updateMatchSchedule(
    tournamentId: string,
    matchId: string,
    categoryId: string,
    courtId: string,
    scheduledTime: Date
  ): Promise<void> {
    try {
      await setDoc(
        doc(db, `tournaments/${tournamentId}/categories/${categoryId}/match_scores`, matchId),
        {
          courtId,
          scheduledTime: Timestamp.fromDate(scheduledTime),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error updating match schedule:', err);
      throw err;
    }
  }

  // Cleanup subscriptions
  function unsubscribeAll(): void {
    if (tournamentsUnsubscribe) {
      tournamentsUnsubscribe();
      tournamentsUnsubscribe = null;
    }
    if (categoriesUnsubscribe) {
      categoriesUnsubscribe();
      categoriesUnsubscribe = null;
    }
    if (courtsUnsubscribe) {
      courtsUnsubscribe();
      courtsUnsubscribe = null;
    }
  }

  // Clear current tournament
  function clearCurrentTournament(): void {
    currentTournament.value = null;
    categories.value = [];
    courts.value = [];
    unsubscribeAll();
  }

  // Helper to convert Firestore Timestamps to Dates
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

  return {
    // State
    tournaments,
    currentTournament,
    categories,
    courts,
    loading,
    error,
    // Getters
    activeTournaments,
    draftTournaments,
    registrationOpenTournaments,
    availableCourts,
    // Actions
    fetchTournaments,
    subscribeTournaments,
    fetchTournament,
    subscribeTournament,
    createTournament,
    updateTournament,
    updateTournamentStatus,
    deleteTournament,
    addCategory,
    updateCategory,
    deleteCategory,
    addCourt,
    updateCourt,
    deleteCourt,
    setCourtMaintenance,
    restoreCourtFromMaintenance,
    resetScheduleForCategory,
    assignMatchToCourt,
    releaseCourtManual,
    getNextQueuedMatch,
    generateBracket,
    regenerateBracket,
    generateSchedule,
    clearSchedule,
    updateMatchSchedule,
    unsubscribeAll,
    clearCurrentTournament,
  };
});
