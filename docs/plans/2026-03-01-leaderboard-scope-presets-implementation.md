# Leaderboard Scope And Preset System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add scope-based leaderboard views (Pool + full Category journey) and preset-driven ranking configuration with tournament defaults and category overrides.

**Architecture:** Keep a single leaderboard engine and inject two orthogonal concerns: (1) scope dataset selection (`pool` vs `category` vs `tournament`) and (2) effective ranking preset (category override, else tournament default). Reuse existing views/stores and add focused pure helpers for deterministic config resolution and preset policy lookup.

**Tech Stack:** Vue 3, TypeScript, Pinia, Firestore, Vuetify, Vitest.

---

### Task 1: Define Ranking Preset And Scope Types

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/types/leaderboard.ts`
- Create: `src/features/leaderboard/rankingPresets.ts`
- Test: `tests/unit/leaderboard-presets.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RANKING_PRESET,
  DEFAULT_RANKING_PROGRESSION,
  RANKING_PRESETS,
} from '@/features/leaderboard/rankingPresets';

describe('ranking presets', () => {
  it('defines default preset and progression mode', () => {
    expect(DEFAULT_RANKING_PRESET).toBe('courtmaster_default');
    expect(DEFAULT_RANKING_PROGRESSION).toBe('carry_forward');
  });

  it('contains required preset ids', () => {
    expect(Object.keys(RANKING_PRESETS).sort()).toEqual([
      'bwf_strict',
      'courtmaster_default',
      'simple_ladder',
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/leaderboard-presets.test.ts`  
Expected: FAIL (module/types do not exist yet).

**Step 3: Write minimal implementation**

- Add in `src/types/index.ts`:
  - `RankingPresetId`
  - `RankingProgressionMode`
  - `TournamentSettings.rankingPresetDefault?`
  - `TournamentSettings.progressionModeDefault?`
  - `Category.rankingPresetOverride?`
  - `Category.progressionModeOverride?`
- Add in `src/types/leaderboard.ts`:
  - `LeaderboardPhaseScope = 'pool' | 'category' | 'tournament'`
  - option fields for selected phase scope.
- Create `src/features/leaderboard/rankingPresets.ts` constants:

```ts
export const DEFAULT_RANKING_PRESET: RankingPresetId = 'courtmaster_default';
export const DEFAULT_RANKING_PROGRESSION: RankingProgressionMode = 'carry_forward';
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/leaderboard-presets.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/types/index.ts src/types/leaderboard.ts src/features/leaderboard/rankingPresets.ts tests/unit/leaderboard-presets.test.ts
git commit -m "feat: add leaderboard preset and scope types"
```

---

### Task 2: Add Effective Ranking Config Resolver (Tournament Default + Category Override)

**Files:**
- Create: `src/features/leaderboard/effectiveRankingConfig.ts`
- Test: `tests/unit/effectiveRankingConfig.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { resolveEffectiveRankingConfig } from '@/features/leaderboard/effectiveRankingConfig';

describe('resolveEffectiveRankingConfig', () => {
  it('uses category overrides when present', () => {
    const cfg = resolveEffectiveRankingConfig(
      { rankingPresetDefault: 'courtmaster_default', progressionModeDefault: 'carry_forward' },
      { rankingPresetOverride: 'bwf_strict', progressionModeOverride: 'phase_reset' }
    );
    expect(cfg.preset).toBe('bwf_strict');
    expect(cfg.progressionMode).toBe('phase_reset');
  });

  it('falls back to tournament defaults, then system defaults', () => {
    const cfg = resolveEffectiveRankingConfig({}, {});
    expect(cfg.preset).toBe('courtmaster_default');
    expect(cfg.progressionMode).toBe('carry_forward');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/effectiveRankingConfig.test.ts`  
Expected: FAIL (resolver missing).

**Step 3: Write minimal implementation**

Implement pure resolver with defensive fallback to defaults from `rankingPresets.ts`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/effectiveRankingConfig.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/leaderboard/effectiveRankingConfig.ts tests/unit/effectiveRankingConfig.test.ts
git commit -m "feat: add effective ranking config resolver"
```

---

### Task 3: Add Scope Dataset Selection For Pool vs Full Category

**Files:**
- Modify: `src/composables/useLeaderboard.ts`
- Test: `tests/unit/leaderboard.test.ts`

**Step 1: Write the failing tests**

Add tests that verify:
1. `pool` scope only includes pool-stage matches.
2. `category` scope includes all category matches.
3. For non-pool categories, pool scope returns empty/unsupported safely.

Use existing `Match` fixtures and add minimal stage tagging needed for filtering.

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/leaderboard.test.ts`  
Expected: FAIL on new scope-selection assertions.

**Step 3: Write minimal implementation**

- Extend match-to-resolved pipeline to preserve enough metadata to identify pool-stage matches.
- Add pure helper in `useLeaderboard.ts`:

```ts
selectMatchesForScope(matches, categories, scope, categoryId)
```

- In `generateLeaderboard`, apply scope selector before `aggregateStats`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/leaderboard.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/composables/useLeaderboard.ts tests/unit/leaderboard.test.ts
git commit -m "feat: add leaderboard scope-based match selection"
```

---

### Task 4: Make Ranking Calculation Preset-Driven (Default-Parity Safe)

**Files:**
- Modify: `src/features/leaderboard/rankingPresets.ts`
- Modify: `src/composables/useLeaderboard.ts`
- Test: `tests/unit/leaderboard.test.ts`
- Test: `tests/unit/leaderboard-presets.test.ts`

**Step 1: Write the failing tests**

Add tests for:
1. `courtmaster_default` output matches existing ordering (parity fixture).
2. Alternate preset changes ordering in a known fixture.
3. Unknown preset id falls back to default.

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/leaderboard.test.ts tests/unit/leaderboard-presets.test.ts`  
Expected: FAIL on preset assertions.

**Step 3: Write minimal implementation**

- Introduce preset policy lookup (points model + tiebreak order).
- Replace hard-coded constants in aggregation/tiebreak flow with preset policy values.
- Keep default behavior identical for `courtmaster_default`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/leaderboard.test.ts tests/unit/leaderboard-presets.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/leaderboard/rankingPresets.ts src/composables/useLeaderboard.ts tests/unit/leaderboard.test.ts tests/unit/leaderboard-presets.test.ts
git commit -m "feat: support leaderboard preset-driven ranking"
```

---

### Task 5: Update Leaderboard View For Pool + Category Scope Toggle

**Files:**
- Modify: `src/features/tournaments/views/LeaderboardView.vue`
- Modify: `src/components/leaderboard/LeaderboardFilters.vue`
- Test: `tests/integration/leaderboard.integration.test.ts`

**Step 1: Write the failing tests**

Add integration coverage that:
1. For `pool_to_elimination`, scope toggle renders `Pool` and `Category` options.
2. Changing scope triggers recomputation with scope-aware options.

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/integration/leaderboard.integration.test.ts`  
Expected: FAIL (toggle not present yet).

**Step 3: Write minimal implementation**

- Add local scope state in `LeaderboardView.vue`.
- Pass scope into `generate(...)` options.
- Show active preset chip/text from resolved config.
- Keep existing filters intact.

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/integration/leaderboard.integration.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/views/LeaderboardView.vue src/components/leaderboard/LeaderboardFilters.vue tests/integration/leaderboard.integration.test.ts
git commit -m "feat: add pool and category scope toggle to leaderboard view"
```

---

### Task 6: Add Tournament Default + Category Override Controls In Settings

**Files:**
- Modify: `src/features/tournaments/views/TournamentSettingsView.vue`
- Modify: `src/features/tournaments/views/TournamentCreateView.vue`
- Modify: `src/stores/tournaments.ts`
- Test: `tests/unit/tournaments.store.test.ts`

**Step 1: Write the failing tests**

- Extend tournament store tests to expect ranking default fields are accepted/persisted in create/update payloads.

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/tournaments.store.test.ts`  
Expected: FAIL on missing ranking fields.

**Step 3: Write minimal implementation**

- Add ranking default controls in tournament settings form.
- Add per-category override controls in category override panel.
- Persist values through existing `updateTournament` + `updateCategory` paths.
- Add defaults in create flow for new tournaments.

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/tournaments.store.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/features/tournaments/views/TournamentSettingsView.vue src/features/tournaments/views/TournamentCreateView.vue src/stores/tournaments.ts tests/unit/tournaments.store.test.ts
git commit -m "feat: add ranking preset defaults and category overrides in settings"
```

---

### Task 7: Wire Effective Config Into Leaderboard Generation

**Files:**
- Modify: `src/composables/useLeaderboard.ts`
- Modify: `src/types/leaderboard.ts`
- Test: `tests/unit/leaderboard.test.ts`
- Test: `tests/integration/leaderboard.integration.test.ts`

**Step 1: Write the failing tests**

Add tests asserting:
1. Category override preset is used when present.
2. Tournament default is used when override missing.
3. Returned leaderboard metadata includes effective preset and scope.

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/leaderboard.test.ts tests/integration/leaderboard.integration.test.ts`  
Expected: FAIL on metadata/config resolution assertions.

**Step 3: Write minimal implementation**

- Resolve effective config at generation time.
- Feed preset policy into aggregation/tiebreak path.
- Expose effective config in leaderboard response for UI display/debugging.

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/leaderboard.test.ts tests/integration/leaderboard.integration.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add src/composables/useLeaderboard.ts src/types/leaderboard.ts tests/unit/leaderboard.test.ts tests/integration/leaderboard.integration.test.ts
git commit -m "feat: resolve and apply effective ranking config in leaderboard generation"
```

---

### Task 8: Add Regression Coverage For Live-Recompute Pool History

**Files:**
- Modify: `tests/unit/leaderboard.test.ts`
- Create: `tests/integration/leaderboard-pool-history.integration.test.ts`

**Step 1: Write the failing tests**

1. Simulate a pool score correction and assert pool scope standings change.
2. Assert category scope standings also update from same correction.

**Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/integration/leaderboard-pool-history.integration.test.ts`  
Expected: FAIL (new behavior not fully covered yet).

**Step 3: Write minimal implementation (if needed)**

- If tests fail due stale filtering/caching, patch `useLeaderboard.generate` refresh path to recompute from current store data for both scopes.

**Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/integration/leaderboard-pool-history.integration.test.ts tests/unit/leaderboard.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add tests/unit/leaderboard.test.ts tests/integration/leaderboard-pool-history.integration.test.ts src/composables/useLeaderboard.ts
git commit -m "test: cover live recompute for pool history and category continuation"
```

---

### Task 9: Update Feature Rules And Product Docs

**Files:**
- Modify: `docs/feature-rules/leaderboard-and-tiebreakers.md`
- Modify: `docs/feature-rules/pool-leveling.md`
- Modify: `docs/feature-rules/README.md` (only if references change)

**Step 1: Write doc assertions in checklist notes**

Add explicit statements:
1. Pool/category scope behavior for `pool_to_elimination`.
2. Tournament default + category override config inheritance.
3. Preset-only policy (no custom formulas).

**Step 2: Run docs verification command**

Run: `rg -n "preset|pool|category scope|override|carry_forward|phase_reset" docs/feature-rules/leaderboard-and-tiebreakers.md docs/feature-rules/pool-leveling.md`  
Expected: matches for all new rule lines.

**Step 3: Commit**

```bash
git add docs/feature-rules/leaderboard-and-tiebreakers.md docs/feature-rules/pool-leveling.md
git commit -m "docs: codify leaderboard scopes and preset override rules"
```

---

### Task 10: Full Verification And Debug-KB Compliant Validation

**Files:**
- No new files expected unless Debug KB entries are required.

**Step 1: Run targeted tests with log variant**

Run:
- `npm run test:log -- --run tests/unit/leaderboard-presets.test.ts tests/unit/effectiveRankingConfig.test.ts tests/unit/leaderboard.test.ts`
- `npm run test:log -- --run tests/integration/leaderboard.integration.test.ts tests/integration/leaderboard-pool-history.integration.test.ts tests/unit/tournaments.store.test.ts`

Expected: PASS.

**Step 2: Run lint and build log variants**

Run:
- `npm run lint:log`
- `npm run build:log`

Expected: PASS.

**Step 3: Handle failures via Debug KB protocol**

If a `:log` command fails and prints a fingerprint:
1. Capture fingerprint.
2. Check `docs/debug-kb/index.yml` and `docs/debug-kb/<fingerprint>.md`.
3. Apply `Fix(final)` when available.
4. Record one attempt per change.

**Step 4: Final commit (if any unstaged verification fixes)**

```bash
git add -A
git commit -m "chore: finalize leaderboard scope and preset rollout"
```

---

## Execution Notes
1. Keep changes minimal and localized.
2. Do not introduce new dependencies.
3. Preserve current ranking behavior under `courtmaster_default`.
4. Prefer pure helper functions for preset resolution and scope selection to maximize testability.
5. If match metadata is insufficient for scope selection, add the smallest optional metadata extension and cover with adapter tests.
