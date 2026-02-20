---
id: de0f55eb
title: "build:log fails with existing workspace TypeScript baseline errors"
signature: "vue-tsc -b reports widespread TS6133/TS2339/TS2307 baseline errors across unrelated files"
area: build
status: ❌ unresolved
tags: [typescript, build, baseline-errors]
artifact: 2026-02-19-05-58-12.vue-tsc-b.log
---

# KB Entry: build:log fails with existing workspace TypeScript baseline errors

## Context
- Command: `npm run build:log`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: Added level-aware match path handling and level subscriptions for match scheduling/control flows.

## Error Signature
```
vue-tsc -b
error TS6133 / TS2339 / TS2307 across existing admin, check-in, registration, scoring, tournament, and test files
```

## Attempts

### Attempt 1
**Date**: 2026-02-19
**Change**: Re-ran `npm run build:log` after level path updates to verify no regressions.

**Result**:
❌ Fails with broad pre-existing workspace TypeScript errors outside the touched scope.

## Root Cause
The workspace currently has unresolved TypeScript baseline issues in many unrelated files, so `vue-tsc -b` fails before build completion.

## Fix (final)
Not resolved in this ticket. Resolve the existing workspace-wide TypeScript errors, then rerun:
```bash
npm run build:log
```

## Verification
- [ ] `npm run build:log` exits 0

## Related Issues
- `docs/debug-kb/ac505761.md`
- `docs/debug-kb/f057263e.md`
- `docs/debug-kb/94826621.md`

## Notes
- This failure is not isolated to the files changed in this task.
