# Elimination / Playoff Scoring Override — Design Spec

**Date:** 2026-04-14
**Status:** Implemented
**Branch:** feat/pool-cut-advance
**GitHub Issue:** courtmastr/courtmastr-app#34

---

## Context

CourtMastr supports pool play followed by an elimination bracket (`pool_to_elimination` format). Pool play commonly uses 15-point games (league style), but elimination/playoff rounds need a different scoring system (e.g. Best of 3 to 21). Previously there was one scoring config per category that locked at `BRACKET_LOCKED` state — making it impossible to set a different scoring for playoffs.

This feature adds a second, phase-aware scoring config per category — "Elimination / Playoff Scoring" — that applies only to elimination-phase matches, is always editable (never locked), and lives in the existing Category Overrides section of Tournament Settings.

---

## Data Model

Two new optional fields on the `Category` interface (`src/types/index.ts`):

```typescript
eliminationScoringEnabled?: boolean;
eliminationScoringConfig?: ScoringConfig | null;
```

`CategoryScoringSource` in `src/features/scoring/utils/validation.ts` mirrors these plus `eliminationStageId?: number | null` for phase detection.

---

## Phase Detection

`getScoringConfigForMatch(tournamentId, categoryId, stageId?)` in `src/stores/matches.ts`:

Resolution order:
1. If `stageId` matches `category.eliminationStageId` AND `eliminationScoringEnabled` → return `eliminationScoringConfig`
2. Otherwise → existing resolution (tournament default → pool `scoringOverrideEnabled/scoringConfig`)

`category.eliminationStageId` is set on the Category doc when `generatePoolEliminationBracket()` creates the bracket.

---

## Locking

New guard in `src/guards/tournamentState.ts`:
```typescript
export const canEditEliminationScoring = (_state: TournamentLifecycleState): boolean => true;
```

Pool scoring still locks at `BRACKET_LOCKED`. Elimination scoring is always editable.

---

## UI

In Tournament Settings > Category Overrides, each `pool_to_elimination` category gains a second section below the pool scoring block:

- Toggle: "Use different scoring for elimination matches"
- When enabled: Preset selector + Games / Points / Win By / Max Cap fields
- Chip badge: "Always editable"
- Fields are never disabled regardless of tournament state

---

## Files Changed

| File | Change |
|---|---|
| `src/types/index.ts` | Add `eliminationScoringEnabled`, `eliminationScoringConfig` to `Category` |
| `src/features/scoring/utils/validation.ts` | Add 3 fields to `CategoryScoringSource` |
| `src/guards/tournamentState.ts` | Add `canEditEliminationScoring()` |
| `src/stores/matches.ts` | Phase routing in `getScoringConfigForMatch()` |
| `src/features/tournaments/views/TournamentSettingsView.vue` | New state, helpers, save path, UI block |

---

## Verification

### Manual happy path
1. Create `pool_to_elimination` category, tournament scoring = 15pts / Best of 1
2. Tournament Settings → Category Overrides → enable "Elimination / Playoff Scoring" → set 21pts / Best of 3 → Save
3. Score all pool matches → advance to elimination bracket
4. Open an elimination match in scorer → scoring config shows 21pts / Best of 3
5. Open a pool match → scoring config shows 15pts / Best of 1

### Edge cases
- Category not `pool_to_elimination` → elimination block not shown
- Elimination scoring disabled → matches fall back to pool config
- Tournament in LIVE state → elimination block still editable; pool block still disabled
