# Feature Rules Documentation Design

**Date:** 2026-02-26  
**Owner:** Codex + Ramc  
**Status:** Approved for planning

## Goal

Create a code-grounded documentation set that captures each implemented feature's:

- scope
- basic rules / business logic
- workflow (ASCII diagram)
- data touchpoints
- access control
- edge cases
- test coverage status
- source references

## Scope Decision

This design covers **implemented features in code/routes only** (not spec-only future features).

## Output Location

Create a new folder:

- `docs/feature-rules/`

Deliverables:

- `docs/feature-rules/README.md` (index and navigation)
- One markdown file per implemented feature

## Planned Feature Docs

1. `auth-and-route-access.md`
2. `tournament-lifecycle-and-state.md`
3. `tournament-management.md`
4. `category-management.md`
5. `court-management.md`
6. `registration-management.md`
7. `front-desk-checkin.md`
8. `self-checkin-kiosk.md`
9. `bracket-generation.md`
10. `pool-leveling.md`
11. `time-first-scheduling.md`
12. `match-control-and-assignment-gates.md`
13. `scoring-and-match-completion.md`
14. `score-correction.md`
15. `leaderboard-and-tiebreakers.md`
16. `reports-and-analytics-summary.md`
17. `public-views.md`
18. `overlay-and-obs-views.md`
19. `notifications-activities-alerts-audit.md`
20. `user-management.md`

## Per-Feature Document Schema

Every feature file uses this structure:

1. `# <Feature Name>`
2. `## Purpose`
3. `## Scope (Implemented)`
4. `## Basic Rules / Business Logic`
5. `## Workflow (ASCII)`
6. `## Data Touchpoints`
7. `## Access Control`
8. `## Failure & Edge Cases`
9. `## Test Coverage`
10. `## Source References`

## Rule Extraction Method

Primary source order:

1. `src/stores/*` (authoritative business actions/constraints)
2. `src/composables/*` (domain and workflow rules)
3. `src/features/*/views` (UI behavior and gating)
4. `src/router/index.ts` (route and role access constraints)

Rule quality gates:

- Include only logic explicitly enforced by code paths.
- If behavior is unclear or only implied, label it as not enforced.
- Each rule must map to at least one source reference.

Coverage taxonomy:

- **Direct**: tests import/execute production logic module
- **Indirect**: E2E or UI behavior coverage without direct unit coverage
- **Missing**: no meaningful test found for that rule area

## Workflow Modeling Standard (ASCII Required in Every Feature Doc)

Each feature doc must include:

- happy path
- guard/failure branch
- persistence/state transition points
- post-actions (audit/log/notify) when applicable

Standard form:

```text
[Trigger]
   |
   v
[Pre-checks] --fail--> [Blocked + Message]
   |
   v
[Action/Mutation] --> [Persist]
   |
   v
[Post-actions] --> [Result State]
```

For simple features, use a minimal flow:

```text
[Load Data] -> [Filter/Transform] -> [Render]
      | fail
      v
 [Empty/Error State]
```

## Non-Goals

- No code behavior changes.
- No new feature implementation.
- No dependency additions.
- No refactor of existing docs outside `docs/feature-rules/` (except link/index updates if needed).

## Acceptance Criteria

- `docs/feature-rules/` exists with index + per-feature files.
- Every file includes an ASCII workflow.
- Rules are code-grounded with source references.
- Coverage section uses direct/indirect/missing classification.
- Feature set matches implemented scope.

## Risks and Mitigation

- **Risk:** Drift between docs and code.  
  **Mitigation:** Tie every rule to concrete source files.

- **Risk:** Overstating test coverage.  
  **Mitigation:** Separate direct vs indirect coverage explicitly.

- **Risk:** Inconsistent doc style across files.  
  **Mitigation:** Enforce one shared schema/template.
