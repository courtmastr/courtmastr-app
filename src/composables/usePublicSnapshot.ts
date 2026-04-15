/**
 * usePublicSnapshot
 *
 * Fetches a tournament's public snapshot JSON from Firebase Storage.
 * Used by the public page (/t/:slug) — no Firestore reads for participants.
 *
 * Flow:
 *  1. Resolve slug → tournamentId via one Firestore query
 *  2. Fetch latest.json from Storage (CDN-served)
 *  3. Return parsed TournamentSnapshot
 */

import { ref } from 'vue';
import {
  db,
  collection,
  getDocs,
  query,
  where,
  storage,
  ref as storageRef,
  getDownloadURL,
} from '@/services/firebase';
import type { TournamentSnapshot } from '@/types';

export function usePublicSnapshot() {
  const snapshot = ref<TournamentSnapshot | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const notFound = ref(false);

  async function loadBySlug(slug: string): Promise<void> {
    loading.value = true;
    error.value = null;
    notFound.value = false;

    try {
      // 1. Resolve slug → tournamentId
      const q = query(collection(db, 'tournaments'), where('slug', '==', slug));
      const snap = await getDocs(q);

      if (snap.empty) {
        notFound.value = true;
        return;
      }

      const tournamentId = snap.docs[0].id;
      const tournamentData = snap.docs[0].data();

      // 2. Get Storage URL from tournament document if present, otherwise derive it
      let storageUrl: string | undefined = tournamentData.publicSnapshot?.storageUrl;

      if (!storageUrl) {
        // No snapshot published yet
        notFound.value = true;
        return;
      }

      // 3. Fetch snapshot JSON
      const response = await fetch(storageUrl);
      if (!response.ok) {
        // Fall back to constructing the Storage URL
        const fileRef = storageRef(storage, `public-snapshots/${tournamentId}/latest.json`);
        storageUrl = await getDownloadURL(fileRef);
        const retryResponse = await fetch(storageUrl);
        if (!retryResponse.ok) throw new Error('Failed to load tournament data');
        snapshot.value = (await retryResponse.json()) as TournamentSnapshot;
      } else {
        snapshot.value = (await response.json()) as TournamentSnapshot;
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load tournament';
    } finally {
      loading.value = false;
    }
  }

  return { snapshot, loading, error, notFound, loadBySlug };
}
