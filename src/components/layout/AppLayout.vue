<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDisplay } from 'vuetify';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import AppNavigation from '@/components/navigation/AppNavigation.vue';
import BreadcrumbNavigation from '@/components/navigation/BreadcrumbNavigation.vue';
import ContextualNavigation from '@/components/navigation/ContextualNavigation.vue';
import GlobalSearch from '@/components/navigation/GlobalSearch.vue';
import BaseDialog from '@/components/common/BaseDialog.vue';
import PublicWebsiteFooter from '@/components/common/PublicWebsiteFooter.vue';
import { useI18n, type SupportedLocale } from '@/i18n';

const router = useRouter();
const route = useRoute();
const display = useDisplay();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const { locale, setLocale, t } = useI18n();

const drawer = ref(!display.smAndDown.value);

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

const isPublicMarketingRoute = computed(() =>
  route.meta.publicMarketingPage === true &&
  route.meta.overlayPage !== true &&
  route.meta.obsOverlay !== true &&
  route.meta.volunteerLayout !== true
);

const showSearch = computed(() => {
  if (!isAuthenticated.value) return false;

  return (
    route.meta.overlayPage !== true &&
    route.meta.obsOverlay !== true &&
    route.meta.volunteerLayout !== true
  );
});

const publicMarketingLinks = [
  { title: 'Home', to: '/' },
  { title: 'About', to: '/about' },
  { title: 'Pricing', to: '/pricing' },
];

const showPublicMarketingNav = computed(() =>
  !isAuthenticated.value &&
  isPublicMarketingRoute.value &&
  !display.mdAndDown.value
);

const showPublicWebsiteFooter = computed(() =>
  isPublicMarketingRoute.value
);

const showLanguageToggle = computed(() =>
  route.meta.requiresAuth === false &&
  route.meta.overlayPage !== true &&
  route.meta.obsOverlay !== true &&
  route.meta.volunteerLayout !== true
);

const selectedPublicLocale = computed<SupportedLocale>({
  get: () => locale.value,
  set: (nextLocale) => setLocale(nextLocale),
});

const isActivePublicMarketingLink = (path: string): boolean => route.path === path;

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

watch(
  () => display.smAndDown.value,
  (isSmallScreen, wasSmallScreen) => {
    if (isSmallScreen === wasSmallScreen) return;
    drawer.value = !isSmallScreen;
  }
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

import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const showBugDialog = ref(false);
const bugDescription = ref('');
const bugSubmitting = ref(false);
const screenshotFile = ref<File | null>(null);
const screenshotPreview = ref<string>('');
const fileInput = ref<HTMLInputElement | null>(null);
const maxFileSize = 5 * 1024 * 1024;
const acceptedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function processFile(file: File | null | undefined) {
  if (!file) return;

  if (!acceptedTypes.includes(file.type)) {
    notificationStore.showToast('error', 'Please select an image file (JPEG, PNG, GIF, or WebP)');
    return;
  }

  if (file.size > maxFileSize) {
    notificationStore.showToast('error', 'File size must be less than 5MB');
    return;
  }

  screenshotFile.value = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    screenshotPreview.value = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  processFile(input.files?.[0]);
}

function handleFileDrop(event: DragEvent) {
  const file = event.dataTransfer?.files[0];
  processFile(file);
}

function removeScreenshot() {
  screenshotFile.value = null;
  screenshotPreview.value = '';
  if (fileInput.value) {
    fileInput.value.value = '';
  }
}

function triggerFileInput() {
  fileInput.value?.click();
}

async function uploadScreenshot(): Promise<string | null> {
  if (!screenshotFile.value) return null;

  const storage = getStorage();
  const timestamp = Date.now();
  const filename = `bug-reports/${authStore.currentUser?.id || 'anonymous'}/${timestamp}_${screenshotFile.value.name}`;
  const fileRef = storageRef(storage, filename);

  await uploadBytes(fileRef, screenshotFile.value);
  const downloadUrl = await getDownloadURL(fileRef);

  return downloadUrl;
}

async function submitBugReport() {
  if (!bugDescription.value.trim()) return;

  bugSubmitting.value = true;

  try {
    const screenshotUrl = await uploadScreenshot();
    const functions = getFunctions();
    const submitBug = httpsCallable(functions, 'submitBugReport');

    await submitBug({
      description: bugDescription.value.trim(),
      pageUrl: window.location.href,
      browserInfo: navigator.userAgent,
      screenshotUrl,
    });

    notificationStore.showToast('success', 'Bug report submitted! Thank you for your feedback.');
    showBugDialog.value = false;
    bugDescription.value = '';
    removeScreenshot();
  } catch (error) {
    console.error('Error submitting bug report:', error);
    notificationStore.showToast(
      'error',
      error instanceof Error ? error.message : 'Failed to submit bug report. Please try again.'
    );
  } finally {
    bugSubmitting.value = false;
  }
}
</script>

<template>
  <v-layout>
    <a
      href="#main-content"
      class="skip-link"
    >Skip to main content</a>

    <!-- Main Navigation (Drawer) -->
    <!-- Main Navigation (Drawer) -->
    <AppNavigation
      v-if="isAuthenticated"
      v-model:drawer="drawer"
      :temporary="display.smAndDown"
      :permanent="!display.smAndDown"
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
        aria-label="Toggle navigation"
        @click="drawer = !drawer"
      />

      <v-toolbar-title>
        <router-link
          to="/"
          class="text-decoration-none text-inherit d-flex align-center"
        >
          <img
            src="@/assets/brand/courtmaster-lockup.svg"
            alt="CourtMastr Logo"
            width="180"
            height="36"
            class="app-logo"
          >
        </router-link>
      </v-toolbar-title>

      <nav
        v-if="showPublicMarketingNav"
        class="public-marketing-nav mr-4"
        aria-label="Public marketing navigation"
      >
        <v-btn
          v-for="item in publicMarketingLinks"
          :key="item.to"
          :to="item.to"
          size="small"
          class="public-marketing-nav__item text-none"
          :variant="isActivePublicMarketingLink(item.to) ? 'flat' : 'text'"
          :color="isActivePublicMarketingLink(item.to) ? 'primary' : undefined"
          :aria-current="isActivePublicMarketingLink(item.to) ? 'page' : undefined"
        >
          {{ item.title }}
        </v-btn>
      </nav>

      <!-- Global Search -->
      <GlobalSearch
        v-if="showSearch"
        class="mx-4 flex-grow-1"
      />

      <v-spacer v-else />

      <v-btn-toggle
        v-if="showLanguageToggle"
        v-model="selectedPublicLocale"
        mandatory
        density="compact"
        variant="outlined"
        class="app-language-toggle mr-2"
        aria-label="Language selector"
      >
        <v-btn
          value="en"
          size="small"
        >
          {{ t('common.englishShort') }}
        </v-btn>
        <v-btn
          value="es"
          size="small"
        >
          {{ t('common.spanishShort') }}
        </v-btn>
      </v-btn-toggle>

      <!-- Bug Report Button -->
      <v-tooltip
        text="Report a Bug"
        location="bottom"
      >
        <template #activator="{ props }">
          <v-btn
            icon
            variant="text"
            color="grey-darken-1"
            class="mr-2"
            v-bind="props"
            :ripple="false"
            aria-label="Report a bug"
            @click="showBugDialog = true"
          >
            <v-icon
              icon="mdi-bug-outline"
              size="20"
            />
          </v-btn>
        </template>
      </v-tooltip>

      <!-- Notifications -->
      <v-btn
        v-if="isAuthenticated"
        icon
        variant="text"
        class="mr-2"
        :aria-label="unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'"
      >
        <v-badge
          :content="unreadCount"
          :model-value="unreadCount > 0"
          color="error"
        >
          <v-icon
            icon="mdi-bell"
            size="20"
          />
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
                icon="mdi-bell"
                size="48"
                class="mb-2 text-grey-lighten-1"
              />
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
            aria-label="Open user menu"
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
              {{ t('common.login') }}
            </v-btn>
            <v-btn
              color="primary"
              to="/register"
              class="text-none"
              elevation="0"
            >
              {{ t('common.register') }}
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
                  {{ currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : '' }}
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
                :title="item.title"
                class="menu-item"
                @click="item.action"
              >
                <template #prepend>
                  <v-icon
                    :icon="item.icon"
                    size="20"
                    class="mr-4 text-grey-darken-1"
                  />
                </template>
              </v-list-item>
            </template>
          </v-list>
        </v-card>
      </v-menu>
    </v-app-bar>

    <!-- Main Content -->
    <v-main
      id="main-content"
      class="app-main"
    >
      <v-container
        fluid
        class="app-main__content"
      >
        <!-- Breadcrumb Navigation -->
        <BreadcrumbNavigation v-if="showBreadcrumbs" />
        
        <!-- Contextual Navigation based on tournament status -->
        <ContextualNavigation v-if="showContextualNav" />
        
        <!-- Page content -->
        <section class="app-route-frame">
          <router-view />
        </section>
      </v-container>

      <PublicWebsiteFooter v-if="showPublicWebsiteFooter" />
    </v-main>

    <!-- Bug Report Dialog -->
    <BaseDialog
      v-model="showBugDialog"
      title="Report a Bug"
      max-width="600"
      :loading="bugSubmitting"
      @cancel="showBugDialog = false"
    >
      <p class="text-body-2 text-grey-darken-1 mb-4">
        Found an issue? Let us know so we can fix it.
      </p>

      <v-textarea
        v-model="bugDescription"
        label="Describe the issue *"
        placeholder="What happened? What did you expect to happen?"
        variant="outlined"
        rows="4"
        auto-grow
        class="mb-4"
      />

      <!-- Screenshot Upload -->
      <div class="screenshot-section">
        <label class="text-subtitle-2 mb-2 d-block">Screenshot (optional)</label>

        <!-- Hidden File Input -->
        <input
          ref="fileInput"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          class="d-none"
          @change="handleFileSelect"
        >

        <!-- Upload Area or Preview -->
        <v-fade-transition>
          <div
            v-if="!screenshotPreview"
            key="upload"
          >
            <v-card
              variant="outlined"
              class="upload-area pa-6 text-center cursor-pointer"
              :ripple="false"
              role="button"
              tabindex="0"
              aria-label="Upload screenshot - click or drag and drop an image"
              @click="triggerFileInput"
              @keydown.enter.prevent="triggerFileInput"
              @keydown.space.prevent="triggerFileInput"
              @dragover.prevent
              @drop.prevent="handleFileDrop"
            >
              <v-icon
                icon="mdi-camera"
                size="48"
                color="grey-lighten-1"
                class="mb-2"
              />
              <div class="text-body-2 text-grey-darken-1">
                Click to upload or drag and drop
              </div>
              <div class="text-caption text-grey mt-1">
                JPEG, PNG, GIF, WebP (max 5MB)
              </div>
            </v-card>
          </div>

          <div
            v-else
            key="preview"
            class="preview-container"
          >
            <v-card
              variant="outlined"
              class="preview-card"
            >
              <v-img
                :src="screenshotPreview"
                height="200"
                cover
                class="rounded"
              />
              <v-btn
                icon="mdi-close"
                size="small"
                color="error"
                variant="flat"
                class="remove-btn"
                aria-label="Remove screenshot"
                @click="removeScreenshot"
              />
            </v-card>
          </div>
        </v-fade-transition>
      </div>

      <template #actions>
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
      </template>
    </BaseDialog>
  </v-layout>
</template>

<style scoped lang="scss">
@use '@/styles/variables.scss' as *;

.skip-link {
  position: absolute;
  top: -100%;
  left: 16px;
  z-index: 9999;
  background: white;
  color: #4F46E5;
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 600;
  text-decoration: none;
}
.skip-link:focus {
  top: 16px;
}

.app-bar {
  border-bottom: 1px solid $border-light;
  box-shadow: $shadow-sm;
  background: linear-gradient(180deg, rgba($white, 0.98) 0%, rgba($white, 0.94) 100%) !important;
  backdrop-filter: saturate(120%) blur(4px);
}

.app-main {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 64px);
  background:
    radial-gradient(circle at 2% 0%, rgba($primary-base, 0.05), transparent 22%),
    radial-gradient(circle at 98% 0%, rgba($secondary-base, 0.05), transparent 20%),
    $background;
}

.app-main__content {
  flex: 1 0 auto;
  width: min(100%, 1540px);
  margin: 0 auto;
  padding-inline: clamp(12px, 2.2vw, 28px);
}

.app-route-frame {
  min-height: calc(100dvh - 132px);
}

.app-logo {
  height: 36px;
  width: auto;
  transition: transform 0.2s ease;
  
  &:hover {
    transform: scale(1.05);
  }
}

.app-title {
  font-weight: $font-weight-bold;
  font-size: $font-size-lg;
  color: $primary-base;
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

.app-language-toggle {
  min-width: 112px;
}

.app-language-toggle :deep(.v-btn) {
  min-width: 48px;
  text-transform: none;
  letter-spacing: 0.02em;
  font-weight: 600;
}

.public-marketing-nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.public-marketing-nav__item {
  font-weight: 600;
  letter-spacing: 0.01em;
  border-radius: 999px;
  padding-inline: 14px;
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

// Screenshot Upload Styles
.screenshot-section {
  margin-top: $spacing-md;
}

.upload-area {
  border: 2px dashed rgba($primary-base, 0.3);
  border-radius: $border-radius-md;
  transition: $transition-base;
  cursor: pointer;

  &:hover {
    border-color: $primary-base;
    background-color: rgba($primary-base, 0.04);
  }
}

.preview-container {
  position: relative;
}

.preview-card {
  position: relative;
  overflow: hidden;

  .remove-btn {
    position: absolute;
    top: $spacing-sm;
    right: $spacing-sm;
    z-index: 1;
  }
}
</style>
