import 'vue-router';
import type { UserRole, VolunteerRole } from '@/types';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
    requiresAdmin?: boolean;
    requiresWebAdmin?: boolean;
    requiresScorekeeper?: boolean;
    requiresVolunteerSession?: boolean;
    volunteerAccessPage?: boolean;
    volunteerLayout?: boolean;
    volunteerRole?: VolunteerRole;
    overlayPage?: boolean;
    obsOverlay?: boolean;
    roles?: readonly UserRole[];
  }
}
