<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useOrganizationsStore } from '@/stores/organizations';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/users';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import { useNotificationStore } from '@/stores/notifications';
import type { Organization, OrganizationMember, OrgSponsor } from '@/types';
import { validateBrandingFile, uploadOrgLogo, uploadOrgBanner } from '@/services/orgBrandingStorage';

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
  city: '',
  foundedYear: null as number | null,
  instagram: '',
  facebook: '',
  youtube: '',
  twitter: '',
});

// Logo / banner upload
const logoFile = ref<File | null>(null);
const bannerFile = ref<File | null>(null);
const logoFileError = ref<string | null>(null);
const bannerFileError = ref<string | null>(null);

function onLogoFileChange(files: File[] | File | null) {
  const file = Array.isArray(files) ? files[0] : files;
  logoFileError.value = null;
  if (file) {
    const err = validateBrandingFile(file);
    if (err) { logoFileError.value = err; logoFile.value = null; }
    else logoFile.value = file;
  } else {
    logoFile.value = null;
  }
}

function onBannerFileChange(files: File[] | File | null) {
  const file = Array.isArray(files) ? files[0] : files;
  bannerFileError.value = null;
  if (file) {
    const err = validateBrandingFile(file);
    if (err) { bannerFileError.value = err; bannerFile.value = null; }
    else bannerFile.value = file;
  } else {
    bannerFile.value = null;
  }
}

const { execute: executeLogoUpload, loading: logoUploading } = useAsyncOperation();
const { execute: executeBannerUpload, loading: bannerUploading } = useAsyncOperation();

function uploadLogo() {
  return executeLogoUpload(async () => {
    if (!org.value || !logoFile.value) return;
    const { downloadUrl } = await uploadOrgLogo(org.value.id, logoFile.value);
    await orgStore.updateOrg(org.value.id, { logoUrl: downloadUrl });
    org.value = { ...org.value, logoUrl: downloadUrl };
    logoFile.value = null;
    notificationStore.showToast('success', 'Logo updated');
  });
}

function uploadBanner() {
  return executeBannerUpload(async () => {
    if (!org.value || !bannerFile.value) return;
    const { downloadUrl } = await uploadOrgBanner(org.value.id, bannerFile.value);
    await orgStore.updateOrg(org.value.id, { bannerUrl: downloadUrl });
    org.value = { ...org.value, bannerUrl: downloadUrl };
    bannerFile.value = null;
    notificationStore.showToast('success', 'Banner updated');
  });
}

async function removeLogo() {
  if (!org.value) return;
  await orgStore.updateOrg(org.value.id, { logoUrl: null });
  org.value = { ...org.value, logoUrl: null };
  notificationStore.showToast('success', 'Logo removed');
}

async function removeBanner() {
  if (!org.value) return;
  await orgStore.updateOrg(org.value.id, { bannerUrl: null });
  org.value = { ...org.value, bannerUrl: null };
  notificationStore.showToast('success', 'Banner removed');
}

// Sponsor management (sponsors tab)
const sponsorDraft = ref({ name: '', website: '' });
const sponsorFile = ref<File | null>(null);
const sponsorFileError = ref<string | null>(null);
const sponsorList = computed<OrgSponsor[]>(() => org.value?.sponsors ?? []);
const { execute: executeSponsorAdd, loading: sponsorAdding } = useAsyncOperation();
const { execute: executeSponsorRemove, loading: sponsorRemoving } = useAsyncOperation();

function onSponsorFileChange(files: File[] | File | null) {
  const file = Array.isArray(files) ? files[0] : files;
  sponsorFileError.value = null;
  if (file) {
    const err = validateBrandingFile(file);
    if (err) {
      sponsorFileError.value = err;
      sponsorFile.value = null;
    } else {
      sponsorFile.value = file;
    }
  } else {
    sponsorFile.value = null;
  }
}

function addSponsor() {
  return executeSponsorAdd(async () => {
    if (!org.value || !sponsorFile.value || !sponsorDraft.value.name) return;
    await orgStore.addOrgSponsor(
      org.value.id,
      { name: sponsorDraft.value.name, website: sponsorDraft.value.website || undefined },
      sponsorFile.value
    );
    // Re-fetch so local org ref is updated
    org.value = await orgStore.fetchOrgById(org.value.id);
    sponsorDraft.value = { name: '', website: '' };
    sponsorFile.value = null;
    notificationStore.showToast('success', 'Sponsor added');
  });
}

function removeSponsor(sponsorId: string) {
  return executeSponsorRemove(async () => {
    if (!org.value) return;
    await orgStore.removeOrgSponsor(org.value.id, sponsorId);
    org.value = await orgStore.fetchOrgById(org.value.id);
    notificationStore.showToast('success', 'Sponsor removed');
  });
}

const { execute, loading } = useAsyncOperation();

function loadOrg() {
  return execute(async () => {
    const activeOrgId = authStore.currentUser?.activeOrgId ?? orgStore.currentOrg?.id;
    if (!activeOrgId) return;
    org.value = await orgStore.fetchOrgById(activeOrgId);
    if (org.value) {
      form.value = {
        name: org.value.name,
        contactEmail: org.value.contactEmail ?? '',
        timezone: org.value.timezone ?? '',
        about: org.value.about ?? '',
        website: org.value.website ?? '',
        city: org.value.city ?? '',
        foundedYear: org.value.foundedYear ?? null,
        instagram: org.value.socialLinks?.instagram ?? '',
        facebook: org.value.socialLinks?.facebook ?? '',
        youtube: org.value.socialLinks?.youtube ?? '',
        twitter: org.value.socialLinks?.twitter ?? '',
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
      city: form.value.city || null,
      foundedYear: form.value.foundedYear || null,
      socialLinks: {
        instagram: form.value.instagram || null,
        facebook: form.value.facebook || null,
        youtube: form.value.youtube || null,
        twitter: form.value.twitter || null,
      },
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
  <v-container
    v-if="loading"
    class="d-flex justify-center pa-8"
  >
    <v-progress-circular
      indeterminate
      color="primary"
    />
  </v-container>

  <v-container
    v-else-if="!org"
    class="pa-8 text-center"
  >
    <v-icon
      size="48"
      color="grey-lighten-1"
      class="mb-4"
    >
      mdi-office-building-off-outline
    </v-icon>
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
          <div style="font-size:20px;font-weight:800;color:white;">
            {{ org.name }}
          </div>
          <div style="font-size:12px;color:#64748b;">
            {{ org.slug ? `courtmastr.com/${org.slug}` : 'No slug set' }}
          </div>
        </div>
      </div>

      <v-tabs
        v-model="tab"
        color="white"
        bg-color="transparent"
        class="text-white"
      >
        <v-tab value="profile">
          Profile
        </v-tab>
        <v-tab value="tournaments">
          Tournaments
        </v-tab>
        <v-tab value="members">
          Members
        </v-tab>
        <v-tab value="sponsors">
          Sponsors
        </v-tab>
      </v-tabs>
    </div>

    <v-window
      v-model="tab"
      class="pa-4"
    >
      <!-- Profile tab -->
      <v-window-item value="profile">
        <!-- Logo & Banner -->
        <v-card class="mb-4">
          <v-card-title class="text-body-1 font-weight-bold pa-4 pb-2">
            Logo &amp; Banner
          </v-card-title>
          <v-card-text>
            <v-row>
              <!-- Logo -->
              <v-col
                cols="12"
                md="6"
              >
                <p class="text-caption text-medium-emphasis mb-2">
                  Logo — shown in the hero circle (square image, min 200×200px, max 2 MB)
                </p>
                <div
                  v-if="org.logoUrl"
                  class="d-flex align-center ga-3 mb-3"
                >
                  <img
                    :src="org.logoUrl"
                    alt="Current logo"
                    style="width:64px;height:64px;object-fit:cover;border-radius:12px;border:1px solid rgba(0,0,0,0.1);"
                  >
                  <v-btn
                    size="small"
                    variant="tonal"
                    color="error"
                    prepend-icon="mdi-delete-outline"
                    @click="removeLogo"
                  >
                    Remove
                  </v-btn>
                </div>
                <v-file-input
                  label="Upload new logo"
                  accept="image/*"
                  prepend-icon=""
                  prepend-inner-icon="mdi-image-outline"
                  :error-messages="logoFileError ? [logoFileError] : []"
                  @update:model-value="onLogoFileChange"
                />
                <v-btn
                  v-if="logoFile"
                  color="primary"
                  size="small"
                  :loading="logoUploading"
                  class="mt-2"
                  @click="uploadLogo"
                >
                  Save Logo
                </v-btn>
              </v-col>

              <!-- Banner -->
              <v-col
                cols="12"
                md="6"
              >
                <p class="text-caption text-medium-emphasis mb-2">
                  Banner — shown behind the hero (wide image, min 1200×400px, max 2 MB)
                </p>
                <div
                  v-if="org.bannerUrl"
                  class="d-flex align-center ga-3 mb-3"
                >
                  <img
                    :src="org.bannerUrl"
                    alt="Current banner"
                    style="width:120px;height:40px;object-fit:cover;border-radius:8px;border:1px solid rgba(0,0,0,0.1);"
                  >
                  <v-btn
                    size="small"
                    variant="tonal"
                    color="error"
                    prepend-icon="mdi-delete-outline"
                    @click="removeBanner"
                  >
                    Remove
                  </v-btn>
                </div>
                <v-file-input
                  label="Upload new banner"
                  accept="image/*"
                  prepend-icon=""
                  prepend-inner-icon="mdi-panorama-outline"
                  :error-messages="bannerFileError ? [bannerFileError] : []"
                  @update:model-value="onBannerFileChange"
                />
                <v-btn
                  v-if="bannerFile"
                  color="primary"
                  size="small"
                  :loading="bannerUploading"
                  class="mt-2"
                  @click="uploadBanner"
                >
                  Save Banner
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="mb-4">
          <v-card-title class="text-body-1 font-weight-bold pa-4 pb-2">
            Organization Profile
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="form.name"
                  label="Organization Name"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  :model-value="org?.slug"
                  label="URL Slug"
                  :prefix="`courtmastr.com/`"
                  disabled
                  hint="Slug cannot be changed after creation"
                  persistent-hint
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="form.contactEmail"
                  label="Contact Email"
                  type="email"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="form.website"
                  label="Website URL"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-select
                  v-model="form.timezone"
                  label="Timezone"
                  :items="['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu']"
                  clearable
                />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="form.about"
                  label="About / Description"
                  rows="3"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="form.city"
                  label="City / Location"
                  placeholder="e.g. Chicago, IL"
                  hint="Shown as a chip on the public page"
                  persistent-hint
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model.number="form.foundedYear"
                  label="Founded Year"
                  type="number"
                  placeholder="e.g. 2018"
                  hint="Shows &quot;Est. YEAR&quot; and &quot;X Years Active&quot; stat on the public page"
                  persistent-hint
                />
              </v-col>
            </v-row>
          </v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-spacer />
            <v-btn
              color="primary"
              :loading="saving"
              @click="saveProfile"
            >
              Save Profile
            </v-btn>
          </v-card-actions>
        </v-card>

        <v-card class="mb-4">
          <v-card-title class="text-body-1 font-weight-bold pa-4 pb-2">
            Social Links
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="form.instagram"
                  label="Instagram"
                  prepend-inner-icon="mdi-instagram"
                  placeholder="handle or full URL"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="form.facebook"
                  label="Facebook"
                  prepend-inner-icon="mdi-facebook"
                  placeholder="handle or full URL"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="form.youtube"
                  label="YouTube"
                  prepend-inner-icon="mdi-youtube"
                  placeholder="handle or full URL"
                />
              </v-col>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="form.twitter"
                  label="X / Twitter"
                  prepend-inner-icon="mdi-twitter"
                  placeholder="handle or full URL"
                />
              </v-col>
            </v-row>
          </v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-spacer />
            <v-btn
              color="primary"
              :loading="saving"
              @click="saveProfile"
            >
              Save Profile
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-window-item>

      <!-- Tournaments tab -->
      <v-window-item value="tournaments">
        <v-card
          v-if="orgStore.orgTournaments.length === 0"
          class="text-center pa-8"
        >
          <p class="text-medium-emphasis">
            No tournaments linked to this organization yet.
          </p>
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
              <div style="font-size:14px;font-weight:600;color:#0F172A;">
                {{ t.name }}
              </div>
              <div style="font-size:12px;color:#64748b;">
                {{ t.sport ?? '—' }} · {{ t.status }}
              </div>
            </div>
            <div class="d-flex align-center ga-2">
              <v-chip
                :color="statusColor(t.status)"
                size="small"
                label
              >
                {{ t.status.toUpperCase() }}
              </v-chip>
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
          <h3 class="text-h6 mb-0">
            Organization Members
          </h3>
          <v-btn
            v-if="currentUserIsAdmin"
            color="primary"
            prepend-icon="mdi-account-plus"
            @click="showAddMemberDialog = true"
          >
            Add Member
          </v-btn>
        </div>

        <v-card
          v-if="enrichedMembers.length === 0"
          class="text-center pa-8"
        >
          <p class="text-medium-emphasis">
            No members found.
          </p>
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
              <div style="font-size:14px;font-weight:600;color:#0F172A;">
                {{ m.displayName }}
              </div>
              <div style="font-size:12px;color:#64748b;">
                {{ m.email }} &bull; Joined {{ m.joinedAt?.toLocaleDateString?.() ?? '—' }}
              </div>
            </div>
            <v-chip
              size="small"
              :color="m.role === 'admin' ? 'primary' : 'default'"
              label
            >
              {{ m.role }}
            </v-chip>
          </div>
        </div>

        <v-dialog
          v-model="showAddMemberDialog"
          max-width="500"
        >
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
              <v-btn
                variant="text"
                @click="showAddMemberDialog = false"
              >
                Cancel
              </v-btn>
              <v-btn
                color="primary"
                :loading="addingMember"
                :disabled="!newMemberUserId"
                @click="handleAddMember"
              >
                Add Member
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
      </v-window-item>

      <!-- Sponsors tab -->
      <v-window-item value="sponsors">
        <!-- Add sponsor form -->
        <v-card class="mb-4">
          <v-card-title class="text-body-1 font-weight-bold pa-4 pb-2">
            Add Sponsor
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col
                cols="12"
                md="5"
              >
                <v-text-field
                  v-model="sponsorDraft.name"
                  label="Sponsor Name *"
                  placeholder="e.g. Acme Sports"
                />
              </v-col>
              <v-col
                cols="12"
                md="4"
              >
                <v-text-field
                  v-model="sponsorDraft.website"
                  label="Website (optional)"
                  placeholder="https://..."
                />
              </v-col>
              <v-col
                cols="12"
                md="3"
              >
                <v-file-input
                  label="Logo *"
                  accept="image/*"
                  prepend-icon=""
                  prepend-inner-icon="mdi-image-outline"
                  :error-messages="sponsorFileError ? [sponsorFileError] : []"
                  hint="Image, max 2 MB"
                  persistent-hint
                  @update:model-value="onSponsorFileChange"
                />
              </v-col>
            </v-row>
          </v-card-text>
          <v-card-actions class="pa-4 pt-0">
            <v-spacer />
            <v-btn
              color="primary"
              :loading="sponsorAdding"
              :disabled="!sponsorDraft.name || !sponsorFile"
              prepend-icon="mdi-plus"
              @click="addSponsor"
            >
              Add Sponsor
            </v-btn>
          </v-card-actions>
        </v-card>

        <!-- Sponsor list -->
        <v-card>
          <v-card-title class="text-body-1 font-weight-bold pa-4 pb-2">
            Current Sponsors
            <v-chip
              size="small"
              class="ml-2"
            >
              {{ sponsorList.length }}
            </v-chip>
          </v-card-title>
          <v-card-text>
            <p
              v-if="!sponsorList.length"
              class="text-medium-emphasis text-body-2 py-4 text-center"
            >
              No sponsors yet. Add one above — they'll appear in an auto-scrolling carousel on your public page.
            </p>
            <div
              v-for="sponsor in [...sponsorList].sort((a, b) => a.displayOrder - b.displayOrder)"
              :key="sponsor.id"
              style="display:flex;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid rgba(0,0,0,0.06);"
            >
              <div
                style="width:80px;height:40px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;"
              >
                <img
                  :src="sponsor.logoUrl"
                  :alt="sponsor.name"
                  style="max-width:100%;max-height:100%;object-fit:contain;"
                >
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:14px;font-weight:600;">
                  {{ sponsor.name }}
                </div>
                <div
                  v-if="sponsor.website"
                  style="font-size:12px;color:#64748b;"
                >
                  {{ sponsor.website }}
                </div>
              </div>
              <v-btn
                icon="mdi-delete-outline"
                size="small"
                variant="text"
                color="error"
                :loading="sponsorRemoving"
                @click="removeSponsor(sponsor.id)"
              />
            </div>
          </v-card-text>
        </v-card>
      </v-window-item>
    </v-window>
  </template>
</template>
