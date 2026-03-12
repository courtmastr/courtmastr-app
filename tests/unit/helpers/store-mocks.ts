import { vi } from 'vitest';
import type { User, UserRole, VolunteerRole, VolunteerSession } from '@/types';

export interface MockAuthStore {
  currentUser: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isOrganizer: boolean;
  isScorekeeper: boolean;
  userRole: UserRole;
  initAuth: ReturnType<typeof vi.fn>;
  signIn: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
}

export interface MockNotificationStore {
  showToast: ReturnType<typeof vi.fn>;
}

export interface MockVolunteerAccessStore {
  currentSession: VolunteerSession | null;
  hasValidSession: ReturnType<typeof vi.fn>;
  requestSession: ReturnType<typeof vi.fn>;
  setSession: ReturnType<typeof vi.fn>;
  clearSession: ReturnType<typeof vi.fn>;
}

const buildMockUser = (role: UserRole): User => ({
  id: 'user-1',
  email: 'user-1@example.test',
  displayName: 'Test User',
  role,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

export const createAuthStoreMock = (
  overrides: Partial<MockAuthStore> = {}
): MockAuthStore => {
  const role = overrides.userRole ?? 'viewer';
  const currentUser = overrides.currentUser ?? buildMockUser(role);
  const isAuthenticated = overrides.isAuthenticated ?? Boolean(currentUser);

  return {
    currentUser,
    loading: overrides.loading ?? false,
    isAuthenticated,
    isAdmin: overrides.isAdmin ?? (role === 'admin' || role === 'organizer'),
    isOrganizer: overrides.isOrganizer ?? (role === 'organizer' || role === 'admin'),
    isScorekeeper: overrides.isScorekeeper ?? (role === 'scorekeeper' || role === 'organizer' || role === 'admin'),
    userRole: role,
    initAuth: overrides.initAuth ?? vi.fn().mockResolvedValue(undefined),
    signIn: overrides.signIn ?? vi.fn().mockResolvedValue(undefined),
    signOut: overrides.signOut ?? vi.fn().mockResolvedValue(undefined),
  };
};

export const createGuestAuthStoreMock = (
  overrides: Partial<MockAuthStore> = {}
): MockAuthStore => createAuthStoreMock({
  currentUser: null,
  isAuthenticated: false,
  isAdmin: false,
  isOrganizer: false,
  isScorekeeper: false,
  userRole: 'viewer',
  ...overrides,
});

export const createNotificationStoreMock = (
  overrides: Partial<MockNotificationStore> = {}
): MockNotificationStore => ({
  showToast: overrides.showToast ?? vi.fn(),
});

const buildVolunteerSession = (
  role: VolunteerRole = 'checkin',
): VolunteerSession => ({
  tournamentId: 't1',
  role,
  sessionToken: 'signed-token',
  pinRevision: 1,
  expiresAtMs: Date.now() + 60_000,
});

export const createVolunteerAccessStoreMock = (
  overrides: Partial<MockVolunteerAccessStore> = {},
): MockVolunteerAccessStore => {
  const currentSession = overrides.currentSession ?? buildVolunteerSession();

  return {
    currentSession,
    hasValidSession: overrides.hasValidSession ?? vi.fn().mockReturnValue(Boolean(currentSession)),
    requestSession: overrides.requestSession ?? vi.fn().mockResolvedValue(currentSession),
    setSession: overrides.setSession ?? vi.fn(),
    clearSession: overrides.clearSession ?? vi.fn(),
  };
};
