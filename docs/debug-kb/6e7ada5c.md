---
id: 6e7ada5c
title: "build:log fails with existing TypeScript baseline errors"
signature: "vue-tsc -b reports widespread existing type errors across unrelated modules"
area: build
status: ❌ unresolved
tags: [typescript, vue-tsc, baseline]
artifact: 2026-02-16-11-12-48.vue-tsc-b.log
---

# KB Entry: build:log fails with existing TypeScript baseline errors

## Context
- Command: `npm run build:log`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: Added resizable command-center columns and reduced contextual status banner usage.

## Error Signature
```text
vue-tsc -b fails with many existing TS6133/TS23xx errors across admin, check-in, registration, tournament, and test files.
```

## Attempts

### Attempt 1
**Date**: 2026-02-16  
**Change**: Fixed a change-local regression (`ReadyQueue` assign handler type mismatch) and rechecked touched files.  
**Result**: ❌ Full `build:log` still fails due broad pre-existing repository type issues.

## Root Cause
Project-wide TypeScript baseline is currently failing independent of this task's changes.

## Fix (final)
No repo-wide TypeScript remediation performed in this task; only local regression was fixed.

## Verification
- [x] Changed-file lint passes
- [ ] Full build passes: `npm run build:log`

## Related Issues
- `docs/debug-kb/4bfd0fdb.md`
- `docs/debug-kb/804beb28.md`

