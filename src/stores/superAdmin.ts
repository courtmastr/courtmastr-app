// Super Admin Store — platform-level org browsing and impersonation
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { deleteField } from 'firebase/firestore'
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from '@/services/firebase'
import { convertTimestamps } from '@/utils/firestore'
import type { Organization } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationsStore } from '@/stores/organizations'
import { useTournamentStore } from '@/stores/tournaments'
import { useRouter } from 'vue-router'

interface PlatformStats {
  totalOrgs: number
  activeTournaments: number
  totalPlayers: number
  newOrgsLast30Days: number
}

export const useSuperAdminStore = defineStore('superAdmin', () => {
  const router = useRouter()
  const allOrgs = ref<Organization[]>([])
  const viewingOrgId = ref<string | null>(null)
  const viewingOrg = ref<Organization | null>(null)
  const platformStats = ref<PlatformStats | null>(null)
  const loading = ref(false)

  const isImpersonating = computed(() => viewingOrgId.value !== null)

  async function fetchAllOrgs(): Promise<void> {
    loading.value = true
    try {
      const snap = await getDocs(collection(db, 'organizations'))
      allOrgs.value = snap.docs.map(
        (d) => convertTimestamps({ id: d.id, ...d.data() }) as Organization
      )
    } finally {
      loading.value = false
    }
  }

  async function fetchPlatformStats(): Promise<void> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [orgsSnap, activeTournamentsSnap, playersSnap, newOrgsSnap] = await Promise.all([
      getDocs(collection(db, 'organizations')),
      getDocs(query(collection(db, 'tournaments'), where('status', '==', 'active'))),
      getDocs(collection(db, 'players')),
      getDocs(
        query(collection(db, 'organizations'), where('createdAt', '>=', thirtyDaysAgo))
      ),
    ])

    platformStats.value = {
      totalOrgs: orgsSnap.size,
      activeTournaments: activeTournamentsSnap.size,
      totalPlayers: playersSnap.size,
      newOrgsLast30Days: newOrgsSnap.size,
    }
  }

  async function enterOrg(orgId: string): Promise<void> {
    const orgsStore = useOrganizationsStore()
    const tournamentsStore = useTournamentStore()
    const snap = await getDoc(doc(db, 'organizations', orgId))
    if (!snap.exists()) return
    viewingOrgId.value = orgId
    viewingOrg.value = convertTimestamps({ id: snap.id, ...snap.data() }) as Organization
    orgsStore.currentOrg = viewingOrg.value
    orgsStore.currentOrgMembers = await orgsStore.fetchOrgMembers(orgId)
    tournamentsStore.unsubscribeTournaments()
    router.push('/tournaments')
  }

  function exitOrg(): void {
    const orgsStore = useOrganizationsStore()
    const authStore = useAuthStore()
    const tournamentsStore = useTournamentStore()
    viewingOrgId.value = null
    viewingOrg.value = null
    const activeId = authStore.currentUser?.activeOrgId
    orgsStore.currentOrg = activeId
      ? orgsStore.myOrgs.find((o) => o.id === activeId) ?? null
      : null
    orgsStore.currentOrgMembers = []
    tournamentsStore.unsubscribeTournaments()
    router.push('/super/orgs')
  }

  async function suspendOrg(orgId: string): Promise<void> {
    const authStore = useAuthStore()
    await updateDoc(doc(db, 'organizations', orgId), {
      suspended: true,
      suspendedAt: serverTimestamp(),
      suspendedBy: authStore.currentUser!.id,
    })
    const update = { suspended: true as const, suspendedBy: authStore.currentUser!.id }
    if (viewingOrg.value?.id === orgId) {
      viewingOrg.value = { ...viewingOrg.value, ...update }
    }
    const idx = allOrgs.value.findIndex((o) => o.id === orgId)
    if (idx !== -1) allOrgs.value[idx] = { ...allOrgs.value[idx], ...update }
  }

  async function unsuspendOrg(orgId: string): Promise<void> {
    await updateDoc(doc(db, 'organizations', orgId), {
      suspended: false,
      suspendedAt: deleteField(),
      suspendedBy: deleteField(),
    })
    if (viewingOrg.value?.id === orgId) {
      const { suspendedAt: _a, suspendedBy: _b, ...rest } = viewingOrg.value
      viewingOrg.value = { ...rest, suspended: false }
    }
    const idx = allOrgs.value.findIndex((o) => o.id === orgId)
    if (idx !== -1) {
      const { suspendedAt: _a, suspendedBy: _b, ...rest } = allOrgs.value[idx]
      allOrgs.value[idx] = { ...rest, suspended: false }
    }
  }

  return {
    allOrgs,
    viewingOrgId,
    viewingOrg,
    platformStats,
    loading,
    isImpersonating,
    fetchAllOrgs,
    fetchPlatformStats,
    enterOrg,
    exitOrg,
    suspendOrg,
    unsuspendOrg,
  }
})
