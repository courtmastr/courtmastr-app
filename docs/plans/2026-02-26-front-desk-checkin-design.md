# Front Desk Check-In Screen Design

Date: 2026-02-26  
Status: Approved  
Scope: Replace current `/tournaments/:tournamentId/checkin` UI with a dual-mode front desk experience.

## 1. Problem and Goals

Front desk operators need a faster and safer check-in workflow during live tournament operations:

- Single check-in in under 3 seconds.
- Bulk check-in (20 players) in under 10 seconds.
- Zero-error workflow with clear undo and conflict feedback.

This design keeps the existing Firestore and check-in gate semantics used by court assignment, while redesigning the operator surface for rapid execution.

## 2. Confirmed Product Decisions

- Mode scope: full dual-mode in v1 (Rapid + Bulk).
- Scan payload: auto-detect either registration/QR token or bib input.
- Scanner integration v1: keyboard-wedge/manual typing only (no live camera scanning).
- Undo policy: per-item undo (5s) and bulk undo (10s).
- Bulk error handling: partial success (do not rollback successful rows).
- Bib assignment policy: smallest available bib from a start value.
- Route behavior: replace current check-in screen at existing route.
- Stats semantics:
  - `approved_total = approved + checked_in + no_show`
  - `rate = checked_in / approved_total`

## 3. Approaches Considered

1. Single monolithic view component.
2. Shell + mode components + shared workflow composable. (Selected)
3. Separate rapid/bulk routes.

Selected approach #2 balances speed and maintainability while preserving one operational screen.

## 4. Architecture

## 4.1 Proposed components

- `src/features/checkin/views/FrontDeskCheckInView.vue`
  - Sticky top action bar, mode toggle, shared stats/progress/overlay host.
- `src/features/checkin/components/RapidCheckInPanel.vue`
  - Scanner input, urgent queue ("now playing"), recent check-ins with undo.
- `src/features/checkin/components/BulkCheckInPanel.vue`
  - Selection list, batch toolbar, progress, summary, batch undo.
- `src/features/checkin/composables/useFrontDeskCheckInWorkflow.ts`
  - Shared workflow engine across both modes.

## 4.2 Existing dependencies reused

- `useRegistrationStore()` for registration status and bib mutations.
- `useTournamentStore()` plus existing match data readers for urgency.
- `useParticipantResolver()` for participant naming.
- Existing check-in gate behavior used by match assignment (CP-039) remains unchanged.

## 5. Data Flow and State

## 5.1 Rapid scan flow

1. Receive raw scan text from focused scanner input.
2. Parse and auto-detect payload type (registration token first, bib fallback).
3. Resolve one registration candidate.
4. Validate eligibility (`approved` required for check-in).
5. If bib missing, assign smallest available bib from configured start.
6. Persist check-in mutation.
7. Emit UI feedback (overlay, toast, recent list entry, focus return).

## 5.2 Urgency ordering

Urgent candidates are derived from participants with matches starting in the next 30 minutes and sorted by:

1. earliest start time,
2. not checked in,
3. current filters/category context.

After successful rapid check-in, focus and scroll move to the next urgent unchecked item.

## 5.3 Bulk flow

- Selection supports row toggle, master toggle, and shift-range.
- Batch executes deterministically (v1 sequential processing for stable bib assignment).
- Partial-success summary reports successes and failures.
- Retry action targets only failed IDs.

## 5.4 Undo state

- Item action undo window: 5 seconds.
- Bulk action undo window: 10 seconds.
- Undo is best-effort and reports rows that changed after original action.

## 6. Interaction Design

## 6.1 Rapid mode

- Scanner input auto-focus on load and after each action.
- Keyboard shortcuts: `ArrowUp`, `ArrowDown`, `Space`, `Enter`, `Ctrl/Cmd+A`, `Esc`.
- Success feedback: short green overlay + toast.
- Duplicate/invalid scan: non-blocking error state with clear message.

## 6.2 Bulk mode

- Sticky bulk toolbar with:
  - master select,
  - `Check In Selected (N)`,
  - `Assign Bibs` menu.
- Batch progress indicator during execution (`X/Y`).
- Completion summary:
  - success: count and bib range when contiguous,
  - partial: success/failure counts and retry.

## 7. Error Handling and Safety

- Parse failure: "No matching participant for scanned code."
- Ambiguous match: disambiguation dialog with participant and category.
- Bib conflict: preflight validation blocks conflicting assignment and highlights conflict.
- Network mutation failure: preserve selection/input; report actionable error.
- All failures logged with context via `console.error`.

## 8. Accessibility and Operational Safety

- Minimum 44px touch targets.
- High contrast text and status indicators that do not rely on color only.
- Undo countdown surfaces are explicit and time-bounded.
- Keyboard-first operation remains available in both modes.

## 9. Acceptance Criteria

- Median rapid check-in interaction time <= 3 seconds in normal network conditions.
- Bulk check-in of 20 rows <= 10 seconds in normal network conditions.
- No silent failures; all errors produce visible operator feedback.
- Check-in rate card uses approved-total formula selected above.

## 10. Test Strategy

- Unit tests for workflow composable:
  - scan parsing and detection,
  - smallest-available bib assignment,
  - undo timer behavior,
  - partial-success summaries.
- Component tests:
  - rapid focus lock,
  - bulk selection and shift-range,
  - progress and undo bars.
- Integration tests:
  - status/bib mutation correctness,
  - stats formula correctness.
- E2E smoke:
  - rapid happy path,
  - duplicate scan path,
  - bulk partial-failure path.

## 11. Out of Scope (v1)

- Live webcam camera QR scanning.
- Confetti or heavy celebratory animations.
- Permanent unlimited undo history.
