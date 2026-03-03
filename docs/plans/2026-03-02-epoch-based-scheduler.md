# Epoch-Based Scheduler Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix court under-utilization at tournament start by computing scheduling epochs (player conflict graph coloring) so all pool round-1 matches across all pools compete for courts simultaneously.

**Architecture:** Add a pure `computeEpochs()` function to `useTimeScheduler.ts` that annotates each match with a `schedulingEpoch` number. Modify the sort comparator inside `scheduleTimes()` to sort epoch-first. Wire `computeEpochs()` into `scheduleCategory()`. All changes are backward-compatible — callers without epochs get identical behavior.

**Tech Stack:** TypeScript, Vitest. No new dependencies. No new files.

**Design doc:** `docs/plans/2026-03-02-epoch-based-scheduler-design.md`

---

### Task 1: Write failing unit tests

**Files:**
- Modify: `tests/unit/timeScheduler.test.ts`

Context: `makeMatch` and `makeConfig` helpers already exist at the top of the test file. `SchedulableMatch` is imported from `@/composables/useTimeScheduler`. You need to also import `computeEpochs` (it doesn't exist yet — the import will fail, which is expected).

**Step 1: Add `computeEpochs` to the import at line 24**

Change:
```typescript
import {
  publishSchedule,
  scheduleTimes,
  type SchedulableMatch,
  type TimeScheduleConfig,
  unpublishSchedule,
} from '@/composables/useTimeScheduler';
```
To:
```typescript
import {
  computeEpochs,
  publishSchedule,
  scheduleTimes,
  type SchedulableMatch,
  type TimeScheduleConfig,
  unpublishSchedule,
} from '@/composables/useTimeScheduler';
```

**Step 2: Add the two new tests inside the `scheduleTimes` describe block** (after the last existing test, before the closing `}`):

```typescript
  it('computeEpochs_assigns_correct_epochs_for_4_team_pool', () => {
    // 4 teams → C(4,2) = 6 matches. Only 2 can run simultaneously (no shared players).
    // Expected epochs: [0, 0, 1, 1, 2, 2]
    const matches: SchedulableMatch[] = [
      makeMatch('m1', 1, 1, { participant1Id: 'T1', participant2Id: 'T2' }),
      makeMatch('m2', 1, 2, { participant1Id: 'T3', participant2Id: 'T4' }),
      makeMatch('m3', 2, 3, { participant1Id: 'T1', participant2Id: 'T3' }),
      makeMatch('m4', 2, 4, { participant1Id: 'T2', participant2Id: 'T4' }),
      makeMatch('m5', 3, 5, { participant1Id: 'T1', participant2Id: 'T4' }),
      makeMatch('m6', 3, 6, { participant1Id: 'T2', participant2Id: 'T3' }),
    ];

    const result = computeEpochs(matches);

    // m1 (T1vsT2) and m2 (T3vsT4): no shared players → both epoch 0
    expect(result.find(m => m.id === 'm1')!.schedulingEpoch).toBe(0);
    expect(result.find(m => m.id === 'm2')!.schedulingEpoch).toBe(0);
    // T1 used at epoch 0, T3 used at epoch 0 → m3 must be epoch 1
    expect(result.find(m => m.id === 'm3')!.schedulingEpoch).toBe(1);
    // T2 used at epoch 0, T4 used at epoch 0 → m4 must be epoch 1
    expect(result.find(m => m.id === 'm4')!.schedulingEpoch).toBe(1);
    // T1 used at 0,1  T4 used at 0,1 → m5 must be epoch 2
    expect(result.find(m => m.id === 'm5')!.schedulingEpoch).toBe(2);
    // T2 used at 0,1  T3 used at 0,1 → m6 must be epoch 2
    expect(result.find(m => m.id === 'm6')!.schedulingEpoch).toBe(2);
  });

  it('epoch_sort_fills_all_courts_before_advancing_to_next_epoch', () => {
    // 2 pools × 4 teams = 12 matches, concurrency = 4.
    // Epoch 0 has 4 matches (2 per pool). All should start at startTime.
    // Epoch 1 must not start before startTime + matchDuration + minRest.
    const poolA: SchedulableMatch[] = [
      makeMatch('a1r1', 1, 1, { groupId: 'A', participant1Id: 'a1', participant2Id: 'a2' }),
      makeMatch('a2r1', 1, 2, { groupId: 'A', participant1Id: 'a3', participant2Id: 'a4' }),
      makeMatch('a1r2', 2, 3, { groupId: 'A', participant1Id: 'a1', participant2Id: 'a3' }),
      makeMatch('a2r2', 2, 4, { groupId: 'A', participant1Id: 'a2', participant2Id: 'a4' }),
      makeMatch('a1r3', 3, 5, { groupId: 'A', participant1Id: 'a1', participant2Id: 'a4' }),
      makeMatch('a2r3', 3, 6, { groupId: 'A', participant1Id: 'a2', participant2Id: 'a3' }),
    ];
    const poolB: SchedulableMatch[] = [
      makeMatch('b1r1', 1, 7,  { groupId: 'B', participant1Id: 'b1', participant2Id: 'b2' }),
      makeMatch('b2r1', 1, 8,  { groupId: 'B', participant1Id: 'b3', participant2Id: 'b4' }),
      makeMatch('b1r2', 2, 9,  { groupId: 'B', participant1Id: 'b1', participant2Id: 'b3' }),
      makeMatch('b2r2', 2, 10, { groupId: 'B', participant1Id: 'b2', participant2Id: 'b4' }),
      makeMatch('b1r3', 3, 11, { groupId: 'B', participant1Id: 'b1', participant2Id: 'b4' }),
      makeMatch('b2r3', 3, 12, { groupId: 'B', participant1Id: 'b2', participant2Id: 'b3' }),
    ];
    const matches = [...poolA, ...poolB];
    const config = makeConfig({
      concurrency: 4,
      matchDurationMinutes: 30,
      bufferMinutes: 0,
      minRestTimeMinutes: 15,
    });

    const epoched = computeEpochs(matches);
    const result = scheduleTimes(epoched, config);

    expect(result.planned.length).toBe(12);
    expect(result.unscheduled.length).toBe(0);

    const startMs = config.startTime.getTime();
    // Earliest a player can play their second match: match ends at startMs+30min, rest=15min
    const minEpoch1StartMs = startMs + (30 + 15) * 60_000;

    // Epoch-0 matches: 2 per pool = 4 total. All must be assigned at startTime.
    const epoch0Ids = new Set(['a1r1', 'a2r1', 'b1r1', 'b2r1']);
    for (const p of result.planned.filter(p => epoch0Ids.has(p.matchId))) {
      expect(p.plannedStartAt.getTime()).toBe(startMs);
    }

    // Epoch-1+ matches must not start before startTime + 45 min
    for (const p of result.planned.filter(p => !epoch0Ids.has(p.matchId))) {
      expect(p.plannedStartAt.getTime()).toBeGreaterThanOrEqual(minEpoch1StartMs);
    }
  });
```

**Step 3: Run the tests to confirm they fail**

```bash
npm run test:unit -- --testPathPattern=timeScheduler
```

Expected: 2 new tests FAIL (`computeEpochs is not a function` or similar). All 11 existing tests still pass.

**Step 4: Commit the failing tests**

```bash
git add tests/unit/timeScheduler.test.ts
git commit -m "test(scheduler): add failing tests for computeEpochs epoch-based sort"
```

---

### Task 2: Add `schedulingEpoch` to interface and implement `computeEpochs`

**Files:**
- Modify: `src/composables/useTimeScheduler.ts`

**Step 1: Add `schedulingEpoch` to `SchedulableMatch` (lines 73–82)**

The interface currently ends at `plannedStartAt?: Date;`. Add one field:

```typescript
export interface SchedulableMatch {
  id: string;
  round: number;
  matchNumber: number;
  groupId?: string;
  participant1Id?: string;
  participant2Id?: string;
  lockedTime?: boolean;
  plannedStartAt?: Date;
  schedulingEpoch?: number;   // ← add this line
}
```

**Step 2: Add `computeEpochs` function**

Insert the new function immediately before `export function scheduleTimes` (before line 84). It must be exported so tests can import it.

```typescript
/**
 * Annotate each match with a `schedulingEpoch` using greedy player-conflict
 * graph coloring.  Epoch 0 = all matches where no participant has yet been
 * assigned a time slot.  Epoch N = matches whose participants last played at
 * epoch N-1.  Matches within the same epoch share no participants and can
 * therefore run concurrently.
 *
 * TBD matches (no participants) always receive epoch 0.
 */
export function computeEpochs(matches: SchedulableMatch[]): SchedulableMatch[] {
  // participantId → set of epochs already used by that participant
  const participantEpochs = new Map<string, Set<number>>();

  return matches.map(match => {
    const pids = [match.participant1Id, match.participant2Id].filter(Boolean) as string[];

    // Union of all epochs already used by either participant
    const usedEpochs = new Set<number>();
    for (const pid of pids) {
      const epochs = participantEpochs.get(pid);
      if (epochs) {
        for (const e of epochs) usedEpochs.add(e);
      }
    }

    // Smallest non-negative integer not in usedEpochs
    let epoch = 0;
    while (usedEpochs.has(epoch)) epoch++;

    // Record this epoch for each participant
    for (const pid of pids) {
      if (!participantEpochs.has(pid)) participantEpochs.set(pid, new Set());
      participantEpochs.get(pid)!.add(epoch);
    }

    return { ...match, schedulingEpoch: epoch };
  });
}
```

**Step 3: Run the first new test only**

```bash
npm run test:unit -- --testPathPattern=timeScheduler -t "computeEpochs_assigns"
```

Expected: PASS.

**Step 4: Modify the sort comparator inside `scheduleTimes` (lines 103–110)**

Replace:
```typescript
  // Sort: pool/group first (keeps pool-mates together), then round, then matchNumber.
  // Matches without a groupId (bracket matches) come after pool matches of the same round.
  const sorted = [...matches].sort((a, b) => {
    // Pool matches first within same round-block
    const aGroup = a.groupId ?? '\uffff'; // sentinel sorts last
    const bGroup = b.groupId ?? '\uffff';
    if (aGroup !== bGroup) return aGroup < bGroup ? -1 : 1;
    if (a.round !== b.round) return a.round - b.round;
    return a.matchNumber - b.matchNumber;
  });
```

With:
```typescript
  // Sort: epoch-first so all pool round-1 matches across all groups compete for courts
  // simultaneously before any round-2 match is considered.  When schedulingEpoch is absent
  // (undefined), the match sorts last within the epoch dimension and falls through to the
  // group-first stable tie-break — preserving existing behaviour for un-annotated callers.
  const sorted = [...matches].sort((a, b) => {
    const aEpoch = a.schedulingEpoch ?? Infinity;
    const bEpoch = b.schedulingEpoch ?? Infinity;
    if (aEpoch !== bEpoch) return aEpoch - bEpoch;
    // Within same epoch: pool matches (have groupId) before bracket matches (no groupId)
    const aIsPool = a.groupId !== undefined;
    const bIsPool = b.groupId !== undefined;
    if (aIsPool !== bIsPool) return aIsPool ? -1 : 1;
    // Stable tie-break: group order, then match number
    const aGroup = a.groupId ?? '\uffff';
    const bGroup = b.groupId ?? '\uffff';
    if (aGroup !== bGroup) return aGroup < bGroup ? -1 : 1;
    return a.matchNumber - b.matchNumber;
  });
```

**Step 5: Run all tests**

```bash
npm run test:unit -- --testPathPattern=timeScheduler
```

Expected: all 13 tests PASS (11 existing + 2 new).

**Step 6: Commit**

```bash
git add src/composables/useTimeScheduler.ts
git commit -m "feat(scheduler): add computeEpochs and epoch-first sort for court utilization"
```

---

### Task 3: Wire `computeEpochs` into `scheduleCategory`

**Files:**
- Modify: `src/composables/useTimeScheduler.ts`

Context: `scheduleCategory` is the Vue composable method that reads locked matches from Firestore, calls `scheduleTimes`, then persists with `saveTimedSchedule`. It's the only path through which `scheduleTimes` is called in production.

**Step 1: Find the call site**

In `useTimeScheduler.ts`, inside `scheduleCategory()`, look for:

```typescript
      const markedMatches = matches.map(m =>
        lockedMatchIds.has(m.id) ? { ...m, lockedTime: true } : m
      );

      const result = scheduleTimes(markedMatches, config);
```

**Step 2: Insert `computeEpochs` call between the two statements**

```typescript
      const markedMatches = matches.map(m =>
        lockedMatchIds.has(m.id) ? { ...m, lockedTime: true } : m
      );

      // Annotate matches with scheduling epochs so the scheduler fills all courts
      // from the start before advancing to the next round of matches.
      const epochedMatches = computeEpochs(markedMatches);

      const result = scheduleTimes(epochedMatches, config);
```

**Step 3: Run all unit tests to confirm nothing broke**

```bash
npm run test:unit -- --testPathPattern=timeScheduler
```

Expected: 13/13 PASS.

**Step 4: Run lint and build**

```bash
npm run lint:log
npm run build:log
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/composables/useTimeScheduler.ts
git commit -m "feat(scheduler): wire computeEpochs into scheduleCategory for production use"
```

---

### Task 4: Emulator verification

**Step 1: Start emulators**

```bash
npm run emulators
```

**Step 2: Seed MCIA 2026**

```bash
npm run seed:mcia2026:local
```

**Step 3: Open the app and generate pools**

Navigate to `http://localhost:3000`, open the MCIA Badminton 2026 tournament, go to Men's Doubles, and click **Generate Bracket** → pools are created (Groups A-G, 4 teams each).

**Step 4: Run auto-schedule**

Open the schedule panel, configure: start time 15:00, duration 30 min, buffer 0 min, rest 15 min, all 6 courts. Click **Auto-Schedule**.

**Step 5: Verify schedule grid**

Expected:
- 6 matches at 15:00 (all 6 courts occupied immediately)
- No back-to-back violations (no player has two matches < 15 min apart)
- Tournament finishes earlier than before the fix

If you see fewer than 6 matches at 15:00, check the browser console for errors and re-verify that `computeEpochs` is being called (add a temporary `console.log` to confirm epoch annotations are reaching `scheduleTimes`).
