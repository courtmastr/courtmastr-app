# Pool Cut & Advance to Elimination — Design Spec

**Date:** 2026-04-13
**Status:** Approved for implementation
**Branch:** feat/offline-volunteer-scoring (or new branch)

---

## Context

CourtMastr supports two post-pool paths:

- **Pool → Levels**: Splits all players into skill-tier sub-brackets (Advanced / Intermediate / Beginner). No one is eliminated — everyone keeps playing. Handled by `CreateLevelsDialog.vue`. ✅ Exists and works.
- **Pool → Elimination**: Qualifies top N players from pool play into a single elimination bracket. Bottom players are cut and go home. ❌ Backend exists (`generatePoolEliminationBracket()`) but **zero UI** — it silently defaults to top 2 per pool with no director input.

This spec builds the missing UI for Pool → Elimination: a "Advance to Elimination" dialog where the tournament director chooses *how many* advance, *by what ranking method*, and sees exactly who is cut vs who advances before generating the bracket.

**Use case driving this:** 3 pools × 4 players = 12 total. Director wants to cut the bottom 4 globally, advance the top 8 to a Single Elimination bracket.

---

## Scope

### In scope
- New `AdvanceToEliminationDialog.vue` component
- New `usePoolElimination.ts` composable (ranking + cut logic)
- New CTA on `CategoryRegistrationStats.vue` for `pool_to_elimination` format after pools complete
- New Category fields: `qualifierCount`, `qualifierCutMode`
- Update `generatePoolEliminationBracket()` in `tournaments.ts` store to accept new params
- Three ranking methods: Global Top N, Pool-first then Global, Top N per Pool (existing behavior)
- Auto-detect bracket format from N (4/8/16 → Single Elimination; 6/12 → configurable; other → warn)
- Ranked cut table with visible cutline in the dialog

### Out of scope (v1)
- Manual drag-to-override individual player assignments across the cutline
- Changing format choice after bracket is generated (same as existing regen flow)
- Integration with Create Levels dialog — that dialog is **untouched**

---

## Data Model Changes

**File:** `src/types/index.ts` — `Category` interface

Add two new optional fields:

```typescript
qualifierCount?: number | null;          // How many players advance (e.g. 8)
qualifierCutMode?: QualifierCutMode | null; // Which ranking method
```

New type:
```typescript
export type QualifierCutMode =
  | 'global_top_n'           // Best N across all pools by global rank
  | 'pool_first_global'      // Pool rank breaks ties when global rank equal
  | 'top_n_per_pool';        // Top N from each pool (existing default behavior)
```

---

## Architecture

### New composable: `src/composables/usePoolElimination.ts`

Single responsibility: given pool results, return a ranked list with a cut applied.

**Reuses:** `rankPools()` and `PoolLevelParticipant` from `usePoolLeveling.ts` — same ranking data, different cut logic.

**Exports:**
```typescript
interface EliminationPreview {
  advancing: PoolLevelParticipant[];   // globalRank 1..N
  eliminated: PoolLevelParticipant[];  // globalRank N+1..total
  totalPlayers: number;
  suggestedFormat: LevelEliminationFormat; // auto-detected
  suggestedCount: number;              // nearest clean bracket size
}

function computeEliminationPreview(
  participants: PoolLevelParticipant[],
  count: number,
  mode: QualifierCutMode
): EliminationPreview

function suggestBracketFormat(n: number): {
  format: LevelEliminationFormat;
  label: string;
}

// Ranking sort per mode — pure functions, testable
function sortByGlobalTopN(participants: PoolLevelParticipant[]): PoolLevelParticipant[]
function sortByPoolFirstGlobal(participants: PoolLevelParticipant[]): PoolLevelParticipant[]
function sortByTopNPerPool(participants: PoolLevelParticipant[], n: number): PoolLevelParticipant[]
```

**Format auto-detection logic:**
| N | Format |
|---|--------|
| 4, 8, 16, 32 | Single Elimination (perfect bracket) |
| 6, 12 | Single Elimination with byes OR Double Elimination |
| Other | Single Elimination (byes auto-added by bracket engine) |

---

### New component: `src/features/tournaments/components/AdvanceToEliminationDialog.vue`

**Props:** `tournamentId`, `categoryId`, `modelValue` (v-model for open state)

**Emits:** `update:modelValue`, `generated` (after successful bracket creation)

**Internal flow:**
1. On open → calls `generatePreview()` from `usePoolLeveling.ts` to get ranked `PoolLevelParticipant[]`
2. User sets `qualifierCount` (default: largest clean bracket ≤ totalPlayers) and `cutMode`
3. `computeEliminationPreview()` reactively recomputes on each change
4. Shows ranked table: advancing rows (green badge) → orange dashed cutline → eliminated rows (red badge, strikethrough)
5. "Generate Bracket" → calls store action → emits `generated` → dialog closes

**Layout (matches mockup):**
- Left panel: mode radio group + N selector (± buttons + quick-pick chips computed from totalPlayers: common bracket sizes ≤ totalPlayers e.g. 4, 8, 16 plus "All") + auto-format badge
- Right panel: full ranked table with cutline

**Validation:** disable Generate button if pools are not fully scored (same guard as `CreateLevelsDialog`)

---

### Store changes: `src/stores/tournaments.ts`

**Method:** `generatePoolEliminationBracket(tournamentId, categoryId, options)`

Extend `options` to accept:
```typescript
{
  qualifierCount: number;
  cutMode: QualifierCutMode;
  advancingRegistrationIds: string[];  // pre-sorted by rank, passed from dialog
  eliminationFormat: LevelEliminationFormat;
}
```

On execution:
1. Validate pools complete (pendingMatches === 0)
2. Persist `qualifierCount` + `qualifierCutMode` to Category doc
3. Set `poolQualifiedRegistrationIds` = advancingRegistrationIds
4. Call `useBracketGenerator.generateEliminationFromPool()` with the sorted advancing IDs and chosen format — this is the existing pool→elimination bracket path, not the levels path
5. Set `poolPhase = 'elimination'`, `eliminationStageId` from bracket result
6. Show toast: "Bracket generated — X players advancing"

---

### CTA change: `src/features/tournaments/components/CategoryRegistrationStats.vue`

**Current:** After pools complete, shows one button: "Generate Levels" (always).

**New:** Detect category format and show the right CTA:
- `format === 'pool_to_elimination'` AND pools complete → **"Advance to Elimination"** button → opens `AdvanceToEliminationDialog`
- `format === 'pool_to_levels'` (or leveling enabled) AND pools complete → **"Generate Levels"** button (unchanged)

The `AdvanceToEliminationDialog` is imported and conditionally rendered in `CategoryRegistrationStats.vue`.

---

## Verification

### Manual test (happy path)
1. Create category with format = `pool_to_elimination`, 3 pools × 4 players
2. Score all pool matches to completion
3. Category stats banner shows "Advance to Elimination" button
4. Open dialog → ranked table shows all 12 players
5. Set N = 8, mode = "Global Top N"
6. Cutline appears between rank 8 and 9
7. Bottom 4 show strikethrough + "Eliminated" badge
8. Click "Generate Bracket" → Single Elimination bracket created with 8 players
9. Bracket seeding matches global ranks 1–8

### Edge cases to verify
- N = total players (no one eliminated) → bracket generates with all players
- Non-power-of-2 N (e.g. 6) → bracket engine adds byes, generates cleanly
- Pools not complete → Generate button disabled with tooltip
- "Top N per Pool" mode with 3 pools × 4, N=2 → 6 advance (2 from each pool)

### Unit tests
- `computeEliminationPreview()` — all three sort modes
- `suggestBracketFormat()` — boundary values (4, 6, 8, 12, 16)
- Sort functions are pure — no side effects

---

## Files Changed / Created

| File | Action | Notes |
|------|--------|-------|
| `src/types/index.ts` | Modify | Add `qualifierCount`, `qualifierCutMode`, `QualifierCutMode` type |
| `src/composables/usePoolElimination.ts` | **Create** | Pure ranking + cut logic |
| `src/features/tournaments/components/AdvanceToEliminationDialog.vue` | **Create** | New dialog component |
| `src/features/tournaments/components/CategoryRegistrationStats.vue` | Modify | New CTA for pool_to_elimination format |
| `src/stores/tournaments.ts` | Modify | Extend `generatePoolEliminationBracket()` options |
| `src/features/tournaments/components/CreateLevelsDialog.vue` | **No touch** | Unchanged |
