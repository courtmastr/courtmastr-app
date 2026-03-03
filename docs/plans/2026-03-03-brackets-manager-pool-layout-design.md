# Brackets Manager Pool Stage Layout Design

**Date:** 2026-03-03
**Status:** Approved for implementation

## Problem
Pool-stage bracket display in `BracketsManagerViewer` is hard to read in browser view because game rounds and pool ranking table are not visible together in an efficient layout.

## Scope
- In scope:
  - `BracketsManagerViewer` only
  - `round_robin` (pool) stages only
  - Desktop + mobile responsive presentation behavior
- Out of scope:
  - `SmartBracketView` changes
  - Single elimination layout changes
  - Double elimination layout changes
  - Firestore queries, data models, or bracket-generation logic

## Goals
1. Show pool games and pool table in a clearer side-by-side desktop layout.
2. Preserve usability on mobile with a safe stacked fallback.
3. Keep behavior/data flow unchanged (presentation-only).

## Chosen Approach
Use a CSS-first approach with tightly-scoped `:deep()` selectors in `BracketsManagerViewer`:
- Add a round-robin guard class from stage type.
- Apply desktop split layout to `.round-robin .group`.
- Keep mobile stacked fallback with overflow handling.

## Alternatives Considered
1. Post-render DOM rearrangement after `viewer.render()`.
   - Rejected: brittle against `brackets-viewer` internal structure changes.
2. Full custom Vue renderer for pool stage.
   - Rejected: high effort and maintenance, duplicates viewer logic.

## Visual Behavior
### Desktop
- One pool group per row.
- Left column: pool rounds/games.
- Right column: pool ranking table (sticky where feasible).

### Mobile
- Single-column stacked view within each group.
- Sticky table disabled.
- Table remains readable with horizontal overflow handling.

## Technical Design
1. Derive `isRoundRobinStage` from loaded `stages`.
2. Add wrapper class conditionally (e.g., `is-round-robin`).
3. Add scoped CSS selectors under that wrapper for:
   - `.round-robin` container flow
   - `.group` grid columns on desktop
   - `h2` full-width heading
   - `table` right-column placement + sticky
   - media-query fallback to single column

## Safety Constraints
- Do not modify `fetchBracketData`, real-time listeners, or `viewer.render` payload.
- Do not target elimination-specific selectors.
- Avoid fragile nth-child selectors where possible.

## Verification Plan
1. Open a tournament with pool-stage category and verify desktop side-by-side layout.
2. Resize to mobile breakpoint and verify stacked readability.
3. Verify single elimination remains unchanged.
4. Verify double elimination remains unchanged.
5. Run:
   - `npm run build:log`
   - `npm run lint:log`
   - `npm run test:log -- --run tests/unit/leaderboard.test.ts`

## Acceptance Criteria
- Pool stage in `BracketsManagerViewer` is visually easier to scan on desktop.
- Mobile remains usable without layout breakage.
- No regression in single/double elimination displays.
- Required verification commands executed and logged.
