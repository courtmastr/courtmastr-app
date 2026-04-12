<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { isRoundRobinStage } from '@/features/brackets/utils/stageLayout';
import { db, onSnapshot, collection, doc, getDoc } from '@/services/firebase';
import { ClientFirestoreStorage } from '@/services/brackets-storage';
import { query, where, getDocs } from 'firebase/firestore';
import type { Stage, Match, MatchGame, Participant } from 'brackets-model';

import 'brackets-viewer/dist/brackets-viewer.min.css';
import { logger } from '@/utils/logger';

let bracketsViewerLoaded = false;

async function loadBracketsViewer() {
  if (bracketsViewerLoaded) return;
  await import('brackets-viewer/dist/brackets-viewer.min.js');
  bracketsViewerLoaded = true;
}



const props = defineProps<{
  tournamentId: string;
  categoryId: string;
  levelId?: string;
}>();

const loading = ref(true);
const error = ref<string | null>(null);
const bracketContainer = ref<HTMLElement | null>(null);
const lastUpdated = ref<Date | null>(null);

const lastUpdatedLabel = computed(() => {
  if (!lastUpdated.value) return null;
  const minutes = Math.floor((Date.now() - lastUpdated.value.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1m ago';
  return `${minutes}m ago`;
});

const stages = ref<Stage[]>([]);
const matches = ref<Match[]>([]);
const matchGames = ref<MatchGame[]>([]);
const participants = ref<Participant[]>([]);
const containerId = `bracket-${Math.random().toString(36).slice(2)}`;
const isRoundRobinStageLayout = computed(() => isRoundRobinStage(stages.value));

// Real-time listener unsubscribe functions
let matchUnsubscribe: (() => void) | null = null;
let matchGameUnsubscribe: (() => void) | null = null;
let matchScoresUnsubscribe: (() => void) | null = null;

// Debounced fetch function to prevent excessive updates
let fetchTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedFetchBracketData() {
  if (fetchTimeout) {
    clearTimeout(fetchTimeout);
  }
  fetchTimeout = setTimeout(() => {
    fetchBracketData();
  }, 300); // 300ms debounce
}

async function fetchRegistrationNames(): Promise<Map<string, string>> {
  const namesMap = new Map<string, string>();
  
  try {
    // Fetch all registrations for this category
    const registrationsQuery = query(
      collection(db, 'tournaments', props.tournamentId, 'registrations'),
      where('categoryId', '==', props.categoryId)
    );
    
    const regSnapshot = await getDocs(registrationsQuery);
    
    // Collect all player IDs
    const playerIds: string[] = [];
    const registrationMap = new Map<string, any>();
    
    for (const regDoc of regSnapshot.docs) {
      const reg = regDoc.data();
      registrationMap.set(regDoc.id, reg);
      
      if (reg.participantType === 'team') {
        // For teams, use team name directly
        namesMap.set(regDoc.id, reg.teamName || 'Unknown Team');
      } else if (reg.playerId) {
        playerIds.push(reg.playerId);
      }
    }
    
    // Fetch all players in one batch
    if (playerIds.length > 0) {
      // Firestore 'in' query supports up to 10 values, so chunk if needed
      const chunkSize = 10;
      for (let i = 0; i < playerIds.length; i += chunkSize) {
        const chunk = playerIds.slice(i, i + chunkSize);
        const playersQuery = query(
          collection(db, 'tournaments', props.tournamentId, 'players'),
          where('__name__', 'in', chunk)
        );
        
        const playerSnapshot = await getDocs(playersQuery);
        const playerMap = new Map<string, any>();
        
        for (const playerDoc of playerSnapshot.docs) {
          playerMap.set(playerDoc.id, playerDoc.data());
        }
        
        // Map registrations to player names
        for (const [regId, reg] of registrationMap.entries()) {
          if (reg.playerId && playerMap.has(reg.playerId)) {
            const player = playerMap.get(reg.playerId);
            const name = `${player.firstName || ''} ${player.lastName || ''}`.trim();
            namesMap.set(regId, name || 'Unknown');
          }
        }
      }
    }
  } catch (err) {
    logger.error('Error fetching registration names:', err);
  }
  
  return namesMap;
}

async function fetchBracketData() {
  try {
    loading.value = true;
    error.value = null;

    logger.debug('🔍 Fetching bracket data for:', props.tournamentId, props.categoryId);

    const categoryPath = props.levelId
      ? `tournaments/${props.tournamentId}/categories/${props.categoryId}/levels/${props.levelId}`
      : `tournaments/${props.tournamentId}/categories/${props.categoryId}`;
    const storage = new ClientFirestoreStorage(db, categoryPath);

    const stageData = await storage.select('stage') as Stage[] | null;
    
    if (!stageData || stageData.length === 0) {
      logger.debug('⚠️ No bracket generated yet');
      stages.value = [];
      matches.value = [];
      matchGames.value = [];
      participants.value = [];
      loading.value = false;
      return;
    }

    let stage = stageData[0];
    try {
      const preferredStageDocRef = props.levelId
        ? doc(db, 'tournaments', props.tournamentId, 'categories', props.categoryId, 'levels', props.levelId)
        : doc(db, 'tournaments', props.tournamentId, 'categories', props.categoryId);
      const preferredStageDoc = await getDoc(preferredStageDocRef);
      const preferredStageId = preferredStageDoc.exists() ? preferredStageDoc.data()?.stageId : null;

      if (preferredStageId !== null && preferredStageId !== undefined) {
        const matchingStage = stageData.find(
          (candidate) => String(candidate.id) === String(preferredStageId)
        );
        if (matchingStage) {
          stage = matchingStage;
        }
      }
    } catch (stageResolveError) {
      logger.warn('Unable to resolve preferred stageId for category:', stageResolveError);
    }

    stages.value = [stage];
    logger.debug('📊 Found stage:', stage);

    const [matchesData, participantsData, matchGamesData] = await Promise.all([
      storage.select('match', { stage_id: stage.id }) as Promise<Match[] | null>,
      storage.select('participant') as Promise<Participant[] | null>,
      storage.select('match_game', { stage_id: stage.id }) as Promise<MatchGame[] | null>,
    ]);

    matches.value = matchesData || [];
    matchGames.value = matchGamesData || [];

    const rawParticipants = participantsData || [];
    logger.debug(`📊 Loaded ${matches.value.length} matches, ${matchGames.value.length} match games, ${rawParticipants.length} participants`);

    const namesMap = await fetchRegistrationNames();
    
    participants.value = rawParticipants.map(p => {
      const registrationId = p.name;
      const displayName = namesMap.get(registrationId) || `Player ${p.id}`;
      
      return {
        ...p,
        name: displayName,
      };
    });

    loading.value = false;
    lastUpdated.value = new Date();
    await nextTick();
    renderBracket();

  } catch (err: any) {
    logger.error('❌ Error fetching bracket data:', err);
    error.value = err.message || 'Failed to load bracket';
    loading.value = false;
  }
}

function setupRealtimeListeners() {
  cleanupRealtimeListeners();
  logger.debug(`🔄 [BracketsViewer] Setting up real-time listeners for category ${props.categoryId}`);

  const basePath = props.levelId
    ? `tournaments/${props.tournamentId}/categories/${props.categoryId}/levels/${props.levelId}`
    : `tournaments/${props.tournamentId}/categories/${props.categoryId}`;
  const unsubscribers: (() => void)[] = [];

  // Listener 1: /match collection
  const matchPath = `${basePath}/match`;
    const unsubMatch = onSnapshot(
      collection(db, matchPath),
      () => {
        logger.debug('   🔄 Match collection changed');
        debouncedFetchBracketData();
      },
      (error) => logger.error('   ❌ Error listening to matches:', error)
    );
  unsubscribers.push(unsubMatch);

  // Listener 2: /match_game collection
  const matchGamesPath = `${basePath}/match_game`;
    const unsubGame = onSnapshot(
      collection(db, matchGamesPath),
      () => {
        logger.debug('   🔄 Match_game collection changed');
        debouncedFetchBracketData();
      },
      (error) => logger.error('   ❌ Error listening to match_games:', error)
    );
  unsubscribers.push(unsubGame);

  // Listener 3: /match_scores collection
  const matchScoresPath = `${basePath}/match_scores`;
    const unsubScores = onSnapshot(
      collection(db, matchScoresPath),
      () => {
        logger.debug('   🔄 Match_scores collection changed');
        debouncedFetchBracketData();
      },
      (error) => logger.error('   ❌ Error listening to match_scores:', error)
    );
  unsubscribers.push(unsubScores);

  // Combine into single unsubscribe
  const combinedUnsubscribe = () => unsubscribers.forEach(u => u());
  matchUnsubscribe = combinedUnsubscribe;
  matchGameUnsubscribe = combinedUnsubscribe;
  matchScoresUnsubscribe = combinedUnsubscribe;

  logger.debug('✅ [BracketsViewer] Real-time listeners active');
}

function cleanupRealtimeListeners() {
  logger.debug('🧹 [BracketsViewer] Cleaning up real-time listeners');
  const unsubscribe = matchUnsubscribe || matchGameUnsubscribe || matchScoresUnsubscribe;
  if (unsubscribe) {
    unsubscribe();
  }
  // Clear any pending debounce timeouts
  if (fetchTimeout) {
    clearTimeout(fetchTimeout);
    fetchTimeout = null;
  }
  matchUnsubscribe = null;
  matchGameUnsubscribe = null;
  matchScoresUnsubscribe = null;
}

function renderBracket() {
  if (!bracketContainer.value) {
    logger.error('❌ Bracket container not found');
    return;
  }
  
  if (stages.value.length === 0) {
    logger.debug('⚠️ No stages to render');
    return;
  }

  logger.debug('🎨 Rendering bracket:', {
    stages: stages.value.length,
    matches: matches.value.length,
    matchGames: matchGames.value.length,
    participants: participants.value.length,
  });

  try {
    const viewer = (window as any).bracketsViewer;
    if (!viewer || !viewer.render) {
      throw new Error('Brackets viewer library not loaded');
    }

    // Clear previous bracket before re-rendering
    if (bracketContainer.value) {
      bracketContainer.value.innerHTML = '';
    }

    // Deep clone to remove Vue proxies
    const data = JSON.parse(JSON.stringify({
      stages: stages.value,
      matches: matches.value,
      matchGames: matchGames.value,
      participants: participants.value,
    }));

    viewer.render(data, {
      selector: '#' + containerId,
      participantOriginPlacement: 'before',
      separatedChildCountLabel: true,
      showSlotsOrigin: true,
      showLowerBracketSlotsOrigin: true,
      highlightParticipantOnHover: true,
    });

    logger.debug('✅ Bracket rendered successfully');

  } catch (err: any) {
    logger.error('❌ Error rendering bracket:', err);
    error.value = err.message || 'Failed to render bracket';
  }
}

onMounted(async () => {
  await loadBracketsViewer();
  await fetchBracketData();
  setupRealtimeListeners();
});

watch(() => `${props.categoryId}:${props.levelId || ''}`, async () => {
  cleanupRealtimeListeners();
  await fetchBracketData();
  setupRealtimeListeners();
});

onUnmounted(() => {
  cleanupRealtimeListeners();
});
</script>

<template>
  <div
    class="brackets-manager-viewer"
    :class="{ 'is-round-robin-stage': isRoundRobinStageLayout }"
  >
    <div
      v-if="loading"
      class="loading"
    >
      <v-progress-circular
        indeterminate
        color="primary"
      />
      <span>Loading bracket...</span>
    </div>
     
    <div
      v-else-if="error"
      class="error"
    >
      <v-alert
        type="error"
        :text="error"
      />
    </div>
     
    <div
      v-else-if="stages.length === 0"
      class="no-bracket"
    >
      <v-alert
        type="info"
        text="No bracket generated yet for this category"
      />
    </div>
     
    <div v-else>
      <!-- Add live indicator as per feedback -->
      <div class="bracket-header d-flex align-center mb-2">
        <h3 class="text-h6 font-weight-bold">
          Bracket
        </h3>
        <v-chip
          size="small"
          color="success"
          variant="elevated"
          class="ml-2"
        >
          <v-icon
            start
            size="x-small"
          >
            mdi-sync
          </v-icon>
          Live
        </v-chip>
        <span
          v-if="lastUpdatedLabel"
          class="text-caption text-medium-emphasis ml-3"
        >
          Updated {{ lastUpdatedLabel }}
        </span>
      </div>
      <div
        :id="containerId"
        ref="bracketContainer"
        class="bracket-container brackets-viewer"
      />
    </div>
  </div>
</template>

<style scoped>
.brackets-manager-viewer {
  width: 100%;
}

.bracket-header {
  padding: 8px 0;
}

.loading, .error, .no-bracket {
  padding: 2rem;
  text-align: center;
}

.bracket-container {
  width: 100%;
  overflow-x: auto;
}

.bracket-container :deep(.brackets-viewer) {
  min-width: 800px;
}

.brackets-manager-viewer.is-round-robin-stage .bracket-container :deep(.brackets-viewer) {
  min-width: 0;
  width: 100%;
}

.brackets-manager-viewer.is-round-robin-stage .bracket-container :deep(.round-robin) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  row-gap: 24px;
}

.brackets-manager-viewer.is-round-robin-stage .bracket-container :deep(.round-robin .group) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 420px);
  column-gap: 24px;
  row-gap: 16px;
  align-items: start;
  margin-right: 0;
  width: 100%;
}

.brackets-manager-viewer.is-round-robin-stage .bracket-container :deep(.round-robin .group h2) {
  grid-column: 1 / -1;
  margin-bottom: 0;
}

.brackets-manager-viewer.is-round-robin-stage .bracket-container :deep(.round-robin .group .round) {
  grid-column: 1;
  margin: 0;
  width: 100%;
}

.brackets-manager-viewer.is-round-robin-stage .bracket-container :deep(.round-robin .group .round h3) {
  width: 100%;
}

.brackets-manager-viewer.is-round-robin-stage .bracket-container :deep(.round-robin .group table) {
  grid-column: 2;
  grid-row: 2;
  align-self: start;
  margin: 0;
  position: sticky;
  top: 12px;
  background: var(--primary-background);
  z-index: 1;
}

@media (max-width: 959px) {
  .brackets-manager-viewer.is-round-robin-stage .bracket-container {
    overflow-x: auto;
  }

  .brackets-manager-viewer.is-round-robin-stage .bracket-container :deep(.round-robin .group) {
    grid-template-columns: 1fr;
    row-gap: 12px;
  }

  .brackets-manager-viewer.is-round-robin-stage .bracket-container :deep(.round-robin .group table) {
    grid-column: 1;
    grid-row: auto;
    position: static;
    width: max-content;
    min-width: 100%;
  }
}
</style>
