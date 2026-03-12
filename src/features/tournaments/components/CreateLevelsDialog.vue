<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import BaseDialog from '@/components/common/BaseDialog.vue';
import { useNotificationStore } from '@/stores/notifications';
import { useTournamentStore } from '@/stores/tournaments';
import {
  getDefaultLevelNames,
  usePoolLeveling,
  assignByGlobalBands,
  assignByPoolPosition,
  type PoolMapping,
} from '@/composables/usePoolLeveling';
import type { LevelEliminationFormat, LevelingMode } from '@/types';

const props = defineProps<{
  modelValue: boolean;
  tournamentId: string;
  categoryId: string;
  categoryName: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  generated: [];
}>();

const notificationStore = useNotificationStore();
const tournamentStore = useTournamentStore();
const poolLeveling = usePoolLeveling();

type PoolMappingUi = {
  poolId: string;
  rank1LevelIndex: number;
  rank2LevelIndex: number;
  rank3PlusLevelIndex: number;
};

const levelCount = ref(3);
const levelNames = ref(['Advanced', 'Intermediate', 'Beginner']);
const eliminationFormats = ref<LevelEliminationFormat[]>([
  'single_elimination',
  'single_elimination',
  'single_elimination',
]);
const selectedMode = ref<LevelingMode>('pool_position');
const recommendedMode = ref<LevelingMode>('pool_position');
const globalBands = ref<number[]>([]);
const suggestedBands = ref<number[]>([]);
const poolMappings = ref<PoolMappingUi[]>([]);
const manualLevelByRegistrationId = ref<Record<string, number>>({});
const generating = ref(false);

const eliminationFormatOptions: Array<{ title: string; value: LevelEliminationFormat }> = [
  { title: 'Single Elimination (Default)', value: 'single_elimination' },
  { title: 'Double Elimination', value: 'double_elimination' },
  { title: 'Playoff (QF/SF/F)', value: 'playoff_8' },
];

const levelOptions = computed(() =>
  levelNames.value.map((name, index) => ({
    title: name || `Level ${index + 1}`,
    value: index,
  }))
);
const levelPreview = computed(() => poolLeveling.preview.value);

const totalParticipants = computed(
  () => poolLeveling.preview.value?.participants.length || 0
);

const pendingMatches = computed(
  () => poolLeveling.preview.value?.pendingMatches || 0
);
const isPoolStageComplete = computed(() => pendingMatches.value === 0);

const totalBandCount = computed(() =>
  globalBands.value.reduce((sum, current) => sum + (Number(current) || 0), 0)
);

const globalBandMismatch = computed(() =>
  selectedMode.value === 'global_bands' && totalBandCount.value !== totalParticipants.value
);

const canGenerate = computed(() => {
  if (generating.value || poolLeveling.loading.value) return false;
  if (!poolLeveling.preview.value) return false;
  if (pendingMatches.value > 0) return false;
  if (globalBandMismatch.value) return false;
  return true;
});

function toLevelId(levelIndex: number): string {
  return `level-${levelIndex + 1}`;
}

function parseLevelIdToIndex(levelId: string): number {
  const parsed = Number(levelId.replace('level-', ''));
  if (Number.isFinite(parsed) && parsed >= 1) {
    return parsed - 1;
  }
  return 0;
}

function resetUiForLevelCount(nextCount: number): void {
  levelNames.value = getDefaultLevelNames(nextCount);
  eliminationFormats.value = Array.from({ length: nextCount }, () => 'single_elimination');
}

function applyPreviewDefaults(): void {
  if (!poolLeveling.preview.value) return;

  recommendedMode.value = poolLeveling.preview.value.recommendedMode;
  selectedMode.value = poolLeveling.preview.value.recommendedMode;
  suggestedBands.value = poolLeveling.preview.value.suggestedGlobalBands.slice(0, levelCount.value);
  globalBands.value = suggestedBands.value.slice();
  poolMappings.value = poolLeveling.preview.value.defaultPoolMappings.map((mapping) => ({
    poolId: mapping.poolId,
    rank1LevelIndex: parseLevelIdToIndex(mapping.rank1LevelId),
    rank2LevelIndex: parseLevelIdToIndex(mapping.rank2LevelId),
    rank3PlusLevelIndex: parseLevelIdToIndex(mapping.rank3PlusLevelId),
  }));
  manualLevelByRegistrationId.value = {};
}

async function reloadPreview(): Promise<void> {
  try {
    await poolLeveling.generatePreview(props.tournamentId, props.categoryId, levelCount.value);
    applyPreviewDefaults();
  } catch (error) {
    notificationStore.showToast(
      'error',
      poolLeveling.error.value || 'Failed to load pool-level preview'
    );
  }
}

function closeDialog(): void {
  emit('update:modelValue', false);
}

function getPoolMappingsForAssignment(): PoolMapping[] {
  return poolMappings.value.map((mapping) => ({
    poolId: mapping.poolId,
    rank1LevelId: toLevelId(mapping.rank1LevelIndex),
    rank2LevelId: toLevelId(mapping.rank2LevelIndex),
    rank3PlusLevelId: toLevelId(mapping.rank3PlusLevelIndex),
  }));
}

const baseAssignmentsByRegistrationId = computed(() => {
  const preview = poolLeveling.preview.value;
  if (!preview) return new Map<string, string>();

  if (selectedMode.value === 'pool_position') {
    return assignByPoolPosition(preview.participants, getPoolMappingsForAssignment()).assignments;
  }

  return assignByGlobalBands(
    preview.participants,
    globalBands.value,
    levelNames.value.map((_, index) => toLevelId(index))
  ).assignments;
});

const assignmentRows = computed(() => {
  const preview = poolLeveling.preview.value;
  if (!preview) return [];

  return preview.participants.map((participant) => {
    const baseLevelId = baseAssignmentsByRegistrationId.value.get(participant.registrationId) || toLevelId(levelCount.value - 1);
    const baseLevelIndex = parseLevelIdToIndex(baseLevelId);
    const manualLevelIndex = manualLevelByRegistrationId.value[participant.registrationId];
    const finalLevelIndex = manualLevelIndex ?? baseLevelIndex;
    const overridden = manualLevelIndex !== undefined && manualLevelIndex !== baseLevelIndex;

    return {
      ...participant,
      baseLevelIndex,
      finalLevelIndex,
      overridden,
    };
  });
});

const countsByLevelIndex = computed(() => {
  const counts: Record<number, number> = {};
  for (const row of assignmentRows.value) {
    counts[row.finalLevelIndex] = (counts[row.finalLevelIndex] || 0) + 1;
  }
  return counts;
});

function applySuggestedBands(): void {
  globalBands.value = suggestedBands.value.slice();
}

function setManualLevel(registrationId: string, levelIndex: number): void {
  manualLevelByRegistrationId.value = {
    ...manualLevelByRegistrationId.value,
    [registrationId]: levelIndex,
  };
}

function getPoolMapping(poolId: string): PoolMappingUi {
  const existing = poolMappings.value.find((mapping) => mapping.poolId === poolId);
  if (existing) return existing;

  const fallback: PoolMappingUi = {
    poolId,
    rank1LevelIndex: 0,
    rank2LevelIndex: Math.min(1, levelCount.value - 1),
    rank3PlusLevelIndex: Math.min(2, levelCount.value - 1),
  };
  poolMappings.value = [...poolMappings.value, fallback];
  return fallback;
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (!isOpen) return;
    resetUiForLevelCount(levelCount.value);
    await reloadPreview();
  },
  { immediate: true }
);

watch(levelCount, async (nextCount) => {
  const safe = Math.min(5, Math.max(2, Math.floor(nextCount)));
  if (safe !== nextCount) {
    levelCount.value = safe;
    return;
  }

  resetUiForLevelCount(safe);
  if (props.modelValue) {
    await reloadPreview();
  }
});

async function generateLevels(): Promise<void> {
  if (!poolLeveling.preview.value) return;
  if (pendingMatches.value > 0) {
    notificationStore.showToast('error', `Pool stage has ${pendingMatches.value} pending matches`);
    return;
  }
  if (globalBandMismatch.value) {
    notificationStore.showToast(
      'error',
      `Band count (${totalBandCount.value}) must equal total participants (${totalParticipants.value})`
    );
    return;
  }

  generating.value = true;

  try {
    const assignments = assignmentRows.value.map((row) => ({
      registrationId: row.registrationId,
      participantName: row.participantName,
      levelIndex: row.finalLevelIndex,
      poolId: row.poolId,
      poolLabel: row.poolLabel,
      poolRank: row.poolRank,
      globalRank: row.globalRank,
      overridden: row.overridden,
    }));

    await tournamentStore.generateCategoryLevels(props.tournamentId, props.categoryId, {
      mode: selectedMode.value,
      recommendedMode: recommendedMode.value,
      levelNames: levelNames.value,
      eliminationFormats: eliminationFormats.value,
      assignments,
      globalBands: selectedMode.value === 'global_bands' ? globalBands.value : undefined,
      poolMappings: selectedMode.value === 'pool_position'
        ? poolMappings.value.map((mapping) => ({
          poolId: mapping.poolId,
          rank1LevelId: toLevelId(mapping.rank1LevelIndex),
          rank2LevelId: toLevelId(mapping.rank2LevelIndex),
          rank3PlusLevelId: toLevelId(mapping.rank3PlusLevelIndex),
        }))
        : undefined,
    });

    notificationStore.showToast('success', 'Level brackets generated successfully');
    emit('generated');
    closeDialog();
  } catch (error) {
    notificationStore.showToast(
      'error',
      tournamentStore.error || 'Failed to generate level brackets'
    );
  } finally {
    generating.value = false;
  }
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    :title="`Create Levels from Pool Results${categoryName ? ` - ${categoryName}` : ''}`"
    max-width="1100"
    persistent
    :loading="generating"
    @update:model-value="(value) => emit('update:modelValue', value)"
    @cancel="closeDialog"
  >
    <v-alert
      type="info"
      variant="tonal"
      class="mb-4"
    >
      Recommended mode: <strong>{{ recommendedMode === 'pool_position' ? 'By Pool Position' : 'Global Bands' }}</strong>.
      {{ levelPreview?.recommendationReason }}
    </v-alert>

    <v-alert
      v-if="pendingMatches > 0"
      type="warning"
      variant="tonal"
      class="mb-4"
    >
      Pool stage is not complete. {{ pendingMatches }} matches are still pending.
      Pool Rank and Global Rank are provisional until all pool matches are completed.
    </v-alert>

    <v-row>
      <v-col
        cols="12"
        md="4"
      >
        <v-select
          v-model="levelCount"
          label="Number of Levels"
          :items="[2, 3, 4, 5]"
          density="comfortable"
        />
      </v-col>
      <v-col
        cols="12"
        md="8"
      >
        <div class="text-subtitle-2 mb-2">
          Level Names
        </div>
        <v-row>
          <v-col
            v-for="(_, index) in levelCount"
            :key="`level-name-${index}`"
            cols="12"
            md="4"
          >
            <v-text-field
              v-model="levelNames[index]"
              :label="`Level ${index + 1} Name`"
              density="comfortable"
            />
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <v-radio-group
      v-model="selectedMode"
      inline
      label="Assignment Mode"
      class="mb-2"
    >
      <v-radio
        label="By Pool Position"
        value="pool_position"
      />
      <v-radio
        label="Global Bands"
        value="global_bands"
      />
    </v-radio-group>

    <v-card
      v-if="selectedMode === 'global_bands'"
      variant="outlined"
      class="pa-3 mb-4"
    >
      <div class="d-flex align-center justify-space-between mb-2">
        <div class="text-subtitle-2">
          Global Bands
        </div>
        <v-btn
          variant="text"
          size="small"
          @click="applySuggestedBands"
        >
          Use Suggested Split
        </v-btn>
      </div>

      <v-row>
        <v-col
          v-for="(_, index) in levelCount"
          :key="`global-band-${index}`"
          cols="12"
          md="3"
        >
          <v-text-field
            v-model.number="globalBands[index]"
            type="number"
            min="0"
            :label="`${levelNames[index] || `Level ${index + 1}`} Count`"
            density="comfortable"
          />
        </v-col>
      </v-row>

      <v-alert
        v-if="globalBandMismatch"
        type="warning"
        variant="tonal"
        density="compact"
      >
        Counts must total {{ totalParticipants }} participants. Current total is {{ totalBandCount }}.
      </v-alert>
    </v-card>

    <v-card
      v-else
      variant="outlined"
      class="pa-3 mb-4"
    >
      <div class="text-subtitle-2 mb-2">
        Per-Pool Position Mapping
      </div>
      <v-row
        v-for="pool in levelPreview?.pools || []"
        :key="pool.id"
        class="align-center mb-2"
      >
        <v-col
          cols="12"
          md="3"
        >
          <strong>{{ pool.label }}</strong>
          <div class="text-caption text-grey">
            {{ pool.participantCount }} participants
          </div>
        </v-col>
        <v-col
          cols="12"
          md="3"
        >
          <v-select
            v-model="getPoolMapping(pool.id).rank1LevelIndex"
            :items="levelOptions"
            item-title="title"
            item-value="value"
            label="1st Place"
            density="compact"
          />
        </v-col>
        <v-col
          cols="12"
          md="3"
        >
          <v-select
            v-model="getPoolMapping(pool.id).rank2LevelIndex"
            :items="levelOptions"
            item-title="title"
            item-value="value"
            label="2nd Place"
            density="compact"
          />
        </v-col>
        <v-col
          cols="12"
          md="3"
        >
          <v-select
            v-model="getPoolMapping(pool.id).rank3PlusLevelIndex"
            :items="levelOptions"
            item-title="title"
            item-value="value"
            label="3rd+ Place"
            density="compact"
          />
        </v-col>
      </v-row>
    </v-card>

    <v-card
      variant="outlined"
      class="pa-3 mb-4"
    >
      <div class="text-subtitle-2 mb-2">
        Elimination Format Per Level
      </div>
      <v-alert
        type="info"
        density="compact"
        variant="tonal"
        class="mb-2"
      >
        Seeds are calculated from pool performance. Manual level moves are audited and preserved.
      </v-alert>
      <v-row>
        <v-col
          v-for="(_, index) in levelCount"
          :key="`level-format-${index}`"
          cols="12"
          md="4"
        >
          <v-select
            v-model="eliminationFormats[index]"
            :items="eliminationFormatOptions"
            item-title="title"
            item-value="value"
            :label="`${levelNames[index] || `Level ${index + 1}`} Format`"
            density="comfortable"
          />
        </v-col>
      </v-row>
    </v-card>

    <v-card variant="outlined">
      <v-data-table
        :items="assignmentRows"
        :headers="[
          { title: 'Participant', key: 'participantName' },
          { title: 'Pool', key: 'poolLabel' },
          { title: 'Pool Rank', key: 'poolRank', align: 'center' },
          { title: 'Global Rank', key: 'globalRank', align: 'center' },
          { title: 'Level', key: 'finalLevelIndex' },
        ]"
        density="comfortable"
        :items-per-page="10"
      >
        <template #item.poolRank="{ item }">
          <span v-if="isPoolStageComplete">{{ item.poolRank }}</span>
          <span
            v-else
            class="text-grey"
          >--</span>
        </template>
        <template #item.globalRank="{ item }">
          <span v-if="isPoolStageComplete">{{ item.globalRank }}</span>
          <span
            v-else
            class="text-grey"
          >--</span>
        </template>
        <template #item.finalLevelIndex="{ item }">
          <v-select
            :model-value="item.finalLevelIndex"
            :items="levelOptions"
            item-title="title"
            item-value="value"
            density="compact"
            hide-details
            :disabled="!isPoolStageComplete"
            @update:model-value="(value: string | number | null) => setManualLevel(item.registrationId, Number(value))"
          />
        </template>
      </v-data-table>
    </v-card>

    <div class="d-flex flex-wrap mt-3 text-caption text-grey">
      <div
        v-for="(_, index) in levelCount"
        :key="`count-${index}`"
        class="mr-4"
      >
        {{ levelNames[index] || `Level ${index + 1}` }}: {{ countsByLevelIndex[index] || 0 }}
      </div>
    </div>

    <template #actions>
      <v-btn
        variant="text"
        :disabled="generating"
        @click="closeDialog"
      >
        Cancel
      </v-btn>
      <v-spacer />
      <v-btn
        color="primary"
        :loading="generating"
        :disabled="!canGenerate"
        @click="generateLevels"
      >
        Generate Levels
      </v-btn>
    </template>
  </BaseDialog>
</template>
