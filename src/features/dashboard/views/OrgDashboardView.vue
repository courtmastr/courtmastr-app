<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useDashboardStore } from '@/stores/dashboard';
import { useTournamentStore } from '@/stores/tournaments';
import { useAuthStore } from '@/stores/auth';
import { useAsyncOperation } from '@/composables/useAsyncOperation';

const dashboardStore = useDashboardStore();
const tournamentStore = useTournamentStore();
const authStore = useAuthStore();

const { execute: load, loading } = useAsyncOperation(async () => {
  await Promise.all([
    dashboardStore.refresh(),
    tournamentStore.fetchTournaments(),
  ]);
});

const activeTournaments = computed(() =>
  tournamentStore.tournaments.filter((t) => t.status === 'active')
);

const upcomingTournaments = computed(() =>
  tournamentStore.tournaments.filter((t) =>
    t.status === 'registration' || t.status === 'draft'
  )
);

const greeting = computed((): string => {
  const name = authStore.currentUser?.displayName?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 17) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
});

onMounted(load);
</script>

<template>
  <!-- Dark header -->
  <div style="background:#0F172A;padding:24px 24px 0;">
    <div class="d-flex align-center ga-3 mb-4">
      <div
        style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#1D4ED8,#D97706);
               display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;"
      >
        <v-icon size="22">mdi-view-dashboard-variant</v-icon>
      </div>
      <div>
        <div style="font-size:18px;font-weight:800;color:white;">{{ greeting }}</div>
        <div style="font-size:12px;color:#64748b;">CourtMastr Dashboard</div>
      </div>
    </div>
    <!-- Stats bar -->
    <div
      style="background:#1E293B;border-radius:10px 10px 0 0;display:grid;grid-template-columns:repeat(4,1fr);"
    >
      <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
        <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ activeTournaments.length }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Live</div>
      </div>
      <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
        <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ upcomingTournaments.length }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Upcoming</div>
      </div>
      <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
        <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ dashboardStore.pendingRegistrationCount }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Pending Regs</div>
      </div>
      <div style="padding:12px;text-align:center;">
        <div style="font-size:20px;font-weight:800;color:#F59E0B;">{{ dashboardStore.totalPlayerCount }}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Players</div>
      </div>
    </div>
  </div>

  <v-container class="pa-4">
    <v-progress-circular v-if="loading" indeterminate color="primary" class="d-block mx-auto my-8" />

    <template v-else>
      <!-- Live tournaments -->
      <div v-if="activeTournaments.length > 0" class="mb-6">
        <div class="d-flex align-center ga-2 mb-3">
          <span
            style="width:8px;height:8px;border-radius:50%;background:#16A34A;display:inline-block;
                   animation:pulse 1.5s infinite;"
          />
          <span style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">Live Now</span>
        </div>
        <div
          v-for="t in activeTournaments"
          :key="t.id"
          style="background:white;border-left:3px solid #16A34A;border-radius:0 8px 8px 0;
                 padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;
                 justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.05);"
        >
          <div>
            <div style="font-size:14px;font-weight:600;color:#0F172A;">{{ t.name }}</div>
            <div style="font-size:12px;color:#64748b;">{{ t.sport ?? '—' }} · {{ t.location ?? 'No location' }}</div>
          </div>
          <v-btn :to="`/tournaments/${t.id}`" size="small" variant="tonal" color="success">Manage</v-btn>
        </div>
      </div>

      <!-- Upcoming tournaments -->
      <div v-if="upcomingTournaments.length > 0" class="mb-6">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:12px;">
          Upcoming
        </div>
        <div
          v-for="t in upcomingTournaments"
          :key="t.id"
          style="background:white;border-left:3px solid #1D4ED8;border-radius:0 8px 8px 0;
                 padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;
                 justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.05);"
        >
          <div>
            <div style="font-size:14px;font-weight:600;color:#0F172A;">{{ t.name }}</div>
            <div style="font-size:12px;color:#64748b;">{{ t.sport ?? '—' }} · {{ t.status }}</div>
          </div>
          <v-btn :to="`/tournaments/${t.id}`" size="small" variant="text">View</v-btn>
        </div>
      </div>

      <!-- Recent activity -->
      <div v-if="dashboardStore.recentActivity.length > 0">
        <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-bottom:12px;">
          Recent Activity
        </div>
        <v-card>
          <v-list lines="one" density="compact">
            <v-list-item
              v-for="item in dashboardStore.recentActivity"
              :key="item.id"
              :title="item.message"
              :subtitle="item.createdAt?.toLocaleString?.() ?? ''"
              prepend-icon="mdi-clock-outline"
            />
          </v-list>
        </v-card>
      </div>

      <!-- Empty state -->
      <div v-if="activeTournaments.length === 0 && upcomingTournaments.length === 0 && dashboardStore.recentActivity.length === 0"
           class="text-center py-8 text-medium-emphasis">
        <v-icon size="48" class="mb-4">mdi-calendar-blank-outline</v-icon>
        <p>No tournaments yet. <v-btn to="/tournaments/create" variant="text" color="primary" size="small">Create one</v-btn></p>
      </div>
    </template>
  </v-container>
</template>

<style scoped>
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
