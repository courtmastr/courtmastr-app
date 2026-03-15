import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import AppLayout from '@/components/layout/AppLayout.vue';

const runtime = {
  route: {
    path: '/',
    name: 'home',
    params: {} as Record<string, string>,
    meta: { requiresAuth: false, publicMarketingPage: true } as Record<string, unknown>,
  },
  isAuthenticated: false,
  currentUserId: null as string | null,
};

const mockDeps = vi.hoisted(() => ({
  routerPush: vi.fn(),
  signOut: vi.fn(),
  subscribeNotifications: vi.fn(),
  unsubscribeNotifications: vi.fn(),
  markAllAsRead: vi.fn(),
  markAsRead: vi.fn(),
  submitBug: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockDeps.routerPush,
  }),
  useRoute: () => runtime.route,
}));

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: runtime.isAuthenticated,
    isOrganizer: false,
    loading: false,
    currentUser: runtime.currentUserId
      ? {
          id: runtime.currentUserId,
          displayName: 'Test User',
          role: 'viewer',
        }
      : null,
    signOut: mockDeps.signOut,
  }),
}));

vi.mock('@/stores/notifications', () => ({
  useNotificationStore: () => ({
    unreadCount: 0,
    recentNotifications: [],
    subscribeNotifications: mockDeps.subscribeNotifications,
    unsubscribe: mockDeps.unsubscribeNotifications,
    markAllAsRead: mockDeps.markAllAsRead,
    markAsRead: mockDeps.markAsRead,
    showToast: vi.fn(),
  }),
}));

vi.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => mockDeps.submitBug,
}));

vi.mock('firebase/storage', () => ({
  getStorage: () => ({}),
  ref: () => ({}),
  uploadBytes: vi.fn().mockResolvedValue(undefined),
  getDownloadURL: vi.fn().mockResolvedValue('https://example.test/screenshot.png'),
}));

vi.mock('vuetify', () => ({
  useDisplay: () => ({
    smAndDown: false,
  }),
}));

const mountView = () => shallowMount(AppLayout, {
  global: {
    renderStubDefaultSlot: true,
    stubs: [
      'AppNavigation',
      'BreadcrumbNavigation',
      'ContextualNavigation',
      'GlobalSearch',
      'BaseDialog',
      'router-link',
      'router-view',
      'v-layout',
      'v-app-bar',
      'v-app-bar-nav-icon',
      'v-toolbar-title',
      'v-spacer',
      'v-tooltip',
      'v-btn',
      'v-btn-toggle',
      'v-icon',
      'v-badge',
      'v-menu',
      'v-card',
      'v-card-title',
      'v-card-text',
      'v-list',
      'v-list-item',
      'v-list-item-title',
      'v-list-item-subtitle',
      'v-divider',
      'v-avatar',
      'v-chip',
      'v-main',
      'v-container',
      'v-textarea',
      'v-img',
      'v-fade-transition',
    ],
  },
});

describe('AppLayout public footer', () => {
  beforeEach(() => {
    runtime.route = {
      path: '/',
      name: 'home',
      params: {},
      meta: { requiresAuth: false, publicMarketingPage: true },
    };
    runtime.isAuthenticated = false;
    runtime.currentUserId = null;

    mockDeps.routerPush.mockReset();
    mockDeps.signOut.mockReset().mockResolvedValue(undefined);
    mockDeps.subscribeNotifications.mockReset();
    mockDeps.unsubscribeNotifications.mockReset();
    mockDeps.markAllAsRead.mockReset();
    mockDeps.markAsRead.mockReset();
    mockDeps.submitBug.mockReset().mockResolvedValue(undefined);
  });

  it('renders public website footer for public routes', () => {
    const wrapper = mountView();
    const mainContent = wrapper.find('v-main-stub');
    expect(mainContent.exists()).toBe(true);
    expect(mainContent.find('public-website-footer-stub').exists()).toBe(true);
    expect(wrapper.find('v-btn-toggle-stub').exists()).toBe(true);
  });

  it('hides public website footer for authenticated routes', () => {
    runtime.route.meta = { requiresAuth: true };
    const wrapper = mountView();
    expect(wrapper.find('public-website-footer-stub').exists()).toBe(false);
    expect(wrapper.find('v-btn-toggle-stub').exists()).toBe(false);
  });

  it('hides public website footer for non-marketing public routes', () => {
    runtime.route.meta = { requiresAuth: false };
    const wrapper = mountView();
    expect(wrapper.find('public-website-footer-stub').exists()).toBe(false);
  });

  it('hides public website footer for obs overlay routes', () => {
    runtime.route.meta = { requiresAuth: false, obsOverlay: true };
    const wrapper = mountView();
    expect(wrapper.find('public-website-footer-stub').exists()).toBe(false);
    expect(wrapper.find('v-btn-toggle-stub').exists()).toBe(false);
  });
});
