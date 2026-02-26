import { computed } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTournamentStateAdvance } from '@/composables/useTournamentStateAdvance';

const mockStores = vi.hoisted(() => ({
  tournamentStore: {
    currentTournament: null as { state?: string } | null,
    updateTournament: vi.fn(),
  },
  notificationStore: {
    showToast: vi.fn(),
  },
}));

vi.mock('@/stores/tournaments', () => ({
  useTournamentStore: () => mockStores.tournamentStore,
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => mockStores.notificationStore,
}));

describe('useTournamentStateAdvance', () => {
  beforeEach(() => {
    mockStores.tournamentStore.currentTournament = { state: 'REG_OPEN' };
    mockStores.tournamentStore.updateTournament.mockReset().mockResolvedValue(undefined);
    mockStores.notificationStore.showToast.mockReset();
  });

  it('computes next state and supports default first transition when state is missing', () => {
    const tournamentId = computed(() => 't1');
    const { getNextState, nextState } = useTournamentStateAdvance(tournamentId);

    expect(getNextState(undefined)).toBe('REG_OPEN');
    expect(nextState.value).toBe('REG_CLOSED');
  });

  it('advances state and keeps status synchronized', async () => {
    mockStores.tournamentStore.currentTournament = { state: 'BRACKET_GENERATED' };
    const tournamentId = computed(() => 't1');
    const { advanceState } = useTournamentStateAdvance(tournamentId);

    await advanceState();

    expect(mockStores.tournamentStore.updateTournament).toHaveBeenCalledWith('t1', {
      state: 'BRACKET_LOCKED',
      status: 'active',
    });
    expect(mockStores.notificationStore.showToast).toHaveBeenCalledWith(
      'success',
      'Tournament moved to Bracket Locked'
    );
  });

  it('does nothing when no current state exists', async () => {
    mockStores.tournamentStore.currentTournament = {};
    const tournamentId = computed(() => 't1');
    const { advanceState } = useTournamentStateAdvance(tournamentId);

    await advanceState();

    expect(mockStores.tournamentStore.updateTournament).not.toHaveBeenCalled();
    expect(mockStores.notificationStore.showToast).not.toHaveBeenCalled();
  });

  it('shows error toast when advance transition fails', async () => {
    mockStores.tournamentStore.currentTournament = { state: 'REG_OPEN' };
    mockStores.tournamentStore.updateTournament.mockRejectedValueOnce(
      new Error('update failed')
    );
    const tournamentId = computed(() => 't1');
    const { advanceState } = useTournamentStateAdvance(tournamentId);

    await advanceState();

    expect(mockStores.notificationStore.showToast).toHaveBeenCalledWith(
      'error',
      'Failed to advance tournament state'
    );
  });

  it('transitions directly to target state and synchronizes status', async () => {
    const tournamentId = computed(() => 't1');
    const { transitionTo } = useTournamentStateAdvance(tournamentId);

    await transitionTo('LIVE');

    expect(mockStores.tournamentStore.updateTournament).toHaveBeenCalledWith('t1', {
      state: 'LIVE',
      status: 'active',
    });
    expect(mockStores.notificationStore.showToast).toHaveBeenCalledWith(
      'success',
      'Tournament reverted to Live'
    );
  });

  it('shows error toast when direct transition fails', async () => {
    mockStores.tournamentStore.updateTournament.mockRejectedValueOnce(
      new Error('transition failed')
    );
    const tournamentId = computed(() => 't1');
    const { transitionTo } = useTournamentStateAdvance(tournamentId);

    await transitionTo('COMPLETED');

    expect(mockStores.notificationStore.showToast).toHaveBeenCalledWith(
      'error',
      'Failed to update tournament state'
    );
  });
});
