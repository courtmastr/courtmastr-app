# Code Cleanup & Refactoring Plan

**Source:** Repo Review Findings
**Status:** In Progress

## Key Findings
1. **Good foundation:** Feature-based organization, heavy composable usage, TypeScript strict mode
2. **Major duplication:** 39+ dialog states, 50+ async patterns, 6 timestamp converters
3. **Oversized views:** 3 views exceed 1,600 lines (industry standard: <400)
4. **Missing abstractions:** No shared dialog wrapper, no empty state component

## Action Plan

### Week 1 (Foundation)
- [ ] Create `useDialogManager()` composable
- [x] Consolidate `getParticipantNames()` into `useParticipantResolver` (Completed CP-011)
- [ ] Extract `convertTimestamps()` to utility
- [x] Remove duplicate navigation components (Completed Phase 1)

### Week 2-3 (Implementation)
- [x] Create `BaseDialog.vue` wrapper (Completed)
- [x] Create `EmptyState.vue` component (Completed)
- [ ] Create `useAsyncOperation()` composable
- [ ] Extract dialogs from `MatchControlView.vue`

### Sprint Planning (Deep Refactor)
- [ ] Break down `MatchControlView.vue` into sub-components
- [ ] Break down `RegistrationManagementView.vue`

## Expected Outcomes
- ~1,000 lines of code removed
- 40-50% reduction in duplicated logic
- Improved maintainability
- Better developer experience
