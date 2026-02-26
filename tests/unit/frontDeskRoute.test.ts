import { describe, expect, it } from 'vitest';
import router from '@/router';

describe('front desk check-in route', () => {
  it('registers tournament-checkin route at expected path', () => {
    const route = router.getRoutes().find((item) => item.name === 'tournament-checkin');
    expect(route?.path).toBe('/tournaments/:tournamentId/checkin');
  });

  it('loads FrontDeskCheckInView for tournament-checkin route', () => {
    const route = router.getRoutes().find((item) => item.name === 'tournament-checkin');
    const routeComponent = route?.components?.default;
    expect(routeComponent).toBeTypeOf('function');
    expect(String(routeComponent)).toContain('FrontDeskCheckInView.vue');
  });

  it('requires authenticated admin access', () => {
    const route = router.getRoutes().find((item) => item.name === 'tournament-checkin');
    expect(route?.meta.requiresAuth).toBe(true);
    expect(route?.meta.requiresAdmin).toBe(true);
  });
});
