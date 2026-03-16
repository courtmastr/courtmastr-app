// Dashboard Store — aggregated counts using getCountFromServer (no document reads)
import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  db,
  collection,
  collectionGroup,
  query,
  where,
  getCountFromServer,
  getDocs,
  orderBy,
  limit,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  tournamentId?: string;
}

export const useDashboardStore = defineStore('dashboard', () => {
  const pendingRegistrationCount = ref(0);
  const totalPlayerCount = ref(0);
  const recentActivity = ref<ActivityItem[]>([]);
  const loading = ref(false);

  const fetchCounts = async (): Promise<void> => {
    loading.value = true;
    try {
      const [pendingSnap, playersSnap] = await Promise.all([
        getCountFromServer(
          query(collectionGroup(db, 'registrations'), where('status', '==', 'pending'))
        ),
        getCountFromServer(collection(db, 'players')),
      ]);

      pendingRegistrationCount.value = pendingSnap.data().count;
      totalPlayerCount.value = playersSnap.data().count;
    } catch (err) {
      console.error('Error fetching dashboard counts:', err);
    } finally {
      loading.value = false;
    }
  };

  const fetchRecentActivity = async (): Promise<void> => {
    try {
      const q = query(
        collectionGroup(db, 'activities'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const snap = await getDocs(q);
      recentActivity.value = snap.docs.map((d) =>
        convertTimestamps({ id: d.id, ...d.data() }) as ActivityItem
      );
    } catch (err) {
      console.error('Error fetching recent activity:', err);
    }
  };

  const refresh = async (): Promise<void> => {
    await Promise.all([fetchCounts(), fetchRecentActivity()]);
  };

  return {
    pendingRegistrationCount,
    totalPlayerCount,
    recentActivity,
    loading,
    refresh,
  };
});
