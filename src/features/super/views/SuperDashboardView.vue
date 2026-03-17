<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useSuperAdminStore } from '@/stores/superAdmin'

const superAdminStore = useSuperAdminStore()

const stats = computed(() => superAdminStore.platformStats)
const recentOrgs = computed(() =>
  [...superAdminStore.allOrgs]
    .sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
      return bTime - aTime
    })
    .slice(0, 5)
)

const statTiles = computed(() => [
  { label: 'Total Orgs', value: stats.value?.totalOrgs ?? '—', icon: 'mdi-domain' },
  { label: 'Active Tournaments', value: stats.value?.activeTournaments ?? '—', icon: 'mdi-trophy' },
  { label: 'Total Players', value: stats.value?.totalPlayers ?? '—', icon: 'mdi-account-group' },
  { label: 'New Orgs (30d)', value: stats.value?.newOrgsLast30Days ?? '—', icon: 'mdi-domain-plus' },
])

onMounted(async () => {
  await Promise.all([
    superAdminStore.fetchPlatformStats(),
    superAdminStore.fetchAllOrgs(),
  ])
})
</script>

<template>
  <v-container fluid class="pa-6">
    <div class="d-flex align-center mb-6">
      <v-icon icon="mdi-shield-crown" color="purple" class="mr-3" size="28" />
      <h1 class="text-h5 font-weight-bold">Platform Admin</h1>
    </div>

    <!-- Stat tiles -->
    <v-row class="mb-6">
      <v-col
        v-for="tile in statTiles"
        :key="tile.label"
        cols="12"
        sm="6"
        lg="3"
      >
        <v-card rounded="lg" variant="tonal">
          <v-card-text class="d-flex align-center pa-5">
            <v-icon :icon="tile.icon" color="purple" size="36" class="mr-4" />
            <div>
              <div class="text-h4 font-weight-bold">{{ tile.value }}</div>
              <div class="text-caption text-medium-emphasis">{{ tile.label }}</div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <!-- Recent orgs -->
      <v-col cols="12" md="6">
        <v-card rounded="lg">
          <v-card-title class="text-subtitle-1 font-weight-semibold pa-4 pb-2">
            Recent Organizations
          </v-card-title>
          <v-list density="compact">
            <v-list-item
              v-for="org in recentOrgs"
              :key="org.id"
              :title="org.name"
              :subtitle="org.createdAt instanceof Date ? org.createdAt.toLocaleDateString() : ''"
            >
              <template #append>
                <v-btn
                  size="small"
                  variant="text"
                  color="purple"
                  @click="superAdminStore.enterOrg(org.id)"
                >
                  Enter →
                </v-btn>
              </template>
            </v-list-item>
            <v-list-item v-if="recentOrgs.length === 0">
              <v-list-item-title class="text-medium-emphasis">No organizations yet</v-list-item-title>
            </v-list-item>
          </v-list>
          <v-card-actions>
            <v-btn variant="text" color="purple" to="/super/orgs" size="small">
              View all orgs →
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- Quick actions -->
      <v-col cols="12" md="6">
        <v-card rounded="lg">
          <v-card-title class="text-subtitle-1 font-weight-semibold pa-4 pb-2">
            Quick Actions
          </v-card-title>
          <v-card-text>
            <v-btn
              block
              variant="outlined"
              color="purple"
              prepend-icon="mdi-domain"
              to="/super/orgs"
              class="mb-3"
            >
              Browse All Organizations
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
