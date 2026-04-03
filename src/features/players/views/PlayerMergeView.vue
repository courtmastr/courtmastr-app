<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PLAYER_IDENTITY_V2 } from '@/config/featureFlags';
import { functions, httpsCallable } from '@/services/firebase';
import { useNotificationStore } from '@/stores/notifications';
import { usePlayersStore } from '@/stores/players';
import type { GlobalPlayer } from '@/types';

interface ExecuteMergePayload {
  sourcePlayerId: string;
  targetPlayerId: string;
  mergeRequestId?: string;
}

interface ExecuteMergeResult {
  success: boolean;
  targetPlayerId: string;
}

interface MergeOption {
  id: string;
  displayName: string;
  emailLabel: string;
  playerIdLabel: string;
}

const route = useRoute();
const router = useRouter();
const playersStore = usePlayersStore();
const notificationStore = useNotificationStore();

const sourcePlayerId = ref<string | null>(null);
const targetPlayerId = ref<string | null>(null);
const isConfirming = ref(false);
const isExecuting = ref(false);
const isLoadingPlayers = ref(false);

const mergeablePlayers = computed<GlobalPlayer[]>(() =>
  playersStore.players.filter((player) => player.isActive && player.identityStatus !== 'merged')
);

const sourceOptions = computed<MergeOption[]>(() =>
  mergeablePlayers.value
    .map((player) => ({
      id: player.id,
      displayName: `${player.firstName} ${player.lastName}`,
      emailLabel: player.email ?? 'No email',
      playerIdLabel: player.id,
    }))
);

const sourcePlayer = computed<GlobalPlayer | null>(() =>
  mergeablePlayers.value.find((player) => player.id === sourcePlayerId.value) ?? null
);

const targetOptions = computed<MergeOption[]>(() =>
  sourceOptions.value.filter((player) => player.id !== sourcePlayerId.value)
);

const targetPlayer = computed<MergeOption | null>(() =>
  targetOptions.value.find((player) => player.id === targetPlayerId.value) ?? null
);

const syncSourceFromRoute = (): void => {
  const routeSource = route.query.source;
  sourcePlayerId.value = typeof routeSource === 'string' && routeSource.length > 0
    ? routeSource
    : null;
};

const loadPlayers = async (): Promise<void> => {
  if (!PLAYER_IDENTITY_V2) return;

  isLoadingPlayers.value = true;
  try {
    await playersStore.fetchPlayers();
  } catch (err) {
    console.error('Error loading players for merge:', err);
    notificationStore.showToast('error', 'Failed to load players');
  } finally {
    isLoadingPlayers.value = false;
  }
};

const executeMerge = async (): Promise<void> => {
  if (!PLAYER_IDENTITY_V2) {
    notificationStore.showToast('warning', 'Player identity v2 is disabled');
    return;
  }

  if (!sourcePlayer.value || !targetPlayerId.value) {
    notificationStore.showToast('warning', 'Select both players before merging');
    return;
  }

  isExecuting.value = true;

  try {
    const executeMergeFn = httpsCallable<ExecuteMergePayload, ExecuteMergeResult>(
      functions,
      'executeMerge'
    );

    await executeMergeFn({
      sourcePlayerId: sourcePlayer.value.id,
      targetPlayerId: targetPlayerId.value,
    });

    notificationStore.showToast('success', 'Players merged successfully');
    await router.push({ name: 'players-list' });
  } catch (err) {
    console.error('Error executing player merge:', err);
    const message = err instanceof Error ? err.message : 'Failed to merge players';
    notificationStore.showToast('error', `Merge failed: ${message}`);
  } finally {
    isExecuting.value = false;
    isConfirming.value = false;
  }
};

onMounted(() => {
  syncSourceFromRoute();
  void loadPlayers();
});

watch(() => route.query.source, () => {
  syncSourceFromRoute();
});

watch(sourcePlayerId, (nextSourceId) => {
  if (nextSourceId === targetPlayerId.value) {
    targetPlayerId.value = null;
  }
});
</script>

<template>
  <v-container class="py-6">
    <div class="d-flex align-center justify-space-between ga-3 mb-4">
      <div>
        <h1 class="text-h5">
          Merge Players
        </h1>
        <p class="text-body-2 text-medium-emphasis mb-0">
          Choose the duplicate player and the surviving player, then merge them into one record.
        </p>
      </div>

      <v-btn
        variant="text"
        @click="router.back()"
      >
        Cancel
      </v-btn>
    </div>

    <v-alert
      v-if="!PLAYER_IDENTITY_V2"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      Player identity v2 is disabled. Enable the feature flag before using merge workflows.
    </v-alert>

    <v-alert
      v-else
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      This action marks the source player as merged, disables that record, and repoints registrations
      to the target player. This cannot be undone from the UI.
    </v-alert>

    <v-row>
      <v-col
        cols="12"
        md="6"
      >
        <v-card variant="outlined">
          <v-card-title>Player One</v-card-title>
          <v-card-text>
            <v-autocomplete
              v-model="sourcePlayerId"
              :items="sourceOptions"
              item-title="displayName"
              item-value="id"
              label="Select duplicate player"
              :disabled="!PLAYER_IDENTITY_V2 || isLoadingPlayers || isExecuting"
              :loading="isLoadingPlayers"
              clearable
            />

            <div
              v-if="sourcePlayer"
              class="mt-3"
            >
              <div class="text-subtitle-1 font-weight-medium">
                {{ sourcePlayer.firstName }} {{ sourcePlayer.lastName }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ sourcePlayer.email ?? 'No email' }}
              </div>
              <div class="text-caption text-medium-emphasis mt-1">
                Player ID: {{ sourcePlayer.id }}
              </div>
              <div class="text-caption text-medium-emphasis mt-2">
                This profile will be tombstoned after merge.
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col
        cols="12"
        md="6"
      >
        <v-card variant="outlined">
          <v-card-title>Player Two</v-card-title>
          <v-card-text>
            <v-autocomplete
              v-model="targetPlayerId"
              :items="targetOptions"
              item-title="displayName"
              item-value="id"
              label="Select surviving player"
              :disabled="!PLAYER_IDENTITY_V2 || !sourcePlayerId || isLoadingPlayers || isExecuting"
              :loading="isLoadingPlayers"
              clearable
            />

            <div
              v-if="targetPlayer"
              class="mt-3"
            >
              <div class="text-subtitle-1 font-weight-medium">
                {{ targetPlayer.displayName }}
              </div>
              <div class="text-body-2 text-medium-emphasis">
                {{ targetPlayer.emailLabel }}
              </div>
              <div class="text-caption text-medium-emphasis mt-1">
                Player ID: {{ targetPlayer.playerIdLabel }}
              </div>
              <div class="text-caption text-medium-emphasis mt-2">
                This profile will remain active after the merge.
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <div class="d-flex ga-3 mt-6">
      <v-btn
        color="error"
        data-testid="player-merge-open-confirm"
        :disabled="!PLAYER_IDENTITY_V2 || !sourcePlayerId || !targetPlayerId"
        :loading="isExecuting"
        @click="isConfirming = true"
      >
        Confirm Merge
      </v-btn>
      <v-btn
        variant="text"
        @click="router.push({ name: 'players-list' })"
      >
        Back to Players
      </v-btn>
    </div>

    <v-dialog
      v-model="isConfirming"
      max-width="480"
    >
      <v-card>
        <v-card-title>Confirm Merge</v-card-title>
        <v-card-text>
          Merge
          <strong>{{ sourcePlayer?.firstName }} {{ sourcePlayer?.lastName }}</strong>
          into
          <strong>{{ targetPlayer?.displayName }}</strong>
          ?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="isConfirming = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            data-testid="player-merge-confirm"
            :loading="isExecuting"
            @click="executeMerge"
          >
            Merge Players
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
