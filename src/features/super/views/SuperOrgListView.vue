<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSuperAdminStore } from '@/stores/superAdmin'
import { useOrganizationsStore } from '@/stores/organizations'
import type { Organization } from '@/types'

const superAdminStore = useSuperAdminStore()
const orgStore = useOrganizationsStore()
const router = useRouter()

const search = ref('')
const statusFilter = ref<'all' | 'active' | 'suspended'>('all')
const enteringOrgId = ref<string | null>(null)
const viewingProfileOrgId = ref<string | null>(null)

const filteredOrgs = computed(() => {
  return superAdminStore.allOrgs.filter((org) => {
    const matchesSearch = org.name.toLowerCase().includes(search.value.toLowerCase())
    const matchesStatus =
      statusFilter.value === 'all' ||
      (statusFilter.value === 'suspended' && org.suspended) ||
      (statusFilter.value === 'active' && !org.suspended)
    return matchesSearch && matchesStatus
  })
})

function getStatusColor(org: Organization): string {
  return org.suspended ? 'error' : 'success'
}

function getStatusLabel(org: Organization): string {
  return org.suspended ? 'Suspended' : 'Active'
}

async function handleEnter(org: Organization): Promise<void> {
  enteringOrgId.value = org.id
  try {
    await superAdminStore.enterOrg(org.id)
  } finally {
    enteringOrgId.value = null
  }
}

async function handleViewProfile(org: Organization): Promise<void> {
  viewingProfileOrgId.value = org.id
  try {
    await orgStore.fetchOrgById(org.id)
    router.push('/org/profile')
  } finally {
    viewingProfileOrgId.value = null
  }
}

onMounted(() => {
  superAdminStore.fetchAllOrgs()
})
</script>

<template>
  <v-container
    fluid
    class="pa-6"
  >
    <div class="d-flex align-center mb-6">
      <v-btn
        icon="mdi-arrow-left"
        variant="text"
        class="mr-2"
        to="/super/dashboard"
      />
      <v-icon
        icon="mdi-domain"
        color="purple"
        class="mr-3"
        size="28"
      />
      <h1 class="text-h5 font-weight-bold">
        All Organizations
      </h1>
      <v-spacer />
      <v-chip
        color="purple"
        variant="tonal"
        size="small"
      >
        {{ filteredOrgs.length }} orgs
      </v-chip>
    </div>

    <!-- Filters -->
    <v-row class="mb-4">
      <v-col
        cols="12"
        sm="8"
      >
        <v-text-field
          v-model="search"
          placeholder="Search organizations..."
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          density="compact"
          hide-details
          clearable
        />
      </v-col>
      <v-col
        cols="12"
        sm="4"
      >
        <v-select
          v-model="statusFilter"
          :items="[
            { title: 'All statuses', value: 'all' },
            { title: 'Active', value: 'active' },
            { title: 'Suspended', value: 'suspended' },
          ]"
          variant="outlined"
          density="compact"
          hide-details
        />
      </v-col>
    </v-row>

    <!-- Loading -->
    <div
      v-if="superAdminStore.loading"
      class="text-center py-8"
    >
      <v-progress-circular
        indeterminate
        color="purple"
      />
    </div>

    <!-- Table -->
    <v-card
      v-else
      rounded="lg"
    >
      <v-table>
        <thead>
          <tr>
            <th>Organization</th>
            <th>Status</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="org in filteredOrgs"
            :key="org.id"
          >
            <td>
              <div class="font-weight-medium">
                {{ org.name }}
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ org.slug }}
              </div>
            </td>
            <td>
              <v-chip
                :color="getStatusColor(org)"
                size="small"
                label
              >
                {{ getStatusLabel(org) }}
              </v-chip>
            </td>
            <td class="text-medium-emphasis text-caption">
              {{ org.createdAt instanceof Date ? org.createdAt.toLocaleDateString() : '—' }}
            </td>
            <td>
              <div class="d-flex ga-2">
                <v-btn
                  size="small"
                  variant="tonal"
                  color="purple"
                  :loading="viewingProfileOrgId === org.id"
                  prepend-icon="mdi-pencil-outline"
                  @click="handleViewProfile(org)"
                >
                  Profile
                </v-btn>
                <v-btn
                  size="small"
                  variant="flat"
                  color="purple"
                  :loading="enteringOrgId === org.id"
                  append-icon="mdi-arrow-right"
                  @click="handleEnter(org)"
                >
                  Enter
                </v-btn>
              </div>
            </td>
          </tr>
          <tr v-if="filteredOrgs.length === 0">
            <td
              colspan="4"
              class="text-center text-medium-emphasis py-6"
            >
              No organizations found
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>
  </v-container>
</template>
