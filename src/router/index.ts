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

// Scoring views
const ScoringInterface = () => import('@/features/scoring/views/ScoringInterfaceView.vue');
const MatchList = () => import('@/features/scoring/views/MatchListView.vue');
const MatchControl = () => import('@/features/tournaments/views/MatchControlView.vue');

// Public views
const PublicBracket = () => import('@/features/public/views/PublicBracketView.vue');
const PublicLiveScores = () => import('@/features/public/views/PublicLiveScoresView.vue');
const PublicScoring = () => import('@/features/public/views/PublicScoringView.vue');

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
    component: PublicLiveScores,
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

  // Participants alias
  {
    path: '/tournaments/:tournamentId/participants',
    redirect: to => `/tournaments/${to.params.tournamentId}/registrations`
  },

  // Courts redirect
  {
    path: '/tournaments/:tournamentId/courts',
    redirect: to => `/tournaments/${to.params.tournamentId}/match-control`
  },

  // Match control (for organizers)
  {
    path: '/tournaments/:tournamentId/match-control',
    name: 'match-control',
    component: MatchControl,
    meta: { requiresAuth: true, requiresAdmin: true },
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
