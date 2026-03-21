# Workflow Test Hardening Design

**Date:** 2026-03-19

## Goal

Make the suite catch the real workflow regressions around level publish CTA, public schedule visibility, partial doubles check-in, and match-control auto-assign skipping.

## Root Cause

The current suite is green because the strongest tests stop at mocked view/store logic, while the Playwright layer mostly reuses a generic seeded tournament and conditionally skips when the right operational state is missing.

## Approach Options

### Option 1: Add more unit tests only

- Fastest to write.
- Weakest at catching Firebase shape, seed, and UI-state regressions.

### Option 2: Add deterministic emulator-backed workflow scenarios

- Seeds exact Firestore state for publish, check-in, queue, and public schedule.
- Exercises the actual UI with no runtime skips.
- Best fit for the bugs seen in CourtMastr.

### Option 3: Replace all generic E2E seeding

- Strong long-term cleanup.
- Too large for this pass and would increase risk.

## Recommendation

Use Option 2. Keep existing unit/integration tests, then add deterministic Playwright scenarios backed by direct Firestore seeding helpers. Replace or tighten the weakest workflow-related skip-based assertions rather than attempting a full E2E rewrite.

## Scenario Design

### Scenario A: Level Publish CTA and Public Schedule

- Seed a tournament with one category and one level schedule in `draft` with `plannedStartAt`.
- Verify category CTA shows publish rather than schedule.
- Publish from the UI.
- Verify the public schedule page shows the published match.

### Scenario B: Partial Doubles Check-In and Auto-Assign

- Seed a doubles category with multiple published due matches.
- Match 1: one team partially checked in.
- Match 2: one team not checked in.
- Match 3: both teams fully checked in.
- Verify Match Control shows blocker reasons on blocked rows.
- Verify auto-assign skips blocked rows and assigns the next eligible match.
- Verify organizer alerts explain both the skipped and assigned decisions.

## Test Strategy

- Keep unit tests for pure gate logic and CTA derivation.
- Add emulator-backed E2E for the end-to-end workflow that currently escapes mocks.
- Remove conditional skips only where the new deterministic scenario makes them unnecessary.

## Files Expected

- `e2e/utils/workflow-scenarios.ts`
- `e2e/p0-match-control-scoring.spec.ts`
- `e2e/p0-public-views.spec.ts`
- Possibly `e2e/fixtures/auth-fixtures.ts` or a new helper for scenario-scoped auth/seed access
- Targeted supporting unit tests only if a gap remains after E2E hardening

## Verification

- Focused Playwright runs for the new scenarios
- Full Vitest run
- Build verification
- Coverage run to confirm the new tests contribute signal, while separately documenting existing coverage parser limitations
