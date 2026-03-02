/**
 * Navigation guards for protecting routes based on user roles
 */

import type {
  RouteLocationNormalized,
  NavigationGuard,
  NavigationGuardNext,
} from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import type { UserRole } from '@/types';

const isLoggedIn = (): boolean => {
  const authStore = useAuthStore();
  return Boolean(authStore.currentUser);
};

const canAccessRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
  if (userRole === 'admin') return true;
  if (userRole === requiredRole) return true;
  if (requiredRole === 'scorekeeper' && userRole === 'organizer') return true;
  return false;
};

/**
 * Check if user has required role for route
 */
export function requireRole(requiredRole: UserRole): NavigationGuard {
  return (
    _to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext
  ): void => {
    const authStore = useAuthStore();
    const userRole = authStore.userRole;

    if (!isLoggedIn()) {
      next('/login');
      return;
    }

    if (canAccessRole(userRole, requiredRole)) {
      next();
      return;
    }

    next('/unauthorized');
  };
}

/**
 * Check if user has any of the allowed roles for route
 */
export function requireAnyRole(allowedRoles: UserRole[]): NavigationGuard {
  return (
    _to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext
  ): void => {
    const authStore = useAuthStore();
    const userRole = authStore.userRole;

    if (!isLoggedIn()) {
      next('/login');
      return;
    }

    if (userRole === 'admin') {
      next();
      return;
    }

    if (allowedRoles.includes(userRole)) {
      next();
      return;
    }

    next('/unauthorized');
  };
}

/**
 * Check if user has specific permissions for route
 */
export function requirePermission(_permission: string): NavigationGuard {
  return (
    _to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext
  ): void => {
    const authStore = useAuthStore();

    if (authStore.currentUser) {
      next();
      return;
    }

    next('/login');
  };
}

/**
 * Tournament-specific navigation guard
 */
export function requireTournamentAccess(): NavigationGuard {
  return (
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext
  ): void => {
    const authStore = useAuthStore();
    const userRole = authStore.userRole;
    const currentUser = authStore.currentUser;

    if (!userRole || !currentUser) {
      next('/login');
      return;
    }

    if (userRole === 'admin') {
      next();
      return;
    }

    const tournamentId = to.params.tournamentId as string;
    if (!tournamentId) {
      next('/tournaments');
      return;
    }

    if (userRole === 'organizer' || userRole === 'scorekeeper') {
      next();
      return;
    }

    next('/unauthorized');
  };
}

/**
 * Navigation guard that checks if user is authenticated
 */
export function requireAuth(): NavigationGuard {
  return (
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext
  ): void => {
    const authStore = useAuthStore();
    const isAuthenticated = authStore.isAuthenticated;

    if (isAuthenticated) {
      next();
    } else {
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      });
    }
  };
}

/**
 * Navigation guard that redirects authenticated users away from login/register pages
 */
export function redirectIfAuthenticated(): NavigationGuard {
  return (
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
    next: NavigationGuardNext
  ): void => {
    const authStore = useAuthStore();
    const isAuthenticated = authStore.isAuthenticated;

    if (isAuthenticated && ['/login', '/register'].includes(to.path)) {
      next('/tournaments');
    } else {
      next();
    }
  };
}
