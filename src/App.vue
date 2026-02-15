<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useNotificationStore } from '@/stores/notifications';
import AppLayout from '@/components/layout/AppLayout.vue';

const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const isLoading = computed(() => authStore.loading);
</script>

<template>
  <v-app>
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
    <AppLayout v-if="!isLoading" />

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
