# BYE/TBD Single-Source Design

**Date:** 2026-02-27  
**Status:** Approved (Design)  
**Scope:** Centralize BYE/TBD semantics first; defer match traceability/numbering to a follow-up.

---

## Problem

Current BYE/TBD behavior is split across modules:
- Bracket views contain local BYE/TBD detection logic.
- `useParticipantResolver()` returns `TBD` but never `BYE`.
- `useMatchScheduler()` includes placeholder matches and lacks a centralized BYE exclusion rule.

This creates inconsistent behavior:
- Bracket can show `BYE`, while schedule/control paths still treat similar states as schedulable placeholders.
- Logic is duplicated and fragile.

---

## Product Rules (Approved)

1. `TBD` means unresolved future participant and **can be scheduled**.
2. `BYE` means non-playable auto-advance and **must never be scheduled**.
3. Brackets-manager-derived state is authoritative for these semantics.
4. One shared module must define the rules; UI and scheduler consume it.

---

## Recommended Approach

### Option Chosen: BYE/TBD-first only

Implement BYE/TBD centralization first, then handle match traceability/numbering in a separate follow-up task.

Why:
- Lowest risk path to production-ready behavior.
- Easier verification and rollback.
- Prevents mixing identity concerns with operational scheduling semantics.

---

## Architecture

Add a single shared composable:

- `src/composables/useMatchSlotState.ts`

This module becomes the authoritative rule engine for slot and match semantics.

### API (proposed)

- `getSlotState(match, slot): 'resolved' | 'tbd' | 'bye'`
- `getSlotLabel(match, slot): string` (`BYE`, `TBD`, or participant name)
- `isByeMatch(match): boolean`
- `isTbdMatch(match): boolean`
- `isSchedulableMatch(match): boolean`

### Core rule behavior

- If slot has participant ID: `resolved`.
- If slot missing and match is clearly auto-advanced/finalized: `bye`.
- If slot missing and not auto-advanced/finalized: `tbd`.
- Match is schedulable only when:
  - not BYE, and
  - status is not `completed` / `walkover` / `cancelled`.

Note: `tbd` remains schedulable by design.

---

## Integration Plan

### 1. Replace duplicate bracket logic

Refactor these to consume `useMatchSlotState`:
- `src/features/brackets/components/BracketView.vue`
- `src/features/brackets/components/DoubleEliminationBracket.vue`

Remove duplicated local BYE/TBD helpers (`isBye`, local display functions).

### 2. Align Match Control display

Use same slot-label helper in:
- `src/features/tournaments/views/MatchControlView.vue`

This keeps operator view and bracket view consistent.

### 3. Enforce scheduler gate

Update:
- `src/composables/useMatchScheduler.ts`

Before scheduling candidates are passed to `scheduleTimes`, filter through `isSchedulableMatch` so BYE is always excluded.

Optional diagnostics:
- record/log BYE exclusions with match id and scope for troubleshooting.

---

## Data Flow

1. Match data is adapted from brackets-manager (`adaptBracketsMatchToLegacyMatch`).
2. Consumers call `useMatchSlotState` to classify each slot (`resolved/tbd/bye`).
3. UI renders labels from this classification.
4. Scheduler uses same classification via `isSchedulableMatch`.

Result: one semantic path, no divergent local rules.

---

## Error Handling and Safety

- UI does not infer BYE/TBD directly.
- If data is partial, default to `tbd` (safe fallback).
- Scheduler keeps its own authoritative gate (`isSchedulableMatch`) to prevent accidental BYE scheduling even if UI regresses.
- Keep logs contextual (`match.id`, `categoryId`, `levelId`, reason).

---

## Testing Strategy

### New unit tests

- `tests/unit/useMatchSlotState.test.ts`

Cover:
- missing one side + finalized/advanced => `bye`
- missing one side + not finalized => `tbd`
- both sides present => `resolved`
- BYE never schedulable
- TBD schedulable

### Targeted test updates

- Bracket component tests: render `BYE`/`TBD` using shared logic.
- Scheduler tests: BYE excluded, TBD included.

### Verification commands

- `npm run test:log -- tests/unit/useMatchSlotState.test.ts`
- `npm run test:log -- tests/unit/<affected-scheduler-or-bracket-tests>.test.ts`
- `npm run lint:log`
- `npm run build:log`

If `:log` command fails, follow Debug KB protocol in `AGENTS.md`.

---

## Non-Goals (This Task)

- Global match traceability/numbering changes.
- Broad scheduler architecture refactors.
- Data model migrations.

These are intentionally deferred to a follow-up design/implementation.

---

## Acceptance Criteria

1. BYE/TBD logic exists in one shared module only.
2. Bracket views and Match Control use that module (no local duplicate logic).
3. Auto-scheduler never schedules BYE matches.
4. TBD matches remain schedulable.
5. Tests verify BYE exclusion and TBD inclusion.
6. `:log` verification commands are run and reported.
