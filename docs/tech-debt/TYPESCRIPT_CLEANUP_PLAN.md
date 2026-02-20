# TypeScript Cleanup Plan

**Created:** 2026-02-17
**Status:** Planned
**Priority:** Medium (Post-Deployment Cleanup)

## Overview

During the production deployment of CourtMaster v2, several TypeScript errors were identified. While critical errors preventing runtime functionality were resolved, strict type checking was bypassed to ensure timely deployment. This document outlines the plan to address the remaining technical debt.

## Categories of Issues

### 1. Unused Variables and Imports (TS6133, TS6192)
**Severity:** Low (Code Quality)
**Locations:** widespread (e.g., `MatchControlView.vue`, `TournamentDashboardView.vue`, `LeaderboardTable.vue`)

*   **Issue:** Variables defined in `<script setup>` but never used in the template or script.
*   **Fix Strategy:**
    *   Audit each file.
    *   Remove unused imports.
    *   Remove unused variables.
    *   If a variable is needed for future features, comment it out or suppress the warning with `// @ts-ignore` and a reason.

### 2. Type Mismatches in Templates (TS2339, TS2345)
**Severity:** Medium (Potential Runtime Bugs)
**Locations:** `MatchControlView.vue`, `UserManagementView.vue`

*   **Issue:** Templates accessing properties that don't exist on the TypeScript interface (e.g., accessing `phone` on `User` type when it was removed).
*   **Fix Strategy:**
    *   **Strict Props:** Ensure components receiving objects (like `User` or `Match`) only access valid properties.
    *   **Interface Updates:** If the property is actually needed, update the `src/types/index.ts` definition (as done for `bibNumber`).
    *   **Casting:** Use type casting or type guards if the object shape is dynamic.

### 3. Component Prop Mismatches (TS2322)
**Severity:** Medium
**Locations:** `LeaderboardTable.vue` vs `CompactDataTable.vue`

*   **Issue:** Passing a specific array type (e.g., `LeaderboardEntry[]`) to a component expecting a generic `Record<string, unknown>[]`.
*   **Fix Strategy:**
    *   Refactor `CompactDataTable` to be fully generic (`<T>`) so it accepts typed arrays without complaint.
    *   Alternatively, map data to the expected shape before passing.

### 4. Missing Script Definitions
**Severity:** High (Runtime Crash Risk)
**Locations:** `MatchControlView.vue`

*   **Issue:** Template references variables (like `manualScores`, `showAssignCourtDialog`) that might be missing from the script section in specific files.
*   **Fix Strategy:**
    *   Ensure all reactive variables used in `v-model` or `@click` handlers are properly defined in `<script setup>`.

## Action Plan

### Phase 1: Low Hanging Fruit (Automated)
1.  Run `eslint --fix` to catch basic unused variables.
2.  Use VS Code "Organize Imports" on all files.

### Phase 2: Component Cleanup
Focus on these high-noise files first:
1.  `src/features/tournaments/views/MatchControlView.vue`
2.  `src/features/registration/views/RegistrationManagementView.vue`
3.  `src/features/tournaments/components/MatchStatsDashboard.vue`

### Phase 3: Generic Components
1.  Refactor `CompactDataTable.vue` to strictly support generics to avoid `TS2322` errors in consumers like `LeaderboardTable`.

### Phase 4: Strict Mode Verification
1.  Run `npm run type-check` (which runs `vue-tsc --noEmit`).
2.  Iterate until output is clean.
3.  Re-enable strict checking in the build pipeline (`package.json`).

## commands
```bash
# Verify current state of errors
npm run type-check
```
