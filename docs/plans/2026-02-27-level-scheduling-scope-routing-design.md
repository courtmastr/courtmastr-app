# Level Scheduling Scope Routing Design

**Date:** 2026-02-27  
**Status:** Approved  
**Owner:** Codex + User

---

## Problem Statement

On Categories view, clicking **Schedule Level Matches** for a `pool_to_elimination` category with generated levels can produce:

- `Draft updated: 0 matches scheduled`

This happens even when level matches exist and are schedulable.

## Root Cause Summary

The schedule dialog currently calls `scheduleMatches()` with `categoryId` only (no `levelId`), which schedules from base category scope:

- `tournaments/{t}/categories/{c}/match`

For a leveled pool-to-elimination category, base pool matches are already complete, while schedulable matches are in level scopes:

- `tournaments/{t}/categories/{c}/levels/{levelId}/match`

Result: zero schedulable matches in base scope, despite ready matches in level scopes.

---

## Goals

1. Scheduling from **Schedule Level Matches** must target level scopes for generated leveled categories.
2. Rerun must support **replace schedule** behavior for that category’s levels only.
3. Preserve existing safety rules and publish workflow semantics.
4. Add regression tests for first-run and rerun edge cases.

## Non-Goals

1. No tournament-wide scheduling redesign.
2. No new scheduling mode UI beyond required warning/copy updates.
3. No changes to bracket generation logic.

---

## Confirmed Product Decisions

1. **Scope behavior:** schedule all generated levels under the selected category in one run.
2. **Rerun behavior:** replace existing level schedule (clear/rewrite level schedule timing metadata for that category only).
3. **Boundary:** do not touch pool/base schedule rows or other categories.
4. **Lifecycle constraint:** first creation may have no schedule; reruns are allowed; publish/reschedule semantics already in product and must remain consistent.

---

## Approaches Considered

### A. Dialog-level scope routing (Selected)

Resolve schedule targets in `AutoScheduleDialog`:

- If category is leveled pool-to-elimination, run scheduler for each `levelId`.
- Otherwise keep existing base-category scheduling.

**Pros:** explicit, localized, minimal blast radius, aligns with existing caller intent.  
**Cons:** dialog orchestration gets more logic.

### B. Scheduler implicit fallback

Make `scheduleMatches()` infer levels when no `levelId` provided.

**Pros:** less caller logic.  
**Cons:** hidden behavior and potential regressions for existing callers.

### C. New explicit scope selector in dialog

Add UI control for Base vs Levels.

**Pros:** explicit user control.  
**Cons:** larger UX and testing surface, unnecessary for current need.

---

## Selected Design

### 1) Target Resolution Layer in AutoScheduleDialog

Add a target resolver that returns one or more scheduling targets per selected category:

- Base category target for non-leveled categories.
- Multi-target (one per `levelId`) for leveled `pool_to_elimination` categories.

This resolver drives sequential/parallel scheduling orchestration and result aggregation.

### 2) Replace-Level-Schedule Semantics

For leveled target runs in this flow:

- clear level schedule timing fields in level `match_scores` for selected category only
- rerun schedule across all level targets
- aggregate counts and estimated end time across targets

### 3) UX Messaging

When resolver selects level targets for the chosen category, show warning copy:

- existing level schedule for this category will be replaced
- pool/base schedule is not affected

### 4) Guardrails

Keep existing guardrails:

- no available courts → block
- missing start time → block
- pool stage preconditions remain unchanged
- completed/walkover/cancelled remain unschedulable

---

## Data Flow

1. User clicks `Schedule Level Matches` on category card.
2. `AutoScheduleDialog` opens with category selected.
3. Dialog resolves target scopes:
   - `[{categoryId, levelId: 'level-1'}, ...]` for leveled pool-to-elimination.
4. Dialog clears existing level schedule metadata for those targets (replace mode).
5. Dialog executes `scheduleMatches()` per target.
6. Dialog merges `scheduled/unscheduled/stats` into unified draft result.
7. Publish remains separate explicit action.

---

## Edge Cases to Cover

1. Category has generated levels, but one level has zero schedulable matches.
2. Mixed level status (`ready`, `in_progress`, `completed`).
3. Existing planned times present on some/all level matches before rerun.
4. Category has no levels despite `pool_to_elimination` format (fallback to current behavior + warning if needed).
5. Multi-category selection that includes both leveled and non-leveled categories.
6. No available courts / invalid allocations in parallel mode.

---

## Testing Strategy

### Unit Tests

1. Target resolver chooses level scopes for generated leveled pool-to-elimination categories.
2. Resolver falls back to base scope for non-leveled categories.
3. Replace mode clears only level schedule fields for selected category.
4. Aggregation correctly sums scheduled/unscheduled across multiple level targets.

### Integration/Behavior Tests

1. Reproduce failing case (base completed, levels ready) and assert non-zero schedule on rerun.
2. Ensure pool/base schedule data stays unchanged after level schedule rerun.
3. Ensure publish flow remains explicit and unaffected.

---

## Risks and Mitigations

1. **Risk:** accidental base scope scheduling for leveled categories.
   - **Mitigation:** explicit resolver tests + logging around resolved targets.
2. **Risk:** clearing too much schedule data.
   - **Mitigation:** clear only level `match_scores` fields for selected category and target level IDs.
3. **Risk:** regression for non-level categories.
   - **Mitigation:** fallback tests and no scheduler API behavior change.

---

## Implementation Readiness

Design is approved and ready for implementation planning.
