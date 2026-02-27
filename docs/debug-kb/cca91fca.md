---
id: cca91fca
title: "lint:log fails on existing repository-wide ESLint baseline violations"
signature: "eslint exits with multiple pre-existing rule violations across e2e scripts, scripts/*.cjs/*.mjs, and Vue components/tests"
area: lint
status: ❌ unresolved
tags: [eslint, baseline, non-blocking]
artifact: 2026-02-27-05-37-01.eslint-ext-vue-js-jsx-cjs-mjs-ts-tsx-cts-mts-fix-i.log
---

# KB Entry: lint:log fails on existing repository-wide ESLint baseline violations

## Context
- Command: `npm run lint:log`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: Fixed `scripts/start-dev-terminal.sh` path handling after moving scripts under `scripts/`.

## Error Signature
```
✖ 42 problems (16 errors, 26 warnings)
```

## Attempts

### Attempt 1
**Date**: 2026-02-27
**Change**: Ran required verification command after script fix; reviewed failing files in lint output and compared against changed scope.

**Result**: ❌ Still fails with unrelated baseline lint errors (e.g., `@typescript-eslint/no-require-imports` in `scripts/*.cjs`, `vue/no-mutating-props`, deprecated filters, empty block statements).

## Root Cause
Repository has pre-existing lint debt outside the touched file; current change does not introduce new lint errors.

## Fix (final)
No fix applied in this task (out of scope for requested script path repair).

## Verification
- [x] Lint attempted: `npm run lint:log`
- [x] Failure fingerprint captured: `cca91fca`
- [x] Artifact logged: `docs/debug-kb/_artifacts/2026-02-27-05-37-01.eslint-ext-vue-js-jsx-cjs-mjs-ts-tsx-cts-mts-fix-i.log`

## Related Issues
- `1ac6f3c2` (similar lint baseline failure)
- `2078f8ff` (similar lint baseline failure)

## Notes
- Treat as known baseline until dedicated lint-cleanup workstream addresses accumulated errors.
