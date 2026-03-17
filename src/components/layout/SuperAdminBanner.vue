<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useSuperAdminStore } from '@/stores/superAdmin'
import { useNotificationStore } from '@/stores/notifications'

const route = useRoute()
const superAdminStore = useSuperAdminStore()
const notificationStore = useNotificationStore()

const showBanner = computed(() =>
  superAdminStore.isImpersonating && !route.path.startsWith('/super')
)

const org = computed(() => superAdminStore.viewingOrg)
const isSuspended = computed(() => org.value?.suspended === true)

const suspendDialog = ref(false)
const suspending = ref(false)

async function handleSuspend(): Promise<void> {
  if (!org.value) return
  suspending.value = true
  try {
    await superAdminStore.suspendOrg(org.value.id)
    notificationStore.showToast('success', 'Organization suspended')
  } catch {
    notificationStore.showToast('error', 'Failed to suspend organization')
  } finally {
    suspending.value = false
    suspendDialog.value = false
  }
}

async function handleUnsuspend(): Promise<void> {
  if (!org.value) return
  try {
    await superAdminStore.unsuspendOrg(org.value.id)
    notificationStore.showToast('success', 'Organization unsuspended')
  } catch {
    notificationStore.showToast('error', 'Failed to unsuspend organization')
  }
}
</script>

<template>
  <div v-if="showBanner" class="super-admin-banner">
    <div class="super-admin-banner__content">
      <v-icon icon="mdi-shield-account" class="mr-2" size="small" />
      <span class="super-admin-banner__label">Super Admin Mode</span>
      <span class="super-admin-banner__separator mx-2">—</span>
      <span class="super-admin-banner__org">Viewing: <strong>{{ org?.name }}</strong></span>
      <v-chip
        v-if="isSuspended"
        color="error"
        size="x-small"
        class="ml-2"
        label
      >
        Suspended
      </v-chip>
    </div>

    <div class="super-admin-banner__actions">
      <v-btn
        v-if="!isSuspended"
        size="small"
        variant="outlined"
        color="white"
        class="mr-2"
        @click="suspendDialog = true"
      >
        Suspend Org
      </v-btn>
      <v-btn
        v-else
        size="small"
        variant="outlined"
        color="white"
        class="mr-2"
        @click="handleUnsuspend"
      >
        Unsuspend Org
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        color="white"
        prepend-icon="mdi-arrow-left"
        @click="superAdminStore.exitOrg()"
      >
        Exit to Admin
      </v-btn>
    </div>

    <!-- Suspend confirmation dialog -->
    <v-dialog v-model="suspendDialog" max-width="400">
      <v-card>
        <v-card-title>Suspend Organization?</v-card-title>
        <v-card-text>
          This will mark <strong>{{ org?.name }}</strong> as suspended.
          Their data is preserved and this can be reversed.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="suspendDialog = false">Cancel</v-btn>
          <v-btn
            color="error"
            variant="flat"
            :loading="suspending"
            @click="handleSuspend"
          >
            Suspend
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.super-admin-banner {
  background-color: #7b1fa2;
  color: white;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  position: sticky;
  top: 0;
  z-index: 1000;
}

.super-admin-banner__content {
  display: flex;
  align-items: center;
}

.super-admin-banner__label {
  font-weight: 600;
}

.super-admin-banner__actions {
  display: flex;
  align-items: center;
}
</style>
