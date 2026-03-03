# Brackets Manager Pool Stage Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve pool-stage readability in `BracketsManagerViewer` by showing games and pool table in a responsive split layout on desktop, while preserving a safe stacked mobile fallback.

**Architecture:** Add a round-robin-only presentation guard in `BracketsManagerViewer` and apply scoped CSS overrides that only target `brackets-viewer` pool-stage markup (`.round-robin`). Keep Firestore fetch/listener/render logic unchanged. Validate guard logic via a small unit test on an extracted helper.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Vuetify 3, Vitest, scoped CSS with `:deep()` selectors.

---

### Task 1: Add Failing Test for Round-Robin Layout Guard

**Files:**
- Create: `tests/unit/stageLayout.test.ts`
- Create: `src/features/brackets/utils/stageLayout.ts` (stub initially)

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { isRoundRobinStage } from '@/features/brackets/utils/stageLayout';

describe('isRoundRobinStage', () => {
  it('returns true when first stage is round_robin', () => {
    expect(isRoundRobinStage([{ id: 1, type: 'round_robin' }])).toBe(true);
  });

  it('returns false when first stage is elimination', () => {
    expect(isRoundRobinStage([{ id: 1, type: 'single_elimination' }])).toBe(false);
  });

  it('returns false for empty or missing stage type', () => {
    expect(isRoundRobinStage([])).toBe(false);
    expect(isRoundRobinStage([{ id: 1 }])).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- --run tests/unit/stageLayout.test.ts`
Expected: FAIL because helper is missing/incomplete.

**Step 3: Write minimal implementation**

```ts
interface StageLike {
  type?: string;
}

export const isRoundRobinStage = (stages: StageLike[]): boolean => {
  return stages[0]?.type === 'round_robin';
};
```

**Step 4: Run test to verify it passes**

Run: `npm run test:log -- --run tests/unit/stageLayout.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/stageLayout.test.ts src/features/brackets/utils/stageLayout.ts
git commit -m "test(brackets): add round-robin stage layout guard coverage"
```

### Task 2: Apply Round-Robin-Only Responsive Pool Layout in BracketsManagerViewer

**Files:**
- Modify: `src/features/brackets/components/BracketsManagerViewer.vue`
- Reuse: `src/features/brackets/utils/stageLayout.ts`

**Step 1: Write failing behavior test (guard wiring)**

Add/extend component-level assertion in a focused test file that verifies class gating behavior OR create a lightweight computed-focused unit helper test if component mounting is too coupled.

Run: `npm run test:log -- --run tests/unit/stageLayout.test.ts`
Expected: Current assertions pass for helper; new guard-wiring assertion fails before component update.

**Step 2: Implement minimal component wiring**

- Import helper in `BracketsManagerViewer.vue`.
- Add computed boolean from `stages`.
- Add conditional wrapper class (for example `is-round-robin`).

**Step 3: Implement minimal scoped CSS split layout**

- Under guard class + `:deep()`, target only `.round-robin` content.
- Desktop:
  - Group section 2-column grid
  - Heading full width
  - Table pinned in right column (sticky)
- Mobile:
  - 1-column stacked fallback
  - sticky disabled
  - preserve table readability

**Step 4: Verify behavior via tests and quick manual checks**

Run:
- `npm run test:log -- --run tests/unit/stageLayout.test.ts`
- Manual browser check (or existing UI smoke path) on pool-stage category

Expected:
- Helper tests PASS
- Pool-stage desktop shows side-by-side games/table
- Mobile stacks cleanly
- Single/double elimination unchanged

**Step 5: Commit**

```bash
git add src/features/brackets/components/BracketsManagerViewer.vue src/features/brackets/utils/stageLayout.ts tests/unit/stageLayout.test.ts
git commit -m "feat(brackets): improve pool-stage layout readability in brackets manager"
```

### Task 3: Verification and Merge Readiness

**Files:**
- Update if needed: `docs/debug-kb/index.yml` and fingerprint file(s) if any `:log` command fails

**Step 1: Run required verification commands**

Run:
- `npm run build:log`
- `npm run lint:log`
- `npm run test:log -- --run tests/unit/stageLayout.test.ts`

Expected:
- Commands succeed, or failures handled using Debug KB Protocol with fingerprints recorded.

**Step 2: Confirm final diff scope**

Run: `git status --short && git log --oneline -n 5`
Expected: Only intended files and commits.

**Step 3: Merge into target branch**

- Return to main workspace branch (`feat/epoch-based-scheduler`).
- Merge `feat/pool-stage-layout` after verification.

**Step 4: Final report**

Include:
- Files changed (absolute paths)
- Commands executed
- Fingerprints handled
- KB files created/updated
- Verification evidence
