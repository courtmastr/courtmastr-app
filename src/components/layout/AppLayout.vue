<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';

const router = useRouter();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const drawer = ref(false);
const rail = ref(false);

const isAuthenticated = computed(() => authStore.isAuthenticated);
const isAdmin = computed(() => authStore.isAdmin);
const currentUser = computed(() => authStore.currentUser);
const unreadCount = computed(() => notificationStore.unreadCount);

// Navigation items
const navigationItems = computed(() => {
  const items = [];

  if (isAuthenticated.value) {
    items.push({
      title: 'Tournaments',
      icon: 'mdi-trophy',
      to: '/tournaments',
    });

    if (isAdmin.value) {
      items.push({
        title: 'Create Tournament',
        icon: 'mdi-plus-circle',
        to: '/tournaments/create',
      });
    }
  }

  return items;
});

// User menu items
const userMenuItems = computed(() => {
  if (!isAuthenticated.value) {
    return [
      { title: 'Login', icon: 'mdi-login', action: () => router.push('/login') },
      { title: 'Register', icon: 'mdi-account-plus', action: () => router.push('/register') },
    ];
  }

  return [
    { title: 'Profile', icon: 'mdi-account', action: () => {} },
    { title: 'Settings', icon: 'mdi-cog', action: () => {} },
    { divider: true },
    { title: 'Logout', icon: 'mdi-logout', action: handleLogout },
  ];
});

// Watch for auth changes to subscribe to notifications
watch(
  () => authStore.currentUser?.id,
  (userId) => {
    if (userId) {
      notificationStore.subscribeNotifications(userId);
    } else {
      notificationStore.unsubscribe();
    }
  },
  { immediate: true }
);

async function handleLogout() {
  await authStore.signOut();
  router.push('/');
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'admin':
      return 'error';
    case 'scorekeeper':
      return 'warning';
    default:
      return 'info';
  }
}
</script>

<template>
  <v-layout>
    <!-- Navigation Drawer -->
    <v-navigation-drawer
      v-if="isAuthenticated"
      v-model="drawer"
      :rail="rail"
      permanent
      @click="rail = false"
    >
      <v-list-item
        :title="currentUser?.displayName || 'User'"
        :subtitle="currentUser?.email"
        nav
      >
        <template #prepend>
          <v-avatar color="primary">
            <span class="text-h6">{{ currentUser?.displayName?.charAt(0) || 'U' }}</span>
          </v-avatar>
        </template>
        <template #append>
          <v-btn
            icon="mdi-chevron-left"
            variant="text"
            @click.stop="rail = !rail"
          />
        </template>
      </v-list-item>

      <v-divider />

      <v-list nav density="compact">
        <v-list-item
          v-for="item in navigationItems"
          :key="item.title"
          :to="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          rounded="lg"
        />
      </v-list>

      <template #append>
        <v-list nav density="compact">
          <v-list-item
            prepend-icon="mdi-cog"
            title="Settings"
            rounded="lg"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <!-- App Bar -->
    <v-app-bar elevation="1">
      <v-app-bar-nav-icon
        v-if="isAuthenticated"
        @click="drawer = !drawer"
      />

      <v-toolbar-title>
        <router-link to="/" class="text-decoration-none text-inherit">
          <span class="font-weight-bold">CourtMaster</span>
        </router-link>
      </v-toolbar-title>

      <v-spacer />

      <!-- Notifications -->
      <v-btn
        v-if="isAuthenticated"
        icon
        class="mr-2"
      >
        <v-badge
          :content="unreadCount"
          :model-value="unreadCount > 0"
          color="error"
        >
          <v-icon>mdi-bell</v-icon>
        </v-badge>
        <v-menu activator="parent">
          <v-card min-width="300" max-width="400">
            <v-card-title class="d-flex align-center">
              Notifications
              <v-spacer />
              <v-btn
                v-if="unreadCount > 0"
                size="small"
                variant="text"
                @click="notificationStore.markAllAsRead(currentUser?.id || '')"
              >
                Mark all read
              </v-btn>
            </v-card-title>
            <v-divider />
            <v-list v-if="notificationStore.recentNotifications.length > 0">
              <v-list-item
                v-for="notification in notificationStore.recentNotifications"
                :key="notification.id"
                :class="{ 'bg-grey-lighten-4': !notification.read }"
                @click="notificationStore.markAsRead(notification.id)"
              >
                <v-list-item-title>{{ notification.title }}</v-list-item-title>
                <v-list-item-subtitle>{{ notification.message }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <v-card-text v-else class="text-center text-grey">
              No notifications
            </v-card-text>
          </v-card>
        </v-menu>
      </v-btn>

      <!-- User Menu -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn
            v-if="isAuthenticated"
            v-bind="props"
            icon
          >
            <v-avatar color="primary" size="32">
              <span>{{ currentUser?.displayName?.charAt(0) || 'U' }}</span>
            </v-avatar>
          </v-btn>
          <div v-else>
            <v-btn
              variant="text"
              to="/login"
            >
              Login
            </v-btn>
            <v-btn
              color="primary"
              to="/register"
            >
              Register
            </v-btn>
          </div>
        </template>

        <v-list v-if="isAuthenticated">
          <v-list-item>
            <v-list-item-title>{{ currentUser?.displayName }}</v-list-item-title>
            <v-list-item-subtitle>
              <v-chip
                size="x-small"
                :color="getRoleBadgeColor(currentUser?.role || 'viewer')"
              >
                {{ currentUser?.role }}
              </v-chip>
            </v-list-item-subtitle>
          </v-list-item>
          <v-divider />
          <template v-for="(item, index) in userMenuItems" :key="index">
            <v-divider v-if="item.divider" />
            <v-list-item
              v-else
              :prepend-icon="item.icon"
              :title="item.title"
              @click="item.action"
            />
          </template>
        </v-list>
      </v-menu>
    </v-app-bar>

    <!-- Main Content -->
    <v-main>
      <v-container fluid>
        <router-view />
      </v-container>
    </v-main>
  </v-layout>
</template>

<style scoped>
.text-inherit {
  color: inherit;
}
</style>
