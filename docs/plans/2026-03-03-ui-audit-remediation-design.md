# UI Audit Remediation Design

**Date:** 2026-03-03  
**Source:** UI audit across 16 organizer/public pages  
**Status:** Approved

---

## Problem Summary

The audit indicates high-value UI/UX issues are concentrated in:

1. State trust and message consistency (especially public schedule messaging)
2. Priority signal quality in operational queues
3. Disabled-action clarity and validation transparency
4. Navigation/workflow cognitive load
5. Dense-data readability and responsive table behavior

The previously reported persistent "Changes not saved" signal was not observed manually and is treated as an unverified automated finding until reproduced.

---

## Scope

### In Scope

1. Organizer workflow clarity in create/check-in/match-control/navigation
2. Public schedule and bracket clarity
3. Queue urgency semantics
4. Disabled-state explanation patterns
5. Responsive handling for long-content table cells

### Out of Scope

1. Backend schema migrations
2. Firestore security rule changes
3. Dependency additions
4. Non-audit unrelated refactors

---

## Validation Gate (Step 0)

Before implementation, each audit issue is verified manually and tagged:

1. `Confirmed`
2. `False Positive`
3. `Needs More Evidence`

Only confirmed issues move into implementation phases. This prevents spending cycles on automation artifacts.

Evidence fields per issue:

1. Route URL
2. Repro steps
3. Expected vs actual behavior
4. Screenshot (if visual)

---

## Approaches Considered

### Option A: Risk-First Stabilization (Recommended)

Fix trust-breaking inconsistencies first, then interaction clarity, then readability polish.

Pros:

1. Fastest reduction in operator confusion
2. Lower risk of shipping contradictory UI states
3. Supports iterative deployment

Cons:

1. Requires strict phase discipline

### Option B: Page-by-Page Sweep

Follow audit row order and fix each page in sequence.

Pros:

1. Easy traceability to audit spreadsheet

Cons:

1. Repeated changes to shared components
2. Slower realization of highest-risk fixes

### Option C: Shared-Component First

Refactor all shared primitives before page updates.

Pros:

1. Cleaner architecture

Cons:

1. Slower time-to-value
2. Higher initial change surface

---

## Selected Strategy

Adopt **Option A (Risk-First Stabilization)** with PR-sized sequential phases and phase gates.

---

## One-by-One Remediation Phases

### Phase 1: State Trust and Messaging Consistency

Targets:

1. `PublicScheduleView` contradictory publish/not-published states
2. Manual verification of global "Changes not saved" finding

Expected outcome:

1. No conflicting schedule status states shown simultaneously
2. No global unsaved warning unless tied to active dirty forms

### Phase 2: Queue Urgency Signal Quality

Targets:

1. `MatchQueueList` urgency rules and score thresholds
2. Ensure urgency labels represent true priority

Expected outcome:

1. `URGENT` is sparse and meaningful
2. Operators can trust queue coloring/ranking

### Phase 3: Disabled Action Explainability

Targets:

1. Tournament create step navigation
2. Check-in disabled actions where reason is unclear

Expected outcome:

1. Disabled primary actions provide immediate rationale
2. Validation friction becomes self-correcting

### Phase 4: Workflow and Navigation Clarity

Targets:

1. Command vs live/read-only surfaces (aligned with CP-033)
2. Reduce duplicate mental models in routing/labels

Expected outcome:

1. One clear operational command center
2. Read-only contexts remain read-only

### Phase 5: Dense View Readability and Responsive Cleanup

Targets:

1. Public and organizer bracket readability
2. Long URL behavior in overlay tables on smaller viewports

Expected outcome:

1. Better scanning in bracket-heavy screens
2. Reduced horizontal overflow pain

---

## Architecture and Data Flow Notes

1. Respect existing route ownership in `src/router/index.ts`.
2. Keep state decisions local to relevant views/composables (avoid global leakage).
3. Reuse existing composables and stores (`useParticipantResolver`, Pinia stores) per current conventions.
4. Preserve current Firestore model constraints and data-model migration rules.

---

## Error Handling Strategy

1. Keep explicit try/catch and contextual logs.
2. Surface user-facing failures via `notificationStore.showToast`.
3. Do not silently suppress failed writes/subscriptions.
4. If `:log` command fails, use Debug KB protocol (fingerprint search/update).

---

## Testing and Verification Strategy

For each phase:

1. Add/adjust focused unit tests first
2. Run targeted tests for touched views/components
3. Run `npm run lint:log` for every phase
4. Run broader integration tests where phase touches cross-view behavior

Global completion gate:

1. `npm run lint:log`
2. `npm run test:log -- --run` (or selected suite + rationale)
3. `npm run build:log` for final integration confidence

---

## Risks and Mitigations

1. **Risk:** Fixing message logic could hide valid states.  
   **Mitigation:** encode explicit precedence rules and add unit tests.

2. **Risk:** Urgency algorithm changes may reorder operations unexpectedly.  
   **Mitigation:** introduce deterministic threshold tests.

3. **Risk:** Disabled-reason UI can introduce visual clutter.  
   **Mitigation:** use concise tooltip/helper-text patterns only on blocked primary actions.

---

## Approval Record

1. User requested one-by-one plan.
2. Validation gate approved.
3. Phase sequence approved.

