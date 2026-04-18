# Coding Pattern Guide — CourtMastr v2

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

### CP-074: Fire-and-Forget Router Helpers Must Return `void`, Not `Promise<void>`

| Field | Value |
|-------|-------|
| **Added** | 2026-04-02 |
| **Source Bug** | Player merge UI wiring broke app build because `router.push()` was narrowed to `Promise<void>` |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const openMerge = (playerId: string): Promise<void> =>
  router.push({ name: 'player-merge', params: { playerId } });
```

**Correct Pattern (✅):**
```typescript
const openMerge = (playerId: string): void => {
  void router.push({ name: 'player-merge', params: { playerId } });
};
```

**Rule:** If a helper is only used from a click handler and does not need the navigation result, make it `void` and explicitly discard `router.push()` with `void`. Only expose/annotate the navigation promise when the caller actually awaits or inspects navigation failures.

**Detection:**
```bash
rg -n "Promise<void>\\s*=>\\s*router\\.push|Promise<void>\\s*=\\s*\\([^)]*\\)\\s*=>\\s*router\\.push" src --glob "*.vue" --glob "*.ts"
```

### CP-071: Queue, Alerts, and Auto-Assign Must Share the Same Assignment Gate

| Field | Value |
|-------|-------|
| **Added** | 2026-03-19 |
| **Source Bug** | Match Control showed draft level matches as ready/assignable while auto-assign correctly refused to place them |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<ready-queue
  :matches="pendingMatches"
  :enable-assign="true"
/>
```
```ts
const autoAssignableDueMatches = computed(() =>
  pendingMatches.value.filter((match) => canAssignCourtToMatch(match))
);
```

**Correct Pattern (✅):**
```ts
const pendingMatchAssignmentStates = computed(() =>
  pendingMatches.value.map((match) => ({
    match,
    blockers: getMatchAssignBlockers(match),
    isAssignable: getMatchAssignBlockers(match).length === 0,
  }))
);

const assignablePendingMatches = computed(() =>
  pendingMatchAssignmentStates.value
    .filter((state) => state.isAssignable)
    .map((state) => state.match)
);
```
```vue
<ready-queue
  :matches="pendingMatches"
  :can-assign-match="canAssignCourtToMatch"
  :get-assign-blocked-reason="getQueueBlockedReason"
/>
<alerts-panel
  :assignment-gate-summary="assignmentGateSummary"
  :recent-auto-assign-decision="recentAutoAssignDecision"
/>
```

**Rule:** Any queue affordance, blocker alert, manual assign button, and auto-assign watcher must derive from the same match-level gate (`planned time`, `published`, `checked-in`). Never show a green assign action for rows that `canAssignCourtToMatch()` would reject. If a row has multiple blockers, organizer-facing UI must surface all of them instead of hiding check-in behind publish state. If auto-assign skips a blocked due match, preserve that decision in organizer-visible alerts, not only in a toast.

**Detection:**
```bash
rg -n "<ready-queue|:matches=\"pendingMatches\"|:can-assign-match|assignment-gate-summary|recent-auto-assign-decision|getQueueBlockedReason" src/features/tournaments/views/MatchControlView.vue src/features/tournaments/components/AlertsPanel.vue
```

---

### CP-103: Share Links And QR Codes Must Resolve Named Routes, Not Hardcoded Lookalike Paths

| Field | Value |
|-------|-------|
| **Added** | 2026-04-16 |
| **Source Bug** | Tournament dashboard “Share Scoring Link” copied `/tournaments/:id/score` and generated a QR for the public scoring page instead of the scorekeeper access route |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const scoringUrl = `${window.location.origin}/tournaments/${tournamentId}/score`;
await QRCode.toDataURL(scoringUrl);
```

**Correct Pattern (✅):**
```typescript
const scoringAccessHref = router.resolve({
  name: 'volunteer-scoring-access',
  params: { tournamentId },
}).href;

const scoringUrl = new URL(scoringAccessHref, window.location.origin).toString();
await QRCode.toDataURL(scoringUrl);
```

**Rule:** Any copied link, QR code payload, or share target that represents a router destination must be built from the named route via `router.resolve(...)`, especially when multiple similar paths exist (for example public score pages vs volunteer scoring access). Do not hardcode “close enough” path strings for share surfaces.

**Detection:**
```bash
rg -n "QRCode\\.toDataURL\\([^\\n]*`/tournaments/.*/score|clipboard\\.writeText\\([^\\n]*`/tournaments/.*/score|window\\.location\\.origin\\}/tournaments/\\$\\{.*\\}/score" src --glob "*.vue" --glob "*.ts"
```

---

## Category: Data Integrity

### CP-075: Workbook Seed Imports Must Apply Authoritative Corrections Before Dedupe And Persist Registration Seeds

| Field | Value |
|-------|-------|
| **Added** | 2026-04-10 |
| **Source Bug** | TNF 2026 Women's Doubles imported 14 teams, dropped corrected roster entries, and lost manual seeds |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const rawRegistrations = extractRawRegistrations(rows.slice(1));

const parsedRegistration: ParsedRegistration = {
  categoryKey: registration.categoryKey,
  participants,
  entryId: registration.entryId,
};

await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
  teamName,
  playerId,
  partnerPlayerId,
  status: 'approved',
});
```

**Correct Pattern (✅):**
```typescript
const rawRegistrations = [
  ...workbookRegistrations.filter((registration) => registration.categoryKey !== 'WD'),
  ...buildAuthoritativeWomenDoublesRegistrations(),
];

const parsedRegistration: ParsedRegistration = {
  categoryKey: registration.categoryKey,
  participants,
  entryId: registration.entryId,
  seed: registration.seed,
};

await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
  teamName,
  playerId,
  partnerPlayerId,
  status: 'approved',
  seed: registration.seed,
});
```

**Rule:** If a workbook-backed import has known bad or incomplete category rows, replace that category with an authoritative corrected dataset before deduping player identities. When the source includes manual seeding, carry `seed` through parsing and persist it on the registration document.

**Detection:**
```bash
rg -n "buildAuthoritativeWomenDoublesRegistrations|seed: registration.seed|seed: registration.seed,|seed: null" scripts/seed/tnf2026-core.ts
```

### CP-076: Bracket Viewer Inputs Must Be Sorted By Stored `round.number`

| Field | Value |
|-------|-------|
| **Added** | 2026-04-16 |
| **Source Bug** | MCIA 2026 level brackets rendered rounds in the wrong columns because Firestore match docs were consumed in arbitrary order |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const matches = matchesData || [];

viewer.render({
  stages,
  matches,
  matchGames,
  participants,
}, {
  selector: '#bracket',
});
```

**Correct Pattern (✅):**
```typescript
const data = prepareViewerData({
  stages,
  rounds,
  matches,
  matchGames,
  participants,
});

viewer.render(data, {
  selector: '#bracket',
});
```

**Rule:** `brackets-viewer.js` groups matches by the order their `round_id`s first appear in the `matches` array. When reading bracket docs from Firestore, always sort matches using the persisted `round.number` values before rendering. Do not rely on Firestore document order.

**Detection:**
```bash
if rg -q "viewer\\.render\\(" src/features/brackets/components/BracketsManagerViewer.vue && ! rg -q "prepareViewerData" src/features/brackets/components/BracketsManagerViewer.vue; then
  echo "Violation: BracketsManagerViewer renders Firestore matches without round-order preparation"
fi
```

### CP-067: Mock or Provide Vuetify Display in AppLayout Unit Tests

| Field | Value |
|-------|-------|
| **Added** | 2026-03-13 |
| **Source Bug** | Horizon-2A regression — `useDisplay()` threw "Could not find Vuetify display injection" in `AppLayout` tests |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// AppLayout uses useDisplay() internally, but test provides no Vuetify injection.
const wrapper = shallowMount(AppLayout, {
  global: {
    stubs: ['v-layout', 'v-main'],
  },
});
```

**Correct Pattern (✅):**
```typescript
// Provide display context in unit tests (mock or real plugin).
vi.mock('vuetify', () => ({
  useDisplay: () => ({ smAndDown: false }),
}));

const wrapper = shallowMount(AppLayout, { /* ... */ });
```

**Rule:** If a component calls `useDisplay()` (or other Vuetify composables using injection), unit tests must either install Vuetify or mock the composable.

**Detection:**
```bash
# Find AppLayout tests and verify they provide display context
rg -n "mount\\(AppLayout|shallowMount\\(AppLayout" tests/unit --glob "*.test.ts"
rg -n "vi\\.mock\\('vuetify'|createVuetify\\(" tests/unit/AppLayout*.test.ts
```

### CP-068: Validate Firebase Web Env Before Production Build/Deploy

### CP-072: Playwright Login Assertions Must Follow Real Post-Login Routing

| Field | Value |
|-------|-------|
| **Added** | 2026-03-19 |
| **Source Bug** | E2E setup and auth fixtures waited for `/dashboard` even though login redirects to `/tournaments` |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
await page.getByRole('button', { name: 'Sign In' }).click();
await page.waitForURL('/dashboard', { timeout: 15000 });
```

**Correct Pattern (✅):**
```typescript
await page.getByRole('button', { name: 'Sign In' }).click();
await waitForPostLoginLanding(page, 15000);
```

```typescript
export const POST_LOGIN_URL_RE = /\/(dashboard|tournaments)(?:\/?|[?#].*)?$/;

export const waitForPostLoginLanding = async (page: Page, timeout = 15000): Promise<void> => {
  await expect.poll(() => page.url(), { timeout }).toMatch(POST_LOGIN_URL_RE);
};
```

**Rule:** Playwright auth helpers must follow the app's real post-login landing behavior. Do not hard-code `/dashboard` unless the router contract explicitly guarantees it for that role and flow.

**Detection:**
```bash
rg -n "waitForURL\\('/dashboard'|waitForURL\\(\"/dashboard\"" e2e
```

### CP-073: Workflow E2E Must Seed Exact Match State Instead of Skipping on Generic Data

| Field | Value |
|-------|-------|
| **Added** | 2026-03-19 |
| **Source Bug** | Workflow regressions in publish/check-in/auto-assign passed because E2E reused a generic seed and skipped when the right match state was absent |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const matchCount = await page.locator('.match-item').count();
test.skip(matchCount === 0, 'Seeded data has no scorable matches');
```

**Correct Pattern (✅):**
```typescript
const scenario = await seedAutoAssignWorkflowScenario();

await page.goto(`/tournaments/${scenario.tournamentId}/match-control`);
await expect(page.getByText('Waiting for check-in')).toBeVisible();
await expect(page.getByText('Auto-assign skipped blocked match')).toBeVisible();
```

**Rule:** E2E coverage for CourtMastr workflows must seed the exact Firestore state required for the scenario under test, especially when behavior depends on `match_scores.scheduleStatus`, `plannedStartAt`, level scope, and per-registration `participantPresence`. Avoid runtime skips for core workflow tests when deterministic seeding is feasible.

**Detection:**
```bash
rg -n "test\\.skip\\(.*Seeded data|No scoreable matches|No matches available|No matches ready" e2e
rg -n "participantPresence|scheduleStatus: 'published'|scheduleStatus: 'draft'|plannedStartAt" e2e
```

| Field | Value |
|-------|-------|
| **Added** | 2026-03-14 |
| **Source Bug** | Production deploy shipped `VITE_FIREBASE_*` as `undefined` from a worktree missing `.env.production`, causing `auth/invalid-api-key` |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```bash
# Build/deploy without checking env propagation in current checkout/worktree
npm run build
firebase deploy
```

**Correct Pattern (✅):**
```bash
# Fail fast if Firebase web config is missing/placeholder in this checkout
npm run check:firebase-env
npm run build
npm run deploy
```

```json
{
  "scripts": {
    "check:firebase-env": "node scripts/check-firebase-env.mjs --mode production",
    "build": "npm run check:firebase-env && vue-tsc -b && vite build"
  }
}
```

**Rule:** Production builds/deploys must validate `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID` before bundling.

**Detection:**
```bash
# Ensure guard exists in scripts
rg -n "\"check:firebase-env\"|scripts/check-firebase-env\\.mjs" package.json scripts/

# Ensure build is gated by env check
node -e "const p=require('./package.json'); console.log(p.scripts.build.includes('check:firebase-env')?'OK':'MISSING')"
```

### CP-069: Slow Router Guard Tests Need Explicit Timeout Under Aggregate Logged Runs

| Field | Value |
|-------|-------|
| **Added** | 2026-03-14 |
| **Source Bug** | Combined public-route `test:log` run timed out in `router-guards-auth.test.ts` even though the assertions were passing |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
it('bypasses auth for overlay and obs routes', async () => {
  const overlayRoute = await runGuard('/overlay/t1/court/c1', { isAuthenticated: false });
  expect(overlayRoute.type).toBe('allow');
  const obsRoute = await runGuard('/obs/t1/scoreboard', { isAuthenticated: false });
  expect(obsRoute.type).toBe('allow');
});
```

**Correct Pattern (✅):**
```typescript
const ROUTER_GUARD_TEST_TIMEOUT_MS = 15_000;

it('bypasses auth for overlay and obs routes', async () => {
  const overlayRoute = await runGuard('/overlay/t1/court/c1', { isAuthenticated: false });
  expect(overlayRoute.type).toBe('allow');

  const obsRoute = await runGuard('/obs/t1/scoreboard', { isAuthenticated: false });
  expect(obsRoute.type).toBe('allow');
}, ROUTER_GUARD_TEST_TIMEOUT_MS);
```

**Rule:** Router guard tests that dynamically import the full router and traverse overlay/OBS public routes must set an explicit timeout when they are known to approach Vitest's default 5-second limit under aggregate `test:log` runs.

**Detection:**
```bash
rg -n "runGuard\\('/overlay|runGuard\\('/obs" tests/unit/router-guards-auth.test.ts
rg -n "ROUTER_GUARD_TEST_TIMEOUT_MS|, ROUTER_GUARD_TEST_TIMEOUT_MS\\)" tests/unit/router-guards-auth.test.ts
```

### CP-070: Schedule Workflow Must React To Publish Eligibility, Not Just Draft State

| Field | Value |
|-------|-------|
| **Added** | 2026-03-19 |
| **Source Bug** | Level scheduling workflow reopened scheduling instead of publishing, and Match Control auto-assign ignored later publish/check-in changes |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
case 'publish':
  return {
    label: 'Publish Schedule',
    event: 'schedule-times',
  };

watch(
  [() => autoAssignEnabled.value, () => availableCourts.value, () => pendingMatches.value],
  async ([isEnabled, freeCourts, pending]) => {
    const match = pending.find((m) => canAssignCourtToMatch(m));
    // publish/check-in changes never retrigger this watcher
  }
);
```

**Correct Pattern (✅):**
```typescript
case 'publish':
  return {
    label: 'Publish Schedule',
    event: 'publish-schedule',
  };

const autoAssignableDueMatches = computed(() =>
  pendingMatches.value.filter((match) => {
    if (!canAssignCourtToMatch(match)) return false;
    const plannedTime = getMatchScheduleTime(match);
    return Boolean(plannedTime && plannedTime.getTime() <= now + autoAssignDueWindowMs.value);
  })
);

watch(
  [() => autoAssignEnabled.value, () => availableCourts.value, () => autoAssignableDueMatches.value],
  async ([isEnabled, freeCourts, dueMatches]) => {
    const match = dueMatches[0];
    // re-runs when publish/check-in state changes make a match eligible
  }
);
```

**Rule:** Publish-phase CTAs must emit publish actions, and auto-assignment must watch a computed eligibility list that depends on publication and participant check-in state.

**Detection:**
```bash
rg -n "case 'publish'|case 'pool_publish'" src/features/tournaments/components/CategoryRegistrationStats.vue
rg -n "event: 'schedule-times'" src/features/tournaments/components/CategoryRegistrationStats.vue
rg -n "pendingMatches.value|autoAssignableDueMatches" src/features/tournaments/views/MatchControlView.vue
```

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

### CP-055: Reject Post-Clinch Games in Best-of-N Match Data

| Field | Value |
|-------|-------|
| **Added** | 2026-03-03 |
| **Source Bug** | MCIA leaderboard showed `7-0` games for a `3-0` match record due to an extra third game after a `2-0` clinch |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
// Accepts all score tokens without validating match-clinch sequence.
const scores = scoresRaw.split(',').map(parseScoreToken);

// Later aggregation blindly counts every complete game entry.
for (const game of match.scores) {
  if (game.winnerId === match.participant1Id) p1.gamesWon++;
  else p2.gamesWon++;
}
```

**Correct Pattern (✅):**
```typescript
const gamesNeeded = Math.ceil(gamesPerMatch / 2);
let p1Wins = 0;
let p2Wins = 0;

for (let i = 0; i < scores.length; i += 1) {
  const game = scores[i];
  if (game.teamAScore > game.teamBScore) p1Wins++;
  else p2Wins++;

  const decided = p1Wins >= gamesNeeded || p2Wins >= gamesNeeded;
  if (decided && i < scores.length - 1) {
    throw new Error(`Post-clinch game found: ${rawLine}`);
  }
}

// Leaderboard aggregation must ignore any trailing games if malformed data exists.
if (p1WinsInMatch >= gamesNeeded || p2WinsInMatch >= gamesNeeded) continue;
```

**Rule:** For best-of-N formats, score ingestion MUST reject game entries that appear after a winner has already clinched the match; leaderboard aggregation MUST defensively ignore trailing post-clinch games.

**Detection:**
```bash
# Find files that parse comma-separated score tokens but have no clinch guard markers
for f in $(rg -l "scoresRaw\\.split\\(',\\'" scripts --glob '*.ts'); do
  rg -q "Post-clinch|gamesNeeded|matchDecided" "$f" || echo "$f"
done
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

### CP-068: Public Website Footer Must Render Inside `v-main`

| Field | Value |
|-------|-------|
| **Added** | 2026-03-14 |
| **Source Bug** | Public footer rendered as a right-side column (Terms link isolated) when mounted as a `v-layout` sibling |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<v-main id="main-content">
  <v-container fluid>
    <router-view />
  </v-container>
</v-main>

<PublicWebsiteFooter v-if="showPublicWebsiteFooter" />
```

**Correct Pattern (✅):**
```vue
<v-main id="main-content" class="app-main">
  <v-container fluid class="app-main__content">
    <router-view />
  </v-container>
  <PublicWebsiteFooter v-if="showPublicWebsiteFooter" />
</v-main>
```

**Rule:** In Vuetify app-shell layouts, public footers belong inside `v-main` (column flow), not as standalone siblings under `v-layout`.

**Detection:**
```bash
rg -n "<PublicWebsiteFooter|</v-main>" src/components/layout/AppLayout.vue
awk '/<PublicWebsiteFooter/{f=NR} /<\\/v-main>/{m=NR} END { if (f && m && f < m) print "OK: footer inside v-main"; else print "Violation: footer outside v-main"; }' src/components/layout/AppLayout.vue
```

---

### CP-069: `PrimaryActionEvent` Literals Must Match the Union Exactly

| Field | Value |
|-------|-------|
| **Added** | 2026-03-14 |
| **Source Bug** | `build:log` fingerprint `20d5d4c3` (`'publish-schedule'` not assignable to `PrimaryActionEvent`) |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```ts
type PrimaryActionEvent =
  | 'setup-category'
  | 'manage-registrations'
  | 'generate-bracket'
  | 'view-bracket'
  | 'schedule-times'
  | 'open-checkin'
  | 'create-levels';

// Invalid literal (not in union) triggers TS2322
return {
  label: 'Publish Level Schedule',
  event: 'publish-schedule',
};
```

**Correct Pattern (✅):**
```ts
return {
  label: 'Publish Level Schedule',
  event: 'schedule-times',
};
```

**Rule:** Any object field typed as `PrimaryActionEvent` must use an exact union member literal. Introducing a nearby-but-different event string causes compile-time failure and blocks `build`/`build:log`.

**Detection:**
```bash
rg -n "type PrimaryActionEvent|event:\\s*'publish-schedule'|event:\\s*'unpublish-schedule'" src/features/tournaments/components/CategoryRegistrationStats.vue
npm run build:log
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

### CP-038: Match Control Schedule Table Must Use Public-State Quick Filters, Time-First Sort, and Keep Manual Score Visible For Pre-Match Rows

| Field | Value |
|-------|-------|
| **Added** | 2026-02-22 |
| **Updated** | 2026-04-17 |
| **Source Bug** | Compact All Matches rows hid manual score entry behind assignment state, blocking organizers from entering pre-match scores |
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
  if (canAssignCourtToMatch(match)) return 'assign';
  if (canScoreMatch(match)) return 'score';
  return null;
}
```
```vue
<!-- Mutually exclusive CTA hides score entry for pre-match rows -->
<v-btn v-if="getPrimaryRowAction(item) === 'score'">Score</v-btn>
<v-btn v-else-if="getPrimaryRowAction(item) === 'assign'">Assign</v-btn>
```

**Rule:** In Match Control → All Matches, default sorting must be planned time ascending (`plannedStartAt` fallback), public state must be filterable with quick toggles (`All/Published/Draft/Not Scheduled`), and each row must expose only one visible primary CTA (`Score` or `Assign`) with secondary actions in the overflow menu.

**Detection:**
```bash
if rg -n "getPrimaryRowAction" src/features/tournaments/views/MatchControlView.vue; then
  echo "Violation: compact Match Control rows still gate Score behind a single primary-action helper"
fi
rg -n "function canScoreMatch\\(match: Match\\): boolean \\{|return match\\.status === 'scheduled' \\|\\| match\\.status === 'ready' \\|\\| match\\.status === 'in_progress'" src/features/tournaments/views/MatchControlView.vue
rg -n "scheduleFilters\\.publicState|sortBy:\\s*'time'|v-if=\"canScoreMatch\\(item\\)\"|v-if=\"canAssignCourtToMatch\\(item\\)\"|v-else-if=\"shouldShowBlockedAssign\\(item\\)\"" src/features/tournaments/views/MatchControlView.vue
```

**Correct Pattern (✅):**
```typescript
const scheduleFilters = ref({
  status: 'all',
  publicState: 'all',
  sortBy: 'time',
  sortDesc: false,
});

function canScoreMatch(match: Match): boolean {
  return match.status === 'scheduled' || match.status === 'ready' || match.status === 'in_progress';
}
```
```vue
<!-- Keep Score available for pre-match rows, and gate Assign independently -->
<v-btn v-if="canScoreMatch(item)">Score</v-btn>
<v-btn v-if="canAssignCourtToMatch(item)">Assign</v-btn>
<v-tooltip v-else-if="shouldShowBlockedAssign(item)">
  <template #activator="{ props }">
    <span v-bind="props"><v-btn disabled>Assign</v-btn></span>
  </template>
</v-tooltip>
```

**Rule:** In Match Control → All Matches, default sorting must be planned time ascending (`plannedStartAt` fallback), public state must be filterable with quick toggles (`All/Published/Draft/Not Scheduled`), and compact rows must keep manual `Score` visible for `scheduled`, `ready`, and `in_progress` matches. `Assign` must remain independently gated by the existing assignment checks, with blocked pre-match rows still surfacing disabled assign UI and tooltip reasons.

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

### CP-054: Pool Categories Must Not Treat `stageId` as Elimination Bracket

| Field | Value |
|-------|-------|
| **Added** | 2026-02-27 |
| **Source Bug** | Categories UI skipped the `Levels` CTA (`Setup & Generate Levels` / `Generate Levels`) because pool stage `stageId` was interpreted as elimination-ready |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
function hasEliminationBracket(category: Category): boolean {
  return category.eliminationStageId != null || category.stageId != null;
}
```
```typescript
if (format === 'pool_to_elimination' || format === 'round_robin') {
  if (hasEliminationBracket(category)) return 'elimination';
  if (ctx.poolComplete) return 'levels';
}
```

**Correct Pattern (✅):**
```typescript
function hasEliminationBracket(category: Category, format: TournamentFormat): boolean {
  if (format === 'pool_to_elimination' || format === 'round_robin') {
    return category.eliminationStageId != null;
  }
  return category.eliminationStageId != null || category.stageId != null;
}
```
```typescript
if (format === 'pool_to_elimination' || format === 'round_robin') {
  if (hasEliminationBracket(category, format)) return 'elimination';
  if (ctx.poolComplete) return 'levels';
}
```

**Rule:** For `pool_to_elimination` / `round_robin`, treat `stageId` as current stage pointer (often pool stage) and use only `eliminationStageId` to infer elimination bracket existence.

**Detection:**
```bash
if rg -n "function hasEliminationBracket\\(category: Category\\): boolean[\\s\\S]*category\\.eliminationStageId != null \\|\\| category\\.stageId != null" src/features/tournaments/components/CategoryRegistrationStats.vue; then
  echo "Violation: pool formats may misclassify pool stageId as elimination bracket"
fi
rg -n "function hasEliminationBracket\\(category: Category, format: TournamentFormat\\)" src/features/tournaments/components/CategoryRegistrationStats.vue
rg -n "stageId: result.stageId,\\s*poolStageId: result.stageId" src/composables/useBracketGenerator.ts
```

---

### CP-055: Pool Stage Bracket View Must Use Round-Robin-Only Split Layout Guard

| Field | Value |
|-------|-------|
| **Added** | 2026-03-03 |
| **Source Bug** | Pool-stage bracket pages were hard to read because games and pool table were not visible together in browser view |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<div class="brackets-manager-viewer">
  <div class="bracket-container brackets-viewer" />
</div>
```
```css
.bracket-container {
  overflow-x: auto;
}
/* No round-robin-specific layout: pool rounds and table stay stacked */
```

**Correct Pattern (✅):**
```vue
<div
  class="brackets-manager-viewer"
  :class="{ 'is-round-robin-stage': isRoundRobinStageLayout }"
>
  <div class="bracket-container brackets-viewer" />
</div>
```
```css
.brackets-manager-viewer.is-round-robin-stage .bracket-container :deep(.round-robin .group) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 420px);
}

.brackets-manager-viewer.is-round-robin-stage .bracket-container :deep(.round-robin .group table) {
  grid-column: 2;
  position: sticky;
}
```

**Rule:** `BracketsManagerViewer` pool (`round_robin`) stages must apply a guarded split layout (games + table visible together on desktop) and keep mobile fallback stacked; elimination stages must remain unaffected.

**Detection:**
```bash
rg -n "is-round-robin-stage|isRoundRobinStageLayout|round-robin \\.group|round-robin \\.group table" src/features/brackets/components/BracketsManagerViewer.vue
```

---

### CP-056: Public Schedule Unpublished Banner Must Respect Visible Live Activity

| Field | Value |
|-------|-------|
| **Added** | 2026-03-03 |
| **Source Bug** | Public Schedule could show `Schedule not published yet.` even when live/queue/category activity was visible, creating contradictory state messaging |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<v-alert v-if="!hasPublishedSchedule" type="info" variant="tonal">
  Schedule not published yet.
</v-alert>
```

**Correct Pattern (✅):**
```typescript
const hasVisibleScheduleActivity = computed(() =>
  nowPlayingItems.value.length > 0 ||
  displayQueueItems.value.length > 0 ||
  recentResultItems.value.length > 0 ||
  categoryPulseItems.value.length > 0
);

const shouldShowUnpublishedScheduleAlert = computed(
  () => !hasPublishedSchedule.value && !hasVisibleScheduleActivity.value
);
```
```vue
<v-alert v-if="shouldShowUnpublishedScheduleAlert" type="info" variant="tonal">
  Schedule not published yet.
</v-alert>
```

**Rule:** Public Schedule "unpublished" messaging must be gated by both publish state and visible live/schedule activity. Never key the banner only off `!hasPublishedSchedule`.

**Detection:**
```bash
if rg -n "v-if=\"!hasPublishedSchedule\"" src/features/public/views/PublicScheduleView.vue; then
  echo "Violation: unpublished banner is keyed only to publish state"
fi
rg -n "hasVisibleScheduleActivity|shouldShowUnpublishedScheduleAlert" src/features/public/views/PublicScheduleView.vue
```

---

### CP-057: Queue Wait Labels Must Use Timestamp Fallbacks and Numeric Output

| Field | Value |
|-------|-------|
| **Added** | 2026-03-03 |
| **Source Bug** | Match queue rows could render `Waited` with no duration when `queuedAt` was missing, blocking manual urgency-threshold validation |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
function getWaitTime(match: Match): string {
  if (!match.queuedAt) return '';
  const minutes = differenceInMinutes(new Date(), match.queuedAt);
  if (minutes < 1) return 'Just now';
  return `${minutes} min`;
}
```

**Correct Pattern (✅):**
```typescript
function getQueueTimestamp(match: Match): Date | undefined {
  return match.queuedAt ?? match.plannedStartAt ?? match.scheduledTime;
}

function getWaitMinutes(match: Match): number {
  const queueTimestamp = getQueueTimestamp(match);
  if (!queueTimestamp) return 0;
  return Math.max(0, differenceInMinutes(new Date(), queueTimestamp));
}

function getWaitTime(match: Match): string {
  const minutes = getWaitMinutes(match);
  if (minutes < 1) return '0 min';
  return `${minutes} min`;
}
```

**Rule:** Match queue wait display and urgency inputs must never depend exclusively on `queuedAt`; use `queuedAt ?? plannedStartAt ?? scheduledTime`, clamp negatives to `0`, and always render a numeric wait label.

**Detection:**
```bash
if rg -n "if \\(!match\\.queuedAt\\) return '';" src/features/tournaments/components/MatchQueueList.vue; then
  echo "Violation: queue wait label can render blank text"
fi
rg -n "getQueueTimestamp|plannedStartAt \\?\\? match\\.scheduledTime|Math.max\\(0, differenceInMinutes\\(" src/features/tournaments/components/MatchQueueList.vue
```

---

### CP-058: Pinia Firestore Mutations Must Keep Local Reactive Collections in Sync

| Field | Value |
|-------|-------|
| **Added** | 2026-03-04 |
| **Source Bug** | Category/Court UI stayed stale after add/update/maintenance actions because Firestore writes succeeded but local `categories`/`courts` refs were not updated |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
async function addCourt(tournamentId: string, courtData: CourtInput): Promise<string> {
  const docRef = await addDoc(collection(db, `tournaments/${tournamentId}/courts`), courtData);
  return docRef.id; // UI stays stale unless a separate fetch/subscription runs
}

async function setCourtMaintenance(tournamentId: string, courtId: string): Promise<void> {
  await updateDoc(doc(db, `tournaments/${tournamentId}/courts`, courtId), { status: 'maintenance' });
  // no local courts.value update
}
```

**Correct Pattern (✅):**
```typescript
const createdAt = new Date();
courts.value = [...courts.value, {
  id: docRef.id,
  tournamentId,
  name: courtData.name,
  number: courtData.number,
  status: 'available',
  createdAt,
  updatedAt: createdAt,
}];

courts.value = courts.value.map((court) =>
  court.id === courtId
    ? { ...court, status: 'maintenance', currentMatchId: undefined, updatedAt: new Date() }
    : court
);
```

**Rule:** Any Pinia action that writes to Firestore collections backing active UI lists must either (1) maintain a guaranteed live subscription for that view or (2) apply a local reactive sync update (`categories.value` / `courts.value`) in the same action path.

**Detection:**
```bash
rg -n "categories\\.value = \\[\\.\\.\\.categories\\.value, optimisticCategory\\]" src/stores/tournaments.ts
rg -n "courts\\.value = \\[\\.\\.\\.courts\\.value, optimisticCourt\\]" src/stores/tournaments.ts
rg -n "courts\\.value = courts\\.value\\.map\\(" src/stores/tournaments.ts
```

---

### CP-059: E2E Auth Redirect Assertions Must Use URL Pattern Matching

| Field | Value |
|-------|-------|
| **Added** | 2026-03-04 |
| **Source Bug** | E2E suites intermittently failed after login because tests waited for exact `'/tournaments'` while app redirects could include query/path variants (for example `/tournaments?foo=bar` or `/tournaments/...`) |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
await page.getByRole('button', { name: 'Sign In' }).click();
await page.waitForURL('/tournaments', { timeout: 10000 });
```

**Correct Pattern (✅):**
```typescript
await page.getByRole('button', { name: 'Sign In' }).click();
await page.waitForURL(/\/tournaments(?:\/|$|\?)/, { timeout: 15000 });
```

**Rule:** E2E authentication flows must not assert exact post-login URL strings for tournament landing. Use regex/predicate assertions that accept `/tournaments`, nested tournament routes, and query-bearing redirects.

**Detection:**
```bash
rg -n "waitForURL\\('/tournaments'|waitForURL\\(\"/tournaments\"" e2e
```

---

### CP-060: Public Self-Registration Must Remain Player-Safe

| Field | Value |
|-------|-------|
| **Added** | 2026-03-11 |
| **Source Bug** | Public registration exposed organizer and scorekeeper role selection, allowing privileged-looking account creation from `/register` |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const selectedRole = ref('player');

const roleOptions = [
  { title: 'Player', value: 'player', description: 'Participate in tournaments' },
  { title: 'Tournament Organizer', value: 'organizer', description: 'Create and manage tournaments' },
  { title: 'Scorekeeper', value: 'scorekeeper', description: 'Record match scores' },
];
```
```vue
<v-select
  v-model="selectedRole"
  :items="roleOptions"
  label="I am a..."
/>
```

**Correct Pattern (✅):**
```typescript
const selectedRole = ref<UserRole>('player');
```
```vue
<v-alert type="info" variant="tonal" class="mb-3">
  Player accounts are created here. Staff and volunteer access is issued from tournament settings.
</v-alert>
```

**Rule:** The public `/register` flow may create player accounts only. Do not render organizer, scorekeeper, or other privileged role selection in public self-registration. Staff and volunteer access must be issued through staff-managed flows.

**Detection:**
```bash
if rg -n "Tournament Organizer|Scorekeeper|value: 'organizer'|value: 'scorekeeper'" src/features/auth/views/RegisterView.vue; then
  echo "Violation: privileged roles exposed in public registration"
fi
rg -n "const selectedRole = ref<UserRole>\\('player'\\)|Player accounts are created here" src/features/auth/views/RegisterView.vue
```

---

### CP-061: Volunteer Kiosk Mutations Must Use Callable Session Paths

| Field | Value |
|-------|-------|
| **Added** | 2026-03-11 |
| **Source Bug** | Volunteer routes could still mutate registrations and match scores through direct Firestore client writes, bypassing the tournament PIN session model |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
await updateDoc(
  doc(db, `tournaments/${tournamentId}/registrations`, registrationId),
  { status: 'checked_in', updatedAt: serverTimestamp() },
);

await setDoc(
  doc(db, matchScoresPath, matchId),
  { scores, status: 'completed', winnerId, updatedAt: serverTimestamp() },
  { merge: true },
);
```

**Correct Pattern (✅):**
```typescript
const sessionToken = getVolunteerSessionToken(tournamentId, 'checkin');
if (sessionToken) {
  const volunteerCheckInFn = httpsCallable(functions, 'applyVolunteerCheckInAction');
  await volunteerCheckInFn({ tournamentId, registrationId, action: 'check_in', sessionToken });
  return;
}

const scorekeeperToken = getVolunteerSessionToken(tournamentId, 'scorekeeper');
if (scorekeeperToken) {
  const updateMatchFn = httpsCallable(functions, 'updateMatch');
  await updateMatchFn({
    tournamentId,
    categoryId,
    matchId,
    status: 'in_progress',
    scores,
    sessionToken: scorekeeperToken,
  });
  return;
}
```

**Rule:** Any mutation triggered from check-in or scorekeeper volunteer sessions must go through a callable that validates the tournament-scoped session token. Direct Firestore writes remain acceptable only for authenticated staff paths.

**Detection:**
```bash
rg -n "applyVolunteerCheckInAction|applyVolunteerMatchUpdate|getVolunteerSessionToken" src/stores/registrations.ts src/stores/matches.ts
```

---

### CP-062: Bracket Primary ID Queries Must Preserve Numeric IDs

| Field | Value |
|-------|-------|
| **Added** | 2026-03-11 |
| **Source Bug** | Volunteer score submissions reached `updateMatch`, but the Cloud Function storage adapter queried bracket matches with string IDs while Firestore stored primary `id` fields as numbers |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
if (typeof arg === 'number' || typeof arg === 'string') {
  const snapshot = await this.getCollectionRef(table)
    .where('id', '==', String(arg))
    .get();
}

for (const [key, val] of Object.entries(arg)) {
  const queryVal = (key.endsWith('_id') || key === 'id') ? String(val) : val;
  query = query.where(key, '==', queryVal);
}
```

**Correct Pattern (✅):**
```typescript
private normalizeQueryValue(key: string, value: unknown): unknown {
  if (key === 'id' && typeof value === 'string' && /^\\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  if (key.endsWith('_id')) {
    return value === null ? value : String(value);
  }

  return value;
}

query = query.where('id', '==', this.normalizeQueryValue('id', arg));
```

**Rule:** In bracket storage adapters, primary `id` queries must match the stored type. Numeric bracket IDs must stay numeric for `id` lookups, while foreign-key `*_id` fields may still be normalized to strings.

**Detection:**
```bash
rg -n "where\\('id', '==', String\\(arg\\)\\)|key === 'id'\\) \\? String\\(val\\)|normalizeQueryValue" functions/src/storage/firestore-adapter.ts
```

### CP-063: Bracket Foreign-Key Queries Must Preserve Numeric IDs

| Field | Value |
|-------|-------|
| **Added** | 2026-03-12 |
| **Source Bug** | Volunteer manual-score completion returned `Error getting rounds.` after `updateMatch` |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
if (key.endsWith('_id')) {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id?: unknown }).id);
  }

  return value === null ? value : String(value);
}
```

**Correct Pattern (✅):**
```typescript
const normalizeBracketId = (candidate: unknown): unknown => {
  if (typeof candidate === 'number') return candidate;
  if (typeof candidate === 'string' && /^\d+$/.test(candidate)) {
    return Number.parseInt(candidate, 10);
  }
  return candidate === null ? candidate : String(candidate);
};

if (key.endsWith('_id')) {
  if (value && typeof value === 'object' && 'id' in value) {
    return normalizeBracketId((value as { id?: unknown }).id);
  }

  return normalizeBracketId(value);
}
```

**Rule:** In the server `FirestoreStorage` adapter, bracket-manager foreign-key filters such as `stage_id`, `group_id`, and `round_id` must preserve numeric IDs when the stored documents use numeric bracket IDs. Converting them to strings breaks `BracketsManager.update.match()` and similar traversal queries.

**Detection:**
```bash
rg -n "key\\.endsWith\\('_id'\\).*String\\(|return value === null \\? value : String\\(value\\)" functions/src/storage/firestore-adapter.ts
```

---

### CP-064: Point-by-Point Scoring Must Require Explicit Game Completion

| Field | Value |
|-------|-------|
| **Added** | 2026-03-12 |
| **Source Bug** | Accidental tap at game point (for example 20→21) immediately ended the game without scorer confirmation, preventing safe undo workflows |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
if (validation.isValid) {
  currentGame.isComplete = true;
  currentGame.winnerId = participant === 'participant1' ? match.participant1Id : match.participant2Id;
  scores.push({ gameNumber: 2, score1: 0, score2: 0, isComplete: false });
}
```

**Correct Pattern (✅):**
```typescript
const pendingCompletion = getPendingGameCompletion(currentGame, match.participant1Id, match.participant2Id, config);
if (pendingCompletion.canComplete) {
  return; // Lock further +1 taps until scorer confirms or undoes
}
```
```typescript
async function completeCurrentGame(...) {
  // Validate legal finish, then mark winner and advance game/match explicitly
}
```
```vue
<p v-if="currentGameReadyToComplete">
  Game point reached. Complete the game or undo the last point.
</p>
<v-btn v-if="currentGameReadyToComplete" @click="completeCurrentGame">
  Complete Game
</v-btn>
```

**Rule:** Reaching a legal winning score must lock further point increments and require an explicit scorer action (`Complete Game`) before the game is finalized. Undo must remain available while locked.

**Detection:**
```bash
rg -n "completeCurrentGame|getPendingGameCompletion|scoreEntryLocked|currentGameReadyToComplete" src/stores/matches.ts src/features/scoring/views/ScoringInterfaceView.vue
```

---

### CP-065: Match Detail Must Apply Full `match_scores` Overlay

| Field | Value |
|-------|-------|
| **Added** | 2026-03-12 |
| **Source Bug** | Match detail view stayed in `ready` after Start Match because `fetchMatch()` copied only scores/court fields and ignored `match_scores.status` |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
if (scoreDoc.exists()) {
  const scoreData = scoreDoc.data();
  adapted.scores = scoreData.scores || [];
  if (scoreData.courtId) adapted.courtId = scoreData.courtId;
}
```

**Correct Pattern (✅):**
```typescript
if (scoreDoc.exists()) {
  applyScoreOverlay(adapted, scoreDoc.data(), bMatch);
}
```

**Rule:** Single-match loaders (`fetchMatch`) must reuse the same score-overlay adapter used by list loaders (`fetchMatches`) so `status`, `winnerId`, court metadata, and timing fields stay consistent across views.

**Detection:**
```bash
rg -n "applyScoreOverlay\\(adapted, scoreDoc\\.data\\(\\), bMatch\\)" src/stores/matches.ts
```

---

### CP-066: E2E Scoring Completion Assertions Must Be Capability-Gated

| Field | Value |
|-------|-------|
| **Added** | 2026-03-12 |
| **Source Bug** | Scorekeeper concurrency E2E expected automatic completion artifacts (`Recent Results`, completed status) even when completion controls were manual/role-gated |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
await addPointsToParticipantOne(page, 3);
await expect.poll(async () => getCompletedMatchesCount(db, scenario)).toBe(5);
await expect(schedulePage.getByText('Recent Results')).toBeVisible();
```

**Correct Pattern (✅):**
```typescript
await expect.poll(async () => arePointScoresUpdated(db, scenario)).toBe(true);

const completionResults = await Promise.all(scorerPages.map((page) => completeCurrentGame(page)));
if (completionResults.every(Boolean)) {
  await expect.poll(async () => getCompletedMatchesCount(db, scenario)).toBe(5);
  await expect(schedulePage.getByText('Recent Results')).toBeVisible();
}
```

**Rule:** E2E scoring tests must always verify point propagation, then assert completion-specific UI/data only when the acting role/view can perform completion (`Complete Game` or manual entry controls available).

**Detection:**
```bash
rg -n "getCompletedMatchesCount\\(db, scenario\\)|Recent Results|Games 1 - 0" e2e/concurrent-five-scorers.spec.ts
```

---

### CP-070: Public Homepage Fallbacks Must Stay User-Facing and Relevant

| Field | Value |
|-------|-------|
| **Added** | 2026-03-15 |
| **Source Bug** | Homepage credibility strip showed raw failure copy ("Unable to load featured tournament metrics.") and placeholder `--` values when live data fetch failed |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
if (!featuredMetrics.value) {
  return [
    { label: 'Registered', value: '--' },
    { label: 'Completed Matches', value: '--' },
    { label: 'Check-In Rate', value: '--' },
  ];
}

return featuredMetricsError.value || 'Featured tournament metrics are temporarily unavailable.';
```

**Correct Pattern (✅):**
```typescript
if (!featuredMetrics.value) {
  return [
    { label: 'Player Registration', value: 'Live Roster' },
    { label: 'Match Operations', value: 'Real-Time Scores' },
    { label: 'Check-In Workflow', value: 'Self + Front Desk' },
  ];
}
```
```typescript
if (!hasFeaturedTournament.value) {
  return 'Featured event metrics will appear here once a tournament is selected.';
}

return 'Live featured tournament metrics are temporarily unavailable. Showing core workflow highlights instead.';
```

**Rule:** Public marketing surfaces must not show raw backend/internal errors or low-information placeholders. When live metrics fail, show user-facing, context-relevant fallback content.

**Detection:**
```bash
rg -n "Unable to load featured tournament metrics\\.|Set VITE_MARKETING_FEATURED_TOURNAMENT_ID|value: '--'" src/features/public/views/HomeView.vue src/composables/useFeaturedTournamentMetrics.ts
```

---

### CP-071: Match Score Listeners Must Apply Incremental Overlays Before Full Scope Refetch

| Field | Value |
|-------|-------|
| **Added** | 2026-03-15 |
| **Source Bug** | Live scoring screens triggered full scope `fetchMatches()` on every `match_scores` update, causing read amplification and UI lag in multi-category tournaments |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
onSnapshot(collection(db, scoresPath), () => fetchMatches(tournamentId, categoryId, levelId));
```

**Correct Pattern (✅):**
```typescript
onSnapshot(collection(db, scoresPath), (snapshot) => {
  const changes = snapshot.docChanges().map(change => ({
    type: change.type,
    id: change.doc.id,
    data: change.type === 'removed' ? undefined : change.doc.data(),
  }));
  const { requiresRefresh } = applyScoreChangesToLocalState(changes, categoryId, levelId);
  if (requiresRefresh) fetchMatches(tournamentId, categoryId, levelId);
});
```

**Rule:** Realtime `match_scores` listeners must patch in-memory matches from `docChanges()` and only run scoped full reloads for structural misses (`removed` docs or unknown matches). Avoid full scope refetches for ordinary score/status updates.

**Detection:**
```bash
rg -n "onSnapshot\\(collection\\(db, .*match_scores.*\\), \\(\\) => .*fetchMatches\\(" src/stores/matches.ts
rg -n "applyScoreChangesToLocalState\\(" src/stores/matches.ts
```

---

### CP-072: `useDisplay()` Refs Must Be Unwrapped Before Binding to Vuetify Boolean Props

| Field | Value |
|-------|-------|
| **Added** | 2026-03-15 |
| **Source Bug** | App shell emitted repeated runtime warnings: `Invalid prop: type check failed for prop "temporary". Expected Boolean, got Object` |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<AppNavigation
  :temporary="display.smAndDown"
  :permanent="!display.smAndDown"
/>
```

**Correct Pattern (✅):**
```typescript
const isSmallScreen = computed(() => display.smAndDown.value);
```
```vue
<AppNavigation
  :temporary="isSmallScreen"
  :permanent="!isSmallScreen"
/>
```

**Rule:** Values returned by `useDisplay()` are refs. When passing to strict boolean props, always bind unwrapped booleans (`.value` or computed wrappers), not the ref object.

**Detection:**
```bash
rg -n ":temporary=\"display\\.[a-zA-Z]+\"|:permanent=\"!display\\.[a-zA-Z]+\"" src/components --glob "*.vue"
```

---

### CP-073: OBS Overlay Routes Must Bypass App Shell Layout

| Field | Value |
|-------|-------|
| **Added** | 2026-03-15 |
| **Source Bug** | `/obs/*` overlays rendered inside `AppLayout` (header/drawer visible), breaking broadcast framing on web and mobile |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const isOverlayRoute = computed(() => route.meta.overlayPage === true);
```

**Correct Pattern (✅):**
```typescript
const isOverlayRoute = computed(() => (
  route.meta.overlayPage === true || route.meta.obsOverlay === true
));
```

**Rule:** Root app shell checks must include both classic overlay routes and OBS overlay routes so broadcast views render standalone without nav chrome.

**Detection:**
```bash
rg -n "route\\.meta\\.overlayPage === true\\)" src/App.vue
rg -n "obsOverlay" src/router/index.ts src/App.vue
```

---

### CP-074: Cross-Category Match Lists Must Use Composite Vue Keys

| Field | Value |
|-------|-------|
| **Added** | 2026-03-15 |
| **Source Bug** | Public scoring emitted runtime warnings (`Duplicate keys found during update: "1"`, `"2"`, etc.) when matches from multiple categories shared the same `match.id` |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<v-card
  v-for="match in scorableMatches"
  :key="match.id"
>
```

**Correct Pattern (✅):**
```vue
<v-card
  v-for="match in scorableMatches"
  :key="`scorable-${match.categoryId}-${match.levelId ?? 'root'}-${match.id}`"
>
```

**Rule:** Any list that can combine matches across categories or levels must use a composite key (`categoryId`, optional `levelId`, and `match.id`). `match.id` alone is not globally unique.

**Detection:**
```bash
if rg -n 'v-for="match in scorableMatches"' src/features/public/views/PublicScoringView.vue >/dev/null && rg -n ':key="match.id"' src/features/public/views/PublicScoringView.vue >/dev/null; then
  echo "Violation: PublicScoringView uses non-unique match keys"
fi
```

---

### CP-075: Match Store Subscriptions Must Prime Initial Fetches

| Field | Value |
|-------|-------|
| **Added** | 2026-03-20 |
| **Source Bug** | Scoring E2E seeded valid category-scoped matches, but Match Scoring Queue stayed at `0 Ready / 0 Scheduled` until a later Firestore change arrived |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
function subscribeMatches(tournamentId: string, categoryId?: string, levelId?: string): void {
  const refresh = () => fetchMatches(tournamentId, categoryId, levelId);

  onSnapshot(collection(db, matchPath), (snapshot) => {
    if (snapshot.docChanges().length > 0) {
      refresh();
    }
  });
}
```

**Correct Pattern (✅):**
```typescript
function subscribeMatches(tournamentId: string, categoryId?: string, levelId?: string): void {
  const refresh = () => fetchMatches(tournamentId, categoryId, levelId);

  onSnapshot(collection(db, matchPath), (snapshot) => {
    if (snapshot.docChanges().length > 0) {
      refresh();
    }
  });

  refresh();
}
```

**Rule:** Any store subscription that powers a page-load view must perform an initial fetch immediately after wiring listeners. Do not wait for a later snapshot delta when the page may open against already-seeded data.

**Detection:**
```bash
rg -n "function subscribeMatches|function subscribeMatch|refresh\\(\\);" src/stores/matches.ts
```

---

### CP-076: Active E2E Specs Must Not Depend on Conditional `test.skip(...)`

| Field | Value |
|-------|-------|
| **Added** | 2026-03-20 |
| **Source Bug** | E2E suite reported broad coverage while silently skipping workflow scenarios whenever the generic seed did not happen to contain the right state |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const matchCount = await page.locator('.match-item').count();
test.skip(matchCount === 0, 'Seeded data has no scorable matches');
```

**Correct Pattern (✅):**
```typescript
const scenario = await seedScoringWorkflowScenario('ready');
await page.goto(`/tournaments/${scenario.tournamentId}/matches`);
await expect(page.getByText(scenario.participantOneTeamName).first()).toBeVisible();
```

**Rule:** Active Playwright specs must seed or create the exact data they need. If a test cannot be made deterministic yet, remove it from the active suite rather than hiding it behind conditional skips.

**Detection:**
```bash
rg -n "test\\.skip|describe\\.skip|\\.todo\\(" e2e tests
```

---

### CP-077: Active E2E Specs Must Assert Behavior, Not Duplicate Page-Load Smoke Checks

| Field | Value |
|-------|-------|
| **Added** | 2026-03-20 |
| **Source Bug** | The active suite carried extra “page loads” checks that consumed runtime but did not catch workflow regressions or state bugs |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
test('loads tournament settings page', async ({ page }) => {
  await page.goto(`/tournaments/${tournamentId}/settings`);
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
});
```

**Correct Pattern (✅):**
```typescript
test('updates tournament basic information', async ({ page }) => {
  await page.goto(`/tournaments/${tournamentId}/settings`);
  await page.getByTestId('tournament-name').locator('input').fill('Updated Tournament Name');
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText(/saved|success/i).first()).toBeVisible();
});
```

**Rule:** Active Playwright specs should verify state changes, permissions, validations, or data flow. Remove duplicate heading-only or route-load checks when another active test already exercises the same page.

**Detection:**
```bash
rg -n "should load .*page|should display .*tab|should load the .*route" e2e --glob '*.spec.ts'
```

---

### CP-078: Vitest Must Bootstrap Browser Storage Before Import-Time Reads

| Field | Value |
|-------|-------|
| **Added** | 2026-03-20 |
| **Source Bug** | Full Vitest release gate failed because modules reading `localStorage` at import time loaded before per-test stubs were installed |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const rail = ref(localStorage.getItem(RAIL_KEY) === 'true');
```
```typescript
import AppLayout from '@/components/layout/AppLayout.vue';

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
  });
});
```

**Correct Pattern (✅):**
```typescript
// vitest.config.ts
test: {
  environment: 'happy-dom',
  setupFiles: ['tests/setup/browser-storage.ts'],
}
```
```typescript
// tests/setup/browser-storage.ts
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
```

**Rule:** If production modules or tests touch `localStorage` or `sessionStorage` during import/setup time, Vitest must install a real Storage-like bootstrap in `setupFiles` before test files import those modules. Per-test stubs alone are too late for import-time reads.

**Detection:**
```bash
rg -n "localStorage|getItem\\(|sessionStorage" src tests --glob "*.ts" --glob "*.vue"
rg -n "setupFiles" vitest.config.ts
```

---

### CP-079: Preserve Raw `git status --porcelain` Output Until After Parsing

| Field | Value |
|-------|-------|
| **Added** | 2026-03-29 |
| **Source Bug** | `release:deploy` misreported the first dirty file because the porcelain output was trimmed before parsing status codes |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
const dirtyEntries = statusOutput.split('\n').map(parsePorcelainLine);
```

**Correct Pattern (✅):**
```typescript
const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
const dirtyEntries = parseDirtyWorktreeEntries(statusOutput);
const isClean = statusOutput.trim() === '';
```

**Rule:** Never call `.trim()` on raw porcelain output before parsing individual status lines. Leading spaces are part of Git's status code format and trimming them corrupts the first entry.

**Detection:**
```bash
rg -n "git status --porcelain.*trim\\(" scripts src tests --glob "*.mjs" --glob "*.ts"
```

---

### CP-080: Release Plan and Deploy Must Share the Same Clean-Worktree Gate

| Field | Value |
|-------|-------|
| **Added** | 2026-03-31 |
| **Source Bug** | `release:plan` allowed dirty working trees while `release:deploy` blocked them, creating inconsistent release workflow guardrails |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const runPlanMode = () => {
  const gitState = getCurrentGitState();
  // no clean-worktree guard
  printPlan(buildReleasePlan({ gitState, ... }));
};

const runDeployMode = () => {
  const gitState = getCurrentGitState();
  assertCleanGitState('release:deploy', gitState);
};
```

**Correct Pattern (✅):**
```typescript
const runPlanMode = () => {
  const gitState = getCurrentGitState();
  assertCleanGitState('release:plan', gitState);
  printPlan(buildReleasePlan({ gitState, ... }));
};

const runDeployMode = () => {
  const gitState = getCurrentGitState();
  assertCleanGitState('release:deploy', gitState);
};
```

**Rule:** Any release workflow entrypoint that inspects or records a release candidate must enforce the same clean-worktree precondition. Do not let preview commands bypass the cleanliness gate if deploy commands depend on it.

**Detection:**
```bash
rg -n "assertCleanGitState\\('release:(plan|deploy)'" scripts/release/release-cli.mjs
```

---

### CP-081: Level-Scoped Match Selection Must Use Composite Match Keys

| Field | Value |
|-------|-------|
| **Added** | 2026-04-01 |
| **Source Bug** | Match Control court-assignment dialog selected multiple rows at once when pool-to-elimination levels reused the same `match.id` across scopes |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```vue
<v-list-item
  v-for="match in matches"
  :key="match.id"
  :active="selectedMatchId === match.id"
  @click="selectedMatchId = match.id"
/>
```
```typescript
const selectedMatch = matches.find((match) => match.id === selectedMatchId);
```

**Correct Pattern (✅):**
```vue
<v-list-item
  v-for="match in matches"
  :key="buildGlobalMatchKey(match)"
  :active="selectedMatchKey === buildGlobalMatchKey(match)"
  @click="selectedMatchKey = buildGlobalMatchKey(match)"
/>
```
```typescript
const selectedMatch = matches.find(
  (match) => buildGlobalMatchKey(match) === selectedMatchKey
);
```

**Rule:** Any selection state, Vue key, or assignment lookup for matches that can exist in multiple scopes must use the full tournament/category/level/match identity, not `match.id` alone. When pool-to-elimination levels are present, organizer UI must also surface the level label so duplicate round or match numbers remain distinguishable.

**Detection:**
```bash
rg -n ":key=\"match.id\"|selectedMatchId === match.id|selectedMatchId = match.id|find\\(.*match.id === selectedMatchId" src/features/tournaments/dialogs src/features/tournaments/components --glob "*.vue"
```

---

### CP-082: Public Match Labels Must Prefer Level Names Over Raw Pool IDs

| Field | Value |
|-------|-------|
| **Added** | 2026-04-01 |
| **Source Bug** | Public schedule and live scoring showed `Pool 0` for level-scoped pool-to-elimination matches even when the level was known |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
function getPoolLabel(match: Match): string | null {
  return match.groupId ? `Pool ${match.groupId}` : null;
}
```
```vue
<v-card-subtitle>
  {{ getCategoryName(match.categoryId) }} | {{ getCourtName(match.courtId) }}
</v-card-subtitle>
```

**Correct Pattern (✅):**
```typescript
const { getMatchScopeLabel } = useMatchScopeLabels(
  tournamentId,
  computed(() => matchStore.matches),
);
```
```vue
<v-chip v-if="item.scopeLabel">
  {{ item.scopeLabel }}
</v-chip>
```
```vue
<v-card-subtitle>
  {{ getCategoryName(match.categoryId) }}
  <template v-if="getMatchScopeLabel(match)">
    | {{ getMatchScopeLabel(match) }}
  </template>
  | {{ getCourtName(match.courtId) }}
</v-card-subtitle>
```

**Rule:** Any public or live match list that already knows `levelId` must resolve and display the human level name (`Advanced`, `Intermediate`, etc.) before falling back to raw pool labels. `Pool ${groupId}` is only acceptable when no level scope exists for that match.

**Detection:**
```bash
rg -n "Pool \\$\\{match\\.groupId\\}|All Pools|Sort: Pool" src/features/public/views src/features/tournaments/views --glob "*.vue"
```

---

### CP-083: Release Verification Tests Must Not Depend on Live Repo Version Files

| Field | Value |
|-------|-------|
| **Added** | 2026-04-01 |
| **Source Bug** | `release:deploy` failed after bumping to `2.0.0` because a unit test expected the repo to still be on `1.1.0` with matching checked-in release notes |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const metadata = verifyReleaseNotes({ enforceVersionBump: false });

expect(metadata.version).toBe('1.1.0');
expect(metadata.releaseId).toBe('v1.1.0');
```

**Correct Pattern (✅):**
```typescript
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'courtmastr-release-notes-current-'));
const packageJsonPath = writePackageJson(tempDir, '2.0.0');
const releaseNotesPath = writeReleaseNotes(tempDir, '2.0.0');

const metadata = verifyReleaseNotes({
  packageJsonPath,
  releasesDir: path.join(tempDir, 'docs/releases'),
  enforceVersionBump: false,
});

expect(metadata.version).toBe('2.0.0');
expect(metadata.releaseNotesPath).toBe(releaseNotesPath);
```

**Rule:** Any test covering release/version utilities must provide its own temporary `package.json` and release-note fixtures. Do not bind assertions to the repository's current semantic version or checked-in release files, because `release:deploy` intentionally mutates those during verification.

**Detection:**
```bash
rg -n "verifyReleaseNotes\\(\\{ enforceVersionBump: false \\}\\)|expect\\(metadata\\.version\\)\\.toBe\\('1\\.1\\.0'\\)" tests/unit --glob "*.test.ts"
```

---

### CP-084: Failed Release Rollback Must Restore the Worktree from Git State

| Field | Value |
|-------|-------|
| **Added** | 2026-04-01 |
| **Source Bug** | Failed `release:deploy` runs rolled back version files but could still leave tracked verification artifacts dirty, causing the next clean-worktree gate to fail |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const originalState = {
  packageJson: fs.readFileSync(packageJsonPath, 'utf8'),
  packageLock: fs.readFileSync(packageLockPath, 'utf8'),
  lastDeploy: lastDeployContent,
  releaseNotesExisted: fs.existsSync(releaseNotesPath),
};

const rollback = () => {
  fs.writeFileSync(packageJsonPath, originalState.packageJson, 'utf8');
  fs.writeFileSync(packageLockPath, originalState.packageLock, 'utf8');
  fs.writeFileSync(LAST_DEPLOY_RECORD_PATH, originalState.lastDeploy, 'utf8');
};
```

**Correct Pattern (✅):**
```typescript
const rollback = () => {
  const rollbackGitState = getCurrentGitState();
  rollbackReleaseWorktree({
    cwd: process.cwd(),
    headCommit: gitState.headCommit,
    dirtyEntries: rollbackGitState.dirtyEntries,
  });
};
```
```typescript
export const rollbackReleaseWorktree = ({ cwd, headCommit, dirtyEntries }) => {
  const { trackedPaths, untrackedPaths } = splitRollbackPaths(dirtyEntries);

  if (trackedPaths.length > 0) {
    execFileSync('git', ['restore', '--source', headCommit, '--staged', '--worktree', '--', ...trackedPaths], { cwd });
  }

  for (const relativePath of untrackedPaths) {
    fs.rmSync(path.resolve(cwd, relativePath), { recursive: true, force: true });
  }
};
```

**Rule:** Release automation that starts from a clean worktree must roll back by restoring every tracked dirty path to the starting `HEAD` and removing any newly-created untracked files. Do not hardcode a short list of version files, because verification steps can legitimately rewrite other tracked artifacts.

**Detection:**
```bash
rg -n "const originalState = \\{|packageJson: fs\\.readFileSync\\(|releaseNotesExisted|fs\\.unlinkSync\\(releaseNotesPath\\)" scripts/release --glob "*.mjs"
```

---

### CP-085: Release Preflight Must Auto-Restore Known Generated Test Artifacts

| Field | Value |
|-------|-------|
| **Added** | 2026-04-01 |
| **Source Bug** | `release:deploy` was blocked after successful Playwright runs because tracked auth and test-data artifacts were left modified by the test harness |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const gitState = getCurrentGitState();
assertCleanGitState('release:deploy', gitState);
```

**Correct Pattern (✅):**
```typescript
restorePreReleaseGeneratedFiles();
const gitState = getCurrentGitState();
assertCleanGitState('release:deploy', gitState);
```
```typescript
export const PRE_RELEASE_AUTORESTORE_PATHS = [
  'e2e/.auth/admin.json',
  'e2e/.auth/scorekeeper.json',
  'e2e/.test-data.json',
  'docs/testing/TEST_CATALOG.md',
  'docs/testing/TEST_CATALOG.html',
  'docs/testing/test-run-summary.json',
];
```

**Rule:** Release preflight should preserve the clean-worktree guard, but it must first auto-restore tracked files that are intentionally rewritten by the repo’s own test/report generators. Do not make operators manually clean Playwright auth state or test catalog artifacts before every release.

**Detection:**
```bash
rg -n "assertCleanGitState\\('release:(plan|deploy)'|restorePreReleaseGeneratedFiles|PRE_RELEASE_AUTORESTORE_PATHS" scripts/release --glob "*.mjs"
```

---

### CP-086: Mutable Test Collector Arrays Must Be Explicitly Typed

| Field | Value |
|-------|-------|
| **Added** | 2026-04-01 |
| **Source Bug** | `release:deploy` passed tests but failed `vue-tsc -b` because release utility tests used untyped mutable arrays that inferred to implicit `any[]` |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
const restoredCommands = [];
const removedPaths = [];
```

**Correct Pattern (✅):**
```typescript
const restoredCommands: string[][] = [];
const removedPaths: string[] = [];
```

**Rule:** In strict TypeScript tests, any mutable collector array used across callback boundaries must declare its element type explicitly. Do not rely on empty-array inference inside helper/mocking tests, because `vue-tsc` can treat them as implicit `any[]` even when Vitest itself passes.

**Detection:**
```bash
rg -n "const [A-Za-z0-9_]+ = \\[\\];" tests/unit --glob "*.test.ts"
```

---

### CP-087: Optimistic Store Writes Must Refresh Local Source of Truth

| Field | Value |
|-------|-------|
| **Added** | 2026-04-01 |
| **Source Bug** | Tournament settings saves reverted visible form values because `updateTournament()` wrote to Firestore but left `currentTournament` stale until a later snapshot, and a category watcher repopulated the form from that stale store state |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```typescript
await updateDoc(doc(db, 'tournaments', tournamentId), updateData);
```

**Correct Pattern (✅):**
```typescript
await updateDoc(doc(db, 'tournaments', tournamentId), updateData);

const optimisticUpdates: Partial<Tournament> = {
  ...updates,
  updatedAt: new Date(),
};

tournaments.value = tournaments.value.map((tournament) => {
  if (tournament.id !== tournamentId) return tournament;
  return {
    ...tournament,
    ...optimisticUpdates,
  };
});

if (currentTournament.value?.id === tournamentId) {
  currentTournament.value = {
    ...currentTournament.value,
    ...optimisticUpdates,
  };
}
```

**Rule:** Any store action that writes the current entity to Firestore and is also used as the UI's immediate source of truth must update the local store copy after a successful write. Do not rely on a later snapshot when the view can be repopulated from local store state in the same interaction.

**Detection:**
```bash
rg -n "async function updateTournament|await updateDoc\\(doc\\(db, 'tournaments', tournamentId\\), updateData\\);" src/stores/tournaments.ts
```

---

### CP-088: Do Not Declare Single-Field Firestore Indexes as Composite Indexes

| Field | Value |
|-------|-------|
| **Added** | 2026-04-01 |
| **Source Bug** | Production deploy failed because `firestore.indexes.json` declared single-field indexes like `players.emailNormalized` and `activities.createdAt` as composite indexes, and Firestore rejected them as definitions that should be handled through single-field controls instead |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```json
{
  "collectionGroup": "players",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "emailNormalized", "order": "ASCENDING" }
  ]
}
```

**Correct Pattern (✅):**
```json
{
  "collectionGroup": "players",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "isActive", "order": "ASCENDING" },
    { "fieldPath": "lastName", "order": "ASCENDING" }
  ]
}
```

**Rule:** `firestore.indexes.json` should contain only true composite indexes. If an index uses just one explicit field plus the implicit `__name__`, remove it from the composite index list and manage any needed behavior through Firestore single-field index controls instead.

**Detection:**
```bash
node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync('firestore.indexes.json','utf8'));console.log(data.indexes.filter((index)=>index.fields.length===1));"
```

---

### CP-089: Production Deploy Scripts Must Pin the Firebase Project Alias

| Field | Value |
|-------|-------|
| **Added** | 2026-04-01 |
| **Source Bug** | Local release and deploy commands relied on the operator's previously selected Firebase project, making production deploys depend on shell state instead of repo state |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```json
{
  "scripts": {
    "deploy": "npm run build && firebase deploy",
    "deploy:log": "node scripts/run-and-log.mjs --shell \"npm run build && firebase deploy\""
  }
}
```

**Correct Pattern (✅):**
```json
{
  "scripts": {
    "deploy": "npm run build && firebase deploy --project production",
    "deploy:log": "node scripts/run-and-log.mjs --shell \"npm run build && firebase deploy --project production\""
  }
}
```

**Rule:** Any production deploy or release script must pass the intended Firebase project alias explicitly. Never rely on `firebase use` state or whichever project the caller last selected in their shell.

**Detection:**
```bash
rg -n "\"deploy(?::log|:hosting)?\": \".*firebase deploy(?!.*--project production)\"" package.json -P
```

---

### CP-090: Terraform Must Filter Single-Field Firestore Index Specs Out of Composite Index Management

| Field | Value |
|-------|-------|
| **Added** | 2026-04-01 |
| **Source Bug** | Platform IaC treated every entry in `firestore.indexes.json` as a `google_firestore_index`, causing `terraform apply` to fail when Firestore rejected single-field indexes as “not necessary” |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```hcl
locals {
  composite_indexes = try(local.firestore_index_spec.indexes, [])
}

resource "google_firestore_index" "composite" {
  for_each = {
    for index in local.composite_indexes :
    "${index.collectionGroup}-${index.queryScope}-..." => index
  }
}
```

**Correct Pattern (✅):**
```hcl
locals {
  composite_indexes = [
    for index in try(local.firestore_index_spec.indexes, []) :
    index
    if length(try(index.fields, [])) > 1
  ]
}

resource "google_firestore_index" "composite" {
  for_each = {
    for index in local.composite_indexes :
    "${index.collectionGroup}-${index.queryScope}-..." => index
  }
}
```

**Rule:** `google_firestore_index` must only manage true composite indexes. If `firestore.indexes.json` contains single-field entries, filter them out before building the Terraform `for_each`, because Firestore manages those through single-field index controls instead of composite index resources.

**Detection:**
```bash
rg -n "composite_indexes\\s*=\\s*try\\(local\\.firestore_index_spec\\.indexes, \\[\\]\\)" infra/terraform/platform/main.tf
```

---

### CP-091: Root App Dependencies Must Stay Cross-Platform

| Field | Value |
|-------|-------|
| **Added** | 2026-04-02 |
| **Source Bug** | GitHub Actions failed at `npm ci` because the root app dependencies included `oh-my-opencode-darwin-arm64`, a package that only installs on macOS arm64 |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```json
{
  "dependencies": {
    "firebase": "^12.8.0",
    "oh-my-opencode-darwin-arm64": "^3.11.2"
  }
}
```

**Correct Pattern (✅):**
```json
{
  "dependencies": {
    "firebase": "^12.8.0"
  }
}
```

**Rule:** The root `package.json` must not include OS-specific binary packages unless they are truly optional and CI-safe across Linux runners. Platform-specific local tooling belongs outside the app dependency graph.

**Detection:**
```bash
node -e "const pkg=require('./package.json');const entries=Object.entries({...pkg.dependencies,...pkg.devDependencies,...pkg.optionalDependencies});const bad=entries.filter(([name])=>/(darwin|linux|win32).*(arm64|x64)|.*-(darwin|linux|win32)-.*/i.test(name));console.log(bad)"
```

---

### CP-092: Firebase Deploy Identities Must Have Service Usage Consumer

| Field | Value |
|-------|-------|
| **Added** | 2026-04-02 |
| **Source Bug** | GitHub Actions reached `firebase deploy` but failed with `serviceusage.services.use` denied while enabling Storage-backed deploy steps |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```hcl
locals {
  deploy_roles = toset([
    "roles/firebase.admin",
    "roles/storage.admin"
  ])
}
```

**Correct Pattern (✅):**
```hcl
locals {
  deploy_roles = toset([
    "roles/firebase.admin",
    "roles/serviceusage.serviceUsageConsumer",
    "roles/storage.admin"
  ])
}
```

**Rule:** Any service account that runs `firebase deploy` must have project-level `roles/serviceusage.serviceUsageConsumer` in addition to the obvious Firebase and storage roles. Firebase deploy shells out to Service Usage protected APIs during hosting/functions/storage rollout.

**Detection:**
```bash
rg -n 'roles/serviceusage\\.serviceUsageConsumer' infra/terraform/deploy/main.tf
```

---

### CP-093: Bootstrap Must Enable Cloud Billing API Before Firebase Deploy Automation

| Field | Value |
|-------|-------|
| **Added** | 2026-04-02 |
| **Source Bug** | GitHub Actions release got through Functions/Firestore prep but failed when Firebase CLI requested `cloudbilling.googleapis.com` and the project had never enabled it |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```hcl
locals {
  required_services = toset([
    "cloudbuild.googleapis.com",
    "cloudfunctions.googleapis.com"
  ])
}
```

**Correct Pattern (✅):**
```hcl
locals {
  required_services = toset([
    "cloudbilling.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudfunctions.googleapis.com"
  ])
}
```

**Rule:** The bootstrap Terraform layer must enable `cloudbilling.googleapis.com` for any Firebase production project. Firebase CLI checks project billing status during deploys even when billing is already attached, so leaving the API disabled breaks release automation late in the pipeline.

**Detection:**
```bash
rg -n 'cloudbilling\\.googleapis\\.com' infra/terraform/bootstrap/main.tf
```

---

### CP-094: Firebase Functions Deploy Identities Must Also Act As the Compute Default Service Account

| Field | Value |
|-------|-------|
| **Added** | 2026-04-02 |
| **Source Bug** | GitHub Actions release failed with fingerprint `8189453e` after Firebase deploy reached Cloud Functions v2 updates |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```hcl
locals {
  app_engine_default_service_account_email = "${var.project_id}@appspot.gserviceaccount.com"
}

resource "google_service_account_iam_member" "appspot_act_as" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${local.app_engine_default_service_account_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.firebase_deploy.email}"
}
```

**Correct Pattern (✅):**
```hcl
data "google_project" "current" {
  project_id = var.project_id
}

locals {
  app_engine_default_service_account_email = "${var.project_id}@appspot.gserviceaccount.com"
  compute_default_service_account_email    = "${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

resource "google_service_account_iam_member" "appspot_act_as" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${local.app_engine_default_service_account_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.firebase_deploy.email}"
}

resource "google_service_account_iam_member" "compute_default_act_as" {
  service_account_id = "projects/${var.project_id}/serviceAccounts/${local.compute_default_service_account_email}"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.firebase_deploy.email}"
}
```

**Rule:** A Firebase deploy identity that updates Cloud Functions 2nd Gen must have `roles/iam.serviceAccountUser` on both `${project_id}@appspot.gserviceaccount.com` and `${project_number}-compute@developer.gserviceaccount.com`. Granting only the App Engine default service account is insufficient.

**Detection:**
```bash
rg -n "compute_default_service_account_email|compute_default_act_as" infra/terraform/deploy/main.tf
```

---

### CP-095: Release Metadata Must Store Repo-Relative Artifact Paths and Fully Mark Deployed Notes

| Field | Value |
|-------|-------|
| **Added** | 2026-04-02 |
| **Source Bug** | CI release metadata recorded `/home/runner/...` paths in `LAST_DEPLOY.md`, and `docs/releases/v2.0.0.md` still showed `Status: planned` in the deployment section after a successful deploy |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```js
const updated = content
  .replace(/^- Status: .*/m, '- Status: deployed')
  .replace(/^- Release date: .*/m, `- Release date: ${deployedAt}`);

- [docs/releases/${path.basename(newDeploy.releaseNotesPath)}](${newDeploy.releaseNotesPath})
- \`${newDeploy.deployLogPath}\`
```

**Correct Pattern (✅):**
```js
export const normalizeRepoArtifactPath = (artifactPath) => {
  const docsMatch = artifactPath?.replace(/\\\\/g, '/').match(/(?:^|\\/)(docs\\/.+)$/);
  return docsMatch?.[1] ?? artifactPath ?? null;
};

export const markReleaseNotesDeployed = (content, deployedAt) =>
  content
    .replace(/^- Status: .*/gm, '- Status: deployed')
    .replace(/^- Release date: .*/m, `- Release date: ${deployedAt}`);
```

**Rule:** Release automation must write repo-relative artifact paths like `docs/releases/v2.0.0.md` and `docs/debug-kb/_artifacts/...`, never runner-local absolute paths. When a release is marked deployed, both the release header status and the `## Deployment` status must flip to `deployed`.

**Detection:**
```bash
rg -n "/home/runner/work|markReleaseNotesDeployed|normalizeRepoArtifactPath" scripts/release docs/deployment/LAST_DEPLOY.md docs/releases
```

---

### CP-096: Release Utility Tests Must Not Hardcode Local Repo Paths

| Field | Value |
|-------|-------|
| **Added** | 2026-04-02 |
| **Source Bug** | Metadata-only `master` CI run failed because `tests/unit/release-utils.test.ts` tried to `chdir` into a laptop-specific path that does not exist on GitHub runners |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```ts
const repoPath = '/Users/ramc/Documents/Code/courtmaster-v2';
const originalCwd = process.cwd();
process.chdir(repoPath);
```

**Correct Pattern (✅):**
```ts
const repoPath = process.cwd().replace(/\\/g, '/');
expect(normalizeRepoArtifactPath(`${repoPath}/docs/debug-kb/_artifacts/deploy.log`))
  .toBe('docs/debug-kb/_artifacts/deploy.log');
```

**Rule:** Cross-environment tests for release tooling must derive paths from `process.cwd()` or fixture strings, never from developer-machine absolute paths.

**Detection:**
```bash
rg -n "/Users/|process\\.chdir\\(" tests/unit/release-utils.test.ts
```

---

### CP-097: Seed Helpers Must Hoist Shared Timestamps Above Conditional Branches

| Field | Value |
|-------|-------|
| **Added** | 2026-04-02 |
| **Source Bug** | TNF 2026 local seed crashed when `seedGlobalPlayer()` hit an existing `playerEmailIndex` entry and referenced `now` before it was defined |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```ts
if (indexSnap.exists()) {
  await setDoc(existingPlayerRef, {
    updatedAt: now,
  }, { merge: true });
} else {
  const now = serverTimestamp();
  await setDoc(playerRef, { createdAt: now, updatedAt: now });
}
```

**Correct Pattern (✅):**
```ts
const now = serverTimestamp();

if (indexSnap.exists()) {
  await setDoc(existingPlayerRef, {
    updatedAt: now,
  }, { merge: true });
} else {
  await setDoc(playerRef, { createdAt: now, updatedAt: now });
}
```

**Rule:** When both seed branches reuse the same timestamp token, define it before the branch. Do not declare `const now = serverTimestamp()` only inside the create path and then reference it from the reuse path.

**Detection:**
```bash
rg -n "updatedAt: now|createdAt: now" scripts/seed
```

---

### CP-098: Org-Scoped Tournament Seeds Must Include Real Organizer UIDs In `organizerIds`

| Field | Value |
|-------|-------|
| **Added** | 2026-04-02 |
| **Source Bug** | TNF organizer could open the tournament but hit `PERMISSION_DENIED` when updating categories because the local seed only stored the admin UID in `organizerIds` |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```ts
const tournamentRef = await addDoc(collection(db, 'tournaments'), {
  orgId,
  createdBy: adminId,
  organizerIds: [adminId],
});
```

**Correct Pattern (✅):**
```ts
const organizerIds = [...new Set([adminId, tnfOrganizerId])];

const tournamentRef = await addDoc(collection(db, 'tournaments'), {
  orgId,
  createdBy: adminId,
  organizerIds,
});
```

**Rule:** If a seed creates an org-scoped tournament for a non-admin organizer login, that organizer must be present in `tournament.organizerIds`. Org membership alone is not enough for category/court/registration writes under the current Firestore rules.

**Detection:**
```bash
rg -n "organizerIds: \\[adminId\\]|organizerIds,?$" scripts/seed
```

---

### CP-099: GitHub OIDC Deploy Trust Must Match The Live Repository Identity

| Field | Value |
|-------|-------|
| **Added** | 2026-04-03 |
| **Source Bug** | `master` deploy rerun passed build but Google auth failed because the workload identity provider still trusted `Ramc4685/courtmaster-v2` after the repo moved to `courtmastr/courtmastr-app` |
| **Severity** | Critical |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```hcl
github_owner = "Ramc4685"
github_repo  = "courtmaster-v2"
```

**Correct Pattern (✅):**
```hcl
github_owner = "courtmastr"
github_repo  = "courtmastr-app"
```

```bash
cd infra/terraform/deploy
terraform apply
```

**Rule:** The deploy layer's `github_owner` and `github_repo` inputs must always match the current GitHub remote that runs `.github/workflows/ci-cd.yml`. If the repository is renamed or transferred, update the Terraform inputs and re-apply before relying on GitHub OIDC deploys.

**Detection:**
```bash
REMOTE_URL="$(git remote get-url origin)"
EXPECTED_OWNER="$(printf '%s' "$REMOTE_URL" | sed -E 's#.*github.com[:/]([^/]+)/([^/.]+)(\\.git)?#\\1#')"
EXPECTED_REPO="$(printf '%s' "$REMOTE_URL" | sed -E 's#.*github.com[:/]([^/]+)/([^/.]+)(\\.git)?#\\2#')"
ACTUAL_OWNER="$(terraform -chdir=infra/terraform/deploy console <<< 'var.github_owner' | tr -d '\"[:space:]')"
ACTUAL_REPO="$(terraform -chdir=infra/terraform/deploy console <<< 'var.github_repo' | tr -d '\"[:space:]')"
test "$EXPECTED_OWNER" = "$ACTUAL_OWNER" && test "$EXPECTED_REPO" = "$ACTUAL_REPO"
```

---

### CP-100: Release Metadata Automation Must Respect Protected `master` Branches

| Field | Value |
|-------|-------|
| **Added** | 2026-04-03 |
| **Source Bug** | Release workflow deployed production successfully but still failed because it tried to `git push` release metadata directly to protected `master` |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```yaml
- name: Commit release metadata
  run: |
    git commit -m "chore: record release metadata [skip release]"
    git push origin HEAD:master
```

**Correct Pattern (✅):**
```yaml
- name: Commit release metadata
  env:
    GH_TOKEN: ${{ github.token }}
  run: |
    git commit -m "chore: record release metadata [skip release]"
    if git push origin HEAD:master; then
      exit 0
    fi

    metadata_branch="release-metadata/${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
    git push origin HEAD:"${metadata_branch}"
    gh pr create --base master --head "${metadata_branch}" --title "chore: record release metadata [skip release]"
```

**Rule:** CI release jobs must not assume they can push directly to `master`. When branch protection requires pull requests, the workflow must fall back to a metadata branch plus PR so a successful deploy does not end in a failed run.

**Detection:**
```bash
rg -n "git push origin HEAD:master" .github/workflows/ci-cd.yml
rg -n "release-metadata/\\$\\{GITHUB_RUN_ID\\}-\\$\\{GITHUB_RUN_ATTEMPT\\}|gh pr create|pull-requests: write" .github/workflows/ci-cd.yml
```

---

### CP-101: Frontend Trace Logs Must Use The Shared Logger

| Field | Value |
|-------|-------|
| **Added** | 2026-04-12 |
| **Source Bug** | Production DevTools showed app-owned debug traces such as `[fetchMatches]` and `[adaptBracketsMatch]` alongside real errors |
| **Severity** | Medium |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```ts
console.log('[fetchMatches] Fetching matches:', scopes);
console.log('[adaptBracketsMatch] Converting match:', match);
console.error('[fetchMatches] Failed to fetch matches:', err);
```

**Correct Pattern (✅):**
```ts
import { logger } from '@/utils/logger';

logger.debug('[fetchMatches] Fetching matches:', scopes);
logger.debug('[adaptBracketsMatch] Converting match:', match);
logger.error('[fetchMatches] Failed to fetch matches:', err);
```

**Rule:** Frontend app code must not call `console.*` directly outside `src/utils/logger.ts`. Use `logger.debug()` for local-only tracing, `logger.info()` only for explicitly enabled informational logs, `logger.warn()` for meaningful recoverable issues, and `logger.error()` for real failures that must remain visible in production.

**Detection:**
```bash
rg -n "console\\.(log|debug|info|warn|error)" src --glob "*.ts" --glob "*.vue" --glob "!src/utils/logger.ts"
rg -n "logger\\.debug.*\\[fetchMatches\\]|logger\\.debug.*\\[adaptBracketsMatch\\]" src/stores/matches.ts src/stores/bracketMatchAdapter.ts
```

---

### CP-102: SPA Hosting Rewrites Must Exclude Built Assets And Service Worker Files

| Field | Value |
|-------|-------|
| **Added** | 2026-04-16 |
| **Source Bug** | Stale custom-domain app shells rewrote deleted JS chunks to `index.html`, breaking tournament pages with module MIME errors |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

**Correct Pattern (✅):**
```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "!/assets/**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "!/assets/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      },
      {
        "source": "/assets/**",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

**Rule:** Firebase Hosting SPA rewrites must never catch built asset URLs. Use Hosting `source` globs/extglob for exclusions, not negative-lookahead regexes. Mutable app shell files must be `no-store`, while only hashed build assets under `/assets/**` may be cached immutably. Otherwise, deleted chunks can resolve to `index.html` and leave clients stuck on stale builds, and unsupported regex syntax can block deploys entirely.

**Detection:**
```bash
rg -n '"source": "!/assets/\\*\\*"' firebase.json
rg -n '"source": "!/assets/\\*\\*"|"source": "/assets/\\*\\*"' firebase.json
```

---

### CP-103: Firestore Bracket Stage References Must Be Compared As Normalized Strings

| Field | Value |
|-------|-------|
| **Added** | 2026-04-16 |
| **Source Bug** | MCIA 2026 Create Levels dialog loaded zero participants because pool stages, rounds, groups, and matches were filtered out when Firestore stage ids were string doc ids |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```ts
const poolStage = stages.find((stage) => Number(stage.id) === Number(category.poolStageId));
const matches = storedMatches.filter((match) => Number(match.stage_id) === Number(poolStage?.id));
const rounds = storedRounds.filter((round) => Number(round.stage_id ?? poolStage?.id) === Number(poolStage?.id));
```

**Correct Pattern (✅):**
```ts
function matchesStageId(
  candidate: number | string | null | undefined,
  expected: number | string | null | undefined
): boolean {
  const normalizedCandidate = candidate == null ? null : String(candidate);
  const normalizedExpected = expected == null ? null : String(expected);
  return normalizedCandidate !== null && normalizedCandidate === normalizedExpected;
}

const poolStage = stages.find((stage) => matchesStageId(stage.id, category.poolStageId));
const matches = storedMatches.filter((match) => matchesStageId(match.stage_id, poolStage?.id));
const rounds = storedRounds.filter((round) => matchesStageId(round.stage_id ?? poolStage?.id, poolStage?.id));
```

**Rule:** Bracket stage ids coming from Firestore may be numeric, numeric strings, or opaque document ids. Never coerce stage references with `Number(...)` when joining stages, rounds, groups, and matches. Normalize both sides to strings so seeded emulator data and production data resolve the same pool stage.

**Detection:**
```bash
rg -n "Number\\(stage\\.id\\).*poolStageId|Number\\(category\\.poolStageId\\)|Number\\(match\\.stage_id\\)|Number\\(.*stage_id.*\\) ===" src --glob "*.ts"
```

---

### CP-104: Snapshot Form Overrides Before Optimistic Store Updates Trigger Rehydration Watchers

| Field | Value |
|-------|-------|
| **Added** | 2026-04-16 |
| **Source Bug** | Tournament settings saved the tournament doc first, the view watcher rehydrated category scoring from stale store data, and category override writes persisted the old defaults while showing a success toast |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```ts
async function saveSettings() {
  await tournamentStore.updateTournament(tournamentId.value, {
    settings: settings.value,
  });

  await Promise.all(
    categories.value.map((category) =>
      tournamentStore.updateCategory(tournamentId.value, category.id, {
        scoringOverrideEnabled: categoryScoringOverrides.value[category.id].enabled,
        scoringConfig: categoryScoringOverrides.value[category.id].config,
      })
    )
  );
}
```

**Correct Pattern (✅):**
```ts
async function saveSettings() {
  const categoriesToSave = [...categories.value];
  const scoringOverridesSnapshot = cloneOverrideRecord(categoryScoringOverrides.value);

  await tournamentStore.updateTournament(tournamentId.value, {
    settings: settings.value,
  });

  await Promise.all(
    categoriesToSave.map((category) =>
      tournamentStore.updateCategory(tournamentId.value, category.id, {
        scoringOverrideEnabled: scoringOverridesSnapshot[category.id].enabled,
        scoringConfig: scoringOverridesSnapshot[category.id].config,
      })
    )
  );
}
```

**Rule:** If a save flow updates store-backed documents in multiple phases and the view has watchers that rehydrate local form state from that store, snapshot the local form state before the first optimistic store mutation. Never read the mutable form refs again after an awaited store update that can trigger rehydration.

**Detection:**
```bash
rg -n "updateTournament\\([^\\n]*\\)[\\s\\S]{0,600}updateCategory\\(" src/features --glob "*.vue"
```

---

### CP-105: Court Release Flows Must Upsert `match_scores` And Respect Explicit `courtId: null`

| Field | Value |
|-------|-------|
| **Added** | 2026-04-16 |
| **Source Bug** | Match Control release-court failed with `FirebaseError: No document to update` and left stale court cards because ready matches can exist in `/match` before `/match_scores/{matchId}` is created |
| **Severity** | High |
| **Status** | ✅ Active |

**Anti-Pattern (❌):**
```ts
const matchUpdate = {
  courtId: null,
  status: 'ready',
  updatedAt: serverTimestamp(),
};

batch.update(doc(db, matchScoresPath, matchId), matchUpdate);

if (scoreData.courtId) {
  updated.courtId = scoreData.courtId as string;
}
```

**Correct Pattern (✅):**
```ts
const matchUpdate = {
  tournamentId,
  courtId: null,
  status: 'ready',
  updatedAt: serverTimestamp(),
};

batch.set(doc(db, matchScoresPath, matchId), matchUpdate, { merge: true });

if (Object.prototype.hasOwnProperty.call(scoreData, 'courtId')) {
  updated.courtId = typeof scoreData.courtId === 'string'
    ? scoreData.courtId
    : undefined;
}
```

**Rule:** Match Control release, unschedule, and similar operational transitions must not assume a `/match_scores/{matchId}` document already exists. Use merge writes when a transition may be the first operational write for that match. When applying Firestore overlay data, treat an explicit `courtId: null` as authoritative so local state clears stale court assignments.

**Detection:**
```bash
rg -n "batch\\.update\\(doc\\(db, matchScoresPath, matchId\\)|if \\(scoreData\\.courtId\\)" src/stores/matches.ts
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
