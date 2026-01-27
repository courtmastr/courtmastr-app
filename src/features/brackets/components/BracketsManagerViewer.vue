<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';
// Import from dist file directly (package doesn't have proper ESM exports)
import { render } from 'brackets-viewer/dist/brackets-viewer.min.js';
import type { StageWithStageId, Match as BracketsMatch, Participant } from 'brackets-model';
import { db, collection, query, where, getDocs } from '@/services/firebase';
import 'brackets-viewer/dist/brackets-viewer.min.css';

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
    const stageData = { id: stageDoc.id, ...stageDoc.data() };
    stages.value = [stageData as any];

    console.log('📊 Found stage:', stageData);

    // 2. Get matches for this stage
    const matchSnapshot = await getDocs(
      query(
        collection(db, `tournaments/${props.tournamentId}/match`),
        where('stage_id', '==', stageDoc.id)
      )
    );

    matches.value = matchSnapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as any));

    console.log(`📊 Found ${matches.value.length} matches`);

    // 3. Get participants (all for this tournament)
    const participantSnapshot = await getDocs(
      collection(db, `tournaments/${props.tournamentId}/participant`)
    );

    participants.value = participantSnapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as any));

    console.log(`📊 Found ${participants.value.length} participants`);

    // Render bracket after data is loaded
    await nextTick();
    renderBracket();

  } catch (err: any) {
    console.error('❌ Error fetching bracket data:', err);
    error.value = err.message || 'Failed to load bracket';
  } finally {
    loading.value = false;
  }
}

/**
 * Render bracket using brackets-viewer.js
 */
function renderBracket() {
  if (!bracketContainer.value || stages.value.length === 0) {
    console.log('⚠️ Skipping render - no container or no stages');
    return;
  }

  console.log('🎨 Rendering bracket...');

  try {
    render({
      stages: stages.value,
      matches: matches.value,
      participants: participants.value,
    }, {
      selector: bracketContainer.value,
      clear: true,
      // You can add more options here:
      // participantOriginPlacement: 'before',
      // matchClickCallback: (match) => { console.log('Match clicked:', match); },
    });

    console.log('✅ Bracket rendered successfully');
  } catch (err: any) {
    console.error('❌ Error rendering bracket:', err);
    error.value = err.message || 'Failed to render bracket';
  }
}

// Lifecycle
onMounted(() => {
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

    <!-- Bracket Container -->
    <div v-else ref="bracketContainer" class="bracket-wrapper"></div>
  </div>
</template>

<style scoped>
.brackets-manager-viewer {
  min-height: 400px;
}

.bracket-wrapper {
  width: 100%;
  overflow-x: auto;
}

/* Optional: Custom theming for brackets-viewer */
:deep(.brackets-viewer) {
  /* You can override CSS variables here to match your app theme */
  /* Example:
  --match-border-color: #your-color;
  --match-background-color: #your-color;
  --match-winner-background: #your-color;
  */
}
</style>

<style>
/* Import brackets-viewer.js CSS globally (only once) */
/* Already imported in script, but ensuring it's available */
</style>
