import { describe, expect, it } from 'vitest';
import router from '@/router';

describe('self check-in route', () => {
  it('registers public self-checkin route', () => {
    const route = router.getRoutes().find((item) => item.name === 'self-check-in');
    expect(route?.path).toBe('/tournaments/:tournamentId/self-checkin');
    expect(route?.meta.requiresAuth).toBe(false);
  });
});
