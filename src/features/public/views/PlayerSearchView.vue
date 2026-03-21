<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { usePlayersStore } from '@/stores/players';
import { useAsyncOperation } from '@/composables/useAsyncOperation';
import type { GlobalPlayer } from '@/types';

const playersStore = usePlayersStore();
const search = ref('');

const { execute, loading } = useAsyncOperation();
const router = useRouter();

onMounted(() => execute(() => playersStore.fetchPlayers()));

const goToProfile = (playerId: string): void => {
  router.push({ name: 'player-profile', params: { playerId } });
};

const filteredPlayers = computed((): GlobalPlayer[] => {
  const q = search.value.trim().toLowerCase();
  if (!q) return playersStore.players;
  return playersStore.players.filter(
    (p) =>
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
  );
});

const initials = (p: GlobalPlayer) =>
  `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
</script>

<template>
  <!-- Dark header -->
  <div style="background:#0F172A;padding:24px 24px 0;">
    <div class="d-flex align-center ga-3 mb-4">
      <div
        style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#1D4ED8,#D97706);
               display:flex;align-items:center;justify-content:center;color:white;flex-shrink:0;"
      >
        <v-icon size="22">
          mdi-account-search
        </v-icon>
      </div>
      <div>
        <div style="font-size:18px;font-weight:800;color:white;">
          Find a Player
        </div>
        <div style="font-size:12px;color:#64748b;">
          Search the global player registry
        </div>
      </div>
    </div>
    <!-- Stats bar -->
    <div style="background:#1E293B;border-radius:10px 10px 0 0;display:grid;grid-template-columns:repeat(3,1fr);">
      <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
        <div style="font-size:22px;font-weight:800;color:#F59E0B;">
          {{ playersStore.players.length }}
        </div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">
          Total
        </div>
      </div>
      <div style="padding:12px;text-align:center;border-right:1px solid #334155;">
        <div style="font-size:22px;font-weight:800;color:#F59E0B;">
          {{ playersStore.players.filter(p => p.isActive).length }}
        </div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">
          Active
        </div>
      </div>
      <div style="padding:12px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:#F59E0B;">
          {{ filteredPlayers.length }}
        </div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;">
          Matching
        </div>
      </div>
    </div>
  </div>

  <v-container class="pa-4">
    <v-text-field
      v-model="search"
      prepend-inner-icon="mdi-magnify"
      placeholder="Search by name or email..."
      clearable
      variant="outlined"
      class="mb-4"
    />

    <v-progress-circular
      v-if="loading"
      indeterminate
      color="primary"
      class="d-block mx-auto my-8"
    />

    <div
      v-else-if="filteredPlayers.length === 0 && search"
      class="text-center py-8 text-medium-emphasis"
    >
      No players matching "{{ search }}".
    </div>

    <div
      v-else-if="filteredPlayers.length === 0"
      class="text-center py-8 text-medium-emphasis"
    >
      No players registered yet.
    </div>

    <template v-else>
      <div
        v-for="player in filteredPlayers"
        :key="player.id"
        style="background:white;border-left:3px solid #1D4ED8;border-radius:0 8px 8px 0;
               padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;
               justify-content:space-between;box-shadow:0 1px 3px rgba(0,0,0,0.05);
               cursor:pointer;transition:box-shadow .15s;"
        @click="goToProfile(player.id)"
        @mouseenter="($event.currentTarget as HTMLElement).style.boxShadow='0 4px 12px rgba(29,78,216,.15)'"
        @mouseleave="($event.currentTarget as HTMLElement).style.boxShadow='0 1px 3px rgba(0,0,0,.05)'"
      >
        <div class="d-flex align-center ga-3">
          <div
            style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#1D4ED8,#D97706);
                   display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0;"
          >
            {{ initials(player) }}
          </div>
          <div>
            <div style="font-size:14px;font-weight:600;color:#0F172A;">
              {{ player.firstName }} {{ player.lastName }}
              <v-icon
                v-if="player.isVerified"
                size="14"
                color="success"
                class="ml-1"
              >
                mdi-check-circle
              </v-icon>
            </div>
            <div style="font-size:12px;color:#64748b;">
              {{ player.skillLevel ? `Skill: ${player.skillLevel}` : 'Player' }}
            </div>
          </div>
        </div>
        <v-chip
          size="small"
          :color="player.isActive ? 'success' : 'default'"
          label
        >
          {{ player.isActive ? 'Active' : 'Inactive' }}
        </v-chip>
      </div>
    </template>
  </v-container>
</template>
