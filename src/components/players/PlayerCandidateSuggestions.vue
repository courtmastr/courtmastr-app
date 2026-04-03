<script setup lang="ts">
import { computed } from 'vue';
import type { CandidateMatch } from '@/services/playerIdentityService';

interface Props {
  candidates: CandidateMatch[];
  selectedPlayerId: string | null;
  isLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
});

const emit = defineEmits<{
  'select-existing': [playerId: string];
  'create-new': [];
}>();

const signalLabels: Record<CandidateMatch['matchedSignals'][number], string> = {
  userId: 'Logged-in account',
  'name+phone': 'Name + phone',
  'name+email': 'Name + email',
  email: 'Email only',
  name: 'Name only',
};

const hasCandidates = computed(() => props.candidates.length > 0);
</script>

<template>
  <v-card
    class="player-candidate-suggestions"
    variant="outlined"
  >
    <v-card-text class="pa-4">
      <div
        v-if="isLoading"
        class="text-body-2 text-medium-emphasis d-flex align-center ga-3"
      >
        <v-progress-circular
          indeterminate
          size="18"
          width="2"
          color="primary"
        />
        Searching for matching players...
      </div>

      <template v-else-if="hasCandidates">
        <div class="d-flex align-center justify-space-between flex-wrap ga-3 mb-3">
          <div>
            <div class="text-subtitle-2 font-weight-medium">
              Possible matches found
            </div>
            <div class="text-caption text-medium-emphasis">
              Pick an existing player to link, or create a new one explicitly.
            </div>
          </div>

          <v-btn
            variant="text"
            size="small"
            color="primary"
            prepend-icon="mdi-account-plus"
            @click="emit('create-new')"
          >
            Create new
          </v-btn>
        </div>

        <v-list
          density="compact"
          class="player-candidate-suggestions__list"
        >
          <v-list-item
            v-for="candidate in candidates"
            :key="candidate.player.id"
            :active="selectedPlayerId === candidate.player.id"
            rounded="lg"
            class="player-candidate-suggestions__item"
            @click="emit('select-existing', candidate.player.id)"
          >
            <template #prepend>
              <v-avatar
                color="primary"
                size="36"
                variant="tonal"
              >
                <span class="text-caption font-weight-bold">
                  {{ candidate.player.firstName.charAt(0) }}{{ candidate.player.lastName.charAt(0) }}
                </span>
              </v-avatar>
            </template>

            <v-list-item-title class="font-weight-medium">
              {{ candidate.player.firstName }} {{ candidate.player.lastName }}
            </v-list-item-title>

            <v-list-item-subtitle class="text-caption text-medium-emphasis">
              <span>
                {{ candidate.player.email ?? 'No email on file' }}
              </span>
              <span class="mx-2">•</span>
              <span>
                Score {{ candidate.matchScore }}
              </span>
            </v-list-item-subtitle>

            <template #append>
              <div class="d-flex align-center ga-2 flex-wrap justify-end">
                <v-chip
                  v-for="signal in candidate.matchedSignals"
                  :key="signal"
                  size="x-small"
                  variant="tonal"
                  color="primary"
                  label
                >
                  {{ signalLabels[signal] }}
                </v-chip>

                <v-icon
                  v-if="selectedPlayerId === candidate.player.id"
                  icon="mdi-check-circle"
                  color="primary"
                  size="20"
                />
              </div>
            </template>
          </v-list-item>
        </v-list>

        <div class="d-flex justify-end mt-3">
          <v-btn
            variant="text"
            size="small"
            color="secondary"
            prepend-icon="mdi-account-plus-outline"
            @click="emit('create-new')"
          >
            Create as new player anyway
          </v-btn>
        </div>
      </template>

      <div
        v-else
        class="text-body-2 text-medium-emphasis"
      >
        No likely matches found. You can still create a new player explicitly.
      </div>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.player-candidate-suggestions {
  border-color: rgba(var(--v-theme-primary), 0.18);
  background: linear-gradient(
    180deg,
    rgba(var(--v-theme-surface), 0.98) 0%,
    rgba(var(--v-theme-primary), 0.03) 100%
  );
}

.player-candidate-suggestions__list {
  background: transparent;
}

.player-candidate-suggestions__item {
  margin-bottom: 0.5rem;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.player-candidate-suggestions__item:last-child {
  margin-bottom: 0;
}

.player-candidate-suggestions__item:hover {
  transform: translateY(-1px);
  border-color: rgba(var(--v-theme-primary), 0.28);
}
</style>
