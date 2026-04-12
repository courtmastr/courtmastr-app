// Notifications Store - Pinia store for in-app notifications
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  db,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';
import type { Notification, NotificationType } from '@/types';
import { logger } from '@/utils/logger';

export const useNotificationStore = defineStore('notifications', () => {
  // State
  const notifications = ref<Notification[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Local notifications (for toast messages)
  const toastNotifications = ref<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timeout?: number;
  }>>([]);

  // Real-time listener
  let notificationsUnsubscribe: (() => void) | null = null;

  // Getters
  const unreadNotifications = computed(() =>
    notifications.value.filter((n) => !n.read)
  );

  const unreadCount = computed(() => unreadNotifications.value.length);

  const recentNotifications = computed(() =>
    notifications.value.slice(0, 10)
  );

  // Fetch notifications for current user
  async function fetchNotifications(userId: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      notifications.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Notification[];
    } catch (err) {
      logger.error('Error fetching notifications:', err);
      error.value = 'Failed to load notifications';
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to real-time notification updates
  function subscribeNotifications(userId: string): void {
    if (notificationsUnsubscribe) notificationsUnsubscribe();

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    notificationsUnsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications: Notification[] = [];

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notification = {
            id: change.doc.id,
            ...convertTimestamps(change.doc.data()),
          } as Notification;

          newNotifications.push(notification);

          // Show toast for new notifications
          if (!notification.read) {
            showToast('info', notification.message);
          }
        }
      });

      notifications.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      })) as Notification[];
    }, (err) => {
      logger.error('Error in notifications subscription:', err);
      error.value = 'Lost connection to notifications';
    });
  }

  // Create notification
  async function createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'notifications'), {
        userId,
        type,
        title,
        message,
        data: data || {},
        read: false,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (err) {
      logger.error('Error creating notification:', err);
      throw err;
    }
  }

  // Mark notification as read
  async function markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
      });

      // Update local state
      const notification = notifications.value.find((n) => n.id === notificationId);
      if (notification) {
        notification.read = true;
      }
    } catch (err) {
      logger.error('Error marking notification as read:', err);
      throw err;
    }
  }

  // Mark all notifications as read
  async function markAllAsRead(userId: string): Promise<void> {
    try {
      const unread = notifications.value.filter((n) => !n.read && n.userId === userId);

      await Promise.all(
        unread.map((n) =>
          updateDoc(doc(db, 'notifications', n.id), { read: true })
        )
      );

      // Update local state
      notifications.value.forEach((n) => {
        if (n.userId === userId) {
          n.read = true;
        }
      });
    } catch (err) {
      logger.error('Error marking all notifications as read:', err);
      throw err;
    }
  }

  // Delete notification
  async function deleteNotification(notificationId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
      notifications.value = notifications.value.filter((n) => n.id !== notificationId);
    } catch (err) {
      logger.error('Error deleting notification:', err);
      throw err;
    }
  }

  // Delete all notifications for user
  async function clearAllNotifications(userId: string): Promise<void> {
    try {
      const userNotifications = notifications.value.filter((n) => n.userId === userId);

      await Promise.all(
        userNotifications.map((n) => deleteDoc(doc(db, 'notifications', n.id)))
      );

      notifications.value = notifications.value.filter((n) => n.userId !== userId);
    } catch (err) {
      logger.error('Error clearing notifications:', err);
      throw err;
    }
  }

  // Show toast notification (local only)
  function showToast(
    type: 'success' | 'error' | 'warning' | 'info',
    message: string,
    timeout: number = 5000
  ): void {
    const id = Date.now().toString();
    toastNotifications.value.push({ id, type, message, timeout });

    // Auto-remove after timeout
    if (timeout > 0) {
      setTimeout(() => {
        removeToast(id);
      }, timeout);
    }
  }

  // Remove toast notification
  function removeToast(id: string): void {
    toastNotifications.value = toastNotifications.value.filter((t) => t.id !== id);
  }

  // Cleanup subscription
  function unsubscribe(): void {
    if (notificationsUnsubscribe) {
      notificationsUnsubscribe();
      notificationsUnsubscribe = null;
    }
  }

  return {
    // State
    notifications,
    toastNotifications,
    loading,
    error,
    // Getters
    unreadNotifications,
    unreadCount,
    recentNotifications,
    // Actions
    fetchNotifications,
    subscribeNotifications,
    createNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    showToast,
    removeToast,
    unsubscribe,
  };
});
