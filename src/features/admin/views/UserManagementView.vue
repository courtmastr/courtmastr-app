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
const selectedStatus = ref<'all' | 'active' | 'inactive'>('all');

const showEditDialog = ref(false);
const showStatusDialog = ref(false);
const statusDialogTarget = ref<User | null>(null);
const editForm = ref<{ id: string; displayName: string; email: string; phone: string }>({
  id: '',
  displayName: '',
  email: '',
  phone: '',
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
  { title: 'Status', key: 'status' },
  { title: 'Created', key: 'createdAt' },
  { title: 'Last Active', key: 'lastLoginAt' },
  { title: 'Actions', key: 'actions', sortable: false },
];

const hasActiveFilters = computed(() =>
  Boolean(searchQuery.value.trim()) ||
  selectedRole.value !== 'all' ||
  selectedStatus.value !== 'all'
);

const filteredUsers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return userStore.users.filter((user) => {
    const matchesSearch = !query ||
      user.displayName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query);

    const matchesRole = selectedRole.value === 'all' || user.role === selectedRole.value;

    const userStatus = user.isActive === false ? 'inactive' : 'active';
    const matchesStatus = selectedStatus.value === 'all' || userStatus === selectedStatus.value;

    return matchesSearch && matchesRole && matchesStatus;
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
    phone: user.phone || '',
  };
  showEditDialog.value = true;
}

async function saveUserProfile(): Promise<void> {
  try {
    await userStore.updateUserProfile(editForm.value.id, {
      displayName: editForm.value.displayName.trim(),
      email: editForm.value.email.trim(),
      phone: editForm.value.phone.trim(),
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
      :status="selectedStatus"
      :enable-category="true"
      :enable-status="true"
      :enable-court="false"
      :category-options="[{ title: 'All Roles', value: 'all' }, ...roleOptions]"
      :status-options="[
        { title: 'All Statuses', value: 'all' },
        { title: 'Active', value: 'active' },
        { title: 'Inactive', value: 'inactive' }
      ]"
      search-label="Search"
      search-placeholder="Search by name or email"
      :has-active-filters="hasActiveFilters"
      @update:search="searchQuery = $event"
      @update:category="selectedRole = ($event || 'all') as UserRole | 'all'"
      @update:status="selectedStatus = ($event || 'all') as 'active' | 'inactive' | 'all'"
      @clear="clearFilters"
    />

    <v-card>
      <v-data-table
        :headers="tableHeaders"
        :items="filteredUsers"
        :loading="userStore.loading"
        item-key="id"
      >
        <template #item.role="{ item }">
          <v-select
            :model-value="item.role"
            :items="roleOptions"
            density="compact"
            hide-details
            variant="outlined"
            @update:model-value="(value) => handleRoleChange(item, value as UserRole)"
          />
        </template>

        <template #item.status="{ item }">
          <v-chip
            :color="item.isActive === false ? 'error' : 'success'"
            size="small"
            label
          >
            {{ item.isActive === false ? 'Inactive' : 'Active' }}
          </v-chip>
        </template>

        <template #item.createdAt="{ item }">
          {{ formatDate(item.createdAt) }}
        </template>

        <template #item.lastLoginAt="{ item }">
          {{ formatDate(item.lastLoginAt) }}
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-pencil"
              @click="openEditDialog(item)"
            >
              Edit
            </v-btn>
            <v-btn
              size="small"
              :color="item.isActive === false ? 'success' : 'error'"
              variant="outlined"
              @click="requestStatusChange(item)"
            >
              {{ item.isActive === false ? 'Reactivate' : 'Deactivate' }}
            </v-btn>
          </div>
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
