import { ref } from 'vue';
import { functions, httpsCallable } from '@/services/firebase';
import { logger } from '@/utils/logger';

export interface SelfCheckInCandidate {
  registrationId: string;
  categoryId: string;
  categoryName: string;
  displayName: string;
  partnerName: string;
  playerId: string | null;
  partnerPlayerId: string | null;
  status: string;
}

interface SearchSelfCheckInCandidatesResponse {
  candidates?: SelfCheckInCandidate[];
}

export interface SubmitSelfCheckInResult {
  registrationId: string;
  status: string;
  waitingForPartner: boolean;
  requiredParticipantIds: string[];
  presentParticipantIds: string[];
}

export interface SubmitSelfCheckInInput {
  registrationId: string;
  participantIds: string[];
}

export const useSelfCheckIn = (tournamentId: string) => {
  const candidates = ref<SelfCheckInCandidate[]>([]);
  const loading = ref(false);
  const submitting = ref(false);
  const error = ref<string | null>(null);
  const lastResult = ref<SubmitSelfCheckInResult | null>(null);

  const searchSelfCheckInCandidates = httpsCallable(functions, 'searchSelfCheckInCandidates');
  const submitSelfCheckIn = httpsCallable(functions, 'submitSelfCheckIn');

  const search = async (query: string): Promise<void> => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      candidates.value = [];
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await searchSelfCheckInCandidates({ tournamentId, query: normalized });
      const data = response.data as SearchSelfCheckInCandidatesResponse;
      candidates.value = data.candidates ?? [];
    } catch (err) {
      logger.error('Self check-in search failed:', err);
      error.value = 'Unable to search participants right now.';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const submit = async (input: SubmitSelfCheckInInput): Promise<SubmitSelfCheckInResult> => {
    submitting.value = true;
    error.value = null;

    try {
      const response = await submitSelfCheckIn({
        tournamentId,
        registrationId: input.registrationId,
        participantIds: input.participantIds,
      });
      const result = response.data as SubmitSelfCheckInResult;
      lastResult.value = result;
      return result;
    } catch (err) {
      logger.error('Self check-in submit failed:', err);
      error.value = 'Unable to complete check-in right now.';
      throw err;
    } finally {
      submitting.value = false;
    }
  };

  return {
    candidates,
    loading,
    submitting,
    error,
    lastResult,
    search,
    submit,
  };
};
