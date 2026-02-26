# Feature Test Closure Design

**Date:** 2026-02-26
**Owner:** Codex + Ramc
**Status:** Approved

## Goal
Ensure every documented feature has direct automated coverage for business rules and edge cases, using a risk-tiered max-confidence test strategy.

## Scope
- In-scope: all 20 feature docs in `docs/feature-rules/`.
- In-scope layers: unit, component, emulator/integration for all features.
- In-scope E2E: only high-risk user journeys (risk-tiered).
- Out of scope: unrelated product changes or feature behavior refactors.

## Requirements Summary
- Test cases must exist for each feature.
- Edge cases must be covered for each feature.
- Coverage posture in feature docs should have no remaining `Missing` classification when complete.

## Approaches Considered

### 1. Monolithic all-at-once
- Pros: fastest apparent completion.
- Cons: high merge/debug risk and low triage clarity.

### 2. Risk-tiered waves (Selected)
- Pros: strongest confidence with controlled complexity and progressive risk burn-down.
- Cons: needs strict traceability matrix governance.

### 3. E2E-first then backfill
- Pros: quick top-level user-flow confidence.
- Cons: weak rule-level confidence and brittle failures.

## Selected Strategy
**Risk-tiered max confidence** with mandatory direct coverage across all features:
- Unit + component + emulator/integration for every feature.
- Playwright E2E only for high-risk journeys.

## Success Criteria
- Each feature has direct tests for core rules and edge cases.
- All side-effect-heavy paths are integration-tested against emulators.
- High-risk journeys have deterministic E2E happy/failure coverage.
- `docs/feature-rules/*.md` coverage sections updated with no `Missing` items.

## Test Architecture
1. Unit (`tests/unit`): pure rule/guard/state logic.
2. Component (`tests/unit` with `@vue/test-utils`): UI gating, dialogs, validation.
3. Emulator/Integration (`tests/integration`): Firestore/Auth/Functions effects.
4. E2E (`tests/e2e`, Playwright): high-risk full journeys only.

## Feature-To-Layer Matrix

| Feature | Unit | Component | Emulator/Integration | Playwright E2E |
|---|---|---|---|---|
| Auth and Route Access | Yes | Yes | Yes | Yes |
| Tournament Lifecycle and State | Yes | Yes | Yes | No |
| Tournament Management | Yes | Yes | Yes | Yes |
| Category Management | Yes | Yes | Yes | No |
| Court Management | Yes | Yes | Yes | No |
| Registration Management | Yes | Yes | Yes | Yes |
| Front Desk Check-In | Yes | Yes | Yes | Yes |
| Self Check-In Kiosk | Yes | Yes | Yes | Yes |
| Bracket Generation | Yes | Yes | Yes | Yes |
| Pool Leveling | Yes | Yes | Yes | No |
| Time-First Scheduling | Yes | Yes | Yes | Yes |
| Match Control and Assignment Gates | Yes | Yes | Yes | Yes |
| Scoring and Match Completion | Yes | Yes | Yes | Yes |
| Score Correction | Yes | Yes | Yes | Yes |
| Leaderboard and Tiebreakers | Yes | Yes | Yes | No |
| Reports and Analytics Summary | Yes | Yes | Yes | No |
| Public Views | Yes | Yes | Yes | Yes |
| Overlay and OBS Views | Yes | Yes | Yes | No |
| Notifications/Activities/Alerts/Audit | Yes | Yes | Yes | No |
| User Management | Yes | Yes | Yes | Yes |

## Edge-Case Catalog (Must-Have)

1. Auth and Route Access
- guest/auth redirects, role gates, overlay auth bypass, initAuth loading path.

2. Tournament Lifecycle and State
- invalid transitions, emergency unlock, edit-lock assertions, state/status synchronization.

3. Tournament Management
- organizer scoping query, create defaults, date validation, audit side-effects.

4. Category Management
- required fields, format-specific fields, check-in close timestamp, scoring-lock behavior.

5. Court Management
- delete-block when in-use, maintenance reassignment and no-court fallback, maintenance restore.

6. Registration Management
- duplicate email race-safe check, doubles partner validation, status/undo transitions, payment updates, self-registration branching.

7. Front Desk Check-In
- scan parsing variants, ambiguity handling, smallest bib allocation, non-approved guard, undo expiry windows.

8. Self Check-In Kiosk
- query threshold behavior, waiting-for-partner flow, presence status derivation, non-eligible status immutability.

9. Bracket Generation
- minimum participants, seeding behavior, pool-elimination blocking on pending matches, delete/reset metadata.

10. Pool Leveling
- missing stage errors, mode recommendations, pool-position mapping, global-band overflow handling.

11. Time-First Scheduling
- rest/concurrency limits, locked-time skip, end-time unscheduled reasons, publish/unpublish transitions.

12. Match Control and Assignment Gates
- blockers, admin override constraints, maintenance/in-use court blocks, unschedule clear-state options.

13. Scoring and Match Completion
- game/match completion thresholds, completion side-effects, walkover path, non-fatal bracket-advance failures.

14. Score Correction
- correction metadata increments, correction-history append, winner-change reversal path.

15. Leaderboard and Tiebreakers
- participant resolution joins, tiebreak hierarchy, equal-standing ranks, format-specific elimination semantics.

16. Reports and Analytics Summary
- duration exclusion logic, participation denominator, utilization calculation, CSV output assertions.

17. Public Views
- not-found behavior, published schedule filtering, search matching, ready-match auto-start guard.

18. Overlay and OBS Views
- no-auth behavior, live/ready/idle precedence, ticker duplication continuity, board carousel bounds.

19. Notifications/Activities/Alerts/Audit
- unread notification toasts, alert acknowledge/resolve stamps, audit no-actor non-blocking behavior.

20. User Management
- self-demote/self-deactivate protections, role/profile merge updates, active/inactive metadata writes.

## Execution Waves
- Wave A: Auth + lifecycle + tournament/category/court/registration foundations.
- Wave B: Match engine (brackets, leveling, scheduling, assignment, scoring, correction, leaderboard).
- Wave C: Experience layer (public/overlay/obs/reports/ops/user-management).
- Wave D: Risk-tiered E2E hardening and flake stabilization.

## Acceptance Gates
1. Direct tests for all features' core rules and edge cases.
2. Emulator/integration coverage for all side-effect features.
3. High-risk E2E paths pass (happy + critical failure paths).
4. Verification commands pass in `:log` mode.
5. Feature docs updated with final coverage posture and evidence links.

## Risks and Mitigations
- Risk: test brittleness from async realtime listeners.
  - Mitigation: deterministic fixtures, explicit waits, fake timers where possible.
- Risk: emulator setup drift.
  - Mitigation: shared test utilities and setup/teardown wrappers.
- Risk: overfitting to implementation details.
  - Mitigation: prefer behavior assertions and contract-level checks.
