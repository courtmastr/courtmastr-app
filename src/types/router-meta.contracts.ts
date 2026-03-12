import type { RouteLocationNormalized } from 'vue-router';
import type { UserRole, VolunteerRole } from '@/types';

const readMeta = (route: RouteLocationNormalized): void => {
  const requiresAuth: boolean | undefined = route.meta.requiresAuth;
  const guestOnly: boolean | undefined = route.meta.guestOnly;
  const requiresAdmin: boolean | undefined = route.meta.requiresAdmin;
  const requiresScorekeeper: boolean | undefined = route.meta.requiresScorekeeper;
  const requiresVolunteerSession: boolean | undefined = route.meta.requiresVolunteerSession;
  const volunteerAccessPage: boolean | undefined = route.meta.volunteerAccessPage;
  const volunteerLayout: boolean | undefined = route.meta.volunteerLayout;
  const volunteerRole: VolunteerRole | undefined = route.meta.volunteerRole;
  const overlayPage: boolean | undefined = route.meta.overlayPage;
  const obsOverlay: boolean | undefined = route.meta.obsOverlay;
  const roles: readonly UserRole[] | undefined = route.meta.roles;

  void requiresAuth;
  void guestOnly;
  void requiresAdmin;
  void requiresScorekeeper;
  void requiresVolunteerSession;
  void volunteerAccessPage;
  void volunteerLayout;
  void volunteerRole;
  void overlayPage;
  void obsOverlay;
  void roles;
};

void readMeta;
