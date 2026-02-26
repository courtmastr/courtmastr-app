<script setup lang="ts">
import { computed, onUnmounted, ref, useTemplateRef } from 'vue';
import { useRoute } from 'vue-router';
import type { SelfCheckInCandidate } from '@/features/checkin/composables/useSelfCheckIn';
import { useSelfCheckIn } from '@/features/checkin/composables/useSelfCheckIn';

const route = useRoute();
const tournamentId = computed(() => String(route.params.tournamentId || ''));

const query = ref('');
const selected = ref<SelfCheckInCandidate | null>(null);
const feedback = ref('');
const feedbackType = ref<'success' | 'info' | 'error'>('info');
const searchInputRef = useTemplateRef('searchInput');

let searchDebounceTimer: number | null = null;
let autoResetTimer: number | null = null;

const { candidates, loading, submitting, error, search, submit } = useSelfCheckIn(tournamentId.value);

const canCheckInMe = computed(() => Boolean(selected.value?.playerId));
const canCheckInMeAndPartner = computed(() =>
  Boolean(selected.value?.playerId && selected.value?.partnerPlayerId)
);

const clearTimers = (): void => {
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
  }
  if (autoResetTimer !== null) {
    window.clearTimeout(autoResetTimer);
    autoResetTimer = null;
  }
};

const resetToSearch = (): void => {
  selected.value = null;
  query.value = '';
  feedback.value = '';
  void search('');
  window.requestAnimationFrame(() => {
    searchInputRef.value?.focus?.();
  });
};

const scheduleAutoReset = (): void => {
  if (autoResetTimer !== null) window.clearTimeout(autoResetTimer);
  autoResetTimer = window.setTimeout(() => {
    resetToSearch();
  }, 1200);
};

const handleSearchInput = (value: string): void => {
  feedback.value = '';
  selected.value = null;

  if (searchDebounceTimer !== null) window.clearTimeout(searchDebounceTimer);

  if (value.trim().length < 2) {
    void search('');
    return;
  }

  searchDebounceTimer = window.setTimeout(() => {
    void search(value);
  }, 180);
};

const selectCandidate = (candidate: SelfCheckInCandidate): void => {
  selected.value = candidate;
  feedback.value = '';
};

const runSubmit = async (participantIds: string[]): Promise<void> => {
  if (!selected.value) return;

  try {
    const result = await submit({
      registrationId: selected.value.registrationId,
      participantIds,
    });

    if (result.waitingForPartner) {
      feedbackType.value = 'info';
      feedback.value = `${selected.value.displayName} marked present. Waiting for partner to complete check-in.`;
    } else {
      feedbackType.value = 'success';
      feedback.value = `${selected.value.displayName} check-in complete.`;
    }

    scheduleAutoReset();
  } catch (err) {
    feedbackType.value = 'error';
    feedback.value = error.value || 'Unable to complete check-in.';
  }
};

const checkInMe = async (): Promise<void> => {
  if (!selected.value?.playerId) return;
  await runSubmit([selected.value.playerId]);
};

const checkInMeAndPartner = async (): Promise<void> => {
  if (!selected.value?.playerId || !selected.value.partnerPlayerId) return;
  await runSubmit([selected.value.playerId, selected.value.partnerPlayerId]);
};

onUnmounted(() => {
  clearTimers();
});
</script>

<template>
  <v-container
    class="self-checkin-view py-6"
    fluid
  >
    <v-row justify="center">
      <v-col
        cols="12"
        sm="11"
        md="9"
        lg="7"
      >
        <v-card
          rounded="lg"
          elevation="2"
        >
          <v-card-title class="text-h5 font-weight-bold">
            Self Check-In
          </v-card-title>
          <v-card-subtitle>
            Type your name to find your registration.
          </v-card-subtitle>

          <v-card-text>
            <v-text-field
              ref="searchInput"
              v-model="query"
              label="Type player name"
              placeholder="Start typing..."
              prepend-inner-icon="mdi-magnify"
              variant="outlined"
              clearable
              autofocus
              @update:model-value="handleSearchInput"
            />

            <div
              v-if="query.trim().length > 0 && query.trim().length < 2"
              class="text-caption text-medium-emphasis mb-3"
            >
              Type at least 2 characters to search.
            </div>

            <v-progress-linear
              v-if="loading"
              indeterminate
              color="primary"
              class="mb-3"
            />

            <v-alert
              v-if="feedback"
              :type="feedbackType"
              variant="tonal"
              class="mb-3"
            >
              {{ feedback }}
            </v-alert>

            <v-alert
              v-else-if="error"
              type="error"
              variant="tonal"
              class="mb-3"
            >
              {{ error }}
            </v-alert>

            <v-list
              v-if="candidates.length > 0"
              lines="two"
              class="mb-4"
              border
              rounded="lg"
            >
              <v-list-item
                v-for="candidate in candidates"
                :key="candidate.registrationId"
                :active="selected?.registrationId === candidate.registrationId"
                rounded="lg"
                @click="selectCandidate(candidate)"
              >
                <v-list-item-title>
                  {{ candidate.displayName }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ candidate.categoryName }}
                  <span v-if="candidate.partnerName"> • Partner: {{ candidate.partnerName }}</span>
                </v-list-item-subtitle>
                <template #append>
                  <v-chip
                    size="small"
                    variant="tonal"
                    :color="candidate.status === 'checked_in' ? 'success' : 'default'"
                  >
                    {{ candidate.status === 'checked_in' ? 'Checked In' : 'Approved' }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>

            <v-alert
              v-else-if="query.trim().length >= 2 && !loading"
              type="info"
              variant="tonal"
              class="mb-4"
            >
              No matching participants found.
            </v-alert>

            <v-card
              v-if="selected"
              variant="outlined"
              rounded="lg"
              class="pa-4"
            >
              <div class="text-subtitle-1 font-weight-bold mb-2">
                {{ selected.displayName }}
              </div>
              <div class="text-body-2 text-medium-emphasis mb-4">
                {{ selected.categoryName }}
              </div>

              <div class="d-flex flex-wrap ga-2">
                <v-btn
                  color="success"
                  :disabled="!canCheckInMe"
                  :loading="submitting"
                  prepend-icon="mdi-account-check"
                  @click="checkInMe"
                >
                  Check In Me
                </v-btn>
                <v-btn
                  v-if="canCheckInMeAndPartner"
                  color="primary"
                  :loading="submitting"
                  prepend-icon="mdi-account-multiple-check"
                  @click="checkInMeAndPartner"
                >
                  Check In Me + Partner
                </v-btn>
              </div>
            </v-card>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.self-checkin-view {
  min-height: 100vh;
}
</style>
