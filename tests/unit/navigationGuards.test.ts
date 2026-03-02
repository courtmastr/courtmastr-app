import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '@/types';
import {
  redirectIfAuthenticated,
  requireAnyRole,
  requireAuth,
  requireRole,
  requireTournamentAccess,
} from '@/guards/navigationGuards';

interface RuntimeAuthStore {
  currentUser: { id: string } | null;
  userRole: UserRole;
  isAuthenticated: boolean;
}

const runtime: RuntimeAuthStore = {
  currentUser: null,
  userRole: 'viewer',
  isAuthenticated: false,
};

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => runtime,
}));

const makeRoute = (overrides: Partial<{ path: string; fullPath: string; params: Record<string, unknown> }> = {}) => ({
  path: overrides.path ?? '/test',
  fullPath: overrides.fullPath ?? '/test',
  params: overrides.params ?? {},
});

describe('navigationGuards', () => {
  beforeEach(() => {
    runtime.currentUser = null;
    runtime.userRole = 'viewer';
    runtime.isAuthenticated = false;
  });

  it('requireRole redirects guests to login', () => {
    const next = vi.fn();
    const guard = requireRole('admin');

    guard(makeRoute() as never, makeRoute() as never, next);

    expect(next).toHaveBeenCalledWith('/login');
  });

  it('requireRole allows organizer for scorekeeper routes', () => {
    runtime.currentUser = { id: 'u1' };
    runtime.userRole = 'organizer';
    runtime.isAuthenticated = true;

    const next = vi.fn();
    const guard = requireRole('scorekeeper');
    guard(makeRoute() as never, makeRoute() as never, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('requireAnyRole denies unauthorized users', () => {
    runtime.currentUser = { id: 'u2' };
    runtime.userRole = 'viewer';
    runtime.isAuthenticated = true;

    const next = vi.fn();
    const guard = requireAnyRole(['organizer', 'scorekeeper']);
    guard(makeRoute() as never, makeRoute() as never, next);

    expect(next).toHaveBeenCalledWith('/unauthorized');
  });

  it('requireTournamentAccess redirects when tournament id is missing', () => {
    runtime.currentUser = { id: 'u3' };
    runtime.userRole = 'organizer';
    runtime.isAuthenticated = true;

    const next = vi.fn();
    const guard = requireTournamentAccess();
    guard(makeRoute({ params: {} }) as never, makeRoute() as never, next);

    expect(next).toHaveBeenCalledWith('/tournaments');
  });

  it('requireAuth sends redirect query for guests', () => {
    const next = vi.fn();
    const guard = requireAuth();

    guard(
      makeRoute({ fullPath: '/tournaments/t1/checkin' }) as never,
      makeRoute() as never,
      next
    );

    expect(next).toHaveBeenCalledWith({
      path: '/login',
      query: { redirect: '/tournaments/t1/checkin' },
    });
  });

  it('redirectIfAuthenticated sends logged-in users to tournaments', () => {
    runtime.currentUser = { id: 'u4' };
    runtime.userRole = 'viewer';
    runtime.isAuthenticated = true;

    const next = vi.fn();
    const guard = redirectIfAuthenticated();
    guard(makeRoute({ path: '/login' }) as never, makeRoute() as never, next);

    expect(next).toHaveBeenCalledWith('/tournaments');
  });
});
