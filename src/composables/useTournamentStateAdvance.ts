import { computed, type ComputedRef } from 'vue';
import { useTournamentStore } from '@/stores/tournaments';
import { useNotificationStore } from '@/stores/notifications';
import {
    getNextTournamentState,
    getTournamentStateLabel,
    tournamentStateToStatus,
} from '@/guards/tournamentState';
import type { TournamentLifecycleState } from '@/types';

/**
 * Reusable composable for advancing / reverting tournament lifecycle state.
 * Keeps both `state` (lifecycle) and `status` (simple) in sync atomically.
 *
 * Usage:
 *   const { advanceState, revertToLive, getNextState } = useTournamentStateAdvance(tournamentId);
 */
export const useTournamentStateAdvance = (tournamentId: ComputedRef<string>) => {
    const tournamentStore = useTournamentStore();
    const notificationStore = useNotificationStore();

    const tournament = computed(() => tournamentStore.currentTournament);

    const getNextState = (currentState: TournamentLifecycleState | undefined): TournamentLifecycleState | null => {
        if (!currentState) return 'REG_OPEN';
        return getNextTournamentState(currentState);
    };

    /**
     * Advance to the next state in the lifecycle flow.
     * Updates BOTH `state` and `status` atomically.
     * Returns the next state if caller needs it (e.g., for confirmation dialogs).
     */
    const advanceState = async (): Promise<void> => {
        if (!tournament.value?.state) return;
        const nextState = getNextTournamentState(tournament.value.state);
        if (!nextState) return;

        try {
            await tournamentStore.updateTournament(tournamentId.value, {
                state: nextState,
                status: tournamentStateToStatus(nextState),
            });
            notificationStore.showToast('success', `Tournament moved to ${getTournamentStateLabel(nextState)}`);
        } catch (error) {
            notificationStore.showToast('error', 'Failed to advance tournament state');
        }
    };

    /**
     * Transition to a specific state (e.g., revert COMPLETED → LIVE).
     * Updates BOTH `state` and `status` atomically.
     */
    const transitionTo = async (targetState: TournamentLifecycleState): Promise<void> => {
        try {
            await tournamentStore.updateTournament(tournamentId.value, {
                state: targetState,
                status: tournamentStateToStatus(targetState),
            });
            notificationStore.showToast('success', `Tournament reverted to ${getTournamentStateLabel(targetState)}`);
        } catch (error) {
            notificationStore.showToast('error', 'Failed to update tournament state');
        }
    };

    /**
     * Check what the next state would be without advancing.
     */
    const nextState = computed(() =>
        tournament.value?.state ? getNextTournamentState(tournament.value.state) : null
    );

    return {
        advanceState,
        transitionTo,
        getNextState,
        nextState,
    };
};
