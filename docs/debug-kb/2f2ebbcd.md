---
id: 2f2ebbcd
title: "lint:log fails on existing repo lint-rule violations after local ESLint toolchain setup"
signature: "eslint runs and reports existing no-require-imports/no-empty/no-useless-escape/vue rule violations across unrelated files"
area: lint
status: ❌ unresolved
tags: [lint, eslint, baseline, repo-wide]
artifact: 2026-02-23-01-39-02.eslint-ext-vue-js-jsx-cjs-mjs-ts-tsx-cts-mts-fix-i.log
---

# KB Entry: lint:log fails on existing repo lint-rule violations after local ESLint toolchain setup

## Context
- Command: `npm run lint:log`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: Added explicit Sequential/Parallel controls and tooltips to Category Schedule dialog, with no lint-scope changes.

## Error Signature
```text
ESLint executes successfully but exits with existing repository violations (e.g. @typescript-eslint/no-require-imports, no-empty-pattern, no-useless-escape, vue/no-mutating-props, vue/no-deprecated-filter) across unrelated files.
```

## Attempts

### Attempt 1
**Date**: 2026-02-23  
**Change**: Installed local lint dependencies and reran `npm run lint:log`.

**Result**:
❌ New fingerprint `2f2ebbcd`. Missing-plugin blocker is resolved, but lint now fails on pre-existing repository rule violations outside this feature scope.

### Attempt 2
**Date**: 2026-02-23  
**Change**: Re-ran `npm run lint:log` after Category Schedule dialog updates (parallel mode + tooltips).

**Result**:
❌ Same fingerprint `2f2ebbcd`. Lint continues to fail on existing repository-wide violations unrelated to this feature change.

### Attempt 3
**Date**: 2026-02-23  
**Change**: Re-ran `npm run lint:log` after unifying Categories with AutoScheduleDialog and fixing schedule action visibility regression.

**Result**:
❌ Same fingerprint `2f2ebbcd`; no change to the existing repo-wide lint baseline.

### Attempt 4
**Date**: 2026-02-23  
**Change**: Re-ran `npm run lint:log` after adding dynamic schedule/re-schedule context labels and additional detail hints in `AutoScheduleDialog`.

**Result**:
❌ Same fingerprint `2f2ebbcd`; baseline lint set remains unchanged.

## Root Cause
Repository currently contains lint violations in unrelated files that are now surfaced once local ESLint + TypeScript plugin/parser are available.

## Fix (final)
Pending. Resolve the listed lint violations in affected files or explicitly narrow lint scope for CI if legacy files are intentionally excluded.

## Verification
- [ ] `npm run lint:log` exits 0
- [x] Lint command now runs with local ESLint toolchain (no missing-plugin failure)

## Related Issues
- `/Users/ramc/Documents/Code/courtmaster-v2/docs/debug-kb/b30d69e5.md`
- `/Users/ramc/Documents/Code/courtmaster-v2/docs/debug-kb/8546e9a4.md`

## Notes
- This failure is not specific to `PublicScheduleView.vue` changes.
