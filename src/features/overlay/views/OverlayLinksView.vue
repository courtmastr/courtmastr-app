<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMatchStore } from '@/stores/matches';
import { useTournamentStore } from '@/stores/tournaments';
import { useNotificationStore } from '@/stores/notifications';
import type { Match } from '@/types';

interface CourtOverlayLink {
  courtId: string;
  courtName: string;
  url: string;
}

const route = useRoute();
const matchStore = useMatchStore();
const tournamentStore = useTournamentStore();
const notificationStore = useNotificationStore();

const tournamentId = computed(() => route.params.tournamentId as string);
const origin = computed(() => window.location.origin);

const boardUrl = computed(() =>
  `${origin.value}/overlay/${tournamentId.value}/board`
);

const tickerUrl = computed(() =>
  `${origin.value}/overlay/${tournamentId.value}/ticker`
);

const courtOverlayLinks = computed<CourtOverlayLink[]>(() =>
  tournamentStore.courts.map((court) => ({
    courtId: court.id,
    courtName: court.name,
    url: `${origin.value}/overlay/${tournamentId.value}/court/${court.id}`,
  }))
);

const selectedEmbedCategory = ref<string | null>(null);

watch(
  () => tournamentStore.categories,
  (cats) => {
    if (!selectedEmbedCategory.value && cats.length > 0) {
      selectedEmbedCategory.value = cats[0].id;
    }
  },
  { immediate: true }
);

const bracketEmbedUrl = computed(() => {
  const base = `${origin.value}/tournaments/${tournamentId.value}/bracket?embed=true`;
  return selectedEmbedCategory.value ? `${base}&category=${selectedEmbedCategory.value}` : base;
});

const bracketIframeSnippet = computed(() =>
  `<iframe src="${bracketEmbedUrl.value}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`
);

const getLiveMatchOnCourt = (courtId: string): Match | null =>
  matchStore.matches.find(
    (match) => match.courtId === courtId && match.status === 'in_progress'
  ) ?? null;

const getReadyMatchOnCourt = (courtId: string): Match | null =>
  matchStore.matches.find(
    (match) => match.courtId === courtId && match.status === 'ready'
  ) ?? null;

const getCourtBadge = (courtId: string): { label: string; color: string } => {
  if (getLiveMatchOnCourt(courtId)) {
    return { label: '● LIVE', color: 'success' };
  }

  if (getReadyMatchOnCourt(courtId)) {
    return { label: 'UP NEXT', color: 'warning' };
  }

  return { label: 'IDLE', color: 'grey' };
};

const copyUrl = async (url: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(url);
    notificationStore.showToast('success', 'Link copied!');
  } catch (err) {
    console.error('Error copying overlay link:', err);
    notificationStore.showToast('error', 'Failed to copy link');
  }
};

const previewUrl = (url: string): void => {
  window.open(url, '_blank');
};

onMounted(async () => {
  await tournamentStore.fetchTournament(tournamentId.value);
  tournamentStore.subscribeTournament(tournamentId.value);
  matchStore.subscribeAllMatches(tournamentId.value);
});

onUnmounted(() => {
  tournamentStore.unsubscribeAll();
  matchStore.unsubscribeAll();
});
</script>

<template>
  <v-container class="py-6">
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title class="text-h5">
            Overlay Links
          </v-card-title>
          <v-card-subtitle>
            {{ tournamentStore.currentTournament?.name || 'Tournament' }}
          </v-card-subtitle>

          <v-card-text>
            <v-alert
              type="info"
              variant="tonal"
              class="mb-4"
            >
              Use these URLs in OBS Browser Sources for live overlays.
            </v-alert>

            <v-table density="comfortable">
              <thead>
                <tr>
                  <th class="text-left">
                    Name
                  </th>
                  <th class="text-left">
                    URL
                  </th>
                  <th class="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Tournament Board</td>
                  <td class="overlay-url-cell">
                    {{ boardUrl }}
                  </td>
                  <td class="text-right">
                    <v-btn
                      size="small"
                      variant="text"
                      @click="copyUrl(boardUrl)"
                    >
                      Copy
                    </v-btn>
                    <v-btn
                      size="small"
                      variant="text"
                      @click="previewUrl(boardUrl)"
                    >
                      Preview
                    </v-btn>
                  </td>
                </tr>
                <tr>
                  <td>All Courts Ticker</td>
                  <td class="overlay-url-cell">
                    {{ tickerUrl }}
                  </td>
                  <td class="text-right">
                    <v-btn
                      size="small"
                      variant="text"
                      @click="copyUrl(tickerUrl)"
                    >
                      Copy
                    </v-btn>
                    <v-btn
                      size="small"
                      variant="text"
                      @click="previewUrl(tickerUrl)"
                    >
                      Preview
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12">
        <v-card>
          <v-card-title class="text-h6">
            Per Court Overlays
          </v-card-title>
          <v-card-text>
            <v-table density="comfortable">
              <thead>
                <tr>
                  <th class="text-left">
                    Court
                  </th>
                  <th class="text-left">
                    Status
                  </th>
                  <th class="text-left">
                    URL
                  </th>
                  <th class="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="link in courtOverlayLinks"
                  :key="link.courtId"
                >
                  <td>{{ link.courtName }}</td>
                  <td>
                    <v-chip
                      :color="getCourtBadge(link.courtId).color"
                      size="small"
                      variant="flat"
                    >
                      {{ getCourtBadge(link.courtId).label }}
                    </v-chip>
                  </td>
                  <td class="overlay-url-cell">
                    {{ link.url }}
                  </td>
                  <td class="text-right">
                    <v-btn
                      size="small"
                      variant="text"
                      @click="copyUrl(link.url)"
                    >
                      Copy
                    </v-btn>
                    <v-btn
                      size="small"
                      variant="text"
                      @click="previewUrl(link.url)"
                    >
                      Preview
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12">
        <v-card>
          <v-card-title class="text-h6">
            Bracket Embed Code
          </v-card-title>
          <v-card-text>
            <p class="text-body-2 text-medium-emphasis mb-4">
              Paste this snippet into any website to embed the live bracket. A "Powered by CourtMastr" watermark is always shown.
            </p>
            <v-select
              v-model="selectedEmbedCategory"
              :items="tournamentStore.categories"
              item-title="name"
              item-value="id"
              label="Category"
              variant="outlined"
              density="comfortable"
              hide-details
              class="mb-4"
              style="max-width: 280px"
            />
            <v-textarea
              :model-value="bracketIframeSnippet"
              label="iframe embed code"
              variant="outlined"
              readonly
              rows="3"
              hide-details
              class="mb-3"
              style="font-family: monospace; font-size: 0.82rem"
            />
            <div class="d-flex ga-2">
              <v-btn
                size="small"
                variant="tonal"
                prepend-icon="mdi-content-copy"
                @click="copyUrl(bracketIframeSnippet)"
              >
                Copy Snippet
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                prepend-icon="mdi-open-in-new"
                @click="previewUrl(bracketEmbedUrl)"
              >
                Preview
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12">
        <v-card variant="tonal">
          <v-card-title class="text-h6">
            OBS Setup Instructions
          </v-card-title>
          <v-card-text>
            <ol class="obs-steps">
              <li>OBS Studio → Sources → + → Browser</li>
              <li>Paste URL</li>
              <li>Width: 1920, Height: 1080</li>
              <li>"Shutdown when not visible" → OFF</li>
              <li>Court tile: drag to bottom-left of scene</li>
              <li>Ticker: auto-anchors to bottom edge</li>
            </ol>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.overlay-url-cell {
  max-width: min(700px, 46vw);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: monospace;
  font-size: 0.82rem;
  display: inline-block;
}

@media (max-width: 960px) {
  .overlay-url-cell {
    max-width: 220px;
  }
}

.obs-steps {
  margin: 0;
  padding-left: 20px;
}

.obs-steps li {
  margin-bottom: 6px;
}
</style>
