# Volunteer PIN Access Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add tournament-scoped PIN access for check-in and scorekeeper volunteers with dedicated shells, callable-verified write operations, admin PIN management in tournament settings, and player-safe public registration.

**Architecture:** Keep the existing Firebase account flow for staff users. Add Cloud Functions that encrypt and reveal tournament-local PINs, mint short-lived signed volunteer session tokens, and authorize volunteer write operations without routing volunteers through the normal login flow. On the frontend, add a volunteer access store, new volunteer routes/layouts, and volunteer-aware mutation paths that reuse the existing check-in and scoring views where possible.

**Tech Stack:** Vue 3 `<script setup lang="ts">`, Vuetify 3, Pinia, Vue Router, Firebase Firestore, Firebase Cloud Functions, Node `crypto`, Vitest, Playwright.

---

## Guardrails

1. Read `docs/coding-patterns/CODING_PATTERNS.md` before each task.
2. Apply @test-driven-development on every code task.
3. If any `:log` command fails, follow the Debug KB Protocol in `AGENTS.md`.
4. Do not add dependencies.
5. Keep Firestore rule changes out of phase one unless a later task proves callable-only volunteer writes are insufficient. If rules become unavoidable, isolate that work in its own task and commit.
6. Run `npm run build:log` after each code task to satisfy the repo gate.

---

## Task 1: Lock Public Registration To Player-Safe Signup

**Files:**
- Modify: `src/features/auth/views/RegisterView.vue`
- Modify: `e2e/user-registration.spec.ts`
- Create: `tests/unit/RegisterView.test.ts`

**Step 1: Write the failing unit test**

```typescript
import { mount } from '@vue/test-utils';
import RegisterView from '@/features/auth/views/RegisterView.vue';

it('does not expose organizer or scorekeeper roles in public signup', () => {
  const wrapper = mount(RegisterView, {
    global: {
      stubs: ['router-link'],
      mocks: {
        $router: { push: vi.fn() },
      },
    },
  });

  expect(wrapper.text()).toContain('Player');
  expect(wrapper.text()).not.toContain('Tournament Organizer');
  expect(wrapper.text()).not.toContain('Scorekeeper');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- --run tests/unit/RegisterView.test.ts`  
Expected: FAIL because privileged role labels are still rendered.

**Step 3: Write minimal implementation**

```typescript
const selectedRole = ref<UserRole>('player');

const roleOptions = [
  { title: 'Player', value: 'player', description: 'Participate in tournaments' },
];
```

```vue
<v-alert type="info" variant="tonal" class="mb-3">
  Player accounts are created here. Staff and volunteer access is issued from tournament settings.
</v-alert>
```

Remove the public ability to self-select organizer and scorekeeper roles. If the select becomes meaningless with one option, replace it with explanatory copy and keep `selectedRole` fixed to `'player'`.

**Step 4: Update the E2E expectation**

Replace the role-selector assertion in `e2e/user-registration.spec.ts` with a player-safe assertion:

```typescript
await expect(page.getByText(/player accounts are created here/i)).toBeVisible();
await expect(page.getByText(/tournament organizer/i)).toHaveCount(0);
await expect(page.getByText(/scorekeeper/i)).toHaveCount(0);
```

**Step 5: Run verification**

Run: `npm run test:log -- --run tests/unit/RegisterView.test.ts e2e/user-registration.spec.ts`  
Expected: unit test PASS, Playwright spec PASS when app/emulators are running.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 6: Commit**

```bash
git add src/features/auth/views/RegisterView.vue tests/unit/RegisterView.test.ts e2e/user-registration.spec.ts
git commit -m "fix(auth): limit public signup to player accounts"
```

---

## Task 2: Add Volunteer Access Core Helpers And Callable Surface

**Files:**
- Create: `functions/src/volunteerAccessCore.ts`
- Create: `functions/src/volunteerAccess.ts`
- Modify: `functions/src/index.ts`
- Modify: `functions/src/types.ts`
- Create: `tests/unit/volunteerAccessCore.test.ts`

**Step 1: Write the failing unit tests for the pure core helpers**

```typescript
import {
  encryptPin,
  decryptPin,
  issueVolunteerSessionToken,
  verifyVolunteerSessionToken,
} from '../../functions/src/volunteerAccessCore';

it('round-trips an encrypted PIN', () => {
  const encrypted = encryptPin('4829', 'pin-secret-123456789012345678901234');
  expect(decryptPin(encrypted, 'pin-secret-123456789012345678901234')).toBe('4829');
});

it('rejects tampered volunteer session tokens', () => {
  const token = issueVolunteerSessionToken({
    tournamentId: 't1',
    role: 'checkin',
    pinRevision: 3,
    expiresAtMs: Date.now() + 60_000,
  }, 'session-secret');

  expect(() => verifyVolunteerSessionToken(`${token}x`, 'session-secret')).toThrow(/invalid/i);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- --run tests/unit/volunteerAccessCore.test.ts`  
Expected: FAIL because the module does not exist yet.

**Step 3: Implement the pure crypto and token helpers**

Use Node `crypto` only. Keep the pure helpers Firebase-free so they are unit-testable.

```typescript
export interface VolunteerSessionPayload {
  tournamentId: string;
  role: 'checkin' | 'scorekeeper';
  pinRevision: number;
  issuedAtMs: number;
  expiresAtMs: number;
}

export function encryptPin(pin: string, secret: string): string { /* AES-GCM */ }
export function decryptPin(ciphertext: string, secret: string): string { /* AES-GCM */ }
export function issueVolunteerSessionToken(payload: VolunteerSessionPayload, secret: string): string { /* HMAC signed */ }
export function verifyVolunteerSessionToken(token: string, secret: string): VolunteerSessionPayload { /* signature + expiry */ }
```

**Step 4: Implement callable wrappers**

In `functions/src/volunteerAccess.ts`, add staff-only callables:

1. `setVolunteerPin`
2. `revealVolunteerPin`
3. `issueVolunteerSession`

Suggested callable contract:

```typescript
export const setVolunteerPin = functions.https.onCall(async (request) => {
  // require request.auth and organizer/admin authorization
  // validate role, pin length, and tournament access
  // encrypt pin, bump pinRevision, persist volunteerAccess.<role>
  // return masked state only
});
```

```typescript
export const issueVolunteerSession = functions.https.onCall(async (request) => {
  // no request.auth required
  // validate tournamentId, role, pin
  // decrypt stored PIN, compare, issue signed short-lived session token
  // return { sessionToken, expiresAtMs, pinRevision }
});
```

Store revealable PINs encrypted at rest. Do not log decrypted PINs.

**Step 5: Export the new callables**

In `functions/src/index.ts`:

```typescript
import {
  setVolunteerPin as setVolunteerPinFn,
  revealVolunteerPin as revealVolunteerPinFn,
  issueVolunteerSession as issueVolunteerSessionFn,
} from './volunteerAccess';

export const setVolunteerPin = setVolunteerPinFn;
export const revealVolunteerPin = revealVolunteerPinFn;
export const issueVolunteerSession = issueVolunteerSessionFn;
```

**Step 6: Run verification**

Run: `npm run test:log -- --run tests/unit/volunteerAccessCore.test.ts`  
Expected: PASS.

Run: `npm --prefix functions run build:log`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 7: Commit**

```bash
git add functions/src/volunteerAccessCore.ts functions/src/volunteerAccess.ts functions/src/index.ts functions/src/types.ts tests/unit/volunteerAccessCore.test.ts
git commit -m "feat(volunteer): add PIN crypto and session callables"
```

---

## Task 3: Add Frontend Volunteer Session Store, Routes, And Layout Split

**Files:**
- Create: `src/stores/volunteerAccess.ts`
- Create: `src/components/layout/VolunteerLayout.vue`
- Create: `src/features/volunteer/views/VolunteerAccessView.vue`
- Modify: `src/App.vue`
- Modify: `src/router/index.ts`
- Modify: `src/types/index.ts`
- Modify: `src/types/router-meta.d.ts`
- Modify: `src/types/router-meta.contracts.ts`
- Modify: `tests/unit/helpers/store-mocks.ts`
- Modify: `tests/unit/router-guards-auth.test.ts`
- Create: `tests/unit/volunteerAccessStore.test.ts`
- Create: `tests/unit/VolunteerAccessView.test.ts`

**Step 1: Write the failing store and route tests**

```typescript
it('persists a volunteer session for the matching tournament and role', async () => {
  const store = useVolunteerAccessStore();
  store.setSession({
    tournamentId: 't1',
    role: 'checkin',
    sessionToken: 'signed-token',
    expiresAtMs: Date.now() + 60_000,
    pinRevision: 1,
  });

  expect(store.isActiveFor('t1', 'checkin')).toBe(true);
  expect(store.isActiveFor('t1', 'scorekeeper')).toBe(false);
});
```

```typescript
it('redirects volunteer shell routes to PIN entry when no session is present', async () => {
  const result = await runGuard('/tournaments/t1/checkin-kiosk', { isAuthenticated: false });
  expect(result.fullPath).toContain('/tournaments/t1/checkin-access');
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:log -- --run tests/unit/volunteerAccessStore.test.ts tests/unit/router-guards-auth.test.ts tests/unit/VolunteerAccessView.test.ts`  
Expected: FAIL because the store, route meta, and view do not exist yet.

**Step 3: Implement the volunteer access store**

Suggested state:

```typescript
export interface VolunteerSessionState {
  tournamentId: string;
  role: 'checkin' | 'scorekeeper';
  sessionToken: string;
  expiresAtMs: number;
  pinRevision: number;
}
```

Suggested methods:

```typescript
async function issueSession(tournamentId: string, role: VolunteerAccessRole, pin: string): Promise<void> { /* httpsCallable('issueVolunteerSession') */ }
function setSession(session: VolunteerSessionState): void { /* localStorage */ }
function clearSession(): void {}
function isActiveFor(tournamentId: string, role: VolunteerAccessRole): boolean {}
```

**Step 4: Add volunteer route meta and layout switching**

Add route meta:

```typescript
volunteerShell?: boolean;
volunteerRole?: 'checkin' | 'scorekeeper';
```

Add routes:

1. `/tournaments/:tournamentId/checkin-access`
2. `/tournaments/:tournamentId/checkin-kiosk`
3. `/tournaments/:tournamentId/scoring-access`
4. `/tournaments/:tournamentId/scoring-kiosk`
5. `/tournaments/:tournamentId/scoring-kiosk/matches/:matchId/score`

In `src/App.vue`, switch layout by route meta:

```vue
<VolunteerLayout v-else-if="isVolunteerRoute" />
<AppLayout v-else-if="!isLoading" />
```

`VolunteerLayout.vue` should render only a compact header, exit button, and `router-view`.

**Step 5: Implement the reusable PIN entry page**

`VolunteerAccessView.vue` should:

1. read tournament ID and target role from route,
2. collect a 4-6 digit PIN,
3. call `issueSession`,
4. redirect to the kiosk landing route on success,
5. surface role-specific blocked/invalid/error messages.

**Step 6: Run verification**

Run: `npm run test:log -- --run tests/unit/volunteerAccessStore.test.ts tests/unit/VolunteerAccessView.test.ts tests/unit/router-guards-auth.test.ts`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 7: Commit**

```bash
git add src/stores/volunteerAccess.ts src/components/layout/VolunteerLayout.vue src/features/volunteer/views/VolunteerAccessView.vue src/App.vue src/router/index.ts src/types/index.ts src/types/router-meta.d.ts src/types/router-meta.contracts.ts tests/unit/helpers/store-mocks.ts tests/unit/router-guards-auth.test.ts tests/unit/volunteerAccessStore.test.ts tests/unit/VolunteerAccessView.test.ts
git commit -m "feat(volunteer): add session store and kiosk routes"
```

---

## Task 4: Add Tournament Settings Volunteer Access Management

**Files:**
- Create: `src/features/tournaments/components/VolunteerAccessPanel.vue`
- Modify: `src/features/tournaments/views/TournamentSettingsView.vue`
- Create: `tests/unit/VolunteerAccessPanel.test.ts`
- Modify: `e2e/p0-tournament-settings.spec.ts`

**Step 1: Write the failing component test**

```typescript
it('reveals, masks, and resets the check-in PIN from tournament settings', async () => {
  const revealPin = vi.fn().mockResolvedValue('4829');
  const resetPin = vi.fn().mockResolvedValue({ maskedPin: '••••', pinRevision: 2 });

  const wrapper = mount(VolunteerAccessPanel, {
    props: { tournamentId: 't1' },
    global: {
      provide: { /* mocked store methods */ },
    },
  });

  await wrapper.get('[data-testid="reveal-checkin-pin"]').trigger('click');
  expect(revealPin).toHaveBeenCalledWith('t1', 'checkin');
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- --run tests/unit/VolunteerAccessPanel.test.ts`  
Expected: FAIL because the panel does not exist yet.

**Step 3: Build the panel and wire settings**

The panel should show:

1. masked PIN display by default,
2. reveal button,
3. reset button,
4. enable/disable toggle,
5. direct link copy button,
6. last updated timestamp.

Minimal component contract:

```vue
<VolunteerAccessPanel
  :tournament-id="tournamentId"
  role="checkin"
  access-label="Check-in"
/>
```

Use the volunteer access store for:

```typescript
await volunteerAccessStore.loadAdminState(tournamentId);
await volunteerAccessStore.setPin(tournamentId, 'checkin', pin);
await volunteerAccessStore.revealPin(tournamentId, 'checkin');
await volunteerAccessStore.resetPin(tournamentId, 'checkin');
```

**Step 4: Extend the Playwright tournament settings spec**

Add a test that:

1. opens tournament settings,
2. finds the volunteer access section,
3. resets a PIN,
4. verifies masked output and success toast,
5. copies the direct link.

**Step 5: Run verification**

Run: `npm run test:log -- --run tests/unit/VolunteerAccessPanel.test.ts e2e/p0-tournament-settings.spec.ts`  
Expected: unit PASS, E2E PASS when app/emulators are running.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 6: Commit**

```bash
git add src/features/tournaments/components/VolunteerAccessPanel.vue src/features/tournaments/views/TournamentSettingsView.vue tests/unit/VolunteerAccessPanel.test.ts e2e/p0-tournament-settings.spec.ts
git commit -m "feat(settings): manage volunteer PIN access from tournament settings"
```

---

## Task 5: Route Check-In Kiosk Mutations Through Volunteer Callables

**Files:**
- Modify: `functions/src/volunteerAccess.ts`
- Modify: `src/stores/registrations.ts`
- Modify: `src/features/checkin/views/FrontDeskCheckInView.vue`
- Modify: `tests/unit/FrontDeskCheckInView.test.ts`
- Modify: `tests/integration/checkin.integration.test.ts`

**Step 1: Write the failing tests**

```typescript
it('uses volunteer mutation path when a check-in volunteer session is active', async () => {
  const volunteerStore = useVolunteerAccessStore();
  volunteerStore.setSession({
    tournamentId: 't1',
    role: 'checkin',
    sessionToken: 'signed-token',
    expiresAtMs: Date.now() + 60_000,
    pinRevision: 1,
  });

  await wrapper.vm.handleQuickCheckIn('reg-1');
  expect(mockVolunteerCallable).toHaveBeenCalled();
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:log -- --run tests/unit/FrontDeskCheckInView.test.ts tests/integration/checkin.integration.test.ts`  
Expected: FAIL because no volunteer mutation path exists.

**Step 3: Add callable-backed check-in operations**

In `functions/src/volunteerAccess.ts`, add a callable such as:

```typescript
export const submitVolunteerCheckInMutation = functions.https.onCall(async (request) => {
  // verify session token
  // enforce role === 'checkin'
  // allow actions: check_in, undo_check_in, assign_bib
  // write registration updates server-side
});
```

In `src/stores/registrations.ts`, branch on the volunteer session:

```typescript
if (volunteerAccessStore.isActiveFor(tournamentId, 'checkin')) {
  await volunteerAccessStore.submitCheckInMutation({
    tournamentId,
    action: 'check_in',
    registrationId,
  });
  return;
}
```

Keep existing organizer/admin behavior untouched when no volunteer session is active.

**Step 4: Make the front-desk view kiosk-aware**

Adjust `FrontDeskCheckInView.vue` so volunteer kiosk use:

1. does not render a dashboard back button,
2. relies on the volunteer layout for the exit affordance,
3. preserves existing success/error overlays.

Use a prop or store-derived `isVolunteerMode` flag instead of duplicating the page.

**Step 5: Run verification**

Run: `npm run test:log -- --run tests/unit/FrontDeskCheckInView.test.ts tests/integration/checkin.integration.test.ts`  
Expected: PASS.

Run: `npm --prefix functions run build:log`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 6: Commit**

```bash
git add functions/src/volunteerAccess.ts src/stores/registrations.ts src/features/checkin/views/FrontDeskCheckInView.vue tests/unit/FrontDeskCheckInView.test.ts tests/integration/checkin.integration.test.ts
git commit -m "feat(checkin): support volunteer PIN kiosk mutations"
```

---

## Task 6: Route Scorekeeper Kiosk Actions Through Volunteer Callables

**Files:**
- Modify: `functions/src/volunteerAccess.ts`
- Create: `src/features/scoring/views/ScorekeeperKioskView.vue`
- Modify: `src/features/scoring/views/ScoringInterfaceView.vue`
- Modify: `src/stores/matches.ts`
- Create: `tests/unit/ScorekeeperKioskView.test.ts`
- Modify: `e2e/scorekeeper-flow.spec.ts`

**Step 1: Write the failing tests**

```typescript
it('loads only scoring actions in the scorekeeper kiosk shell', () => {
  const wrapper = mount(ScorekeeperKioskView, { /* mocks */ });
  expect(wrapper.text()).toContain('Matches');
  expect(wrapper.text()).not.toContain('Tournament Settings');
  expect(wrapper.text()).not.toContain('Match Control');
});
```

```typescript
it('delegates score mutations to the volunteer callable when a scorekeeper session is active', async () => {
  await matchStore.updateScore('t1', 'm1', 'participant1', 'cat-1');
  expect(mockVolunteerScoreCallable).toHaveBeenCalledWith(expect.objectContaining({
    action: 'increment_point',
  }));
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:log -- --run tests/unit/ScorekeeperKioskView.test.ts`  
Expected: FAIL because the kiosk view and volunteer mutation path do not exist.

**Step 3: Add the backend scoring callable**

In `functions/src/volunteerAccess.ts` add:

```typescript
export const submitVolunteerScoreMutation = functions.https.onCall(async (request) => {
  // verify session token
  // enforce role === 'scorekeeper'
  // support start_match, increment_point, decrement_point, manual_score, walkover
  // reuse existing score update semantics from current match store / updateMatch logic
});
```

Keep the callable tournament-scoped by verifying the session payload tournament ID against the request payload.

**Step 4: Add frontend kiosk route usage**

1. Create `ScorekeeperKioskView.vue` as the volunteer landing page for scoring.
2. Reuse the existing match list and scoring interface where practical, but hide organizer-only navigation and back-to-dashboard actions.
3. In `src/stores/matches.ts`, branch to the volunteer callable when a scorekeeper session is active:

```typescript
if (volunteerAccessStore.isActiveFor(tournamentId, 'scorekeeper')) {
  await volunteerAccessStore.submitScoreMutation({
    tournamentId,
    matchId,
    action: 'increment_point',
    participant,
    categoryId,
    levelId,
  });
  return;
}
```

**Step 5: Run verification**

Run: `npm run test:log -- --run tests/unit/ScorekeeperKioskView.test.ts`  
Expected: PASS.

Run: `npm --prefix functions run build:log`  
Expected: PASS.

Run: `npm run test:log -- --run e2e/scorekeeper-flow.spec.ts`  
Expected: PASS when app/emulators are running.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 6: Commit**

```bash
git add functions/src/volunteerAccess.ts src/features/scoring/views/ScorekeeperKioskView.vue src/features/scoring/views/ScoringInterfaceView.vue src/stores/matches.ts tests/unit/ScorekeeperKioskView.test.ts e2e/scorekeeper-flow.spec.ts
git commit -m "feat(scoring): add volunteer scorekeeper kiosk flow"
```

---

## Task 7: Enforce Session Expiry, Reset Invalidation, And Kiosk Redirects

**Files:**
- Modify: `functions/src/volunteerAccess.ts`
- Modify: `src/stores/volunteerAccess.ts`
- Modify: `src/router/index.ts`
- Modify: `src/components/layout/VolunteerLayout.vue`
- Modify: `tests/unit/router-guards-auth.test.ts`
- Create: `e2e/p0-volunteer-pin-access.spec.ts`

**Step 1: Write the failing tests**

```typescript
it('redirects to access page when the volunteer session is expired', async () => {
  const store = useVolunteerAccessStore();
  store.setSession({
    tournamentId: 't1',
    role: 'checkin',
    sessionToken: 'expired-token',
    expiresAtMs: Date.now() - 1000,
    pinRevision: 1,
  });

  const result = await runGuard('/tournaments/t1/checkin-kiosk', { isAuthenticated: false });
  expect(result.fullPath).toContain('/tournaments/t1/checkin-access');
});
```

E2E flow:

1. admin resets scorekeeper PIN,
2. volunteer kiosk tries to continue with old session,
3. app forces return to PIN screen with a message.

**Step 2: Run tests to verify they fail**

Run: `npm run test:log -- --run tests/unit/router-guards-auth.test.ts e2e/p0-volunteer-pin-access.spec.ts`  
Expected: FAIL because expiry and revision invalidation are not enforced end-to-end yet.

**Step 3: Add verify-session callable and guard usage**

In `functions/src/volunteerAccess.ts` add:

```typescript
export const verifyVolunteerSession = functions.https.onCall(async (request) => {
  // verify token signature
  // load tournament volunteerAccess.<role>.pinRevision
  // reject mismatches and expired sessions
  // return normalized session payload
});
```

In `src/stores/volunteerAccess.ts`, add:

```typescript
async function verifyActiveSession(): Promise<boolean> {
  // call verifyVolunteerSession
  // clear session on failure
}
```

Use this guard in volunteer kiosk routes and on kiosk layout mount.

**Step 4: Run verification**

Run: `npm run test:log -- --run tests/unit/router-guards-auth.test.ts e2e/p0-volunteer-pin-access.spec.ts`  
Expected: PASS.

Run: `npm --prefix functions run build:log`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

**Step 5: Commit**

```bash
git add functions/src/volunteerAccess.ts src/stores/volunteerAccess.ts src/router/index.ts src/components/layout/VolunteerLayout.vue tests/unit/router-guards-auth.test.ts e2e/p0-volunteer-pin-access.spec.ts
git commit -m "feat(volunteer): enforce kiosk session invalidation and redirects"
```

---

## Task 8: Final Verification And Handoff

**Files:**
- Modify: `docs/plans/2026-03-11-volunteer-pin-access-design.md` (only if implementation reveals a necessary spec adjustment)
- Modify: `docs/debug-kb/*.md` (only if any `:log` command fails and needs KB handling)

**Step 1: Run the full required verification suite**

Run: `npm --prefix functions run build:log`  
Expected: PASS.

Run: `npm run test:log -- --run tests/unit/RegisterView.test.ts tests/unit/volunteerAccessCore.test.ts tests/unit/volunteerAccessStore.test.ts tests/unit/VolunteerAccessView.test.ts tests/unit/VolunteerAccessPanel.test.ts tests/unit/FrontDeskCheckInView.test.ts tests/unit/ScorekeeperKioskView.test.ts tests/unit/router-guards-auth.test.ts tests/integration/checkin.integration.test.ts`  
Expected: PASS.

Run: `npm run lint:log`  
Expected: PASS.

Run: `npm run build:log`  
Expected: PASS.

If Playwright environment is available:

Run: `npx playwright test e2e/user-registration.spec.ts e2e/p0-tournament-settings.spec.ts e2e/scorekeeper-flow.spec.ts e2e/p0-volunteer-pin-access.spec.ts`  
Expected: PASS.

**Step 2: Handle any fingerprints**

If any `:log` command fails:

1. capture the fingerprint,
2. search `docs/debug-kb/index.yml`,
3. apply existing fix if present,
4. otherwise create a KB entry from the template,
5. record one attempt per change.

**Step 3: Summarize implementation evidence**

Record:

1. files changed,
2. exact commands executed,
3. fingerprints handled,
4. KB files updated,
5. verification results.

**Step 4: Commit the final integrated state**

```bash
git add .
git commit -m "feat(volunteer): add tournament PIN kiosk access"
```

