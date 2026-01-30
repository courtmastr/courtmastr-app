<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
import type { StageWithStageId, Match as BracketsMatch, Participant } from 'brackets-model';
import { db, collection, query, where, getDocs } from '@/services/firebase';

// Import CSS
import 'brackets-viewer/dist/brackets-viewer.min.css';
import { useRegistrationStore } from '@/stores/registrations';

// Load UMD build via dynamic import to access window.bracketsViewer
// The library exports to window.bracketsViewer in UMD format
let bracketsViewerLoaded = false;

async function loadBracketsViewer() {
  if (bracketsViewerLoaded) return;
  
  // Dynamic import of UMD module
  await import('brackets-viewer/dist/brackets-viewer.min.js');
  bracketsViewerLoaded = true;
}

// Get the render function from window (UMD global)
function getRenderFunction() {
  return (window as any).bracketsViewer?.render;
}

const props = defineProps<{
  tournamentId: string;
  categoryId: string;
}>();

const loading = ref(true);
const error = ref<string | null>(null);
const bracketContainer = ref<HTMLElement | null>(null);

// Brackets-manager data
const stages = ref<StageWithStageId[]>([]);
const matches = ref<BracketsMatch[]>([]);
const participants = ref<Participant[]>([]);
const containerId = `bracket-${Math.random().toString(36).slice(2)}`;

/**
 * Fetch bracket data from Firestore (brackets-manager schema)
 */
async function fetchBracketData() {
  try {
    loading.value = true;
    error.value = null;

    console.log('🔍 Fetching bracket data for:', props.tournamentId, props.categoryId);

    // 1. Get stage for this category
    const stageSnapshot = await getDocs(
      query(
        collection(db, `tournaments/${props.tournamentId}/stage`),
        where('tournament_id', '==', props.categoryId)
      )
    );

    if (stageSnapshot.empty) {
      console.log('⚠️ No bracket generated yet');
      stages.value = [];
      matches.value = [];
      participants.value = [];
      loading.value = false;
      return;
    }

    const stageDoc = stageSnapshot.docs[0];
    const stageDataRaw = stageDoc.data() as any;
    
    // IMPORTANT: Normalize stage ID to string to match match.stage_id
    const stageId = String(stageDataRaw.id || stageDoc.id);
    const stageData = { 
      ...stageDataRaw,
      id: stageId,  // Normalize to string
    };
    stages.value = [stageData as any];

    console.log('📊 Found stage:', stageData);

    // Use the normalized string stage ID
    const stageIdFromData = stageId;
    console.log('   Stage ID type:', typeof stageData.id, 'Value:', stageData.id);
    console.log('   Using stage ID for query:', stageIdFromData);

    // 2. Get matches for this stage
    // Note: To avoid query issues with stage_id types (string/number/object),
    // we fetch all matches for the tournament and filter in memory.
    // This is safe because tournaments rarely have >1000 matches.
    const matchSnapshot = await getDocs(
      collection(db, `tournaments/${props.tournamentId}/match`)
    );

    const allMatches = matchSnapshot.docs.map(d => ({
      ...d.data()
    } as any));

    console.log(`📊 Fetched ${allMatches.length} total matches`);
    if (allMatches.length > 0) {
      console.log('   Sample match.stage_id:', allMatches[0].stage_id, 'Type:', typeof allMatches[0].stage_id);
      console.log('   Comparing to stage ID:', stageIdFromData, 'Type:', typeof stageIdFromData);
    }

    // Filter for current stage with string comparison
    matches.value = allMatches
      .filter(m => {
        const matchStageId = String(m.stage_id);
        const targetStageId = String(stageIdFromData);
        const matches = matchStageId === targetStageId;

        if (!matches && allMatches.indexOf(m) < 3) {
          console.log(`   🔍 Match ${m.id} stage_id "${matchStageId}" !== "${targetStageId}"`);
        }

        return matches;
      })
      .map(m => {
        // Handle opponent objects:
        // - null opponent = BYE (no opponent at all)
        // - opponent with null id = TBD (opponent will be determined by previous match)
        // - opponent with value id = actual participant
        const opponent1 = m.opponent1 ? {
          ...m.opponent1,
          id: m.opponent1.id != null ? String(m.opponent1.id) : null
        } : null;

        const opponent2 = m.opponent2 ? {
          ...m.opponent2,
          id: m.opponent2.id != null ? String(m.opponent2.id) : null
        } : null;
        
        return {
          ...m,
          // Ensure all IDs are strings (brackets-viewer expects consistent types)
          id: String(m.id),
          stage_id: String(m.stage_id),
          group_id: String(m.group_id),
          round_id: String(m.round_id),
          opponent1,
          opponent2,
        };
      });

    console.log(`📊 Filtered & Normalized to ${matches.value.length} matches for stage ${stageIdFromData}`);

    // Log bracket breakdown
    const wbMatches = matches.value.filter(m => m.group_id === '0' || m.group_id === 0);
    const lbMatches = matches.value.filter(m => m.group_id === '1' || m.group_id === 1);
    const gfMatches = matches.value.filter(m => m.group_id === '2' || m.group_id === 2);
    
    console.log('🏆 Bracket Structure:');
    console.log(`   Winners Bracket (group 0): ${wbMatches.length} matches`);
    console.log(`   Losers Bracket (group 1): ${lbMatches.length} matches`);
    console.log(`   Grand Finals (group 2): ${gfMatches.length} matches`);
    
    if (wbMatches.length > 0) {
      console.log('   WB Rounds:', [...new Set(wbMatches.map(m => m.round_id))].sort());
    }
    if (lbMatches.length > 0) {
      console.log('   LB Rounds:', [...new Set(lbMatches.map(m => m.round_id))].sort());
    }

    if (matches.value.length === 0 && allMatches.length > 0) {
      console.error(`❌ CRITICAL: No matches matched the stage_id filter!`);
      console.error(`   This indicates a data consistency issue.`);
      console.error(`   All match stage_ids:`, allMatches.map(m => ({ id: m.id, stage_id: m.stage_id })));
    }

    // 3. Get participants for this stage
    // Note: brackets-manager stores 'participant' collection separate from our 'registrations'
    // Participants have tournament_id = stage ID
    const participantSnapshot = await getDocs(
      query(
        collection(db, `tournaments/${props.tournamentId}/participant`),
        where('tournament_id', '==', stageIdFromData)
      )
    );
    
    console.log(`📊 Found ${participantSnapshot.size} participants for stage ${stageIdFromData}`);

    // 3b. Use RegistrationStore to resolve names
    // We need both registrations (to link bracket participant -> player ID)
    // and players (to get the actual name)
    const registrationStore = useRegistrationStore();
    if (registrationStore.registrations.length === 0) {
      await registrationStore.fetchRegistrations(props.tournamentId);
    }
    if (registrationStore.players.length === 0) {
      await registrationStore.fetchPlayers(props.tournamentId);
    }

    participants.value = participantSnapshot.docs.map(d => {
      const data = d.data() as any;
      // data.name is the Registration ID (seeded by our generator)
      const regId = data.name;
      // Normalize participant ID to string
      const participantId = String(data.id || d.id); 
      
      let humanName = 'Unknown';
      const registration = registrationStore.registrations.find(r => r.id === regId);
      
      if (registration) {
        if (registration.participantType === 'team' && registration.teamName) {
           humanName = registration.teamName;
        } else if (registration.playerId) {
          const player = registrationStore.getPlayerById(registration.playerId);
          if (player) {
            humanName = `${player.firstName} ${player.lastName}`;
          }
        }
      } else {
        // Fallback: maybe data.name is already a name?
        humanName = data.name || 'Unknown';
      }

      return {
        ...data,
        id: participantId,  // Use normalized string ID
        name: humanName,
      } as any;
    });

    console.log(`📊 Resolved ${participants.value.length} participant names`);

    // TURN OFF LOADING BEFORE RENDERING
    // This is critical because the container div is hidden while loading=true
    loading.value = false;

    // Render bracket after data is loaded and DOM is updated
    await nextTick();
    renderBracket();

  } catch (err: any) {
    console.error('❌ Error fetching bracket data:', err);
    error.value = err.message || 'Failed to load bracket';
    loading.value = false; // Ensure loading is off on error
  }
}

/**
 * Render bracket using brackets-viewer.js
 */
function renderBracket() {
  if (!bracketContainer.value) {
    console.error('❌ Bracket container not found in DOM');
    return;
  }
  
  if (stages.value.length === 0) {
    console.log('⚠️ No stages to render');
    return;
  }

  console.log('🎨 Rendering bracket with data:');
  console.log('   Stages:', stages.value.length, stages.value);
  console.log('   Matches:', matches.value.length);
  console.log('   Participants:', participants.value.length);
  
  // Group matches by bracket
  const wbMatches = matches.value.filter(m => m.group_id === '0' || m.group_id === 0);
  const lbMatches = matches.value.filter(m => m.group_id === '1' || m.group_id === 1);
  const gfMatches = matches.value.filter(m => m.group_id === '2' || m.group_id === 2);
  
  console.log('   WB matches:', wbMatches.length);
  console.log('   LB matches:', lbMatches.length);
  console.log('   GF matches:', gfMatches.length);
  if (wbMatches[0]) console.log('   Sample WB:', wbMatches[0].id, 'round:', wbMatches[0].round_id);
  if (lbMatches[0]) console.log('   Sample LB:', lbMatches[0].id, 'round:', lbMatches[0].round_id);

  try {
    if (!window.bracketsViewer) {
      throw new Error('Brackets viewer library not loaded');
    }
    
    if (participants.value.length === 0) {
      throw new Error('No participants to render');
    }

    // Prepare data for brackets-viewer
    // The viewer expects certain properties in the stage object
    const stagesWithConfig = stages.value.map((s: any) => ({
      ...s,
      // Add default settings if missing
      settings: s.settings || {
        size: matches.value.length > 16 ? 32 : matches.value.length > 8 ? 16 : 8,
        seedOrdering: ['inner_outer'],
        grandFinal: 'double',
        consolationFinal: true,
        skipFirstRound: false,
        matchesChildCount: 0,
      }
    }));
    
    console.log('🎨 Stages with config:', stagesWithConfig);

    window.bracketsViewer.render({
      stages: stagesWithConfig,
      matches: matches.value,
      matchGames: [], 
      participants: participants.value,
    }, {
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

// Lifecycle
onMounted(async () => {
  await loadBracketsViewer();
  fetchBracketData();
});

// Watch for category changes
watch(() => props.categoryId, () => {
  fetchBracketData();
});
</script>

<template>
  <div class="brackets-manager-viewer">
    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8">
      <v-progress-circular indeterminate color="primary" />
      <p class="text-body-2 text-grey mt-4">Loading bracket...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-8">
      <v-icon size="64" color="error">mdi-alert-circle</v-icon>
      <p class="text-body-1 text-error mt-4">{{ error }}</p>
      <v-btn color="primary" variant="outlined" class="mt-4" @click="fetchBracketData">
        Retry
      </v-btn>
    </div>

    <!-- Empty State -->
    <div v-else-if="stages.length === 0" class="text-center py-8">
      <v-icon size="64" color="grey-lighten-1">mdi-tournament</v-icon>
      <p class="text-body-1 text-grey mt-4">No bracket generated yet</p>
      <p class="text-caption text-grey">Generate a bracket to see it here</p>
    </div>

    <!-- Debug Info -->
    <v-expansion-panels v-else class="mb-4">
      <v-expansion-panel>
        <v-expansion-panel-title>
          📊 Bracket Debug Info ({{ matches.length }} matches)
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-row>
            <v-col cols="4">
              <strong>Winners Bracket:</strong> {{ matches.filter(m => m.group_id === '0').length }} matches
            </v-col>
            <v-col cols="4">
              <strong>Losers Bracket:</strong> {{ matches.filter(m => m.group_id === '1').length }} matches
            </v-col>
            <v-col cols="4">
              <strong>Grand Finals:</strong> {{ matches.filter(m => m.group_id === '2').length }} matches
            </v-col>
          </v-row>
          <v-row class="mt-2">
            <v-col cols="4">
              <strong>Participants:</strong> {{ participants.length }}
            </v-col>
            <v-col cols="4">
              <strong>Stage ID:</strong> {{ stages[0]?.id }}
            </v-col>
            <v-col cols="4">
              <strong>Type:</strong> {{ stages[0]?.type }}
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- Bracket Container -->
    <div v-if="stages.length > 0" :id="containerId" ref="bracketContainer" class="bracket-wrapper brackets-viewer"></div>
  </div>
</template>

<style scoped>
.brackets-manager-viewer {
  min-height: 400px;
}

.bracket-wrapper {
  width: 100%;
  overflow-x: auto;
  padding: 20px;
}

/* Ensure brackets-viewer renders properly */
:deep(.brackets-viewer) {
  display: flex;
  flex-direction: row;
  gap: 40px;
}

:deep(.brackets-viewer .round) {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  min-width: 200px;
}

:deep(.brackets-viewer .match) {
  margin: 10px 0;
}

:deep(.brackets-viewer .bracket) {
  display: flex;
  flex-direction: row;
  gap: 40px;
}

:deep(.brackets-viewer .bracket-title) {
  font-weight: bold;
  margin-bottom: 20px;
  text-align: center;
}
</style>

<style>
/* Global styles for brackets-viewer.js */
/* These ensure connecting lines and proper layout */
.brackets-viewer {
  --match-border-color: #e0e0e0;
  --match-background-color: #fff;
  --match-winner-background: #e8f5e9;
  --match-loser-background: #ffebee;
  --connector-color: #bdbdbd;
}

.brackets-viewer .connector {
  stroke: var(--connector-color);
  stroke-width: 2;
}

.brackets-viewer .match {
  border: 1px solid var(--match-border-color);
  background: var(--match-background-color);
  border-radius: 4px;
  overflow: hidden;
}

.brackets-viewer .opponent {
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brackets-viewer .opponent.win {
  background: var(--match-winner-background);
  font-weight: bold;
}

.brackets-viewer .opponent.loss {
  background: var(--match-loser-background);
}
</style>
