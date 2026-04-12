<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import { useTournamentStore } from '@/stores/tournaments';
import AppLayout from '@/components/layout/AppLayout.vue';
import VolunteerLayout from '@/components/layout/VolunteerLayout.vue';

const authStore = useAuthStore();
const notificationStore = useNotificationStore();
const tournamentStore = useTournamentStore();
const route = useRoute();

const usesVolunteerLayout = computed(() => route.meta.volunteerLayout === true);
const isLoading = computed(() => !usesVolunteerLayout.value && authStore.loading);
const isOverlayRoute = computed(() => (
  route.meta.overlayPage === true || route.meta.obsOverlay === true
));

// Toggle 'overlay-page' class on <html> based on route meta for overlay transparency
watch(
  isOverlayRoute,
  (isOverlay) => {
    if (isOverlay) {
      document.documentElement.classList.add('overlay-page');
    } else {
      document.documentElement.classList.remove('overlay-page');
    }
  },
  { immediate: true }
);

// Start the tournament subscription as soon as the user is authenticated so
// data is in-flight during router navigation rather than waiting for
// TournamentListView to mount. The subscription itself guards against
// double-setup, so the view's onMounted call is a safe no-op.
watch(
  () => authStore.currentUser,
  (user) => {
    if (user) {
      tournamentStore.subscribeTournaments();
    } else {
      tournamentStore.unsubscribeTournaments();
    }
  },
  { immediate: true }
);
</script>

<template>
  <router-view v-if="isOverlayRoute" />
  <v-app v-else>
    <!-- Loading overlay -->
    <v-overlay
      v-model="isLoading"
      class="align-center justify-center"
      persistent
    >
      <v-progress-circular
        color="primary"
        indeterminate
        size="64"
      />
    </v-overlay>

    <!-- Main layout -->
    <VolunteerLayout
      v-if="usesVolunteerLayout && !isLoading"
    />
    <AppLayout
      v-else-if="!isLoading"
    />

    <!-- Toast notifications -->
    <v-snackbar
      v-for="toast in notificationStore.toastNotifications"
      :key="toast.id"
      :model-value="true"
      :color="toast.type"
      :timeout="toast.timeout"
      location="top right"
      @update:model-value="notificationStore.removeToast(toast.id)"
    >
      {{ toast.message }}
      <template #actions>
        <v-btn
          variant="text"
          @click="notificationStore.removeToast(toast.id)"
        >
          Close
        </v-btn>
      </template>
    </v-snackbar>
  </v-app>
</template>

<style>
/* Global styles */
html {
  overflow-y: auto !important;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* NUCLEAR FIX FOR CYAN CIRCLES (BUG-001) */
.v-ripple__container,
.v-ripple__animation {
  display: none !important;
  opacity: 0 !important;
  visibility: hidden !important;
}

/* Ensure no other 'cyan' backgrounds persist on active states unless intended */
.v-list-item--active::before {
  opacity: 0 !important;
}
</style>
