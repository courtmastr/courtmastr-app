// useOrgAccess — unified edit permission check for org admin or super admin
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useOrganizationsStore } from '@/stores/organizations'

export function useOrgAccess() {
  const authStore = useAuthStore()
  const orgsStore = useOrganizationsStore()

  // Whether the currently logged-in user is an admin-role member of the current org.
  // uid is read inside computed so it stays reactive if auth resolves after composable setup.
  // When currentOrgMembers is loaded (impersonation flow), checks the members list.
  // When empty (normal non-impersonation flow), falls back to the global isAdmin role check.
  const isOrgMemberAdmin = computed(() => {
    const uid = authStore.currentUser?.id
    if (!uid) return false
    if (orgsStore.currentOrgMembers.length > 0) {
      return orgsStore.currentOrgMembers.some((m) => m.uid === uid && m.role === 'admin')
    }
    // Fallback: global role (admin or organizer) — preserves existing non-impersonation behavior
    return authStore.isAdmin
  })

  // Super admin OR org member admin — use this for all edit/write permission gates
  const canEdit = computed(() => authStore.isSuperAdmin || isOrgMemberAdmin.value)

  return { canEdit, isOrgMemberAdmin }
}
