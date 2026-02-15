// Auth Store - Pinia store for authentication state
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  type FirebaseUser,
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from '@/services/firebase';
import type { User, UserRole } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  // State
  const currentUser = ref<User | null>(null);
  const firebaseUser = ref<FirebaseUser | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);

  // Getters
  const isAuthenticated = computed(() => !!currentUser.value);
  const isAdmin = computed(() => currentUser.value?.role === 'admin' || currentUser.value?.role === 'organizer');
  const isOrganizer = computed(() => currentUser.value?.role === 'organizer' || currentUser.value?.role === 'admin');
  const isScorekeeper = computed(() => currentUser.value?.role === 'scorekeeper' || currentUser.value?.role === 'admin' || currentUser.value?.role === 'organizer');
  const isPlayer = computed(() => currentUser.value?.role === 'player');
  const isViewer = computed(() => !!currentUser.value);
  const userRole = computed(() => currentUser.value?.role || 'viewer');

  // Initialize auth state listener
  function initAuth(): Promise<void> {
    return new Promise((resolve) => {
      onAuthStateChanged(auth, async (user) => {
        firebaseUser.value = user;

        if (user) {
          // Fetch user profile from Firestore
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              currentUser.value = {
                id: user.uid,
                email: user.email || '',
                displayName: user.displayName || userData.displayName || '',
                role: userData.role as UserRole || 'viewer',
                createdAt: userData.createdAt?.toDate() || new Date(),
                updatedAt: userData.updatedAt?.toDate() || new Date(),
              };
            } else {
              // Create default user profile if doesn't exist
              await createUserProfile(user, 'viewer');
            }
          } catch (err) {
            console.error('Error fetching user profile:', err);
            error.value = 'Failed to load user profile';
          }
        } else {
          currentUser.value = null;
        }

        loading.value = false;
        resolve();
      });
    });
  }

  // Create user profile in Firestore
  async function createUserProfile(user: FirebaseUser, role: UserRole = 'viewer'): Promise<void> {
    const userProfile: Omit<User, 'id'> = {
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(doc(db, 'users', user.uid), {
      ...userProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    currentUser.value = {
      id: user.uid,
      ...userProfile,
    };
  }

  // Sign in with email and password
  async function signIn(email: string, password: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      await signInWithEmailAndPassword(auth, email, password);

      // Wait for COMPLETE auth state initialization (currentUser + Firestore profile)
      // The onAuthStateChanged listener in initAuth() fetches the Firestore profile
      // and populates currentUser. We need to wait for that to complete before
      // resolving, otherwise router guards will see isAuthenticated=false.
      await new Promise<void>((resolve) => {
        const maxWaitTime = 10000; // 10 second timeout
        const startTime = Date.now();

        const checkAuth = () => {
          if (currentUser.value) {
            console.log('[signIn] ✅ currentUser populated, auth complete');
            resolve();
          } else if (Date.now() - startTime > maxWaitTime) {
            // Timeout - resolve anyway to prevent infinite hang
            console.warn('[signIn] ⚠️ Timeout waiting for currentUser, proceeding anyway');
            resolve();
          } else {
            setTimeout(checkAuth, 50); // Poll every 50ms
          }
        };

        checkAuth();
      });
    } catch (err: unknown) {
      handleAuthError(err);
    } finally {
      loading.value = false;
    }
  }

  // Register new user
  async function register(email: string, password: string, displayName: string, role: UserRole = 'viewer'): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName });
      await createUserProfile(user, role);
    } catch (err: unknown) {
      handleAuthError(err);
    } finally {
      loading.value = false;
    }
  }

  // Sign out
  async function signOut(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      await firebaseSignOut(auth);
      currentUser.value = null;
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      error.value = firebaseError.message || 'Failed to sign out';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Update user role (admin only)
  async function updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    if (!isAdmin.value) {
      throw new Error('Only admins can update user roles');
    }

    try {
      await setDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.error('Error updating user role:', err);
      throw err;
    }
  }

  // Clear error
  function clearError(): void {
    error.value = null;
  }

  // Helper function to get user-friendly error messages
  function getAuthErrorMessage(code: string): string {
    const errorMessages: Record<string, string> = {
      'auth/email-already-in-use': 'This email is already registered',
      'auth/invalid-email': 'Please enter a valid email address',
      'auth/operation-not-allowed': 'Email/password accounts are not enabled',
      'auth/weak-password': 'Password should be at least 6 characters',
      'auth/user-disabled': 'This account has been disabled',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/invalid-credential': 'Invalid email or password',
      'auth/too-many-requests': 'Too many failed attempts. Please try again later',
    };

    return errorMessages[code] || 'An authentication error occurred';
  }

  // Helper to handle auth errors consistently across signIn, register, and signOut
  function handleAuthError(err: unknown): never {
    const firebaseError = err as { code?: string; message?: string };
    error.value = getAuthErrorMessage(firebaseError.code || 'unknown');
    throw err;
  }

  return {
    // State
    currentUser,
    firebaseUser,
    loading,
    error,
    // Getters
    isAuthenticated,
    isAdmin,
    isOrganizer,
    isScorekeeper,
    isPlayer,
    isViewer,
    userRole,
    // Actions
    initAuth,
    signIn,
    register,
    signOut,
    updateUserRole,
    clearError,
  };
});
