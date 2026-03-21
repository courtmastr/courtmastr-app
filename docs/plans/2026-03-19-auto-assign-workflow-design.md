# Auto-Assign Workflow Design

**Date:** 2026-03-19

## Goal
Fix the level scheduling and live-ops workflow so organizers see the correct CTA after level scheduling, published matches become eligible for live assignment, and blocked matches explain exactly why they were skipped.

## Problem Statement
- Category cards can remain on a scheduling CTA after level matches have already been scheduled and published.
- Match Control shows backlog while auto-assign does not move matches to courts.
- Queue items can appear blocked as "players not checked-in" even when organizers report those players are already checked in.
- The current UI does not clearly explain which match was skipped, why it was skipped, and why another match was assigned instead.

## Required Behavior
- Publish-phase CTAs must show publish actions, not schedule actions.
- Auto-assign should evaluate only the specific match being considered, not the entire category.
- A match is eligible for auto-assign only when:
  - it is in a ready/playable queue state
  - it has a planned time
  - it is published
  - all registrations for that match are checked in
  - its planned time is now or within the next 10 minutes
- If queue item 1 is blocked, auto-assign may skip it and assign queue item 2 if queue item 2 is eligible.
- Organizers must see explicit reasons when a match is skipped.

## Reproduction Strategy
Use the browser to reproduce the exact organizer path shown in the screenshots:
1. Open Categories and inspect the category card CTA for the affected level schedule.
2. Open Match Control and inspect queued matches, court availability, and alert state.
3. Pick one blocked doubles match and trace:
   - match ID
   - category/level scope
   - planned time
   - published status
   - participant registration IDs
   - checked-in status on those specific registrations
4. Compare what Match Control renders against the raw match/registration state.

## Proposed Fix

### 1. Browser-verified root cause trace
- Reproduce the issue in the app first using browser automation.
- Confirm whether the mismatch is:
  - stale category CTA phase derivation
  - stale match queue eligibility derivation
  - incorrect doubles registration resolution
  - stale registration subscription state in Match Control

### 2. Category CTA correction
- Keep category phase logic aligned with schedule status and published status for level-scoped matches.
- Ensure publish-phase CTA emits a publish action for pool, level, and elimination publish states.

### 3. Match Control eligibility model
- Introduce separate derived lists:
  - `dueAssignableMatches`
  - `dueBlockedMatches`
- Derive block reasons per match from the same gating logic used by assignment.
- Make auto-assign consume `dueAssignableMatches`, not the raw queue.

### 4. Organizer-visible feedback
- Add clear alert/activity entries such as:
  - `Skipped MD #2: Rahul Yadav not checked in`
  - `Auto-assigned MD #3 to Court 1 because it was the next eligible match`
- Backlog messaging should distinguish between:
  - assignable pressure
  - blocked pressure

### 5. Doubles-specific verification
- Verify that check-in gating uses the registration IDs attached to the queued match, not unrelated player IDs or category-wide counts.
- Confirm that only the players in that match matter.

## Files Likely In Scope
- `src/features/tournaments/components/CategoryRegistrationStats.vue`
- `src/features/tournaments/views/MatchControlView.vue`
- `src/stores/matches.ts`
- `src/features/tournaments/components/AlertsPanel.vue`
- `tests/unit/CategoryRegistrationStats.test.ts`
- `tests/unit/MatchControlView*.test.ts`
- `tests/integration/match-assignment.integration.test.ts`

## Risks
- Doubles/team registrations may be resolved differently in queue rendering vs assignment gating.
- Existing watchers may not rerun when publish/check-in state changes.
- Repo-wide lint baseline is noisy; verification must rely primarily on targeted tests plus build gates.

## Verification Plan
- Browser reproduction of the affected organizer flow
- Targeted unit tests for CTA state and auto-assign skip behavior
- Integration coverage for assignment blockers on published matches
- Required build gates:
  - `npm run check:firebase-env`
  - `npm run build`
  - `npm run build:log`

