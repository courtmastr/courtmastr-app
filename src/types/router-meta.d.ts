import 'vue-router';
import type { UserRole } from '@/types';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
    requiresAdmin?: boolean;
    requiresScorekeeper?: boolean;
    overlayPage?: boolean;
    obsOverlay?: boolean;
    roles?: readonly UserRole[];
  }
}
