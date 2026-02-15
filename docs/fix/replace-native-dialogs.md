# Replace Native `confirm()` / `prompt()` with Vuetify `v-dialog`

## Problem

The app uses the browser's native `confirm()` and `prompt()` windows in several components. Modern browsers often block, auto-dismiss, or deprioritize these. They also look like generic system warnings and break the app's dark-mode Vuetify theme.

## Reference Implementation (Already Done ✅)

**`MatchControlView.vue`** (lines 607–627) already replaced a native `confirm()` with a proper `v-dialog`. Use this exact pattern for all fixes below:

```vue
<!-- Script -->
const showReleaseDialog = ref(false);
const courtToReleaseId = ref<string | null>(null);

function releaseCourt(courtId: string) {
  courtToReleaseId.value = courtId;
  showReleaseDialog.value = true;
}

async function confirmReleaseCourt() {
  if (!courtToReleaseId.value) return;
  try {
    await tournamentStore.releaseCourtManual(tournamentId.value, courtToReleaseId.value);
    notificationStore.showToast('success', 'Court released manually');
    showReleaseDialog.value = false;
  } catch (error) {
    notificationStore.showToast('error', 'Failed to release court');
  }
}

<!-- Template -->
<v-dialog v-model="showReleaseDialog" max-width="400" persistent>
  <v-card>
    <v-card-title>Release Court?</v-card-title>
    <v-card-text>Are you sure you want to manually release this court?</v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn variant="text" @click="showReleaseDialog = false">Cancel</v-btn>
      <v-btn color="error" @click="confirmReleaseCourt">Release</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
```

---

## Fix #1 — `ScoringInterfaceView.vue` → Walkover Confirmation

**File:** `src/features/scoring/views/ScoringInterfaceView.vue`
**Line:** 210
**Current code:**
```ts
async function recordWalkover(winnerId: string) {
  if (!confirm('Record walkover? This will end the match.')) return;
  // ...rest of function
}
```

### Changes Required

**In `<script setup>`:**
1. Add two refs:
   ```ts
   const showWalkoverConfirm = ref(false);
   const walkoverWinnerId = ref<string | null>(null);
   ```
2. Replace the `recordWalkover` function with two functions:
   ```ts
   function requestWalkover(winnerId: string) {
     walkoverWinnerId.value = winnerId;
     showWalkoverConfirm.value = true;
   }

   async function confirmWalkover() {
     if (!walkoverWinnerId.value) return;
     showWalkoverConfirm.value = false;
     loading.value = true;
     try {
       await matchStore.recordWalkover(tournamentId.value, matchId.value, walkoverWinnerId.value);
       notificationStore.showToast('success', 'Walkover recorded');
       router.back();
     } catch (error) {
       notificationStore.showToast('error', 'Failed to record walkover');
     } finally {
       loading.value = false;
     }
   }
   ```

**In `<template>`:**
1. Update the walkover menu items (lines 485, 488) to call `requestWalkover` instead of `recordWalkover`:
   ```html
   <v-list-item @click="requestWalkover(match.participant1Id!)">
   <v-list-item @click="requestWalkover(match.participant2Id!)">
   ```
2. Add a `v-dialog` before the closing `</template>` tag:
   ```html
   <v-dialog v-model="showWalkoverConfirm" max-width="400" persistent>
     <v-card>
       <v-card-title>Record Walkover?</v-card-title>
       <v-card-text>This will end the match immediately. Are you sure?</v-card-text>
       <v-card-actions>
         <v-spacer />
         <v-btn variant="text" @click="showWalkoverConfirm = false">Cancel</v-btn>
         <v-btn color="warning" @click="confirmWalkover">Confirm Walkover</v-btn>
       </v-card-actions>
     </v-card>
   </v-dialog>
   ```

---

## Fix #2 — `CourtManagement.vue` → Delete Court Confirmation

**File:** `src/features/tournaments/components/CourtManagement.vue`
**Line:** 96
**Current code:**
```ts
async function deleteCourt(court: Court) {
  if (court.status === 'in_use') { ... }
  if (!confirm(`Delete "${court.name}"? This cannot be undone.`)) { return; }
  // ...rest
}
```

### Changes Required

**In `<script setup>`:**
1. Add refs:
   ```ts
   const showDeleteCourtDialog = ref(false);
   const courtToDelete = ref<Court | null>(null);
   ```
2. Replace `deleteCourt` with two functions:
   ```ts
   function requestDeleteCourt(court: Court) {
     if (court.status === 'in_use') {
       notificationStore.showToast('error', 'Cannot delete court while in use');
       return;
     }
     courtToDelete.value = court;
     showDeleteCourtDialog.value = true;
   }

   async function confirmDeleteCourt() {
     if (!courtToDelete.value) return;
     showDeleteCourtDialog.value = false;
     try {
       await tournamentStore.deleteCourt(props.tournamentId, courtToDelete.value.id);
       notificationStore.showToast('success', 'Court deleted');
     } catch (error) {
       notificationStore.showToast('error', 'Failed to delete court');
     }
   }
   ```

**In `<template>`:**
1. Change the delete button's `@click` (line 263) from `deleteCourt(court)` to `requestDeleteCourt(court)`.
2. Add a `v-dialog` inside the root `<div>`:
   ```html
   <v-dialog v-model="showDeleteCourtDialog" max-width="400" persistent>
     <v-card>
       <v-card-title>Delete Court?</v-card-title>
       <v-card-text>
         Delete "{{ courtToDelete?.name }}"? This cannot be undone.
       </v-card-text>
       <v-card-actions>
         <v-spacer />
         <v-btn variant="text" @click="showDeleteCourtDialog = false">Cancel</v-btn>
         <v-btn color="error" @click="confirmDeleteCourt">Delete</v-btn>
       </v-card-actions>
     </v-card>
   </v-dialog>
   ```

---

## Fix #3 — `CourtManagement.vue` → "Add Multiple Courts" Prompt

**File:** `src/features/tournaments/components/CourtManagement.vue`
**Line:** 172
**Current code:**
```ts
async function addMultipleCourts() {
  const count = prompt('How many courts to add?', '4');
  if (!count) return;
  // ...rest
}
```

### Changes Required

**In `<script setup>`:**
1. Add refs:
   ```ts
   const showAddMultipleDialog = ref(false);
   const multipleCourtCount = ref(4);
   ```
2. Replace `addMultipleCourts` with two functions:
   ```ts
   function openAddMultipleDialog() {
     multipleCourtCount.value = 4;
     showAddMultipleDialog.value = true;
   }

   async function confirmAddMultipleCourts() {
     const numCourts = multipleCourtCount.value;
     if (isNaN(numCourts) || numCourts < 1 || numCourts > 20) {
       notificationStore.showToast('error', 'Please enter a number between 1 and 20');
       return;
     }
     showAddMultipleDialog.value = false;
     loading.value = true;
     try {
       const startNumber = courts.value.length + 1;
       for (let i = 0; i < numCourts; i++) {
         const courtNumber = startNumber + i;
         await tournamentStore.addCourt(props.tournamentId, {
           name: `Court ${courtNumber}`,
           number: courtNumber,
           status: 'available',
         });
       }
       notificationStore.showToast('success', `Added ${numCourts} courts`);
     } catch (error) {
       notificationStore.showToast('error', 'Failed to add courts');
     } finally {
       loading.value = false;
     }
   }
   ```

**In `<template>`:**
1. Change the two `@click="addMultipleCourts"` calls (lines 211, 274) to `@click="openAddMultipleDialog"`.
2. Add a `v-dialog`:
   ```html
   <v-dialog v-model="showAddMultipleDialog" max-width="400" persistent>
     <v-card>
       <v-card-title>Add Multiple Courts</v-card-title>
       <v-card-text>
         <v-text-field
           v-model.number="multipleCourtCount"
           label="Number of courts"
           type="number"
           min="1"
           max="20"
           hint="Between 1 and 20"
           persistent-hint
         />
       </v-card-text>
       <v-card-actions>
         <v-spacer />
         <v-btn variant="text" @click="showAddMultipleDialog = false">Cancel</v-btn>
         <v-btn color="primary" @click="confirmAddMultipleCourts">Add</v-btn>
       </v-card-actions>
     </v-card>
   </v-dialog>
   ```

---

## Fix #4 — `CategoryManagement.vue` → Delete Category Confirmation

**File:** `src/features/tournaments/components/CategoryManagement.vue`
**Line:** 127
**Current code:**
```ts
async function deleteCategory(category: Category) {
  if (!confirm(`Delete "${category.name}"? This cannot be undone.`)) { return; }
  // ...rest
}
```

### Changes Required

**In `<script setup>`:**
1. Add refs:
   ```ts
   const showDeleteCategoryDialog = ref(false);
   const categoryToDelete = ref<Category | null>(null);
   ```
2. Replace `deleteCategory` with two functions:
   ```ts
   function requestDeleteCategory(category: Category) {
     categoryToDelete.value = category;
     showDeleteCategoryDialog.value = true;
   }

   async function confirmDeleteCategory() {
     if (!categoryToDelete.value) return;
     showDeleteCategoryDialog.value = false;
     try {
       await tournamentStore.deleteCategory(props.tournamentId, categoryToDelete.value.id);
       notificationStore.showToast('success', 'Category deleted');
     } catch (error) {
       notificationStore.showToast('error', 'Failed to delete category');
     }
   }
   ```

**In `<template>`:**
1. Change the delete button's `@click` (line 222) from `deleteCategory(category)` to `requestDeleteCategory(category)`.
2. Add a `v-dialog` inside the root `<div>`:
   ```html
   <v-dialog v-model="showDeleteCategoryDialog" max-width="400" persistent>
     <v-card>
       <v-card-title>Delete Category?</v-card-title>
       <v-card-text>
         Delete "{{ categoryToDelete?.name }}"? This cannot be undone.
       </v-card-text>
       <v-card-actions>
         <v-spacer />
         <v-btn variant="text" @click="showDeleteCategoryDialog = false">Cancel</v-btn>
         <v-btn color="error" @click="confirmDeleteCategory">Delete</v-btn>
       </v-card-actions>
     </v-card>
   </v-dialog>
   ```

---

## Fix #5 — `RegistrationManagementView.vue` → Delete Player Confirmation

**File:** `src/features/registration/views/RegistrationManagementView.vue`
**Line:** 414
**Current code:**
```ts
async function deletePlayer(playerId: string) {
  if (!confirm('Are you sure you want to delete this player? This will also affect any registrations.')) {
    return;
  }
  // ...rest
}
```

### Changes Required

**In `<script setup>`:**
1. Add refs:
   ```ts
   const showDeletePlayerDialog = ref(false);
   const playerToDeleteId = ref<string | null>(null);
   ```
2. Replace `deletePlayer` with two functions:
   ```ts
   function requestDeletePlayer(playerId: string) {
     playerToDeleteId.value = playerId;
     showDeletePlayerDialog.value = true;
   }

   async function confirmDeletePlayer() {
     if (!playerToDeleteId.value) return;
     showDeletePlayerDialog.value = false;
     try {
       await registrationStore.deletePlayer(tournamentId.value, playerToDeleteId.value);
       notificationStore.showToast('success', 'Player deleted');
     } catch (error) {
       notificationStore.showToast('error', 'Failed to delete player');
     }
   }
   ```

**In `<template>`:**
1. Find the delete player button/action that calls `deletePlayer(player.id)` and change it to `requestDeletePlayer(player.id)`.
2. Add a `v-dialog` inside the main container:
   ```html
   <v-dialog v-model="showDeletePlayerDialog" max-width="400" persistent>
     <v-card>
       <v-card-title>Delete Player?</v-card-title>
       <v-card-text>
         Are you sure? This will also affect any registrations for this player.
       </v-card-text>
       <v-card-actions>
         <v-spacer />
         <v-btn variant="text" @click="showDeletePlayerDialog = false">Cancel</v-btn>
         <v-btn color="error" @click="confirmDeletePlayer">Delete</v-btn>
       </v-card-actions>
     </v-card>
   </v-dialog>
   ```

---

## Fix #6 — `TournamentDashboardView.vue` → Complete Match Winner Prompt

**File:** `src/features/tournaments/views/TournamentDashboardView.vue`
**Line:** 163
**Current code:**
```ts
async function handleCompleteMatch(matchId: string) {
  const match = matches.value.find((m) => m.id === matchId);
  if (!match) return;
  const winner = prompt(
    'Enter winner: 1 for ' + getParticipantName(match.participant1Id) +
    ', 2 for ' + getParticipantName(match.participant2Id)
  );
  if (!winner || (winner !== '1' && winner !== '2')) return;
  matchStore.completeMatch(tournamentId.value, matchId, winner === '1' ? match.participant1Id : match.participant2Id);
}
```

### Changes Required

**In `<script setup>`:**
1. Add refs:
   ```ts
   const showCompleteMatchDialog = ref(false);
   const matchToComplete = ref<any>(null);
   ```
2. Replace `handleCompleteMatch` with two functions:
   ```ts
   function handleCompleteMatch(matchId: string) {
     const match = matches.value.find((m) => m.id === matchId);
     if (!match) return;
     matchToComplete.value = match;
     showCompleteMatchDialog.value = true;
   }

   async function confirmCompleteMatch(winnerId: string) {
     if (!matchToComplete.value) return;
     showCompleteMatchDialog.value = false;
     try {
       await matchStore.completeMatch(tournamentId.value, matchToComplete.value.id, winnerId);
       notificationStore.showToast('success', 'Match completed');
     } catch (error) {
       notificationStore.showToast('error', 'Failed to complete match');
     }
     matchToComplete.value = null;
   }
   ```

**In `<template>`:**
1. Add a `v-dialog`:
   ```html
   <v-dialog v-model="showCompleteMatchDialog" max-width="400" persistent>
     <v-card v-if="matchToComplete">
       <v-card-title>Select Winner</v-card-title>
       <v-card-text>
         <p class="mb-4">Who won this match?</p>
         <v-btn
           block
           color="primary"
           class="mb-2"
           @click="confirmCompleteMatch(matchToComplete.participant1Id)"
         >
           {{ getParticipantName(matchToComplete.participant1Id) }}
         </v-btn>
         <v-btn
           block
           color="primary"
           variant="outlined"
           @click="confirmCompleteMatch(matchToComplete.participant2Id)"
         >
           {{ getParticipantName(matchToComplete.participant2Id) }}
         </v-btn>
       </v-card-text>
       <v-card-actions>
         <v-spacer />
         <v-btn variant="text" @click="showCompleteMatchDialog = false">Cancel</v-btn>
       </v-card-actions>
     </v-card>
   </v-dialog>
   ```

---

## Summary Table

| # | File | Native Call | Replacement Type | Dialog Action |
|---|------|------------|-----------------|---------------|
| 1 | `ScoringInterfaceView.vue:210` | `confirm()` | Confirmation dialog | Walkover |
| 2 | `CourtManagement.vue:96` | `confirm()` | Confirmation dialog | Delete court |
| 3 | `CourtManagement.vue:172` | `prompt()` | Input dialog | Court count |
| 4 | `CategoryManagement.vue:127` | `confirm()` | Confirmation dialog | Delete category |
| 5 | `RegistrationManagementView.vue:414` | `confirm()` | Confirmation dialog | Delete player |
| 6 | `TournamentDashboardView.vue:163` | `prompt()` | Selection dialog | Pick winner |

## Verification

After all changes, run:
```bash
grep -rn "confirm(" src/ --include="*.vue" --include="*.ts" | grep -v "function confirm" | grep -v "confirmRelease" | grep -v "confirmReset" | grep -v "confirmDelete" | grep -v "confirmAdd" | grep -v "confirmWalkover" | grep -v "confirmComplete" | grep -v "showConfirm"
grep -rn "prompt(" src/ --include="*.vue" --include="*.ts"
grep -rn "alert(" src/ --include="*.vue" --include="*.ts"
```

All three commands should return **zero** results for native browser calls.
