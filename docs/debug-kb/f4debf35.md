---
id: f4debf35
title: "lint:log fails on existing repository-wide ESLint baseline violations during release automation verification"
signature: "eslint --fix reports baseline repo errors after a local run-and-log regex escape issue is corrected"
area: lint
status: 🟡 workaround
tags: [lint, baseline, release-automation]
artifact: 2026-03-29-15-03-45.eslint-ext-vue-js-jsx-cjs-mjs-ts-tsx-cts-mts-fix-i.log
---

# KB Entry: lint:log fails on existing repository-wide ESLint baseline violations during release automation verification

## Context
- Command: `npm run lint:log`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: Added release versioning docs, release CLI scripts, release-note verification helpers, and release workflow tests.

## Error Signature
```text
eslint exits with repository-wide errors in unrelated legacy files after flagging one local no-useless-escape issue in scripts/run-and-log.mjs.
```

## Attempts

### Attempt 1
**Date**: 2026-03-29
**Change**: Ran `npm run lint:log`, fixed the touched-file lint error in `scripts/run-and-log.mjs`, then re-ran scoped ESLint on the release automation files and tests.

**Result**: 🟡 Scoped lint for changed release files is clean; full-repository lint remains blocked by existing baseline errors in unrelated `e2e/`, `scripts/`, `src/`, and older `tests/unit/` files.

## Root Cause
Repository-wide ESLint baseline debt still breaks full `lint:log`, even after the only lint violation introduced in the touched release-automation files was fixed.

## Fix (final)
```bash
npm run lint:log
ESLINT_USE_FLAT_CONFIG=false eslint scripts/run-and-log.mjs scripts/release/release-cli.mjs scripts/release/release-utils.mjs scripts/testing/release-notes-utils.mjs scripts/testing/verify-release.mjs scripts/testing/write-test-run-summary.mjs tests/unit/release-utils.test.ts tests/unit/release-notes-utils.test.ts tests/unit/verify-release.test.ts tests/unit/test-run-summary.test.ts tests/unit/test-catalog.report-markdown.test.ts tests/unit/test-catalog.report-html.test.ts --ext .mjs,.ts
npm run build
npm run build:log
```

## Verification
- [x] Scoped changed files lint clean
- [x] Build passes: `npm run build`
- [x] Logged build passes: `npm run build:log`
- [ ] Repository-wide lint baseline is cleaned up

## Related Issues
- `docs/debug-kb/2627fce6.md`
- `docs/debug-kb/73e2457c.md`
- `docs/debug-kb/43636cee.md`

## Notes
- Treat the remaining full-repo lint failure as baseline debt unless the output points at files changed in the current release-automation work.
