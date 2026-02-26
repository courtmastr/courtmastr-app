import type { UserRole } from '@/types';
import { serverTimestamp } from 'firebase/firestore';
import { mergeDocument, seedDocument } from './firestore-fixtures';

export interface EmulatorUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive?: boolean;
}

export const buildUserProfile = (
  uid: string,
  overrides: Partial<Omit<EmulatorUserProfile, 'uid'>> = {}
): EmulatorUserProfile => ({
  uid,
  email: overrides.email ?? `${uid}@example.test`,
  displayName: overrides.displayName ?? uid,
  role: overrides.role ?? 'viewer',
  isActive: overrides.isActive ?? true,
});

export const seedUserProfile = async (
  profile: EmulatorUserProfile
): Promise<void> => {
  await seedDocument(`users/${profile.uid}`, {
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
    isActive: profile.isActive ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const setUserActive = async (
  uid: string,
  isActive: boolean,
  actorUserId: string
): Promise<void> => {
  await mergeDocument(`users/${uid}`, {
    isActive,
    updatedAt: serverTimestamp(),
    deactivatedAt: isActive ? null : serverTimestamp(),
    deactivatedBy: isActive ? null : actorUserId,
  });
};
