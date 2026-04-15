import { ref } from 'vue';
import {
  db,
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  serverTimestamp,
} from '@/services/firebase';
import { useAuthStore } from '@/stores/auth';
import type { TbdScheduleEntry } from '@/types';
import { convertTimestamps } from '@/utils/firestore';

export function useTbdSchedule() {
  const authStore = useAuthStore();
  const entries = ref<TbdScheduleEntry[]>([]);
  const loading = ref(false);

  async function loadTbdEntries(tournamentId: string): Promise<void> {
    loading.value = true;
    try {
      const snap = await getDocs(
        collection(db, `tournaments/${tournamentId}/tbdSchedule`)
      );
      entries.value = snap.docs.map((d) =>
        convertTimestamps({ id: d.id, ...d.data() }) as TbdScheduleEntry
      );
    } catch (err) {
      // silently handled — callers see empty entries
    } finally {
      loading.value = false;
    }
  }

  async function addTbdEntry(
    tournamentId: string,
    entry: Omit<TbdScheduleEntry, 'id' | 'createdAt' | 'createdBy'>
  ): Promise<void> {
    const data: Record<string, unknown> = {
      categoryId: entry.categoryId,
      roundLabel: entry.roundLabel,
      startTime: entry.startTime,
      endTime: entry.endTime,
      createdAt: serverTimestamp(),
      createdBy: authStore.currentUser?.id ?? '',
    };
    if (entry.court) data.court = entry.court;

    const docRef = await addDoc(
      collection(db, `tournaments/${tournamentId}/tbdSchedule`),
      data
    );
    entries.value.push({
      ...entry,
      id: docRef.id,
      createdAt: new Date(),
      createdBy: authStore.currentUser?.id ?? '',
    });
  }

  async function removeTbdEntry(tournamentId: string, entryId: string): Promise<void> {
    await deleteDoc(doc(db, `tournaments/${tournamentId}/tbdSchedule/${entryId}`));
    entries.value = entries.value.filter((e) => e.id !== entryId);
  }

  return { entries, loading, loadTbdEntries, addTbdEntry, removeTbdEntry };
}
