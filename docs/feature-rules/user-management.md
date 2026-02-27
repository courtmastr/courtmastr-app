# User Management

## Basic Rules / Business Logic
- Users cannot remove their own admin role.
- Users cannot deactivate their own account.
- Activation toggles persist actor metadata (`deactivatedBy`, timestamps).

## Workflow (ASCII)
`[Admin Action] -> [Self-Protection Guard] -> [Store Update] -> [Toast Feedback]`

## Test Coverage
- Direct: `tests/unit/users.store.test.ts`, `tests/unit/UserManagementView.test.ts`, `tests/integration/user-management.integration.test.ts`
- Indirect: `e2e/p0-user-management.spec.ts`

## Source References
- `src/stores/users.ts`
- `src/features/admin/views/UserManagementView.vue`
- `src/features/tournaments/views/TournamentSettingsView.vue`
