# Player Check-in System - Implementation Specification

## Overview

A streamlined player check-in system for tournament day operations. Allows administrators to quickly check in participants as they arrive, manage no-shows, and get real-time visibility into attendance. Includes both admin bulk check-in interface and self-service mobile check-in options.

**Status:** Partially Implemented (Backend Only)  
**Priority:** High  
**Effort Estimate:** 2 days  
**Related Files:**
- `/src/stores/registrations.ts` - Has `checkInRegistration()` function (lines 330-336)
- `/src/types/index.ts` - RegistrationStatus includes 'checked_in' (line 126)
- `/src/features/registration/views/RegistrationManagementView.vue` - Existing registration management

---

## Current State Analysis

### What's Implemented

1. **Backend Support** (`/src/stores/registrations.ts`)
   ```typescript
   async function checkInRegistration(
     tournamentId: string,
     registrationId: string
   ): Promise<void> {
     await updateRegistrationStatus(tournamentId, registrationId, 'checked_in');
   }
   ```

2. **Status Tracking** (`/src/types/index.ts` line 126)
   ```typescript
   export type RegistrationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'checked_in';
   ```

3. **Undo Functionality** (`/src/stores/registrations.ts` lines 338-346)
   ```typescript
   async function undoCheckIn(
     tournamentId: string,
     registrationId: string,
     approvedBy?: string
   ): Promise<void> {
     await updateRegistrationStatus(tournamentId, registrationId, 'approved', approvedBy);
   }
   ```

4. **Filter by Status** (`/src/stores/registrations.ts` lines 41-43)
   ```typescript
   const checkedInRegistrations = computed(() =>
     registrations.value.filter((r) => r.status === 'checked_in')
   );
   ```

### What's Missing

1. ❌ **No Dedicated Check-in UI** - Only available in general registration management
2. ❌ **No Bulk Check-in** - Cannot check in multiple players at once
3. ❌ **No Mobile Self Check-in** - Players cannot check themselves in
4. ❌ **No QR Code Support** - No quick scanning capability
5. ❌ **No Check-in Statistics** - No visibility into attendance rates
6. ❌ **No Late Arrival Tracking** - No timestamps for check-in times
7. ❌ **No No-Show Management** - Cannot mark players as no-shows
8. ❌ **No Bib/Number Assignment** - Cannot assign player numbers during check-in

---

## Required Features

### Phase 1: Admin Check-in Interface (1 day)

#### 1.1 Quick Check-in Dashboard
**Priority:** Critical  
**Effort:** 0.5 days

**Purpose:** Fast, streamlined interface for tournament day check-in operations

**Key Features:**
- Large, touch-friendly buttons
- Real-time search by name
- Category filtering
- Check-in status indicators
- Bulk check-in actions
- Offline support (queue actions when reconnect)

**UI Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Player Check-in                                    [Close]  │
├─────────────────────────────────────────────────────────────┤
│ Search: [__________________________] [🔍] [Filter ▼]        │
├─────────────────────────────────────────────────────────────┤
│ Stats: Approved: 45 | Checked In: 32 | No Show: 3          │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☑️ John Smith                    [Check In] [No Show]  │ │
│ │    Men's Singles · Approved 2 days ago                  │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ☑️ Jane Doe                      [✓ Checked In 9:15am] │ │
│ │    Women's Singles · Checked in 15 min ago              │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ☑️ Mike Johnson                  [Check In] [No Show]  │ │
│ │    Men's Doubles · Approved 1 week ago                  │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ [Check In Selected (2)]  [Mark No Show]  [Print Bibs]      │
└─────────────────────────────────────────────────────────────┘
```

**Route:** `/tournaments/:tournamentId/check-in`  
**Component:** `/src/features/checkin/views/CheckInDashboardView.vue`

**Implementation:**
```typescript
// Composable: /src/features/checkin/composables/useCheckIn.ts
export function useCheckIn(tournamentId: string) {
  const registrations = ref<Registration[]>([]);
  const selectedRegistrations = ref<string[]>([]);
  const loading = ref(false);
  
  async function checkInSingle(registrationId: string);
  async function checkInBulk(registrationIds: string[]);
  async function markNoShow(registrationId: string);
  async function undoCheckIn(registrationId: string);
  
  const stats = computed(() => ({
    total: registrations.value.length,
    checkedIn: registrations.value.filter(r => r.status === 'checked_in').length,
    noShow: registrations.value.filter(r => r.status === 'no_show').length,
    pending: registrations.value.filter(r => r.status === 'approved').length,
  }));
  
  return {
    registrations,
    selectedRegistrations,
    loading,
    checkInSingle,
    checkInBulk,
    markNoShow,
    undoCheckIn,
    stats,
  };
}
```

#### 1.2 Check-in Statistics Panel
**Priority:** High  
**Effort:** 0.25 days

**Metrics to Display:**
```typescript
interface CheckInStats {
  totalRegistered: number;
  checkedIn: number;
  notCheckedIn: number;
  noShows: number;
  checkInRate: number; // percentage
  
  // By Category
  categoryStats: {
    categoryId: string;
    categoryName: string;
    total: number;
    checkedIn: number;
    checkInRate: number;
  }[];
  
  // Timeline
  checkInsByHour: {
    hour: number;
    count: number;
  }[];
  
  // Late arrivals (checked in after first match)
  lateArrivals: number;
}
```

**UI Component:**
- Real-time updating cards
- Category breakdown chart
- Hourly check-in timeline
- Alert for low check-in rates

#### 1.3 Bib/Number Assignment
**Priority:** High  
**Effort:** 0.25 days

**Features:**
- Auto-assign sequential numbers during check-in
- Manual number assignment
- Prevent duplicates
- Print bib labels
- Export bib assignments

**Data Model Extension:**
```typescript
// Extend Registration type
interface Registration {
  // ... existing fields
  bibNumber?: number;
  checkedInAt?: Date;
  checkedInBy?: string;
  noShow?: boolean;
  noShowMarkedAt?: Date;
  noShowMarkedBy?: string;
}
```

### Phase 2: Self-Service Check-in (1 day)

#### 2.1 Mobile Self Check-in
**Priority:** High  
**Effort:** 0.5 days

**Purpose:** Allow players to check themselves in using their mobile devices

**Flow:**
1. Player navigates to `/check-in/:tournamentId`
2. Enters email or registration confirmation number
3. System finds their registration
4. Player confirms identity and checks in
5. Success screen shows bib number and next steps

**Security Considerations:**
- Only allow check-in during tournament day
- Prevent duplicate check-ins
- CAPTCHA or rate limiting to prevent abuse
- Email confirmation optional

**UI Design (Mobile-First):**
```
┌─────────────────────────────┐
│     Tournament Check-in     │
├─────────────────────────────┤
│                             │
│  Welcome to                 │
│  Summer Badminton Open      │
│                             │
│  Enter your email:          │
│  ┌─────────────────────┐   │
│  │ you@example.com     │   │
│  └─────────────────────┘   │
│                             │
│  OR                         │
│                             │
│  Confirmation #:            │
│  ┌─────────────────────┐   │
│  │ ABC123              │   │
│  └─────────────────────┘   │
│                             │
│       [Find My Registration]│
│                             │
└─────────────────────────────┘
```

**After Found:**
```
┌─────────────────────────────┐
│     Tournament Check-in     │
├─────────────────────────────┤
│                             │
│  Hi John Smith! 👋          │
│                             │
│  Category: Men's Singles    │
│  Status: Approved ✓         │
│                             │
│  Ready to check in?         │
│                             │
│    [✓ Check Me In]          │
│                             │
│  Your bib number: 42        │
│                             │
│  First match: Court 3       │
│  Estimated: 10:30 AM        │
│                             │
└─────────────────────────────┘
```

**Route:** `/tournaments/:tournamentId/self-check-in`  
**Component:** `/src/features/checkin/views/SelfCheckInView.vue`

#### 2.2 QR Code Check-in
**Priority:** Medium  
**Effort:** 0.5 days

**Features:**
- Generate unique QR codes for each registration
- QR code contains: tournamentId, registrationId, confirmationToken
- Scan QR code to instantly check in
- Works with mobile camera or dedicated scanner

**Implementation:**
```typescript
// Generate QR code data
interface QRCodeData {
  v: number; // version
  t: string; // tournamentId
  r: string; // registrationId
  c: string; // confirmation token (for verification)
}

// QR code string (JSON encoded)
const qrData = JSON.stringify({
  v: 1,
  t: tournamentId,
  r: registrationId,
  c: generateConfirmationToken(),
});
```

**QR Code Display:**
- Sent in confirmation email
- Available in player's dashboard
- Can be displayed at check-in desk

**Scanning Interface:**
```typescript
// Admin scanning interface
async function scanQRCode(qrData: string): Promise<void> {
  const data = JSON.parse(qrData) as QRCodeData;
  
  // Verify token
  const isValid = await verifyConfirmationToken(data.r, data.c);
  if (!isValid) {
    throw new Error('Invalid QR code');
  }
  
  // Check in the player
  await checkInRegistration(data.t, data.r);
}
```

**Libraries:**
- `qrcode` - Generate QR codes
- `html5-qrcode` - Scan QR codes via camera

---

## Technical Implementation

### New Files Required

```
src/
├── features/
│   └── checkin/
│       ├── views/
│       │   ├── CheckInDashboardView.vue    # Admin check-in interface
│       │   └── SelfCheckInView.vue         # Player self check-in
│       ├── components/
│       │   ├── CheckInList.vue             # Check-in list with actions
│       │   ├── CheckInStatsPanel.vue       # Statistics display
│       │   ├── PlayerSearch.vue            # Search component
│       │   ├── BibAssignment.vue           # Bib number assignment
│       │   ├── QRCodeDisplay.vue           # Show QR code
│       │   └── QRCodeScanner.vue           # Scan QR code
│       └── composables/
│           ├── useCheckIn.ts               # Check-in logic
│           ├── useSelfCheckIn.ts           # Self check-in logic
│           └── useQRCode.ts                # QR code generation/scanning
├── stores/
│   └── checkin.ts                          # Check-in store (if needed)
└── types/
    └── checkin.ts                          # Check-in type extensions
```

### Route Configuration

```typescript
// Add to /src/router/index.ts
// Admin check-in
{
  path: '/tournaments/:tournamentId/check-in',
  name: 'check-in-dashboard',
  component: () => import('@/features/checkin/views/CheckInDashboardView.vue'),
  meta: { requiresAuth: true, requiresAdmin: true },
},

// Self check-in (public)
{
  path: '/tournaments/:tournamentId/self-check-in',
  name: 'self-check-in',
  component: () => import('@/features/checkin/views/SelfCheckInView.vue'),
  meta: { requiresAuth: false },
},
```

### Store Extensions

```typescript
// /src/stores/registrations.ts - Add these actions

async function markNoShow(
  tournamentId: string,
  registrationId: string,
  reason?: string
): Promise<void> {
  await updateDoc(
    doc(db, `tournaments/${tournamentId}/registrations`, registrationId),
    {
      status: 'no_show',
      noShow: true,
      noShowMarkedAt: serverTimestamp(),
      noShowMarkedBy: currentUser.value?.id,
      noShowReason: reason || null,
      updatedAt: serverTimestamp(),
    }
  );
}

async function assignBibNumber(
  tournamentId: string,
  registrationId: string,
  bibNumber: number
): Promise<void> {
  // Check for duplicate
  const existingQuery = query(
    collection(db, `tournaments/${tournamentId}/registrations`),
    where('bibNumber', '==', bibNumber)
  );
  const existing = await getDocs(existingQuery);
  
  if (!existing.empty) {
    throw new Error(`Bib number ${bibNumber} is already assigned`);
  }
  
  await updateDoc(
    doc(db, `tournaments/${tournamentId}/registrations`, registrationId),
    {
      bibNumber,
      updatedAt: serverTimestamp(),
    }
  );
}

async function autoAssignBibNumbers(tournamentId: string): Promise<void> {
  // Get all checked-in registrations without bib numbers
  const uncheckedQuery = query(
    collection(db, `tournaments/${tournamentId}/registrations`),
    where('status', '==', 'checked_in'),
    where('bibNumber', '==', null)
  );
  
  const snapshot = await getDocs(uncheckedQuery);
  let nextBib = 1;
  
  const batch = writeBatch(db);
  
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, {
      bibNumber: nextBib++,
      updatedAt: serverTimestamp(),
    });
  });
  
  await batch.commit();
}
```

### Type Extensions

```typescript
// /src/types/checkin.ts

// Extend Registration interface
export interface RegistrationWithCheckIn extends Registration {
  bibNumber?: number;
  checkedInAt?: Date;
  checkedInBy?: string;
  noShow?: boolean;
  noShowMarkedAt?: Date;
  noShowMarkedBy?: string;
  noShowReason?: string;
}

export interface CheckInStats {
  total: number;
  checkedIn: number;
  notCheckedIn: number;
  noShows: number;
  checkInRate: number;
}

export interface SelfCheckInRequest {
  tournamentId: string;
  email?: string;
  confirmationNumber?: string;
}

export interface QRCodeData {
  v: number;
  t: string;
  r: string;
  c: string;
}
```

### Firestore Security Rules

Add to `/firestore.rules`:
```
// Allow self check-in during tournament
match /tournaments/{tournamentId}/registrations/{registrationId} {
  allow update: if isAuthenticated() 
    && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['status', 'checkedInAt', 'updatedAt'])
    && request.resource.data.status == 'checked_in'
    && resource.data.status == 'approved'
    && request.auth.token.email == resource.data.email; // Match email
  
  // Admin can do full updates
  allow update: if isAdmin();
}
```

### Firestore Index

Add to `/firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "registrations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "bibNumber", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "registrations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "categoryId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## UI/UX Design

### Admin Check-in Dashboard

```vue
<template>
  <v-container>
    <!-- Header -->
    <v-row>
      <v-col cols="12">
        <h1>Player Check-in</h1>
        <check-in-stats-panel :stats="stats" />
      </v-col>
    </v-row>
    
    <!-- Search and Filters -->
    <v-row>
      <v-col cols="12" md="6">
        <v-text-field
          v-model="searchQuery"
          label="Search players"
          prepend-inner-icon="mdi-magnify"
          clearable
          @input="debouncedSearch"
        />
      </v-col>
      <v-col cols="12" md="3">
        <v-select
          v-model="selectedCategory"
          :items="categories"
          label="Category"
          clearable
        />
      </v-col>
      <v-col cols="12" md="3">
        <v-select
          v-model="statusFilter"
          :items="statusOptions"
          label="Status"
          clearable
        />
      </v-col>
    </v-row>
    
    <!-- Bulk Actions -->
    <v-row v-if="selectedRegistrations.length > 0">
      <v-col cols="12">
        <v-alert type="info">
          {{ selectedRegistrations.length }} players selected
          <v-btn
            color="success"
            class="ml-4"
            @click="bulkCheckIn"
          >
            Check In Selected
          </v-btn>
          <v-btn
            color="error"
            class="ml-2"
            @click="bulkNoShow"
          >
            Mark No Show
          </v-btn>
        </v-alert>
      </v-col>
    </v-row>
    
    <!-- Player List -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-list>
            <v-list-item
              v-for="registration in filteredRegistrations"
              :key="registration.id"
            >
              <template #prepend>
                <v-checkbox
                  v-model="selectedRegistrations"
                  :value="registration.id"
                />
              </template>
              
              <v-list-item-title>
                {{ getPlayerName(registration) }}
                <v-chip
                  v-if="registration.bibNumber"
                  size="small"
                  class="ml-2"
                >
                  #{{ registration.bibNumber }}
                </v-chip>
              </v-list-item-title>
              
              <v-list-item-subtitle>
                {{ getCategoryName(registration.categoryId) }}
              </v-list-item-subtitle>
              
              <template #append>
                <!-- Status Actions -->
                <v-btn
                  v-if="registration.status === 'approved'"
                  color="success"
                  size="small"
                  @click="checkIn(registration.id)"
                >
                  Check In
                </v-btn>
                
                <v-chip
                  v-else-if="registration.status === 'checked_in'"
                  color="success"
                >
                  ✓ Checked In {{ formatTime(registration.checkedInAt) }}
                </v-chip>
                
                <v-chip
                  v-else-if="registration.status === 'no_show'"
                  color="error"
                >
                  No Show
                </v-chip>
                
                <v-btn
                  icon="mdi-dots-vertical"
                  size="small"
                  variant="text"
                >
                  <v-menu activator="parent">
                    <v-list>
                      <v-list-item
                        v-if="registration.status === 'checked_in'"
                        @click="undoCheckIn(registration.id)"
                      >
                        <v-list-item-title>Undo Check-in</v-list-item-title>
                      </v-list-item>
                      
                      <v-list-item @click="assignBib(registration)">
                        <v-list-item-title>Assign Bib #</v-list-item-title>
                      </v-list-item>
                      
                      <v-list-item @click="showQRCode(registration)">
                        <v-list-item-title>Show QR Code</v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
```

---

## Testing Requirements

### Unit Tests
- Check-in logic
- Bib number assignment
- QR code generation/parsing
- Stats calculation

### E2E Tests
- Admin can check in single player
- Admin can bulk check in players
- Player can self check-in
- QR code check-in flow
- No-show marking
- Bib assignment

### Edge Cases
- Duplicate check-in attempts
- Check-in after tournament start
- Lost QR codes
- Network failures during check-in

---

## Acceptance Criteria

- [ ] Admin can view all approved registrations
- [ ] Admin can check in players individually
- [ ] Admin can check in multiple players at once
- [ ] Admin can mark players as no-shows
- [ ] Admin can assign bib numbers
- [ ] Real-time statistics update
- [ ] Players can self check-in via mobile
- [ ] QR codes generated for each registration
- [ ] QR code scanning works for instant check-in
- [ ] Undo check-in functionality works
- [ ] Mobile-responsive design
- [ ] Works offline with sync when reconnected

---

## Related Documentation

- [Registration Management](../src/features/registration/) - Existing registration system
- [User Management Dashboard](./USER_MANAGEMENT_DASHBOARD.md) - User administration
- [Tournament Dashboard](../src/features/tournaments/) - Tournament operations

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-14  
**Author:** Sisyphus AI  
**Status:** Draft - Ready for Implementation
