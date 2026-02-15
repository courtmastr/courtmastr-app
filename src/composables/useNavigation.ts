import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTournamentStore } from '@/stores/tournaments';

/**
 * Composable for navigation utilities
 */
export function useNavigation() {
  const authStore = useAuthStore();
  const tournamentStore = useTournamentStore();
  const route = useRoute();
  const currentTournamentId = computed(() =>
    (route.params.tournamentId as string | undefined) || tournamentStore.currentTournament?.id || ''
  );

  // Check user roles
  const isAdmin = computed(() => authStore.userRole === 'admin');
  const isOrganizer = computed(() => authStore.userRole === 'organizer');
  const isScorekeeper = computed(() => authStore.userRole === 'scorekeeper');
  const isPlayer = computed(() => authStore.userRole === 'player');

  // Navigation items based on role
  const navigationItems = computed(() => {
    const items = [];

    // Common items for all users
    items.push({
      title: 'Tournaments',
      icon: 'mdi-tournament',
      to: '/tournaments',
      allowed: true,
    });

    // Admin-only items
    if (isAdmin.value) {
      items.push({
        title: 'Create Tournament',
        icon: 'mdi-plus-circle',
        to: '/tournaments/create',
        allowed: true,
      });
    }

    // Organizer items
    if (isAdmin.value || isOrganizer.value) {
      items.push({
        title: 'Tournament Management',
        icon: 'mdi-view-dashboard',
        to: '/tournaments',
        allowed: true,
      });
    }

    // Scorekeeper items for the current tournament
    if ((isAdmin.value || isOrganizer.value || isScorekeeper.value) && currentTournamentId.value) {
      items.push({
        title: 'Score Matches',
        icon: 'mdi-scoreboard',
        to: `/tournaments/${currentTournamentId.value}/matches`,
        allowed: true,
      });
    }

    // Player-specific items
    if (isPlayer.value && currentTournamentId.value) {
      items.push({
        title: 'Register',
        icon: 'mdi-account-card-details',
        to: `/tournaments/${currentTournamentId.value}/register`,
        allowed: true,
      });
    }

    // Filter items based on permissions
    return items.filter(item => item.allowed);
  });

  // Tournament-specific navigation items
  const tournamentNavigationItems = computed(() => {
    const items = [];
    const tournamentId = currentTournamentId.value;

    if (tournamentId) {
      items.push(
        {
          title: 'Dashboard',
          icon: 'mdi-view-dashboard',
          to: `/tournaments/${tournamentId}`,
          allowed: true,
        },
        {
          title: 'Brackets',
          icon: 'mdi-brackets',
          to: `/tournaments/${tournamentId}/brackets`,
          allowed: true,
        },
        {
          title: 'Match Control',
          icon: 'mdi-controller',
          to: `/tournaments/${tournamentId}/match-control`,
          allowed: isAdmin.value || isOrganizer.value,
        },
        {
          title: 'Registrations',
          icon: 'mdi-account-multiple',
          to: `/tournaments/${tournamentId}/registrations`,
          allowed: isAdmin.value || isOrganizer.value,
        }
      );
    }

    return items.filter(item => item.allowed);
  });

  // Check if user has access to a specific route
  const hasAccess = (route: string): boolean => {
    // This is a simplified check - in a real implementation you'd have more granular permissions
    if (route.includes('/admin')) {
      return isAdmin.value;
    }
    
    if (route.includes('/match-control') || route.includes('/courts')) {
      return isAdmin.value || isOrganizer.value;
    }
    
    if (route.includes('/matches')) {
      return isAdmin.value || isOrganizer.value || isScorekeeper.value;
    }
    
    return true; // Default to allow access
  };

  // Get navigation groups based on context
  const getNavigationGroups = () => {
    return [
      {
        title: 'Tournament Management',
        icon: 'mdi-tournament',
        items: navigationItems.value.filter(item => 
          item.title.includes('Tournament') || 
          item.title.includes('Create') ||
          item.title.includes('Settings')
        ),
      },
      {
        title: 'Live Operations',
        icon: 'mdi-monitor',
        items: navigationItems.value.filter(item => 
          item.title.includes('Scoring') || 
          item.title.includes('Control')
        ),
      },
      {
        title: 'Registration',
        icon: 'mdi-account-multiple',
        items: navigationItems.value.filter(item => 
          item.title.includes('Registration') || 
          item.title.includes('My')
        ),
      },
    ];
  };

  return {
    isAdmin,
    isOrganizer,
    isScorekeeper,
    isPlayer,
    navigationItems,
    tournamentNavigationItems,
    hasAccess,
    getNavigationGroups,
  };
}
