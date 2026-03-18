# Structure

Directory layout and repository organization.

## Root Directories
- `src/`: Core application source code.
- `functions/`: Firebase Cloud Functions source (TypeScript).
- `docs/`: Documentation, including process guides, coding patterns, and debug KB.
- `public/`: Static assets (icons, manifest, etc.).
- `tests/`: Automated tests (Unit, E2E).
- `scripts/`: Development and maintenance scripts (seeding, logging, environment checks).
- `.agents/`: Agent-specific workflows, skills, and configuration.

## `src/` Layout
- `features/`: Modular domain-specific features (Components, Views, etc.).
- `stores/`: Pinia global state stores.
- `composables/`: Reusable logic hooks.
- `services/`: Low-level API/Firebase integrations.
- `plugins/`: Vue plugins (Vuetify, I18n).
- `components/`: Shared/Common UI components.
- `types/`: Domain type definitions.

## Key Files
- `src/main.ts`: Application entry point and initialization.
- `src/App.vue`: Root Vue component and layout orchestration.
- `src/router/index.ts`: Vue Router configuration.
- `AGENTS.md`: Authoritative agent authority contract.
- `package.json`: Dependency and script configuration.
- `firebase.json`: Firebase project configuration.
- `firestore.rules`: Security rules for the database.
