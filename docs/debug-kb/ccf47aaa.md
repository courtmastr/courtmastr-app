---
id: ccf47aaa
title: "lint:log fails on existing repository-wide ESLint baseline violations"
signature: "eslint exits with multiple pre-existing rule violations across e2e fixtures, scripts/*.cjs/*.mjs, and unrelated Vue files"
area: lint
status: 🟡 workaround
tags: [eslint, baseline, non-blocking]
artifact: 2026-02-27-06-28-28.eslint-ext-vue-js-jsx-cjs-mjs-ts-tsx-cts-mts-fix-i.log
---

# KB Entry: lint:log fails on existing repository-wide ESLint baseline violations

## Context
- Command: `npm run lint:log -- src/features/tournaments/components/CreateLevelsDialog.vue tests/unit/CreateLevelsDialog.test.ts`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: Fixed initial-load regression in `CreateLevelsDialog` by making open watcher immediate and added unit coverage.

## Error Signature
```
✖ 46 problems (16 errors, 30 warnings)
```

## Attempts

### Attempt 1
**Date**: 2026-02-27
**Change**: Reviewed failing lint output, confirmed failures are outside changed scope, and ran scoped lint directly against touched files.

**Result**: 🟡 `npm run lint:log` still fails due existing baseline errors, but scoped lint passes for changed files:
`ESLINT_USE_FLAT_CONFIG=false npx eslint src/features/tournaments/components/CreateLevelsDialog.vue tests/unit/CreateLevelsDialog.test.ts --ext .vue,.ts --ignore-path .gitignore`

## Root Cause
The `lint:log` script invokes repository-wide linting, and existing unrelated baseline violations cause failure even when touched files are clean.

## Fix (final)
No repository-wide lint cleanup was applied in this task; used scoped lint verification for touched files as a workaround.

## Verification
- [x] `npm run lint:log -- src/features/tournaments/components/CreateLevelsDialog.vue tests/unit/CreateLevelsDialog.test.ts` (fails with baseline violations, fingerprint `ccf47aaa`)
- [x] `ESLINT_USE_FLAT_CONFIG=false npx eslint src/features/tournaments/components/CreateLevelsDialog.vue tests/unit/CreateLevelsDialog.test.ts --ext .vue,.ts --ignore-path .gitignore` (passes)

## Related Issues
- `cca91fca` (same baseline lint failure class)
- `1ac6f3c2` (same baseline lint failure class)

## Notes
- Treat as known lint baseline debt until dedicated cleanup workstream addresses repository-wide violations.
