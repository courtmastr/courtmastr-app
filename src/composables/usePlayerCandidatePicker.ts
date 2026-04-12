import { ref, type Ref } from 'vue';
import { PLAYER_IDENTITY_V2 } from '@/config/featureFlags';
import { findPlayerCandidates, type CandidateMatch, type PlayerInput } from '@/services/playerIdentityService';
import { logger } from '@/utils/logger';

export interface PlayerCandidatePickerState {
  candidates: Ref<CandidateMatch[]>;
  selectedCandidate: Ref<string | null>;
  isLoading: Ref<boolean>;
  error: Ref<string | null>;
  search: (input: PlayerInput) => Promise<void>;
  selectExisting: (playerId: string) => void;
  selectCreateNew: () => void;
  reset: () => void;
}

const normalizeInput = (input: PlayerInput): PlayerInput => ({
  firstName: input.firstName,
  lastName: input.lastName,
  email: input.email ?? null,
  phone: input.phone ?? null,
  userId: input.userId ?? null,
});

export const usePlayerCandidatePicker = (): PlayerCandidatePickerState => {
  const candidates = ref<CandidateMatch[]>([]);
  const selectedCandidate = ref<string | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const search = async (input: PlayerInput): Promise<void> => {
    if (!PLAYER_IDENTITY_V2) {
      candidates.value = [];
      selectedCandidate.value = null;
      error.value = null;
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      candidates.value = await findPlayerCandidates(normalizeInput(input));
    } catch (err) {
      error.value = 'Could not load player suggestions';
      logger.error('Error loading player candidates:', err);
      candidates.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  const selectExisting = (playerId: string): void => {
    selectedCandidate.value = playerId;
  };

  const selectCreateNew = (): void => {
    selectedCandidate.value = null;
  };

  const reset = (): void => {
    candidates.value = [];
    selectedCandidate.value = null;
    isLoading.value = false;
    error.value = null;
  };

  return {
    candidates,
    selectedCandidate,
    isLoading,
    error,
    search,
    selectExisting,
    selectCreateNew,
    reset,
  };
};
