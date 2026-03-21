# Testing Patterns

**Analysis Date:** 2026-03-21

## Test Framework

**Runner:**
- Vitest `^4.0.18`
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect` for unit and integration tests in `tests/`
- Playwright `expect` for browser tests in `e2e/`

**Run Commands:**
```bash
npm run test -- --run              # Run Vitest once
npm run test                       # Watch mode
npm run test:coverage              # Coverage report
npm run test:log -- --run          # Logged Vitest run with fingerprint support
npx playwright test                # Full E2E suite
npm run verify:release             # Release catalog + Vitest + Playwright verification
```

## Test File Organization

**Location:**
- Unit tests live in `tests/unit/*.test.ts`.
- Integration tests live in `tests/integration/*.integration.test.ts`.
- Shared Vitest setup lives in `tests/setup/browser-storage.ts`.
- Integration helper fixtures live in `tests/integration/setup/`.
- Browser tests live in `e2e/*.spec.ts` with helpers in `e2e/fixtures/`, `e2e/models/`, and `e2e/utils/`.

**Naming:**
- Unit and integration tests use `.test.ts`.
- Cross-boundary integration files usually include `.integration.test.ts`, for example `tests/integration/match-assignment.integration.test.ts`.
- Playwright files use `.spec.ts`; auth bootstrapping uses `.setup.ts` in `e2e/auth.setup.ts`.

**Structure:**
```text
tests/
  setup/
    browser-storage.ts
  unit/
    *.test.ts
  integration/
    *.integration.test.ts
    setup/
      auth-fixtures.ts
      emulator.ts
      firestore-fixtures.ts
e2e/
  *.spec.ts
  auth.setup.ts
  fixtures/
  models/
  utils/
```

## Test Structure

**Suite Organization:**
```typescript
const runtime = {
  route: { path: '/', meta: { requiresAuth: false } },
};

const mockDeps = vi.hoisted(() => ({
  routerPush: vi.fn(),
  fetchTournament: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => runtime.route,
  useRouter: () => ({ push: mockDeps.routerPush }),
}));

describe('feature name', () => {
  beforeEach(() => {
    mockDeps.routerPush.mockReset();
    mockDeps.fetchTournament.mockReset().mockResolvedValue(undefined);
  });

  it('renders or mutates expected state', async () => {
    const wrapper = shallowMount(ComponentUnderTest, { global: { stubs: [...] } });
    await flushPromises();
    expect(mockDeps.fetchTournament).toHaveBeenCalled();
    wrapper.unmount();
  });
});
```

**Patterns:**
- Most test files declare `runtime` or `runtimeState` objects near the top so individual tests can mutate route, auth role, or fixture data without re-registering mocks. See `tests/unit/AppLayout.publicFooter.test.ts` and `tests/integration/match-assignment.integration.test.ts`.
- Shared mocked functions are usually created with `vi.hoisted(...)` so `vi.mock(...)` can reference them safely before module evaluation. This pattern is dominant in store and integration tests such as `tests/unit/tournaments.store.test.ts` and `tests/unit/notifications.store.test.ts`.
- Component tests favor `shallowMount(...)` with large `global.stubs` arrays for Vuetify-heavy UIs. Use full `mount(...)` only when component behavior depends on actual slots, emitted events, or mounted reactive logic. See `tests/unit/BaseDialog.test.ts`, `tests/unit/AppLayout.publicFooter.test.ts`, and `tests/unit/TournamentPublicShell.test.ts`.
- Composable tests often mount a minimal harness component and capture the composable return value from `setup()`. See `tests/unit/useFrontDeskCheckInWorkflow.test.ts` and `tests/integration/checkin.integration.test.ts`.
- Store tests initialize a real Pinia instance with `setActivePinia(createPinia())` instead of `createTestingPinia`. See `tests/unit/tournaments.store.test.ts` and `tests/unit/notifications.store.test.ts`.
- Time-sensitive tests use `vi.useFakeTimers()` and `vi.setSystemTime(...)` to keep undo windows, deadlines, and duration logic deterministic. See `tests/unit/useFrontDeskCheckInWorkflow.test.ts`.

## Mocking

**Framework:** Vitest `vi.mock`, `vi.hoisted`, `vi.fn`, `vi.stubGlobal`

**Patterns:**
```typescript
const mockDeps = vi.hoisted(() => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
}));

vi.mock('@/services/firebase', () => ({
  db: { __mock: true },
  collection: mockDeps.collection,
  getDocs: mockDeps.getDocs,
  onSnapshot: mockDeps.onSnapshot,
}));

beforeEach(() => {
  setActivePinia(createPinia());
  mockDeps.getDocs.mockReset();
});
```

```typescript
vi.mock('vuetify', () => ({
  useDisplay: () => ({
    smAndDown: { value: false },
    mdAndDown: { value: false },
  }),
}));

vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
});
```

**What to Mock:**
- The Firebase wrapper module at `@/services/firebase` in unit and store tests. This is the standard seam for Firestore, Auth, Functions, and snapshot listeners. See `tests/unit/tournaments.store.test.ts`, `tests/unit/notifications.store.test.ts`, and `tests/integration/match-assignment.integration.test.ts`.
- Other Pinia stores, Vue Router hooks, and composables when the test scope is a single component or store. See `tests/unit/AppLayout.publicFooter.test.ts`, `tests/unit/PublicScoringView.test.ts`, and `tests/integration/public-views.integration.test.ts`.
- Browser-only dependencies such as `localStorage`, `html2canvas`, and Vuetify display injection when those APIs are incidental to the behavior under test. See `tests/unit/AppLayout.publicFooter.test.ts` and `tests/unit/TournamentAnnouncementCardDialog.test.ts`.

**What NOT to Mock:**
- Pure helper logic that is the actual subject of the test. `tests/unit/useAsyncOperation.test.ts` and `tests/unit/useFrontDeskCheckInWorkflow.test.ts` exercise real implementations rather than mocking the module under test.
- Playwright browser flows in `e2e/`. Those run against the real app, local dev server, and Firebase emulators configured by `playwright.config.ts` and `e2e/auth.setup.ts`.
- Release-catalog verification paths. `tests/unit/test-catalog.inventory.test.ts` uses the real inventory collector and real catalog data instead of stubbing the filesystem walk.

## Fixtures and Factories

**Test Data:**
```typescript
const makeRegistration = (id: string): Registration => ({
  id,
  tournamentId: 't1',
  categoryId: 'cat-1',
  participantType: 'player',
  playerId: `p-${id}`,
  status: 'approved',
  registeredBy: 'admin-1',
  registeredAt: new Date('2026-02-27T09:00:00.000Z'),
});
```

**Location:**
- Many unit and integration files keep small inline builders close to the assertions, for example `makeRegistration` and `makeMatch` in `tests/integration/public-views.integration.test.ts`.
- Emulator-oriented helpers are centralized in `tests/integration/setup/firestore-fixtures.ts` and `tests/integration/setup/auth-fixtures.ts`.
- E2E setup seeds a tournament and stores the generated ID in `e2e/.test-data.json` from `e2e/auth.setup.ts`; browser tests read it through helpers like `e2e/utils/test-data.ts`.
- Feature-specific browser scenarios are factored into `e2e/utils/workflow-scenarios.ts` and `e2e/utils/lifecycle-scenarios.ts`.

## Coverage

**Requirements:** No numeric coverage threshold is enforced in `vitest.config.ts`. Release readiness is enforced through the catalog-based verification flow in `docs/testing/test-catalog.json`, `scripts/testing/verify-release.mjs`, and `scripts/testing/generate-test-catalog-report.mjs`.

**View Coverage:**
```bash
npm run test:coverage
npm run report:tests
```

## Test Types

**Unit Tests:**
- Focus on stores, composables, isolated views, and script utilities with mocked dependencies. Examples: `tests/unit/notifications.store.test.ts`, `tests/unit/useAsyncOperation.test.ts`, and `tests/unit/BaseDialog.test.ts`.

**Integration Tests:**
- Validate behavior across multiple stores, composables, or views while still controlling infrastructure seams. Most use mocked Firebase/store boundaries but real domain orchestration. Examples: `tests/integration/match-assignment.integration.test.ts`, `tests/integration/public-views.integration.test.ts`, and `tests/integration/checkin.integration.test.ts`.
- Some integration support files allow emulator-backed document setup when a broader fixture is needed, via `tests/integration/setup/firestore-fixtures.ts`.

**E2E Tests:**
- Playwright is the real browser layer. Config lives in `playwright.config.ts`, auth bootstrapping in `e2e/auth.setup.ts`, common auth fixture extension in `e2e/fixtures/auth-fixtures.ts`, and page objects in `e2e/models/`.
- The suite runs serially with one worker because the emulator-backed flows mutate shared state. Local execution starts both the Firebase emulator and Vite dev server from `playwright.config.ts`.
- Agent-browser scripts in `scripts/agent-browser.sh` provide an additional manual verification/debug path alongside Playwright.

## Verification Workflow

**Branch and Merge Gates:**
- `docs/process/BRANCHING_STRATEGY.md` requires narrow short-lived branches and verification before merge.
- `docs/process/TEST_STRATEGY.md` defines the default branch gate as targeted Vitest, logged Vitest, `npm run check:firebase-env`, `npm run build`, and `npm run build:log`.

**Release Verification:**
- `npm run verify:release` runs the catalog resolver plus Vitest and Playwright through `scripts/testing/verify-release.mjs`.
- Successful release verification regenerates `docs/testing/TEST_CATALOG.md`, `docs/testing/TEST_CATALOG.html`, and `docs/testing/test-run-summary.json` through `scripts/testing/generate-test-catalog-report.mjs`.
- Production deploy evidence is recorded in `docs/deployment/LAST_DEPLOY.md`.

**Logged Commands and Failure Handling:**
- Use the `:log` variants in `package.json` for traceable failures: `npm run test:log`, `npm run lint:log`, `npm run build:log`, and `npm run deploy:log`.
- `scripts/run-and-log.mjs` writes command output to `docs/debug-kb/_artifacts/` and prints a normalized fingerprint on failure.
- Known fingerprints are cataloged in `docs/debug-kb/index.yml`; this is part of the normal verification workflow, not an exceptional one-off process.

## Common Patterns

**Async Testing:**
```typescript
const wrapper = shallowMount(PublicScoringView, {
  global: { stubs: commonStubs },
});

await flushPromises();
expect(mockDeps.fetchTournament).toHaveBeenCalled();
wrapper.unmount();
```

```typescript
await expect.poll(() => page.url(), { timeout: 15000 }).toMatch(POST_LOGIN_URL_RE);
```

**Error Testing:**
```typescript
await expect(
  store.assignMatchToCourt('t1', 'm1', 'court-1', 'cat-1', undefined, {
    ignoreCheckInGate: true,
  })
).rejects.toThrow(/Only admins/i);
```

```typescript
try {
  await execute(operation);
} catch (err) {
  // Expected to throw
}
expect(error.value).toBe('Test error');
```

---

*Testing analysis: 2026-03-21*
