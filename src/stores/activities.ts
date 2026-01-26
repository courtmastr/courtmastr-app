// Tournament Activity Store - Public activity feed for tournaments
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  db,
  collection,
  doc,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from '@/services/firebase';

export type ActivityType =
  | 'match_completed'
  | 'match_started'
  | 'match_ready'
  | 'court_assigned'
  | 'court_maintenance'
  | 'court_available'
  | 'match_reassigned'
  | 'bracket_generated'
  | 'tournament_started'
  | 'announcement';

export interface TournamentActivity {
  id: string;
  tournamentId: string;
  type: ActivityType;
  message: string;
  details?: {
    matchId?: string;
    courtId?: string;
    courtName?: string;
    participant1Name?: string;
    participant2Name?: string;
    winnerName?: string;
    score?: string;
    categoryName?: string;
    oldCourtName?: string;
    newCourtName?: string;
  };
  createdAt: Date;
}

export const useActivityStore = defineStore('activities', () => {
  // State
  const activities = ref<TournamentActivity[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Real-time listener
  let activitiesUnsubscribe: (() => void) | null = null;

  // Getters
  const recentActivities = computed(() =>
    activities.value.slice(0, 20)
  );

  const matchActivities = computed(() =>
    activities.value.filter((a) =>
      ['match_completed', 'match_started', 'match_ready'].includes(a.type)
    )
  );

  const courtActivities = computed(() =>
    activities.value.filter((a) =>
      ['court_assigned', 'court_maintenance', 'court_available', 'match_reassigned'].includes(a.type)
    )
  );

  // Fetch activities for a tournament
  async function fetchActivities(tournamentId: string, maxResults = 50): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const q = query(
        collection(db, `tournaments/${tournamentId}/activities`),
        orderBy('createdAt', 'desc'),
        limit(maxResults)
      );

      const snapshot = await getDocs(q);
      activities.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as TournamentActivity[];
    } catch (err) {
      console.error('Error fetching activities:', err);
      error.value = 'Failed to load activities';
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to real-time activity updates
  function subscribeActivities(tournamentId: string, maxResults = 50): void {
    if (activitiesUnsubscribe) activitiesUnsubscribe();

    const q = query(
      collection(db, `tournaments/${tournamentId}/activities`),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );

    activitiesUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        activities.value = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...convertTimestamps(doc.data()),
        })) as TournamentActivity[];
      },
      (err) => {
        console.error('Error in activities subscription:', err);
        error.value = 'Lost connection to activities';
      }
    );
  }

  // Log a new activity
  async function logActivity(
    tournamentId: string,
    type: ActivityType,
    message: string,
    details?: TournamentActivity['details']
  ): Promise<string> {
    try {
      const docRef = await addDoc(
        collection(db, `tournaments/${tournamentId}/activities`),
        {
          tournamentId,
          type,
          message,
          details: details || {},
          createdAt: serverTimestamp(),
        }
      );
      return docRef.id;
    } catch (err) {
      console.error('Error logging activity:', err);
      throw err;
    }
  }

  // Helper functions for common activity types
  async function logMatchCompleted(
    tournamentId: string,
    matchId: string,
    participant1Name: string,
    participant2Name: string,
    winnerName: string,
    score: string,
    courtName: string,
    categoryName?: string
  ): Promise<void> {
    await logActivity(
      tournamentId,
      'match_completed',
      `${winnerName} defeated opponent (${score}) on ${courtName}`,
      {
        matchId,
        participant1Name,
        participant2Name,
        winnerName,
        score,
        courtName,
        categoryName,
      }
    );
  }

  async function logMatchStarted(
    tournamentId: string,
    matchId: string,
    participant1Name: string,
    participant2Name: string,
    courtName: string,
    categoryName?: string
  ): Promise<void> {
    await logActivity(
      tournamentId,
      'match_started',
      `${participant1Name} vs ${participant2Name} started on ${courtName}`,
      {
        matchId,
        participant1Name,
        participant2Name,
        courtName,
        categoryName,
      }
    );
  }

  async function logMatchReady(
    tournamentId: string,
    matchId: string,
    participant1Name: string,
    participant2Name: string,
    courtName: string,
    categoryName?: string
  ): Promise<void> {
    await logActivity(
      tournamentId,
      'match_ready',
      `Next up on ${courtName}: ${participant1Name} vs ${participant2Name}`,
      {
        matchId,
        participant1Name,
        participant2Name,
        courtName,
        categoryName,
      }
    );
  }

  async function logCourtMaintenance(
    tournamentId: string,
    courtId: string,
    courtName: string,
    reason?: string
  ): Promise<void> {
    const message = reason
      ? `${courtName} under maintenance: ${reason}`
      : `${courtName} under maintenance`;
    await logActivity(tournamentId, 'court_maintenance', message, {
      courtId,
      courtName,
    });
  }

  async function logCourtAvailable(
    tournamentId: string,
    courtId: string,
    courtName: string
  ): Promise<void> {
    await logActivity(
      tournamentId,
      'court_available',
      `${courtName} is now available`,
      { courtId, courtName }
    );
  }

  async function logMatchReassigned(
    tournamentId: string,
    matchId: string,
    participant1Name: string,
    participant2Name: string,
    oldCourtName: string,
    newCourtName: string,
    reason?: string
  ): Promise<void> {
    const message = reason
      ? `${participant1Name} vs ${participant2Name} moved from ${oldCourtName} to ${newCourtName} (${reason})`
      : `${participant1Name} vs ${participant2Name} moved from ${oldCourtName} to ${newCourtName}`;
    await logActivity(tournamentId, 'match_reassigned', message, {
      matchId,
      participant1Name,
      participant2Name,
      oldCourtName,
      newCourtName,
    });
  }

  async function logAnnouncement(
    tournamentId: string,
    message: string
  ): Promise<void> {
    await logActivity(tournamentId, 'announcement', message);
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

  // Cleanup subscription
  function unsubscribe(): void {
    if (activitiesUnsubscribe) {
      activitiesUnsubscribe();
      activitiesUnsubscribe = null;
    }
  }

  // Clear activities
  function clearActivities(): void {
    activities.value = [];
  }

  return {
    // State
    activities,
    loading,
    error,
    // Getters
    recentActivities,
    matchActivities,
    courtActivities,
    // Actions
    fetchActivities,
    subscribeActivities,
    logActivity,
    logMatchCompleted,
    logMatchStarted,
    logMatchReady,
    logCourtMaintenance,
    logCourtAvailable,
    logMatchReassigned,
    logAnnouncement,
    unsubscribe,
    clearActivities,
  };
});
