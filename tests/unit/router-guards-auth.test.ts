import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'vue-router';
import type { UserRole } from '@/types';
import {
  createAuthStoreMock,
  createGuestAuthStoreMock,
  type MockAuthStore,
} from '@tests/unit/helpers/store-mocks';

interface GuardAuthState {
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  isScorekeeper?: boolean;
  loading?: boolean;
  role?: UserRole;
}

interface GuardResult {
  type: 'allow' | 'redirect';
  name: string | null;
  fullPath: string;
  authStore: MockAuthStore;
}

const createAuthState = (state: GuardAuthState): MockAuthStore => {
  const isAuthenticated = state.isAuthenticated ?? true;

  if (!isAuthenticated) {
    return createGuestAuthStoreMock({
      loading: state.loading ?? false,
      initAuth: vi.fn().mockResolvedValue(undefined),
    });
  }

  const role = state.role
    ?? (state.isAdmin ? 'admin' : state.isScorekeeper ? 'scorekeeper' : 'viewer');

  return createAuthStoreMock({
    loading: state.loading ?? false,
    userRole: role,
    isAuthenticated: true,
    isAdmin: state.isAdmin ?? (role === 'admin' || role === 'organizer'),
    isScorekeeper: state.isScorekeeper ?? (role === 'scorekeeper' || role === 'organizer' || role === 'admin'),
    initAuth: vi.fn().mockResolvedValue(undefined),
  });
};

const loadRouter = async (authStore: MockAuthStore): Promise<Router> => {
  vi.resetModules();
  vi.doMock('@/stores/auth', () => ({
    useAuthStore: () => authStore,
  }));

  const routerModule = await import('@/router');
  return routerModule.default;
};

const runGuard = async (path: string, state: GuardAuthState = {}): Promise<GuardResult> => {
  const authStore = createAuthState(state);
  const router = await loadRouter(authStore);

  await router.push(path).catch(() => undefined);
  await router.isReady();

  const current = router.currentRoute.value;
  const isAllow = current.fullPath === path;

  return {
    type: isAllow ? 'allow' : 'redirect',
    name: current.name ? String(current.name) : null,
    fullPath: current.fullPath,
    authStore,
  };
};

describe('router auth guards', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('bypasses auth for overlay and obs routes', async () => {
    const overlayRoute = await runGuard('/overlay/t1/court/c1', { isAuthenticated: false });
    expect(overlayRoute.type).toBe('allow');

    const obsRoute = await runGuard('/obs/t1/scoreboard', { isAuthenticated: false });
    expect(obsRoute.type).toBe('allow');
  });

  it('redirects unauthenticated users to login for protected routes', async () => {
    const result = await runGuard('/tournaments/t1/checkin', { isAuthenticated: false });

    expect(result.type).toBe('redirect');
    expect(result.name).toBe('login');
    expect(result.fullPath).toContain('/login');
    expect(result.fullPath).toContain('redirect=/tournaments/t1/checkin');
  });

  it('redirects non-admin users away from admin-only routes', async () => {
    const result = await runGuard('/tournaments/t1/checkin', {
      isAuthenticated: true,
      isAdmin: false,
      role: 'viewer',
    });

    expect(result.type).toBe('redirect');
    expect(result.name).toBe('tournament-list');
  });

  it('allows scorekeepers into scoring routes and blocks viewers', async () => {
    const scorekeeper = await runGuard('/tournaments/t1/matches', {
      isAuthenticated: true,
      isScorekeeper: true,
      role: 'scorekeeper',
    });

    expect(scorekeeper.type).toBe('allow');

    const viewer = await runGuard('/tournaments/t1/matches', {
      isAuthenticated: true,
      isScorekeeper: false,
      isAdmin: false,
      role: 'viewer',
    });

    expect(viewer.type).toBe('redirect');
    expect(viewer.name).toBe('tournament-list');
  });

  it('initializes auth when the store is still loading', async () => {
    const result = await runGuard('/tournaments', {
      isAuthenticated: true,
      loading: true,
      role: 'viewer',
    });

    expect(result.authStore.initAuth).toHaveBeenCalledTimes(1);
    expect(result.type).toBe('allow');
  });
});
