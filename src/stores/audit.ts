// Audit Trail Store - Tracks critical organizer actions for accountability
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  db,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  where,
} from '@/services/firebase';
import type { QueryConstraint } from 'firebase/firestore';
import { convertTimestamps } from '@/utils/firestore';
import { useAuthStore } from '@/stores/auth';

export type AuditActionType =
  | 'tournament_created'
  | 'tournament_updated'
  | 'tournament_deleted'
  | 'tournament_status_changed'
  | 'category_created'
  | 'category_updated'
  | 'category_deleted'
  | 'court_created'
  | 'court_updated'
  | 'court_deleted'
  | 'registration_approved'
  | 'registration_rejected'
  | 'registration_checked_in'
  | 'registration_checked_in_undo'
  | 'registration_no_show'
  | 'match_completed'
  | 'match_score_updated'
  | 'match_score_corrected'
  | 'bracket_generated'
  | 'bracket_regenerated'
  | 'seeding_updated'
  | 'schedule_generated'
  | 'user_role_changed'
  | 'settings_updated';

export interface AuditRecord {
  id: string;
  tournamentId: string;
  action: AuditActionType;
  actorId: string;
  actorEmail: string;
  actorName: string;
  targetId?: string;
  targetType?: 'tournament' | 'category' | 'court' | 'match' | 'registration' | 'user';
  details: Record<string, unknown>;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  createdAt: Date;
}

type AuditRecordDoc = Omit<AuditRecord, 'id'>;

const toAuditRecord = (id: string, data: Record<string, unknown>): AuditRecord => ({
  id,
  ...(convertTimestamps(data) as AuditRecordDoc),
});

export const useAuditStore = defineStore('audit', () => {
  // State
  const auditLogs = ref<AuditRecord[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Real-time listener
  let auditUnsubscribe: (() => void) | null = null;

  // Getters
  const recentLogs = computed(() => auditLogs.value.slice(0, 50));

  const logsByAction = computed(() => {
    const grouped: Record<string, AuditRecord[]> = {};
    for (const log of auditLogs.value) {
      if (!grouped[log.action]) {
        grouped[log.action] = [];
      }
      grouped[log.action].push(log);
    }
    return grouped;
  });

  const logsByActor = computed(() => {
    const grouped: Record<string, AuditRecord[]> = {};
    for (const log of auditLogs.value) {
      if (!grouped[log.actorId]) {
        grouped[log.actorId] = [];
      }
      grouped[log.actorId].push(log);
    }
    return grouped;
  });

  // Fetch audit logs for a tournament
  async function fetchAuditLogs(
    tournamentId: string,
    options: {
      maxResults?: number;
      action?: AuditActionType;
      actorId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const constraints: QueryConstraint[] = [
        orderBy('createdAt', 'desc'),
        limit(options.maxResults ?? 100),
      ];

      if (options.action) {
        constraints.unshift(where('action', '==', options.action));
      }

      if (options.actorId) {
        constraints.unshift(where('actorId', '==', options.actorId));
      }

      const q = query(
        collection(db, `tournaments/${tournamentId}/audit_logs`),
        ...constraints
      );

      const snapshot = await getDocs(q);
      auditLogs.value = snapshot.docs.map((auditDoc) =>
        toAuditRecord(auditDoc.id, auditDoc.data())
      );
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      error.value = 'Failed to load audit logs';
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to real-time audit updates
  function subscribeAuditLogs(tournamentId: string, maxResults = 50): void {
    if (auditUnsubscribe) auditUnsubscribe();

    const q = query(
      collection(db, `tournaments/${tournamentId}/audit_logs`),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );

    auditUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        auditLogs.value = snapshot.docs.map((auditDoc) =>
          toAuditRecord(auditDoc.id, auditDoc.data())
        );
      },
      (err) => {
        console.error('Error in audit logs subscription:', err);
        error.value = 'Lost connection to audit logs';
      }
    );
  }

  // Log an audit record
  async function logAudit(
    tournamentId: string,
    action: AuditActionType,
    details: Record<string, unknown> = {},
    options: {
      targetId?: string;
      targetType?: AuditRecord['targetType'];
      previousValues?: Record<string, unknown>;
      newValues?: Record<string, unknown>;
    } = {}
  ): Promise<string> {
    const authStore = useAuthStore();
    const actor = authStore.currentUser;
    const firebaseUser = authStore.firebaseUser;

    if (!actor || !firebaseUser) {
      console.warn('Cannot log audit: no authenticated user');
      return '';
    }

    try {
      const docRef = await addDoc(
        collection(db, `tournaments/${tournamentId}/audit_logs`),
        {
          tournamentId,
          action,
          actorId: firebaseUser.uid,
          actorEmail: actor.email || 'unknown',
          actorName: actor.displayName || actor.email || 'Unknown User',
          targetId: options.targetId || null,
          targetType: options.targetType || null,
          details,
          previousValues: options.previousValues || null,
          newValues: options.newValues || null,
          createdAt: serverTimestamp(),
        }
      );
      return docRef.id;
    } catch (err) {
      console.error('Error logging audit record:', err);
      // Don't throw - audit logging should not break user operations
      return '';
    }
  }

  // Helper functions for common audit actions

  async function logTournamentCreated(
    tournamentId: string,
    tournamentName: string,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    await logAudit(tournamentId, 'tournament_created', {
      tournamentName,
      ...details,
    });
  }

  async function logTournamentUpdated(
    tournamentId: string,
    tournamentName: string,
    previousValues: Record<string, unknown>,
    newValues: Record<string, unknown>
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'tournament_updated',
      { tournamentName },
      { targetId: tournamentId, targetType: 'tournament', previousValues, newValues }
    );
  }

  async function logTournamentDeleted(
    tournamentId: string,
    tournamentName: string
  ): Promise<void> {
    await logAudit(tournamentId, 'tournament_deleted', {
      tournamentName,
    });
  }

  async function logTournamentStatusChanged(
    tournamentId: string,
    tournamentName: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'tournament_status_changed',
      { tournamentName, oldStatus, newStatus },
      {
        targetId: tournamentId,
        targetType: 'tournament',
        previousValues: { status: oldStatus },
        newValues: { status: newStatus },
      }
    );
  }

  async function logCategoryCreated(
    tournamentId: string,
    categoryId: string,
    categoryName: string,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'category_created',
      { categoryName, ...details },
      { targetId: categoryId, targetType: 'category' }
    );
  }

  async function logCategoryDeleted(
    tournamentId: string,
    categoryId: string,
    categoryName: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'category_deleted',
      { categoryName },
      { targetId: categoryId, targetType: 'category' }
    );
  }

  async function logCourtCreated(
    tournamentId: string,
    courtId: string,
    courtName: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'court_created',
      { courtName },
      { targetId: courtId, targetType: 'court' }
    );
  }

  async function logCourtDeleted(
    tournamentId: string,
    courtId: string,
    courtName: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'court_deleted',
      { courtName },
      { targetId: courtId, targetType: 'court' }
    );
  }

  async function logRegistrationApproved(
    tournamentId: string,
    registrationId: string,
    participantName: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'registration_approved',
      { participantName },
      { targetId: registrationId, targetType: 'registration' }
    );
  }

  async function logRegistrationRejected(
    tournamentId: string,
    registrationId: string,
    participantName: string,
    reason?: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'registration_rejected',
      { participantName, reason },
      { targetId: registrationId, targetType: 'registration' }
    );
  }

  async function logRegistrationCheckedIn(
    tournamentId: string,
    registrationId: string,
    participantName: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'registration_checked_in',
      { participantName },
      { targetId: registrationId, targetType: 'registration' }
    );
  }

  async function logRegistrationCheckedInUndo(
    tournamentId: string,
    registrationId: string,
    participantName: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'registration_checked_in_undo',
      { participantName },
      { targetId: registrationId, targetType: 'registration' }
    );
  }

  async function logRegistrationNoShow(
    tournamentId: string,
    registrationId: string,
    participantName: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'registration_no_show',
      { participantName },
      { targetId: registrationId, targetType: 'registration' }
    );
  }

  async function logMatchCompleted(
    tournamentId: string,
    matchId: string,
    participant1Name: string,
    participant2Name: string,
    winnerName: string,
    score: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'match_completed',
      {
        participant1Name,
        participant2Name,
        winnerName,
        score,
      },
      { targetId: matchId, targetType: 'match' }
    );
  }

  async function logScoreCorrected(
    tournamentId: string,
    matchId: string,
    participant1Name: string,
    participant2Name: string,
    previousScore: string,
    newScore: string,
    reason?: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'match_score_corrected',
      {
        participant1Name,
        participant2Name,
        reason,
      },
      {
        targetId: matchId,
        targetType: 'match',
        previousValues: { score: previousScore },
        newValues: { score: newScore },
      }
    );
  }

  async function logBracketGenerated(
    tournamentId: string,
    categoryId: string,
    categoryName: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'bracket_generated',
      { categoryName },
      { targetId: categoryId, targetType: 'category' }
    );
  }

  async function logBracketRegenerated(
    tournamentId: string,
    categoryId: string,
    categoryName: string
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'bracket_regenerated',
      { categoryName },
      { targetId: categoryId, targetType: 'category' }
    );
  }

  async function logSeedingUpdated(
    tournamentId: string,
    categoryId: string,
    categoryName: string,
    seedChanges: Array<{ playerName: string; oldSeed: number | null; newSeed: number | null }>
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'seeding_updated',
      { categoryName, seedChanges },
      { targetId: categoryId, targetType: 'category' }
    );
  }

  async function logScheduleGenerated(
    tournamentId: string,
    categoryId: string,
    categoryName: string,
    matchesScheduled: number
  ): Promise<void> {
    await logAudit(
      tournamentId,
      'schedule_generated',
      { categoryName, matchesScheduled },
      { targetId: categoryId, targetType: 'category' }
    );
  }

  // Cleanup subscription
  function unsubscribe(): void {
    if (auditUnsubscribe) {
      auditUnsubscribe();
      auditUnsubscribe = null;
    }
  }

  // Clear logs
  function clearLogs(): void {
    auditLogs.value = [];
  }

  return {
    // State
    auditLogs,
    loading,
    error,
    // Getters
    recentLogs,
    logsByAction,
    logsByActor,
    // Actions
    fetchAuditLogs,
    subscribeAuditLogs,
    logAudit,
    logTournamentCreated,
    logTournamentUpdated,
    logTournamentDeleted,
    logTournamentStatusChanged,
    logCategoryCreated,
    logCategoryDeleted,
    logCourtCreated,
    logCourtDeleted,
    logRegistrationApproved,
    logRegistrationRejected,
    logRegistrationCheckedIn,
    logRegistrationCheckedInUndo,
    logRegistrationNoShow,
    logMatchCompleted,
    logScoreCorrected,
    logBracketGenerated,
    logBracketRegenerated,
    logSeedingUpdated,
    logScheduleGenerated,
    unsubscribe,
    clearLogs,
  };
});
