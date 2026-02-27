# BYE/TBD Single Source Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralize BYE/TBD semantics into one reusable module so BYE is never schedulable while TBD remains schedulable, and remove duplicate UI logic.

**Architecture:** Introduce a pure match-slot domain composable (`useMatchSlotState`) as the single source of truth for slot labeling and schedulability. Refactor bracket and match-control consumers to call this module, then gate auto-scheduler candidate filtering with it. Preserve existing data model and scheduling algorithm behavior except for explicit BYE exclusion.

**Tech Stack:** Vue 3 + TypeScript, Pinia, Vitest, @vue/test-utils, Firebase adapter paths in existing stores/composables.

---

### Task 0: Preflight Safety and Scope Lock

**Files:**
- Read: `AGENTS.md`
- Read: `docs/coding-patterns/CODING_PATTERNS.md`
- Read: `docs/plans/2026-02-27-bye-tbd-single-source-design.md`

**Step 1: Confirm branch/worktree context**

Run: `git branch --show-current && pwd`
Expected: Feature branch and intended workspace path.

**Step 2: Capture baseline file state**

Run: `git status --short`
Expected: Known pre-existing changes only; no accidental edits from this task yet.

**Step 3: Confirm existing duplicate BYE logic locations**

Run: `rg -n "function isBye\(|return 'BYE'|return 'TBD'" src/features/brackets/components src/features/tournaments/views src/composables`
Expected: Hits in BracketView/DoubleElimination and resolver paths.

**Step 4: Record target behavior in notes**

- BYE: non-playable, never scheduled.
- TBD: unresolved future slot, still schedulable.

**Step 5: Commit**

No commit for preflight.

---

### Task 1: Add Single-Source Slot-State Module (TDD)

**Files:**
- Create: `src/composables/useMatchSlotState.ts`
- Create: `tests/unit/useMatchSlotState.test.ts`
- Reference: `src/types/index.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import type { Match } from '@/types';
import { useMatchSlotState } from '@/composables/useMatchSlotState';

const makeMatch = (overrides: Partial<Match> = {}): Match => ({
  id: 'm1',
  tournamentId: 't1',
  categoryId: 'c1',
  round: 1,
  matchNumber: 1,
  bracketPosition: { bracket: 'winners', round: 1, position: 1 },
  status: 'ready',
  scores: [],
  createdAt: new Date('2026-02-27T00:00:00Z'),
  updatedAt: new Date('2026-02-27T00:00:00Z'),
  ...overrides,
});

describe('useMatchSlotState', () => {
  const slot = useMatchSlotState();

  it('classifies missing slot as BYE when winner already advanced', () => {
    const match = makeMatch({ participant1Id: 'reg-1', participant2Id: undefined, winnerId: 'reg-1' });
    expect(slot.getSlotState(match, 'participant2')).toBe('bye');
    expect(slot.isByeMatch(match)).toBe(true);
    expect(slot.isSchedulableMatch(match)).toBe(false);
  });

  it('classifies missing slot as TBD when not finalized', () => {
    const match = makeMatch({ participant1Id: 'reg-1', participant2Id: undefined, winnerId: undefined, status: 'ready' });
    expect(slot.getSlotState(match, 'participant2')).toBe('tbd');
    expect(slot.isByeMatch(match)).toBe(false);
    expect(slot.isSchedulableMatch(match)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- tests/unit/useMatchSlotState.test.ts`
Expected: FAIL with missing module/export.

**Step 3: Write minimal implementation**

```ts
import type { Match } from '@/types';

export type MatchSlot = 'participant1' | 'participant2';
export type SlotState = 'resolved' | 'tbd' | 'bye';

const TERMINAL_STATUSES = new Set(['completed', 'walkover', 'cancelled']);

export function useMatchSlotState() {
  const getSlotRegistrationId = (match: Match, slot: MatchSlot): string | undefined =>
    slot === 'participant1' ? match.participant1Id : match.participant2Id;

  const getOtherSlotRegistrationId = (match: Match, slot: MatchSlot): string | undefined =>
    slot === 'participant1' ? match.participant2Id : match.participant1Id;

  const isFinalizedByeContext = (match: Match): boolean =>
    Boolean(match.winnerId) || match.status === 'completed' || match.status === 'walkover';

  const getSlotState = (match: Match, slot: MatchSlot): SlotState => {
    const current = getSlotRegistrationId(match, slot);
    if (current) return 'resolved';

    const other = getOtherSlotRegistrationId(match, slot);
    if (!other) return 'tbd';

    return isFinalizedByeContext(match) ? 'bye' : 'tbd';
  };

  const isByeMatch = (match: Match): boolean =>
    getSlotState(match, 'participant1') === 'bye' || getSlotState(match, 'participant2') === 'bye';

  const isSchedulableMatch = (match: Match): boolean =>
    !isByeMatch(match) && !TERMINAL_STATUSES.has(match.status);

  const getSlotLabel = (
    match: Match,
    slot: MatchSlot,
    resolveParticipantName: (registrationId: string | undefined) => string
  ): string => {
    const state = getSlotState(match, slot);
    if (state === 'bye') return 'BYE';
    if (state === 'tbd') return 'TBD';
    return resolveParticipantName(getSlotRegistrationId(match, slot));
  };

  return {
    getSlotState,
    getSlotLabel,
    isByeMatch,
    isSchedulableMatch,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:log -- tests/unit/useMatchSlotState.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/useMatchSlotState.test.ts src/composables/useMatchSlotState.ts
git commit -m "feat: add single-source BYE/TBD slot-state rules"
```

---

### Task 2: Refactor Bracket Components to Consume Shared Rules

**Files:**
- Modify: `src/features/brackets/components/BracketView.vue`
- Modify: `src/features/brackets/components/DoubleEliminationBracket.vue`
- Create: `tests/unit/BracketSlotStateRendering.test.ts`

**Step 1: Write the failing component test**

```ts
import { describe, expect, it } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import BracketView from '@/features/brackets/components/BracketView.vue';

describe('Bracket slot rendering', () => {
  it('renders BYE for finalized one-sided match and TBD for unresolved one-sided match', async () => {
    // mount with mocked matchStore.matches containing both cases
    // assert rendered text contains both "BYE" and "TBD"
    expect(true).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- tests/unit/BracketSlotStateRendering.test.ts`
Expected: FAIL with placeholder assertion.

**Step 3: Write minimal implementation**

- Import and instantiate `useMatchSlotState` in both bracket components.
- Remove local duplicated BYE helpers:
  - `getParticipantDisplayName` / `isBye` in `BracketView.vue`
  - `getParticipantName(match?)` / `isBye` in `DoubleEliminationBracket.vue`
- Replace template labels/classes with `getSlotState`/`getSlotLabel` from shared module.

```ts
const { getSlotState, getSlotLabel } = useMatchSlotState();

const label1 = getSlotLabel(match, 'participant1', getParticipantName);
const p1State = getSlotState(match, 'participant1');
```

**Step 4: Run test to verify it passes**

Run: `npm run test:log -- tests/unit/BracketSlotStateRendering.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/brackets/components/BracketView.vue src/features/brackets/components/DoubleEliminationBracket.vue tests/unit/BracketSlotStateRendering.test.ts
git commit -m "refactor: use shared BYE/TBD slot-state rules in bracket views"
```

---

### Task 3: Align Match Control Participant Labels with Shared Rules

**Files:**
- Modify: `src/features/tournaments/views/MatchControlView.vue`
- Modify/Test: `tests/unit/MatchControlView.assignments.test.ts`

**Step 1: Write the failing test case**

Add a case ensuring BYE label is shown for finalized one-sided match and TBD remains for unresolved one-sided match.

```ts
it('uses shared slot-state labels for participant cells', async () => {
  // arrange runtimeState.matches with BYE and TBD scenarios
  // assert rendered row labels include BYE and TBD appropriately
  expect(true).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- tests/unit/MatchControlView.assignments.test.ts`
Expected: FAIL on new case.

**Step 3: Write minimal implementation**

- Import `useMatchSlotState`.
- Add helper wrappers:

```ts
const { getSlotLabel, getSlotState } = useMatchSlotState();

function getParticipantSlotLabel(match: Match, slot: 'participant1' | 'participant2'): string {
  return getSlotLabel(match, slot, getParticipantName);
}
```

- Replace direct `getParticipantName(item.participant1Id)` usage in schedule participants cell with slot label helper.
- Keep existing behavior elsewhere unchanged unless currently inconsistent.

**Step 4: Run test to verify it passes**

Run: `npm run test:log -- tests/unit/MatchControlView.assignments.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/views/MatchControlView.vue tests/unit/MatchControlView.assignments.test.ts
git commit -m "refactor: align match control participant labels with shared slot-state rules"
```

---

### Task 4: Enforce BYE Exclusion in Auto Scheduler

**Files:**
- Modify: `src/composables/useMatchScheduler.ts`
- Create: `tests/unit/useMatchScheduler.bye-filter.test.ts`
- Reference: `tests/unit/timeScheduler.test.ts`

**Step 1: Write the failing scheduler test**

Create a focused unit test that mocks Firestore reads and verifies BYE is excluded from candidate scheduling while TBD is included.

```ts
it('excludes BYE but includes TBD in schedule candidate filtering', async () => {
  // mock adapted matches: playable, bye, tbd
  // run scheduleMatches
  // assert scheduleTimes receives playable + tbd, not bye
  expect(true).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:log -- tests/unit/useMatchScheduler.bye-filter.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

In `scheduleMatches` candidate filtering, add shared gate:

```ts
const { isSchedulableMatch } = useMatchSlotState();

matches = adaptedMatches.filter((m) => {
  if (!isSchedulableMatch(m)) return false;
  // existing locked/published/reflow checks remain
  ...
});
```

Add optional exclusion log context:

```ts
console.log('[scheduleMatches] Excluding non-schedulable BYE match', { id: m.id, categoryId: options.categoryId, levelId: options.levelId });
```

**Step 4: Run tests to verify they pass**

Run:
- `npm run test:log -- tests/unit/useMatchScheduler.bye-filter.test.ts`
- `npm run test:log -- tests/unit/timeScheduler.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/composables/useMatchScheduler.ts tests/unit/useMatchScheduler.bye-filter.test.ts tests/unit/timeScheduler.test.ts
git commit -m "fix: prevent BYE matches from entering auto-schedule candidates"
```

---

### Task 5: Add/Update Coding Pattern (Mandatory Post-Fix)

**Files:**
- Modify: `docs/coding-patterns/CODING_PATTERNS.md`
- Optional Create: `docs/fix/centralize-bye-tbd-slot-state.md`

**Step 1: Write pattern entry draft**

Add new CP entry with:
- Anti-pattern: local `isBye`/inline BYE detection in views.
- Correct pattern: `useMatchSlotState` as single authority.
- Rule: scheduler must call `isSchedulableMatch`.

**Step 2: Add detection command**

```bash
rg -n "function isBye\(|return 'BYE'" src/features/brackets/components src/features/tournaments/views
rg -n "includeTBD: true" src/composables/useMatchScheduler.ts
```

(Second command must be accompanied by helper gate usage in same file.)

**Step 3: Run detection command**

Run commands above and record violations (expected: zero local BYE helper violations after refactor).

**Step 4: Save pattern docs**

Update status/severity/source bug and include exact file references.

**Step 5: Commit**

```bash
git add docs/coding-patterns/CODING_PATTERNS.md docs/fix/centralize-bye-tbd-slot-state.md
git commit -m "docs(patterns): codify single-source BYE/TBD and scheduler gating"
```

---

### Task 6: Verification, Debug-KB Protocol, and Final Report

**Files:**
- Modify if needed: `docs/debug-kb/<fingerprint>.md`
- Modify if needed: `docs/debug-kb/index.yml`

**Step 1: Run targeted tests (`:log`)**

Run:
- `npm run test:log -- tests/unit/useMatchSlotState.test.ts`
- `npm run test:log -- tests/unit/BracketSlotStateRendering.test.ts`
- `npm run test:log -- tests/unit/MatchControlView.assignments.test.ts`
- `npm run test:log -- tests/unit/useMatchScheduler.bye-filter.test.ts`

Expected: PASS.

**Step 2: Run lint/type/build (`:log`)**

Run:
- `npm run lint:log`
- `npm run build:log`

Expected:
- lint passes for touched code.
- build may fail on known repository baseline TS debt.

**Step 3: Apply Debug KB protocol for failures**

If any `:log` command fails:
- capture fingerprint
- check `docs/debug-kb/<fingerprint>.md` and `docs/debug-kb/index.yml`
- apply known fix or log one attempt per change

**Step 4: Final evidence collection**

Capture:
- files changed
- exact commands run
- fingerprints handled
- KB files touched
- verification outcome

**Step 5: Commit verification/docs updates**

```bash
git add docs/debug-kb/*.md docs/debug-kb/index.yml
# commit only if KB/docs changed
```

---

## Implementation Notes

- Keep changes minimal and local; no dependency additions.
- Preserve existing `TBD` scheduling behavior in `scheduleTimes`.
- Do not change Firestore schema or rules.
- Do not address global match numbering in this scope.

