# Registration Management

## Basic Rules / Business Logic
- Registrations are authoritative participant entries for match and scoring references.
- Approval/check-in/no-show status transitions are validated and auditable.
- Registration updates must preserve participant identity mapping used across stores.

## Workflow (ASCII)
`[Register] -> [Approve/Reject] -> [Check-In] -> [Active In Match Flow]`

## Test Coverage
- Direct: `tests/unit/RegistrationManagementView.test.ts`, `tests/unit/registrations.store.test.ts`, `tests/integration/registration-management.integration.test.ts`
- Indirect: `tests/unit/SelfRegistrationView.test.ts`, `e2e/self-registration.spec.ts`

## Source References
- `src/features/registration/views/RegistrationManagementView.vue`
- `src/stores/registrations.ts`
