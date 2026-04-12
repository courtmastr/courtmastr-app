import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  addDoc,
  collection,
  db,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';
import type { MergeRequest, MergeRequestRole } from '@/types';
import { logger } from '@/utils/logger';

interface RequestMergeInput {
  sourcePlayerId: string;
  targetPlayerId: string;
  requestedBy: string;
  requestedByRole: MergeRequestRole;
  reason?: string;
  conflictingUserIds?: boolean;
  conflictOverrideConfirmed?: boolean;
}

export const useMergeRequestsStore = defineStore('mergeRequests', () => {
  const requests = ref<MergeRequest[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const requestMerge = async (input: RequestMergeInput): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, 'mergeRequests'), {
        sourcePlayerId: input.sourcePlayerId,
        targetPlayerId: input.targetPlayerId,
        requestedBy: input.requestedBy,
        requestedByRole: input.requestedByRole,
        status: 'pending',
        reason: input.reason ?? null,
        reviewedBy: null,
        reviewedAt: null,
        completedAt: null,
        conflictingUserIds: input.conflictingUserIds ?? false,
        conflictOverrideConfirmed: input.conflictOverrideConfirmed ?? false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return docRef.id;
    } catch (err) {
      error.value = 'Failed to create merge request';
      logger.error('Error creating merge request:', err);
      throw err;
    }
  };

  const reviewRequest = async (
    requestId: string,
    decision: 'approved' | 'rejected',
    reviewedBy: string
  ): Promise<void> => {
    try {
      await updateDoc(doc(db, 'mergeRequests', requestId), {
        status: decision,
        reviewedBy,
        reviewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      error.value = 'Failed to review merge request';
      logger.error('Error reviewing merge request:', err);
      throw err;
    }
  };

  const fetchPendingRequests = async (): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      const q = query(collection(db, 'mergeRequests'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      requests.value = snap.docs.map((requestDoc) =>
        convertTimestamps({ id: requestDoc.id, ...requestDoc.data() }) as MergeRequest
      );
    } catch (err) {
      error.value = 'Failed to fetch merge requests';
      logger.error('Error fetching pending merge requests:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    requests,
    loading,
    error,
    requestMerge,
    reviewRequest,
    fetchPendingRequests,
  };
});
