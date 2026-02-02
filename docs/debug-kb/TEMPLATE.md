---
id: <8-char-fingerprint>
title: "Brief description of the issue"
signature: "Normalized error signature (strip paths/line numbers)"
area: build|test|deploy|dev|lint|firebase
status: 🔍 investigating|❌ unresolved|✅ fixed
tags: [tag1, tag2, tag3]
artifact: <timestamp>.<command>.log
---

# KB Entry: <title>

## Context
<!-- What were you trying to do when this error occurred? -->
- Command: `npm run build`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: <!-- What changed before this failure? -->

## Error Signature
<!-- The normalized error that generated the fingerprint -->
```
error TS Cannot find module '@/components/Button'
```

## Attempts

### Attempt 1
**Date**: 2026-01-31
**Change**: <!-- What did you try? -->
Checked if node_modules exists, ran `npm install`

**Result**: <!-- What happened? -->
❌ Same error

### Attempt 2
**Date**: 2026-01-31
**Change**: <!-- What did you try next? -->
Updated tsconfig.json to include path alias

**Result**: <!-- What happened? -->
❌ Same error, different module

### Attempt 3
**Date**: 2026-01-31
**Change**: <!-- What finally worked? -->
Deleted node_modules and package-lock.json, fresh install

**Result**: <!-- What happened? -->
✅ Build succeeded

## Root Cause
<!-- Document the actual root cause once you find it -->
Corrupted node_modules from switching between branches with different package versions.

## Fix (final)
<!-- Exact steps/commands that resolved the issue -->
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Verification
<!-- How did you confirm the fix works? -->
- [ ] Build passes: `npm run build` exits 0
- [ ] No TypeScript errors in output
- [ ] App starts successfully: `npm run dev`

## Related Issues
<!-- Links to related KB entries -->
- None

## Notes
<!-- Any additional context, links, references -->
- Happens when switching between feature branches
- May need to restart TypeScript service in IDE
