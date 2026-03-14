---
id: 7d5ef9fc
title: "test:log fails because OverlayBoardView still stringifies structured sponsor objects"
signature: "OverlayBoardView sponsor footer joins structured sponsor objects into [object Object]"
area: test
status: ✅ fixed
tags: [test, overlay, sponsor-branding, vitest]
artifact: 2026-03-12-12-33-58.vitest-run-tests-unit-OverlayBoardView-test-ts.log
---

# KB Entry: test:log fails because OverlayBoardView still stringifies structured sponsor objects

## Context
- Command: `npm run test:log -- --run tests/unit/OverlayBoardView.test.ts`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2/.worktrees/feat-sponsor-branding`
- Recent changes: Added an overlay test that passes structured sponsor objects instead of legacy `string[]`.

## Error Signature
```
OverlayBoardView sponsor footer joins structured sponsor objects into [object Object]
```

## Attempts

### Attempt 1
**Date**: 2026-03-12
**Change**: Added a new overlay test asserting structured sponsor data renders sponsor names instead of object-string coercion.

**Result**: ❌ Failed because the overlay still used `sponsors.join(', ')`, producing `[object Object]` in the footer.

### Attempt 2
**Date**: 2026-03-12
**Change**: Updated `OverlayBoardView` to consume `useTournamentBranding()`, render structured sponsor items with logo/name fallback, and stubbed `TournamentBrandMark` in the unit test.

**Result**: ✅ `npm run test:log -- --run tests/unit/OverlayBoardView.test.ts` passed with the structured sponsor assertion green.

## Root Cause
`OverlayBoardView` still assumes `currentTournament.sponsors` is a plain `string[]` and does not normalize structured sponsor records before rendering.

## Fix (final)
```bash
# Switch the overlay to normalized sponsor data instead of joining raw sponsor objects.
npm run test:log -- --run tests/unit/OverlayBoardView.test.ts
```

## Verification
- [x] Overlay test passes: `npm run test:log -- --run tests/unit/OverlayBoardView.test.ts`

## Related Issues
- None

## Notes
- The structured sponsor data path is required for tournament logo and sponsor logo rollout.
