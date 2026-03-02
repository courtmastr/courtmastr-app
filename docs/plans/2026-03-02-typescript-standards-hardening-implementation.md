# TypeScript Standards Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve TypeScript safety standards in production code (`src/`) across Check-in + Leaderboard, Routing/Guards/Auth, and core stores/services with no runtime behavior changes.

**Architecture:** Introduce a minimal shared advanced-type layer (branded IDs, result unions, narrow status unions), then harden each scoped feature in small TDD steps. Use compile-time contract tests for type utilities and runtime Vitest coverage for behavior invariance. Keep refactors local and incremental.

**Tech Stack:** Vue 3 + TypeScript (strict), Pinia, Vue Router, Firebase Firestore, Vitest, vue-tsc

---

## Execution Skills

- `@superpowers/test-driven-development`
- `@typescript-advanced-types`
- `@superpowers/verification-before-completion`

---

## Pre-flight

**Step 1: Confirm branch and working tree context**

```bash
git status --short --branch
```
Expected: on the working feature branch; unrelated dirty files may exist.

**Step 2: Baseline type-check**

```bash
npm run type-check
```
Expected: pass or only known baseline issues unrelated to this plan.

**Step 3: Baseline targeted tests**

```bash
npm run test:log -- --run tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/RapidCheckInPanel.test.ts tests/unit/leaderboard.test.ts tests/unit/router-guards-auth.test.ts tests/unit/alerts.store.test.ts tests/unit/audit.store.test.ts
```
Expected: green baseline before touching code.

---

### Task 1: Add Shared Advanced Type Primitives (Brand + Result + Contracts)

**Files:**
- Create: `src/types/advanced.ts`
- Modify: `src/types/index.ts`
- Create: `src/types/advanced.contracts.ts`

**Step 1: Write the failing type contract**

Create `src/types/advanced.contracts.ts`:

```ts
import type {
  Brand,
  TournamentId,
  CategoryId,
  RegistrationId,
  MatchId,
  Result,
} from '@/types/advanced';

type Assert<T extends true> = T;
type IsStringLike<T> = T extends string ? true : false;

type _brandExists = Assert<IsStringLike<Brand<string, 'X'>>>;
type _tournamentIdIsString = Assert<IsStringLike<TournamentId>>;
type _categoryIdIsString = Assert<IsStringLike<CategoryId>>;
type _registrationIdIsString = Assert<IsStringLike<RegistrationId>>;
type _matchIdIsString = Assert<IsStringLike<MatchId>>;

const okResult: Result<{ id: TournamentId }, 'not_found'> = {
  ok: true,
  data: { id: 't-1' as TournamentId },
};

const errResult: Result<never, 'not_found'> = {
  ok: false,
  error: 'not_found',
  message: 'Tournament missing',
};

void okResult;
void errResult;
```

**Step 2: Run type-check to verify failure**

```bash
npm run type-check
```
Expected: FAIL with module/type errors for `@/types/advanced` (file/types missing).

**Step 3: Write minimal implementation**

Create `src/types/advanced.ts`:

```ts
export type Brand<T, TBrand extends string> = T & { readonly __brand: TBrand };

export type TournamentId = Brand<string, 'TournamentId'>;
export type CategoryId = Brand<string, 'CategoryId'>;
export type RegistrationId = Brand<string, 'RegistrationId'>;
export type MatchId = Brand<string, 'MatchId'>;

export type Result<T, E extends string = string> =
  | { ok: true; data: T }
  | { ok: false; error: E; message: string };
```

Modify `src/types/index.ts`:

```ts
export type {
  Brand,
  TournamentId,
  CategoryId,
  RegistrationId,
  MatchId,
  Result,
} from '@/types/advanced';
```

**Step 4: Verify**

```bash
npm run type-check
```
Expected: PASS for this task changes.

**Step 5: Commit**

```bash
git add src/types/advanced.ts src/types/advanced.contracts.ts src/types/index.ts
git commit -m "refactor(types): add branded ids and result union primitives"
```

---

### Task 2: Harden Check-in Type Contracts with Shared Domain Types

**Files:**
- Create: `src/features/checkin/composables/checkInTypes.ts`
- Modify: `src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts`
- Modify: `src/features/checkin/components/RapidCheckInPanel.vue`
- Modify: `src/features/checkin/views/FrontDeskCheckInView.vue`
- Create: `tests/unit/checkInTypes.test.ts`
- Modify: `tests/unit/useFrontDeskCheckInWorkflow.test.ts`

**Step 1: Write failing test for new check-in type guards/helpers**

Create `tests/unit/checkInTypes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  isCheckInSearchableStatus,
  toCheckInStatus,
} from '@/features/checkin/composables/checkInTypes';

describe('checkInTypes', () => {
  it('accepts only searchable statuses', () => {
    expect(isCheckInSearchableStatus('approved')).toBe(true);
    expect(isCheckInSearchableStatus('checked_in')).toBe(true);
    expect(isCheckInSearchableStatus('no_show')).toBe(true);
    expect(isCheckInSearchableStatus('pending')).toBe(false);
  });

  it('normalizes invalid statuses to null', () => {
    expect(toCheckInStatus('approved')).toBe('approved');
    expect(toCheckInStatus('rejected')).toBeNull();
  });
});
```

**Step 2: Run test to verify failure**

```bash
npm run test:log -- --run tests/unit/checkInTypes.test.ts
```
Expected: FAIL because `checkInTypes.ts` does not exist yet.

**Step 3: Implement typed check-in domain module and wire it**

Create `src/features/checkin/composables/checkInTypes.ts`:

```ts
import type { Registration } from '@/types';
import type { RegistrationId } from '@/types/advanced';

export type CheckInStatus = Extract<Registration['status'], 'approved' | 'checked_in' | 'no_show'>;

export interface CheckInSearchRow {
  id: RegistrationId | string;
  name: string;
  category: string;
  status: CheckInStatus;
}

export const isCheckInSearchableStatus = (status: Registration['status']): status is CheckInStatus =>
  status === 'approved' || status === 'checked_in' || status === 'no_show';

export const toCheckInStatus = (status: Registration['status']): CheckInStatus | null =>
  isCheckInSearchableStatus(status) ? status : null;
```

Refactor check-in files to import shared `CheckInStatus`/`CheckInSearchRow` and replace duplicated status/type aliases.

**Step 4: Verify**

```bash
npm run test:log -- --run tests/unit/checkInTypes.test.ts tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/RapidCheckInPanel.test.ts tests/unit/FrontDeskCheckInView.test.ts
npm run type-check
```
Expected: all pass.

**Step 5: Commit**

```bash
git add src/features/checkin/composables/checkInTypes.ts src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts src/features/checkin/components/RapidCheckInPanel.vue src/features/checkin/views/FrontDeskCheckInView.vue tests/unit/checkInTypes.test.ts tests/unit/useFrontDeskCheckInWorkflow.test.ts
git commit -m "refactor(checkin): centralize typed check-in status and search row contracts"
```

---

### Task 3: Replace `any` in Leaderboard Match Resolution with Typed Source Docs

**Files:**
- Modify: `src/composables/useLeaderboard.ts`
- Modify: `src/types/leaderboard.ts`
- Create: `tests/unit/leaderboard-source-docs.test.ts`
- Modify: `tests/unit/leaderboard.test.ts`

**Step 1: Write failing test for source-doc resolver behavior with typed docs**

Create `tests/unit/leaderboard-source-docs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveMatches } from '@/composables/useLeaderboard';

const participants = [
  { id: 1, name: 'reg-1' },
  { id: 2, name: 'reg-2' },
];

describe('resolveMatches source-doc typing', () => {
  it('drops matches when participants cannot be resolved', () => {
    const result = resolveMatches(
      'cat-1',
      participants,
      [{ id: 'm-1', opponent1: { id: 1 }, opponent2: { id: 999 }, round: 1 }],
      [{ id: 'm-1', winnerId: 'reg-1', status: 'completed', scores: [] }]
    );

    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test to verify failure**

```bash
npm run test:log -- --run tests/unit/leaderboard-source-docs.test.ts
```
Expected: FAIL initially due unresolved typing/contracts until source doc types are introduced.

**Step 3: Implement typed source docs**

In `src/types/leaderboard.ts`, add explicit source doc types:

```ts
export interface LeaderboardParticipantDoc {
  id: string | number;
  name: string;
}

export interface LeaderboardMatchDoc {
  id: string;
  round?: number;
  bracket?: 'winners' | 'losers' | 'finals';
  opponent1?: { id?: string | number; registrationId?: string };
  opponent2?: { id?: string | number; registrationId?: string };
}

export interface LeaderboardMatchScoreDoc {
  id: string;
  winnerId?: string;
  status?: string;
  scores?: Array<{ score1: number; score2: number; isComplete?: boolean; winnerId?: string }>;
  completedAt?: { toDate?: () => Date } | Date;
}
```

In `src/composables/useLeaderboard.ts`, change `resolveMatches` signature from `any[]` to these new interfaces and remove all `eslint-disable` `no-explicit-any` comments.

**Step 4: Verify**

```bash
npm run test:log -- --run tests/unit/leaderboard-source-docs.test.ts tests/unit/leaderboard.test.ts tests/unit/leaderboard-resolve.test.ts tests/integration/leaderboard.integration.test.ts
npm run type-check
```
Expected: all pass.

**Step 5: Commit**

```bash
git add src/composables/useLeaderboard.ts src/types/leaderboard.ts tests/unit/leaderboard-source-docs.test.ts tests/unit/leaderboard.test.ts
git commit -m "refactor(leaderboard): replace any-based source docs with explicit resolver types"
```

---

### Task 4: Type Route Meta and Remove `next: any` from Navigation Guards

**Files:**
- Create: `src/types/router-meta.d.ts`
- Modify: `src/router/index.ts`
- Modify: `src/guards/navigationGuards.ts`
- Create: `tests/unit/navigationGuards.test.ts`
- Modify: `tests/unit/router-guards-auth.test.ts`

**Step 1: Write failing test for role guard matrix**

Create `tests/unit/navigationGuards.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { requireRole } from '@/guards/navigationGuards';

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ userRole: 'viewer', currentUser: null, isAuthenticated: false }),
}));

describe('navigationGuards', () => {
  it('redirects unauthenticated users to /login', () => {
    const guard = requireRole('admin');
    const next = vi.fn();
    guard({} as never, {} as never, next);
    expect(next).toHaveBeenCalledWith('/login');
  });
});
```

**Step 2: Run test to verify failure**

```bash
npm run test:log -- --run tests/unit/navigationGuards.test.ts
```
Expected: FAIL before guard refactor/types are complete.

**Step 3: Implement typed route meta + typed guards**

Create `src/types/router-meta.d.ts` module augmentation:

```ts
import 'vue-router';
import type { UserRole } from '@/types';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
    requiresAdmin?: boolean;
    requiresScorekeeper?: boolean;
    overlayPage?: boolean;
    obsOverlay?: boolean;
    roles?: readonly UserRole[];
  }
}
```

Refactor `src/router/index.ts` to stop casting `to.meta.* as boolean`; use typed defaults (`Boolean(to.meta.requiresAuth)`).

Refactor `src/guards/navigationGuards.ts` to remove all `next: any` signatures by using typed callbacks (or typed return-style guards) and `UserRole` union inputs.

**Step 4: Verify**

```bash
npm run test:log -- --run tests/unit/navigationGuards.test.ts tests/unit/router-guards-auth.test.ts
npm run type-check
```
Expected: pass.

**Step 5: Commit**

```bash
git add src/types/router-meta.d.ts src/router/index.ts src/guards/navigationGuards.ts tests/unit/navigationGuards.test.ts tests/unit/router-guards-auth.test.ts
git commit -m "refactor(router): type route meta and remove next-any guard signatures"
```

---

### Task 5: Harden Alerts/Audit Query Constraints and Snapshot Mapping Types

**Files:**
- Modify: `src/stores/alerts.ts`
- Modify: `src/stores/audit.ts`
- Modify: `tests/unit/alerts.store.test.ts`
- Modify: `tests/unit/audit.store.test.ts`

**Step 1: Write failing tests for filtered query constraints**

Add tests in `tests/unit/alerts.store.test.ts` and `tests/unit/audit.store.test.ts` asserting filters are passed into `query(...)` when options are provided.

Example assertion pattern:

```ts
expect(mockDeps.query).toHaveBeenCalledWith(
  'tournaments/t1/alerts',
  expect.objectContaining({ type: 'where' }),
  expect.objectContaining({ type: 'orderBy' }),
  expect.objectContaining({ type: 'limit' })
);
```

**Step 2: Run tests to verify failure**

```bash
npm run test:log -- --run tests/unit/alerts.store.test.ts tests/unit/audit.store.test.ts
```
Expected: FAIL until query-constraint builder/mapping refactor is complete.

**Step 3: Implement typed constraint builders and mappers**

In both stores:
- Replace `const constraints: any[]` with `const constraints: QueryConstraint[]`.
- Add local mappers for snapshot docs with explicit return types (`LiveOpsAlert`, `AuditRecord`).
- Remove broad array casts where possible.

Pattern:

```ts
import type { QueryConstraint } from 'firebase/firestore';

const constraints: QueryConstraint[] = [
  orderBy('createdAt', 'desc'),
  limit(options.maxResults ?? 50),
];
```

**Step 4: Verify**

```bash
npm run test:log -- --run tests/unit/alerts.store.test.ts tests/unit/audit.store.test.ts
npm run type-check
```
Expected: pass.

**Step 5: Commit**

```bash
git add src/stores/alerts.ts src/stores/audit.ts tests/unit/alerts.store.test.ts tests/unit/audit.store.test.ts
git commit -m "refactor(stores): replace any query constraints with typed firestore constraints"
```

---

### Task 6: Replace `any` in Brackets Storage with Generic Utility Types

**Files:**
- Create: `src/services/brackets-storage-utils.ts`
- Modify: `src/services/brackets-storage.ts`
- Create: `tests/unit/brackets-storage-utils.test.ts`

**Step 1: Write failing tests for utility behavior**

Create `tests/unit/brackets-storage-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  normalizeReferences,
  removeUndefinedDeep,
} from '@/services/brackets-storage-utils';

describe('brackets-storage-utils', () => {
  it('removes undefined keys deeply', () => {
    expect(removeUndefinedDeep({ a: 1, b: undefined, c: { d: undefined, e: 2 } })).toEqual({
      a: 1,
      c: { e: 2 },
    });
  });

  it('normalizes *_id object references to string ids', () => {
    expect(normalizeReferences({ stage_id: { id: 3 }, round_id: 2, name: 'R1' })).toEqual({
      stage_id: '3',
      round_id: 2,
      name: 'R1',
    });
  });
});
```

**Step 2: Run test to verify failure**

```bash
npm run test:log -- --run tests/unit/brackets-storage-utils.test.ts
```
Expected: FAIL because utility module does not exist yet.

**Step 3: Implement generic utils and wire storage class**

Create `src/services/brackets-storage-utils.ts`:

```ts
export type JsonLike = string | number | boolean | null | undefined | Date | JsonLike[] | { [key: string]: JsonLike };

export const removeUndefinedDeep = <T extends JsonLike>(value: T): T => {
  // generic deep clean implementation without any
  return value;
};

export const normalizeReferences = <T extends JsonLike>(value: T): T => {
  // generic _id reference normalization without any
  return value;
};
```

Then update `ClientFirestoreStorage` to use these helpers and remove `any` usages (`item as any`, `cleanValue as any`, function args returning `any`).

**Step 4: Verify**

```bash
npm run test:log -- --run tests/unit/brackets-storage-utils.test.ts
npm run type-check
```
Expected: pass.

**Step 5: Commit**

```bash
git add src/services/brackets-storage-utils.ts src/services/brackets-storage.ts tests/unit/brackets-storage-utils.test.ts
git commit -m "refactor(storage): replace any-based normalization with generic typed utilities"
```

---

### Task 7: Final Verification and Stability Pass

**Files:**
- Modify (if needed): touched files from Tasks 1-6 only

**Step 1: Run focused test suites**

```bash
npm run test:log -- --run tests/unit/checkInTypes.test.ts tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/RapidCheckInPanel.test.ts tests/unit/FrontDeskCheckInView.test.ts tests/unit/leaderboard.test.ts tests/unit/leaderboard-source-docs.test.ts tests/unit/router-guards-auth.test.ts tests/unit/navigationGuards.test.ts tests/unit/alerts.store.test.ts tests/unit/audit.store.test.ts tests/unit/brackets-storage-utils.test.ts
```
Expected: PASS.

**Step 2: Run full type-check and lint logs**

```bash
npm run type-check
npm run lint:log -- src/features/checkin src/composables/useLeaderboard.ts src/router/index.ts src/guards/navigationGuards.ts src/stores/alerts.ts src/stores/audit.ts src/services/brackets-storage.ts src/services/brackets-storage-utils.ts src/types/advanced.ts src/types/router-meta.d.ts
```
Expected: type-check PASS; lint either PASS or known baseline-only warnings captured with fingerprint.

**Step 3: Run optional integration spot checks**

```bash
npm run test:log -- --run tests/integration/checkin.integration.test.ts tests/integration/leaderboard.integration.test.ts
```
Expected: PASS.

**Step 4: Prepare final commit**

```bash
git add src/types/advanced.ts src/types/advanced.contracts.ts src/types/router-meta.d.ts src/features/checkin/composables/checkInTypes.ts src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts src/features/checkin/components/RapidCheckInPanel.vue src/features/checkin/views/FrontDeskCheckInView.vue src/composables/useLeaderboard.ts src/types/leaderboard.ts src/router/index.ts src/guards/navigationGuards.ts src/stores/alerts.ts src/stores/audit.ts src/services/brackets-storage.ts src/services/brackets-storage-utils.ts tests/unit/checkInTypes.test.ts tests/unit/useFrontDeskCheckInWorkflow.test.ts tests/unit/RapidCheckInPanel.test.ts tests/unit/FrontDeskCheckInView.test.ts tests/unit/leaderboard-source-docs.test.ts tests/unit/leaderboard.test.ts tests/unit/router-guards-auth.test.ts tests/unit/navigationGuards.test.ts tests/unit/alerts.store.test.ts tests/unit/audit.store.test.ts tests/unit/brackets-storage-utils.test.ts
git commit -m "refactor(types): harden production typing across checkin leaderboard routing and core stores"
```

**Step 5: Record verification evidence**

Capture command outputs and any `debug-kb` fingerprints per AGENTS.md protocol.

---

## Done Criteria

- Targeted production areas are hardened with advanced types and no new `any` usage.
- Route meta and guard contracts are explicit and compile-safe.
- Check-in and leaderboard source/state models use explicit typed contracts.
- Core stores/services use typed query constraints and generic utils in place of `any`.
- `npm run type-check` and targeted `test:log` suites pass.
- No runtime behavior changes from baseline.
