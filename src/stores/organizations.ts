// Organizations Store — org CRUD, slug uniqueness, org context switching
import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  db,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  runTransaction,
  query,
  where,
  orderBy,
  serverTimestamp,
} from '@/services/firebase';
import { convertTimestamps } from '@/utils/firestore';
import type { Organization, OrganizationMember, OrgSponsor, Tournament } from '@/types';
import { useAuthStore } from '@/stores/auth';
import { uploadOrgSponsorLogo, deleteOrgBrandingAsset } from '@/services/orgBrandingStorage';

export const useOrganizationsStore = defineStore('organizations', () => {
  const myOrgs = ref<Organization[]>([]);
  const currentOrg = ref<Organization | null>(null);
  const orgTournaments = ref<Tournament[]>([]);
  const currentOrgMembers = ref<OrganizationMember[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchMyOrgs = async (): Promise<void> => {
    const authStore = useAuthStore();
    if (!authStore.currentUser) return;
    loading.value = true;
    try {
      // Fetch all org docs where current user is a member
      // (uses collectionGroup query on members subcollection — collectionGroup imported statically from firebase.ts)
      const membersQ = query(
        collectionGroup(db, 'members'),
        where('uid', '==', authStore.currentUser.id)
      );
      const membersSnap = await getDocs(membersQ);

      const orgIds = membersSnap.docs.map((d) => d.ref.parent.parent!.id);
      if (orgIds.length === 0) {
        myOrgs.value = [];
        return;
      }

      const orgDocs = await Promise.all(
        orgIds.map((id) => getDoc(doc(db, 'organizations', id)))
      );
      myOrgs.value = orgDocs
        .filter((d) => d.exists())
        .map((d) => convertTimestamps({ id: d.id, ...d.data() }) as Organization);
    } catch (err) {
      console.error('Error fetching orgs:', err);
      error.value = 'Failed to fetch organizations';
    } finally {
      loading.value = false;
    }
  };

  const fetchOrgById = async (orgId: string): Promise<Organization | null> => {
    try {
      const snap = await getDoc(doc(db, 'organizations', orgId));
      if (!snap.exists()) return null;
      const org = convertTimestamps({ id: snap.id, ...snap.data() }) as Organization;
      currentOrg.value = org;
      return org;
    } catch (err) {
      console.error('Error fetching org:', err);
      throw err;
    }
  };

  const fetchOrgBySlug = async (slug: string): Promise<Organization | null> => {
    try {
      const indexSnap = await getDoc(doc(db, 'orgSlugIndex', slug));
      if (!indexSnap.exists()) return null;
      const { orgId } = indexSnap.data() as { orgId: string };
      return fetchOrgById(orgId);
    } catch (err) {
      console.error('Error fetching org by slug:', err);
      throw err;
    }
  };

  const createOrg = async (data: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const authStore = useAuthStore();
    if (!authStore.currentUser) throw new Error('Must be authenticated to create an organization');
    const currentUserId = authStore.currentUser.id; // cache before async transaction
    const slugRef = doc(db, 'orgSlugIndex', data.slug);
    return runTransaction(db, async (transaction) => {
      const slugSnap = await transaction.get(slugRef);
      if (slugSnap.exists()) {
        throw new Error(`Slug "${data.slug}" is already taken`);
      }

      const newOrgRef = doc(collection(db, 'organizations'));
      const now = serverTimestamp();

      transaction.set(newOrgRef, {
        ...data,
        id: newOrgRef.id,
        createdAt: now,
        updatedAt: now,
      });

      transaction.set(slugRef, {
        orgId: newOrgRef.id,
        createdAt: now,
      });

      // Add creator as admin member — required for fetchMyOrgs to find this org
      const memberRef = doc(db, `organizations/${newOrgRef.id}/members`, currentUserId);
      transaction.set(memberRef, {
        uid: currentUserId,
        role: 'admin',
        joinedAt: now,
      });

      return newOrgRef.id;
    });
  };

  const updateOrg = async (orgId: string, updates: Partial<Organization>): Promise<void> => {
    // Note: slug changes are not supported via this method (would require updating orgSlugIndex atomically)
    try {
      await updateDoc(doc(db, 'organizations', orgId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      if (currentOrg.value?.id === orgId) {
        currentOrg.value = { ...currentOrg.value, ...updates } as Organization;
      }
    } catch (err) {
      console.error('Error updating org:', err);
      throw err;
    }
  };

  const setActiveOrg = async (orgId: string | null): Promise<void> => {
    const authStore = useAuthStore();
    if (!authStore.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', authStore.currentUser.id), {
        activeOrgId: orgId,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error setting active org:', err);
      throw err;
    }
  };

  const fetchOrgTournaments = async (orgId: string): Promise<void> => {
    try {
      const q = query(
        collection(db, 'tournaments'),
        where('orgId', '==', orgId),
        orderBy('startDate', 'desc')
      );
      const snap = await getDocs(q);
      orgTournaments.value = snap.docs.map((d) =>
        convertTimestamps({ id: d.id, ...d.data() }) as Tournament
      );
    } catch (err) {
      console.error('Error fetching org tournaments:', err);
      throw err;
    }
  };

  const fetchOrgMembers = async (orgId: string): Promise<OrganizationMember[]> => {
    try {
      const snap = await getDocs(collection(db, `organizations/${orgId}/members`));
      return snap.docs.map((d) =>
        convertTimestamps({ ...d.data() }) as OrganizationMember
      );
    } catch (err) {
      console.error('Error fetching org members:', err);
      throw err;
    }
  };

  const addOrgSponsor = async (
    orgId: string,
    sponsorData: { name: string; website?: string },
    logoFile: File
  ): Promise<void> => {
    const org = currentOrg.value;
    if (!org) throw new Error('No current org');

    const sponsorId = `sponsor_${Date.now()}`;
    const { downloadUrl, storagePath } = await uploadOrgSponsorLogo(orgId, sponsorId, logoFile);

    const existing = org.sponsors ?? [];
    const newSponsor: OrgSponsor = {
      id: sponsorId,
      name: sponsorData.name,
      website: sponsorData.website,
      logoUrl: downloadUrl,
      logoPath: storagePath,
      displayOrder: existing.length,
    };

    await updateOrg(orgId, { sponsors: [...existing, newSponsor] });
  };

  const removeOrgSponsor = async (orgId: string, sponsorId: string): Promise<void> => {
    const org = currentOrg.value;
    if (!org) throw new Error('No current org');

    const existing = org.sponsors ?? [];
    const target = existing.find((s) => s.id === sponsorId);

    const updated = existing
      .filter((s) => s.id !== sponsorId)
      .map((s, i) => ({ ...s, displayOrder: i }));

    await updateOrg(orgId, { sponsors: updated });

    if (target?.logoPath) {
      await deleteOrgBrandingAsset(target.logoPath).catch(() => {
        // Non-fatal: storage cleanup can fail silently
      });
    }
  };

  const reorderOrgSponsors = async (orgId: string, sponsors: OrgSponsor[]): Promise<void> => {
    const reordered = sponsors.map((s, i) => ({ ...s, displayOrder: i }));
    await updateOrg(orgId, { sponsors: reordered });
  };

  const addOrgMember = async (orgId: string, memberUid: string, role: string): Promise<void> => {
    try {
      const memberRef = doc(db, `organizations/${orgId}/members`, memberUid);
      await setDoc(memberRef, {
        uid: memberUid,
        role,
        joinedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error adding org member:', err);
      throw err;
    }
  };

  return {
    myOrgs,
    currentOrg,
    orgTournaments,
    currentOrgMembers,
    loading,
    error,
    fetchMyOrgs,
    fetchOrgById,
    fetchOrgBySlug,
    createOrg,
    updateOrg,
    setActiveOrg,
    fetchOrgTournaments,
    fetchOrgMembers,
    addOrgMember,
    addOrgSponsor,
    removeOrgSponsor,
    reorderOrgSponsors,
  };
});
