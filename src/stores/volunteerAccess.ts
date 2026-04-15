import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { functions, httpsCallable } from '@/services/firebase';
import type { VolunteerRole, VolunteerSession } from '@/types';
import { logger } from '@/utils/logger';

const STORAGE_KEY = 'courtmaster_volunteer_session';

interface IssueVolunteerSessionInput {
  tournamentId: string;
  role: VolunteerRole;
  pin: string;
}

type IssueVolunteerSessionResponse = VolunteerSession;

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
};

const isVolunteerRole = (value: unknown): value is VolunteerRole =>
  value === 'checkin' || value === 'scorekeeper';

const normalizeSession = (value: unknown): VolunteerSession | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<VolunteerSession>;
  if (
    typeof candidate.tournamentId !== 'string' ||
    !isVolunteerRole(candidate.role) ||
    typeof candidate.sessionToken !== 'string' ||
    !Number.isInteger(candidate.pinRevision) ||
    !Number.isFinite(candidate.expiresAtMs)
  ) {
    return null;
  }

  return {
    tournamentId: candidate.tournamentId,
    role: candidate.role,
    sessionToken: candidate.sessionToken,
    pinRevision: Number(candidate.pinRevision),
    expiresAtMs: Number(candidate.expiresAtMs),
  };
};

const readStoredSession = (): VolunteerSession | null => {
  const storage = getStorage();
  const raw = storage?.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = normalizeSession(JSON.parse(raw));
    if (!parsed || parsed.expiresAtMs <= Date.now()) {
      storage?.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    logger.error('Error parsing stored volunteer session:', error);
    storage?.removeItem(STORAGE_KEY);
    return null;
  }
};

const persistSession = (session: VolunteerSession | null): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (!session) {
    storage.removeItem(STORAGE_KEY);
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const useVolunteerAccessStore = defineStore('volunteerAccess', () => {
  const session = ref<VolunteerSession | null>(readStoredSession());
  // True once a volunteer session has been established on this device in this page lifetime.
  // Stays true even after expiry so the scoring store can distinguish "scorer with expired
  // session" from "admin who never had one".
  const isVolunteerDevice = ref(session.value !== null);

  const clearSession = (): void => {
    session.value = null;
    persistSession(null);
  };

  const getActiveSession = (): VolunteerSession | null => {
    if (!session.value) {
      return null;
    }

    if (session.value.expiresAtMs <= Date.now()) {
      clearSession();
      return null;
    }

    return session.value;
  };

  const currentSession = computed(() => getActiveSession());

  const setSession = (nextSession: VolunteerSession): void => {
    session.value = nextSession;
    isVolunteerDevice.value = true;
    persistSession(nextSession);
  };

  const hasValidSession = (tournamentId: string, role: VolunteerRole): boolean => {
    const activeSession = getActiveSession();
    return Boolean(
      activeSession &&
      activeSession.tournamentId === tournamentId &&
      activeSession.role === role
    );
  };

  const requestSession = async (
    input: IssueVolunteerSessionInput,
  ): Promise<VolunteerSession> => {
    const issueVolunteerSessionFn = httpsCallable(functions, 'issueVolunteerSession');
    const response = await issueVolunteerSessionFn(input);
    const nextSession = normalizeSession(
      (response as { data?: IssueVolunteerSessionResponse }).data,
    );

    if (!nextSession) {
      throw new Error('Volunteer session response was invalid');
    }

    setSession(nextSession);
    return nextSession;
  };

  return {
    currentSession,
    isVolunteerDevice,
    clearSession,
    hasValidSession,
    requestSession,
    setSession,
  };
});
