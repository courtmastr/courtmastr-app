---
id: fdd064ce
title: "targeted player merge tests failed after UX route refactor"
signature: "Vitest syntax error from unbalanced Vue template and stale guard assertion on deprecated merge path"
area: test
status: "✅ fixed"
tags: [vitest, vue, router]
artifact: 2026-04-02-20-20-11.vitest-run-tests-unit-PlayersListView-test-ts-test.log
---

# KB Entry: targeted player merge tests failed after UX route refactor

## Context
- Command: `npm run test:log -- --run tests/unit/PlayersListView.test.ts tests/unit/PlayerProfileView.test.ts tests/unit/PlayerMergeView.test.ts tests/unit/playerMerge.route.test.ts tests/unit/router-guards-auth.test.ts`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: Refactored player merge UX from per-player buttons to a single players-page merge entry and shared merge workspace.

## Error Signature
```
SyntaxError: Element is missing end tag.
AssertionError: expected 'redirect' to be 'allow'
```

## Attempts

### Attempt 1
**Date**: 2026-04-02
**Change**: Restored the missing nested `div` closure in `PlayerProfileView.vue` and updated the auth-guard test to use `/players/merge` as the primary admin path.

**Result**:
✅ Targeted tests passed

## Root Cause
The UI refactor removed a header action from `PlayerProfileView` without rebalancing the nested wrappers, and one router-guard test still asserted the old deep-link route as the primary merge entry.

## Fix (final)
```bash
# Repair the unbalanced template structure in PlayerProfileView.vue
# Update guard assertions to target /players/merge

npm run test -- --run tests/unit/PlayersListView.test.ts tests/unit/PlayerProfileView.test.ts tests/unit/PlayerMergeView.test.ts tests/unit/playerMerge.route.test.ts tests/unit/router-guards-auth.test.ts
npm run test:log -- --run tests/unit/PlayersListView.test.ts tests/unit/PlayerProfileView.test.ts tests/unit/PlayerMergeView.test.ts tests/unit/playerMerge.route.test.ts tests/unit/router-guards-auth.test.ts
```

## Verification
- [x] Targeted player merge tests pass
- [x] Logged targeted player merge tests pass
- [x] App build passes after the refactor

## Related Issues
- [a941f8d0](./a941f8d0.md)

## Notes
- Legacy `/players/:playerId/merge` still redirects into the shared merge workspace with the source player preselected.
