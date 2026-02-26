import { vi } from 'vitest';
import type { User, UserRole } from '@/types';

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
