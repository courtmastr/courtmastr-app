<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import type { Stage, Match, MatchGame, Participant } from 'brackets-model';
import { db, onSnapshot, collection, doc, getDoc } from '@/services/firebase';
import { ClientFirestoreStorage } from '@/services/brackets-storage';
import { query, where, getDocs } from 'firebase/firestore';

import 'brackets-viewer/dist/brackets-viewer.min.css';

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

const stages = ref<Stage[]>([]);
const matches = ref<Match[]>([]);
const matchGames = ref<MatchGame[]>([]);
const participants = ref<Participant[]>([]);
const containerId = `bracket-${Math.random().toString(36).slice(2)}`;

// Real-time listener unsubscribe functions
let matchUnsubscribe: (() => void) | null = null;
let matchGameUnsubscribe: (() => void) | null = null;
let matchScoresUnsubscribe: (() => void) | null = null;

// Debounced fetch function to prevent excessive updates
let fetchTimeout: number | null = null;

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
    console.error('Error fetching registration names:', err);
  }
  
  return namesMap;
}

async function fetchBracketData() {
  try {
    loading.value = true;
    error.value = null;

    console.log('🔍 Fetching bracket data for:', props.tournamentId, props.categoryId);

    const categoryPath = props.levelId
      ? `tournaments/${props.tournamentId}/categories/${props.categoryId}/levels/${props.levelId}`
      : `tournaments/${props.tournamentId}/categories/${props.categoryId}`;
    const storage = new ClientFirestoreStorage(db, categoryPath);

    const stageData = await storage.select('stage') as Stage[] | null;
    
    if (!stageData || stageData.length === 0) {
      console.log('⚠️ No bracket generated yet');
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
      console.warn('Unable to resolve preferred stageId for category:', stageResolveError);
    }

    stages.value = [stage];
    console.log('📊 Found stage:', stage);

    const [matchesData, participantsData, matchGamesData] = await Promise.all([
      storage.select('match', { stage_id: stage.id }) as Promise<Match[] | null>,
      storage.select('participant') as Promise<Participant[] | null>,
      storage.select('match_game', { stage_id: stage.id }) as Promise<MatchGame[] | null>,
    ]);

    matches.value = matchesData || [];
    matchGames.value = matchGamesData || [];

    const rawParticipants = participantsData || [];
    console.log(`📊 Loaded ${matches.value.length} matches, ${matchGames.value.length} match games, ${rawParticipants.length} participants`);

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
    await nextTick();
    renderBracket();

  } catch (err: any) {
    console.error('❌ Error fetching bracket data:', err);
    error.value = err.message || 'Failed to load bracket';
    loading.value = false;
  }
}

function setupRealtimeListeners() {
  cleanupRealtimeListeners();
  console.log(`🔄 [BracketsViewer] Setting up real-time listeners for category ${props.categoryId}`);

  const basePath = props.levelId
    ? `tournaments/${props.tournamentId}/categories/${props.categoryId}/levels/${props.levelId}`
    : `tournaments/${props.tournamentId}/categories/${props.categoryId}`;
  const unsubscribers: (() => void)[] = [];

  // Listener 1: /match collection
  const matchPath = `${basePath}/match`;
    const unsubMatch = onSnapshot(
      collection(db, matchPath),
      () => {
        console.log('   🔄 Match collection changed');
        debouncedFetchBracketData();
      },
      (error) => console.error('   ❌ Error listening to matches:', error)
    );
  unsubscribers.push(unsubMatch);

  // Listener 2: /match_game collection
  const matchGamesPath = `${basePath}/match_game`;
    const unsubGame = onSnapshot(
      collection(db, matchGamesPath),
      () => {
        console.log('   🔄 Match_game collection changed');
        debouncedFetchBracketData();
      },
      (error) => console.error('   ❌ Error listening to match_games:', error)
    );
  unsubscribers.push(unsubGame);

  // Listener 3: /match_scores collection
  const matchScoresPath = `${basePath}/match_scores`;
    const unsubScores = onSnapshot(
      collection(db, matchScoresPath),
      () => {
        console.log('   🔄 Match_scores collection changed');
        debouncedFetchBracketData();
      },
      (error) => console.error('   ❌ Error listening to match_scores:', error)
    );
  unsubscribers.push(unsubScores);

  // Combine into single unsubscribe
  const combinedUnsubscribe = () => unsubscribers.forEach(u => u());
  matchUnsubscribe = combinedUnsubscribe;
  matchGameUnsubscribe = combinedUnsubscribe;
  matchScoresUnsubscribe = combinedUnsubscribe;

  console.log('✅ [BracketsViewer] Real-time listeners active');
}

function cleanupRealtimeListeners() {
  console.log('🧹 [BracketsViewer] Cleaning up real-time listeners');
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
    console.error('❌ Bracket container not found');
    return;
  }
  
  if (stages.value.length === 0) {
    console.log('⚠️ No stages to render');
    return;
  }

  console.log('🎨 Rendering bracket:', {
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

    console.log('✅ Bracket rendered successfully');

  } catch (err: any) {
    console.error('❌ Error rendering bracket:', err);
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
  <div class="brackets-manager-viewer">
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
</style>
