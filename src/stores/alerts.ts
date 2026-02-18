// Live Ops Alerts Store - Real-time operational alerts for tournament management
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  where,
} from '@/services/firebase';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory = 'court' | 'match' | 'schedule' | 'registration' | 'system';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface LiveOpsAlert {
  id: string;
  tournamentId: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  status: AlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedBy?: string;
  resolvedAt?: Date;
  autoResolve?: boolean;
  createdAt: Date;
}

export const useAlertsStore = defineStore('alerts', () => {
  // State
  const alerts = ref<LiveOpsAlert[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const isSubscribed = ref(false);

  // Real-time listener
  let alertsUnsubscribe: (() => void) | null = null;

  // Getters
  const activeAlerts = computed(() =>
    alerts.value.filter((a) => a.status === 'active')
  );

  const criticalAlerts = computed(() =>
    alerts.value.filter((a) => a.severity === 'critical' && a.status === 'active')
  );

  const warningAlerts = computed(() =>
    alerts.value.filter((a) => a.severity === 'warning' && a.status === 'active')
  );

  const infoAlerts = computed(() =>
    alerts.value.filter((a) => a.severity === 'info' && a.status === 'active')
  );

  const alertsByCategory = computed(() => {
    const grouped: Record<AlertCategory, LiveOpsAlert[]> = {
      court: [],
      match: [],
      schedule: [],
      registration: [],
      system: [],
    };
    for (const alert of activeAlerts.value) {
      grouped[alert.category].push(alert);
    }
    return grouped;
  });

  const hasCriticalAlerts = computed(() => criticalAlerts.value.length > 0);

  const alertCount = computed(() => activeAlerts.value.length);

  // Fetch alerts for a tournament
  async function fetchAlerts(
    tournamentId: string,
    options: {
      maxResults?: number;
      severity?: AlertSeverity;
      category?: AlertCategory;
      status?: AlertStatus;
    } = {}
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const constraints: any[] = [
        orderBy('createdAt', 'desc'),
        limit(options.maxResults || 50),
      ];

      if (options.severity) {
        constraints.unshift(where('severity', '==', options.severity));
      }

      if (options.category) {
        constraints.unshift(where('category', '==', options.category));
      }

      if (options.status) {
        constraints.unshift(where('status', '==', options.status));
      }

      const q = query(
        collection(db, `tournaments/${tournamentId}/alerts`),
        ...constraints
      );

      const snapshot = await getDocs(q);
      alerts.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as LiveOpsAlert[];
    } catch (err) {
      console.error('Error fetching alerts:', err);
      error.value = 'Failed to load alerts';
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to real-time alerts
  function subscribeAlerts(tournamentId: string, maxResults = 50): void {
    if (alertsUnsubscribe) alertsUnsubscribe();

    const q = query(
      collection(db, `tournaments/${tournamentId}/alerts`),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );

    isSubscribed.value = true;
    alertsUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        alerts.value = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...convertTimestamps(doc.data()),
        })) as LiveOpsAlert[];
      },
      (err) => {
        console.error('Error in alerts subscription:', err);
        error.value = 'Lost connection to alerts';
        isSubscribed.value = false;
      }
    );
  }

  // Create a new alert
  async function createAlert(
    tournamentId: string,
    alert: Omit<LiveOpsAlert, 'id' | 'createdAt' | 'status' | 'acknowledgedBy' | 'acknowledgedAt' | 'resolvedBy' | 'resolvedAt'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(
        collection(db, `tournaments/${tournamentId}/alerts`),
        {
          ...alert,
          status: 'active',
          createdAt: serverTimestamp(),
        }
      );
      return docRef.id;
    } catch (err) {
      console.error('Error creating alert:', err);
      throw err;
    }
  }

  // Acknowledge an alert
  async function acknowledgeAlert(
    tournamentId: string,
    alertId: string,
    userId: string
  ): Promise<void> {
    try {
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/alerts`, alertId),
        {
          status: 'acknowledged',
          acknowledgedBy: userId,
          acknowledgedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      throw err;
    }
  }

  // Resolve an alert
  async function resolveAlert(
    tournamentId: string,
    alertId: string,
    userId: string
  ): Promise<void> {
    try {
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/alerts`, alertId),
        {
          status: 'resolved',
          resolvedBy: userId,
          resolvedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error('Error resolving alert:', err);
      throw err;
    }
  }

  // Delete an alert
  async function deleteAlert(tournamentId: string, alertId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, `tournaments/${tournamentId}/alerts`, alertId));
    } catch (err) {
      console.error('Error deleting alert:', err);
      throw err;
    }
  }

  // Helper functions for common alert types

  async function alertCourtMaintenance(
    tournamentId: string,
    courtName: string,
    reason?: string
  ): Promise<string> {
    return createAlert(tournamentId, {
      tournamentId,
      severity: 'warning',
      category: 'court',
      title: `Court ${courtName} Under Maintenance`,
      message: reason || `Court ${courtName} has been taken out of service for maintenance.`,
      details: { courtName, reason },
    });
  }

  async function alertLongMatch(
    tournamentId: string,
    matchId: string,
    participant1Name: string,
    participant2Name: string,
    courtName: string,
    durationMinutes: number
  ): Promise<string> {
    return createAlert(tournamentId, {
      tournamentId,
      severity: durationMinutes > 90 ? 'critical' : 'warning',
      category: 'match',
      title: 'Long Running Match',
      message: `${participant1Name} vs ${participant2Name} on ${courtName} has been running for ${durationMinutes} minutes.`,
      details: { matchId, participant1Name, participant2Name, courtName, durationMinutes },
    });
  }

  async function alertScheduleConflict(
    tournamentId: string,
    matchId: string,
    conflictDetails: string
  ): Promise<string> {
    return createAlert(tournamentId, {
      tournamentId,
      severity: 'critical',
      category: 'schedule',
      title: 'Schedule Conflict Detected',
      message: conflictDetails,
      details: { matchId, conflictDetails },
    });
  }

  async function alertRegistrationPending(
    tournamentId: string,
    count: number
  ): Promise<string> {
    return createAlert(tournamentId, {
      tournamentId,
      severity: count > 10 ? 'warning' : 'info',
      category: 'registration',
      title: 'Pending Registrations',
      message: `${count} registration${count === 1 ? '' : 's'} awaiting approval.`,
      details: { pendingCount: count },
    });
  }

  async function alertCourtAvailable(
    tournamentId: string,
    courtName: string
  ): Promise<string> {
    return createAlert(tournamentId, {
      tournamentId,
      severity: 'info',
      category: 'court',
      title: `Court ${courtName} Available`,
      message: `Court ${courtName} is now available for matches.`,
      details: { courtName },
      autoResolve: true,
    });
  }

  async function alertMatchReady(
    tournamentId: string,
    matchId: string,
    participant1Name: string,
    participant2Name: string,
    courtName: string
  ): Promise<string> {
    return createAlert(tournamentId, {
      tournamentId,
      severity: 'info',
      category: 'match',
      title: 'Match Ready to Start',
      message: `${participant1Name} vs ${participant2Name} assigned to ${courtName}.`,
      details: { matchId, participant1Name, participant2Name, courtName },
      autoResolve: true,
    });
  }

  async function alertSystemError(
    tournamentId: string,
    errorMessage: string,
    context?: Record<string, unknown>
  ): Promise<string> {
    return createAlert(tournamentId, {
      tournamentId,
      severity: 'critical',
      category: 'system',
      title: 'System Error',
      message: errorMessage,
      details: context,
    });
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
    if (alertsUnsubscribe) {
      alertsUnsubscribe();
      alertsUnsubscribe = null;
    }
    isSubscribed.value = false;
  }

  // Clear alerts
  function clearAlerts(): void {
    alerts.value = [];
  }

  return {
    // State
    alerts,
    loading,
    error,
    isSubscribed,
    // Getters
    activeAlerts,
    criticalAlerts,
    warningAlerts,
    infoAlerts,
    alertsByCategory,
    hasCriticalAlerts,
    alertCount,
    // Actions
    fetchAlerts,
    subscribeAlerts,
    createAlert,
    acknowledgeAlert,
    resolveAlert,
    deleteAlert,
    alertCourtMaintenance,
    alertLongMatch,
    alertScheduleConflict,
    alertRegistrationPending,
    alertCourtAvailable,
    alertMatchReady,
    alertSystemError,
    unsubscribe,
    clearAlerts,
  };
});
