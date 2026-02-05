import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useTournamentStore } from '@/stores/tournaments';

/**
 * Composable for navigation utilities
 */
export function useNavigation() {
  const authStore = useAuthStore();
  const tournamentStore = useTournamentStore();

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
      
      items.push({
        title: 'System Settings',
        icon: 'mdi-cog',
        to: '/admin/settings',
        allowed: true,
      });
    }

    // Organizer items
    if (isAdmin.value || isOrganizer.value) {
      items.push({
        title: 'Tournament Management',
        icon: 'mdi-view-dashboard',
        to: '/tournaments/manage',
        allowed: true,
      });
    }

    // Scorekeeper items
    if (isAdmin.value || isOrganizer.value || isScorekeeper.value) {
      items.push({
        title: 'Scoring Dashboard',
        icon: 'mdi-scoreboard',
        to: '/scoring',
        allowed: true,
      });
    }

    // Player-specific items
    if (isPlayer.value) {
      items.push({
        title: 'My Registrations',
        icon: 'mdi-account-card-details',
        to: '/my-registrations',
        allowed: true,
      });
    }

    // Filter items based on permissions
    return items.filter(item => item.allowed);
  });

  // Tournament-specific navigation items
  const tournamentNavigationItems = computed(() => {
    const items = [];
    const tournamentId = tournamentStore.currentTournament?.id;

    if (tournamentId) {
      items.push(
        {
          title: 'Dashboard',
          icon: 'mdi-view-dashboard',
          to: `/tournaments/${tournamentId}/dashboard`,
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
          title: 'Courts',
          icon: 'mdi-stadium',
          to: `/tournaments/${tournamentId}/courts`,
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
    
    if (route.includes('/scoring')) {
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