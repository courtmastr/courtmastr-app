# Leaderboard Scope And Preset System Design

**Date:** March 1, 2026  
**Status:** Approved for planning

## Overview
Build a unified leaderboard system that keeps one ranking algorithm core, but splits presentation by scope and adds configurable preset-based ranking rules.

For `pool_to_elimination` categories, leaderboard UX becomes:
1. `Pool` leaderboard (historical and always available)
2. `Category` leaderboard (continuation of full category journey)

No separate level leaderboard table is required.

## Goals
1. Keep the current ranking behavior as default.
2. Allow organizers/admins to choose ranking calculation via fixed presets.
3. Support tournament-level default with per-category override.
4. Keep pool leaderboard available as history and live-recomputed.
5. Preserve one shared ranking engine to avoid drift.

## Non-Goals
1. No custom formula editor.
2. No per-level leaderboard UI.
3. No materialized leaderboard table writes to Firestore (compute on demand).

## Product Decisions (Locked)
1. Ranking is split into different areas/scopes.
2. For pool-to-elimination flow, show pool ranking first and category ranking next.
3. Category ranking is continuation of full category journey.
4. Pool ranking must remain visible as history.
5. Pool ranking is live-recomputed (score corrections propagate).
6. Settings are editable by `organizer` and `admin`.
7. Configuration inheritance:
- Tournament-wide default.
- Category-level override.

## Architecture

### 1. Single Engine, Multiple Scopes
Keep one ranking engine (current `useLeaderboard` core algorithm), parameterized by:
1. `scopeSelector` (which matches are included)
2. `rankingPreset` (points + tie-break sequence)

This avoids duplicated logic across pool/category/tournament calculations.

### 2. Scope Dataset Selectors
Define deterministic dataset selectors:
1. `pool_scope`
- Only pool-stage matches for a category.
- For standard categories without pool stage, not applicable.
2. `category_scope`
- All matches in the category timeline (pool and post-pool stages).
- This is the “full category journey” ranking.
3. `tournament_scope`
- Union of category-scope results across selected categories.

For `pool_to_elimination`, UI exposes `pool_scope` and `category_scope` only.

### 3. Effective Config Resolution
For each category leaderboard request:
1. Read tournament default ranking settings.
2. Read category override settings.
3. Resolve effective config:
- `effectivePreset = category.presetOverride ?? tournament.presetDefault`
- `effectiveProgressionMode = category.progressionOverride ?? tournament.progressionDefault`

`effectiveProgressionMode` is retained in schema for compatibility with current and future options.

## Ranking Preset Model
Use fixed presets only.

### Required Presets (Initial)
1. `courtmaster_default` (current behavior, default)
2. `bwf_strict` (explicit BWF semantics/order)
3. `simple_ladder` (reduced/industry-style tie-break stack)

### Preset Contract
Each preset declares:
1. Match points policy (`win`, `loss`, `walkoverWin`, `walkoverLoss`)
2. Tie-break step order
3. Metric normalization behavior (raw or per-match normalization)
4. Equal-standing policy

## Data Model Changes

### Tournament Settings
Extend `TournamentSettings` with leaderboard defaults:
1. `rankingPresetDefault`
2. `progressionModeDefault`

### Category
Add optional category overrides:
1. `rankingPresetOverride?`
2. `progressionModeOverride?`

### Suggested Types
1. `RankingPresetId = 'courtmaster_default' | 'bwf_strict' | 'simple_ladder'`
2. `RankingProgressionMode = 'carry_forward' | 'phase_reset'`

## UI Design

### Leaderboard View
1. Add scope toggle for pool-to-elimination categories:
- `Pool`
- `Category`
2. Keep tournament/category route structure unchanged.
3. Add descriptor text for active scope and active preset.

### Settings UI
1. Tournament settings page:
- Set default ranking preset.
- Set default progression mode.
2. Category settings section:
- Optional override preset.
- Optional override progression mode.
- Clear override action (falls back to tournament default).
3. Access control:
- Visible/editable only for organizer/admin roles.

## Calculation Semantics
1. Pool leaderboard always calculated from current pool-stage match data.
2. Category leaderboard always calculated from full category match data.
3. No persisted standings snapshot.
4. Score corrections update results naturally at next recompute.

## Validation And Error Handling
1. Unknown preset ID:
- Fallback to `courtmaster_default`.
- Warn in console with context.
2. Missing override fields:
- Use tournament defaults.
3. Missing defaults in legacy tournaments:
- Auto-resolve to `courtmaster_default` + `carry_forward`.
4. Empty scope dataset:
- Return empty leaderboard with standard empty-state messaging.

## Testing Strategy

### Unit Tests
1. Preset resolution and fallback behavior.
2. Scope selector correctness (`pool_scope` vs `category_scope`).
3. Inheritance logic (`category override ?? tournament default`).
4. Default preset parity against current ordering behavior.

### Integration Tests
1. Pool-to-elimination category renders both pool and category scopes.
2. Pool scores correction changes both scope outputs after recompute.
3. Settings updates from organizer/admin affect effective preset.

### E2E
1. Organizer changes tournament default preset and sees leaderboard update.
2. Category override supersedes tournament default.
3. Pool leaderboard remains accessible after elimination/levels start.

## Migration Strategy
1. Backward-compatible read path with defaults when fields absent.
2. Optional one-time migration script to set explicit defaults on existing tournaments.
3. No destructive data migration required.

## Rollout Plan
1. Phase 1: Backend/composable model + tests.
2. Phase 2: Leaderboard scope UI.
3. Phase 3: Tournament/category settings UI + permissions.
4. Phase 4: E2E + docs + release notes.

## Risks And Mitigations
1. Risk: Drift between existing and new default behavior.
- Mitigation: Parity tests that assert identical output for `courtmaster_default`.
2. Risk: Confusion between pool and category scopes.
- Mitigation: Clear labels and explainer text in leaderboard UI.
3. Risk: Performance when recomputing tournament-wide scope.
- Mitigation: Reuse existing filtered match-fetch pipeline and category parallelism.

## Acceptance Criteria
1. Admin/organizer can set tournament default preset.
2. Admin/organizer can override preset per category.
3. Pool-to-elimination categories show `Pool` and `Category` leaderboard scopes.
4. Pool leaderboard remains available after phase transition.
5. Category leaderboard reflects continuation of full category journey.
6. Default preset yields current ranking behavior.
