# MCIA Badminton 2026 Men's Doubles Seed Design

Date: 2026-03-02
Status: Approved

## Goal
Create an emulator-only seed script that inserts a new tournament named `MCIA Badminton 2026` with one category `Men's Doubles`, where pool membership is fixed to the user-provided Group A-G composition after bracket generation in UI.

## Scope
- In scope:
  - Create tournament + one category (`pool_to_elimination`)
  - Create players and team registrations for 28 teams
  - Assign deterministic seeds to preserve exact group placement when UI generates pools
  - Provide command to run on Firebase emulators
- Out of scope:
  - Schedule generation
  - Match result updates
  - Level split generation

## Chosen Approach
Recommended approach selected:
1. Add a dedicated seed core script for MCIA 2026 data.
2. Add a local emulator entrypoint script.
3. Add npm script command.
4. Keep pool generation in UI using existing `groups.effort_balanced` flow.

Reasoning:
- Reuses existing app behavior and avoids direct writes to bracket internals.
- Keeps changes minimal and maintainable.
- Gives deterministic pool composition through seed ordering.

## Data Design
Tournament:
- Name: `MCIA Badminton 2026`
- Status/state: active/live for immediate test workflow

Category:
- Name: `Men's Doubles`
- Type: `doubles`
- Format: `pool_to_elimination`
- `teamsPerPool`: 4
- `poolSeedingMethod`: `serpentine`
- `seedingEnabled`: true

Registrations:
- 28 team registrations (participantType `team`)
- Each team includes two player docs and `teamName`
- Seed assignment used only to enforce exact pool membership outcome

## Deterministic Pool Strategy
Input groups are fixed (A-G, each with 4 teams). For this project's current pool generation behavior (as seen in UI), seeds are grouped by columns:
- Pool 1 receives seeds `1, 8, 15, 22`
- Pool 2 receives seeds `2, 9, 16, 23`
- ...
- Pool 7 receives seeds `7, 14, 21, 28`

So seed rows must remain forward A→G each slot:
- Seeds 1-7: A1, B1, C1, D1, E1, F1, G1
- Seeds 8-14: A2, B2, C2, D2, E2, F2, G2
- Seeds 15-21: A3, B3, C3, D3, E3, F3, G3
- Seeds 22-28: A4, B4, C4, D4, E4, F4, G4

This produces pools with exact target membership A through G.

## Validation and Safety
Script validations:
- Exactly 7 groups and 4 teams per group
- No duplicate team names
- Seed map length equals 28

Script output includes:
- Tournament ID
- Category ID
- Seed audit table (`seed -> slot -> teamName`)

## Execution Flow
1. Start emulators.
2. Run `npm run seed:mcia2026:local`.
3. Open UI and generate bracket/pools for Men's Doubles.
4. User manually creates schedule in UI.

## Files to Add/Change
- Add `scripts/seed/mcia2026-core.ts`
- Add `scripts/seed/mcia2026-local.ts`
- Update `package.json` scripts with `seed:mcia2026:local`

## Verification Plan
- Run `npm run lint:log`
- Run `npm run build:log`
- Confirm no Debug KB fingerprint failures
