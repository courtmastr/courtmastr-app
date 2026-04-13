import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'vue-router';
import type { UserRole, VolunteerRole } from '@/types';
import {
  createAuthStoreMock,
  createGuestAuthStoreMock,
  type MockAuthStore,
  createVolunteerAccessStoreMock,
  type MockVolunteerAccessStore,
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
  volunteerStore: MockVolunteerAccessStore;
}

const ROUTER_GUARD_TEST_TIMEOUT_MS = 15_000;

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

const createVolunteerState = (
  hasSession = false,
  role: VolunteerRole = 'checkin',
): MockVolunteerAccessStore => createVolunteerAccessStoreMock({
  currentSession: hasSession
    ? {
        tournamentId: 't1',
        role,
        sessionToken: 'signed-token',
        pinRevision: 1,
        expiresAtMs: Date.now() + 60_000,
      }
    : null,
  hasValidSession: vi.fn().mockImplementation((tournamentId: string, volunteerRole: VolunteerRole) => (
    hasSession && tournamentId === 't1' && volunteerRole === role
  )),
});

const loadRouter = async (
  authStore: MockAuthStore,
  volunteerStore: MockVolunteerAccessStore,
): Promise<Router> => {
  vi.resetModules();
  vi.doMock('@/stores/auth', () => ({
    useAuthStore: () => authStore,
  }));
  vi.doMock('@/stores/volunteerAccess', () => ({
    useVolunteerAccessStore: () => volunteerStore,
  }));

  const routerModule = await import('@/router');
  return routerModule.default;
};

const runGuard = async (
  path: string,
  state: GuardAuthState = {},
  volunteerSession = false,
  volunteerRole: VolunteerRole = 'checkin',
): Promise<GuardResult> => {
  const authStore = createAuthState(state);
  const volunteerStore = createVolunteerState(volunteerSession, volunteerRole);
  const router = await loadRouter(authStore, volunteerStore);

  await router.push(path).catch(() => undefined);
  await router.isReady();

  const current = router.currentRoute.value;
  const isAllow = current.fullPath === path;

  return {
    type: isAllow ? 'allow' : 'redirect',
    name: current.name ? String(current.name) : null,
    fullPath: current.fullPath,
    authStore,
    volunteerStore,
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
  }, ROUTER_GUARD_TEST_TIMEOUT_MS);

  it('allows unauthenticated access to public marketing routes', async () => {
    const aboutRoute = await runGuard('/about', { isAuthenticated: false });
    expect(aboutRoute.type).toBe('allow');

    const pricingRoute = await runGuard('/pricing', { isAuthenticated: false });
    expect(pricingRoute.type).toBe('allow');

    const privacyRoute = await runGuard('/privacy', { isAuthenticated: false });
    expect(privacyRoute.type).toBe('allow');

    const termsRoute = await runGuard('/terms', { isAuthenticated: false });
    expect(termsRoute.type).toBe('allow');

    const landingRoute = await runGuard('/tournaments/t1/landing', { isAuthenticated: false });
    expect(landingRoute.type).toBe('allow');

    const championsRoute = await runGuard('/tournaments/t1/champions', { isAuthenticated: false });
    expect(championsRoute.type).toBe('allow');

    const helpRoute = await runGuard('/help', { isAuthenticated: false });
    expect(helpRoute.type).toBe('allow');

    const helpTopicRoute = await runGuard('/help/score-matches', { isAuthenticated: false });
    expect(helpTopicRoute.type).toBe('allow');
    expect(helpTopicRoute.name).toBe('help-topic');
  }, ROUTER_GUARD_TEST_TIMEOUT_MS);

  it('registers help routes before organization slug routes', async () => {
    const result = await runGuard('/help/run-a-tournament', { isAuthenticated: false });

    expect(result.type).toBe('allow');
    expect(result.name).toBe('help-topic');
  }, ROUTER_GUARD_TEST_TIMEOUT_MS);

  it('blocks non-web-admin users from /admin/reviews and allows admin users', async () => {
    const organizerResult = await runGuard('/admin/reviews', {
      isAuthenticated: true,
      role: 'organizer',
      isAdmin: true,
    });
    expect(organizerResult.type).toBe('redirect');
    expect(organizerResult.name).toBe('dashboard');

    const adminResult = await runGuard('/admin/reviews', {
      isAuthenticated: true,
      role: 'admin',
      isAdmin: true,
    });
    expect(adminResult.type).toBe('allow');
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
    expect(result.name).toBe('dashboard');
  });

  it('allows admins into player merge and redirects viewers', async () => {
    const adminResult = await runGuard('/players/merge', {
      isAuthenticated: true,
      isAdmin: true,
      role: 'admin',
    });
    expect(adminResult.type).toBe('allow');

    const viewerResult = await runGuard('/players/merge', {
      isAuthenticated: true,
      isAdmin: false,
      role: 'viewer',
    });
    expect(viewerResult.type).toBe('redirect');
    expect(viewerResult.name).toBe('dashboard');
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
    expect(viewer.name).toBe('dashboard');
  });

  it('requires a matching volunteer session for kiosk routes', async () => {
    const allowed = await runGuard('/tournaments/t1/checkin-kiosk', { isAuthenticated: false }, true, 'checkin');
    expect(allowed.type).toBe('allow');

    const redirected = await runGuard('/tournaments/t1/checkin-kiosk', { isAuthenticated: false }, false, 'checkin');
    expect(redirected.type).toBe('redirect');
    expect(redirected.name).toBe('volunteer-checkin-access');
  });

  it('requires a matching volunteer session for volunteer scoring detail routes', async () => {
    const allowed = await runGuard(
      '/tournaments/t1/scoring-kiosk/matches/m1/score?category=cat-1',
      { isAuthenticated: false },
      true,
      'scorekeeper'
    );
    expect(allowed.type).toBe('allow');

    const redirected = await runGuard(
      '/tournaments/t1/scoring-kiosk/matches/m1/score?category=cat-1',
      { isAuthenticated: false },
      false,
      'scorekeeper'
    );
    expect(redirected.type).toBe('redirect');
    expect(redirected.name).toBe('volunteer-scoring-access');
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
