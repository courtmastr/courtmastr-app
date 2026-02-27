# Auth And Route Access

## Basic Rules / Business Logic
- Protected routes require an authenticated user.
- Admin-only routes reject non-admin roles and redirect to `/tournaments`.
- Scorekeeper-only routes reject non-scorekeeper roles.
- Public routes (`/bracket`, `/schedule`, `/score`, `/self-checkin`) bypass auth guards.

## Workflow (ASCII)
`[Route Enter] -> [Check requiresAuth] -> [Check role gate] -> [Allow or Redirect]`

## Test Coverage
- Direct: `tests/unit/router-guards-auth.test.ts`, `tests/unit/frontDeskRoute.test.ts`, `tests/unit/selfCheckInRoute.test.ts`, `e2e/p0-auth-and-role-guards.spec.ts`
- Indirect: `e2e/p0-user-management.spec.ts`

## Source References
- `src/router/index.ts`
- `src/stores/auth.ts`
