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

### CP-014: Court Cards Must Show One Authoritative Status Chip

| Field | Value |
|-------|-------|
| **Added** | 2026-02-21 |
| **Source Bug** | Court cards showed both `READY` and `Ready` simultaneously |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<!-- Header chip (court-level state) -->
<v-chip>{{ statusLabel }}</v-chip>

<!-- Match-info chip (match-level state) -->
<v-chip>{{ getMatchStatusLabel(match!) }}</v-chip>
```

**Correct Pattern (✅):**
```vue
<!-- Keep one chip only: the court-level state in card header -->
<v-chip>{{ statusLabel }}</v-chip>

<!-- In match body, keep timing/context text only -->
<span v-if="match?.status === 'in_progress'">{{ formatMatchDuration(matchDuration) }}</span>
```

**Rule:** In `CourtCard`, use the header state chip (`LIVE`/`READY`/`FREE`/`BLOCKED`) as the single status indicator. Do not render a second status chip inside `.match-info`.

**Detection:**
```bash
# Violation if both header status and match status chip logic are present together
if rg -q "statusLabel" src/features/tournaments/components/CourtCard.vue && rg -q "getMatchStatusLabel\\(match!?\\)" src/features/tournaments/components/CourtCard.vue; then
  echo "Violation: dual status chips in CourtCard.vue"
fi
```

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

### CP-035: Categories Page Must Use Card-Only Category UI with Category-Level Format Mapping

| Field | Value |
|-------|-------|
| **Added** | 2026-02-22 |
| **Source Bug** | Categories screen duplicated category representation and showed misleading format labels/actions |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<!-- Duplicate category UIs on same screen -->
<category-management />
<v-list>
  <v-list-item v-for="category in categories" />
</v-list>

<!-- Separate card grid repeats the same categories -->
<category-registration-stats />
```
```typescript
// Display assumes one property and defaults silently
const formatLabel = FORMAT_LABELS[category.format] || 'Single Elimination';
```
```vue
<!-- Multiple cramped action buttons at card bottom -->
<v-card-actions>
  <v-btn>Manage</v-btn>
  <v-btn>Seeds</v-btn>
  <v-btn>Open Check-in</v-btn>
</v-card-actions>
```

**Correct Pattern (✅):**
```vue
<!-- Keep one category representation: cards only -->
<category-management /> <!-- header + dialogs only -->
<category-registration-stats /> <!-- single source of category cards -->
```
```typescript
// Resolve format/type from category-level fields before rendering chips
const resolvedFormat = resolveCategoryFormat(category);
const resolvedType = resolveCategoryType(category);
```
```vue
<!-- One visible primary CTA + top-right overflow menu for secondary actions -->
<v-card-title>
  <v-menu><v-list-item title="Manage" /></v-menu>
</v-card-title>
<v-card-actions>
  <v-btn block>{{ primaryActionLabel }}</v-btn>
</v-card-actions>
```

**Rule:** On Tournament Categories page, categories must appear only in card grid (no duplicate top list). Cards must render format/type from category-level data mapping, and expose secondary actions through a header menu while keeping one always-visible primary CTA.

**Detection:**
```bash
rg -n "Category List|v-list-item\\s+v-for=\\\"category in categories\\\"" src/features/tournaments/components/CategoryManagement.vue
rg -n "FORMAT_LABELS\\[stats\\.category\\.format\\]|FORMAT_LABELS\\[category\\.format\\]\\s*\\|\\|\\s*'Single Elimination'" src/features/tournaments/components/CategoryRegistrationStats.vue src/features/tournaments/components/CategoryManagement.vue
rg -n "<v-card-actions>[\\s\\S]*Manage[\\s\\S]*Seeds[\\s\\S]*Open Check-in" src/features/tournaments/components/CategoryRegistrationStats.vue
```

---

### CP-036: Pool Standings `W` Column Must Show Match Wins (Not Derived Composite Score)

| Field | Value |
|-------|-------|
| **Added** | 2026-02-22 |
| **Source Bug** | Pool schedule table displayed `W` values like `600/333/133` instead of win counts |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<!-- W column multiplies unrelated metrics -->
<td>{{ (participant.winRate * participant.matchPoints).toFixed(0) }}</td>
```

**Correct Pattern (✅):**
```typescript
// Carry explicit match wins from aggregate stats
participant.matchesWon = entry.matchesWon;
```
```vue
<!-- W column renders actual number of wins -->
<td>{{ participant.matchesWon }}</td>
```

**Rule:** In pool standings UI, `W` must be bound to explicit match wins (`matchesWon`). Do not compute `W` from `winRate`, `matchPoints`, or other composite values.

**Detection:**
```bash
rg -n "winRate\\s*\\*\\s*p\\.matchPoints|winRate\\s*\\*\\s*participant\\.matchPoints" src/features/tournaments/components/PoolSchedulePanel.vue
rg -n "matchesWon" src/composables/usePoolLeveling.ts
```

---

### CP-037: Category Lifecycle Must Derive `Schedule` Step From Match-Level Schedule Fields

| Field | Value |
|-------|-------|
| **Added** | 2026-02-22 |
| **Source Bug** | Categories cards could deadlock on `Schedule` when no matches existed yet, and public schedule leaked court-oriented assumptions |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const allPlanned = categoryMatches.length > 0 &&
  categoryMatches.every((match) => Boolean(match.plannedStartAt));
const scheduleDone = schedulePublished || allPlanned;

// With 0 matches, scheduleDone stays false forever (Generate Bracket stays blocked)
```
```vue
<!-- Public schedule shows court metadata -->
<td>{{ match.courtName || '—' }}</td>
```

**Correct Pattern (✅):**
```typescript
const categoryMatches = matches.filter((match) => match.categoryId === category.id);
const schedulePublished = categoryMatches.some(
  (match) => match.scheduleStatus === 'published' || Boolean(match.publishedAt)
);
const allPlanned = categoryMatches.every((match) => Boolean(match.plannedStartAt));
const scheduleDone = schedulePublished || allPlanned;

if (!scheduleDone && categoryMatches.length > 0) return 'schedule';
```
```vue
<!-- Public participant schedule: time/category/opponent only -->
<v-list-item-title>{{ matchup }}</v-list-item-title>
<v-list-item-subtitle>{{ roundLabel }}</v-list-item-subtitle>
```

**Rule:** The Categories lifecycle must include `Schedule` between Setup and Check-in, and compute completion from category match schedule fields (`scheduleStatus`/`publishedAt` preferred, `plannedStartAt` fallback). `allPlanned` must use `every()` without a `length > 0` guard so empty match lists are vacuously complete and bracket generation is not blocked. Public schedule views must not render courts/court IDs.

**Detection:**
```bash
if ! rg -q "type PhaseKey = 'setup' \\| 'schedule' \\| 'checkin'" src/features/tournaments/components/CategoryRegistrationStats.vue; then
  echo "Violation: Schedule phase missing from category lifecycle"
fi
rg -n "categoryMatches\\.length > 0 && categoryMatches\\.every\\(\\(match\\) => Boolean\\(match\\.plannedStartAt\\)\\)" src/features/tournaments/components/CategoryRegistrationStats.vue
rg -n "scheduleStatus === 'published'|plannedStartAt|scheduleDone" src/features/tournaments/components/CategoryRegistrationStats.vue
if rg -n "courtId|courtName|\\bCourt\\b" src/features/public/views/PublicScheduleView.vue; then
  echo "Violation: Public schedule leaks court fields"
fi
```

---

### CP-038: Match Control Schedule Table Must Use Public-State Quick Filters, Time-First Sort, and One Primary Row Action

| Field | Value |
|-------|-------|
| **Added** | 2026-02-22 |
| **Source Bug** | All Matches view buried public visibility state, defaulted to non-time sorting, and showed cramped dual action buttons |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const scheduleFilters = ref({
  status: 'all',
  sortBy: 'round',
  sortDesc: false,
});
```
```vue
<!-- Both primary actions can appear in a single row -->
<v-btn v-if="item.status === 'ready' || item.status === 'in_progress'">Score</v-btn>
<v-btn v-if="!item.courtId && (item.status === 'scheduled' || item.status === 'ready')">Assign</v-btn>
```
```vue
<!-- Public state is low-emphasis and easy to miss -->
<v-chip variant="tonal" color="grey">Not Scheduled</v-chip>
```

**Correct Pattern (✅):**
```typescript
const scheduleFilters = ref({
  status: 'all',
  publicState: 'all',
  sortBy: 'time',
  sortDesc: false,
});
```
```typescript
function getPrimaryRowAction(match: Match): 'score' | 'assign' | null {
  if (!match.courtId && (match.status === 'scheduled' || match.status === 'ready')) return 'assign';
  if (match.status === 'ready' || match.status === 'in_progress') return 'score';
  return null;
}
```
```vue
<!-- High-contrast public chip + quick filter toggle -->
<v-btn-toggle v-model="scheduleFilters.publicState" mandatory />
<v-chip variant="flat" :color="getMatchScheduleStateColor(item)" :prepend-icon="getMatchScheduleStateIcon(item)">
  {{ getMatchScheduleStateLabel(item) }}
</v-chip>
```

**Rule:** In Match Control → All Matches, default sorting must be planned time ascending (`plannedStartAt` fallback), public state must be filterable with quick toggles (`All/Published/Draft/Not Scheduled`), and each row must expose only one visible primary CTA (`Score` or `Assign`) with secondary actions in the overflow menu.

**Detection:**
```bash
rg -n "sortBy:\\s*'round'" src/features/tournaments/views/MatchControlView.vue
rg -n "v-if=\"item\\.status === 'ready' \\|\\| item\\.status === 'in_progress'\"|v-if=\"!item\\.courtId && \\(item\\.status === 'scheduled' \\|\\| item\\.status === 'ready'\\)\"" src/features/tournaments/views/MatchControlView.vue
rg -n "scheduleFilters\\.publicState|getPrimaryRowAction|getMatchScheduleStateIcon" src/features/tournaments/views/MatchControlView.vue
```

---

### CP-039: Court Assignment Must Enforce `Scheduled + Published + Checked-In` Gate (With Admin-Only Check-In Override)

| Field | Value |
|-------|-------|
| **Added** | 2026-02-22 |
| **Source Bug** | Match Control allowed assignment for draft/not-published matches, breaking organizer lifecycle expectations |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
function canAssign(match: Match): boolean {
  return !match.courtId && (match.status === 'scheduled' || match.status === 'ready');
}
```
```typescript
// Assignment mutates planning time fields
await setDoc(matchRef, {
  courtId,
  scheduledTime: Timestamp.fromDate(new Date()),
});
```

**Correct Pattern (✅):**
```typescript
const blockers = await getAssignmentBlockers(tournamentId, matchId, categoryId, levelId, options);
if (blockers.length > 0) throw new Error(blockers.join(' | '));
```
```typescript
// Assign = operational only; planned time remains source-of-truth schedule
await setDoc(matchRef, {
  courtId,
  status: 'ready',
  assignedAt: serverTimestamp(),
}, { merge: true });
```
```typescript
// Admin override only bypasses check-in gate
if (options.ignoreCheckInGate && authStore.currentUser?.role !== 'admin') {
  throw new Error('Blocked: Only admins can assign anyway when players are not checked-in');
}
```
```typescript
const blocked = stats.value.pending - assignablePendingMatches.value.length;
if (tournamentHealth.value.label === 'Backlog' && blocked > 0 && assignablePendingMatches.value.length === 0) {
  return `${stats.value.pending} matches waiting - all blocked (players not checked in). Go to Check-in to mark players as present, or use "Assign Anyway (Admin)" from a match row's dropdown.`;
}
```

**Rule:** Both manual and auto-assignment must require three gates: match is scheduled (`plannedStartAt`/fallback), schedule is published, and both participants are checked in. Admin override may bypass only the check-in gate. Assignment must not rewrite planned schedule timestamps. The Match Control health chip must explain when backlog is blocked by check-in so operators know to use Check-in or admin override.

**Detection:**
```bash
rg -n "Blocked: Not scheduled|Blocked: Not published|Blocked: Players not checked-in|ignoreCheckInGate" src/stores/matches.ts src/features/tournaments/views/MatchControlView.vue
rg -n "assignMatchToCourt|assignedAt|plannedStartAt|scheduledTime" src/stores/matches.ts
rg -n "healthTooltip|players not checked in|Assign Anyway \\(Admin\\)" src/features/tournaments/views/MatchControlView.vue
```

---

### CP-040: Use One Scheduling Entry Point in UI (`useMatchScheduler.scheduleMatches`)

| Field | Value |
|-------|-------|
| **Added** | 2026-02-22 |
| **Source Bug** | Categories and Command Center used different scheduling wrappers, causing workflow drift and confusion |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// Categories view directly uses time scheduler wrapper
await timeScheduler.scheduleCategory(tournamentId, categoryId, matches, config, levelId);
```
```typescript
// Command Center uses a different wrapper
await scheduler.scheduleMatches(tournamentId, { categoryId, startTime, concurrency });
```

**Correct Pattern (✅):**
```typescript
// Both Categories and Command Center call the same orchestration function
await scheduler.scheduleMatches(tournamentId, {
  categoryId,
  levelId,
  startTime,
  matchDurationMinutes,
  bufferMinutes,
  concurrency,
  respectDependencies: false,
});
```

**Rule:** UI scheduling actions (category card schedule, command center re-schedule, dashboard generate schedule) must go through `useMatchScheduler.scheduleMatches`. `useTimeScheduler` remains the engine utility layer and publish/unpublish helper, not a separate UI entrypoint. In multi-category mode:
`sequential` = categories run one after another with shared pool;
`parallel_partitioned` = categories run in same time window with explicit per-category court budgets.

**Detection:**
```bash
rg -n "scheduleCategory\\(" src/features/tournaments/views/CategoriesView.vue src/features/tournaments/dialogs/AutoScheduleDialog.vue src/features/tournaments/views/TournamentDashboardView.vue
rg -n "scheduleMatches\\(" src/features/tournaments/views/CategoriesView.vue src/features/tournaments/dialogs/AutoScheduleDialog.vue src/features/tournaments/views/TournamentDashboardView.vue
rg -n "parallel_partitioned|setCategoryBudget|Court Partition" src/features/tournaments/dialogs/AutoScheduleDialog.vue
```

---

### CP-041: Never Query Tournament Root `/match_scores`; Always Use Category/Level Scope

| Field | Value |
|-------|-------|
| **Added** | 2026-02-23 |
| **Source Bug** | Legacy root `/tournaments/{id}/match_scores` queries drifted from category-scoped data model and bypassed scheduling gates |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const queueQuery = query(
  collection(db, `tournaments/${tournamentId}/match_scores`),
  where('status', '==', 'scheduled')
);
```

**Correct Pattern (✅):**
```typescript
const queueQuery = query(
  collection(db, `tournaments/${tournamentId}/categories/${categoryId}/match_scores`),
  where('status', '==', 'scheduled')
);
```
```typescript
const levelQuery = query(
  collection(db, `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match_scores`),
  where('status', '==', 'scheduled')
);
```

**Rule:** Operational match data must be read/written via category/level scoped paths. Root tournament `/match_scores` paths are deprecated and must not be used for queueing, auto-assignment, or consistency checks.

**Detection:**
```bash
rg -n "tournaments/\\$\\{tournamentId\\}/match_scores" src/composables src/stores src/features --glob "*.ts" --glob "*.vue"
```

---

### CP-042: Do Not Hide Schedule Actions Based Only on `matchesCount`

| Field | Value |
|-------|-------|
| **Added** | 2026-02-23 |
| **Source Bug** | Category menu/CTA lost `Schedule` action even after setup because match cache count was 0 |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
function isScheduleAvailable(stats: CategoryStats): boolean {
  return stats.matchesCount > 0;
}
```

**Correct Pattern (✅):**
```typescript
function isScheduleAvailable(stats: CategoryStats): boolean {
  if (stats.category.status === 'completed') return false;
  return stats.matchesCount > 0 || stats.ready >= 2 || stats.checkInStarted || hasBracket(stats);
}
```

**Rule:** Schedule entry points (menu + primary CTA) must stay available once a category is operationally ready (setup/check-in/bracket context), even if in-memory match cache is temporarily empty.

**Detection:**
```bash
rg -n "function isScheduleAvailable\\(stats: CategoryStats\\).*matchesCount > 0" src/features/tournaments/components/CategoryRegistrationStats.vue
```

---

### CP-043: Court Assignment Must Move Matches to `in_progress`, and Release Must Prompt Keep vs Clear Scores

| Field | Value |
|-------|-------|
| **Added** | 2026-02-23 |
| **Source Bug** | Public Schedule "Now Playing" stayed empty while matches were already on courts because assignment left status at `ready`; release always cleared in-progress scores without operator choice |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// Assignment leaves match in queue-like status
batch.set(doc(db, matchScoresPath, matchId), {
  courtId,
  status: 'ready',
}, { merge: true });
```
```typescript
// Release path always clears in-progress state
await matchStore.unscheduleMatch(tournamentId, matchId, categoryId, courtId, levelId, {
  clearInProgressState: match.status === 'in_progress',
});
```

**Correct Pattern (✅):**
```typescript
// Assignment means match is on court/live
batch.set(doc(db, matchScoresPath, matchId), {
  courtId,
  status: 'in_progress',
  startedAt: serverTimestamp(),
}, { merge: true });
```
```typescript
// Release asks operator to keep or clear scores, then returns to ready queue
const shouldClearInProgressState = match.status === 'in_progress' && releaseScoreHandling.value === 'clear';
await matchStore.unscheduleMatch(tournamentId, matchId, categoryId, courtId, levelId, {
  clearInProgressState: shouldClearInProgressState,
  returnStatus: 'ready',
});
```

**Rule:** In operational views, "on court" must map to `in_progress` so public live panels and court state remain consistent. Releasing an in-progress match must explicitly ask whether scores are preserved or cleared before returning to `ready`.

**Detection:**
```bash
rg -n "assignMatchToCourt|status: 'in_progress'|startedAt: serverTimestamp\\(\\)" src/stores/matches.ts src/stores/tournaments.ts
rg -n "releaseScoreHandling|clearInProgressState: shouldClearInProgressState|returnStatus: 'ready'" src/features/tournaments/views/MatchControlView.vue
```

---

### CP-044: Pool Scheduling Must Block Missing Pool Brackets Before Running Scheduler

| Field | Value |
|-------|-------|
| **Added** | 2026-02-23 |
| **Source Bug** | Pool-to-elimination categories showed contradictory scheduling feedback (`0 scheduled` success + warning) and still exposed `Schedule Times` in overflow before bracket generation |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const result = await runSequentialSchedule(start);
lastResult.value = { totalScheduled: result.stats.scheduledCount, ... };

if (result.stats.scheduledCount === 0) {
  const poolCategoriesWithNoStage = selectedCategories.value.filter(
    (category) => category.format === 'pool_to_elimination' && category.poolStageId == null
  );
  if (poolCategoriesWithNoStage.length > 0) {
    notificationStore.showToast('warning', 'Pool brackets not generated ...');
  }
}
```
```vue
<v-list-item
  v-if="isScheduleAvailable(stats)"
  title="Schedule Times"
/>
```

**Correct Pattern (✅):**
```typescript
const poolCategoriesWithNoStage = selectedCategories.value.filter(
  (category) => category.format === 'pool_to_elimination' && category.poolStageId == null
);
if (poolCategoriesWithNoStage.length > 0) {
  notificationStore.showToast('warning', 'Pool brackets not generated ...');
  return;
}

loading.value = true;
const result = await runSequentialSchedule(start);
```
```vue
<v-list-item
  v-if="isScheduleAvailable(stats) && !(stats.resolvedFormat === 'pool_to_elimination' && stats.category.poolStageId == null)"
  title="Schedule Times"
/>
```

**Rule:** For `pool_to_elimination`, scheduling entry points must be blocked until `poolStageId` exists. The scheduler dialog must preflight this before executing scheduling logic so users see one clear warning and no contradictory `0 scheduled` draft/success state.

**Detection:**
```bash
if rg -n -U "if \\(result\\.stats\\.scheduledCount === 0\\)[\\s\\S]*pool_to_elimination" src/features/tournaments/dialogs/AutoScheduleDialog.vue; then
  echo "Violation: pool bracket guard runs after scheduler result"
fi
if rg -n "v-if=\"isScheduleAvailable\\(stats\\)\"$" src/features/tournaments/components/CategoryRegistrationStats.vue; then
  echo "Violation: Schedule Times menu not gated by poolStageId"
fi
rg -n "const poolCategoriesWithNoStage = selectedCategories\\.value\\.filter" src/features/tournaments/dialogs/AutoScheduleDialog.vue
rg -n "pool_to_elimination' && stats\\.category\\.poolStageId == null" src/features/tournaments/components/CategoryRegistrationStats.vue
```

---

### CP-045: Category Phase Detection Must Be Match-Scope Aware (Pool/Level/Elim)

| Field | Value |
|-------|-------|
| **Added** | 2026-02-25 |
| **Source Bug** | Category cards got stuck in wrong lifecycle step because one global `scheduleDone` flag and one generic bracket check were reused across pool, level, and elimination phases |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const scheduleDone = schedulePublished || allPlannedTimes;
if (scheduleDone) return 'elimination';

function hasBracketForCategory(category: Category): boolean {
  return category.poolStageId != null || category.stageId != null || category.eliminationStageId != null;
}
```

**Correct Pattern (✅):**
```typescript
const poolMatches = categoryMatches.filter((m) => Boolean(m.groupId) && !m.levelId);
const levelMatches = categoryMatches.filter((m) => Boolean(m.levelId));
const elimMatches = categoryMatches.filter((m) => !m.groupId && !m.levelId);

const poolMatchesScheduled = poolMatches.length > 0 && poolMatches.every((m) => Boolean(m.plannedStartAt));
const levelMatchesScheduled = levelMatches.length > 0 && levelMatches.every((m) => Boolean(m.plannedStartAt));
const elimMatchesScheduled = elimMatches.length > 0 && elimMatches.every((m) => Boolean(m.plannedStartAt));

const poolSchedulePublished = poolMatches.some((m) => Boolean(m.publishedAt) || m.scheduleStatus === 'published');
const levelSchedulePublished = levelMatches.some((m) => Boolean(m.publishedAt) || m.scheduleStatus === 'published');
const elimSchedulePublished = elimMatches.some((m) => Boolean(m.publishedAt) || m.scheduleStatus === 'published');

function hasPoolStage(category: Category): boolean {
  return category.poolStageId != null;
}

function hasEliminationBracket(category: Category): boolean {
  return category.eliminationStageId != null || category.stageId != null;
}
```

**Rule:** Category lifecycle phase logic must derive schedule/publish/complete state per match scope (`pool`, `level`, `elim`) and must not treat `poolStageId` as proof that elimination bracket exists.

**Detection:**
```bash
rg -n "scheduleDone|hasPlannedTimes|allPlannedTimes|schedulePublished|hasBracketForCategory" src/features/tournaments/components/CategoryRegistrationStats.vue
rg -n "poolMatchesScheduled|levelMatchesScheduled|elimMatchesScheduled|poolSchedulePublished|levelSchedulePublished|elimSchedulePublished" src/features/tournaments/components/CategoryRegistrationStats.vue
rg -n "poolCompletedAt: null|levelingStatus: null|levelCount: null|levelsVersion: null|poolPhase: 'pool'|eliminationStageId: null" src/stores/tournaments.ts
```

---

### CP-046: Front Desk Rapid Check-In Must Resolve Typed Participant Names and Bulk Rows Must Visually Mark Checked-In State

| Field | Value |
|-------|-------|
| **Added** | 2026-02-26 |
| **Source Bug** | Front desk operators could not check in by typing participant name, and bulk list rows did not clearly show which participants were already checked in |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
if (parsed.kind === 'registration') {
  const registration = eligibleRegistrations.value.find((item) => item.id === parsed.value);
  if (!registration) throw new Error('No matching participant for scanned code');
  return registration;
}
```
```vue
<v-list-item
  v-for="row in rows"
  :key="row.id"
  :title="row.name"
/>
```

**Correct Pattern (✅):**
```typescript
const typedMatch = findRegistrationByTypedQuery(
  parsed.value,
  eligibleRegistrations.value,
  options.getParticipantName
);
if (typedMatch.type === 'match') return matchedRegistration;
if (typedMatch.type === 'ambiguous') {
  throw new Error('Multiple participants match this name. Type more of the name or use bib number.');
}
```
```vue
<v-list-item
  :class="[
    'bulk-checkin-panel__row',
    `bulk-checkin-panel__row--${row.status ?? 'unknown'}`
  ]"
>
  <v-chip :color="getStatusColor(row.status)" variant="tonal">
    {{ getStatusLabel(row.status) }}
  </v-chip>
</v-list-item>
```
```vue
<v-list v-if="searchSuggestions.length > 0" data-testid="rapid-search-results">
  <v-list-item
    v-for="row in searchSuggestions"
    :key="row.id"
    :title="row.name"
  >
    <template #append>
      <v-btn
        data-testid="search-suggestion-checkin-btn"
        :disabled="row.status !== 'approved'"
      >
        Check In
      </v-btn>
    </template>
  </v-list-item>
</v-list>
```

**Rule:** Rapid check-in input must support typed participant-name resolution (with explicit ambiguity handling) in addition to scanned bib/ID values, and rapid mode should surface live typed-name suggestions so operators can select a participant directly. Bulk mode must make checked-in state obvious via both status chip and row styling.

**Detection:**
```bash
if ! rg -n "findRegistrationByTypedQuery\\(" src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts; then
  echo "Violation: rapid check-in missing typed-name fallback"
fi
if ! rg -n "rapid-search-results|search-suggestion-checkin-btn|searchSuggestions" src/features/checkin/components/RapidCheckInPanel.vue; then
  echo "Violation: rapid check-in missing live typed-name suggestion list"
fi
if ! rg -n "bulk-checkin-panel__row--checked_in|getStatusColor\\(row.status\\)|getStatusLabel\\(row.status\\)" src/features/checkin/components/BulkCheckInPanel.vue; then
  echo "Violation: bulk checked-in rows are not visually differentiated"
fi
```

---

### CP-047: Shallow-Mounted Vuetify Error-State Tests Must Assert Reactive State (Not Nested Stub Text)

| Field | Value |
|-------|-------|
| **Added** | 2026-02-27 |
| **Source Bug** | Public view tests failed even though not-found logic worked, because `wrapper.text()` did not include text rendered inside shallow-stubbed Vuetify components |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const wrapper = shallowMount(PublicScheduleView, {
  global: { stubs: ['v-alert'] },
});
await flushPromises();
expect(wrapper.text()).toContain('Tournament not found');
```

**Correct Pattern (✅):**
```typescript
const wrapper = shallowMount(PublicScheduleView, { global: { stubs } });
await flushPromises();

const vm = wrapper.vm as unknown as { notFound: boolean | { value: boolean } };
expect(readBoolean(vm.notFound)).toBe(true);
expect(mockDeps.subscribeTournament).not.toHaveBeenCalled();
```

**Rule:** When testing error/not-found branches in `shallowMount` tests with Vuetify stubs, assert reactive state and side effects (`notFound`, skipped subscriptions) instead of expecting nested UI text in `wrapper.text()`.

**Detection:**
```bash
rg -n "wrapper\\.text\\(\\)\\.toContain\\('Tournament not found'\\)" tests/unit tests/integration --glob "*.test.ts"
```

---

### CP-048: Scripts Moved Under `scripts/` Must Resolve and Use Repo Root for Root-Level Commands

| Field | Value |
|-------|-------|
| **Added** | 2026-02-27 |
| **Source Bug** | `start-dev-terminal.sh` failed after moving to `scripts/` because it ran root-level paths (`functions/`, `node_modules/.bin`) from `scripts/` |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

cd functions && npm run build
./node_modules/.bin/firebase emulators:start
```

**Correct Pattern (✅):**
```bash
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

cd "$PROJECT_ROOT/functions" && npm run build
cd "$PROJECT_ROOT"
./node_modules/.bin/firebase emulators:start
```

**Rule:** Any script located in `scripts/` that invokes root-level folders (`functions/`, `node_modules/`, root `npm run`) must resolve `PROJECT_ROOT` from `SCRIPT_DIR/..` and execute those commands from repo root (or absolute root paths).

**Detection:**
```bash
if rg -n 'cd "\\$SCRIPT_DIR"' scripts/start-dev-terminal.sh >/dev/null && rg -n '^cd functions|do script "cd '\\''\\$SCRIPT_DIR'\\''' scripts/start-dev-terminal.sh >/dev/null; then
  echo "Violation: start-dev-terminal.sh still assumes it runs from repo root"
fi
rg -n 'PROJECT_ROOT=|cd "\\$PROJECT_ROOT/functions"|do script "cd '\\''\\$PROJECT_ROOT'\\''' scripts/start-dev-terminal.sh
```

---

### CP-049: Dialog Open Watchers Must Handle `modelValue=true` on Initial Mount

| Field | Value |
|-------|-------|
| **Added** | 2026-02-27 |
| **Source Bug** | Create Levels dialog opened with empty data until level count changed because preview load watcher did not run when mounted already open |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (!isOpen) return;
    await reloadPreview();
  }
);
// If component mounts with modelValue=true, callback never runs.
```

**Correct Pattern (✅):**
```typescript
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (!isOpen) return;
    await reloadPreview();
  },
  { immediate: true }
);
```

**Rule:** Any dialog/component that loads data when opened via `watch(() => props.modelValue, ...)` must support initial mount in already-open state (`modelValue=true`) by using `immediate: true` (or equivalent `onMounted` open-state check).

**Detection:**
```bash
for f in $(rg -l "watch\\(\\s*\\(\\) => props\\.modelValue" src/features --glob "*.vue"); do
  if ! rg -n -U "watch\\(\\s*\\(\\) => props\\.modelValue[\\s\\S]{0,260}immediate:\\s*true" "$f" >/dev/null; then
    echo "Violation: modelValue watcher may miss initial open load => $f"
  fi
done
```

---

### CP-050: Categories Must Expose Draft Schedule Via Match Control Deep Link

| Field | Value |
|-------|-------|
| **Added** | 2026-02-27 |
| **Source Bug** | Category had draft scheduled matches but operators could only see "View Public Schedule" (published-only), so draft schedule was not visible |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<!-- Only published schedule entry is available -->
<v-list-item
  title="View Public Schedule"
  :disabled="!hasPublishedSchedule(stats)"
  @click="emit('view-public-schedule', stats.category)"
/>
```
```typescript
// No draft route handler
// CategoriesView lacks @view-draft-schedule binding and match-control draft query routing.
```

**Correct Pattern (✅):**
```vue
<v-list-item
  v-if="hasDraftSchedule(stats)"
  title="View Draft Schedule"
  @click="emit('view-draft-schedule', stats.category)"
/>
```
```typescript
function viewDraftSchedule(category: Category): void {
  router.push({
    path: `/tournaments/${tournamentId.value}/match-control`,
    query: {
      view: 'schedule',
      category: category.id,
      publicState: 'draft',
      scheduleLayout: 'full',
    },
  });
}
```

**Rule:** If a category has planned schedule entries that are not published, Categories UI must provide a "View Draft Schedule" action and deep-link into Match Control schedule view with `publicState=draft` scoped to the category.

**Detection:**
```bash
if ! rg -n "view-draft-schedule" src/features/tournaments/components/CategoryRegistrationStats.vue >/dev/null; then
  echo "Violation: missing draft schedule menu action in CategoryRegistrationStats"
fi
if ! rg -n "@view-draft-schedule=\"viewDraftSchedule\"|publicState:\\s*'draft'|scheduleLayout:\\s*'full'|view:\\s*'schedule'" src/features/tournaments/views/CategoriesView.vue >/dev/null; then
  echo "Violation: missing draft schedule routing from CategoriesView"
fi
```

---

### CP-051: Scheduling Must Preflight Court Capacity Against Existing Draft/Published Windows

| Field | Value |
|-------|-------|
| **Added** | 2026-02-27 |
| **Source Bug** | Re-running schedule could place a category into already occupied time windows from other categories, producing `0 matches scheduled` or overlapping drafts instead of shifting to next available time |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// Directly commits new schedule from requested start.
const result = await scheduler.scheduleMatches(tournamentId, {
  categoryId,
  startTime,
  concurrency,
});
```

**Correct Pattern (✅):**
```typescript
const occupied = buildOccupiedWindows(matchStore.matches, {
  fallbackDurationMinutes: matchDuration.value,
  excludeScopes: scheduleTargets.value, // same scope can be replaced
});

const preview = await scheduler.scheduleMatches(tournamentId, {
  categoryId,
  levelId,
  startTime: requestedStart,
  concurrency,
  dryRun: true,
});

const candidate = extractScheduledWindows(preview.scheduled);
const conflict = findCapacityConflict(occupied, candidate, availableCapacity);
if (conflict) {
  requestedStart = new Date(conflict.nextBoundaryMs);
}

// Commit only after conflict-free preflight
await scheduler.scheduleMatches(tournamentId, {
  categoryId,
  levelId,
  startTime: requestedStart,
  concurrency,
});
```

**Rule:** Category scheduling flows must run a dry-run preflight and resolve start-time conflicts against existing draft/published windows before committing schedule changes. Same target scope may be excluded during reschedule.

**Detection:**
```bash
if ! rg -n "buildOccupiedWindows\\(|extractScheduledWindows\\(|findCapacityConflict\\(" src/features/tournaments/dialogs/AutoScheduleDialog.vue >/dev/null; then
  echo "Violation: AutoScheduleDialog missing capacity preflight guard"
fi
if ! rg -n "dryRun\\?: boolean|options\\.dryRun === true" src/composables/useMatchScheduler.ts >/dev/null; then
  echo "Violation: useMatchScheduler missing dryRun support for capacity preflight"
fi
```

---

### CP-052: BYE/TBD Semantics Must Be Centralized, and Scheduler Must Exclude BYE

| Field | Value |
|-------|-------|
| **Added** | 2026-02-27 |
| **Source Bug** | Bracket views labeled BYE correctly but Match Control/Scheduler used separate logic, causing inconsistent TBD/BYE display and accidental BYE scheduling candidates |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// BracketView.vue / DoubleEliminationBracket.vue
function isBye(match: Match, participantId: string | undefined): boolean {
  const otherParticipant = participantId === match.participant1Id
    ? match.participant2Id
    : match.participant1Id;
  return !!(otherParticipant && (match.status === 'completed' || match.winnerId));
}

function getParticipantName(registrationId: string | undefined, match?: Match): string {
  if (!registrationId) return isBye(match!, registrationId) ? 'BYE' : 'TBD';
  return resolveParticipantName(registrationId);
}
```
```typescript
// useMatchScheduler.ts
matches = adaptedMatches.filter((m) => {
  if (m.status === 'completed' || m.status === 'walkover' || m.status === 'cancelled') return false;
  return true; // BYE match can still slip through here
});
```

**Correct Pattern (✅):**
```typescript
import { useMatchSlotState } from '@/composables/useMatchSlotState';

const { getSlotState, getSlotLabel, isSchedulableMatch } = useMatchSlotState();

// UI display
const label = getSlotLabel(match, 'participant2', getParticipantName); // BYE/TBD/resolved
const isBye = getSlotState(match, 'participant2') === 'bye';

// Scheduler gate
matches = adaptedMatches.filter((m) => {
  if (!isSchedulableMatch(m)) return false; // excludes BYE + terminal statuses
  return true; // TBD remains schedulable
});
```

**Rule:** All BYE/TBD slot classification must come from `useMatchSlotState`; components must not implement local BYE/TBD inference. Auto-scheduling must call `isSchedulableMatch` so BYE matches are never scheduled while TBD placeholders remain eligible.

**Detection:**
```bash
rg -n "function isBye\\(|return 'BYE'|return 'TBD'" src/features/brackets/components/BracketView.vue src/features/brackets/components/DoubleEliminationBracket.vue

if rg -n "includeTBD: true" src/composables/useMatchScheduler.ts >/dev/null && ! rg -n "isSchedulableMatch\\(m\\)" src/composables/useMatchScheduler.ts >/dev/null; then
  echo "Violation: scheduler includes TBD placeholders but lacks centralized BYE exclusion gate"
fi
```

---

### CP-053: Category Alias Parsing Must Use Word-Boundary Gender Tokens

| Field | Value |
|-------|-------|
| **Added** | 2026-02-27 |
| **Source Bug** | Display-code generator mapped `"Women's Singles"` to `MS` because `"women's"` contains `"men"` as a substring |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const normalized = categoryName.toLowerCase();
const isMen = normalized.includes('men');
const isWomen = normalized.includes('women');
```

**Correct Pattern (✅):**
```typescript
const normalized = categoryName.toLowerCase();
const isWomen = /\bwomen(?:'s)?\b/i.test(normalized);
const isMen = /\bmen(?:'s)?\b/i.test(normalized);
```

**Rule:** Any alias/token parser that distinguishes `men` vs `women` must use word-level matching (regex boundaries or tokenization), never raw substring checks.

**Detection:**
```bash
rg -n "includes\\(['\"]men['\"]\\)|includes\\(['\"]women['\"]\\)" src/features src/composables src/stores --glob "*.ts" --glob "*.vue"
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
