---
id: f745beab
title: "build:log fails on Vue macro import conflict for withDefaults"
signature: "TS2440: Import declaration conflicts with local declaration of 'withDefaults'"
area: build
status: "✅ fixed"
tags: [typescript, vue, script-setup]
artifact: 2026-02-22-18-39-16.vue-tsc-b.log
---

# KB Entry: build:log fails on Vue macro import conflict for withDefaults

## Context
- Command: `npm run build:log`
- Working directory: `/Users/ramc/Documents/Code/courtmaster-v2`
- Recent changes: Added schedule lifecycle/actions and refactored category/public schedule views.

## Error Signature
```
TS2440: Import declaration conflicts with local declaration of 'withDefaults'
```

## Attempts

### Attempt 1
**Date**: 2026-02-22
**Change**: Removed `withDefaults` from `import { ... } from 'vue'` in `src/features/tournaments/components/CategoryRegistrationStats.vue` and used Vue `<script setup>` macro directly.

**Result**: ✅ Build completed successfully.

## Root Cause
`withDefaults` is a `<script setup>` compile macro and should not be imported from `vue`; importing it creates a duplicate declaration.

## Fix (final)
```bash
# In src/features/tournaments/components/CategoryRegistrationStats.vue
# before
import { computed, ref, withDefaults } from 'vue'

# after
import { computed, ref } from 'vue'
```

## Verification
- [x] Build passes: `npm run build:log` exits 0
- [x] No TypeScript errors in output
- Command run: `npm run build:log`
- Success artifact: `docs/debug-kb/_artifacts/2026-02-22-18-40-01.vue-tsc-b.log`

## Related Issues
- None

## Notes
- This can appear after refactors that introduce `withDefaults(defineProps(...))`.
