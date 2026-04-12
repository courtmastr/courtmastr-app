import { computed, ref } from 'vue';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { logger } from '@/utils/logger';

export interface FeaturedTournamentMetrics {
  tournamentName: string;
  registered: number;
  completedMatches: number;
  checkInRate: number;
}

const ATTENDANCE_STATUSES = new Set(['approved', 'checked_in', 'no_show']);
const COMPLETED_MATCH_STATUSES = new Set(['completed', 'walkover']);

export const useFeaturedTournamentMetrics = () => {
  const tournamentStore = useTournamentStore();
  const matchStore = useMatchStore();
  const registrationStore = useRegistrationStore();

  const featuredTournamentId = computed(() =>
    String(import.meta.env.VITE_MARKETING_FEATURED_TOURNAMENT_ID || '').trim()
  );
  const hasFeaturedTournament = computed(() => featuredTournamentId.value.length > 0);
  const loading = ref(false);
  const errorMessage = ref('');
  const metrics = ref<FeaturedTournamentMetrics | null>(null);

  const loadMetrics = async (): Promise<void> => {
    if (!hasFeaturedTournament.value) {
      errorMessage.value = 'Featured event metrics are not configured yet.';
      metrics.value = null;
      return;
    }

    loading.value = true;
    errorMessage.value = '';

    try {
      await Promise.all([
        tournamentStore.fetchTournament(featuredTournamentId.value),
        matchStore.fetchMatches(featuredTournamentId.value),
        registrationStore.fetchRegistrations(featuredTournamentId.value),
      ]);

      const completedMatches = matchStore.matches.filter((match) =>
        COMPLETED_MATCH_STATUSES.has(match.status)
      ).length;
      const registered = registrationStore.registrations.length;
      const checkedInCount = registrationStore.registrations.filter(
        (registration) => registration.status === 'checked_in'
      ).length;
      const attendanceEligible = registrationStore.registrations.filter((registration) =>
        ATTENDANCE_STATUSES.has(registration.status)
      ).length;

      metrics.value = {
        tournamentName: tournamentStore.currentTournament?.name?.trim() || 'Featured Tournament',
        registered,
        completedMatches,
        checkInRate: attendanceEligible > 0
          ? Math.round((checkedInCount / attendanceEligible) * 100)
          : 0,
      };
    } catch (error) {
      metrics.value = null;
      errorMessage.value = 'Live featured tournament metrics are temporarily unavailable.';
      logger.error('Error loading featured tournament metrics:', {
        featuredTournamentId: featuredTournamentId.value,
        error,
      });
    } finally {
      loading.value = false;
    }
  };

  return {
    featuredTournamentId,
    hasFeaturedTournament,
    loading,
    errorMessage,
    metrics,
    loadMetrics,
  };
};
