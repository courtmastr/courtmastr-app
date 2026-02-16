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

## Category: Scoring / Data Integrity

### CP-014: Resolve Scoring Rules from Tournament/Category, Never Hardcode Runtime Scoring

| Field | Value |
|-------|-------|
| **Added** | 2026-02-16 |
| **Source Bug** | TOURNEY-103 — scoring UI/store stayed fixed at 21x3 despite configurable presets |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// ❌ Hardcoded runtime logic
const gamesNeeded = Math.ceil(BADMINTON_CONFIG.gamesPerMatch / 2);
const isComplete = (score1 >= 21 || score2 >= 21) &&
  (Math.abs(score1 - score2) >= 2 || score1 === 30 || score2 === 30);
```

**Correct Pattern (✅):**
```typescript
// ✅ Resolve effective config first, then validate with shared engine
const scoringConfig = resolveScoringConfig(tournament, category);
const validation = validateCompletedGameScore(score1, score2, scoringConfig);
const gamesNeeded = getGamesNeeded(scoringConfig);
```

**Rule:** Any score entry, winner calculation, manual correction, or walkover logic must use resolved scoring config (category override if enabled, else tournament settings), not hardcoded `21/30/best-of-3`.

**Detection:**
```bash
rg -n ">= 21|=== 30|BADMINTON_CONFIG\\.gamesPerMatch|Math\\.ceil\\(BADMINTON_CONFIG\\.gamesPerMatch / 2\\)" src/features/scoring src/features/tournaments/views/MatchControlView.vue src/stores/matches.ts
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
