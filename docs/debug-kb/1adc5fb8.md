---
id: 1adc5fb8
title: "Logged skip-blocked auto-assign test used a helper that ignored overrides"
signature: "vitest MatchControlView.auto-assign.test expected match-eligible but helper still produced match-1 because makeMatch ignored overrides"
area: test
status: ✅ fixed
tags: [test, vitest, fixture]
artifact: 2026-03-19-22-30-53.vitest-run-tests-unit-CategoryRegistrationStats-te.log
---

# KB Entry: Logged skip-blocked auto-assign test used a helper that ignored overrides

## Context
- Command: `npm run test:log -- --run tests/unit/CategoryRegistrationStats.test.ts tests/unit/MatchControlView.auto-assign.test.ts tests/unit/AlertsPanel.assignmentGate.test.ts`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: added a second auto-assign scenario for skipping blocked matches.

## Error Signature
```
skip-blocked auto-assign test expected match-eligible but makeMatch always returned match-1
```

## Attempts

### Attempt 1
**Date**: 2026-03-19
**Change**: Added a second scenario using `makeMatch({ id: 'match-eligible' })`.

**Result**:
❌ Helper ignored overrides, so the fixture stayed `match-1` and the assertion failed.

### Attempt 2
**Date**: 2026-03-19
**Change**: Updated `makeMatch` to accept `Partial<Match>` overrides.

**Result**:
✅ The test fixture produced distinct blocked and eligible matches.

## Root Cause
The helper constructing MatchControlView auto-assign fixtures always returned the default `match-1` object because it did not accept overrides.

## Fix (final)
```bash
# In MatchControlView.auto-assign.test.ts
# - Change makeMatch() to makeMatch(overrides: Partial<Match> = {})
# - Spread overrides into the returned fixture
```

## Verification
- [x] Targeted MatchControlView auto-assign tests pass
- [x] Logged targeted workflow tests pass

## Related Issues
- [348ed354](./348ed354.md)
- [0f10a24a](./0f10a24a.md)

## Notes
- This fingerprint is a fixture bug in the unit test, not a product regression.
