# Coding Pattern Guide — CourtMaster v2

> **Living Document.** Every bug fix MUST add or update a pattern here.
> See [AGENTS.md § 12](../../AGENTS.md) for the Post-Fix Protocol.

---

## How to Use This File

1. **Before writing code** — scan the relevant category below for anti-patterns to avoid.
2. **After fixing a bug** — add a new pattern entry using `TEMPLATE.md` in this directory.
3. **During code review** — use the "Detection" commands to scan for violations.

---

## Category: UI / User Experience

### CP-001: No Native Browser Dialogs

| Field | Value |
|-------|-------|
| **Added** | 2025-02-13 |
| **Source Bug** | Zombie Court — native `confirm()` auto-dismissed |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
async function deleteItem(id: string) {
  if (!confirm('Are you sure?')) return;    // ← BLOCKS thread, auto-dismisses, wrong theme
  await store.delete(id);
}
```

**Correct Pattern (✅):**
```typescript
// 1. Add reactive state
const showDeleteDialog = ref(false);
const itemToDeleteId = ref<string | null>(null);

// 2. Split into request + confirm
function requestDelete(id: string) {
  itemToDeleteId.value = id;
  showDeleteDialog.value = true;
}

async function confirmDelete() {
  if (!itemToDeleteId.value) return;
  showDeleteDialog.value = false;
  try {
    await store.delete(itemToDeleteId.value);
    notificationStore.showToast('success', 'Deleted');
  } catch (error) {
    notificationStore.showToast('error', 'Failed to delete');
  }
}
```
```html
<!-- 3. Add v-dialog in template -->
<v-dialog v-model="showDeleteDialog" max-width="400" persistent>
  <v-card>
    <v-card-title>Delete Item?</v-card-title>
    <v-card-text>This cannot be undone.</v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn variant="text" @click="showDeleteDialog = false">Cancel</v-btn>
      <v-btn color="error" @click="confirmDelete">Delete</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
```

**Detection:**
```bash
grep -rn "confirm(" src/ --include="*.vue" --include="*.ts" | grep -v "//.*confirm"
grep -rn "prompt(" src/ --include="*.vue" --include="*.ts" | grep -v "//.*prompt"
grep -rn "alert(" src/ --include="*.vue" --include="*.ts" | grep -v "//.*alert"
```

**Fix Guide:** [docs/fix/replace-native-dialogs.md](../fix/replace-native-dialogs.md)

---

## Category: Data Integrity

### CP-002: Reverse Lookups for Cross-Collection References

| Field | Value |
|-------|-------|
| **Added** | 2025-02-13 |
| **Source Bug** | Zombie Court — court stuck "In Use" after match lost `courtId` |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// Relying on a single forward link
async function completeMatch(matchId: string) {
  const matchDoc = await getDoc(matchRef);
  const courtId = matchDoc.data()?.courtId;
  if (!courtId) {
    console.warn('No courtId found');  // ← Gives up. Court stays "In Use" forever.
    return;
  }
  await releaseCourt(courtId);
}
```

**Correct Pattern (✅):**
```typescript
async function completeMatch(matchId: string) {
  const matchDoc = await getDoc(matchRef);
  let courtId = matchDoc.data()?.courtId;

  // Fallback 1: Check in-memory state
  if (!courtId) {
    courtId = currentMatch.value?.courtId;
  }

  // Fallback 2: Reverse lookup — query courts that reference this match
  if (!courtId) {
    const courtsRef = collection(db, `tournaments/${tournamentId}/courts`);
    const q = query(courtsRef, where('currentMatchId', '==', matchId));
    const snap = await getDocs(q);
    if (!snap.empty) courtId = snap.docs[0].id;
  }

  if (courtId) await releaseCourt(courtId);
}
```

**Rule:** Any function that transitions state across collections (match ↔ court, player ↔ registration) MUST have at least one fallback mechanism for finding the related document.

**Detection:**
```bash
# Find state transitions that only use a single forward reference
grep -rn "courtId\|currentMatchId\|assignedMatchId" src/stores/ --include="*.ts" | grep -v "Fallback\|fallback\|reverse"
```

---

### CP-003: Always Clean Both Sides of a Relationship

| Field | Value |
|-------|-------|
| **Added** | 2025-02-13 |
| **Source Bug** | Zombie Court — match completed but court status not updated |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// Only updating one side of the relationship
await updateDoc(matchRef, { status: 'completed' });
// ← Court still says "in_use" with currentMatchId pointing to this match!
```

**Correct Pattern (✅):**
```typescript
// Use a Firestore batch to update BOTH sides atomically
const batch = writeBatch(db);

// Update match
batch.update(matchRef, { status: 'completed', completedAt: serverTimestamp() });

// Update court (the other side)
batch.update(courtRef, {
  status: 'available',
  currentMatchId: null,
  assignedMatchId: null,
  lastFreedAt: serverTimestamp(),
});

await batch.commit();  // Both succeed or both fail
```

**Rule:** When two documents reference each other (match ↔ court), always use `writeBatch` to update both atomically.

**Detection:**
```bash
# Find status updates that might be missing the other side
grep -rn "status: 'completed'" src/stores/ --include="*.ts" -A 5 | grep -v "batch\|writeBatch"
```

---

## Category: Code Quality

### CP-004: No Duplicate Function Declarations

| Field | Value |
|-------|-------|
| **Added** | 2025-02-13 |
| **Source Bug** | Duplicate `releaseCourt` function caused runtime error |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Rule:** Before adding a function to a file, search for its name in the file first. If it exists, modify the existing function instead of adding a new one.

**Detection:**
```bash
# Find duplicate function names within each .vue/.ts file
for f in $(find src/ -name "*.vue" -o -name "*.ts"); do
  dups=$(grep -oP "(?:function |const )\K\w+(?= *[=(])" "$f" | sort | uniq -d)
  if [ -n "$dups" ]; then echo "$f: $dups"; fi
done
```

---

### CP-005: Use `notificationStore.showToast` for User Feedback

| Field | Value |
|-------|-------|
| **Added** | 2025-02-13 |
| **Source Bug** | Inconsistent error handling — some errors silent, some use `console.error` only |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
try {
  await doSomething();
} catch (error) {
  console.error(error);  // ← User sees nothing
}
```

**Correct Pattern (✅):**
```typescript
try {
  await doSomething();
  notificationStore.showToast('success', 'Action completed');
} catch (error) {
  console.error('Failed to do something:', error);
  notificationStore.showToast('error', 'Failed to do something');
}
```

**Detection:**
```bash
# Find catch blocks that only console.error without showing user feedback
grep -rn "catch" src/ --include="*.vue" --include="*.ts" -A 3 | grep "console.error" | grep -v "showToast"
```

---

## Category: Firestore

### CP-006: Use `serverTimestamp()` for All Timestamps

| Field | Value |
|-------|-------|
| **Added** | 2025-02-13 |
| **Source Bug** | N/A — preventive pattern |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
await updateDoc(ref, { updatedAt: new Date() });  // ← Client clock may be wrong
```

**Correct Pattern (✅):**
```typescript
await updateDoc(ref, { updatedAt: serverTimestamp() });  // ← Server's clock, always correct
```

**Detection:**
```bash
grep -rn "new Date()" src/stores/ --include="*.ts" | grep -i "update\|create\|set"
```

---

## Category: PWA

### CP-007: Keep Required Install Icons in `public/`

| Field | Value |
|-------|-------|
| **Added** | 2026-02-15 |
| **Source Bug** | PWA install prompts failed due to missing icon files |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
VitePWA({
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
  manifest: {
    icons: [
      { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
});
// Missing files in public/: installability breaks on mobile/desktop
```

**Correct Pattern (✅):**
```bash
# Keep these files present in public/ whenever referenced by VitePWA:
public/favicon.ico
public/apple-touch-icon.png
public/pwa-192x192.png
public/pwa-512x512.png
```

**Detection:**
```bash
for f in public/favicon.ico public/apple-touch-icon.png public/pwa-192x192.png public/pwa-512x512.png; do [ -f "$f" ] || echo "Missing: $f"; done
```

---

## Category: Navigation

### CP-008: Navigation Links Must Map to Real Router Targets

| Field | Value |
|-------|-------|
| **Added** | 2026-02-15 |
| **Source Bug** | Organizer sidebar/search/context links sent users to dead routes |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
router.push('/profile');                      // Route not registered
router.push(`/tournaments/${id}/scoring`);   // Legacy path not in router
const path = `/tournaments/${id}/dashboard`; // Non-existent dashboard route
```

**Correct Pattern (✅):**
```typescript
router.push('/tournaments');
router.push(`/tournaments/${id}`);
router.push(`/tournaments/${id}/matches`);
router.push(`/tournaments/${id}/leaderboard`);
```

**Rule:** Any new `to`/`router.push` target must either:
1. Match a registered route in `src/router/index.ts`, or
2. Be explicitly supported by a redirect alias in `src/router/index.ts`.

**Detection:**
```bash
rg -n "/profile|/preferences|/tournaments/active/match-control|/tournaments/\\$\\{[^}]+\\}/dashboard|/tournaments/.*/dashboard|/scoring\\b|/tournaments/.*/results" src/components src/composables src/features
```

---

## Category: Data Integrity

### CP-009: Resolve Match Round/Bracket via `round_id` + `group_id`

| Field | Value |
|-------|-------|
| **Added** | 2026-02-15 |
| **Source Bug** | Match Control showed `Match #1` / `Round 1` repeatedly because adapter defaulted `round` to 1 |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// Assumes enhanced fields always exist
const roundNumber = bracketsMatch.round || 1;
const bracketType = bracketsMatch.bracket || 'winners';
```

**Correct Pattern (✅):**
```typescript
// Canonical schema uses /round and /group collections
const maps = buildMatchStructureMaps(rounds, groups);
const roundNumber = maps.roundNumberByRoundId.get(String(match.round_id)) ?? 1;
const bracketType = maps.bracketByRoundId.get(String(match.round_id)) ?? 'winners';
```

**Rule:** For any UI-facing match list/scheduler that reads `/match`, treat `round_id` as authoritative and resolve display round/bracket via `/round` + `/group`, with enhanced `round`/`bracket` only as fallback.

**Detection:**
```bash
rg -n "const\\s+round(Number)?\\s*=\\s*bracketsMatch\\.round\\s*\\|\\|\\s*1|const\\s+bracket(Type)?\\s*=\\s*bracketsMatch\\.bracket\\s*\\|\\|\\s*'winners'" src/stores src/composables
```

---

### CP-010: Do Not Render `match.number` Alone as a Unique Match Identifier

| Field | Value |
|-------|-------|
| **Added** | 2026-02-15 |
| **Source Bug** | Match Control "Match #" looked stuck at `#1` although source data was correct |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<template #item.matchNumber="{ item }">
  <span>#{{ item.matchNumber }}</span>
</template>
```

**Correct Pattern (✅):**
```vue
<template #item.matchNumber="{ item }">
  <span>#{{ item.id }}</span>
  <span>{{ getBracketCode(item) }}-{{ item.matchNumber }}</span>
</template>
```

**Rule:** In Match Control schedule views, display a source-unique identifier (`match.id`) and optional bracket/slot context. `match.number` alone is not unique in elimination brackets.

**Detection:**
```bash
rg -n "#\\{\\{ item\\.matchNumber \\}\\}" src/features/tournaments/views/MatchControlView.vue
```

---

## Category: Code Reuse / Composables

### CP-011: Use `useParticipantResolver()` for All Participant Name Resolution

| Field | Value |
|-------|-------|
| **Added** | 2026-02-15 |
| **Source Bug** | MatchListView showed "Unknown vs Unknown" because it used wrong lookup pattern |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// ❌ DON'T: Duplicate getParticipantName() in every component
// MatchListView.vue
function getParticipantName(participantId: string | undefined): string {
  if (!participantId) return 'TBD';
  const player = registrationStore.getPlayerById(participantId); // ← WRONG: participantId is registration ID, not player ID
  return player ? `${player.firstName} ${player.lastName}` : 'Unknown';
}

// ❌ DON'T: Inline lookup logic scattered across 15+ components
const name = registrations.value.find(r => r.id === id)?.teamName || 
             players.value.find(p => p.id === registration.playerId)?.firstName;
```

**Correct Pattern (✅):**
```typescript
// ✅ DO: Use centralized composable
import { useParticipantResolver } from '@/composables/useParticipantResolver';

const { getParticipantName, getParticipantDisplay } = useParticipantResolver();

// In template or computed:
const playerName = getParticipantName(match.participant1Id); // Returns: "John Smith" or "Team A"
const display = getParticipantDisplay(match.participant1Id);  // Returns: { name, isTeam, playerId }
```

**Why This Matters:**
- `participant1Id`/`participant2Id` are **registration IDs** (Firestore doc IDs from `/registrations`)
- To get the name: Registration → (if team) `teamName` OR (if singles) Player lookup
- 15+ components had duplicate implementations with subtle bugs
- Centralized composable ensures consistency and handles all edge cases

**Detection:**
```bash
# Find duplicate implementations (should only exist in composable)
grep -rn "function getParticipantName" src/features/ --include="*.vue" --include="*.ts" | grep -v "useParticipantResolver"

# Find inline participant lookups that should use composable
grep -rn "registrations.value.find.*playerId" src/features/ --include="*.vue"
```

**Files Already Refactored:**
- ✅ `MatchListView.vue` — now uses composable
- ✅ `TournamentDashboardView.vue` — now uses composable
- ✅ `MatchControlView.vue` — now uses composable

**Files Still Needing Refactor:**
- ⚠️ `RoundRobinStandings.vue` — has local implementation
- ⚠️ `BracketView.vue` — has local implementation with extra `match` parameter
- ⚠️ `DoubleEliminationBracket.vue` — has local implementation
- ⚠️ `PublicLiveScoresView.vue` — has local implementation
- ⚠️ `PublicScoringView.vue` — has local implementation
- ⚠️ `ScoringInterfaceView.vue` — has local implementation
- ⚠️ `MatchAnnouncementPanel.vue` — has local implementation
- ⚠️ `DraggableMatchQueue.vue` — has local implementation
- ⚠️ `MatchStatsDashboard.vue` — has local implementation
- ⚠️ `CourtStatusBoard.vue` — has local implementation
- ⚠️ `CourtManagement.vue` — has local implementation
- ⚠️ `WalkoverDialog.vue` — has local implementation

---

### CP-012: Pass `categoryId` When Navigating to Match Scoring

| Field | Value |
|-------|-------|
| **Added** | 2026-02-15 |
| **Source Bug** | "Match not found" error when correcting scores — categoryId not passed in URL |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// ❌ DON'T: Navigate without categoryId
function goToScoring(matchId: string) {
  router.push(`/tournaments/${tournamentId}/matches/${matchId}/score`);
}

// ❌ DON'T: Use string template without query params
:to="`/tournaments/${tournamentId}/matches/${matchId}/score`"
```

**Correct Pattern (✅):**
```typescript
// ✅ DO: Pass categoryId as query parameter
function goToScoring(matchId: string, categoryId?: string) {
  router.push({
    path: `/tournaments/${tournamentId}/matches/${matchId}/score`,
    query: categoryId ? { category: categoryId } : undefined
  });
}

// ✅ DO: In template, pass categoryId from match
@click="goToScoring(match.id, match.categoryId)"

// ✅ DO: Use object syntax for router-link
:to="{ 
  path: `/tournaments/${tournamentId}/matches/${item.id}/score`, 
  query: item.categoryId ? { category: item.categoryId } : undefined 
}"
```

**Why This Matters:**
- Matches are stored at: `tournaments/{id}/categories/{categoryId}/match/{matchId}`
- Without `categoryId`, `fetchMatch()` looks in wrong path and returns "Match not found"
- `ScoringInterfaceView` reads `route.query.category` to determine correct Firestore path

**Detection:**
```bash
# Find navigation that doesn't pass categoryId
grep -rn "router.push.*matches.*score" src/features/ --include="*.vue" | grep -v "categoryId\|category"
grep -rn ":to=.*matches.*score" src/features/ --include="*.vue" | grep -v "categoryId\|category"
```

**Files Already Fixed:**
- ✅ `MatchListView.vue` — now passes categoryId
- ✅ `TournamentDashboardView.vue` — now passes categoryId

---

### CP-013: Use Shared Composables for Repeated Display Logic

| Field | Value |
|-------|-------|
| **Added** | 2026-02-15 |
| **Source Bug** | N/A — preventive pattern for maintainability |
| **Severity** | Medium |
| **Status** | 🟡 Proposed |

**Anti-Pattern (❌):**
```typescript
// ❌ DON'T: Inline match display formatting in multiple components
// Component A
const display = `${p1Name} vs ${p2Name}`;

// Component B
const display = computed(() => {
  if (!match.value) return '';
  return `${getParticipantName(match.value.participant1Id)} vs ${getParticipantName(match.value.participant2Id)}`;
});

// Component C
const matchLabel = `${match.round} - ${p1Name} vs ${p2Name}`;
```

**Correct Pattern (✅):**
```typescript
// ✅ DO: Create shared composable for match display
// src/composables/useMatchDisplay.ts
export function useMatchDisplay() {
  const { getParticipantName } = useParticipantResolver();
  
  function getMatchDisplayName(match: Match): string {
    const p1 = getParticipantName(match.participant1Id);
    const p2 = getParticipantName(match.participant2Id);
    return `${p1} vs ${p2}`;
  }
  
  function getMatchWithContext(match: Match): string {
    return `Round ${match.round} - Match #${match.matchNumber}: ${getMatchDisplayName(match)}`;
  }
  
  function getMatchWithBracket(match: Match): string {
    const bracket = match.bracketPosition?.bracket || 'winners';
    return `${bracket} Bracket - Round ${match.round}: ${getMatchDisplayName(match)}`;
  }
  
  return { getMatchDisplayName, getMatchWithContext, getMatchWithBracket };
}

// Usage in components:
const { getMatchDisplayName } = useMatchDisplay();
const label = getMatchDisplayName(match);
```

**Proposed New Composables:**
1. `useMatchDisplay()` — Match formatting (names, round, bracket context)
2. `useFirestorePaths()` — Centralized Firestore collection path construction
3. `useCourtManagement()` — Court release/assignment operations
4. `useMatchNavigation()` — Navigation with proper query params

**Detection:**
```bash
# Find inline match display formatting
grep -rn "vs.*getParticipantName\|getParticipantName.*vs" src/features/ --include="*.vue" | grep -v "useMatchDisplay"

# Find repeated Firestore path construction
grep -rn "tournaments/.*categories.*match_scores" src/ --include="*.ts" --include="*.vue" | wc -l
```

---

### CP-014: Standardize List Filters With Shared `FilterBar`

| Field | Value |
|-------|-------|
| **Added** | 2026-02-16 |
| **Source Bug** | TOURNEY-105 — inconsistent filter controls and ordering across list pages |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<!-- Inline page-specific controls with inconsistent order/labels -->
<v-text-field v-model="searchQuery" label="Search participants" />
<v-select v-model="selectedCategory" label="Category" />
<v-select v-model="selectedStatus" label="Status" />
<v-btn @click="clearFilters">Clear Filters</v-btn>
```

```vue
<!-- Another page duplicates the same concept differently -->
<v-text-field v-model="scheduleFilters.searchQuery" label="Search participants" />
<v-select v-model="scheduleFilters.courtId" label="Filter by Court" />
```

**Correct Pattern (✅):**
```vue
<filter-bar
  :search="searchQuery"
  :category="selectedCategory"
  :status="selectedStatus"
  :court="selectedCourt"
  :sort="selectedSort"
  :enable-category="true"
  :enable-status="true"
  :enable-court="isMatchPage"
  :category-options="categoryOptions"
  :status-options="statusOptions"
  :court-options="courtOptions"
  :sort-options="sortOptions"
  :has-active-filters="hasActiveFilters"
  @update:search="searchQuery = $event"
  @clear="clearFilters"
/>
```

**Rule:** List pages must use the shared `FilterBar` component so Search/Category/Status/Court/Sort/Clear stay consistently labeled, ordered, and reset behavior remains uniform.

**Detection:**
```bash
rg -n "<filter-bar" src/features/registration/views/RegistrationManagementView.vue src/features/registration/views/ParticipantsView.vue src/features/checkin/views/CheckInDashboardView.vue src/features/scoring/views/MatchListView.vue src/features/tournaments/views/MatchControlView.vue
rg -n "Search participants|Filter by Category|Filter by Court|Clear Filters" src/features/registration/views/RegistrationManagementView.vue src/features/registration/views/ParticipantsView.vue src/features/checkin/views/CheckInDashboardView.vue src/features/scoring/views/MatchListView.vue src/features/tournaments/views/MatchControlView.vue
```

---

## Category: UI / Layout

### CP-015: Command Center 3-Panel Layout Must Be Resizable

| Field | Value |
|-------|-------|
| **Added** | 2026-02-16 |
| **Source Bug** | Match Control command center had fixed 3-column widths and could not be resized for venue/operator preference |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<!-- Fixed breakpoints lock panel proportions -->
<v-col cols="12" md="6" lg="7">...</v-col>
<v-col cols="12" md="3" lg="2">...</v-col>
<v-col cols="12" md="3" lg="3">...</v-col>
```

**Correct Pattern (✅):**
```vue
<!-- Desktop: draggable splitters between panels -->
<div ref="commandLayoutRef" class="command-layout" :style="commandLayoutStyle">
  <div class="command-panel command-panel--courts">...</div>
  <button class="command-resizer" @mousedown="beginCommandResize('left-middle', $event)" />
  <div class="command-panel command-panel--queue">...</div>
  <button class="command-resizer" @mousedown="beginCommandResize('middle-right', $event)" />
  <div class="command-panel command-panel--alerts">...</div>
</div>

<!-- Mobile: collapse to courts-only with side panels hidden -->
```

**Rule:** Any 3-panel operational layout (courts/queue/alerts) must support user-driven width adjustment on desktop and collapse cleanly on small screens.

**Detection:**
```bash
rg -n "v-else-if=\"viewMode === 'command'\" -A 120 src/features/tournaments/views/MatchControlView.vue | rg "v-col|md=\"6\"|lg=\"7\"|md=\"3\"|lg=\"2\"|lg=\"3\""
rg -n "command-layout|command-resizer|beginCommandResize" src/features/tournaments/views/MatchControlView.vue
```

---

### CP-016: Use `BaseDialog` for Standardized Dialogs

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source** | Week 2 Refactoring — Standardized dialog component |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<v-dialog v-model="showDialog" max-width="600">
  <v-card>
    <v-card-title>Title</v-card-title>
    <v-card-text>Content</v-card-text>
    <v-card-actions>
      <v-btn @click="showDialog = false">Cancel</v-btn>
      <v-btn @click="save">Save</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
```

**Correct Pattern (✅):**
```vue
<BaseDialog
  v-model="showDialog"
  title="Add Category"
  @confirm="save"
  :loading="loading"
>
  <v-text-field v-model="form.name" label="Name" />
</BaseDialog>
```

**Detection:**
```bash
grep -rn "v-dialog" src/ --include="*.vue" | grep -v "BaseDialog" | wc -l
```

**Migration:** See [docs/ui-patterns/base-dialog.md](../ui-patterns/base-dialog.md)

---

### CP-017: Use `EmptyState` for List Empty States

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source** | Week 2 Refactoring — Standardized empty state component |
| **Severity** | Low |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<v-card-text class="text-center py-8">
  <v-icon size="48" color="grey-lighten-1">mdi-folder-open</v-icon>
  <p class="text-body-2 text-grey mt-2">No items</p>
</v-card-text>
```

**Correct Pattern (✅):**
```vue
<EmptyState
  title="No categories yet"
  message="Add your first category to get started"
  :action="{ label: 'Add Category', handler: openAddDialog }"
/>
```

**Detection:**
```bash
grep -rn "text-center py-8" src/ --include="*.vue"
```

**Migration:** See [docs/ui-patterns/empty-state.md](../ui-patterns/empty-state.md)

---

### CP-018: Use `useAsyncOperation` for Async State Management

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source** | Week 2 Refactoring — Standardized async operation composable |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const loading = ref(false);
const error = ref<string | null>(null);

async function save() {
  loading.value = true;
  error.value = null;
  try {
    await store.save();
  } catch (err) {
    error.value = 'Failed';
  } finally {
    loading.value = false;
  }
}
```

**Correct Pattern (✅):**
```typescript
const { loading, error, execute } = useAsyncOperation();

async function save() {
  await execute(() => store.save());
}
```

**Detection:**
```bash
grep -rn "loading.value = true" src/ --include="*.vue" --include="*.ts" | grep -v "useAsyncOperation"
```

**Migration:** See [docs/ui-patterns/use-async-operation.md](../ui-patterns/use-async-operation.md)

---

### CP-019: Operational Match Lists Must Use Shared `ManualScoreDialog`

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source Bug** | Score Matches `Score` action opened a separate scoring screen instead of manual entry |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// Score Matches list item click navigates away
function goToScoring(matchId: string, categoryId?: string) {
  router.push({
    path: `/tournaments/${tournamentId}/matches/${matchId}/score`,
    query: categoryId ? { category: categoryId } : undefined,
  });
}
```

**Correct Pattern (✅):**
```typescript
// Reuse shared manual-entry dialog used by match operations views
function openScoreDialog(match: Match): void {
  if (!match.participant1Id || !match.participant2Id) {
    notificationStore.showToast('error', 'Cannot score this match until both participants are assigned');
    return;
  }
  selectedMatch.value = match;
  showManualScoreDialog.value = true;
}
```
```vue
<ManualScoreDialog
  v-model="showManualScoreDialog"
  :match="selectedMatch"
  :tournament-id="tournamentId"
  :tournament="tournament"
  :categories="tournamentStore.categories"
/>
```

**Rule:** In operational scoring lists (`Score Matches`, `Match Control`, live scheduling views), `Score`/`Correct` actions should open shared manual-entry dialog UI, not route to a separate scoring page.  
If a view uses `useDialogManager`, every dialog used in template `v-model` must be bound via `computed` state (or `dialogs.<name>`) and not undefined legacy `show*Dialog` refs.

**Detection:**
```bash
rg -n "router.push\\(\\{\\s*path:\\s*`/tournaments/\\$\\{.*\\}/matches/\\$\\{.*\\}/score`" src/features/scoring/views src/features/tournaments/views --glob "*.vue"
rg -n "title=\\\"Manual Score Entry\\\"|manualScores" src/features/scoring/views src/features/tournaments/views --glob "*.vue" | grep -v "ManualScoreDialog.vue"
rg -n 'v-model="show[A-Za-z]+Dialog"|const show[A-Za-z]+Dialog = computed<boolean>' src/features/tournaments/views/MatchControlView.vue
```

---

### CP-020: Do Not Block Auth on Firestore Profile Failures

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source Bug** | Deployed register/login showed generic auth failure when `/users/{uid}` profile read/write failed |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    currentUser.value = null;
    return;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      currentUser.value = mapUser(userDoc.data());
    }
  } catch (err) {
    error.value = 'Failed to load user profile';
    // ❌ currentUser never set => app treats authenticated users as logged out
  }
});
```

**Correct Pattern (✅):**
```typescript
try {
  const userDoc = await getDoc(doc(db, 'users', user.uid));
  if (userDoc.exists()) {
    setCurrentUserFromFirestore(user, userDoc.data());
  } else {
    await createUserProfile(user, 'viewer');
  }
} catch (err) {
  console.error('Error fetching user profile:', err);
  currentUser.value = buildFallbackUser(user, 'viewer');
  error.value = 'Signed in with limited access. Failed to load user profile.';
}
```

**Rule:** Auth success (`onAuthStateChanged` user present) must always populate a safe fallback `currentUser` even if Firestore profile lookup/create fails.

**Detection:**
```bash
rg -n "Error fetching user profile|Failed to load user profile|An authentication error occurred" src/stores/auth.ts
rg -n "catch \\(err\\).*user profile" src/stores/auth.ts -A 5 | rg -v "buildFallbackUser|Signed in with limited access"
```

---

### CP-021: Resolve Player Names with Fallbacks in Registration UI

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source Bug** | Manual registration dialog showed `undefined undefined` for player choices when legacy player docs lacked `firstName`/`lastName` |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<!-- Direct concatenation assumes both fields always exist -->
<v-select
  :items="players"
  :item-title="(p) => `${p.firstName} ${p.lastName}`"
/>
```
```typescript
function getPlayerName(playerId: string): string {
  const player = players.value.find((p) => p.id === playerId);
  return `${player?.firstName} ${player?.lastName}`;
}
```

**Correct Pattern (✅):**
```typescript
interface PlayerNameSource {
  id?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  name?: string;
  fullName?: string;
}

function getPlayerDisplayName(player: PlayerNameSource | undefined): string {
  if (!player) return 'Unknown';
  const firstLast = `${player.firstName || ''} ${player.lastName || ''}`.trim();
  if (firstLast) return firstLast;
  return player.displayName || player.name || player.fullName || (player.id ? `Player ${player.id}` : 'Unknown');
}
```
```vue
<v-select
  :items="players"
  :item-title="getPlayerItemTitle"
/>
```

**Rule:** Any player label shown in registration flows (dropdowns, list rows, team name generation) must use a shared fallback resolver, not direct ```${firstName} ${lastName}``` concatenation.

**Detection:**
```bash
rg -n "\\$\\{[^}]*firstName[^}]*\\}\\s*\\$\\{[^}]*lastName[^}]*\\}" src/features/registration --glob "*.vue" --glob "*.ts"
```

---

### CP-022: Preserve Firestore Doc IDs When Hydrating Typed Objects

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source Bug** | Pool/elimination generation failed because hydrated objects lost required `id` fields (`tournamentId`/`stageId` resolution broke) |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const category = {
  id: categoryDoc.id,
  ...(categoryDoc.data() as Omit<Category, 'id'>),
};
```
```typescript
const participant = {
  id: Number(docSnap.data().id ?? docSnap.id),
  ...(docSnap.data() as Omit<StoredParticipant, 'id'>),
};
```

**Correct Pattern (✅):**
```typescript
const category = {
  ...(categoryDoc.data() as Omit<Category, 'id'>),
  id: categoryDoc.id,
};
```
```typescript
const participant = {
  ...(docSnap.data() as Omit<StoredParticipant, 'id'>),
  id: Number(docSnap.data().id ?? docSnap.id),
};
```

**Rule:** When combining Firestore `doc.data()` with a canonical `id` from `doc.id`, always spread `doc.data()` first and set `id` last so partial/legacy payloads cannot overwrite the ID.

**Detection:**
```bash
rg -n -U "id:\\s*[^\\n]+,\\n\\s*\\.\\.\\.\\(.*doc.*data\\(" src --glob "*.ts" --glob "*.vue"
```

---

### CP-023: Use Category-Scoped Match Identity in Multi-Category Views

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source Bug** | Match Control command center showed Vue duplicate-key warnings and unscheduled wrong match doc (`match_scores/<id>` NOT_FOUND) when different categories shared the same match ID |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<template v-for="match in matches" :key="match.id">
  <v-list-item @click="emit('assign', match.id)" />
</template>
```
```typescript
const match = matches.value.find((m) => m.id === matchId);
await matchStore.unscheduleMatch(tournamentId, matchId, match?.categoryId);
```

**Correct Pattern (✅):**
```vue
<template v-for="match in matches" :key="`${match.categoryId}-${match.id}`">
  <v-list-item @click="emit('assign', { matchId: match.id, categoryId: match.categoryId })" />
</template>
```
```typescript
const match = matches.value.find((m) => m.id === ref.matchId && m.categoryId === ref.categoryId);
await matchStore.unscheduleMatch(tournamentId, ref.matchId, ref.categoryId, releaseCourtId);
```

**Rule:** Any list/action operating on matches aggregated from multiple categories MUST use a composite identity (`categoryId + match.id`) for both render keys and event payloads.

**Detection:**
```bash
rg -n ":key=\"match.id\"|emit\\('(select|assign|unschedule)',\\s*match.id\\)|find\\(m => m.id === .*\\)" src/features/tournaments --glob "*.vue" --glob "*.ts"
```

---

### CP-024: Hide/Lock Provisional Pool Rankings Until Pool Completion

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source Bug** | Create Levels dialog displayed misleading Pool/Global ranks before pool stage completion |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<v-data-table :items="assignmentRows">
  <template #item.poolRank="{ item }">{{ item.poolRank }}</template>
  <template #item.globalRank="{ item }">{{ item.globalRank }}</template>
  <template #item.finalLevelIndex="{ item }">
    <v-select :model-value="item.finalLevelIndex" />
  </template>
</v-data-table>
```

**Correct Pattern (✅):**
```vue
<v-alert v-if="pendingMatches > 0" type="warning">
  Pool Rank and Global Rank are provisional until all pool matches are completed.
</v-alert>
<template #item.poolRank="{ item }">
  <span v-if="isPoolStageComplete">{{ item.poolRank }}</span>
  <span v-else>--</span>
</template>
<template #item.globalRank="{ item }">
  <span v-if="isPoolStageComplete">{{ item.globalRank }}</span>
  <span v-else>--</span>
</template>
<v-select :disabled="!isPoolStageComplete" />
```

**Rule:** Any level-splitting UI that depends on pool standings must not present standings as final (or allow manual level overrides) until all required pool matches are complete.

**Detection:**
```bash
rg -n "Create Levels from Pool Results|item.poolRank|item.globalRank|isPoolStageComplete|finalLevelIndex" src/features/tournaments/components/CreateLevelsDialog.vue
```

---

### CP-025: Add Explicit Rules for Every New Firestore Subcollection Path

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source Bug** | Level generation failed with `FirebaseError: No matching allow statements` |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
await setDoc(doc(db, `tournaments/${tId}/categories/${cId}/levels/${levelId}`), data);
await setDoc(doc(db, `tournaments/${tId}/categories/${cId}/level_assignments/${regId}`), data);
await setDoc(doc(db, `tournaments/${tId}/categories/${cId}/level_generation/config`), data);
```
```rules
match /categories/{categoryId} {
  allow read, write: if isAuthenticated();
  // Missing: /levels, /level_assignments, /level_generation subcollection rules
}
```

**Correct Pattern (✅):**
```rules
match /categories/{categoryId} {
  allow read: if true;
  allow write: if isAuthenticated();

  match /levels/{levelId} { allow read: if true; allow write: if isAuthenticated(); }
  match /level_assignments/{assignmentId} { allow read: if true; allow write: if isAuthenticated(); }
  match /level_generation/{configId} { allow read: if true; allow write: if isAuthenticated(); }
}
```

**Rule:** Firestore rules are not inherited to subcollections. Every newly introduced subcollection path must be explicitly matched in `firestore.rules` before shipping.

**Detection:**
```bash
rg -n "categories/.*/(levels|level_assignments|level_generation)|/levels/\\$\\{levelId\\}" src --glob "*.ts" --glob "*.vue"
rg -n "match /levels/\\{levelId\\}|match /level_assignments/\\{assignmentId\\}|match /level_generation/\\{configId\\}" firestore.rules
```

---

### CP-026: Never Use Truthy Checks for Numeric IDs

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source Bug** | Seed flow failed to detect generated pool stage because valid `stageId = 0` was treated as false |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
let poolStageId = 0;
if (!poolStageId) {
  throw new Error('Pool stage not found');
}
```

**Correct Pattern (✅):**
```typescript
let poolStageId: number | null = null;
if (poolStageId === null) {
  throw new Error('Pool stage not found');
}
```

**Rule:** IDs can be `0` in brackets-manager tables (`stage`, `group`, `round`, `match`). Use explicit `null/undefined` checks, never generic truthy checks.

**Detection:**
```bash
rg -n "if\\s*\\(\\s*!.*(stageId|groupId|roundId|matchId|id)\\s*\\)" scripts src --glob "*.ts" --glob "*.vue"
```

---

### CP-027: Seed Team Names Must Use Full Player Names

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source Bug** | Seeded registrations in `seed-simple`/`seed-production` showed repeated team labels (`Davis / Anderson`, `Carter / Carter`) even when teams were different |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
teamName: `${p1.last} / ${p2.last}`;
```

**Correct Pattern (✅):**
```typescript
const formatTeamName = (p1: PlayerName, p2: PlayerName): string =>
  `${p1.first} ${p1.last} / ${p2.first} ${p2.last}`;

teamName: formatTeamName(p1, p2);
```

**Rule:** Seed data must use full-name team labels and deterministic unique name generation so registration lists are human-readable and not collision-prone.

**Detection:**
```bash
rg -n "teamName:\\s*`\\$\\{\\w+\\.last\\}\\s*/\\s*\\$\\{\\w+\\.last\\}`" scripts --glob "seed*.ts"
```

---

### CP-028: Dashboard Must Show Upcoming and Remaining Matches (Not Only Live)

| Field | Value |
|-------|-------|
| **Added** | 2026-02-18 |
| **Source Bug** | Organizers saw "no matches in progress" even though tournament had many `ready`/`scheduled`/remaining matches |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<div v-if="stats.inProgressMatches > 0">
  <!-- only active matches -->
</div>
```

**Correct Pattern (✅):**
```vue
<div>
  <ActiveMatchesSection :matches="liveMatches" />
  <ReadyQueue :matches="queueMatches" :enable-assign="false" />
  <v-table>
    <!-- remaining by category + next round -->
  </v-table>
</div>
```
```typescript
const { categoryStageStatuses, queueMatches } = useCategoryStageStatus(categories, matches, getParticipantName);
```

**Rule:** Tournament dashboard views must expose live, upcoming (`ready`/`scheduled`), and remaining context with category and round details so organizers can operate without switching pages; stage derivation must live in a shared composable (`useCategoryStageStatus`) instead of per-view duplicated logic.

**Detection:**
```bash
rg -n "v-if=\\\"stats\\.inProgressMatches > 0\\\"" src/features/tournaments/views/TournamentDashboardView.vue
rg -n "ReadyQueue|Remaining Matches by Category|nextRound|Round" src/features/tournaments/views/TournamentDashboardView.vue
rg -n "useCategoryStageStatus" src/features/tournaments/views/TournamentDashboardView.vue src/features/tournaments/views/MatchControlView.vue
```

---

### CP-029: Initialize Level Bracket `match_scores` on Generation

| Field | Value |
|-------|-------|
| **Added** | 2026-02-19 |
| **Source Bug** | Level brackets were generated under `levels/{levelId}/match` but `levels/{levelId}/match_scores` stayed empty, causing missing operational context for level workflows |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
await bracketGen.generateLevelBracket(...);
// no match_scores initialization for generated level matches
```

**Correct Pattern (✅):**
```typescript
const result = await createStageWithStats(...);
await initializeLevelMatchScores(
  tournamentId,
  categoryId,
  levelId,
  storage,
  result.stageId,
  registrationIdByParticipantId
);
```

**Rule:** Whenever a level bracket is generated, initialize `tournaments/{t}/categories/{c}/levels/{levelId}/match_scores` for playable matches (`ready`/`in_progress`/`completed`) in the same flow, using bracket status and participant mapping.

**Detection:**
```bash
rg -n "generateLevelBracket|initializeLevelMatchScores|levels',\\s*levelId,\\s*'match_scores'" src/composables/useBracketGenerator.ts
```

---

### CP-030: Match Operations Must Resolve Category vs Level Scope Explicitly

| Field | Value |
|-------|-------|
| **Added** | 2026-02-19 |
| **Source Bug** | Match Control showed only completed category matches while level matches were ignored, and level actions wrote to category `match_scores` |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const matchScoresPath = `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;
await setDoc(doc(db, matchScoresPath, matchId), payload, { merge: true });
```

**Correct Pattern (✅):**
```typescript
function getMatchScoresPath(tournamentId: string, categoryId?: string, levelId?: string): string {
  if (categoryId && levelId) {
    return `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match_scores`;
  }
  if (categoryId) {
    return `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;
  }
  return `tournaments/${tournamentId}/match_scores`;
}

const path = getMatchScoresPath(tournamentId, categoryId, levelId);
await setDoc(doc(db, path, matchId), payload, { merge: true });
```

**Rule:** Any match operation (`start`, `ready`, `assign`, `score`, `complete`, `walkover`, `unschedule`, queue updates) must accept optional `levelId` and write/read from the resolved scope path. Categories without levels must pass `undefined` and continue using category paths unchanged.

**Detection:**
```bash
rg -n -F 'tournaments/${tournamentId}/categories/${categoryId}/match_scores' src/stores/matches.ts src/stores/tournaments.ts
rg -n "assignMatchToCourt\\(|startMatch\\(|submitManualScores\\(|recordWalkover\\(|unscheduleMatch\\(" src/features/tournaments/views/MatchControlView.vue src/features/tournaments/dialogs src/features/scoring/views src/features/public/views
```

---

### CP-031: Critical Action Visibility Must Use Explicit Prop Defaults

| Field | Value |
|-------|-------|
| **Added** | 2026-02-19 |
| **Source Bug** | Live View hid unschedule/release actions because Boolean prop default resolved falsy |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const props = defineProps<{
  matches: Match[];
  showActions?: boolean;
}>();

const shouldShowActions = computed(() => props.showActions !== false);
```

**Correct Pattern (✅):**
```typescript
const props = withDefaults(defineProps<{
  matches: Match[];
  showActions?: boolean;
}>(), {
  showActions: true,
});

const shouldShowActions = computed(() => props.showActions);
```

**Rule:** For controls that gate operational actions (`Release`, `Unschedule`, `Assign`, `Score`), optional Boolean props must declare explicit defaults via `withDefaults` so UI access is not accidentally hidden.

**Detection:**
```bash
rg -n "showActions\\?: boolean|enableAssign\\?: boolean|show.*Actions\\?: boolean" src/features --glob "*.vue"
rg -n "defineProps<\\{[\\s\\S]*showActions\\?: boolean[\\s\\S]*\\}\\>" src/features --glob "*.vue" | rg -v "withDefaults"
```

---

### CP-032: Leveled Categories Must Not Mix Base and Level Match Scopes

| Field | Value |
|-------|-------|
| **Added** | 2026-02-19 |
| **Source Bug** | Command Center showed a completed category as active with `vs TBD` from stale base bracket matches |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
targetScopes = categoryIds.flatMap((cid, index) => {
  const levelScopes = levelSnapshots[index].docs.map((levelDoc) => ({
    categoryId: cid,
    levelId: levelDoc.id,
  }));
  return [{ categoryId: cid }, ...levelScopes];
});
```

**Correct Pattern (✅):**
```typescript
targetScopes = categoryIds.flatMap((cid, index) => {
  const levelScopes = levelSnapshots[index].docs.map((levelDoc) => ({
    categoryId: cid,
    levelId: levelDoc.id,
  }));
  return levelScopes.length > 0 ? levelScopes : [{ categoryId: cid }];
});
```

**Rule:** If a category has level brackets, operational reads for match control/status must use only level scopes for that category. Base category scopes are fallback-only for categories without levels.

**Detection:**
```bash
rg -n "return \\[\\{ categoryId: cid \\}, \\.\\.\\.levelScopes\\]" src/stores/matches.ts
rg -n "targetScopes = \\[\\{ categoryId, levelId \\}\\];" src/stores/matches.ts
```

---

### CP-033: Live View Must Be Read-Only; Operations Belong in Command Center

| Field | Value |
|-------|-------|
| **Added** | 2026-02-19 |
| **Source Bug** | Live View exposed auto-schedule/assignment actions, causing accidental operational changes from a view-only screen |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<!-- Live View -->
<active-matches-section
  :matches="enrichedInProgressMatches"
  @complete-match="openCompleteMatchDialog"
  @enter-score="openScoreDialog"
  @unschedule="handleUnschedule"
/>

<match-queue-list
  :matches="enrichedPendingMatches"
  :auto-assign-enabled="autoAssignEnabled"
  :auto-start-enabled="autoStartEnabled"
  @manual-assign="handleManualAssign"
/>
```

**Correct Pattern (✅):**
```vue
<!-- Live View (read-only) -->
<active-matches-section
  :matches="enrichedInProgressMatches"
  :show-actions="false"
/>

<match-queue-list
  :matches="enrichedPendingMatches"
  :auto-assign-enabled="autoAssignEnabled"
  :auto-start-enabled="autoStartEnabled"
  :read-only="true"
/>

<!-- Command Center -->
<v-btn @click="openAutoScheduleDialog">Auto-Schedule</v-btn>
<v-switch :model-value="autoAssignEnabled" @update:model-value="toggleAutoAssign(!!$event)" />
<v-switch :model-value="autoStartEnabled" @update:model-value="toggleAutoStart(!!$event)" />
```

**Rule:** `viewMode === 'queue'` (Live View) must not expose operational controls (assign, release, complete, auto-schedule, auto-start toggles). Operational controls must live in `viewMode === 'command'` only.

**Detection:**
```bash
rg -n "viewMode === 'queue'|Live View|show-actions=\"false\"|read-only=\"true\"" src/features/tournaments/views/MatchControlView.vue
rg -n "@manual-assign|@toggle-auto-assign|@toggle-auto-start|@complete-match|@unschedule" src/features/tournaments/views/MatchControlView.vue
```

---

### CP-034: App Build Typecheck Must Scope to `src/` and Keep Shared Types in Sync

| Field | Value |
|-------|-------|
| **Added** | 2026-02-20 |
| **Source Bug** | Production build blocked by `vue-tsc -b` errors from stale test imports and shared model drift |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "tests/**/*.ts"]
}
```
```typescript
// Shared type missing properties used across multiple views
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}
```

**Correct Pattern (✅):**
```json
{
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"]
}
```
```typescript
// Shared type matches actual UI/store usage
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  isActive?: boolean;
  lastLoginAt?: Date;
}
```

**Rule:** `tsconfig.app.json` is for application build type-checking only; keep test-only files out of this include list and update central shared types in `src/types/index.ts` whenever new cross-feature fields are introduced.

**Detection:**
```bash
rg -n "\"tests/\\*\\*/\\*.ts\"" tsconfig.app.json
rg -n "isActive|lastLoginAt|autoAssignEnabled|calledAt|categoryName|courtName|MatchEvent" src/types/index.ts
```

---

## Adding New Patterns

Use `TEMPLATE.md` in this directory. Every pattern needs:
1. **ID** (CP-NNN, sequential)
2. **Category** (UI, Data Integrity, Code Quality, Firestore, Performance, Code Reuse)
3. **Source Bug** (what went wrong)
4. **Anti-Pattern** (bad code)
5. **Correct Pattern** (good code)
6. **Detection** (grep/script to find violations)
