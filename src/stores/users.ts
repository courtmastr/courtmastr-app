import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  db,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp,
  Timestamp,
} from '@/services/firebase';
import type { User, UserRole } from '@/types';

export const useUserStore = defineStore('users', () => {
  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let usersUnsubscribe: (() => void) | null = null;

  const activeUsers = computed(() =>
    users.value
  );

  const inactiveUsers = computed(() =>
    []
  );

  function convertUserData(id: string, data: Record<string, unknown>): User {
    return {
      id,
      email: (data.email as string) || '',
      displayName: (data.displayName as string) || 'User',
      role: (data.role as UserRole) || 'viewer',
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
    };
  }

  async function fetchUsers(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(usersQuery);
      users.value = snapshot.docs.map((userDoc) => convertUserData(userDoc.id, userDoc.data()));
    } catch (err) {
      console.error('Error fetching users:', err);
      error.value = 'Failed to fetch users';
    } finally {
      loading.value = false;
    }
  }

  function subscribeUsers(): void {
    if (usersUnsubscribe) usersUnsubscribe();

    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    usersUnsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        users.value = snapshot.docs.map((userDoc) => convertUserData(userDoc.id, userDoc.data()));
      },
      (err) => {
        console.error('Error subscribing to users:', err);
        error.value = 'Lost connection to users';
      }
    );
  }

  async function updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    await setDoc(
      doc(db, 'users', userId),
      {
        role: newRole,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function updateUserProfile(
    userId: string,
    updates: Pick<User, 'displayName' | 'email'>
  ): Promise<void> {
    await setDoc(
      doc(db, 'users', userId),
      {
        displayName: updates.displayName,
        email: updates.email,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function setUserActive(
    userId: string,
    isActive: boolean,
    actorUserId: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      isActive,
      updatedAt: serverTimestamp(),
    };

    if (!isActive) {
      updates.deactivatedAt = serverTimestamp();
      updates.deactivatedBy = actorUserId;
    } else {
      updates.deactivatedAt = null;
      updates.deactivatedBy = null;
    }

    await setDoc(doc(db, 'users', userId), updates, { merge: true });
  }

  function unsubscribeAll(): void {
    if (usersUnsubscribe) {
      usersUnsubscribe();
      usersUnsubscribe = null;
    }
  }

  return {
    users,
    loading,
    error,
    activeUsers,
    inactiveUsers,
    fetchUsers,
    subscribeUsers,
    updateUserRole,
    updateUserProfile,
    setUserActive,
    unsubscribeAll,
  };
});
