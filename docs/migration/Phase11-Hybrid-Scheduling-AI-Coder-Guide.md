# Phase 11: Hybrid Scheduling System - AI Coder Execution Guide

**Status:** 📋 **READY FOR IMPLEMENTATION**
**Target:** AI Coder
**Priority:** Execute phases sequentially, one at a time
**Approach:** Implement → Test → Verify before moving to next phase
**Timeline:** 10-14 days across 5 phases

---

## 🎯 Overview

This document provides a step-by-step execution plan for implementing a **hybrid scheduling system** that:
- Keeps existing time-slot pre-scheduling
- Adds manual court assignment when courts become available
- Adds auto-assignment with pause/resume capability
- Supports manual queue reordering via drag-and-drop
- Includes 12 extended features (announcements, stats, export, etc.)

---

## 📦 Database Schema Updates

**IMPORTANT:** Add these optional fields BEFORE starting Phase 1:

### Courts collection (`tournaments/{tid}/courts`)

Add these optional fields:
```typescript
assignedMatchId?: string;      // Match assigned but not started
lastFreedAt?: Timestamp;       // When court became available
autoAssignEnabled?: boolean;   // Can this court auto-assign?
```

### Match_scores collection (`tournaments/{tid}/categories/{cid}/match_scores`)

Add these optional fields:
```typescript
queuePosition?: number;        // Position in queue (1-indexed)
queuedAt?: Timestamp;          // When added to queue
assignedAt?: Timestamp;        // When court was assigned
calledAt?: Timestamp;          // When match was announced
manualOverride?: boolean;      // Was this manually assigned?
delayReason?: string;          // If delayed, why?
delayedAt?: Timestamp;         // When delayed
```

**Note:** All fields are optional for backward compatibility.

---

## Phase 1: Court Status Tracking + Manual Assignment (Days 1-2)

### Task 1.1: Create `CourtStatusBoard.vue`

**File:** `/src/features/tournaments/components/CourtStatusBoard.vue`

**Requirements:**
- Grid display of all courts using v-row and v-col
- Color-coded cards:
  - Green (available)
  - Blue (in_use)
  - Yellow (maintenance)
- Show current match info for in_use courts
- "Assign Next Match" button for available courts
- Court actions menu (release, maintenance, restore)

**Props:**
```typescript
{
  courts: Court[];
  matches: Match[];
  availableCourts: Court[];
  nextQueuedMatch: Match | null;
}
```

**Events:**
```typescript
{
  assignNext: (courtId: string) => void;
  releaseCourt: (courtId: string) => void;
  setMaintenance: (courtId: string) => void;
  restoreCourt: (courtId: string) => void;
}
```

**Estimated Lines:** ~200

---

### Task 1.2: Create `MatchQueueList.vue`

**File:** `/src/features/tournaments/components/MatchQueueList.vue`

**Requirements:**
- List of queued matches
- Position badges (1, 2, 3...)
- Wait time display (how long in queue)
- Manual court assignment dropdown per match
- Auto-assign toggle switch
- Empty state when queue is empty

**Props:**
```typescript
{
  matches: Match[];
  availableCourts: Court[];
  autoAssignEnabled: boolean;
}
```

**Events:**
```typescript
{
  manualAssign: (matchId: string, courtId: string) => void;
  toggleAutoAssign: (enabled: boolean) => void;
}
```

**Estimated Lines:** ~150

---

### Task 1.3: Add Methods to `tournaments.ts` Store

**File:** `/src/stores/tournaments.ts`
**Location:** After line 483 (after existing court methods)

**Add these 3 methods:**

#### Method 1: `assignMatchToCourt`
```typescript
/**
 * Assign a match to a court manually
 */
async function assignMatchToCourt(
  tournamentId: string,
  matchId: string,
  courtId: string,
  categoryId: string
): Promise<void> {
  const batch = writeBatch(db);

  // Update match_scores
  const matchScoresPath = `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;
  batch.set(
    doc(db, matchScoresPath, matchId),
    {
      courtId,
      status: 'ready',
      assignedAt: serverTimestamp(),
      queuePosition: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Update court
  batch.update(doc(db, `tournaments/${tournamentId}/courts`, courtId), {
    status: 'in_use',
    currentMatchId: matchId,
    assignedMatchId: matchId,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}
```

#### Method 2: `releaseCourtManual`
```typescript
/**
 * Release a court back to available
 */
async function releaseCourtManual(
  tournamentId: string,
  courtId: string
): Promise<void> {
  await updateDoc(doc(db, `tournaments/${tournamentId}/courts`, courtId), {
    status: 'available',
    currentMatchId: null,
    assignedMatchId: null,
    lastFreedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
```

#### Method 3: `getNextQueuedMatch`
```typescript
/**
 * Get next match in queue
 */
async function getNextQueuedMatch(
  tournamentId: string,
  categoryId?: string
): Promise<Match | null> {
  const matchScoresPath = categoryId
    ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
    : `tournaments/${tournamentId}/match_scores`;

  const q = query(
    collection(db, matchScoresPath),
    where('status', '==', 'scheduled'),
    where('courtId', '==', null),
    orderBy('queuePosition', 'asc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Match;
}
```

**Export these methods:**
Add to the return statement at the end of the file:
```typescript
return {
  // ... existing exports
  assignMatchToCourt,
  releaseCourtManual,
  getNextQueuedMatch,
};
```

**Estimated Lines:** ~80

---

### Task 1.4: Modify `MatchControlView.vue` Queue View

**File:** `/src/features/tournaments/views/MatchControlView.vue`

#### Step 1: Add Imports
**Location:** Top of script section

```typescript
import CourtStatusBoard from '@/features/tournaments/components/CourtStatusBoard.vue';
import MatchQueueList from '@/features/tournaments/components/MatchQueueList.vue';
```

#### Step 2: Replace Queue View Template
**Location:** Lines 987-1224 (existing queue view section)

Replace the existing queue view template with:
```vue
<template v-if="viewMode === 'queue'">
  <v-row>
    <!-- Left: Court Status Board -->
    <v-col cols="12" lg="6">
      <CourtStatusBoard
        :courts="courts"
        :matches="matches"
        :available-courts="availableCourts"
        :next-queued-match="pendingMatches[0]"
        @assign-next="handleAutoAssign"
        @release-court="handleReleaseCourt"
        @set-maintenance="handleSetMaintenance"
        @restore-court="handleRestoreCourt"
      />
    </v-col>

    <!-- Right: In-Progress + Queue -->
    <v-col cols="12" lg="6">
      <!-- Keep existing in-progress display card -->
      <v-card class="mb-4">
        <!-- DO NOT MODIFY - Keep existing in-progress section -->
      </v-card>

      <!-- NEW: Match Queue List -->
      <MatchQueueList
        :matches="pendingMatches"
        :available-courts="availableCourts"
        :auto-assign-enabled="autoAssignEnabled"
        @manual-assign="handleManualAssign"
        @toggle-auto-assign="toggleAutoAssign"
      />
    </v-col>
  </v-row>
</template>
```

#### Step 3: Add Script Methods
**Location:** After line 865 (in script setup section)

Add this reactive variable:
```typescript
const autoAssignEnabled = ref(true);
```

Add these handler methods:
```typescript
/**
 * Manually assign a match to a court
 */
async function handleManualAssign(matchId: string, courtId: string) {
  const match = matches.value.find(m => m.id === matchId);
  if (!match) return;

  try {
    await tournamentStore.assignMatchToCourt(
      tournamentId.value,
      matchId,
      courtId,
      match.categoryId
    );

    notificationStore.showToast('success', 'Court assigned');

    // Log activity
    const p1 = getParticipantName(match.participant1Id);
    const p2 = getParticipantName(match.participant2Id);
    const court = courts.value.find(c => c.id === courtId);
    activityStore.logActivity(
      tournamentId.value,
      'match_assigned',
      `${p1} vs ${p2} → ${court?.name}`
    );
  } catch (error) {
    notificationStore.showToast('error', 'Failed to assign court');
  }
}

/**
 * Auto-assign next queued match to a court
 */
async function handleAutoAssign(courtId: string) {
  const nextMatch = pendingMatches.value[0];
  if (!nextMatch) {
    notificationStore.showToast('info', 'No matches in queue');
    return;
  }
  await handleManualAssign(nextMatch.id, courtId);
}

/**
 * Release a court (make it available)
 */
async function handleReleaseCourt(courtId: string) {
  try {
    await tournamentStore.releaseCourtManual(tournamentId.value, courtId);
    notificationStore.showToast('success', 'Court released');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to release court');
  }
}

/**
 * Toggle auto-assignment on/off
 */
function toggleAutoAssign(enabled: boolean) {
  autoAssignEnabled.value = enabled;
  tournamentStore.updateTournament(tournamentId.value, {
    settings: {
      ...tournament.value?.settings,
      autoAssignEnabled: enabled,
    },
  });
}

/**
 * Set court to maintenance mode
 */
async function handleSetMaintenance(courtId: string) {
  try {
    await tournamentStore.updateCourt(tournamentId.value, courtId, {
      status: 'maintenance',
    });
    notificationStore.showToast('info', 'Court set to maintenance');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to set maintenance');
  }
}

/**
 * Restore court from maintenance
 */
async function handleRestoreCourt(courtId: string) {
  try {
    await tournamentStore.updateCourt(tournamentId.value, courtId, {
      status: 'available',
    });
    notificationStore.showToast('success', 'Court restored');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to restore court');
  }
}
```

**Estimated Lines:** ~100

---

### Task 1.5: Test Phase 1

**Manual Testing Checklist:**

1. **Court Status Display**
   - [ ] Courts display in grid layout
   - [ ] Available courts show green color
   - [ ] In-use courts show blue color
   - [ ] Maintenance courts show yellow color
   - [ ] Current match info shows on in-use courts

2. **Court Actions**
   - [ ] "Assign Next Match" button appears on available courts
   - [ ] Clicking "Assign Next" assigns first queued match
   - [ ] Court actions menu (⋮) works
   - [ ] "Release Court" clears match and sets court to available
   - [ ] "Set Maintenance" changes court status
   - [ ] "Restore Court" brings court back to available

3. **Match Queue**
   - [ ] Queue displays correctly with position badges (1, 2, 3...)
   - [ ] Wait time displays and updates
   - [ ] Manual assign dropdown shows available courts
   - [ ] Assigning a match removes it from queue
   - [ ] Auto-assign toggle switch works
   - [ ] Empty state shows when no matches in queue

4. **Real-time Updates**
   - [ ] Court status updates in real-time
   - [ ] Queue updates when matches are assigned
   - [ ] Match info updates when match starts

**If any tests fail, debug and fix before moving to Phase 2.**

---

## Phase 2: Auto-Assignment Watcher + Pause/Resume (Days 3-4)

### Task 2.1: Create `useAutoAssignment.ts` Composable

**File:** `/src/composables/useAutoAssignment.ts`

**Requirements:**
- Export function `useAutoAssignment(tournamentId: string)`
- Reactive refs: `enabled`, `paused`, `processing`, `lastAssignment`
- `start()` - Setup onSnapshot listener on courts collection where status='available'
- `assignNextMatchToCourt(courtId)` - Use runTransaction to assign next queued match
- `pause()`, `resume()`, `stop()` - Control functions
- onUnmounted cleanup
- Transaction prevents race conditions (check courtId is null before assigning)

**Implementation Template:**
```typescript
import { ref, onUnmounted } from 'vue';
import { db, collection, query, where, onSnapshot, getDocs, orderBy, limit, doc, runTransaction, serverTimestamp } from '@/services/firebase';

export function useAutoAssignment(tournamentId: string) {
  const enabled = ref(true);
  const paused = ref(false);
  const processing = ref(false);
  const lastAssignment = ref<Date | null>(null);

  let courtsUnsubscribe: (() => void) | null = null;

  function start() {
    // TODO: Implement onSnapshot listener on courts
    // Watch for courts where status='available'
    // When court becomes available, call assignNextMatchToCourt
  }

  async function assignNextMatchToCourt(courtId: string): Promise<void> {
    // TODO: Use runTransaction to:
    // 1. Get next match from queue
    // 2. Check match doesn't already have a court
    // 3. Assign match to court atomically
    // 4. Update court status
  }

  function pause() {
    paused.value = true;
  }

  function resume() {
    paused.value = false;
  }

  function stop() {
    if (courtsUnsubscribe) {
      courtsUnsubscribe();
      courtsUnsubscribe = null;
    }
  }

  onUnmounted(() => {
    stop();
  });

  return {
    enabled,
    paused,
    processing,
    lastAssignment,
    start,
    pause,
    resume,
    stop,
  };
}
```

**Key Implementation Details:**
- Use `onSnapshot` to watch court availability changes
- Use `runTransaction` to prevent race conditions when assigning matches
- Check `!enabled.value || paused.value || processing.value` before processing
- Set `processing.value = true` to prevent concurrent assignments
- Update `lastAssignment.value` after successful assignment

**Estimated Lines:** ~150

---

### Task 2.2: Create `AutoAssignmentControl.vue`

**File:** `/src/features/tournaments/components/AutoAssignmentControl.vue`

**Requirements:**
- Card with pause/resume button
- Show status: "ACTIVE" or "PAUSED"
- Show last assignment time or "Waiting for courts..."
- Warning alert when paused
- Color: primary when active, warning when paused
- Icon: play-circle when active, pause-circle when paused

**Props:**
```typescript
{
  isPaused: boolean;
  processing: boolean;
  lastAssignment: Date | null;
}
```

**Events:**
```typescript
{
  pause: () => void;
  resume: () => void;
}
```

**Template Structure:**
```vue
<template>
  <v-card variant="tonal" :color="isPaused ? 'warning' : 'primary'">
    <v-card-text class="d-flex align-center">
      <!-- Icon (play or pause) -->
      <!-- Status text (ACTIVE or PAUSED) -->
      <!-- Last assignment time -->
      <!-- Pause/Resume button -->
    </v-card-text>

    <!-- Warning alert when paused -->
    <v-alert v-if="isPaused" type="warning" variant="tonal" density="compact" class="mx-4 mb-4">
      Auto-assignment is paused. Use manual assignment or click "Resume" to continue.
    </v-alert>
  </v-card>
</template>
```

**Estimated Lines:** ~80

---

### Task 2.3: Integrate Auto-Assignment in `MatchControlView.vue`

**File:** `/src/features/tournaments/views/MatchControlView.vue`

#### Step 1: Add Imports
```typescript
import { useAutoAssignment } from '@/composables/useAutoAssignment';
import AutoAssignmentControl from '@/features/tournaments/components/AutoAssignmentControl.vue';
```

#### Step 2: Setup Auto-Assignment
Add after other reactive variables:
```typescript
const autoAssign = useAutoAssignment(tournamentId.value);
```

#### Step 3: Start/Stop Auto-Assignment
Update onMounted:
```typescript
onMounted(async () => {
  // ... existing code ...

  // Start auto-assignment if enabled
  if (tournament.value?.settings?.autoAssignEnabled !== false) {
    autoAssign.start();
  }
});
```

Update onUnmounted:
```typescript
onUnmounted(() => {
  // ... existing code ...
  autoAssign.stop();
});
```

#### Step 4: Add Pause/Resume Methods
```typescript
function pauseQueue() {
  autoAssign.pause();
  notificationStore.showToast('info', 'Queue paused');
}

function resumeQueue() {
  autoAssign.resume();
  notificationStore.showToast('success', 'Queue resumed');
}
```

#### Step 5: Add AutoAssignmentControl to Template
Add to queue view, **before** the stats row:
```vue
<v-row v-if="viewMode === 'queue'" class="mb-4">
  <v-col cols="12">
    <AutoAssignmentControl
      :is-paused="autoAssign.paused.value"
      :processing="autoAssign.processing.value"
      :last-assignment="autoAssign.lastAssignment.value"
      @pause="pauseQueue"
      @resume="resumeQueue"
    />
  </v-col>
</v-row>
```

**Estimated Lines:** ~50

---

### Task 2.4: Test Phase 2

**Manual Testing Checklist:**

1. **Auto-Assignment**
   - [ ] Match auto-assigns when court finishes/is released
   - [ ] Only one match assigns even when multiple courts free simultaneously (no race condition)
   - [ ] Next match in queue gets assigned (FIFO order)

2. **Pause/Resume**
   - [ ] Pause button stops auto-assignment
   - [ ] Resume button restarts auto-assignment
   - [ ] Manual assignment still works when paused
   - [ ] Status displays correctly (ACTIVE vs PAUSED)

3. **Status Display**
   - [ ] Processing indicator shows during assignment
   - [ ] Last assignment time displays after assignment
   - [ ] Warning banner shows when paused
   - [ ] Card color changes (primary when active, warning when paused)

**Race Condition Test:**
Free 2 courts at the exact same time and verify only 1 match gets assigned (not duplicated).

**If any tests fail, debug and fix before moving to Phase 3.**

---

## Phase 3: Queue Reordering + Display (Days 5-6)

### Task 3.1: Install Dependency

**Command:**
```bash
npm install vuedraggable@next
```

**Verify installation:**
Check that `package.json` includes `vuedraggable` in dependencies.

---

### Task 3.2: Create `DraggableMatchQueue.vue`

**File:** `/src/features/tournaments/components/DraggableMatchQueue.vue`

**Requirements:**
- Use `<draggable>` component from vuedraggable
- Configuration: `item-key="id"`, `handle=".drag-handle"`, `animation="200"`
- Show position badges (1, 2, 3...) for each match
- Drag handle icon: `mdi-drag-vertical` with cursor: grab
- Manual assign dropdown per match
- Actions menu with:
  - Reset to FIFO
  - Sort by Round
- Ghost class for drag preview (opacity: 0.5)

**Props:**
```typescript
{
  matches: Match[];
  availableCourts: Court[];
}
```

**Events:**
```typescript
{
  reorder: (matchIds: string[]) => void;
  assign: (matchId: string, courtId: string) => void;
  resetOrder: () => void;
  sortByRound: () => void;
}
```

**Template Structure:**
```vue
<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      Match Queue ({{ matches.length }})
      <!-- Actions menu -->
    </v-card-title>

    <draggable
      v-model="localMatches"
      item-key="id"
      handle=".drag-handle"
      animation="200"
      ghost-class="ghost"
      @end="onDragEnd"
    >
      <template #item="{ element: match, index }">
        <v-list-item>
          <!-- Drag handle + position badge -->
          <!-- Match info -->
          <!-- Assign dropdown -->
        </v-list-item>
      </template>
    </draggable>
  </v-card>
</template>

<style scoped>
.drag-handle {
  cursor: grab;
}
.ghost {
  opacity: 0.5;
  background: var(--v-theme-primary);
}
</style>
```

**Script Logic:**
- Maintain local copy of matches: `localMatches = ref([...props.matches])`
- Watch props.matches for external updates
- On drag end, emit reorder event with new match IDs order

**Estimated Lines:** ~200

---

### Task 3.3: Add Queue Methods to `matches.ts` Store

**File:** `/src/stores/matches.ts`

#### Method 1: `reorderQueue`
```typescript
/**
 * Reorder queue by setting new positions
 */
async function reorderQueue(
  tournamentId: string,
  matchIds: string[]
): Promise<void> {
  const batch = writeBatch(db);

  matchIds.forEach((matchId, index) => {
    const match = matches.value.find(m => m.id === matchId);
    if (!match) return;

    const path = `tournaments/${tournamentId}/categories/${match.categoryId}/match_scores`;
    batch.update(doc(db, path, matchId), {
      queuePosition: index + 1, // 1-indexed
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}
```

#### Method 2: `resetQueueToFIFO`
```typescript
/**
 * Reset queue to FIFO (based on queuedAt timestamp)
 */
async function resetQueueToFIFO(tournamentId: string): Promise<void> {
  const matchesQuery = query(
    collection(db, `tournaments/${tournamentId}/match_scores`),
    where('status', '==', 'scheduled'),
    where('courtId', '==', null),
    orderBy('queuedAt', 'asc')
  );

  const snapshot = await getDocs(matchesQuery);
  const batch = writeBatch(db);

  snapshot.docs.forEach((doc, index) => {
    batch.update(doc.ref, {
      queuePosition: index + 1,
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}
```

#### Method 3: `sortQueueByRound`
```typescript
/**
 * Sort queue by round (lower rounds first)
 */
async function sortQueueByRound(tournamentId: string): Promise<void> {
  const matchesInQueue = matches.value.filter(
    m => m.status === 'scheduled' && !m.courtId
  );

  const sorted = matchesInQueue.sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.matchNumber - b.matchNumber;
  });

  const batch = writeBatch(db);
  sorted.forEach((match, index) => {
    const path = `tournaments/${tournamentId}/categories/${match.categoryId}/match_scores`;
    batch.update(doc(db, path, match.id), {
      queuePosition: index + 1,
    });
  });

  await batch.commit();
}
```

**Export these methods:**
```typescript
return {
  // ... existing exports
  reorderQueue,
  resetQueueToFIFO,
  sortQueueByRound,
};
```

**Estimated Lines:** ~80

---

### Task 3.4: Replace Queue List in `MatchControlView.vue`

**File:** `/src/features/tournaments/views/MatchControlView.vue`

#### Step 1: Import DraggableMatchQueue
```typescript
import DraggableMatchQueue from '@/features/tournaments/components/DraggableMatchQueue.vue';
```

#### Step 2: Replace MatchQueueList with DraggableMatchQueue
Find the `<MatchQueueList>` component in the queue view template and replace it with:
```vue
<DraggableMatchQueue
  :matches="pendingMatches"
  :available-courts="availableCourts"
  @reorder="handleQueueReorder"
  @assign="handleManualAssign"
  @reset-order="resetQueue"
  @sort-by-round="sortByRound"
/>
```

#### Step 3: Add Handler Methods
```typescript
/**
 * Handle queue reordering
 */
async function handleQueueReorder(matchIds: string[]) {
  try {
    await matchStore.reorderQueue(tournamentId.value, matchIds);
    notificationStore.showToast('success', 'Queue order updated');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to reorder queue');
  }
}

/**
 * Reset queue to FIFO order
 */
async function resetQueue() {
  try {
    await matchStore.resetQueueToFIFO(tournamentId.value);
    notificationStore.showToast('success', 'Queue reset to FIFO');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to reset queue');
  }
}

/**
 * Sort queue by round
 */
async function sortByRound() {
  try {
    await matchStore.sortQueueByRound(tournamentId.value);
    notificationStore.showToast('success', 'Queue sorted by round');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to sort queue');
  }
}
```

**Estimated Lines:** ~40

---

### Task 3.5: Test Phase 3

**Manual Testing Checklist:**

1. **Drag and Drop**
   - [ ] Can drag matches up in the queue
   - [ ] Can drag matches down in the queue
   - [ ] Drag handle (⋮⋮) shows cursor: grab
   - [ ] Position badges (1, 2, 3...) update after drag
   - [ ] Ghost preview shows during drag

2. **Queue Actions**
   - [ ] "Reset to FIFO" returns queue to timestamp order
   - [ ] "Sort by Round" sorts with lower rounds first
   - [ ] Actions menu opens and closes properly

3. **Persistence**
   - [ ] Queue order persists after page refresh
   - [ ] Auto-assignment respects manual queue order
   - [ ] Manual assign still works from draggable queue

4. **Real-time Updates**
   - [ ] Drag animations are smooth (200ms)
   - [ ] Queue updates in real-time when matches assigned elsewhere

**If any tests fail, debug and fix before moving to Phase 4.**

---

## Phase 4: Extended Features Set 1 (Days 7-9)

### Task 4.1: Create `MatchAnnouncementPanel.vue`

**File:** `/src/features/tournaments/components/MatchAnnouncementPanel.vue`

**Requirements:**
- List of ready matches (have court assigned, not started yet)
- "Announce" button per match
- "Announce All" bulk action button
- Show time since match was called/announced
- Visual indicator (checkmark) for already-called matches
- Empty state when no matches ready

**Props:**
```typescript
{
  matches: Match[];
}
```

**Events:**
```typescript
{
  announce: (match: Match) => void;
  announceAll: () => void;
}
```

**Estimated Lines:** ~120

---

### Task 4.2: Create `WalkoverDialog.vue`

**File:** `/src/features/tournaments/components/WalkoverDialog.vue`

**Requirements:**
- `v-dialog` with `max-width="500"`
- Radio group to select winner (participant1 or participant2)
- Textarea for reason (optional field)
- Info alert: "Records 21-0 score and advances winner. Court will be freed immediately."
- Cancel and "Record Walkover" buttons
- Disable "Record Walkover" if no winner selected

**Props:**
```typescript
{
  modelValue: boolean;
  match: Match | null;
}
```

**Events:**
```typescript
{
  'update:modelValue': (value: boolean) => void;
  confirm: (winnerId: string, reason: string) => void;
}
```

**Estimated Lines:** ~140

---

### Task 4.3: Create `MatchDelayDialog.vue`

**File:** `/src/features/tournaments/components/MatchDelayDialog.vue`

**Requirements:**
- `v-dialog` with `max-width="500"`
- Select dropdown for delay duration (15, 30, 60 minutes)
- Textarea for reason
- Info alert: "Match will be moved to end of queue and court will be freed."
- Cancel and "Delay Match" buttons

**Props:**
```typescript
{
  modelValue: boolean;
  match: Match | null;
}
```

**Events:**
```typescript
{
  'update:modelValue': (value: boolean) => void;
  confirm: (delayMinutes: number, reason: string) => void;
}
```

**Estimated Lines:** ~100

---

### Task 4.4: Add Announcement/Delay Methods to `matches.ts` Store

**File:** `/src/stores/matches.ts`

#### Method 1: `announceMatch`
```typescript
/**
 * Mark match as announced/called
 */
async function announceMatch(
  tournamentId: string,
  matchId: string,
  categoryId: string
): Promise<void> {
  const path = `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;
  await updateDoc(doc(db, path, matchId), {
    calledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
```

#### Method 2: `delayMatch`
```typescript
/**
 * Delay a match - move to end of queue
 */
async function delayMatch(
  tournamentId: string,
  matchId: string,
  categoryId: string,
  reason: string
): Promise<void> {
  const matchScoresPath = `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;

  // Get current max position
  const queueQuery = query(
    collection(db, matchScoresPath),
    where('status', '==', 'scheduled'),
    orderBy('queuePosition', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(queueQuery);
  const maxPosition = snapshot.empty ? 0 : (snapshot.docs[0].data().queuePosition || 0);

  const match = matches.value.find(m => m.id === matchId);
  const batch = writeBatch(db);

  // Update match
  batch.update(doc(db, matchScoresPath, matchId), {
    queuePosition: maxPosition + 1,
    courtId: null,
    status: 'scheduled',
    delayReason: reason,
    delayedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Release court if assigned
  if (match?.courtId) {
    batch.update(doc(db, `tournaments/${tournamentId}/courts`, match.courtId), {
      status: 'available',
      currentMatchId: null,
      lastFreedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}
```

**Export these methods:**
```typescript
return {
  // ... existing exports
  announceMatch,
  delayMatch,
};
```

**Estimated Lines:** ~60

---

### Task 4.5: Integrate Dialogs in `MatchControlView.vue`

**File:** `/src/features/tournaments/views/MatchControlView.vue`

#### Step 1: Add Imports
```typescript
import MatchAnnouncementPanel from '@/features/tournaments/components/MatchAnnouncementPanel.vue';
import WalkoverDialog from '@/features/tournaments/components/WalkoverDialog.vue';
import MatchDelayDialog from '@/features/tournaments/components/MatchDelayDialog.vue';
```

#### Step 2: Add Reactive Variables
```typescript
const showWalkoverDialog = ref(false);
const showDelayDialog = ref(false);
const selectedMatch = ref<Match | null>(null);
```

#### Step 3: Add MatchAnnouncementPanel to Queue View
Add to queue view, after auto-assignment control:
```vue
<v-row v-if="viewMode === 'queue'" class="mb-4">
  <v-col cols="12" md="6">
    <MatchAnnouncementPanel
      :matches="matches"
      @announce="handleAnnounce"
      @announce-all="handleAnnounceAll"
    />
  </v-col>
</v-row>
```

#### Step 4: Add Dialogs at End of Template
```vue
<!-- Walkover Dialog -->
<WalkoverDialog
  v-model="showWalkoverDialog"
  :match="selectedMatch"
  @confirm="handleWalkover"
/>

<!-- Delay Dialog -->
<MatchDelayDialog
  v-model="showDelayDialog"
  :match="selectedMatch"
  @confirm="handleDelay"
/>
```

#### Step 5: Add Handler Methods
```typescript
/**
 * Announce a match
 */
async function handleAnnounce(match: Match) {
  try {
    await matchStore.announceMatch(
      tournamentId.value,
      match.id,
      match.categoryId
    );

    const p1 = getParticipantName(match.participant1Id);
    const p2 = getParticipantName(match.participant2Id);
    const court = getCourtName(match.courtId);

    notificationStore.showToast('success', `Announced: ${p1} vs ${p2} on ${court}`);
  } catch (error) {
    notificationStore.showToast('error', 'Failed to announce match');
  }
}

/**
 * Announce all ready matches
 */
async function handleAnnounceAll() {
  const readyMatches = matches.value.filter(
    m => m.status === 'ready' && m.courtId && !m.calledAt
  );

  for (const match of readyMatches) {
    await handleAnnounce(match);
  }
}

/**
 * Open walkover dialog
 */
function openWalkoverDialog(match: Match) {
  selectedMatch.value = match;
  showWalkoverDialog.value = true;
}

/**
 * Handle walkover confirmation
 */
async function handleWalkover(winnerId: string, reason: string) {
  if (!selectedMatch.value) return;

  try {
    await matchStore.recordWalkover(
      tournamentId.value,
      selectedMatch.value.id,
      winnerId,
      selectedMatch.value.categoryId
    );

    const winner = getParticipantName(winnerId);
    notificationStore.showToast('success', `Walkover: ${winner} wins`);
    showWalkoverDialog.value = false;
  } catch (error) {
    notificationStore.showToast('error', 'Failed to record walkover');
  }
}

/**
 * Open delay dialog
 */
function openDelayDialog(match: Match) {
  selectedMatch.value = match;
  showDelayDialog.value = true;
}

/**
 * Handle delay confirmation
 */
async function handleDelay(delayMinutes: number, reason: string) {
  if (!selectedMatch.value) return;

  try {
    await matchStore.delayMatch(
      tournamentId.value,
      selectedMatch.value.id,
      selectedMatch.value.categoryId,
      reason
    );

    notificationStore.showToast('info', 'Match delayed');
    showDelayDialog.value = false;
  } catch (error) {
    notificationStore.showToast('error', 'Failed to delay match');
  }
}
```

#### Step 6: Add Context Menu to Match Cards
Add to match list items (where applicable):
```vue
<v-menu>
  <template #activator="{ props }">
    <v-btn v-bind="props" icon="mdi-dots-vertical" size="small" variant="text" />
  </template>
  <v-list density="compact">
    <v-list-item @click="openWalkoverDialog(match)">
      <v-icon start size="small">mdi-flag</v-icon>
      Record Walkover
    </v-list-item>
    <v-list-item @click="openDelayDialog(match)">
      <v-icon start size="small">mdi-clock-alert</v-icon>
      Delay Match
    </v-list-item>
  </v-list>
</v-menu>
```

**Estimated Lines:** ~120

---

### Task 4.6: Test Phase 4

**Manual Testing Checklist:**

1. **Announcements**
   - [ ] "Announce" button works for individual matches
   - [ ] "Announce All" button announces all ready matches
   - [ ] Called timestamp (calledAt) is recorded
   - [ ] Time since called displays correctly
   - [ ] Already-called matches show checkmark indicator

2. **Walkover**
   - [ ] Walkover dialog opens
   - [ ] Can select winner (participant1 or participant2)
   - [ ] Can enter reason (optional)
   - [ ] "Record Walkover" button disabled until winner selected
   - [ ] Walkover records 21-0 score
   - [ ] Winner advances in bracket
   - [ ] Court is freed immediately

3. **Delay**
   - [ ] Delay dialog opens
   - [ ] Can select delay duration (15, 30, 60 min)
   - [ ] Can enter reason
   - [ ] Match moves to end of queue
   - [ ] Court is released (becomes available)
   - [ ] Delay reason is saved

**If any tests fail, debug and fix before moving to Phase 5.**

---

## Phase 5: Extended Features Set 2 (Days 10-14)

### Task 5.1: Create `MatchStatsDashboard.vue`

**File:** `/src/features/tournaments/components/MatchStatsDashboard.vue`

**Requirements:**
- Compute and display stats:
  - **Completion Percentage:** `(completed / total) * 100`
  - **Average Match Duration:** Average of `(completedAt - startedAt)` in minutes
  - **Court Utilization:** `(courts in_use / total courts) * 100`
  - **Estimated Time Remaining:** `(remaining matches / active courts) * avgDuration`
- Display in cards/chips layout
- Optional: Matches per hour chart (use v-data-table or simple bar visualization)
- Queue stats summary (current queue length, avg wait time)
- Recent completions list (last 5 completed matches)

**Props:**
```typescript
{
  matches: Match[];
  courts: Court[];
}
```

**Computed Stats Example:**
```typescript
const stats = computed(() => {
  const completed = props.matches.filter(m => m.status === 'completed').length;
  const total = props.matches.length;
  const completionPercentage = Math.round((completed / total) * 100);

  const durations = props.matches
    .filter(m => m.startedAt && m.completedAt)
    .map(m => differenceInMinutes(m.completedAt, m.startedAt));

  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b) / durations.length)
    : 30;

  const activeCourts = props.courts.filter(c => c.status === 'in_use').length;
  const totalCourts = props.courts.filter(c => c.status !== 'maintenance').length;
  const courtUtilization = Math.round((activeCourts / totalCourts) * 100);

  const remaining = total - completed;
  const estimatedMinutes = activeCourts > 0
    ? Math.round((remaining / activeCourts) * avgDuration)
    : remaining * avgDuration;

  return {
    completionPercentage,
    avgDuration,
    courtUtilization,
    estimatedTimeRemaining: formatDuration(estimatedMinutes),
    // ... more stats
  };
});
```

**Estimated Lines:** ~300

---

### Task 5.2: Create `EstimatedWaitTime.vue`

**File:** `/src/features/tournaments/components/EstimatedWaitTime.vue`

**Requirements:**
- v-chip showing estimated wait time
- Calculate:
  - `matchesAhead = queuePosition - 1`
  - `rounds = ceil(matchesAhead / courtsAvailable)`
  - `estimatedMinutes = rounds * avgMatchDuration`
- Color by wait time:
  - Green (< 15 min): "Next up"
  - Yellow (15-30 min): "Soon"
  - Orange (30-60 min): "Moderate wait"
  - Red (> 60 min): "Long wait"
- Prepend icon: `mdi-clock-outline`

**Props:**
```typescript
{
  queuePosition: number;
  courtsAvailable: number;
  avgMatchDuration: number;
}
```

**Estimated Lines:** ~70

---

### Task 5.3: Create `ExportScheduleDialog.vue`

**File:** `/src/features/tournaments/components/ExportScheduleDialog.vue`

**Requirements:**
- v-dialog with format selector (Print, CSV, JSON)
- Checkboxes to filter:
  - Include completed matches
  - Include scheduled matches
  - Include queue (unassigned)
- Export CSV: Create headers + rows, download as file
- Export JSON: `JSON.stringify(matches)`, download as file
- Print: Call `window.print()`

**CSV Format:**
```csv
Match #,Category,Round,P1,P2,Court,Time,Status,Score
1,Men's Singles,1,Anderson,Wilson,Court 1,10:00,completed,21-15 21-18
```

**Props:**
```typescript
{
  modelValue: boolean;
  matches: Match[];
}
```

**Events:**
```typescript
{
  'update:modelValue': (value: boolean) => void;
}
```

**Implementation Helper:**
```typescript
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

**Estimated Lines:** ~180

---

### Task 5.4: Create `MatchHistoryLog.vue`

**File:** `/src/features/tournaments/components/MatchHistoryLog.vue`

**Requirements:**
- v-timeline showing match events chronologically
- Event types:
  - 🏸 `court_assigned` - Court Assigned
  - 📢 `match_announced` - Match Announced
  - ▶️ `match_started` - Match Started
  - 🎯 `match_completed` - Match Completed
  - ⏰ `match_delayed` - Match Delayed
  - 🚩 `walkover` - Walkover
- Icon and color per event type
- Display: timestamp, event title, description
- Filter events by type (optional dropdown)

**Props:**
```typescript
{
  events: MatchEvent[];
}
```

**Events:**
```typescript
{
  refresh: () => void;
}
```

**Template Structure:**
```vue
<v-timeline side="end" density="compact">
  <v-timeline-item
    v-for="event in filteredEvents"
    :key="event.id"
    :dot-color="getEventColor(event.type)"
    size="small"
  >
    <template #opposite>
      <div class="text-caption">{{ formatTime(event.timestamp) }}</div>
    </template>

    <v-card variant="tonal">
      <v-card-text>
        <v-icon :color="getEventColor(event.type)" size="small">
          {{ getEventIcon(event.type) }}
        </v-icon>
        {{ event.title }}
        <div class="text-caption">{{ event.description }}</div>
      </v-card-text>
    </v-card>
  </v-timeline-item>
</v-timeline>
```

**Estimated Lines:** ~160

---

### Task 5.5: Add Stats Tab to `MatchControlView.vue`

**File:** `/src/features/tournaments/views/MatchControlView.vue`

#### Step 1: Add Imports
```typescript
import MatchStatsDashboard from '@/features/tournaments/components/MatchStatsDashboard.vue';
import EstimatedWaitTime from '@/features/tournaments/components/EstimatedWaitTime.vue';
import ExportScheduleDialog from '@/features/tournaments/components/ExportScheduleDialog.vue';
import MatchHistoryLog from '@/features/tournaments/components/MatchHistoryLog.vue';
```

#### Step 2: Add "Stats" Button to View Mode Toggle
Find the view mode toggle buttons and add:
```vue
<v-btn-toggle v-model="viewMode" mandatory>
  <v-btn value="queue">Queue</v-btn>
  <v-btn value="courts">Courts</v-btn>
  <v-btn value="schedule">Schedule</v-btn>
  <v-btn value="stats">Stats</v-btn> <!-- NEW -->
</v-btn-toggle>
```

#### Step 3: Add Stats View Template
```vue
<template v-if="viewMode === 'stats'">
  <v-row>
    <!-- Statistics Dashboard -->
    <v-col cols="12">
      <MatchStatsDashboard :matches="matches" :courts="courts" />
    </v-col>

    <!-- Match History -->
    <v-col cols="12" lg="6">
      <MatchHistoryLog :events="matchEvents" @refresh="refreshHistory" />
    </v-col>

    <!-- Export & Reports -->
    <v-col cols="12" lg="6">
      <v-card>
        <v-card-title>Export & Reports</v-card-title>
        <v-card-text>
          <v-btn
            block
            variant="tonal"
            prepend-icon="mdi-download"
            @click="showExportDialog = true"
          >
            Export Schedule
          </v-btn>
          <v-btn
            block
            variant="tonal"
            prepend-icon="mdi-printer"
            class="mt-2"
            @click="printSchedule"
          >
            Print Schedule
          </v-btn>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>
```

#### Step 4: Add Reactive Variables
```typescript
const showExportDialog = ref(false);
const matchEvents = ref<MatchEvent[]>([]);
```

#### Step 5: Add Methods
```typescript
/**
 * Refresh match history from activity store
 */
async function refreshHistory() {
  matchEvents.value = activityStore.recentActivities
    .filter(a => a.type.includes('match'))
    .map(a => ({
      id: a.id,
      type: a.type.replace('match_', '') as any,
      matchId: a.data?.matchId || '',
      title: a.title,
      description: a.message,
      timestamp: a.createdAt,
    }));
}

/**
 * Print schedule
 */
function printSchedule() {
  window.print();
}
```

**Estimated Lines:** ~100

---

### Task 5.6: Add Bulk Actions Menu to Queue View

**File:** `/src/features/tournaments/views/MatchControlView.vue`

#### Step 1: Add Bulk Actions Menu to Queue View Header
Add near the top of queue view:
```vue
<v-row class="mb-4">
  <v-col cols="12" class="d-flex justify-end">
    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props" variant="outlined" prepend-icon="mdi-lightning-bolt">
          Bulk Actions
        </v-btn>
      </template>
      <v-list density="compact">
        <v-list-item @click="startAllReadyMatches">
          <v-icon start size="small">mdi-play-box-multiple</v-icon>
          Start All Ready Matches
        </v-list-item>
        <v-list-item @click="announceAllReady">
          <v-icon start size="small">mdi-bullhorn</v-icon>
          Announce All Ready
        </v-list-item>
        <v-list-item @click="clearAllAssignments">
          <v-icon start size="small">mdi-close-box-multiple</v-icon>
          Clear All Court Assignments
        </v-list-item>
        <v-list-item @click="resetAllQueues">
          <v-icon start size="small">mdi-refresh</v-icon>
          Reset All Queues to FIFO
        </v-list-item>
      </v-list>
    </v-menu>
  </v-col>
</v-row>
```

#### Step 2: Add Handler Methods
```typescript
/**
 * Start all ready matches (have court assigned)
 */
async function startAllReadyMatches() {
  const ready = readyMatches.value.filter(m => m.courtId);

  if (ready.length === 0) {
    notificationStore.showToast('info', 'No ready matches');
    return;
  }

  const confirmed = confirm(`Start ${ready.length} matches?`);
  if (!confirmed) return;

  for (const match of ready) {
    try {
      await matchStore.startMatch(tournamentId.value, match.id, match.categoryId);
    } catch (error) {
      console.error('Failed to start match:', match.id, error);
    }
  }

  notificationStore.showToast('success', `Started ${ready.length} matches`);
}

/**
 * Announce all ready matches
 */
async function announceAllReady() {
  const ready = readyMatches.value.filter(m => m.courtId && !m.calledAt);

  for (const match of ready) {
    await handleAnnounce(match);
  }
}

/**
 * Clear all court assignments
 */
async function clearAllAssignments() {
  const confirmed = confirm('Clear ALL court assignments?');
  if (!confirmed) return;

  try {
    await tournamentStore.resetScheduleForCategory(tournamentId.value, 'all');
    notificationStore.showToast('success', 'All assignments cleared');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to clear assignments');
  }
}

/**
 * Reset all queues to FIFO
 */
async function resetAllQueues() {
  try {
    await matchStore.resetQueueToFIFO(tournamentId.value);
    notificationStore.showToast('success', 'All queues reset to FIFO');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to reset queues');
  }
}
```

**Estimated Lines:** ~80

---

### Task 5.7: Test Phase 5

**Manual Testing Checklist:**

1. **Statistics Dashboard**
   - [ ] Completion percentage displays correctly
   - [ ] Completion percentage updates in real-time
   - [ ] Average match duration calculates correctly
   - [ ] Court utilization percentage is accurate
   - [ ] Estimated time remaining displays
   - [ ] Stats update as matches complete

2. **Estimated Wait Time**
   - [ ] Wait time shows for each queued match
   - [ ] Colors work correctly:
     - Green for < 15 min
     - Yellow for 15-30 min
     - Orange for 30-60 min
     - Red for > 60 min
   - [ ] Calculations are reasonable

3. **Export & Print**
   - [ ] Export dialog opens
   - [ ] CSV export downloads file
   - [ ] CSV format is correct (check in Excel)
   - [ ] JSON export downloads file
   - [ ] JSON is valid (check in text editor)
   - [ ] Print dialog opens

4. **Match History**
   - [ ] Timeline displays events chronologically
   - [ ] Icons and colors show per event type
   - [ ] Event details display correctly
   - [ ] Refresh button updates history

5. **Bulk Actions**
   - [ ] Bulk actions menu opens
   - [ ] "Start All Ready Matches" works
   - [ ] "Announce All Ready" announces multiple matches
   - [ ] "Clear All Assignments" prompts for confirmation
   - [ ] "Reset All Queues" resets to FIFO order

**Final End-to-End Test:**
1. Create tournament with 4 courts
2. Add 16 matches
3. Auto-schedule → verify 4 matches assigned, 12 in queue
4. Manually reorder queue
5. Start 1 match → verify auto-assignment assigns next match
6. Pause queue → verify auto-assignment stops
7. Resume queue → verify auto-assignment continues
8. Record walkover → verify winner advances
9. Delay a match → verify moves to end of queue
10. Export schedule → verify CSV downloads
11. Check stats → verify metrics are accurate

**If any tests fail, debug and fix.**

---

## ✅ Execution Checklist

**Phase 1:**
- [ ] Create CourtStatusBoard.vue
- [ ] Create MatchQueueList.vue
- [ ] Add methods to tournaments.ts store
- [ ] Modify MatchControlView.vue queue view
- [ ] Test Phase 1 ✓

**Phase 2:**
- [ ] Create useAutoAssignment.ts composable
- [ ] Create AutoAssignmentControl.vue
- [ ] Integrate auto-assignment in MatchControlView.vue
- [ ] Test Phase 2 ✓

**Phase 3:**
- [ ] Install vuedraggable
- [ ] Create DraggableMatchQueue.vue
- [ ] Add queue methods to matches.ts store
- [ ] Replace queue list in MatchControlView.vue
- [ ] Test Phase 3 ✓

**Phase 4:**
- [ ] Create MatchAnnouncementPanel.vue
- [ ] Create WalkoverDialog.vue
- [ ] Create MatchDelayDialog.vue
- [ ] Add announcement/delay methods to matches.ts
- [ ] Integrate dialogs in MatchControlView.vue
- [ ] Test Phase 4 ✓

**Phase 5:**
- [ ] Create MatchStatsDashboard.vue
- [ ] Create EstimatedWaitTime.vue
- [ ] Create ExportScheduleDialog.vue
- [ ] Create MatchHistoryLog.vue
- [ ] Add Stats tab to MatchControlView.vue
- [ ] Add bulk actions menu
- [ ] Test Phase 5 ✓

---

## 🎯 Success Criteria

**Phase 1:** Manual court assignment works, queue displays correctly
**Phase 2:** Auto-assignment works, pause/resume functional
**Phase 3:** Drag-drop reordering works, queue persists
**Phase 4:** Announcements, walkovers, delays work correctly
**Phase 5:** Stats display, export works, bulk actions functional

---

## 📚 Key Implementation Notes

1. **All database fields are optional** - Backward compatibility maintained
2. **Test each phase before moving to next** - Prevents cascading bugs
3. **Use Firestore transactions** - Prevents race conditions in auto-assignment
4. **Real-time updates throughout** - onSnapshot listeners for live data
5. **Error handling required** - Show toast notifications on failures
6. **Activity logging** - Log all major actions (assign, delay, walkover, etc.)

---

**Status:** 📋 **READY FOR EXECUTION**
**Last Updated:** 2026-02-03
**Version:** 1.0
