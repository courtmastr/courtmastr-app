import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'vue-router';
import {
  createAuthStoreMock,
  createGuestAuthStoreMock,
  createVolunteerAccessStoreMock,
  type MockAuthStore,
  type MockVolunteerAccessStore,
} from '@tests/unit/helpers/store-mocks';

const PLAYER_MERGE_ROUTE_TEST_TIMEOUT_MS = 15_000;

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

describe('player merge route', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('allows admins to access the player merge route', async () => {
    const authStore = createAuthStoreMock({
      userRole: 'admin',
      isAdmin: true,
      isAuthenticated: true,
    });
    const volunteerStore = createVolunteerAccessStoreMock({ currentSession: null });
    const router = await loadRouter(authStore, volunteerStore);

    await router.push('/players/merge').catch(() => undefined);
    await router.isReady();

    expect(router.currentRoute.value.name).toBe('player-merge');
  }, PLAYER_MERGE_ROUTE_TEST_TIMEOUT_MS);

  it('redirects legacy player merge paths to the shared merge workspace', async () => {
    const authStore = createAuthStoreMock({
      userRole: 'admin',
      isAdmin: true,
      isAuthenticated: true,
    });
    const volunteerStore = createVolunteerAccessStoreMock({ currentSession: null });
    const router = await loadRouter(authStore, volunteerStore);

    await router.push('/players/player-source/merge').catch(() => undefined);
    await router.isReady();

    expect(router.currentRoute.value.name).toBe('player-merge');
    expect(router.currentRoute.value.query.source).toBe('player-source');
  }, PLAYER_MERGE_ROUTE_TEST_TIMEOUT_MS);

  it('redirects viewers away from the player merge route', async () => {
    const authStore = createAuthStoreMock({
      userRole: 'viewer',
      isAdmin: false,
      isAuthenticated: true,
    });
    const volunteerStore = createVolunteerAccessStoreMock({ currentSession: null });
    const router = await loadRouter(authStore, volunteerStore);

    await router.push('/players/merge').catch(() => undefined);
    await router.isReady();

    expect(router.currentRoute.value.name).toBe('dashboard');
  }, PLAYER_MERGE_ROUTE_TEST_TIMEOUT_MS);

  it('redirects guests to login for the player merge route', async () => {
    const authStore = createGuestAuthStoreMock();
    const volunteerStore = createVolunteerAccessStoreMock({ currentSession: null });
    const router = await loadRouter(authStore, volunteerStore);

    await router.push('/players/merge').catch(() => undefined);
    await router.isReady();

    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.fullPath).toContain('redirect=/players/merge');
  }, PLAYER_MERGE_ROUTE_TEST_TIMEOUT_MS);
});
