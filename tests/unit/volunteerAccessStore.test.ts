import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const mockDeps = vi.hoisted(() => ({
  callableFactory: vi.fn(),
  callableInvoke: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  functions: { __mock: true },
  httpsCallable: mockDeps.callableFactory,
}));

describe('volunteer access store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    mockDeps.callableFactory.mockReset();
    mockDeps.callableInvoke.mockReset();
    mockDeps.callableFactory.mockReturnValue(mockDeps.callableInvoke);
  });

  it('persists a volunteer session for the matching tournament and role', async () => {
    mockDeps.callableInvoke.mockResolvedValue({
      data: {
        tournamentId: 't1',
        role: 'checkin',
        sessionToken: 'signed-token',
        pinRevision: 2,
        expiresAtMs: Date.now() + 60_000,
      },
    });

    const { useVolunteerAccessStore } = await import('@/stores/volunteerAccess');
    const store = useVolunteerAccessStore();

    await store.requestSession({
      tournamentId: 't1',
      role: 'checkin',
      pin: '4829',
    });

    expect(store.hasValidSession('t1', 'checkin')).toBe(true);
    expect(localStorage.getItem('courtmaster_volunteer_session')).toContain('"role":"checkin"');
  });
});
