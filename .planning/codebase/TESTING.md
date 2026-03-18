# Testing

Testing strategy, frameworks, and verification procedures.

## Frameworks
- **Unit Testing**: Vitest + `@vue/test-utils` + `happy-dom`.
- **E2E Testing**: Playwright.
- **Interactive Debugging**: Agent-browser / OpenCode CLI.

## Test Organization
- **Unit Tests**: Located in `tests/unit/`. Named by component/store (e.g., `TournamentDashboard.test.ts`).
- **E2E Tests**: Located in `e2e/`. Configured in `playwright.config.ts`.
- **Mocks/Helpers**: Found in `tests/unit/helpers/`.

## Critical Commands
- `npm run test`: Run tests in watch mode.
- `npm run test:coverage`: Run tests with coverage report.
- `npx playwright test`: Run all E2E tests.
- `./scripts/agent-browser.sh test full`: Run full agent-browser test flow.

## Verification Requirements
- **Build Verification**: `npm run build` + `npm run build:log` mandatory for build-affecting changes.
- **Firebase Check**: `npm run check:firebase-env` required before production deploy.
- **Post-Fix Protocol**: Bug fixes must include updated patterns and verification evidence.
