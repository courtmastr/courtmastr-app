# Category Card Phase Progression

## Basic Rules / Business Logic

Each category card on the Categories page shows a single primary CTA that advances
through a deterministic phase sequence. The phase is computed from live match data and
category state — **never stored separately on the category document**.

### Phase Sequence — Pure Elimination (single_elimination / double_elimination)

```
Setup → Schedule → Publish → Bracket → Done
```

| Phase        | Trigger condition                                         | Primary CTA          |
|--------------|-----------------------------------------------------------|----------------------|
| `setup`      | No bracket generated (`stageId == null`)                  | Setup Category       |
| `schedule`   | Bracket exists; schedulable matches lack `plannedStartAt` | Schedule Matches     |
| `publish`    | All schedulable matches have `plannedStartAt`; none published | Publish Schedule |
| `elimination`| At least one match has `publishedAt` / `scheduleStatus: 'published'` | View Bracket |
| `done`       | `category.status === 'completed'`                         | View Results         |

### Phase Sequence — Pool Formats (pool_to_elimination / round_robin)

```
Setup → Schedule → Publish → Pool Play → Levels → L. Schedule → L. Publish → Bracket → Done
```

See `pool-leveling.md` and `time-first-scheduling.md` for pool-specific rules.

---

## Critical Data Model Rule: brackets-manager group_id

**The brackets-manager library assigns `group_id` to ALL match types**, including
single and double elimination bracket matches (they all belong to a "group" in the
bracket stage structure).

**Consequence:** `groupId` presence alone does NOT identify pool matches.
Match categorisation must be **format-aware**:

| Format | `poolMatches` | `elimMatches` |
|--------|--------------|---------------|
| `single_elimination` / `double_elimination` | `[]` (none) | All base-scope matches (`!m.levelId`) |
| `pool_to_elimination` / `round_robin` | `Boolean(m.groupId) && !m.levelId` | `!m.groupId && !m.levelId` |

**Source:** `CategoryRegistrationStats.vue` → `categoryStats` computed property.

---

## BYE Match Exclusion from "Scheduled" Check

BYE matches are auto-advanced and never need a time slot. The scheduler explicitly
skips them (`isSchedulableMatch` returns `false` for `isByeMatch`).

Therefore the `elimMatchesScheduled` flag must exclude BYE matches:

```
schedulableElimMatches = elimMatches where !isByeMatch(m)
elimMatchesScheduled = schedulableElimMatches.every(m => Boolean(m.plannedStartAt))
```

A 15-player single elimination bracket has 1 structural BYE match in round 1.
Without this exclusion, `elimMatchesScheduled` would always be `false` and the
phase would never advance from `'schedule'` to `'publish'`.

---

## Phase Detection Source of Truth

| Data field checked | Location |
|--------------------|----------|
| `match.plannedStartAt` | Merged from `match_scores` subcollection via `applyScoreOverlay` |
| `match.publishedAt` | Merged from `match_scores` subcollection |
| `match.scheduleStatus` | Merged from `match_scores` subcollection |
| `category.stageId` | Category document (bracket generated) |
| `category.poolStageId` | Category document (pool stage generated) |
| `category.eliminationStageId` | Category document (elimination stage from pool → elim) |
| `category.status` | Category document (`'completed'` → done phase) |

The `matchStore.matches` reactive array is populated by `subscribeAllMatches`, which
listens to both `match` and `match_scores` collections. Phase state is always live.

---

## Test Coverage

- `tests/unit/CategoryRegistrationStats.pool-phase.test.ts`
  - Pool-format phase regressions (pool-phase describe block)
  - **Single elimination phase progression** (single-elimination CTA phase progression describe block)

## Source References

- `src/features/tournaments/components/CategoryRegistrationStats.vue`
  - `getCurrentPhase()` — phase determination logic
  - `categoryStats` computed — match categorisation and scheduling booleans
  - `getPrimaryAction()` — CTA label/event per phase
- `src/composables/useMatchSlotState.ts` — `isByeMatch()` used to exclude BYEs
- `src/stores/matches.ts` — `subscribeAllMatches()`, `applyScoreOverlay()`
- `src/composables/useTimeScheduler.ts` — `publishSchedule()` sets `publishedAt` / `scheduleStatus`
