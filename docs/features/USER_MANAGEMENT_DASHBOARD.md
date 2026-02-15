# User Management Dashboard - Implementation Specification

## Overview

This document specifies the requirements and implementation details for the User Management Dashboard, a critical missing feature for production readiness. The dashboard will allow administrators to manage users, assign roles, and monitor user activity.

**Status:** Not Implemented  
**Priority:** Critical (Blocking Production)  
**Effort Estimate:** 3-5 days  
**Related Files:**
- `/src/stores/auth.ts` - Current auth store with basic user role management
- `/src/types/index.ts` - User type definitions
- `/firestore.rules` - User data access rules
- `/src/router/index.ts` - Route guards and navigation

---

## Current State Analysis

### What's Implemented

1. **Authentication System** (`/src/stores/auth.ts`)
   - Email/password authentication via Firebase
   - 5 role types: `admin`, `organizer`, `scorekeeper`, `player`, `viewer`
   - Role-based access control in router guards
   - `updateUserRole()` function for admins (lines 167-182)
   - User profile creation on signup

2. **User Type Definition** (`/src/types/index.ts` lines 6-15)
   ```typescript
   export type UserRole = 'admin' | 'organizer' | 'scorekeeper' | 'player' | 'viewer';
   
   export interface User {
     id: string;
     email: string;
     displayName: string;
     role: UserRole;
     createdAt: Date;
     updatedAt: Date;
   }
   ```

3. **Firestore Security Rules** (`/firestore.rules` lines 23-34)
   - Any authenticated user can read all user profiles
   - Users can update their own profile (except role field)
   - Only admins can update roles and delete users
   - Admin check uses Firestore role lookup

4. **Router Guards** (`/src/router/index.ts` lines 179-218)
   - `requiresAdmin` - for admin-only routes
   - `requiresScorekeeper` - for scorekeeper+ routes
   - Automatic redirects for unauthorized access

### What's Missing

1. ❌ **No User List View** - Cannot see all users in the system
2. ❌ **No User Search/Filter** - Cannot find specific users
3. ❌ **No Role Assignment UI** - Can only change roles programmatically
4. ❌ **No User Profile Management** - Cannot edit user details as admin
5. ❌ **No User Activity Logs** - Cannot track user actions
6. ❌ **No Bulk Operations** - Cannot manage multiple users at once
7. ❌ **No User Invitations** - Cannot invite new users
8. ❌ **No Password Reset UI** - Users cannot reset passwords
9. ❌ **No User Statistics** - Cannot see user participation data
10. ❌ **No Deactivation/Suspension** - Can only delete users permanently

---

## Required Features

### Phase 1: Core User Management (Critical)

#### 1. User List View
**Priority:** Critical  
**Effort:** 1 day

**Requirements:**
- Display all users in a data table
- Columns: Display Name, Email, Role, Created Date, Last Active
- Pagination (25/50/100 per page)
- Sortable columns
- Responsive design for mobile

**Technical Details:**
```typescript
// New composable: /src/composables/useUserManagement.ts
interface UserListFilters {
  role?: UserRole;
  search?: string; // Search in name/email
  dateFrom?: Date;
  dateTo?: Date;
}

interface UserListItem extends User {
  lastLoginAt?: Date;
  tournamentCount: number;
  isActive: boolean;
}
```

**Firestore Query:**
```typescript
// Query users collection with pagination
const usersQuery = query(
  collection(db, 'users'),
  orderBy('createdAt', 'desc'),
  limit(pageSize)
);
```

**UI Component:**
- Route: `/admin/users`
- Component: `/src/features/admin/views/UserManagementView.vue`
- Reuse existing table patterns from RegistrationManagementView

#### 2. Role Assignment UI
**Priority:** Critical  
**Effort:** 0.5 days

**Requirements:**
- Inline role editing in user list
- Role dropdown: admin, organizer, scorekeeper, player, viewer
- Confirmation dialog for role changes
- Toast notification on success/error
- Prevent self-demotion (admin cannot remove own admin role)

**Technical Details:**
- Use existing `updateUserRole()` in auth store
- Add check: `if (userId === currentUser.value?.id && newRole !== 'admin')` show warning
- Log role changes to activity feed

**UI Pattern:**
```vue
<v-select
  v-model="user.role"
  :items="roleOptions"
  @update:model-value="(newRole) => confirmRoleChange(user, newRole)"
/>
```

#### 3. User Search & Filter
**Priority:** Critical  
**Effort:** 0.5 days

**Requirements:**
- Search by display name or email (case-insensitive)
- Filter by role
- Filter by date range (created date)
- Clear filters button
- Results count display

**Technical Details:**
- Client-side filtering (Firestore doesn't support case-insensitive search)
- Debounce search input (300ms)
- URL query params for shareable filtered views

#### 4. User Profile Edit
**Priority:** High  
**Effort:** 0.5 days

**Requirements:**
- Edit user display name
- Edit user email (with re-authentication if needed)
- View user details in dialog/sidebar
- Show user statistics (tournaments, matches played)

**Technical Details:**
- Extend User type with additional fields:
  ```typescript
  interface UserExtended extends User {
    phone?: string;
    avatarUrl?: string;
    preferences?: UserPreferences;
    lastLoginAt?: Date;
    loginCount: number;
  }
  ```

**UI Pattern:**
- Dialog or slide-out panel
- Form with validation
- Save/Cancel actions

### Phase 2: Enhanced User Management (High Priority)

#### 5. User Activity Logs
**Priority:** High  
**Effort:** 1 day

**Requirements:**
- Track user actions: login, logout, role changes, tournament participation
- View activity history per user
- Filter by action type and date range
- Export activity logs

**Technical Details:**
```typescript
// New collection: /users/{userId}/activity_logs/{logId}
interface UserActivityLog {
  id: string;
  userId: string;
  action: 'login' | 'logout' | 'role_changed' | 'profile_updated' | 'tournament_joined' | 'match_scored';
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}
```

**Implementation:**
- Create Cloud Function to log activities
- Add logging hooks to auth store
- UI: Activity tab in user profile

#### 6. User Invitations
**Priority:** High  
**Effort:** 1 day

**Requirements:**
- Invite new users by email
- Pre-assign role during invitation
- Generate invitation links
- Track invitation status (pending, accepted, expired)
- Resend/cancel invitations

**Technical Details:**
```typescript
// New collection: /invitations/{invitationId}
interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt: Date;
  createdAt: Date;
  acceptedAt?: Date;
  acceptedBy?: string;
}
```

**Flow:**
1. Admin enters email and selects role
2. System creates invitation record
3. Send email with invitation link (future: email integration)
4. User clicks link → registration page with pre-filled role
5. On registration, mark invitation as accepted

#### 7. Password Reset Management
**Priority:** High  
**Effort:** 0.5 days

**Requirements:**
- Admin can trigger password reset for any user
- User self-service password reset
- Password reset email (future: email integration)
- Force password change on next login option

**Technical Details:**
```typescript
// In auth store
async function sendPasswordReset(email: string): Promise<void>;
async function resetPassword(code: string, newPassword: string): Promise<void>;
async function forcePasswordReset(userId: string): Promise<void>;
```

#### 8. User Deactivation (Soft Delete)
**Priority:** Medium  
**Effort:** 0.5 days

**Requirements:**
- Deactivate user (prevent login) without deleting data
- Reactivate deactivated users
- View deactivated users separately
- Show deactivation reason

**Technical Details:**
```typescript
interface User {
  // ... existing fields
  isActive: boolean;
  deactivatedAt?: Date;
  deactivatedBy?: string;
  deactivationReason?: string;
}
```

**Firestore Rule Update:**
```
allow read: if isAuthenticated() && resource.data.isActive == true;
```

### Phase 3: Advanced Features (Nice to Have)

#### 9. Bulk User Operations
**Priority:** Medium  
**Effort:** 1 day

**Requirements:**
- Select multiple users
- Bulk role assignment
- Bulk activation/deactivation
- Bulk delete (with confirmation)
- Export user list to CSV

#### 10. User Statistics Dashboard
**Priority:** Medium  
**Effort:** 1 day

**Requirements:**
- Total users by role (chart)
- User growth over time (chart)
- Active users (last 30 days)
- Most active users
- Users by tournament participation

#### 11. Permission Templates
**Priority:** Low  
**Effort:** 2 days

**Requirements:**
- Create custom permission templates
- Granular permissions beyond roles
- Tournament-specific permissions
- Time-based permissions

---

## Technical Implementation

### New Files Required

```
src/
├── features/
│   └── admin/
│       ├── views/
│       │   └── UserManagementView.vue      # Main user list
│       ├── components/
│       │   ├── UserListTable.vue           # Reusable table
│       │   ├── UserEditDialog.vue          # Edit user modal
│       │   ├── UserActivityLog.vue         # Activity history
│       │   ├── UserInviteDialog.vue        # Invite new user
│       │   └── RoleSelector.vue            # Role dropdown
│       └── composables/
│           └── useUserManagement.ts        # User management logic
├── stores/
│   └── users.ts                            # User management store
└── types/
    └── user.ts                             # Extended user types
```

### Route Configuration

```typescript
// Add to /src/router/index.ts
{
  path: '/admin/users',
  name: 'user-management',
  component: () => import('@/features/admin/views/UserManagementView.vue'),
  meta: { requiresAuth: true, requiresAdmin: true },
},
{
  path: '/admin/users/:userId',
  name: 'user-detail',
  component: () => import('@/features/admin/views/UserDetailView.vue'),
  meta: { requiresAuth: true, requiresAdmin: true },
},
```

### Store Implementation

```typescript
// /src/stores/users.ts
export const useUsersStore = defineStore('users', () => {
  // State
  const users = ref<User[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastDoc = ref<QueryDocumentSnapshot<DocumentData> | null>(null);
  
  // Actions
  async function fetchUsers(filters?: UserListFilters, pageSize = 25);
  async function fetchNextPage();
  async function updateUser(userId: string, updates: Partial<User>);
  async function deleteUser(userId: string);
  async function inviteUser(email: string, role: UserRole);
  async function fetchUserActivity(userId: string);
  
  return {
    users,
    loading,
    error,
    fetchUsers,
    updateUser,
    deleteUser,
    inviteUser,
  };
});
```

### Firestore Index Requirements

Add to `/firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isActive", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## UI/UX Design

### User Management View Layout

```
┌─────────────────────────────────────────────────────────────┐
│ User Management                                    [+ Invite] │
├─────────────────────────────────────────────────────────────┤
│ Search: [________________] Role: [All ▼] Status: [Active ▼]  │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────┬──────────────┬───────────┬──────────┬─────────┐ │
│ │ Name     │ Email        │ Role      │ Created  │ Actions │ │
│ ├──────────┼──────────────┼───────────┼──────────┼─────────┤ │
│ │ John Doe │ john@exam... │ Admin     │ Jan 15   │ [Edit]  │ │
│ │ Jane Sm..│ jane@exam... │ Organizer │ Jan 14   │ [Edit]  │ │
│ │ ...      │ ...          │ ...       │ ...      │ ...     │ │
│ └──────────┴──────────────┴───────────┴──────────┴─────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Showing 1-25 of 156 users              [Previous] [Next]     │
└─────────────────────────────────────────────────────────────┘
```

### User Edit Dialog

```
┌──────────────────────────────────────┐
│ Edit User                    [X]     │
├──────────────────────────────────────┤
│ Profile                              │
│ ├─ Display Name: [John Doe    ]      │
│ ├─ Email:        [john@example.com]  │
│ ├─ Phone:        [+1 555-0123 ]      │
│ └─ Role:         [Admin       ▼]     │
│                                      │
│ Statistics                           │
│ ├─ Tournaments:  5                   │
│ ├─ Matches:      23                  │
│ └─ Last Active:  2 hours ago         │
│                                      │
│ Activity Log [View All]              │
│ ├─ Jan 15: Logged in                 │
│ ├─ Jan 14: Updated profile           │
│ └─ Jan 12: Joined tournament         │
│                                      │
│           [Cancel] [Save Changes]    │
└──────────────────────────────────────┘
```

---

## Security Considerations

1. **Admin Self-Protection**
   - Prevent admin from removing their own admin role
   - Require confirmation for self-destructive actions
   - Log all admin actions to audit trail

2. **Role Escalation Prevention**
   - Only admins can assign admin role
   - Validate role in Firestore rules
   - Log all role changes with old/new values

3. **Data Protection**
   - Don't expose sensitive fields (password hashes, tokens)
   - Respect user privacy settings
   - GDPR compliance for data export/deletion

4. **Access Control**
   - All user management routes require admin role
   - API calls validated server-side
   - Rate limiting on user operations

---

## Testing Requirements

### Unit Tests
- User store actions (fetch, update, delete)
- Composable functions
- Component rendering

### E2E Tests
- Admin can view user list
- Admin can change user role
- Admin can invite new user
- Non-admin cannot access user management
- Self-demotion prevention

---

## Migration Notes

### For Existing Users
- All existing users remain active
- Default role: `viewer` (if not set)
- No data migration required

### Firestore Rules Update
Current rules allow any authenticated user to read all profiles:
```
allow read: if isAuthenticated();
```

This is acceptable for admin functionality but consider restricting:
```
allow read: if isAdmin() || isOwner(userId);
```

---

## Future Enhancements

1. **Email Integration** - Automated emails for invitations, password resets
2. **OAuth Providers** - Google, Apple, Facebook login
3. **Two-Factor Authentication** - Enhanced security
4. **User Groups** - Organize users into teams/clubs
5. **Tournament-Specific Permissions** - Grant access per tournament
6. **API Keys** - Service account management

---

## Acceptance Criteria

- [ ] Admin can view list of all users
- [ ] Admin can search and filter users
- [ ] Admin can change user roles
- [ ] Admin can edit user profiles
- [ ] Admin can invite new users
- [ ] Admin can deactivate/reactivate users
- [ ] Admin can view user activity logs
- [ ] Non-admin users cannot access user management
- [ ] Admin cannot remove their own admin role accidentally
- [ ] All changes are logged to activity feed
- [ ] Mobile-responsive design
- [ ] Loading states and error handling
- [ ] Toast notifications for all actions

---

## Related Documentation

- [Authentication Flow](../AGENTS.md) - Current auth implementation
- [Firestore Security Rules](../../firestore.rules) - Data access rules
- [Type Definitions](../../src/types/index.ts) - User type definitions
- [Production Readiness](./PRODUCTION_READINESS.md) - Overall readiness checklist

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-14  
**Author:** Sisyphus AI  
**Status:** Draft - Ready for Implementation
