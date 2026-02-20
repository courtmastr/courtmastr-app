---
id: 0a9dffa2
title: "test:log fails on firebase/testing import in diagnose_data suite"
signature: "Missing './testing' specifier in 'firebase' package"
area: test
status: ❌ unresolved
tags: [vitest, firebase, import, legacy-test]
artifact: 2026-02-20-14-20-31.vitest-run.log
---

# KB Entry: test:log fails on firebase/testing import in diagnose_data suite

## Context
- Command: `npm run test:log -- --run`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: Added GitHub Actions CI/CD workflow for Firebase deploy on `master`.

## Error Signature
```text
Error: Missing "./testing" specifier in "firebase" package
```

## Attempts

### Attempt 1
**Date**: 2026-02-20
**Change**: Ran required `test:log` validation after CI/CD workflow changes.

**Result**:
❌ Fails on `tests/diagnose_data.test.ts` importing deprecated `firebase/testing`.

## Root Cause
A legacy test file uses deprecated `firebase/testing` import, which is not exported by the installed Firebase SDK.

## Fix (final)
Pending. Migrate the test to `@firebase/rules-unit-testing` (or exclude this legacy suite from the default test run) and re-run `npm run test:log -- --run`.

## Verification
- [ ] `npm run test:log -- --run` exits 0
- [ ] No import-analysis errors for `firebase/testing`

## Related Issues
- `docs/debug-kb/84b85c5f.md`
- `docs/debug-kb/435e808f.md`

## Notes
- 126 tests passed; failure is isolated to `tests/diagnose_data.test.ts` import.
