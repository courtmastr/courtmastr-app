/**
 * Navigation guards for protecting routes based on user roles
 */

import type { RouteLocationNormalized, NavigationGuard } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

/**
 * Check if user has required role for route
 */
export function requireRole(requiredRole: string): NavigationGuard {
  return (_to: RouteLocationNormalized, _from: RouteLocationNormalized, next: any) => {
    const authStore = useAuthStore();
    const userRole = authStore.userRole;
    
    // If user doesn't have a role, redirect to login
    if (!userRole) {
      next('/login');
      return;
    }
    
    // Check if user role matches required role
    // In a more complex system, you might have role hierarchies
    // (e.g., admin can access organizer routes)
    if (userRole === 'admin') {
      // Admins can access all routes
      next();
      return;
    }
    
    if (userRole === requiredRole) {
      next();
      return;
    }
    
    // Check for role hierarchy - organizer can access some scorekeeper routes
    if (requiredRole === 'scorekeeper' && userRole === 'organizer') {
      next();
      return;
    }
    
    // Redirect to unauthorized page or home
    next('/unauthorized');
  };
}

/**
 * Check if user has any of the allowed roles for route
 */
export function requireAnyRole(allowedRoles: string[]): NavigationGuard {
  return (_to: RouteLocationNormalized, _from: RouteLocationNormalized, next: any) => {
    const authStore = useAuthStore();
    const userRole = authStore.userRole;
    
    // If user doesn't have a role, redirect to login
    if (!userRole) {
      next('/login');
      return;
    }
    
    // Admins can access all routes
    if (userRole === 'admin') {
      next();
      return;
    }
    
    // Check if user role is in allowed roles
    if (allowedRoles.includes(userRole)) {
      next();
      return;
    }
    
    // Redirect to unauthorized page
    next('/unauthorized');
  };
}

/**
 * Check if user has specific permissions for route
 */
export function requirePermission(_permission: string): NavigationGuard {
  return (_to: RouteLocationNormalized, _from: RouteLocationNormalized, next: any) => {
    const authStore = useAuthStore();
    // Assuming userPermissions might not be in the store yet, using a generic property
    // In a real implementation, you would have specific permission properties
    
    // For now, just checking if user is authenticated
    if (authStore.currentUser) {
      next();
      return;
    }
    
    // If not authenticated, redirect to login
    next('/login');
  };
}

/**
 * Tournament-specific navigation guard
 */
export function requireTournamentAccess(): NavigationGuard {
  return (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: any) => {
    const authStore = useAuthStore();
    const userRole = authStore.userRole;
    const currentUser = authStore.currentUser;
    
    // If user doesn't have a role, redirect to login
    if (!userRole || !currentUser) {
      next('/login');
      return;
    }
    
    // Admins can access all tournaments
    if (userRole === 'admin') {
      next();
      return;
    }
    
    // For tournament-specific routes, verify user has access
    const tournamentId = to.params.tournamentId as string;
    if (!tournamentId) {
      next('/tournaments');
      return;
    }
    
    // In a real implementation, you would check if the user
    // has access to this specific tournament
    // For now, we'll allow access to organizers and scorekeepers
    if (userRole === 'organizer' || userRole === 'scorekeeper') {
      next();
      return;
    }
    
    // Redirect to unauthorized page
    next('/unauthorized');
  };
}

/**
 * Navigation guard that checks if user is authenticated
 */
export function requireAuth(): NavigationGuard {
  return (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: any) => {
    const authStore = useAuthStore();
    const isAuthenticated = authStore.isAuthenticated;
    
    if (isAuthenticated) {
      next();
    } else {
      // Redirect to login and remember where they were trying to go
      next({
        path: '/login',
        query: { redirect: to.fullPath }
      });
    }
  };
}

/**
 * Navigation guard that redirects authenticated users away from login/register pages
 */
export function redirectIfAuthenticated(): NavigationGuard {
  return (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: any) => {
    const authStore = useAuthStore();
    const isAuthenticated = authStore.isAuthenticated;
    
    if (isAuthenticated && ['/login', '/register'].includes(to.path)) {
      // Redirect to dashboard if user is already logged in
      next('/tournaments');
    } else {
      next();
    }
  };
}