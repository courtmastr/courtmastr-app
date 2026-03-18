# Concerns

Technical debt, risks, and known issues.

## Technical Debt
- **Shared Resolvers**: Many components still use local participant lookup logic instead of `useParticipantResolver()` (see CP-011).
- **Match Scoring Paths**: Legacy paths for match scoring exist; migration to category-scoped paths is in progress (see CP-012).
- **Brackets Manager Coupling**: Heavy reliance on `brackets-manager` schema; migration to operational sync via `/match_scores` is complex.

## Known Risks
- **Offline Sync Conflicts**: Concurrent edits in offline mode require careful resolution (addressed via CP-003 batches).
- **Production Env Leaks**: Risks of `undefined` environment variables in build (guarded by `check:firebase-env`).
- **UI Consistency**: Vuetify "Cyan Circle" ripple bugs (addressed by global CSS overrides in `App.vue`).

## Documented Issues (Debug KB)
- The 프로젝트 maintain a comprehensive `docs/debug-kb/` for error fingerprints and fixes.
- Recurring patterns include:
  - Component lifecycle sync with Firebase state.
  - Vuetify injection failures in unit tests (addressed by CP-067).
  - Router guard timeouts during aggregate test runs (addressed by CP-069).
