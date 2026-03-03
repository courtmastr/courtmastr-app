# Epoch-Based Scheduler Design

Date: 2026-03-02
Status: Approved

## Problem

`scheduleTimes()` uses group-first sort `(groupId, round, matchNumber)`. For MCIA 2026 (7 pools × 4 teams, 6 courts), only 4 of 6 courts are occupied at 15:00 because Pool A's 6 matches are processed before Pool B's round-1 matches ever get considered.

Root cause: global round numbers from `brackets-manager` are per-pool sequential (Pool A: rounds 1–3, Pool B: rounds 4–6), so round-first sort is nearly identical to group-first sort and does not fix the problem.

## Solution

Pre-compute a `schedulingEpoch` for each match using player conflict graph coloring, then sort by epoch before calling the existing virtual-slot scheduler.

- Epoch 0: all matches where no participant has yet been scheduled (all pool round-1 matches across all pools)
- Epoch 1: matches whose participants played in epoch 0
- Epoch N: matches whose participants last played in epoch N-1

With 7 pools × 2 epoch-0 matches = 14 epoch-0 candidates and concurrency=6, all 6 courts fill at 15:00. The existing `teamRestMap` in `scheduleTimes()` enforces the 15-min player rest automatically.

## Algorithm: `computeEpochs`

Pure function. For each match M (in input order):

1. Look up all epochs already assigned to matches involving `participant1Id` and `participant2Id`
2. Assign `schedulingEpoch(M) = smallest non-negative integer not in the union of those epoch sets`
3. Record this epoch for each participant

Example — Pool A (A1, A2, A3, A4):
- `A1vsA2`, `A3vsA4` → epoch 0 (no shared players)
- `A1vsA3`, `A2vsA4` → epoch 1
- `A1vsA4`, `A2vsA3` → epoch 2

TBD matches (no participants) always receive epoch 0 (no constraint).

## Sort Key Change

Replace the sort comparator in `scheduleTimes()` with:

```
(schedulingEpoch asc, undefined last) → (pool before bracket) → (groupId asc) → (matchNumber asc)
```

When `schedulingEpoch` is absent, all matches get `Infinity` and fall through to the existing group-first logic — **fully backward-compatible**.

## Files to Change

1. **`src/composables/useTimeScheduler.ts`**
   - Add `schedulingEpoch?: number` to `SchedulableMatch` interface
   - Add `computeEpochs(matches: SchedulableMatch[]): SchedulableMatch[]` pure function
   - Modify sort comparator to use epoch when present
   - Call `computeEpochs()` inside `scheduleCategory()` before calling `scheduleTimes()`

2. **`tests/unit/timeScheduler.test.ts`**
   - Add `computeEpochs assigns epoch 0 to independent matches` — 4-team pool, verify epoch distribution `[0,0,1,1,2,2]`
   - Add `epoch_sort_fills_all_courts_at_start_time` — 2 pools × 4 teams, concurrency=4, verify all 4 epoch-0 matches start at `startTime`, no epoch-1 match starts before `startTime + 45min`

No new files. No changes to public API surface. Existing callers unaffected.

## Expected Outcome (MCIA 2026, 7 pools, 6 courts, 30-min matches, 15-min rest, 0 buffer)

| Time  | Before         | After              |
|-------|----------------|--------------------|
| 15:00 | 4 matches      | 6 matches          |
| 15:30 | 6 matches      | 6 matches          |
| 15:45 | 6 matches (R2) | 6 matches (R2)     |

Tournament finishes ~30 min earlier. No back-to-back violations.

## Verification

1. `npm run test:unit -- --testPathPattern=timeScheduler` — all tests pass including 2 new ones
2. Seed MCIA 2026 in emulator, generate pools, run auto-schedule
3. Confirm schedule grid shows 6 matches at 15:00
4. Confirm no player has two matches < 15 min apart
