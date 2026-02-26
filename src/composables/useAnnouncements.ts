import { ref, computed } from 'vue';
import {
  db,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';

export interface Announcement {
  id: string;
  tournamentId: string;
  text: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function useAnnouncements() {
  const announcements = ref<Announcement[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  let unsubscribe: (() => void) | null = null;

  const activeAnnouncements = computed(() =>
    announcements.value
      .filter((a) => a.isActive)
      .sort((a, b) => a.order - b.order)
  );

  async function fetchAnnouncements(tournamentId: string): Promise<void> {
    loading.value = true;
    error.value = null;
    
    try {
      const q = query(
        collection(db, `tournaments/${tournamentId}/announcements`),
        orderBy('order', 'asc')
      );
      const snapshot = await getDocs(q);
      
      announcements.value = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...convertTimestamps(docSnap.data()),
      })) as Announcement[];
    } catch (err) {
      console.error('Error fetching announcements:', err);
      error.value = 'Failed to load announcements';
    } finally {
      loading.value = false;
    }
  }

  function subscribeAnnouncements(tournamentId: string): void {
    if (unsubscribe) return;
    
    const q = query(
      collection(db, `tournaments/${tournamentId}/announcements`),
      orderBy('order', 'asc')
    );
    
    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        announcements.value = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...convertTimestamps(docSnap.data()),
        })) as Announcement[];
      },
      (err) => {
        console.error('Error in announcements subscription:', err);
        error.value = 'Lost connection to announcements';
      }
    );
  }

  function unsubscribeAll(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  async function addAnnouncement(
    tournamentId: string,
    text: string
  ): Promise<string> {
    loading.value = true;
    error.value = null;
    
    try {
      const maxOrder = announcements.value.reduce(
        (max, a) => Math.max(max, a.order),
        -1
      );
      
      const docRef = await addDoc(
        collection(db, `tournaments/${tournamentId}/announcements`),
        {
          tournamentId,
          text,
          order: maxOrder + 1,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      
      return docRef.id;
    } catch (err) {
      console.error('Error adding announcement:', err);
      error.value = 'Failed to add announcement';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateAnnouncement(
    tournamentId: string,
    announcementId: string,
    updates: Partial<Pick<Announcement, 'text' | 'order' | 'isActive'>>
  ): Promise<void> {
    loading.value = true;
    error.value = null;
    
    try {
      await updateDoc(
        doc(db, `tournaments/${tournamentId}/announcements`, announcementId),
        {
          ...updates,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (err) {
      console.error('Error updating announcement:', err);
      error.value = 'Failed to update announcement';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteAnnouncement(
    tournamentId: string,
    announcementId: string
  ): Promise<void> {
    loading.value = true;
    error.value = null;
    
    try {
      await deleteDoc(
        doc(db, `tournaments/${tournamentId}/announcements`, announcementId)
      );
      announcements.value = announcements.value.filter(
        (a) => a.id !== announcementId
      );
    } catch (err) {
      console.error('Error deleting announcement:', err);
      error.value = 'Failed to delete announcement';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function reorderAnnouncements(
    tournamentId: string,
    orderedIds: string[]
  ): Promise<void> {
    loading.value = true;
    error.value = null;
    
    try {
      const updates = orderedIds.map((id, index) =>
        updateDoc(
          doc(db, `tournaments/${tournamentId}/announcements`, id),
          {
            order: index,
            updatedAt: serverTimestamp(),
          }
        )
      );
      
      await Promise.all(updates);
    } catch (err) {
      console.error('Error reordering announcements:', err);
      error.value = 'Failed to reorder announcements';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    announcements,
    activeAnnouncements,
    loading,
    error,
    fetchAnnouncements,
    subscribeAnnouncements,
    unsubscribeAll,
    addAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    reorderAnnouncements,
  };
}
