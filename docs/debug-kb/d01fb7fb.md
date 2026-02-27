---
id: d01fb7fb
title: "MatchControl BYE/TBD test fixture helper ignored overrides"
signature: "slot-state test expected BYE but got TBD because makeMatch helper always returned default participant/status"
area: test
status: "✅ fixed"
tags: [test, fixture, helper]
artifact: 2026-02-27-15-36-33.vitest-tests-unit-MatchControlView-assignments-tes.log
---

# KB Entry: MatchControl BYE/TBD test fixture helper ignored overrides

## Context
- Command: `npm run test:log -- tests/unit/MatchControlView.assignments.test.ts`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: Added BYE/TBD assertions using per-test fixture overrides.

## Error Signature
```
AssertionError: expected 'TBD' to be 'BYE'
```

## Attempts

### Attempt 1
**Date**: 2026-02-27
**Change**: Added direct `useMatchSlotState` checks in test to validate fixture assumptions.

**Result**:
❌ Direct check also returned `TBD`, confirming fixture generation issue.

### Attempt 2
**Date**: 2026-02-27
**Change**: Refactored `makeMatch` helper to accept `overrides: Partial<Match>` and spread overrides into base fixture.

**Result**:
✅ BYE fixture now resolves correctly and suite passes.

## Root Cause
`makeMatch` was defined without parameters, so override arguments were silently ignored.

## Fix (final)
```bash
# In tests/unit/MatchControlView.assignments.test.ts:
# const makeMatch = (overrides: Partial<Match> = {}): Match => ({ ...base, ...overrides })

npm run test:log -- tests/unit/MatchControlView.assignments.test.ts
```

## Verification
- [x] `npm run test:log -- tests/unit/MatchControlView.assignments.test.ts` exits 0

## Related Issues
- `docs/debug-kb/3bb69418.md`
- `docs/debug-kb/20c8bab2.md`
