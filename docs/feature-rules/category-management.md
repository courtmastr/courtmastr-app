# Category Management

## Basic Rules / Business Logic
- Categories are configured with format, eligibility, and scoring defaults.
- Category updates must keep bracket/state compatibility.
- Category actions feed downstream seeding, bracket generation, and scheduling flows.

## Workflow (ASCII)
`[Create Category] -> [Configure Rules] -> [Update/Validate] -> [Ready For Brackets]`

## Test Coverage
- Direct: `tests/unit/CategoryManagement.test.ts`, `tests/integration/category-management.integration.test.ts`
- Indirect: `e2e/p0-category-management.spec.ts`, `tests/unit/useBracketGenerator.logic.test.ts`

## Source References
- `src/features/tournaments/views/CategoriesView.vue`
- `src/stores/tournaments.ts`
