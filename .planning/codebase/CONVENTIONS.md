# Conventions

Coding style, naming conventions, and best practices.

## Coding Style
- **Vue**: Composition API (`<script setup lang="ts">`) is mandatory.
- **TypeScript**: Strict mode enabled. No `any`, no `@ts-ignore`. Explicit return types.
- **UI**: Vuetify components exclusively.
- **Imports**: Use `@/` alias for `src/` imports. Order: Vue → Stores → Composables → Services → Types.

## Naming
- **Components**: PascalCase (e.g., `MatchCard.vue`).
- **Composables**: camelCase with `use` prefix (e.g., `useMatchScheduler.ts`).
- **Stores**: camelCase with `Store` suffix (e.g., `tournaments.ts` exports `useTournamentStore`).
- **Types**: PascalCase (e.g., `Tournament`, `MatchStatus`).
- **Constants**: UPPER_SNAKE_CASE.

## Patterns (from `docs/coding-patterns/`)
- **CP-001**: Use `v-dialog` instead of native `confirm()`/`alert()`.
- **CP-002**: Implement reverse lookup fallbacks for cross-collection references.
- **CP-003**: Use `writeBatch` for atomic multi-document updates.
- **CP-005**: Use `notificationStore.showToast` for user feedback.
- **CP-006**: Use `serverTimestamp()` for all date fields.
- **CP-011**: Use `useParticipantResolver()` for all participant name resolutions.

## Error Handling
- Use try/catch with explicit error messages and logging.
- Re-throw after logging for upstream handling.
- Always provide user feedback via toasts.
