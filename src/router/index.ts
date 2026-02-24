// Vue Router Configuration
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

// Lazy-loaded views
const Home = () => import('@/features/public/views/HomeView.vue');
const Login = () => import('@/features/auth/views/LoginView.vue');
const Register = () => import('@/features/auth/views/RegisterView.vue');

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

// Scoring views
const ScoringInterface = () => import('@/features/scoring/views/ScoringInterfaceView.vue');
const MatchList = () => import('@/features/scoring/views/MatchListView.vue');
const MatchControl = () => import('@/features/tournaments/views/MatchControlView.vue');

// Public views
const PublicBracket = () => import('@/features/public/views/PublicBracketView.vue');
const PublicScoring = () => import('@/features/public/views/PublicScoringView.vue');
const PublicSchedule = () => import('@/features/public/views/PublicScheduleView.vue');

// Overlay views
const OverlayCourtView = () => import('@/features/overlay/views/OverlayCourtView.vue');
const OverlayTickerView = () => import('@/features/overlay/views/OverlayTickerView.vue');
const OverlayBoardView = () => import('@/features/overlay/views/OverlayBoardView.vue');
const OverlayLinksView = () => import('@/features/overlay/views/OverlayLinksView.vue');

const routes: RouteRecordRaw[] = [
  // Public routes
  {
    path: '/',
    name: 'home',
    component: Home,
    meta: { requiresAuth: false },
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
    path: '/tournaments/:tournamentId/schedule',
    name: 'public-schedule',
    component: PublicSchedule,
    meta: { requiresAuth: false },
  },

  // Authenticated routes
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
    path: '/tournaments/:tournamentId/live-view',
    name: 'match-live-view',
    redirect: to => `/tournaments/${to.params.tournamentId}/match-control?view=queue`,
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

  // Skip all auth checks for OBS overlay routes
  if (to.meta.obsOverlay) {
    next();
    return;
  }

  // Wait for auth to initialize
  if (authStore.loading) {
    await authStore.initAuth();
  }

  const requiresAuth = to.meta.requiresAuth as boolean;
  const guestOnly = to.meta.guestOnly as boolean;
  const requiresAdmin = to.meta.requiresAdmin as boolean;
  const requiresScorekeeper = to.meta.requiresScorekeeper as boolean;

  // Redirect authenticated users away from guest-only pages
  if (guestOnly && authStore.isAuthenticated) {
    next({ name: 'tournament-list' });
    return;
  }

  // Check authentication
  if (requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } });
    return;
  }

  // Check admin role
  if (requiresAdmin && !authStore.isAdmin) {
    next({ name: 'tournament-list' });
    return;
  }

  // Check scorekeeper role
  if (requiresScorekeeper && !authStore.isScorekeeper) {
    next({ name: 'tournament-list' });
    return;
  }

  next();
});

export default router;
