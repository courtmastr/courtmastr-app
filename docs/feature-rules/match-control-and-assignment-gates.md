# Match Control And Assignment Gates

## Basic Rules / Business Logic
- Assignment is gated by schedule visibility and participant readiness/check-in.
- Admin override path (`Assign Anyway`) is role-restricted.
- Court assignment and release transitions must keep match/court state consistent.

## Workflow (ASCII)
`[Match Candidate] -> [Gate Evaluation] -> [Assign/Block/Override] -> [Live Court State]`

## Test Coverage
- Direct: `tests/unit/MatchControlView.assignments.test.ts`, `tests/unit/assignmentGate.test.ts`, `tests/integration/match-assignment.integration.test.ts`
- Indirect: `e2e/p0-match-control-scoring.spec.ts`, `e2e/p0-auth-and-role-guards.spec.ts`

## Source References
- `src/features/tournaments/views/MatchControlView.vue`
- `src/stores/matches.ts`
- `src/stores/tournaments.ts`
