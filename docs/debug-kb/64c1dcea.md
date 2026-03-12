---
id: 64c1dcea
title: "test:log fails when TournamentSponsorStrip component import does not exist yet"
signature: "Vitest import analysis cannot resolve @/components/common/TournamentSponsorStrip.vue"
area: test
status: ✅ fixed
tags: [test, vitest, tdd, sponsor-branding]
artifact: 2026-03-12-12-31-43.vitest-run-tests-unit-TournamentSponsorStrip-test-.log
---

# KB Entry: test:log fails when TournamentSponsorStrip component import does not exist yet

## Context
- Command: `npm run test:log -- --run tests/unit/TournamentSponsorStrip.test.ts`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2/.worktrees/feat-sponsor-branding`
- Recent changes: Added the first TDD test for a shared sponsor strip component before implementing the component.

## Error Signature
```
Failed to resolve import "@/components/common/TournamentSponsorStrip.vue" from "tests/unit/TournamentSponsorStrip.test.ts".
```

## Attempts

### Attempt 1
**Date**: 2026-03-12
**Change**: Added `tests/unit/TournamentSponsorStrip.test.ts` before creating `TournamentSponsorStrip.vue`.

**Result**: ❌ Expected red-phase failure; Vitest could not resolve the component import because it had not been implemented yet.

### Attempt 2
**Date**: 2026-03-12
**Change**: Implemented `src/components/common/TournamentSponsorStrip.vue` with sponsor ordering, linked logos, and sponsor-name fallback rendering.

**Result**: ✅ `npm run test:log -- --run tests/unit/TournamentSponsorStrip.test.ts` passed with the expected link, logo, and fallback text rendering.

## Root Cause
The new sponsor strip test referenced a component file that had not been created yet.

## Fix (final)
```bash
# Add the missing shared sponsor strip component and rerun the targeted test.
npm run test:log -- --run tests/unit/TournamentSponsorStrip.test.ts
```

## Verification
- [x] Test passes: `npm run test:log -- --run tests/unit/TournamentSponsorStrip.test.ts`

## Related Issues
- None

## Notes
- This is an expected red-phase TDD failure while introducing a new shared component.
