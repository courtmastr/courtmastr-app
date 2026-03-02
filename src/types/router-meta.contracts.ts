import type { RouteLocationNormalized } from 'vue-router';
import type { UserRole } from '@/types';

const readMeta = (route: RouteLocationNormalized): void => {
  const requiresAuth: boolean | undefined = route.meta.requiresAuth;
  const guestOnly: boolean | undefined = route.meta.guestOnly;
  const requiresAdmin: boolean | undefined = route.meta.requiresAdmin;
  const requiresScorekeeper: boolean | undefined = route.meta.requiresScorekeeper;
  const overlayPage: boolean | undefined = route.meta.overlayPage;
  const obsOverlay: boolean | undefined = route.meta.obsOverlay;
  const roles: readonly UserRole[] | undefined = route.meta.roles;

  void requiresAuth;
  void guestOnly;
  void requiresAdmin;
  void requiresScorekeeper;
  void overlayPage;
  void obsOverlay;
  void roles;
};

void readMeta;
