# Scheduling Fix: Round-First Sort for Court Utilization

Date: 2026-03-02
Status: Approved

## Problem

The `scheduleTimes()` function in `src/composables/useTimeScheduler.ts` sorts matches using **group-first ordering**: `(groupId, round, matchNumber)`. For a `pool_to_elimination` tournament with 7 pools (A-G) and 6 courts, this causes:

- All of Pool A's 6 matches processed before Pool B's matches start
- Pool A's round-1 fills 2 virtual slots at 15:00
- Pool A's round-2 deferred to 15:45 (player rest) → those slots freed at 15:30
- Pool B's round-1 then fills the 15:30 slots — not 15:00
- **Result**: Courts 5 and 6 idle at 15:00; round-1 for late pools shifted 15–30 min later

**Observed in MCIA 2026 Men's Doubles**: 4 matches at 15:00 (Courts 1–4), Courts 5–6 empty, despite 6 courts configured.

## Goal

Maximize court utilization from the start: all available courts should fill at 15:00 with round-1 matches across all pools, before any pool advances to round 2.

## Root Cause

`src/composables/useTimeScheduler.ts`, lines 101–110:

```typescript
// Current — group first
const sorted = [...matches].sort((a, b) => {
  const aGroup = a.groupId ?? '\uffff';
  const bGroup = b.groupId ?? '\uffff';
  if (aGroup !== bGroup) return aGroup < bGroup ? -1 : 1;
  if (a.round !== b.round) return a.round - b.round;
  return a.matchNumber - b.matchNumber;
});
```

## Fix

Change sort to **round-first** while preserving pool-before-bracket phase ordering:

```typescript
// New — round first, pool before bracket
const sorted = [...matches].sort((a, b) => {
  // Phase split: pool matches (have groupId) before bracket matches (no groupId)
  const aIsPool = a.groupId !== undefined;
  const bIsPool = b.groupId !== undefined;
  if (aIsPool !== bIsPool) return aIsPool ? -1 : 1;
  // Round first — ensures all pools' round-N matches compete for courts before round N+1
  if (a.round !== b.round) return a.round - b.round;
  // Stable tie-break: group then match number
  const aGroup = a.groupId ?? '\uffff';
  const bGroup = b.groupId ?? '\uffff';
  if (aGroup !== bGroup) return aGroup < bGroup ? -1 : 1;
  return a.matchNumber - b.matchNumber;
});
```

**Why the explicit pool/bracket split**: Without it, bracket matches (round 1) would interleave with pool round 2/3 matches since bracket rounds also start from 1. The explicit `aIsPool !== bIsPool` check replaces the implicit '\uffff' sentinel reliance.

## Expected Outcome (MCIA 2026, 7 pools, 6 courts, 30-min matches, 15-min rest, 0 buffer)

| Time  | Current courts used | Fixed courts used |
|-------|---------------------|-------------------|
| 15:00 | 4 (Courts 5-6 idle) | 6                 |
| 15:30 | 6                   | 6 (R1 overflow)   |
| 15:45 | 6                   | 6 (R2 begins)     |

Tournament finishes ~30–45 minutes earlier.

## Files to Change

1. **`src/composables/useTimeScheduler.ts`** — replace sort comparator (lines 103–110)
2. **`tests/unit/timeScheduler.test.ts`** — add regression test for round-first behavior

## Test Coverage

Add a test case to `tests/unit/timeScheduler.test.ts`:

- **Input**: 2 groups (A, B), each with 2 rounds, 2 matches per round; concurrency=4, buffer=0, rest=15min, duration=30min
- **Assert**: All 4 round-1 matches (A R1M1, A R1M2, B R1M1, B R1M2) scheduled at start time before any round-2 match
- **Assert**: No round-2 match starts before `startTime + matchDuration + restTime`

## Verification

1. Run `npm run test:unit -- timeScheduler` — all existing tests pass, new test passes
2. In emulator: run the MCIA 2026 seed, generate pools, trigger auto-schedule, verify schedule grid shows 6 matches at 15:00
3. Confirm: no back-to-back violations (same player in consecutive matches < 15 min apart)
