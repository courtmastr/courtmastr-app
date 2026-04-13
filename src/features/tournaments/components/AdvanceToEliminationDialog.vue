<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import BaseDialog from '@/components/common/BaseDialog.vue';
import { usePoolLeveling } from '@/composables/usePoolLeveling';
import {
  computeEliminationPreview,
  suggestBracketFormat,
  quickPickSizes,
  nearestBracketSize,
} from '@/composables/usePoolElimination';
import { useTournamentStore } from '@/stores/tournaments';
import { useNotificationStore } from '@/stores/notifications';
import type { QualifierCutMode } from '@/types';

// ---------------------------------------------------------------------------
// Props / emits
// ---------------------------------------------------------------------------
const props = defineProps<{
  modelValue: boolean;
  tournamentId: string;
  categoryId: string;
  categoryName?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'generated'): void;
}>();

// ---------------------------------------------------------------------------
// Store / composable instances
// ---------------------------------------------------------------------------
const poolLeveling = usePoolLeveling();
const tournamentStore = useTournamentStore();
const notificationStore = useNotificationStore();

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const cutMode = ref<QualifierCutMode>('global_top_n');
const qualifierCount = ref(8);
const isGenerating = ref(false);

// ---------------------------------------------------------------------------
// Load preview on open
// ---------------------------------------------------------------------------
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return;
    try {
      await poolLeveling.generatePreview(props.tournamentId, props.categoryId, 1);
      // Default N to nearest clean bracket size ≤ totalPlayers
      const total = poolLeveling.preview.value?.participants.length ?? 0;
      qualifierCount.value = nearestBracketSize(total) || total;
    } catch {
      notificationStore.showToast('error', 'Failed to load pool rankings');
    }
  },
  { immediate: false }
);

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------
const allParticipants = computed(() => poolLeveling.preview.value?.participants ?? []);
const totalPlayers = computed(() => allParticipants.value.length);
const pendingMatches = computed(() => poolLeveling.preview.value?.pendingMatches ?? 0);
const isPoolComplete = computed(() => pendingMatches.value === 0);

const preview = computed(() =>
  allParticipants.value.length > 0
    ? computeEliminationPreview(allParticipants.value, qualifierCount.value, cutMode.value)
    : null
);

const formatSuggestion = computed(() =>
  preview.value ? suggestBracketFormat(preview.value.advancing.length) : null
);

const quickPicks = computed(() => quickPickSizes(totalPlayers.value));

const canGenerate = computed(
  () => isPoolComplete.value && (preview.value?.advancing.length ?? 0) >= 2 && !isGenerating.value
);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function adjustCount(delta: number) {
  qualifierCount.value = Math.min(
    Math.max(1, qualifierCount.value + delta),
    totalPlayers.value
  );
}

function setCount(n: number) {
  qualifierCount.value = n;
}

async function generate() {
  if (!canGenerate.value || !preview.value) return;
  isGenerating.value = true;
  try {
    await tournamentStore.generatePoolEliminationBracket(
      props.tournamentId,
      props.categoryId,
      {
        advancingRegistrationIds: preview.value.advancing.map((p) => p.registrationId),
        eliminationFormat: formatSuggestion.value?.format === 'double_elimination'
          ? 'double_elimination'
          : 'single_elimination',
        qualifierCount: preview.value.advancing.length,
        qualifierCutMode: cutMode.value,
      }
    );
    notificationStore.showToast(
      'success',
      `Bracket generated — ${preview.value.advancing.length} players advancing`
    );
    emit('generated');
    emit('update:modelValue', false);
  } catch (err) {
    notificationStore.showToast(
      'error',
      err instanceof Error ? err.message : 'Failed to generate bracket'
    );
  } finally {
    isGenerating.value = false;
  }
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    :title="`Advance to Elimination — ${categoryName ?? ''}`"
    max-width="900"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- Pool incomplete warning -->
    <v-alert
      v-if="!isPoolComplete"
      type="warning"
      variant="tonal"
      class="mb-4"
      density="compact"
    >
      Pool stage is not complete. {{ pendingMatches }} match{{ pendingMatches === 1 ? '' : 'es' }} still pending.
    </v-alert>

    <div class="d-flex gap-4" style="align-items: flex-start;">

      <!-- ---------------------------------------------------------------- -->
      <!-- Left panel: controls                                              -->
      <!-- ---------------------------------------------------------------- -->
      <div style="min-width: 240px; max-width: 260px;">

        <!-- Ranking method -->
        <div class="text-caption text-medium-emphasis mb-1">Ranking Method</div>
        <v-radio-group v-model="cutMode" density="compact" hide-details class="mb-4">
          <v-radio value="global_top_n" label="Global Top N" />
          <v-radio value="pool_first_global" label="Pool Rank → then Global" />
          <v-radio value="top_n_per_pool" label="Top N per Pool" />
        </v-radio-group>

        <!-- N selector -->
        <div class="text-caption text-medium-emphasis mb-1">
          {{ cutMode === 'top_n_per_pool' ? 'Qualifiers per Pool' : 'Players Advancing' }}
        </div>
        <div class="d-flex align-center gap-2 mb-2">
          <v-btn icon="mdi-minus" size="small" variant="tonal" @click="adjustCount(-1)" />
          <div
            class="text-h5 font-weight-bold text-primary text-center flex-grow-1"
            style="min-width: 48px;"
          >
            {{ cutMode === 'top_n_per_pool' ? qualifierCount : (preview?.advancing.length ?? qualifierCount) }}
          </div>
          <v-btn icon="mdi-plus" size="small" variant="tonal" @click="adjustCount(1)" />
        </div>

        <!-- Quick-pick chips -->
        <div class="d-flex flex-wrap gap-1 mb-4">
          <v-chip
            v-for="n in quickPicks"
            :key="n"
            :color="qualifierCount === n ? 'primary' : undefined"
            :variant="qualifierCount === n ? 'flat' : 'outlined'"
            size="small"
            clickable
            @click="setCount(n)"
          >
            {{ n === totalPlayers ? 'All' : n }}
          </v-chip>
        </div>

        <!-- Auto-detected format -->
        <div class="text-caption text-medium-emphasis mb-1">Format (auto-detected)</div>
        <v-chip
          v-if="formatSuggestion"
          :color="formatSuggestion.isPerfectBracket ? 'success' : 'warning'"
          variant="tonal"
          size="small"
          class="mb-4"
        >
          {{ formatSuggestion.label }}
        </v-chip>

        <!-- Actions -->
        <v-btn
          color="primary"
          :disabled="!canGenerate"
          :loading="isGenerating"
          block
          @click="generate"
        >
          Generate Bracket
          <v-icon end>mdi-arrow-right</v-icon>
        </v-btn>
        <v-btn
          variant="text"
          block
          class="mt-2"
          @click="$emit('update:modelValue', false)"
        >
          Cancel
        </v-btn>
      </div>

      <!-- ---------------------------------------------------------------- -->
      <!-- Right panel: ranked table with cutline                           -->
      <!-- ---------------------------------------------------------------- -->
      <div class="flex-grow-1">
        <div class="d-flex justify-space-between align-center mb-2">
          <span class="text-caption text-medium-emphasis">
            Players — ranked by
            {{ cutMode === 'global_top_n' ? 'Global Score' : cutMode === 'pool_first_global' ? 'Pool Rank → Global' : 'Pool' }}
          </span>
          <span v-if="preview" class="text-caption text-medium-emphasis">
            {{ preview.eliminated.length }} eliminated
          </span>
        </div>

        <v-table density="compact">
          <thead>
            <tr>
              <th style="width: 48px;">#</th>
              <th>Player</th>
              <th class="text-center">Pool</th>
              <th class="text-center">Pool Rank</th>
              <th class="text-center">Global Rank</th>
              <th class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            <!-- Advancing rows -->
            <template v-if="preview">
              <tr v-for="(p, index) in preview.advancing" :key="p.registrationId">
                <td class="text-primary font-weight-bold">{{ index + 1 }}</td>
                <td>{{ p.participantName }}</td>
                <td class="text-center">
                  <v-chip size="x-small" variant="tonal">{{ p.poolLabel }}</v-chip>
                </td>
                <td class="text-center text-body-2">{{ p.poolRank }}</td>
                <td class="text-center text-body-2">{{ p.globalRank }}</td>
                <td class="text-center">
                  <v-chip size="x-small" color="success" variant="tonal">Advances</v-chip>
                </td>
              </tr>

              <!-- Cutline -->
              <tr v-if="preview.eliminated.length > 0">
                <td colspan="6" class="pa-0">
                  <div
                    class="d-flex align-center gap-2 px-3 py-1 text-caption font-weight-medium"
                    style="
                      background: rgba(var(--v-theme-warning), 0.08);
                      border-top: 2px dashed rgb(var(--v-theme-warning));
                      border-bottom: 2px dashed rgb(var(--v-theme-warning));
                      color: rgb(var(--v-theme-warning));
                    "
                  >
                    <v-icon size="small">mdi-content-cut</v-icon>
                    CUTLINE — {{ preview.eliminated.length }} player{{ preview.eliminated.length === 1 ? '' : 's' }} eliminated
                  </div>
                </td>
              </tr>

              <!-- Eliminated rows -->
              <tr
                v-for="(p, index) in preview.eliminated"
                :key="p.registrationId"
                style="opacity: 0.45;"
              >
                <td class="text-disabled">{{ preview.advancing.length + index + 1 }}</td>
                <td class="text-disabled" style="text-decoration: line-through;">{{ p.participantName }}</td>
                <td class="text-center">
                  <v-chip size="x-small" variant="tonal">{{ p.poolLabel }}</v-chip>
                </td>
                <td class="text-center text-body-2 text-disabled">{{ p.poolRank }}</td>
                <td class="text-center text-body-2 text-disabled">{{ p.globalRank }}</td>
                <td class="text-center">
                  <v-chip size="x-small" color="error" variant="tonal">Eliminated</v-chip>
                </td>
              </tr>
            </template>

            <!-- Loading state -->
            <tr v-else>
              <td colspan="6" class="text-center py-6 text-medium-emphasis">
                <v-progress-circular indeterminate size="20" class="mr-2" />
                Loading pool rankings…
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </div>
  </BaseDialog>
</template>
