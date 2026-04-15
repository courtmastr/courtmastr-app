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
  or,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  Timestamp,
  httpsCallable,
  functions,
  type DocumentReference,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';
import { useMatchScheduler } from '@/composables/useMatchScheduler';
import { useBracketGenerator } from '@/composables/useBracketGenerator';
import { useAuditStore } from '@/stores/audit';
import { useAuthStore } from '@/stores/auth';
import { useOrganizationsStore } from '@/stores/organizations';

const USE_CLOUD_BRACKETS = true; // set to true to test cloud-side bracket generation
const USE_CLOUD_FUNCTION_FOR_SCHEDULE = false;
import type {
  Tournament,
  TournamentStatus,
  Category,
  Court,
  Match,
  LevelDefinition,
  LevelEliminationFormat,
  LevelingMode,
  QualifierCutMode,
} from '@/types';
import { logger } from '@/utils/logger';

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

  // Build a tournament list query scoped by the current user's role/org
  function buildTournamentsQuery() {
    const authStore = useAuthStore();
    const orgsStore = useOrganizationsStore();
    const role = authStore.currentUser?.role;
    const uid = authStore.currentUser?.id;
    const activeOrgId = authStore.currentUser?.activeOrgId;

    if (role === 'admin') {
      // When impersonating an org, scope to that org's tournaments
      const scopedOrgId = orgsStore.currentOrg?.id;
      if (scopedOrgId) {
        return query(
          collection(db, 'tournaments'),
          where('orgId', '==', scopedOrgId),
          orderBy('createdAt', 'desc')
        );
      }
      return query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
    }
    // Org members see all tournaments belonging to their active org,
    // plus any tournament they are explicitly listed as a co-organizer on.
    if (activeOrgId) {
      return query(
        collection(db, 'tournaments'),
        or(
          where('orgId', '==', activeOrgId),
          where('organizerIds', 'array-contains', uid),
        ),
        orderBy('createdAt', 'desc')
      );
    }
    // Fallback: see only tournaments where explicitly listed as organizer
    return query(
      collection(db, 'tournaments'),
      where('organizerIds', 'array-contains', uid),
      orderBy('createdAt', 'desc')
    );
  }

  // Fetch all tournaments
  async function fetchTournaments(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const q = buildTournamentsQuery();
      const snapshot = await getDocs(q);

      tournaments.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Tournament[];
    } catch (err) {
      logger.error('Error fetching tournaments:', err);
      error.value = 'Failed to load tournaments';
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to real-time tournament updates
  function subscribeTournaments(): void {
    if (tournamentsUnsubscribe) return;

    const q = buildTournamentsQuery();

    tournamentsUnsubscribe = onSnapshot(q, (snapshot) => {
      tournaments.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Tournament[];
    }, (err) => {
      logger.error('Error in tournaments subscription:', err);
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
      logger.error('Error fetching tournament:', err);
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

    logger.debug('[tournamentStore.createTournament] db is:', db ? 'defined' : 'UNDEFINED');
    if (!db) {
      throw new Error('Firestore db is not initialized');
    }

    try {
      // Race addDoc against a timeout to prevent hanging
      const authStore = useAuthStore();
      const uid = authStore.currentUser?.id;
      const organizerIds = tournamentData.organizerIds?.length
        ? tournamentData.organizerIds
        : uid ? [uid] : [];

      const addDocPromise = addDoc(collection(db, 'tournaments'), {
        ...tournamentData,
        organizerIds,
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

      const auditStore = useAuditStore();
      await auditStore.logTournamentCreated(docRef.id, tournamentData.name, {
        sport: tournamentData.sport,
        startDate: tournamentData.startDate.toISOString(),
        location: tournamentData.location,
      });

      return docRef.id;
    } catch (err) {
      logger.error('Error creating tournament:', err);
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

      const optimisticUpdates: Partial<Tournament> = {
        ...updates,
        updatedAt: new Date(),
      };

      tournaments.value = tournaments.value.map((tournament) => {
        if (tournament.id !== tournamentId) return tournament;
        return {
          ...tournament,
          ...optimisticUpdates,
        };
      });

      if (currentTournament.value?.id === tournamentId) {
        currentTournament.value = {
          ...currentTournament.value,
          ...optimisticUpdates,
        };
      }
    } catch (err) {
      logger.error('Error updating tournament:', err);
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
    const oldStatus = currentTournament.value?.status;
    const tournamentName = currentTournament.value?.name || tournamentId;
    await updateTournament(tournamentId, { status });
    const auditStore = useAuditStore();
    await auditStore.logTournamentStatusChanged(tournamentId, tournamentName, oldStatus || 'unknown', status);
  }

  // Delete tournament
  async function deleteTournament(tournamentId: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const tournamentName = currentTournament.value?.name || tournamentId;
      await deleteDoc(doc(db, 'tournaments', tournamentId));

      const auditStore = useAuditStore();
      await auditStore.logTournamentDeleted(tournamentId, tournamentName);

      tournaments.value = tournaments.value.filter((t) => t.id !== tournamentId);
      if (currentTournament.value?.id === tournamentId) {
        currentTournament.value = null;
      }
    } catch (err) {
      logger.error('Error deleting tournament:', err);
      error.value = 'Failed to delete tournament';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Organizer management
  async function addOrganizer(tournamentId: string, userId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        organizerIds: arrayUnion(userId),
        updatedAt: serverTimestamp(),
      });
      if (currentTournament.value?.id === tournamentId) {
        const existing = currentTournament.value.organizerIds ?? [];
        if (!existing.includes(userId)) {
          currentTournament.value = {
            ...currentTournament.value,
            organizerIds: [...existing, userId],
          };
        }
      }
    } catch (err) {
      logger.error('Error adding organizer:', err);
      throw err;
    }
  }

  async function removeOrganizer(tournamentId: string, userId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'tournaments', tournamentId), {
        organizerIds: arrayRemove(userId),
        updatedAt: serverTimestamp(),
      });
      if (currentTournament.value?.id === tournamentId) {
        currentTournament.value = {
          ...currentTournament.value,
          organizerIds: (currentTournament.value.organizerIds ?? []).filter((id) => id !== userId),
        };
      }
    } catch (err) {
      logger.error('Error removing organizer:', err);
      throw err;
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
      const auditStore = useAuditStore();
      await auditStore.logCategoryCreated(tournamentId, docRef.id, categoryData.name, {
        format: categoryData.format,
      });

      const createdAt = new Date();
      const optimisticCategory: Category = {
        id: docRef.id,
        tournamentId,
        createdAt,
        updatedAt: createdAt,
        ...categoryData,
      };

      if (!categories.value.some((category) => category.id === docRef.id)) {
        categories.value = [...categories.value, optimisticCategory];
      }

      return docRef.id;
    } catch (err) {
      logger.error('Error adding category:', err);
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

      categories.value = categories.value.map((category) => {
        if (category.id !== categoryId) return category;
        return {
          ...category,
          ...updates,
          updatedAt: new Date(),
        };
      });
    } catch (err) {
      logger.error('Error updating category:', err);
      throw err;
    }
  }

  async function deleteCategory(tournamentId: string, categoryId: string): Promise<void> {
    try {
      const category = categories.value.find((c) => c.id === categoryId);
      await deleteDoc(doc(db, `tournaments/${tournamentId}/categories`, categoryId));
      const auditStore = useAuditStore();
      await auditStore.logCategoryDeleted(tournamentId, categoryId, category?.name || categoryId);
      categories.value = categories.value.filter((c) => c.id !== categoryId);
    } catch (err) {
      logger.error('Error deleting category:', err);
      throw err;
    }
  }

  // Toggle check-in open/closed for a category
  async function toggleCategoryCheckin(
    tournamentId: string,
    categoryId: string,
    open: boolean
  ): Promise<void> {
    try {
      const updates: Record<string, unknown> = {
        checkInOpen: open,
        updatedAt: serverTimestamp(),
      };
      if (!open) {
        updates.checkInClosedAt = serverTimestamp();
      }
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/categories`, categoryId),
        updates
      );
      // Optimistic local update
      const cat = categories.value.find((c) => c.id === categoryId);
      if (cat) {
        cat.checkInOpen = open;
        if (!open) cat.checkInClosedAt = new Date();
      }
    } catch (err) {
      logger.error('Error toggling category check-in:', err);
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
      const auditStore = useAuditStore();
      await auditStore.logCourtCreated(tournamentId, docRef.id, courtData.name);

      const createdAt = new Date();
      const optimisticCourt: Court = {
        id: docRef.id,
        tournamentId,
        name: courtData.name,
        number: courtData.number,
        status: 'available',
        createdAt,
        updatedAt: createdAt,
      };

      if (!courts.value.some((court) => court.id === docRef.id)) {
        courts.value = [...courts.value, optimisticCourt];
      }

      return docRef.id;
    } catch (err) {
      logger.error('Error adding court:', err);
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

      courts.value = courts.value.map((court) => {
        if (court.id !== courtId) return court;
        return {
          ...court,
          ...updates,
          updatedAt: new Date(),
        };
      });
    } catch (err) {
      logger.error('Error updating court:', err);
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

      const now = new Date();
      const reassignedCourtMap = new Map<string, string>();
      for (const reassignedMatch of reassignedMatches) {
        if (reassignedMatch.newCourtId) {
          reassignedCourtMap.set(reassignedMatch.newCourtId, reassignedMatch.matchId);
        }
      }

      courts.value = courts.value.map((court) => {
        if (court.id === courtId) {
          return {
            ...court,
            status: 'maintenance',
            currentMatchId: undefined,
            updatedAt: now,
          };
        }

        const reassignedMatchId = reassignedCourtMap.get(court.id);
        if (reassignedMatchId) {
          return {
            ...court,
            status: 'in_use',
            currentMatchId: reassignedMatchId,
            updatedAt: now,
          };
        }

        return court;
      });

      return { reassignedMatches };
    } catch (err) {
      logger.error('Error setting court to maintenance:', err);
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

      courts.value = courts.value.map((court) => {
        if (court.id !== courtId) return court;
        return {
          ...court,
          status: 'available',
          currentMatchId: undefined,
          updatedAt: new Date(),
        };
      });
    } catch (err) {
      logger.error('Error restoring court from maintenance:', err);
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
    categoryId: string,
    levelId?: string
  ): Promise<void> {
    const asDate = (value: unknown): Date | null => {
      if (value instanceof Date) return value;
      if (value instanceof Timestamp) return value.toDate();
      return null;
    };

    // 1. Check if court is available
    const courtDoc = await getDoc(doc(db, `tournaments/${tournamentId}/courts`, courtId));
    if (!courtDoc.exists()) {
      throw new Error('Court not found');
    }

    const courtData = courtDoc.data();
    if (courtData.status === 'in_use' && courtData.currentMatchId !== matchId) {
      throw new Error(`Court ${courtData.name} is already in use by another match!`);
    }

    const matchScoresPath = levelId
      ? `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match_scores`
      : `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;
    const matchPath = levelId
      ? `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match`
      : `tournaments/${tournamentId}/categories/${categoryId}/match`;

    const [matchScoresDoc, matchDoc] = await Promise.all([
      getDoc(doc(db, matchScoresPath, matchId)),
      getDoc(doc(db, matchPath, matchId)),
    ]);

    const scoreData = matchScoresDoc.exists() ? matchScoresDoc.data() : {};
    const bracketData = matchDoc.exists() ? matchDoc.data() : {};
    const plannedStartAt = asDate(scoreData.plannedStartAt) ?? asDate(scoreData.scheduledTime);
    const isPublished = scoreData.scheduleStatus === 'published' || Boolean(scoreData.publishedAt);
    const participant1Id = scoreData.participant1Id ?? bracketData.participant1Id;
    const participant2Id = scoreData.participant2Id ?? bracketData.participant2Id;

    if (!plannedStartAt) {
      throw new Error('Blocked: Not scheduled');
    }
    if (!isPublished) {
      throw new Error('Blocked: Not published');
    }
    if (!participant1Id || !participant2Id) {
      throw new Error('Blocked: Players not checked-in');
    }

    const registrationChecks = await Promise.all([
      getDoc(doc(db, `tournaments/${tournamentId}/registrations`, participant1Id)),
      getDoc(doc(db, `tournaments/${tournamentId}/registrations`, participant2Id)),
    ]);
    const allCheckedIn = registrationChecks.every((registrationDoc) => {
      if (!registrationDoc.exists()) return false;
      const registrationData = registrationDoc.data();
      return registrationData.status === 'checked_in' || registrationData.isCheckedIn === true;
    });
    if (!allCheckedIn) {
      throw new Error('Blocked: Players not checked-in');
    }

    const batch = writeBatch(db);

    // Update match_scores
    batch.set(
      doc(db, matchScoresPath, matchId),
      {
        tournamentId,
        courtId,
        status: 'in_progress',
        startedAt: serverTimestamp(),
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
    const asDate = (value: unknown): Date | null => {
      if (value instanceof Date) return value;
      if (value instanceof Timestamp) return value.toDate();
      return null;
    };

    const resolveCategoryIds = async (): Promise<string[]> => {
      if (categoryId) return [categoryId];
      if (categories.value.length > 0) return categories.value.map((category) => category.id);

      const categorySnap = await getDocs(collection(db, `tournaments/${tournamentId}/categories`));
      return categorySnap.docs.map((docSnap) => docSnap.id);
    };

    const categoryIds = await resolveCategoryIds();
    if (categoryIds.length === 0) return null;

    interface QueueCandidate {
      id: string;
      categoryId: string;
      data: Record<string, unknown>;
    }

    const candidateResults = await Promise.all(
      categoryIds.map(async (scopedCategoryId) => {
        const scopedQuery = query(
          collection(db, `tournaments/${tournamentId}/categories/${scopedCategoryId}/match_scores`),
          where('status', '==', 'scheduled'),
          where('courtId', '==', null),
          orderBy('queuePosition', 'asc'),
          limit(1)
        );
        const snapshot = await getDocs(scopedQuery);
        if (snapshot.empty) return null;
        const matchDoc = snapshot.docs[0];
        return {
          id: matchDoc.id,
          categoryId: scopedCategoryId,
          data: matchDoc.data(),
        } as QueueCandidate;
      })
    );

    const candidates = candidateResults.filter((item): item is QueueCandidate => item !== null);
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
      const queueA = Number(a.data.queuePosition ?? Number.MAX_SAFE_INTEGER);
      const queueB = Number(b.data.queuePosition ?? Number.MAX_SAFE_INTEGER);
      if (queueA !== queueB) return queueA - queueB;

      const plannedA = asDate(a.data.plannedStartAt)?.getTime()
        ?? asDate(a.data.scheduledTime)?.getTime()
        ?? Number.MAX_SAFE_INTEGER;
      const plannedB = asDate(b.data.plannedStartAt)?.getTime()
        ?? asDate(b.data.scheduledTime)?.getTime()
        ?? Number.MAX_SAFE_INTEGER;
      return plannedA - plannedB;
    });

    const next = candidates[0];
    return {
      id: next.id,
      categoryId: next.categoryId,
      ...(next.data as Record<string, unknown>),
    } as Match;
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

        // Reset each match — skip in-progress / completed / walkover (Bug F fix)
        const skipStatuses = new Set(['in_progress', 'completed', 'walkover']);
        for (const matchDoc of matchesSnapshot.docs) {
          const matchData = matchDoc.data();

          if (skipStatuses.has(matchData.status)) {
            skippedCount++;
            continue;
          }

          // Track courts that need to be released
          if (matchData.courtId) {
            courtsToRelease.add(matchData.courtId);
          }

          // Clear court, scheduled time, and planned time assignments
          await updateDoc(matchDoc.ref, {
            courtId: null,
            scheduledTime: null,
            sequence: null,
            plannedStartAt: null,
            plannedEndAt: null,
            scheduleVersion: null,
            scheduleStatus: null,
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

      return { resetCount, skippedCount, releasedCourts };
    } catch (err) {
      logger.error('Error resetting schedule for category:', err);
      throw err;
    }
  }

  async function deleteCourt(tournamentId: string, courtId: string): Promise<void> {
    try {
      const court = courts.value.find((c) => c.id === courtId);
      await deleteDoc(doc(db, `tournaments/${tournamentId}/courts`, courtId));
      const auditStore = useAuditStore();
      await auditStore.logCourtDeleted(tournamentId, courtId, court?.name || courtId);
      courts.value = courts.value.filter((c) => c.id !== courtId);
    } catch (err) {
      logger.error('Error deleting court:', err);
      throw err;
    }
  }

  // Helper to execute bracket operation (generate or regenerate) with cloud/local branching
  async function executeBracketOperation(
    tournamentId: string,
    categoryId: string,
    options: {
      grandFinal?: 'simple' | 'double' | 'none';
      consolationFinal?: boolean;
    },
    preOperation?: () => Promise<void>
  ): Promise<{ success: boolean; matchCount: number }> {
    const bracketGen = useBracketGenerator();
    loading.value = true;
    error.value = null;

    try {
      if (preOperation) {
        await preOperation();
      }

      if (USE_CLOUD_BRACKETS) {
        const generateBracketFn = httpsCallable<object, { success: boolean; matchCount: number }>(functions, 'generateBracket');
        const res = await generateBracketFn({ tournamentId, categoryId, ...options });
        return { success: true, matchCount: res.data.matchCount ?? 0 };
      } else {
        const result = await bracketGen.generateBracket(tournamentId, categoryId, options);
        return result;
      }
    } catch (err) {
      logger.error('Error executing bracket operation:', err);
      error.value = err instanceof Error ? err.message : 'Failed to execute bracket operation';
      throw err;
    } finally {
      loading.value = false;
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
    const result = await executeBracketOperation(tournamentId, categoryId, options);
    if (result.success) {
      const category = categories.value.find((c) => c.id === categoryId);
      const auditStore = useAuditStore();
      await auditStore.logBracketGenerated(tournamentId, categoryId, category?.name || categoryId);
    }
    return result;
  }

  async function generatePoolEliminationBracket(
    tournamentId: string,
    categoryId: string,
    options: {
      consolationFinal?: boolean;
      /** Pre-sorted advancing registration IDs from AdvanceToEliminationDialog. */
      advancingRegistrationIds?: string[];
      /** Bracket format chosen by the director. */
      eliminationFormat?: 'single_elimination' | 'double_elimination';
      /** Number of qualifiers (for audit/display). */
      qualifierCount?: number;
      /** Cut mode used (for audit/display). */
      qualifierCutMode?: QualifierCutMode;
    } = {}
  ): Promise<{ success: boolean; matchCount: number }> {
    const bracketGen = useBracketGenerator();
    loading.value = true;
    error.value = null;

    try {
      let result: { success: boolean; matchCount: number };
      if (USE_CLOUD_BRACKETS) {
        const fn = httpsCallable<object, { success: boolean; matchCount: number }>(functions, 'generateEliminationFromPool');
        const res = await fn({
          tournamentId,
          categoryId,
          consolationFinal: options.consolationFinal,
          precomputedQualifierRegistrationIds: options.advancingRegistrationIds,
          eliminationFormat: options.eliminationFormat,
        });
        result = { success: true, matchCount: res.data.matchCount ?? 0 };
      } else {
        result = await bracketGen.generateEliminationFromPool(tournamentId, categoryId, {
          consolationFinal: options.consolationFinal,
          precomputedQualifierRegistrationIds: options.advancingRegistrationIds,
          eliminationFormat: options.eliminationFormat,
        });
      }

      // Persist cut metadata so it can be displayed later
      if (options.qualifierCount !== undefined || options.qualifierCutMode !== undefined) {
        await setDoc(
          doc(db, 'tournaments', tournamentId, 'categories', categoryId),
          {
            ...(options.qualifierCount !== undefined ? { qualifierCount: options.qualifierCount } : {}),
            ...(options.qualifierCutMode !== undefined ? { qualifierCutMode: options.qualifierCutMode } : {}),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      const category = categories.value.find((c) => c.id === categoryId);
      const auditStore = useAuditStore();
      await auditStore.logBracketGenerated(
        tournamentId,
        categoryId,
        `${category?.name || categoryId} (Elimination Stage)`
      );
      return result;
    } catch (err) {
      logger.error('Error generating elimination from pool:', err);
      error.value = err instanceof Error ? err.message : 'Failed to generate elimination stage';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCategoryLevels(
    tournamentId: string,
    categoryId: string
  ): Promise<LevelDefinition[]> {
    const snapshot = await getDocs(
      query(
        collection(db, `tournaments/${tournamentId}/categories/${categoryId}/levels`),
        orderBy('order', 'asc')
      )
    );

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps(docSnap.data()),
    })) as LevelDefinition[];
  }

  async function generateCategoryLevels(
    tournamentId: string,
    categoryId: string,
    payload: {
      mode: LevelingMode;
      recommendedMode: LevelingMode;
      levelNames: string[];
      eliminationFormats: LevelEliminationFormat[];
      assignments: Array<{
        registrationId: string;
        levelIndex: number;
        participantName: string;
        poolId: string;
        poolLabel: string;
        poolRank: number;
        globalRank: number;
        overridden: boolean;
      }>;
      globalBands?: number[];
      poolMappings?: Array<{
        poolId: string;
        rank1LevelId: string;
        rank2LevelId: string;
        rank3PlusLevelId: string;
      }>;
    }
  ): Promise<{ success: boolean; levelsGenerated: number }> {
    const bracketGen = useBracketGenerator();
    const auditStore = useAuditStore();
    loading.value = true;
    error.value = null;

    try {
      const levelNames = payload.levelNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0);

      if (levelNames.length < 2 || levelNames.length > 5) {
        throw new Error('Level count must be between 2 and 5');
      }

      const levelDocs = levelNames.map((name, index) => ({
        id: `level-${index + 1}`,
        name,
        order: index + 1,
        eliminationFormat: payload.eliminationFormats[index] || 'single_elimination',
      }));

      const levelByIndex = new Map(levelDocs.map((level, index) => [index, level]));
      const assignmentRows = payload.assignments
        .map((assignment) => {
          const level = levelByIndex.get(assignment.levelIndex);
          if (!level) return null;
          return {
            ...assignment,
            levelId: level.id,
            levelName: level.name,
          };
        })
        .filter((assignment): assignment is NonNullable<typeof assignment> => assignment !== null);

      if (assignmentRows.length === 0) {
        throw new Error('No assignments available to generate levels');
      }

      const existingLevelSnap = await getDocs(
        collection(db, `tournaments/${tournamentId}/categories/${categoryId}/levels`)
      );
      const existingAssignmentSnap = await getDocs(
        collection(db, `tournaments/${tournamentId}/categories/${categoryId}/level_assignments`)
      );

      const resetBatch = writeBatch(db);
      existingLevelSnap.docs.forEach((docSnap) => resetBatch.delete(docSnap.ref));
      existingAssignmentSnap.docs.forEach((docSnap) => resetBatch.delete(docSnap.ref));
      await resetBatch.commit();

      const now = serverTimestamp();
      const configBatch = writeBatch(db);

      for (const level of levelDocs) {
        configBatch.set(
          doc(db, `tournaments/${tournamentId}/categories/${categoryId}/levels`, level.id),
          {
            name: level.name,
            order: level.order,
            eliminationFormat: level.eliminationFormat,
            participantCount: assignmentRows.filter((row) => row.levelId === level.id).length,
            stageId: null,
            createdAt: now,
            updatedAt: now,
          }
        );
      }

      for (const assignment of assignmentRows) {
        configBatch.set(
          doc(db, `tournaments/${tournamentId}/categories/${categoryId}/level_assignments`, assignment.registrationId),
          {
            registrationId: assignment.registrationId,
            levelId: assignment.levelId,
            levelName: assignment.levelName,
            sourceMode: payload.mode,
            poolId: assignment.poolId,
            poolLabel: assignment.poolLabel,
            poolRank: assignment.poolRank,
            globalRank: assignment.globalRank,
            levelSeed: null,
            overridden: assignment.overridden,
            createdAt: now,
            updatedAt: now,
          }
        );
      }

      configBatch.set(
        doc(db, `tournaments/${tournamentId}/categories/${categoryId}/level_generation`, 'config'),
        {
          mode: payload.mode,
          levelCount: levelDocs.length,
          levelNames: levelDocs.map((level) => level.name),
          recommendedMode: payload.recommendedMode,
          poolMappings: payload.poolMappings || [],
          globalBands: payload.globalBands || [],
          createdBy: 'admin',
          createdAt: now,
          updatedAt: now,
        }
      );

      configBatch.set(
        doc(db, 'tournaments', tournamentId, 'categories', categoryId),
        {
          levelingEnabled: true,
          levelingStatus: 'configured',
          selectedLevelMode: payload.mode,
          recommendedLevelMode: payload.recommendedMode,
          levelCount: levelDocs.length,
          levelsVersion: increment(1),
          poolPhase: 'elimination',
          updatedAt: now,
        },
        { merge: true }
      );

      await configBatch.commit();

      for (const level of levelDocs) {
        const levelParticipants = assignmentRows
          .filter((assignment) => assignment.levelId === level.id)
          .sort((a, b) => a.globalRank - b.globalRank)
          .map((assignment) => assignment.registrationId);

        if (levelParticipants.length < 2) {
          continue;
        }

        let levelResult: { success: boolean; stageId: number; matchCount: number };
        if (USE_CLOUD_BRACKETS) {
          const fn = httpsCallable<object, { success: boolean; stageId: number; matchCount: number }>(functions, 'generateLevelBracket');
          const res = await fn({
            tournamentId,
            categoryId,
            levelId: level.id,
            levelName: level.name,
            orderedRegistrationIds: levelParticipants,
            eliminationFormat: level.eliminationFormat,
          });
          levelResult = res.data;
        } else {
          levelResult = await bracketGen.generateLevelBracket(
            tournamentId,
            categoryId,
            level.id,
            level.name,
            levelParticipants,
            level.eliminationFormat
          );
        }

        await setDoc(
          doc(db, `tournaments/${tournamentId}/categories/${categoryId}/levels`, level.id),
          {
            stageId: levelResult.stageId,
            participantCount: levelParticipants.length,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        await auditStore.logBracketGenerated(
          tournamentId,
          categoryId,
          `${level.name} (${level.eliminationFormat})`
        );
      }

      for (const assignment of assignmentRows.filter((item) => item.overridden)) {
        await auditStore.logAudit(
          tournamentId,
          'seeding_updated',
          {
            categoryId,
            registrationId: assignment.registrationId,
            participantName: assignment.participantName,
            levelName: assignment.levelName,
            note: 'Manual level override',
          },
          { targetId: assignment.registrationId, targetType: 'registration' }
        );
      }

      await setDoc(
        doc(db, 'tournaments', tournamentId, 'categories', categoryId),
        {
          levelingStatus: 'generated',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      return { success: true, levelsGenerated: levelDocs.length };
    } catch (err) {
      logger.error('Error generating category levels:', err);
      error.value = err instanceof Error ? err.message : 'Failed to generate levels';
      throw err;
    } finally {
      loading.value = false;
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
    const bracketGen = useBracketGenerator();
    const result = await executeBracketOperation(tournamentId, categoryId, options, async () => {
      if (USE_CLOUD_BRACKETS) {
        const deleteFn = httpsCallable(functions, 'deleteBracket');
        await deleteFn({ tournamentId, categoryId });
      } else {
        await bracketGen.deleteBracket(tournamentId, categoryId);
      }
    });
    if (result.success) {
      const category = categories.value.find((c) => c.id === categoryId);
      const auditStore = useAuditStore();
      await auditStore.logBracketRegenerated(tournamentId, categoryId, category?.name || categoryId);
    }
    return result;
  }

  /**
   * Regenerate pools for a pool_to_elimination category.
   * Deletes existing pool stage (all matches/groups/stages) then runs generateBracket
   * to create fresh pool assignments. Only allowed before schedule is published.
   */
  async function regeneratePools(
    tournamentId: string,
    categoryId: string
  ): Promise<{ success: boolean; matchCount: number }> {
    const bracketGen = useBracketGenerator();
    loading.value = true;
    error.value = null;
    try {
      // Step 1: Delete the existing pool stage completely
      if (USE_CLOUD_BRACKETS) {
        const deleteFn = httpsCallable(functions, 'deleteBracket');
        await deleteFn({ tournamentId, categoryId });
      } else {
        await bracketGen.deleteBracket(tournamentId, categoryId);
      }

      // Step 2: Clear all derived pool state from the category document.
      // This MUST happen before generateBracket() so no stale state survives
      // a regeneration. poolCompletedAt being non-null would ghost the category
      // into the 'levels' phase even with no pool matches present.
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/categories`, categoryId),
        {
          poolCompletedAt: null,
          levelingStatus: null,
          levelingEnabled: null,
          levelCount: null,
          levelsVersion: null,
          poolPhase: 'pool',
          eliminationStageId: null,
          updatedAt: serverTimestamp(),
        }
      );

      // Step 3: Regenerate fresh pools
      const result = USE_CLOUD_BRACKETS
        ? await (async () => {
            const fn = httpsCallable<object, { success: boolean; matchCount: number }>(functions, 'generateBracket');
            const res = await fn({ tournamentId, categoryId });
            return { success: true, matchCount: res.data.matchCount ?? 0 };
          })()
        : await bracketGen.generateBracket(tournamentId, categoryId);
      const category = categories.value.find((c) => c.id === categoryId);
      const auditStore = useAuditStore();
      await auditStore.logBracketGenerated(
        tournamentId,
        categoryId,
        `${category?.name || categoryId} (Pools Regenerated)`
      );
      return result;
    } catch (err) {
      logger.error('Error regenerating pools:', err);
      error.value = err instanceof Error ? err.message : 'Failed to regenerate pools';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function generateSchedule(
    tournamentId: string,
    options: {
      categoryId: string;
      levelId?: string;
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
        logger.error('Error generating schedule:', err);
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
          levelId: options.levelId,
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
        logger.error('Error generating schedule:', err);
        error.value = scheduler.error.value || 'Failed to generate schedule';
        throw err;
      }
    }
  }

  async function clearSchedule(
    tournamentId: string,
    categoryId: string,
    levelId?: string
  ): Promise<{ cleared: number }> {
    const scheduler = useMatchScheduler();
    return await scheduler.clearSchedule(tournamentId, categoryId, levelId);
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
      logger.error('Error updating match schedule:', err);
      throw err;
    }
  }

  // Unsubscribe from the tournaments list (used by superAdmin store on org enter/exit)
  function unsubscribeTournaments(): void {
    if (tournamentsUnsubscribe) {
      tournamentsUnsubscribe();
      tournamentsUnsubscribe = null;
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
    unsubscribeTournaments,
    subscribeTournaments,
    fetchTournament,
    subscribeTournament,
    createTournament,
    updateTournament,
    updateTournamentStatus,
    deleteTournament,
    addOrganizer,
    removeOrganizer,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryCheckin,
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
    generatePoolEliminationBracket,
    fetchCategoryLevels,
    generateCategoryLevels,
    regenerateBracket,
    regeneratePools,
    generateSchedule,
    clearSchedule,
    updateMatchSchedule,
    unsubscribeAll,
    clearCurrentTournament,
  };
});
