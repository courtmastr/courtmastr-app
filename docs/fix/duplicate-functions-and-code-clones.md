# Fix: Duplicate Functions & Code Clones (Code Quality)

> **Date**: 2026-02-13  
> **Severity**: Medium — No runtime crashes currently, but increases maintenance burden and introduces risk of divergent logic.  
> **Type**: Static analysis findings — duplicate functions, copy-paste code clones, shadowed variables

---

## Background

A static analysis scan was run using:
1. **jscpd** (copy-paste detection) — found **29 code clones** across 66 files
2. **Per-file duplicate symbol scan** — found **repeated variable/function names** in 23 files

Most repeated variable names are **false positives** — they are safely scoped in separate `catch` blocks, `for` loops, `if/else` branches, or separate `computed()` scopes. These are tagged as ✅ Safe below.

The **true issues** fall into two categories:
- **Same-file code clones** — copy-pasted blocks that should be extracted into shared helpers
- **Cross-file structural clones** — identical patterns repeated across multiple files that should be DRY'd via shared utilities or composables

---

## Category 1: Same-File Code Clones (Extract into helpers)

These are duplicated blocks **within the same file** — the highest-priority refactors.

### 1.1 `src/stores/tournaments.ts` — Lines 664–697 vs 699–734

**What**: `generateBracket()` and `regenerateBracket()` have near-identical if/else branching for cloud function vs local bracket generation.

```typescript
// PATTERN (repeated in both functions):
if (USE_CLOUD_FUNCTION_FOR_BRACKETS) {
  // cloud function path
} else {
  const bracketGen = useBracketGenerator();
  try {
    const result = await bracketGen.generateBracket(tournamentId, categoryId, options);
    return result;
  } catch (err) { /* identical error handling */ }
}
```

**Fix**: Extract a private helper `executeBracketOperation(tournamentId, categoryId, options, preFn?)` that encapsulates the if/else branching. Both `generateBracket` and `regenerateBracket` call this helper, with `regenerateBracket` passing the `deleteBracket` call as the `preFn`.

**Lines**: 664–734

---

### 1.2 `src/stores/registrations.ts` — Lines 62–76 vs 93–107

**What**: Two separate blocks that build and execute Firestore queries with nearly identical patterns.

**Fix**: Extract a shared query builder helper or consolidate the query logic.

**Lines**: 62–107

---

### 1.3 `src/stores/auth.ts` — Lines 126–136 vs 144–154

**What**: The `signIn()`, `register()`, and `signOut()` functions all have the same error handling pattern:

```typescript
} catch (err: unknown) {
  const firebaseError = err as { code?: string; message?: string };
  error.value = getAuthErrorMessage(firebaseError.code || 'unknown');
  throw err;
}
```

**Fix**: Extract a helper `handleAuthError(err: unknown): never` that sets `error.value` and re-throws:

```typescript
function handleAuthError(err: unknown): never {
  const firebaseError = err as { code?: string; message?: string };
  error.value = getAuthErrorMessage(firebaseError.code || 'unknown');
  throw err;
}
```

Then each catch block becomes `} catch (err) { handleAuthError(err); }`.

**Lines**: 127–133, 145–151, 162–168

---

### 1.4 `src/services/brackets-storage.ts` — Lines 183–194 vs 221–232

**What**: The `update()` and `delete()` methods both build a query from an `arg` parameter with identical logic:

```typescript
if (typeof arg === 'number' || typeof arg === 'string') {
  const id = typeof arg === 'string' && /^\d+$/.test(arg) ? parseInt(arg, 10) : arg;
  q = query(q, where('id', '==', id));
} else {
  for (const [key, val] of Object.entries(arg)) {
    if (val !== undefined) {
      q = query(q, where(key, '==', val));
    }
  }
}
```

**Fix**: Extract a private method `buildFilteredQuery(colRef, arg)` that returns the pre-filtered query. Both `update()` and `delete()` call this helper.

**Lines**: 176–236

---

### 1.5 `src/features/scoring/views/ScoringInterfaceView.vue` — Lines 560–572 vs 591–603 vs 623–635

**What**: Three nearly identical template blocks (likely game score display sections) repeated in the template.

**Fix**: Extract a reusable component `<GameScoreBlock>` or use `v-for` over a computed list of game data instead of repeating the block 3 times.

**Lines**: 560–635

---

### 1.6 `src/features/scoring/views/MatchListView.vue` — Lines 76–89 vs 118–131 vs 156–168

**What**: Three repeated template blocks with similar match card layouts.

**Fix**: Extract a `<MatchCard>` component or a shared template partial. Use `v-for` with a computed list that includes match status context.

**Lines**: 76–168

---

### 1.7 `src/features/brackets/components/DoubleEliminationBracket.vue` — Lines 319–371 vs 390–442

**What**: Two nearly identical template blocks likely rendering Winners Bracket vs Losers Bracket rounds.

**Fix**: Extract a `<BracketRound>` component that accepts bracket type (winners/losers) as a prop.

**Lines**: 319–442

---

### 1.8 `src/features/tournaments/views/TournamentCreateView.vue` — Lines 70 vs 80

**What**: `const start = new Date(startDate.value)` declared twice in separate functions. Not a bug (separate scopes), but the identical computation is repeated.

**Fix**: Consider a shared `computed` for the parsed start date if these are in the same `<script setup>` scope.

**Lines**: 70, 80

---

## Category 2: Cross-File Structural Clones (Consolidate via shared components/composables)

These are duplicated patterns across different files. Lower priority but improve long-term maintainability.

### 2.1 Auth Views — `LoginView.vue` vs `RegisterView.vue`

| Clone Location | Lines |
|---|---|
| `LoginView.vue` L33–44 ↔ `RegisterView.vue` L66–77 | Form field template |
| `LoginView.vue` L44–49 ↔ `RegisterView.vue` L77–82 | Form actions |
| `LoginView.vue` L50–66 ↔ `RegisterView.vue` L83–99 | Error display |

**Fix**: Extract shared `<AuthFormLayout>`, `<AuthErrorDisplay>`, and `<AuthFormActions>` components.

---

### 2.2 Bracket Components — `BracketView.vue` vs `DoubleEliminationBracket.vue` vs `RoundRobinStandings.vue`

| Clone Location | Lines |
|---|---|
| `BracketView.vue` L2–16 ↔ `RoundRobinStandings.vue` L2–16 | Toolbar/header template |
| `BracketView.vue` L97–112 ↔ `DoubleEliminationBracket.vue` L114–129 | Styles block |
| `BracketView.vue` L122–140 ↔ `DoubleEliminationBracket.vue` L136–154 | Match card styles |

**Fix**: Extract a `<BracketToolbar>` component for the header, and move shared match card styles into a shared SCSS partial `_bracket-shared.scss`.

---

### 2.3 Dialog Components — `MatchDelayDialog.vue` vs `WalkoverDialog.vue`

| Clone Location | Lines |
|---|---|
| `MatchDelayDialog.vue` L24–33 ↔ `WalkoverDialog.vue` L29–39 | Dialog actions |
| `MatchDelayDialog.vue` L35–52 ↔ `WalkoverDialog.vue` L45–62 | Dialog content layout |

**Fix**: Extract a base `<ActionDialog>` component with slots for content and customizable action buttons.

---

### 2.4 Public Views — `PublicLiveScoresView.vue` vs `PublicScoringView.vue` vs `PublicBracketView.vue`

| Clone Location | Lines |
|---|---|
| `PublicLiveScoresView.vue` L97–113 ↔ `PublicScoringView.vue` L174–190 | Score display block |
| `PublicBracketView.vue` L34–40 ↔ `PublicLiveScoresView.vue` L111–117 | Loading state |
| `PublicBracketView.vue` L44–62 ↔ `PublicLiveScoresView.vue` L95–189 | Layout wrapper |

**Fix**: Extract a `<PublicViewLayout>` wrapper component with loading/error states, and a `<LiveScoreCard>` component.

---

### 2.5 Layout Components — `AppLayout.vue` vs `NavigationLayout.vue`

| Clone | Lines |
|---|---|
| `AppLayout.vue` L22–36 ↔ `NavigationLayout.vue` L45–59 | Navigation drawer template |

**Fix**: Consolidate into a single layout or extract a `<NavigationDrawer>` component used by both.

---

### 2.6 Dashboard Stats — `MatchAnnouncementPanel.vue` vs `MatchStatsDashboard.vue`

| Clone | Lines |
|---|---|
| `MatchAnnouncementPanel.vue` L79–91 ↔ `MatchStatsDashboard.vue` L153–165 | Stats styling block |

**Fix**: Extract shared styles into a `_stats-card.scss` partial or a `<StatsCard>` component.

---

### 2.7 Store Patterns — `registrations.ts` ↔ `tournaments.ts` ↔ `notifications.ts` ↔ `activities.ts`

Multiple stores share nearly identical patterns for:
- Firestore query building
- Real-time subscription setup with `onSnapshot`
- Error handling with `console.error` + `error.value = ...`

**Fix**: Create a `useFirestoreQuery` composable that handles the boilerplate:

```typescript
// composables/useFirestoreQuery.ts
export function useFirestoreQuery() {
  async function queryAndMap<T>(ref, queryConstraints, mapper) { /* ... */ }
  function subscribeAndMap<T>(ref, queryConstraints, target, mapper) { /* ... */ }
  return { queryAndMap, subscribeAndMap };
}
```

---

## Category 3: Shadowed Variables (Safe but worth noting)

These are **NOT bugs** — they are safely scoped within separate blocks (catch, for, if/else). However, they can be confusing when reading code.

### Files with safe but repetitive variable shadowing:

| File | Variables | Occurrences | Safe? |
|---|---|---|---|
| `stores/matches.ts` | `match`, `batch`, `snapshot`, `game`, etc. | 30+ | ✅ Different functions |
| `stores/tournaments.ts` | `q`, `result`, `snapshot`, `docRef` | 8 | ✅ Different functions |
| `stores/registrations.ts` | `docRef`, `snapshot`, `q` | 6 | ✅ Different functions |
| `stores/notifications.ts` | `notification`, `q` | 3 | ✅ Different functions |
| `stores/auth.ts` | `firebaseError` | 3 | ✅ Separate `catch` blocks |
| `composables/useNavigation.ts` | `items` | 2 | ✅ Separate `computed` scopes |
| `composables/useMatchScheduler.ts` | `batch`, `court`, `match` etc. | 7 | ✅ Different functions |
| `services/brackets-storage.ts` | `batch`, `q`, `snapshot`, `docRef` | 8 | ✅ Different methods |
| `guards/navigationGuards.ts` | `authStore`, `isAuthenticated`, `userRole` | 3 | ✅ Different guard functions |

**Recommendation**: No action required, but consider using more descriptive names (e.g., `matchSnapshot` instead of `snapshot`) for readability in the largest files like `matches.ts` and `tournaments.ts`.

---

## Priority Order for Fixes

| Priority | Category | Effort | Impact |
|---|---|---|---|
| 🔴 P1 | 1.1 – tournaments.ts bracket functions | Small | High — reduces 70 lines of duplication |
| 🔴 P1 | 1.4 – brackets-storage.ts query builder | Small | High — DRYs core storage adapter |
| 🟡 P2 | 1.3 – auth.ts error handling | Small | Medium — 3 catch blocks → 1 helper |
| 🟡 P2 | 1.5, 1.6 – Scoring views template clones | Medium | Medium — template readability |
| 🟡 P2 | 2.3 – Dialog components | Medium | Medium — shared dialog pattern |
| 🟢 P3 | 2.1 – Auth views | Medium | Low — isolated pages, low change frequency |
| 🟢 P3 | 2.2 – Bracket styles | Small | Low — cosmetic only |
| 🟢 P3 | 2.7 – Store composable extraction | Large | High long-term, but risky — touching core data layer |
| ⚪ P4 | Cat 3 – Variable shadowing | N/A | None — informational only |

---

## Verification Plan

After each fix, verify:

1. **Build check**: `npm run build` — must pass with 0 errors
2. **TypeScript check**: `npx vue-tsc --noEmit` — must pass
3. **Functional regression**: Test the following flows in the browser:
   - Generate/regenerate a bracket
   - Sign in / register / sign out
   - View scoring interface and match list
   - View public bracket and live scores pages
   - Open court management and dialog interactions
4. **Clone reduction**: Re-run `npx jscpd --min-lines 5 --min-tokens 50 src/` and confirm clone count drops below 20

---

## Tools Used for Analysis

```bash
# Copy-paste detection
npx jscpd --min-lines 5 --min-tokens 50 --reporters console --format "javascript,typescript,markup" src/

# Per-file duplicate symbol scan
for f in $(find src -name '*.ts' -o -name '*.vue'); do
  dupes=$(grep -oE '(function |const |let |var )[a-zA-Z_][a-zA-Z0-9_]*' "$f" | \
    sed 's/^function //' | sed 's/^const //' | sed 's/^let //' | sed 's/^var //' | \
    sort | uniq -d)
  if [ -n "$dupes" ]; then echo "=== $f ==="; echo "$dupes"; fi
done

# Targeted function name searches
grep -rn 'function releaseCourt' src/ --include='*.ts' --include='*.vue'
```
