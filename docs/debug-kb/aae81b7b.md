---
id: aae81b7b
title: "build:log fails with existing workspace TypeScript baseline errors"
signature: "vue-tsc -b reports widespread TS6133/TS2339/TS2307 baseline errors across unrelated files"
area: build
status: ❌ unresolved
tags: [typescript, build, baseline-errors]
artifact: 2026-02-19-15-59-22.vue-tsc-b.log
---

# KB Entry: build:log fails with existing workspace TypeScript baseline errors

## Context
- Command: `npm run build:log`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: Match Control Phase 1 redesign updates for Command Center + Live View (running status board, live-view navigation route, release shortcuts).

## Error Signature
```
vue-tsc -b
error TS6133 / TS2339 / TS2307 across existing admin, check-in, registration, scoring, tournament, and test files
```

## Attempts

### Attempt 1
**Date**: 2026-02-19
**Change**: Re-ran `npm run build:log` after frontend-only Match Control redesign slice to verify no regressions.

**Result**:
❌ Fails with broad pre-existing workspace TypeScript errors outside the touched scope.

### Attempt 2
**Date**: 2026-02-19
**Change**: Re-ran `npm run build:log` after wiring the running status board into Match Control modes and syncing route query state for `view`.

**Result**:
❌ Fails with the same broad pre-existing workspace TypeScript errors outside the touched scope.

## Root Cause
The workspace currently has unresolved TypeScript baseline issues in many unrelated files, so `vue-tsc -b` fails before build completion.

## Fix (final)
Not resolved in this ticket. Resolve existing workspace-wide TypeScript errors, then rerun:
```bash
npm run build:log
```

## Verification
- [ ] `npm run build:log` exits 0

## Related Issues
- `docs/debug-kb/de0f55eb.md`
- `docs/debug-kb/ac505761.md`
- `docs/debug-kb/f057263e.md`

## Notes
- This failure is not isolated to the files changed in this task.
