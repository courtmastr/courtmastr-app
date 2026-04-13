// Vue Router Configuration
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useVolunteerAccessStore } from '@/stores/volunteerAccess';
import type { VolunteerRole } from '@/types';

// Lazy-loaded views
const Home = () => import('@/features/public/views/HomeView.vue');
const Login = () => import('@/features/auth/views/LoginView.vue');
const Register = () => import('@/features/auth/views/RegisterView.vue');
const VolunteerAccess = () => import('@/features/volunteer/views/VolunteerAccessView.vue');

// Tournament views
const TournamentList = () => import('@/features/tournaments/views/TournamentListView.vue');
const TournamentCreate = () => import('@/features/tournaments/views/TournamentCreateView.vue');
const TournamentDashboard = () => import('@/features/tournaments/views/TournamentDashboardView.vue');
const TournamentSettings = () => import('@/features/tournaments/views/TournamentSettingsView.vue');

// Registration views
const RegistrationManagement = () => import('@/features/registration/views/RegistrationManagementView.vue');
const SelfRegistration = () => import('@/features/registration/views/SelfRegistrationView.vue');
const Participants = () => import('@/features/registration/views/ParticipantsView.vue');

// Leaderboard view
const Leaderboard = () => import('@/features/tournaments/views/LeaderboardView.vue');

// Admin views
const AuditLogView = () => import('@/features/admin/views/AuditLogView.vue');
const AdminReviewsView = () => import('@/features/reviews/views/AdminReviewsView.vue');
const OrgProfile = () => import('@/features/org/views/OrgProfileView.vue');

// Super admin views
const SuperDashboard = () => import('@/features/super/views/SuperDashboardView.vue');
const SuperOrgList = () => import('@/features/super/views/SuperOrgListView.vue');

// Dashboard
const OrgDashboard = () => import('@/features/dashboard/views/OrgDashboardView.vue');

// Player views
const PlayersListView = () => import('@/features/players/views/PlayersListView.vue');
const PlayerProfileView = () => import('@/features/players/views/PlayerProfileView.vue');
const PlayerMergeView = () => import('@/features/players/views/PlayerMergeView.vue');

// Scoring views
const ScoringInterface = () => import('@/features/scoring/views/ScoringInterfaceView.vue');
const CourtScorerView = () => import('@/features/scoring/views/CourtScorerView.vue');
const MatchList = () => import('@/features/scoring/views/MatchListView.vue');
const MatchControl = () => import('@/features/tournaments/views/MatchControlView.vue');

// Public views
const PublicBracket = () => import('@/features/public/views/PublicBracketView.vue');
const PublicScoring = () => import('@/features/public/views/PublicScoringView.vue');
const PublicSchedule = () => import('@/features/public/views/PublicScheduleView.vue');
const PublicPlayer = () => import('@/features/public/views/PublicPlayerView.vue');
const TournamentLandingTemplate = () => import('@/features/public/views/TournamentLandingTemplateView.vue');
const HallOfChampions = () => import('@/features/public/views/HallOfChampionsView.vue');
const About = () => import('@/features/public/views/AboutView.vue');
const Pricing = () => import('@/features/public/views/PricingView.vue');
const Privacy = () => import('@/features/public/views/PrivacyView.vue');
const Terms = () => import('@/features/public/views/TermsView.vue');
const HelpCenter = () => import('@/features/help/views/HelpCenterView.vue');
const HelpTopic = () => import('@/features/help/views/HelpTopicView.vue');
const OrgPublicHome = () => import('@/features/public/views/OrgPublicHomeView.vue');
const PlayerSearchView = () => import('@/features/public/views/PlayerSearchView.vue');

// Overlay views
const OverlayCourtView = () => import('@/features/overlay/views/OverlayCourtView.vue');
const OverlayTickerView = () => import('@/features/overlay/views/OverlayTickerView.vue');
const OverlayBoardView = () => import('@/features/overlay/views/OverlayBoardView.vue');
const OverlayLinksView = () => import('@/features/overlay/views/OverlayLinksView.vue');

const getVolunteerAccessRouteName = (role: VolunteerRole): string => (
  role === 'scorekeeper' ? 'volunteer-scoring-access' : 'volunteer-checkin-access'
);

const getVolunteerKioskRouteName = (role: VolunteerRole): string => (
  role === 'scorekeeper' ? 'volunteer-scoring-kiosk' : 'volunteer-checkin-kiosk'
);

const routes: RouteRecordRaw[] = [
  // Public routes
  {
    path: '/',
    name: 'home',
    component: Home,
    meta: { requiresAuth: false, publicMarketingPage: true },
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: { requiresAuth: false, guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: Register,
    meta: { requiresAuth: false, guestOnly: true },
  },
  {
    path: '/about',
    name: 'about',
    component: About,
    meta: { requiresAuth: false, publicMarketingPage: true },
  },
  {
    path: '/pricing',
    name: 'pricing',
    component: Pricing,
    meta: { requiresAuth: false, publicMarketingPage: true },
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: Privacy,
    meta: { requiresAuth: false, publicMarketingPage: true },
  },
  {
    path: '/terms',
    name: 'terms',
    component: Terms,
    meta: { requiresAuth: false, publicMarketingPage: true },
  },
  {
    path: '/help',
    name: 'help-center',
    component: HelpCenter,
    meta: { requiresAuth: false, publicMarketingPage: true },
  },
  {
    path: '/help/:topicSlug',
    name: 'help-topic',
    component: HelpTopic,
    meta: { requiresAuth: false, publicMarketingPage: true },
  },
  {
    path: '/tournaments/:tournamentId/checkin-access',
    name: 'volunteer-checkin-access',
    component: VolunteerAccess,
    meta: {
      requiresAuth: false,
      volunteerAccessPage: true,
      volunteerLayout: true,
      volunteerRole: 'checkin',
    },
  },
  {
    path: '/tournaments/:tournamentId/scoring-access',
    name: 'volunteer-scoring-access',
    component: VolunteerAccess,
    meta: {
      requiresAuth: false,
      volunteerAccessPage: true,
      volunteerLayout: true,
      volunteerRole: 'scorekeeper',
    },
  },
  {
    path: '/tournaments/:tournamentId/checkin-kiosk',
    name: 'volunteer-checkin-kiosk',
    component: () => import('@/features/checkin/views/FrontDeskCheckInView.vue'),
    meta: {
      requiresAuth: false,
      requiresVolunteerSession: true,
      volunteerLayout: true,
      volunteerRole: 'checkin',
    },
  },
  {
    path: '/tournaments/:tournamentId/scoring-kiosk',
    name: 'volunteer-scoring-kiosk',
    component: MatchList,
    meta: {
      requiresAuth: false,
      requiresVolunteerSession: true,
      volunteerLayout: true,
      volunteerRole: 'scorekeeper',
    },
  },
  {
    path: '/tournaments/:tournamentId/scoring-kiosk/matches/:matchId/score',
    name: 'volunteer-scoring-match',
    component: ScoringInterface,
    meta: {
      requiresAuth: false,
      requiresVolunteerSession: true,
      volunteerLayout: true,
      volunteerRole: 'scorekeeper',
    },
  },
  {
    path: '/tournaments/:tournamentId/scoring-kiosk/court/:courtId/:matchId?',
    name: 'volunteer-court-scorer',
    component: CourtScorerView,
    meta: {
      requiresAuth: false,
      requiresVolunteerSession: true,
      volunteerLayout: true,
      volunteerRole: 'scorekeeper',
    },
  },

  // Public tournament views
  {
    path: '/tournaments/:tournamentId/bracket',
    name: 'public-bracket',
    component: PublicBracket,
    meta: { requiresAuth: false },
  },
  {
    path: '/tournaments/:tournamentId/live',
    name: 'public-live-scores',
    redirect: to => ({
      path: `/tournaments/${to.params.tournamentId}/schedule`,
      query: {
        ...to.query,
        view: 'display',
      },
    }),
    meta: { requiresAuth: false },
  },
  {
    path: '/tournaments/:tournamentId/score',
    name: 'public-scoring',
    component: PublicScoring,
    meta: { requiresAuth: false },
  },
  {
    path: '/tournaments/:tournamentId/register',
    name: 'self-registration',
    component: SelfRegistration,
    meta: { requiresAuth: false },
  },
  {
    path: '/tournaments/:tournamentId/self-checkin',
    name: 'self-check-in',
    component: () => import('@/features/checkin/views/SelfCheckInView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/tournaments/:tournamentId/schedule',
    name: 'public-schedule',
    component: PublicSchedule,
    meta: { requiresAuth: false },
  },
  {
    path: '/tournaments/:tournamentId/player',
    name: 'public-player',
    component: PublicPlayer,
    meta: { requiresAuth: false },
  },
  {
    path: '/tournaments/:tournamentId/landing',
    name: 'public-landing-template',
    component: TournamentLandingTemplate,
    meta: { requiresAuth: false },
  },
  {
    path: '/tournaments/:tournamentId/champions',
    name: 'public-hall-of-champions',
    component: HallOfChampions,
    meta: { requiresAuth: false },
  },

  // Authenticated routes
  {
    path: '/dashboard',
    name: 'dashboard',
    component: OrgDashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/tournaments',
    name: 'tournament-list',
    component: TournamentList,
    meta: { requiresAuth: true },
  },
  {
    path: '/tournaments/create',
    name: 'tournament-create',
    component: TournamentCreate,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/tournaments/archived',
    redirect: '/tournaments',
  },
  {
    path: '/tournaments/:tournamentId',
    name: 'tournament-dashboard',
    component: TournamentDashboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/tournaments/:tournamentId/settings',
    name: 'tournament-settings',
    component: TournamentSettings,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/tournaments/:tournamentId/registrations',
    name: 'registration-management',
    component: RegistrationManagement,
    meta: { requiresAuth: true, requiresAdmin: true },
  },

  // Participants (canonical route - active roster view)
  {
    path: '/tournaments/:tournamentId/participants',
    name: 'participants',
    component: Participants,
    meta: { requiresAuth: true, requiresAdmin: true },
  },

  // Courts — standalone page
  {
    path: '/tournaments/:tournamentId/courts',
    name: 'tournament-courts',
    component: () => import('@/features/tournaments/views/CourtsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },

  // Match control (for organizers)
  {
    path: '/tournaments/:tournamentId/match-control',
    name: 'match-control',
    component: MatchControl,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/tournaments/:tournamentId/checkin',
    name: 'tournament-checkin',
    component: () => import('@/features/checkin/views/FrontDeskCheckInView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/tournaments/:tournamentId/live-view',
    name: 'match-live-view',
    component: () => import('@/features/tournaments/views/LiveScoringView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/tournaments/:tournamentId/scoring',
    redirect: to => `/tournaments/${to.params.tournamentId}/matches`,
  },

  // Categories — standalone page
  {
    path: '/tournaments/:tournamentId/categories',
    name: 'tournament-categories',
    component: () => import('@/features/tournaments/views/CategoriesView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },

  // Brackets — standalone page with category/level selector
  {
    path: '/tournaments/:tournamentId/brackets',
    name: 'tournament-brackets',
    component: () => import('@/features/tournaments/views/BracketsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/tournaments/:tournamentId/categories/:categoryId/smart-bracket',
    name: 'smart-bracket-view',
    component: () => import('@/features/brackets/components/SmartBracketView.vue'),
    props: (route) => ({
      tournamentId: route.params.tournamentId as string,
      categoryId: route.params.categoryId as string,
    }),
    meta: { requiresAuth: true },
  },

  {
    path: '/tournaments/:tournamentId/results',
    redirect: to => `/tournaments/${to.params.tournamentId}/leaderboard`,
  },

  // Scoring routes (for scorekeepers)
  {
    path: '/tournaments/:tournamentId/matches',
    name: 'match-list',
    component: MatchList,
    meta: { requiresAuth: true, requiresScorekeeper: true },
  },
  {
    path: '/tournaments/:tournamentId/matches/:matchId/score',
    name: 'scoring-interface',
    component: ScoringInterface,
    meta: { requiresAuth: true, requiresScorekeeper: true },
  },

  // Audit log route (admin only)
  {
    path: '/tournaments/:tournamentId/audit',
    name: 'tournament-audit',
    component: AuditLogView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/admin/reviews',
    name: 'admin-reviews',
    component: AdminReviewsView,
    meta: { requiresAuth: true, requiresWebAdmin: true },
  },

  // Super admin routes
  {
    path: '/super/dashboard',
    name: 'super-dashboard',
    component: SuperDashboard,
    meta: { requiresAuth: true, requiresWebAdmin: true },
  },
  {
    path: '/super/orgs',
    name: 'super-orgs',
    component: SuperOrgList,
    meta: { requiresAuth: true, requiresWebAdmin: true },
  },

  // Leaderboard routes
  {
    path: '/tournaments/:tournamentId/leaderboard',
    name: 'tournament-leaderboard',
    component: Leaderboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/tournaments/:tournamentId/categories/:categoryId/leaderboard',
    name: 'category-leaderboard',
    component: Leaderboard,
    meta: { requiresAuth: true },
  },
  {
    path: '/tournaments/:tournamentId/reports',
    name: 'tournament-reports',
    component: () => import('@/features/reports/views/TournamentSummaryView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/profile',
    redirect: '/tournaments',
  },
  {
    path: '/preferences',
    redirect: '/tournaments',
  },

  // OBS Overlay routes (no auth, transparent background)
  {
    path: '/obs/:tournamentId/match/:matchId',
    name: 'obs-score-bug',
    component: () => import('@/features/obs/views/ObsScoreBugView.vue'),
    meta: { requiresAuth: false, obsOverlay: true },
  },
  {
    path: '/obs/:tournamentId/scoreboard',
    name: 'obs-scoreboard',
    component: () => import('@/features/obs/views/ObsScoreboardView.vue'),
    meta: { requiresAuth: false, obsOverlay: true },
  },

  {
    path: '/overlay/:tournamentId/court/:courtId',
    name: 'overlay-court',
    component: OverlayCourtView,
    meta: { requiresAuth: false, overlayPage: true },
  },
  {
    path: '/overlay/:tournamentId/ticker',
    name: 'overlay-ticker',
    component: OverlayTickerView,
    meta: { requiresAuth: false, overlayPage: true },
  },
  {
    path: '/overlay/:tournamentId/board',
    name: 'overlay-board',
    component: OverlayBoardView,
    meta: { requiresAuth: false, overlayPage: true },
  },
  {
    path: '/tournaments/:tournamentId/overlays',
    name: 'overlay-links',
    component: OverlayLinksView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },

  {
    path: '/org/profile',
    name: 'org-profile',
    component: OrgProfile,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/players',
    name: 'players-list',
    component: PlayersListView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/players/:playerId',
    name: 'player-profile',
    component: PlayerProfileView,
    meta: { requiresAuth: true },
  },
  {
    path: '/players/merge',
    name: 'player-merge',
    component: PlayerMergeView,
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/players/:playerId/merge',
    redirect: to => ({
      path: '/players/merge',
      query: {
        source: String(to.params.playerId ?? ''),
      },
    }),
    meta: { requiresAuth: true, requiresAdmin: true },
  },

  {
    path: '/find',
    name: 'player-search',
    component: PlayerSearchView,
    meta: { requiresAuth: false },
  },

  // Org public landing — must be LAST before catch-all to avoid shadowing static paths
  {
    path: '/:orgSlug([a-z0-9-]+)',
    name: 'org-public-home',
    component: OrgPublicHome,
    meta: { requiresAuth: false },
  },

  // Catch-all 404
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  },
});

// Navigation guards
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();
  const volunteerAccessStore = useVolunteerAccessStore();

  // Skip all auth checks for OBS overlay routes
  if (to.meta.obsOverlay) {
    next();
    return;
  }

  // Skip all auth checks for overlay page routes
  if (to.meta.overlayPage) {
    next();
    return;
  }

  const volunteerRole = to.meta.volunteerRole as VolunteerRole | undefined;
  const requiresVolunteerSession = to.meta.requiresVolunteerSession === true;
  const volunteerAccessPage = to.meta.volunteerAccessPage === true;
  const tournamentId = typeof to.params.tournamentId === 'string'
    ? to.params.tournamentId
    : '';

  if (volunteerRole && tournamentId) {
    const hasVolunteerSession = volunteerAccessStore.hasValidSession(tournamentId, volunteerRole);

    if (volunteerAccessPage && hasVolunteerSession) {
      next({
        name: getVolunteerKioskRouteName(volunteerRole),
        params: { tournamentId },
      });
      return;
    }

    if (requiresVolunteerSession && !hasVolunteerSession) {
      next({
        name: getVolunteerAccessRouteName(volunteerRole),
        params: { tournamentId },
        query: { redirect: to.fullPath },
      });
      return;
    }
  }

  // Wait for auth to initialize
  if (authStore.loading) {
    await authStore.initAuth();
  }

  const requiresAuth = to.meta.requiresAuth === true;
  const guestOnly = to.meta.guestOnly === true;
  const requiresAdmin = to.meta.requiresAdmin === true;
  const requiresWebAdmin = to.meta.requiresWebAdmin === true;
  const requiresScorekeeper = to.meta.requiresScorekeeper === true;

  // Redirect authenticated users away from guest-only pages
  if (guestOnly && authStore.isAuthenticated) {
    next({ name: 'dashboard' });
    return;
  }

  // Check authentication
  if (requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } });
    return;
  }

  // Check admin role
  if (requiresAdmin && !authStore.isAdmin) {
    next({ name: 'dashboard' });
    return;
  }

  if (requiresWebAdmin && authStore.currentUser?.role !== 'admin') {
    next({ name: 'dashboard' });
    return;
  }

  // Check scorekeeper role
  if (requiresScorekeeper && !authStore.isScorekeeper) {
    next({ name: 'dashboard' });
    return;
  }

  next();
});

export default router;
