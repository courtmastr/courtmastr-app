<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/users';
import { useNotificationStore } from '@/stores/notifications';
import FilterBar from '@/components/common/FilterBar.vue';

import type { User, UserRole } from '@/types';

const router = useRouter();
const authStore = useAuthStore();
const userStore = useUserStore();
const notificationStore = useNotificationStore();

const searchQuery = ref('');
const selectedRole = ref<'all' | UserRole>('all');


const showEditDialog = ref(false);
const showStatusDialog = ref(false);
const statusDialogTarget = ref<User | null>(null);
  const editForm = ref<{ id: string; displayName: string; email: string }>({
    id: '',
    displayName: '',
    email: '',
  });

const roleOptions = [
  { title: 'Admin', value: 'admin' },
  { title: 'Organizer', value: 'organizer' },
  { title: 'Scorekeeper', value: 'scorekeeper' },
  { title: 'Player', value: 'player' },
  { title: 'Viewer', value: 'viewer' },
];

const tableHeaders = [
  { title: 'Name', key: 'displayName' },
  { title: 'Email', key: 'email' },
  { title: 'Role', key: 'role' },
  { title: 'Created', key: 'createdAt' },
  { title: 'Actions', key: 'actions', sortable: false },
];

const hasActiveFilters = computed(() =>
  Boolean(searchQuery.value.trim()) ||
  selectedRole.value !== 'all'
);

const filteredUsers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return userStore.users.filter((user) => {
    const matchesSearch = !query ||
      user.displayName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query);

    const matchesRole = selectedRole.value === 'all' || user.role === selectedRole.value;

    return matchesSearch && matchesRole;
  });
});

function clearFilters() {
  searchQuery.value = '';
  selectedRole.value = 'all';
  selectedStatus.value = 'all';
}

onMounted(() => {
  userStore.subscribeUsers();
});

onUnmounted(() => {
  userStore.unsubscribeAll();
});

function formatDate(value?: Date): string {
  if (!value) return 'Never';
  return value.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function handleRoleChange(user: User, newRole: UserRole): Promise<void> {
  if (newRole === user.role) return;

  if (user.id === authStore.currentUser?.id && newRole !== 'admin') {
    notificationStore.showToast('error', 'You cannot remove your own admin role');
    return;
  }

  try {
    await userStore.updateUserRole(user.id, newRole);
    notificationStore.showToast('success', 'User role updated');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update user role');
  }
}

function openEditDialog(user: User): void {
  editForm.value = {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
  };
  showEditDialog.value = true;
}

async function saveUserProfile(): Promise<void> {
  try {
    await userStore.updateUserProfile(editForm.value.id, {
      displayName: editForm.value.displayName.trim(),
      email: editForm.value.email.trim(),
    });
    showEditDialog.value = false;
    notificationStore.showToast('success', 'User profile updated');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update user profile');
  }
}

function requestStatusChange(user: User): void {
  if (user.id === authStore.currentUser?.id) {
    notificationStore.showToast('error', 'You cannot deactivate your own account');
    return;
  }

  statusDialogTarget.value = user;
  showStatusDialog.value = true;
}

async function confirmStatusChange(): Promise<void> {
  if (!statusDialogTarget.value || !authStore.currentUser?.id) {
    showStatusDialog.value = false;
    return;
  }

  const user = statusDialogTarget.value;
  const newStatus = user.isActive === false;

  try {
    await userStore.setUserActive(user.id, newStatus, authStore.currentUser.id);
    notificationStore.showToast('success', newStatus ? 'User reactivated' : 'User deactivated');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to update user status');
  } finally {
    showStatusDialog.value = false;
    statusDialogTarget.value = null;
  }
}
</script>

<template>
  <v-container fluid>
    <div class="d-flex align-center justify-space-between mb-4">
      <div>
        <h1 class="text-h4 font-weight-bold">
          User Management
        </h1>
        <div class="text-body-2 text-grey">
          Manage user access, roles, and account status
        </div>
      </div>
      <v-btn
        variant="text"
        prepend-icon="mdi-arrow-left"
        @click="router.push('/tournaments')"
      >
        Back to Dashboard
      </v-btn>
    </div>

    <filter-bar
      :search="searchQuery"
      :category="selectedRole"
      :enable-category="true"
      :enable-status="false"
      :enable-court="false"
      :category-options="[{ title: 'All Roles', value: 'all' }, ...roleOptions]"
      search-label="Search"
      search-placeholder="Search by name or email"
      :has-active-filters="hasActiveFilters"
      @update:search="searchQuery = $event"
      @update:category="selectedRole = ($event || 'all') as UserRole | 'all'"
      @clear="clearFilters"
    />

    <v-card>
      <v-data-table
        :items="filteredUsers"
        :headers="[
          { title: 'User', key: 'user', sortable: true },
          { title: 'Role', key: 'role', sortable: true },
          { title: 'Actions', key: 'actions', sortable: false },
        ]"
        :loading="userStore.loading"
        class="elevation-1"
        show-expand
        item-value="id"
      >
        <template #item.user="{ item }">
          <div class="d-flex flex-column py-1">
            <span class="font-weight-medium">{{ item.displayName }}</span>
            <span class="text-caption text-grey">{{ item.email }}</span>
          </div>
        </template>

        <template #item.role="{ item }">
          <v-select
            :model-value="item.role"
            :items="roleOptions"
            density="compact"
            hide-details
            variant="outlined"
            style="max-width: 140px;"
            @update:model-value="(value) => handleRoleChange(item, value as UserRole)"
          />
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex ga-1 justify-end">
            <v-btn
              icon="mdi-pencil"
              size="small"
              variant="text"
              color="primary"
              title="Edit"
              @click="openEditDialog(item)"
            />
            <v-btn
              :icon="item.isActive === false ? 'mdi-account-check' : 'mdi-account-off'"
              size="small"
              :color="item.isActive === false ? 'success' : 'error'"
              variant="text"
              :title="item.isActive === false ? 'Reactivate' : 'Deactivate'"
              @click="requestStatusChange(item)"
            />
          </div>
        </template>

        <template #expanded-row="{ columns, item }">
          <tr>
            <td :colspan="columns.length" class="bg-grey-lighten-5 pa-4">
              <div class="d-flex flex-wrap gap-4 text-body-2">
                <div><strong>Email:</strong> {{ item.email }}</div>
                <div><strong>Created:</strong> {{ formatDate(item.createdAt) }}</div>
                <div><strong>Last Active:</strong> {{ formatDate(item.lastLoginAt) }}</div>
              </div>
            </td>
          </tr>
        </template>
      </v-data-table>
    </v-card>

    <v-dialog
      v-model="showEditDialog"
      max-width="520"
    >
      <v-card>
        <v-card-title>Edit User Profile</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="editForm.displayName"
            label="Display Name"
            class="mb-3"
          />
          <v-text-field
            v-model="editForm.email"
            label="Email"
            class="mb-3"
          />
          <v-text-field
            v-model="editForm.phone"
            label="Phone (optional)"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showEditDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="saveUserProfile"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="showStatusDialog"
      max-width="420"
    >
      <v-card>
        <v-card-title>
          {{ statusDialogTarget?.isActive === false ? 'Reactivate user?' : 'Deactivate user?' }}
        </v-card-title>
        <v-card-text>
          {{ statusDialogTarget?.displayName }} ({{ statusDialogTarget?.email }})
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="showStatusDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            :color="statusDialogTarget?.isActive === false ? 'success' : 'error'"
            @click="confirmStatusChange"
          >
            Confirm
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
