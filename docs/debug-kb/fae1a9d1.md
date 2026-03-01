---
id: fae1a9d1
title: "build:log reports implicit-any template handlers in TournamentSettingsView"
signature: "vue-tsc -b includes TS7006 implicit-any errors at TournamentSettingsView template update handlers"
area: build
status: ✅ fixed
tags: [build, typescript, tournament-settings]
artifact: 2026-03-01-16-30-42.vue-tsc-b.log
---

# KB Entry: build:log reports implicit-any template handlers in TournamentSettingsView

## Context
- Command: `npm run build:log`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2/.worktrees/leaderboard-scope-presets`
- Recent changes: Added ranking preset/progression settings controls in `TournamentSettingsView.vue`.

## Error Signature
```
src/features/tournaments/views/TournamentSettingsView.vue(...): error TS7006: Parameter 'value' implicitly has an 'any' type.
```

## Attempts

### Attempt 1
**Date**: 2026-03-01
**Change**: Replaced inline template lambdas with typed helper functions:
- `updateCategoryMaxPoints(...)`
- `organizerAutocompleteItemProps(...)`
- switched `@update:model-value` usage to `$event` path

**Result**: ✅ `TournamentSettingsView.vue` implicit-any errors were removed; subsequent build failures moved to existing repository baseline (`740820fc`).

## Root Cause
Inline template callback parameters in `TournamentSettingsView.vue` were inferred as `any` under strict TypeScript template checking.

## Fix (final)
Refactored inline callbacks into typed script functions and updated template bindings.

## Verification
- [x] `npm run build:log` after fix no longer reports `TournamentSettingsView.vue` TS7006 lines; failure fingerprint changed to baseline-only `740820fc`.

## Related Issues
- `740820fc` (remaining repo-wide TypeScript baseline failures)

## Notes
- This fingerprint represented a touched-file issue and was resolved within this change set.
