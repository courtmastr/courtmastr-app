# Bracket Generation

## Basic Rules / Business Logic
- Generation strategy depends on category format and participant readiness.
- Bracket writes must initialize required stage/group/round/match structures.
- Pool-to-elimination categories must preserve phase boundaries.

## Workflow (ASCII)
`[Validate Category + Registrations] -> [Generate Structure] -> [Persist Match Graph] -> [Expose In UI]`

## Test Coverage
- Direct: `tests/unit/useBracketGenerator.test.ts`, `tests/unit/useBracketGenerator.logic.test.ts`, `tests/unit/bracket.test.ts`, `tests/integration/bracket-generation.integration.test.ts`
- Indirect: `e2e/p0-seeding-management.spec.ts`

## Source References
- `src/composables/useBracketGenerator.ts`
- `src/stores/tournaments.ts`
