<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useOrganizationsStore } from '@/stores/organizations';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/users';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import { useNotificationStore } from '@/stores/notifications';
import type { Organization, OrganizationMember } from '@/types';

const orgStore = useOrganizationsStore();
const authStore = useAuthStore();
const userStore = useUserStore();
const notificationStore = useNotificationStore();

const tab = ref('profile');
const org = ref<Organization | null>(null);
const members = ref<OrganizationMember[]>([]);

const showAddMemberDialog = ref(false);
const newMemberUserId = ref<string | null>(null);
const newMemberRole = ref('organizer');
const addingMember = ref(false);

const enrichedMembers = computed(() => {
  return members.value.map(m => {
    const u = userStore.users.find(user => user.id === m.uid);
    return {
      ...m,
      displayName: u?.displayName || 'Unknown User',
      email: u?.email || 'No email',
    }
  });
});

const currentUserIsAdmin = computed(() => {
  const currentUserId = authStore.currentUser?.id;
  const member = members.value.find(m => m.uid === currentUserId);
  return member?.role === 'admin';
});

const availableUsers = computed(() => {
  const memberIds = new Set(members.value.map(m => m.uid));
  return userStore.users
    .filter(u => !memberIds.has(u.id))
    .map(u => ({ title: `${u.displayName} (${u.email})`, value: u.id }));
});

// Form fields (profile tab) — slug is display-only, not editable; changing slug requires admin action
const form = ref({
  name: '',
  contactEmail: '',
  timezone: '',
  about: '',
  website: '',
});

const { execute, loading } = useAsyncOperation();

function loadOrg() {
  return execute(async () => {
    const activeOrgId = authStore.currentUser?.activeOrgId;
    if (!activeOrgId) return;
    org.value = await orgStore.fetchOrgById(activeOrgId);
    if (org.value) {
      form.value = {
        name: org.value.name,
        contactEmail: org.value.contactEmail ?? '',
        timezone: org.value.timezone ?? '',
        about: org.value.about ?? '',
        website: org.value.website ?? '',
      };
      await Promise.all([
        orgStore.fetchOrgTournaments(activeOrgId),
        userStore.fetchUsers(),
      ]);
      members.value = await orgStore.fetchOrgMembers(activeOrgId);
    }
  });
}

const { execute: executeSave, loading: saving } = useAsyncOperation();

function saveProfile() {
  return executeSave(async () => {
    if (!org.value) return;
    await orgStore.updateOrg(org.value.id, {
      name: form.value.name,
      contactEmail: form.value.contactEmail || null,
      timezone: form.value.timezone || null,
      about: form.value.about || null,
      website: form.value.website || null,
    });
    notificationStore.showToast('success', 'Organization profile saved');
  });
}

async function handleAddMember() {
  if (!newMemberUserId.value || !org.value) return;
  addingMember.value = true;
  try {
    await orgStore.addOrgMember(org.value.id, newMemberUserId.value, newMemberRole.value);
    notificationStore.showToast('success', 'Member added successfully');
    showAddMemberDialog.value = false;
    newMemberUserId.value = null;
    newMemberRole.value = 'organizer';
    members.value = await orgStore.fetchOrgMembers(org.value.id);
  } catch(e: any) {
    notificationStore.showToast('error', e.message || 'Failed to add member');
  } finally {
    addingMember.value = false;
  }
}

const statusColor = (status: string): string => {
  const map: Record<string, string> = {
    active: 'success',
    registration: 'primary',
    completed: 'default',
    draft: 'default',
  };
  return map[status] ?? 'default';
};

onMounted(loadOrg);
</script>

<template>
  <v-container v-if="loading" class="d-flex justify-center pa-8">
    <v-progress-circular indeterminate color="primary" />
  </v-container>

  <v-container v-else-if="!org" class="pa-8 text-center">
    <v-icon size="48" color="grey-lighten-1" class="mb-4">mdi-office-building-off-outline</v-icon>
    <p class="text-body-1 text-medium-emphasis">
      {{ authStore.currentUser?.activeOrgId ? 'Organization not found.' : 'No organization linked to your account. Ask an admin to add you to an org.' }}
    </p>
  </v-container>

  <template v-else>
    <!-- Dark sports-scoreboard header -->
    <div style="background: #0F172A; padding: 24px 24px 0;">
      <div class="d-flex align-center ga-4 mb-4">
        <div
          style="width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#1D4ED8,#D97706);
                 display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:white;flex-shrink:0;"
        >
          {{ org.name.slice(0, 2).toUpperCase() }}
        </div>
        <div>
          <div style="font-size:20px;font-weight:800;color:white;">{{ org.name }}</div>
          <div style="font-size:12px;color:#64748b;">{{ org.slug ? `courtmastr.com/${org.slug}` : 'No slug set' }}</div>
        </div>
      </div>

      <v-tabs v-model="tab" color="white" bg-color="transparent" class="text-white">
        <v-tab value="profile">Profile</v-tab>
        <v-tab value="tournaments">Tournaments</v-tab>
        <v-tab value="members">Members</v-tab>
      </v-tabs>
    </div>

    <v-window v-model="tab" class="pa-4">
      <!-- Profile tab -->
      <v-window-item value="profile">
        <v-card class="mb-4">
          <v-card-title class="text-body-1 font-weight-bold pa-4 pb-2">Organization Profile</v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.name" label="Organization Name" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  :model-value="org?.slug"
                  label="URL Slug"
                  :prefix="`courtmastr.com/`"
                  disabled
                  hint="Slug cannot be changed after creation"
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.contactEmail" label="Contact Email" type="email" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.website" label="Website URL" />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.timezone"
                  label="Timezone"
                  :items="['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu']"
                  clearable
                />
              </v-col>
              <v-col cols="12">
                <v-textarea v-model="form.about" label="About / Description" rows="3" />
              </v-col>
            </v-row>
          </v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-spacer />
            <v-btn color="primary" :loading="saving" @click="saveProfile">Save Profile</v-btn>
          </v-card-actions>
        </v-card>
      </v-window-item>

      <!-- Tournaments tab -->
      <v-window-item value="tournaments">
        <v-card v-if="orgStore.orgTournaments.length === 0" class="text-center pa-8">
          <p class="text-medium-emphasis">No tournaments linked to this organization yet.</p>
        </v-card>
        <div v-else>
          <div
            v-for="t in orgStore.orgTournaments"
            :key="t.id"
            style="background:white;border-left:3px solid #1D4ED8;border-radius:0 8px 8px 0;
                   padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;
                   justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.05);"
          >
            <div>
              <div style="font-size:14px;font-weight:600;color:#0F172A;">{{ t.name }}</div>
              <div style="font-size:12px;color:#64748b;">{{ t.sport ?? '—' }} · {{ t.status }}</div>
            </div>
            <div class="d-flex align-center ga-2">
              <v-chip :color="statusColor(t.status)" size="small" label>{{ t.status.toUpperCase() }}</v-chip>
              <v-btn
                variant="text"
                size="small"
                icon="mdi-arrow-right"
                :to="`/tournaments/${t.id}`"
              />
            </div>
          </div>
        </div>
      </v-window-item>

      <v-window-item value="members">
        <div class="d-flex align-center justify-space-between mb-4 mt-2 px-1">
          <h3 class="text-h6 mb-0">Organization Members</h3>
          <v-btn
            v-if="currentUserIsAdmin"
            color="primary"
            prepend-icon="mdi-account-plus"
            @click="showAddMemberDialog = true"
          >
            Add Member
          </v-btn>
        </div>

        <v-card v-if="enrichedMembers.length === 0" class="text-center pa-8">
          <p class="text-medium-emphasis">No members found.</p>
        </v-card>
        <div v-else>
          <div
            v-for="m in enrichedMembers"
            :key="m.uid"
            style="background:white;border:1px solid #e2e8f0;border-radius:8px;
                   padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;
                   justify-content:space-between;"
          >
            <div>
              <div style="font-size:14px;font-weight:600;color:#0F172A;">{{ m.displayName }}</div>
              <div style="font-size:12px;color:#64748b;">
                {{ m.email }} &bull; Joined {{ m.joinedAt?.toLocaleDateString?.() ?? '—' }}
              </div>
            </div>
            <v-chip size="small" :color="m.role === 'admin' ? 'primary' : 'default'" label>{{ m.role }}</v-chip>
          </div>
        </div>

        <v-dialog v-model="showAddMemberDialog" max-width="500">
          <v-card>
            <v-card-title>Add Organization Member</v-card-title>
            <v-card-text>
              <v-autocomplete
                v-model="newMemberUserId"
                :items="availableUsers"
                label="Search User"
                placeholder="Type name or email"
                item-title="title"
                item-value="value"
                variant="outlined"
                class="mb-4 mt-2"
              />
              <v-select
                v-model="newMemberRole"
                :items="['organizer', 'admin']"
                label="Role"
                variant="outlined"
              />
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="showAddMemberDialog = false">Cancel</v-btn>
              <v-btn color="primary" :loading="addingMember" :disabled="!newMemberUserId" @click="handleAddMember">
                Add Member
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-window-item>
    </v-window>
  </template>
</template>
