# Front Desk Check-In Keyboard Fast Lane Design

**Date:** 2026-03-03  
**Scope:** `src/features/checkin/views/FrontDeskCheckInView.vue`, `RapidCheckInPanel.vue`, `useFrontDeskCheckInWorkflow.ts`

---

## 1. Problem Statement

Peak check-in periods require faster operator throughput while reducing two dominant failure modes:

1. Wrong participant selected from similar names
2. Duplicate or accidental undo actions

Status clarity is still required, but as a tertiary objective.

Priority order (approved):
- P1: Throughput during busy periods
- P2: Fewer operator mistakes
- P3: Queue/check-in status clarity

Input mode (approved):
- Keyboard-first operation (not scanner-first)

---

## 2. Goals And Non-Goals

### Goals

- Minimize time from typed query to successful check-in.
- Ensure Enter key behavior is deterministic and safe.
- Keep operators on keyboard with minimal pointer interactions.
- Preserve undo capabilities without enabling accidental misuse.
- Improve at-a-glance operational visibility without adding cognitive load.

### Non-Goals

- No Firestore schema or data model changes.
- No new dependencies.
- No redesign of bulk mode interaction model beyond shared safeguards.

---

## 3. UX Principles

1. **One action target at a time**  
   Enter must act on exactly one explicit target.

2. **No hidden state transitions**  
   Active suggestion and pending action states must be visibly clear.

3. **Fast success loop**  
   After check-in, input focus returns immediately for next operator action.

4. **Guardrails over confirmations**  
   Prevent wrong actions in-flow instead of slowing operators with modal confirms.

---

## 4. Interaction Design

### 4.1 Command Input

Replace "scanner-only mental model" with a keyboard command input that accepts:
- Participant name fragments
- Registration IDs (e.g., `reg:abc123` or direct ID)
- Bib numbers

Behavior:
- Keep input focused by default and after each action.
- Clear input after successful check-in.
- `Esc` clears current query and suggestion list.

### 4.2 Suggestion List (Deterministic Targeting)

For typed names:
- Show max 8 results.
- Maintain one active suggestion index.
- `ArrowDown`/`ArrowUp` moves active index.
- `Enter` acts on active suggestion only.

Each row shows:
- Display name
- Category
- Partner/team context (if available)
- Bib number
- Status chip

If multiple matches exist:
- Show explicit collision guidance near list.
- Enter is allowed only when an active item exists.

### 4.3 Action Safety

- Per-row in-flight lock prevents duplicate submits from key repeat/double taps.
- If row status is not check-in eligible, action is disabled with reason text.
- Keep current check-in eligibility rules from workflow as source of truth.

### 4.4 Undo Model

- Preserve existing short single-item undo window.
- Add explicit countdown label in recent list (`Undo 4s`).
- Add keyboard shortcut `Ctrl/Cmd+Z` to undo latest eligible item.
- Keep bulk undo separate and clearly labeled as bulk-only.

---

## 5. Status Clarity Enhancements

Retain current top metrics chips (`Approved`, `Checked In`, `No Show`) and rate ring.

Add a compact throughput strip:
- Check-ins in last 5 minutes
- Average seconds per check-in in the recent window

Urgent queue ordering:
1. Soonest start time
2. Eligible for check-in first
3. Stable tie-breaker by name

---

## 6. Technical Mapping To Existing Architecture

### Existing Components/Composables To Reuse

- `FrontDeskCheckInView.vue`: page orchestration and store wiring
- `RapidCheckInPanel.vue`: rapid-mode input and quick actions
- `useFrontDeskCheckInWorkflow.ts`: authoritative check-in/undo business logic

### Planned Additions (No Architecture Rewrite)

- `RapidCheckInPanel.vue`
  - active suggestion index state
  - keyboard handlers
  - enriched row metadata render
  - shortcut emit for "undo latest"

- `useFrontDeskCheckInWorkflow.ts`
  - helper for undo-latest action within validity window
  - lightweight derived throughput metrics

- `FrontDeskCheckInView.vue`
  - wire keyboard undo emit to workflow action
  - render throughput strip
  - maintain focus resilience across success/error

---

## 7. Error Handling

- Preserve existing explicit error messaging and toasts.
- Continue surfacing ambiguity errors from workflow (`Multiple participants match...`).
- Use disabled reasons for ineligible participants, not silent no-op.
- If undo expires, show explicit expired feedback.

---

## 8. Accessibility

- Active suggestion row uses clear focus/selected styling.
- Keyboard operation fully supported without mouse.
- Enter action target communicated via active row semantics.
- Keep color signals paired with text labels.

---

## 9. Testing Strategy

### Unit Tests

- `RapidCheckInPanel.test.ts`
  - Arrow key navigation updates active row
  - Enter submits active row only
  - Esc clears input/suggestions
  - Undo shortcut emit behavior

- `useFrontDeskCheckInWorkflow.test.ts`
  - Undo-latest behavior inside/outside window
  - Throughput metric calculations
  - Duplicate action guard behavior

- `FrontDeskCheckInView.test.ts`
  - Undo shortcut wiring from panel to workflow
  - Throughput strip renders derived values
  - Error feedback remains intact

### Verification Commands

- `npm run test -- --run tests/unit/RapidCheckInPanel.test.ts`
- `npm run test -- --run tests/unit/useFrontDeskCheckInWorkflow.test.ts`
- `npm run test -- --run tests/unit/FrontDeskCheckInView.test.ts`
- `npm run build`
- `npm run build:log`

---

## 10. Rollout Notes

- Implement behind existing rapid mode (no route changes).
- Keep API contracts additive where possible to limit regression risk.
- If required, phase changes in two PRs:
  1. Keyboard targeting + safeguards
  2. Throughput telemetry + polish
