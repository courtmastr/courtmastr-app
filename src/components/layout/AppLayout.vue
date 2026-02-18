<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import AppNavigation from '@/components/navigation/AppNavigation.vue';
import BreadcrumbNavigation from '@/components/navigation/BreadcrumbNavigation.vue';
import ContextualNavigation from '@/components/navigation/ContextualNavigation.vue';
import GlobalSearch from '@/components/navigation/GlobalSearch.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const drawer = ref(true); // Changed to true for default open state

const isAuthenticated = computed(() => authStore.isAuthenticated);
const currentUser = computed(() => authStore.currentUser);
const unreadCount = computed(() => notificationStore.unreadCount);

// Determine when to show different navigation elements
const showBreadcrumbs = computed(() => {
  return isAuthenticated.value && !['/', '/tournaments'].includes(route.path);
});

const showContextualNav = computed(() => {
  return Boolean(
    isAuthenticated.value &&
    route.params.tournamentId &&
    route.name === 'tournament-dashboard'
  );
});

const showSearch = computed(() => {
  // Show search on most pages except very specific ones
  return true; // Always show search for now
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
    { title: 'My Tournaments', icon: 'mdi-view-dashboard', action: () => router.push('/tournaments') },
    ...(route.params.tournamentId && authStore.isOrganizer
      ? [{
          title: 'Tournament Settings',
          icon: 'mdi-cog',
          action: () => router.push(`/tournaments/${route.params.tournamentId as string}/settings`),
        }]
      : []),
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
    case 'organizer':
      return 'success';
    default:
      return 'info';
  }
}

// Bug Report Logic
const showBugDialog = ref(false);
const bugDescription = ref('');
const bugSubmitting = ref(false);

async function submitBugReport() {
  if (!bugDescription.value.trim()) return;
  
  bugSubmitting.value = true;
  // Mock submission - in real app would call API
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  notificationStore.showToast('success', 'Bug report submitted! Thank you for your feedback.');
  showBugDialog.value = false;
  bugDescription.value = '';
  bugSubmitting.value = false;
}
</script>

<template>
  <v-layout>
    <!-- Main Navigation (Drawer) -->
    <!-- Main Navigation (Drawer) -->
    <AppNavigation
      v-if="isAuthenticated"
      v-model:drawer="drawer"
      :temporary="$vuetify.display.smAndDown"
      :permanent="!$vuetify.display.smAndDown"
      app
      width="280"
    />

    <!-- App Bar -->
    <v-app-bar
      elevation="0"
      class="app-bar"
    >
      <v-app-bar-nav-icon
        v-if="isAuthenticated"
        :ripple="false"
        @click="drawer = !drawer"
      />

      <v-toolbar-title>
        <router-link
          to="/"
          class="text-decoration-none text-inherit"
        >
          <span class="app-title">CourtMaster</span>
        </router-link>
      </v-toolbar-title>

      <!-- Global Search -->
      <GlobalSearch
        v-if="showSearch"
        class="mx-4 flex-grow-1"
      />

      <v-spacer v-else />

      <!-- Bug Report Button -->
      <v-tooltip
        text="Report a Bug"
        location="bottom"
      >
        <template #activator="{ props }">
          <v-btn
            icon="mdi-bug"
            variant="text"
            color="grey-darken-1"
            class="mr-2"
            v-bind="props"
            :ripple="false"
            @click="showBugDialog = true"
          />
        </template>
      </v-tooltip>

      <!-- Notifications -->
      <v-btn
        v-if="isAuthenticated"
        icon
        variant="text"
        class="mr-2"
      >
        <v-badge
          :content="unreadCount"
          :model-value="unreadCount > 0"
          color="error"
          dot
        >
          <v-icon>mdi-bell-outline</v-icon>
        </v-badge>
        <v-menu activator="parent">
          <v-card
            min-width="320"
            max-width="400"
            class="notification-menu"
            elevation="8"
          >
            <v-card-title class="d-flex align-center pa-4">
              <span class="text-h6">Notifications</span>
              <v-spacer />
              <v-btn
                v-if="unreadCount > 0"
                size="small"
                variant="text"
                color="primary"
                @click="notificationStore.markAllAsRead(currentUser?.id || '')"
              >
                Mark all read
              </v-btn>
            </v-card-title>
            <v-divider />
            <v-list
              v-if="notificationStore.recentNotifications.length > 0"
              class="py-0"
            >
              <v-list-item
                v-for="notification in notificationStore.recentNotifications"
                :key="notification.id"
                :class="{ 'notification-unread': !notification.read }"
                class="notification-item"
                @click="notificationStore.markAsRead(notification.id)"
              >
                <v-list-item-title class="text-subtitle-2">
                  {{ notification.title }}
                </v-list-item-title>
                <v-list-item-subtitle class="text-caption">
                  {{ notification.message }}
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <v-card-text
              v-else
              class="text-center text-grey py-8"
            >
              <v-icon
                size="48"
                color="grey-lighten-1"
                class="mb-2"
              >
                mdi-bell-outline
              </v-icon>
              <div>No notifications</div>
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
            variant="text"
          >
            <v-avatar
              color="primary"
              size="36"
            >
              <span class="text-subtitle-2">{{ currentUser?.displayName?.charAt(0) || 'U' }}</span>
            </v-avatar>
          </v-btn>
          <div
            v-else
            class="auth-buttons d-flex flex-column flex-sm-row"
          >
            <v-btn
              variant="text"
              to="/login"
              class="text-none"
            >
              Login
            </v-btn>
            <v-btn
              color="primary"
              to="/register"
              class="text-none"
              elevation="0"
            >
              Register
            </v-btn>
          </div>
        </template>

        <v-card
          v-if="isAuthenticated"
          min-width="240"
          elevation="8"
          class="user-menu"
        >
          <v-list class="py-2">
            <v-list-item class="user-info-item">
              <template #prepend>
                <v-avatar
                  color="primary"
                  size="40"
                >
                  <span>{{ currentUser?.displayName?.charAt(0) || 'U' }}</span>
                </v-avatar>
              </template>
              <v-list-item-title class="text-subtitle-1 font-weight-medium">
                {{ currentUser?.displayName }}
              </v-list-item-title>
              <v-list-item-subtitle>
                <v-chip
                  size="x-small"
                  :color="getRoleBadgeColor(currentUser?.role || 'viewer')"
                  label
                >
                  {{ currentUser?.role }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>
            <v-divider class="my-2" />
            <template
              v-for="(item, index) in userMenuItems"
              :key="index"
            >
              <v-divider
                v-if="item.divider"
                class="my-2"
              />
              <v-list-item
                v-else
                :prepend-icon="item.icon"
                :title="item.title"
                class="menu-item"
                @click="item.action"
              />
            </template>
          </v-list>
        </v-card>
      </v-menu>
    </v-app-bar>

    <!-- Main Content -->
    <v-main>
      <v-container fluid>
        <!-- Breadcrumb Navigation -->
        <BreadcrumbNavigation v-if="showBreadcrumbs" />
        
        <!-- Contextual Navigation based on tournament status -->
        <ContextualNavigation v-if="showContextualNav" />
        
        <!-- Page content -->
        <router-view />
      </v-container>
    </v-main>

    <!-- Bug Report Dialog -->
    <v-dialog
      v-model="showBugDialog"
      max-width="500"
    >
      <v-card>
        <v-card-title class="d-flex align-center">
          <v-icon
            start
            color="warning"
            class="mr-2"
          >
            mdi-bug
          </v-icon>
          Report a Bug
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 text-grey-darken-1 mb-4">
            Found an issue? Let us know so we can fix it.
          </p>
          <v-textarea
            v-model="bugDescription"
            label="Describe the issue"
            placeholder="What happened? What did you expect to happen?"
            variant="outlined"
            rows="4"
            auto-grow
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showBugDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            variant="elevated"
            :loading="bugSubmitting"
            :disabled="!bugDescription.trim()"
            @click="submitBugReport"
          >
            Submit Report
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-layout>
</template>

<style scoped lang="scss">
@import '@/styles/variables.scss';

.app-bar {
  border-bottom: 1px solid $border-light;
  box-shadow: $shadow-sm;
  background-color: $white !important;
}

.app-title {
  font-weight: $font-weight-bold;
  font-size: $font-size-lg;
  background: $primary-gradient;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.text-inherit {
  color: inherit;
}

.search-wrapper {
  flex: 0 1 500px;
  max-width: 500px;
  margin: 0 $spacing-lg;
}

.auth-buttons {
  display: flex;
  gap: $spacing-sm;
  align-items: center;
}

// Notification Menu
.notification-menu {
  border-radius: $border-radius-md;
  overflow: hidden;
}

.notification-item {
  border-left: 3px solid transparent;
  transition: $transition-base;
  
  &:hover {
    background-color: rgba($primary-base, 0.04);
    border-left-color: $primary-base;
  }
}

.notification-unread {
  background-color: rgba($primary-base, 0.06);
  border-left-color: $primary-base;
}

// User Menu
.user-menu {
  border-radius: $border-radius-md;
  overflow: hidden;
}

.user-info-item {
  background-color: rgba($primary-base, 0.04);
}

.menu-item {
  transition: $transition-base;
  
  &:hover {
    background-color: rgba($primary-base, 0.04);
  }
}
</style>
