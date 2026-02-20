import { computed, type ComputedRef } from 'vue';
import { useTournamentStore } from '@/stores/tournaments';
import { useRegistrationStore } from '@/stores/registrations';
import { useMatchStore } from '@/stores/matches';

export interface ReadinessItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  route: string;
  icon: string;
  optional?: boolean;
}

export interface TournamentReadiness {
  items: ReadinessItem[];
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  isReady: boolean;
}

export function useTournamentReadiness(tournamentId: ComputedRef<string>) {
  const tournamentStore = useTournamentStore();
  const registrationStore = useRegistrationStore();
  const matchStore = useMatchStore();

  const readiness = computed<TournamentReadiness>(() => {
    const tournament = tournamentStore.currentTournament;
    const courts = tournamentStore.courts;
    const categories = tournamentStore.categories;
    const registrations = registrationStore.registrations;
    const matches = matchStore.matches;

    // 1. Courts configured
    const courtsConfigured = courts.length > 0;

    // 2. Registrations approved (at least 2 per category for matches)
    const approvedRegistrations = registrations.filter(r => r.status === 'approved' || r.status === 'checked_in');
    const registrationsApproved = approvedRegistrations.length >= 2;

    // 3. Seeds done (check if any category requires seeding and has seeds set)
    const requiresSeeding = categories.some(c => c.seedingEnabled);
    const seededCategories = categories.filter(c => {
      if (!c.seedingEnabled) return true;
      // Check if category has seeded registrations
      const categoryRegs = registrations.filter(r => r.categoryId === c.id && (r.status === 'approved' || r.status === 'checked_in'));
      const hasSeeds = categoryRegs.some(r => r.seed !== undefined && r.seed !== null);
      return hasSeeds;
    });
    const seedsDone = !requiresSeeding || seededCategories.length === categories.length;

    // 4. Bracket generated
    const bracketGenerated = matches.length > 0;

    // 5. Bracket locked (tournament is active or completed means bracket was locked)
    const bracketLocked = tournament?.status === 'active' || tournament?.status === 'completed';

    // 6. Check-in started (at least one person checked in)
    const checkedInCount = registrations.filter(r => r.status === 'checked_in').length;
    const checkInStarted = checkedInCount > 0;

    // 7. Matches started (at least one match in progress or completed)
    const matchesStarted = matches.some(m => m.status === 'in_progress' || m.status === 'completed');

    const items: ReadinessItem[] = [
      {
        id: 'courts',
        label: 'Courts Configured',
        description: courts.length > 0 ? `${courts.length} courts ready` : 'Add courts to start scheduling',
        completed: courtsConfigured,
        route: `/tournaments/${tournamentId.value}/settings`,
        icon: 'mdi-stadium',
      },
      {
        id: 'registrations',
        label: 'Registrations Approved',
        description: approvedRegistrations.length > 0 
          ? `${approvedRegistrations.length} approved registrations` 
          : 'Approve registrations to build bracket',
        completed: registrationsApproved,
        route: `/tournaments/${tournamentId.value}/registrations`,
        icon: 'mdi-account-check',
      },
      {
        id: 'seeds',
        label: 'Seeds Assigned',
        description: seedsDone 
          ? 'All categories seeded' 
          : 'Assign seeds for competitive balance',
        completed: seedsDone,
        route: `/tournaments/${tournamentId.value}/registrations`,
        icon: 'mdi-seed',
        optional: !requiresSeeding,
      },
      {
        id: 'bracket',
        label: 'Bracket Generated',
        description: bracketGenerated 
          ? `${matches.length} matches created` 
          : 'Generate bracket from approved registrations',
        completed: bracketGenerated,
        route: `/tournaments/${tournamentId.value}/brackets`,
        icon: 'mdi-tournament',
      },
      {
        id: 'locked',
        label: 'Bracket Locked',
        description: bracketLocked 
          ? 'Bracket finalized - ready to start' 
          : 'Lock bracket to prevent changes',
        completed: bracketLocked,
        route: `/tournaments/${tournamentId.value}/brackets`,
        icon: 'mdi-lock',
      },
      {
        id: 'checkin',
        label: 'Check-in Started',
        description: checkInStarted 
          ? `${checkedInCount} players checked in` 
          : 'Start check-in before matches',
        completed: checkInStarted,
        route: `/tournaments/${tournamentId.value}/check-in`,
        icon: 'mdi-clipboard-check',
      },
      {
        id: 'matches',
        label: 'Matches Started',
        description: matchesStarted 
          ? 'Tournament in progress' 
          : 'Start first match when ready',
        completed: matchesStarted,
        route: `/tournaments/${tournamentId.value}/match-control`,
        icon: 'mdi-play-circle',
      },
    ];

    const completedCount = items.filter(i => i.completed).length;
    const totalCount = items.filter(i => !i.optional).length;
    const progressPercent = Math.round((completedCount / items.length) * 100);
    const isReady = completedCount >= 5; // Ready when 5/7 items complete

    return {
      items,
      completedCount,
      totalCount,
      progressPercent,
      isReady,
    };
  });

  return {
    readiness,
  };
}
