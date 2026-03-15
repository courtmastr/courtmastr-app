<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue';
import { useRoute } from 'vue-router';
import type { SelfCheckInCandidate } from '@/features/checkin/composables/useSelfCheckIn';
import { rankItemsByQuery } from '@/features/checkin/composables/checkInSearchUtils';
import { useActiveIndexNavigation } from '@/features/checkin/composables/useActiveIndexNavigation';
import { useSelfCheckIn } from '@/features/checkin/composables/useSelfCheckIn';
import { useTournamentStore } from '@/stores/tournaments';
import { BRAND_NAME } from '@/constants/branding';
import { usePublicPageMetadata } from '@/composables/usePublicPageMetadata';

const route = useRoute();
const tournamentStore = useTournamentStore();
const tournamentId = computed(() => String(route.params.tournamentId || ''));
const tournament = computed(() => tournamentStore.currentTournament);

usePublicPageMetadata({
  title: 'Self Check-In',
  description: 'Search your name and check in to your tournament match day experience.',
  canonicalPath: `/tournaments/${tournamentId.value}/self-checkin`,
  noIndex: true,
});

const query = ref('');
const selected = ref<SelfCheckInCandidate | null>(null);
const feedback = ref('');
const feedbackType = ref<'success' | 'info' | 'error'>('info');
const searchInputRef = useTemplateRef('searchInput');

let searchDebounceTimer: number | null = null;
let autoResetTimer: number | null = null;

const { candidates, loading, submitting, error, search, submit } = useSelfCheckIn(tournamentId.value);
const {
  activeIndex: activeCandidateIndex,
  resetActiveIndex,
  setActiveIndex,
  moveActiveIndex,
} = useActiveIndexNavigation();

const displayCandidates = computed<SelfCheckInCandidate[]>(() => {
  if (query.value.trim().length < 2) return [];
  return rankItemsByQuery({
    items: candidates.value,
    query: query.value,
    getSearchText: (candidate) =>
      `${candidate.displayName} ${candidate.partnerName} ${candidate.categoryName}`,
    limit: 6,
  });
});

const hasMultipleMatches = computed(
  () => query.value.trim().length >= 2 && displayCandidates.value.length > 1
);
const selectedAlreadyCheckedIn = computed(() => selected.value?.status === 'checked_in');

const canCheckInMe = computed(
  () => Boolean(selected.value?.playerId) && !selectedAlreadyCheckedIn.value && !submitting.value
);
const canCheckInMeAndPartner = computed(() =>
  Boolean(selected.value?.playerId && selected.value?.partnerPlayerId) &&
  !selectedAlreadyCheckedIn.value &&
  !submitting.value
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
  resetActiveIndex();
  void search('');
  window.requestAnimationFrame(() => {
    searchInputRef.value?.focus?.();
  });
};

const scheduleAutoReset = (): void => {
  if (autoResetTimer !== null) window.clearTimeout(autoResetTimer);
  autoResetTimer = window.setTimeout(() => {
    resetToSearch();
  }, 1800);
};

const handleSearchInput = (value: string): void => {
  feedback.value = '';
  selected.value = null;
  resetActiveIndex();

  if (searchDebounceTimer !== null) window.clearTimeout(searchDebounceTimer);

  if (value.trim().length < 2) {
    void search('');
    return;
  }

  searchDebounceTimer = window.setTimeout(() => {
    void search(value);
  }, 180);
};

const selectCandidate = (candidate: SelfCheckInCandidate, index = -1): void => {
  selected.value = candidate;
  feedback.value = '';
  if (index >= 0) {
    setActiveIndex(index, displayCandidates.value.length);
  }
};

const selectCandidateByIndex = (index: number): void => {
  const candidate = displayCandidates.value[index];
  if (!candidate) return;
  selectCandidate(candidate, index);
};

const handleSearchKeydown = (event: KeyboardEvent): void => {
  if (displayCandidates.value.length === 0) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveActiveIndex(1, displayCandidates.value.length);
    if (activeCandidateIndex.value >= 0) {
      selectCandidateByIndex(activeCandidateIndex.value);
    }
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveActiveIndex(-1, displayCandidates.value.length);
    if (activeCandidateIndex.value >= 0) {
      selectCandidateByIndex(activeCandidateIndex.value);
    }
    return;
  }

  if (event.key === 'Enter' && activeCandidateIndex.value >= 0) {
    event.preventDefault();
    selectCandidateByIndex(activeCandidateIndex.value);
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    resetToSearch();
  }
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
      feedback.value = `${selected.value.displayName} is checked in. Partner still needs to check in.`;
    } else if (participantIds.length > 1) {
      feedbackType.value = 'success';
      feedback.value = `${selected.value.displayName} and partner are checked in.`;
    } else {
      feedbackType.value = 'success';
      feedback.value = `${selected.value.displayName} is checked in.`;
    }

    scheduleAutoReset();
  } catch (err) {
    feedbackType.value = 'error';
    feedback.value = error.value || 'Unable to complete check-in. Refine your name or ask front desk.';
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

onMounted(async () => {
  try {
    await tournamentStore.fetchTournament(tournamentId.value);
    tournamentStore.subscribeTournament(tournamentId.value);
  } catch (err) {
    console.error('Error loading tournament for self check-in header:', err);
  }
});

onUnmounted(() => {
  clearTimers();
  tournamentStore.unsubscribeAll();
});
</script>

<template>
  <div class="self-checkin-page">
    <header class="self-checkin-page__header">
      <img
        src="/logo.svg"
        :alt="BRAND_NAME"
        class="self-checkin-page__app-logo"
        width="32"
        height="32"
      >
      <div class="self-checkin-page__header-text">
        <span class="self-checkin-page__app-name">{{ BRAND_NAME }}</span>
        <span
          v-if="tournament?.name"
          class="self-checkin-page__tournament-name"
        >
          {{ tournament.name }}
        </span>
      </div>
    </header>

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
                @keydown="handleSearchKeydown"
              />

              <div
                v-if="query.trim().length > 0 && query.trim().length < 2"
                class="text-caption text-medium-emphasis mb-3"
              >
                Type at least 2 characters to search.
              </div>

              <div
                v-else-if="hasMultipleMatches"
                class="text-caption text-medium-emphasis mb-3"
              >
                Multiple similar names found. Use ↑/↓ and Enter or tap the exact participant.
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
                v-if="displayCandidates.length > 0"
                lines="two"
                class="mb-4"
                border
                rounded="lg"
              >
                <v-list-item
                  v-for="(candidate, index) in displayCandidates"
                  :key="candidate.registrationId"
                  :active="selected?.registrationId === candidate.registrationId || activeCandidateIndex === index"
                  rounded="lg"
                  @click="selectCandidate(candidate, index)"
                >
                  <v-list-item-title>
                    <span
                      v-if="selected?.registrationId === candidate.registrationId || activeCandidateIndex === index"
                      class="self-checkin-view__selected-indicator"
                    >
                      Selected •
                    </span>
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

                <v-alert
                  v-if="selectedAlreadyCheckedIn"
                  type="info"
                  variant="tonal"
                  class="mb-4"
                >
                  This participant is already checked in.
                </v-alert>

                <div class="self-checkin-view__actions d-flex flex-wrap ga-2">
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
                    :disabled="selectedAlreadyCheckedIn"
                    :loading="submitting"
                    prepend-icon="mdi-account-multiple-check"
                    @click="checkInMeAndPartner"
                  >
                    Check In Me + Partner
                  </v-btn>
                </div>
                <div class="text-caption text-medium-emphasis mt-3">
                  “Check In Me” marks only your presence.
                </div>
                <div
                  v-if="canCheckInMeAndPartner"
                  class="text-caption text-medium-emphasis"
                >
                  “Check In Me + Partner” submits both players together.
                </div>
              </v-card>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<style scoped>
.self-checkin-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.self-checkin-page__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  background-color: #0f172a;
  border-bottom: 2px solid #1d4ed8;
}

.self-checkin-page__app-logo {
  flex-shrink: 0;
  filter: brightness(0) invert(1);
}

.self-checkin-page__header-text {
  display: flex;
  flex-direction: column;
}

.self-checkin-page__app-name {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.05em;
}

.self-checkin-page__tournament-name {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 1px;
}

.self-checkin-view {
  flex: 1;
}

.self-checkin-view__selected-indicator {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
}

@media (max-width: 600px) {
  .self-checkin-view__actions .v-btn {
    width: 100%;
  }
}
</style>
