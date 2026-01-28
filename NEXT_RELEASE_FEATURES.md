# CourtMaster v2 - Next Release Features

This document tracks features that are planned for future releases but are not included in the current version.

---

## Deferred Features

### 1. Tournament Staff Management
**Priority:** High
**Category:** Tournament Administration
**Date Added:** 2025-01-25

**Description:**
Currently, users can register as "Scorekeeper" role, but there's no way to assign them to specific tournaments. Tournament organizers need the ability to:

- Invite/assign scorekeepers to their tournaments
- Manage staff permissions per tournament
- View which scorekeepers are available/assigned
- Allow scorekeepers to see only tournaments they're assigned to

**Current Workaround:**
Scorekeepers with the role can access scoring for any tournament they have the link to.

**Implementation Notes:**
- Add `tournamentStaff` collection in Firestore
- Create staff management UI in tournament settings
- Add invitation/request workflow for scorekeepers
- Update route guards to check tournament-specific permissions

---

### 2. Pool-to-Elimination Tournament Format
**Priority:** Medium
**Category:** Tournament Formats
**Date Added:** 2027-01-27

**Description:**
Implement a hybrid tournament format that combines round-robin pool play with single-elimination playoffs. This format is common in badminton and other sports tournaments where:
- Players are divided into pools/groups
- Everyone plays everyone in their pool (round-robin)
- Top N players from each pool advance to elimination bracket
- Bracket seeding based on pool results

**Current Workaround:**
Tournament organizers must manually create two separate categories:
1. "Pool Play" category (round_robin format)
2. "Playoffs" category (single_elimination)
3. Manually select and register advancing players in the playoffs category

**Implementation Notes:**
- Add `'pool_to_elimination'` to `TournamentFormat` type
- Create UI to configure:
  - Number of pools/groups
  - Players per pool
  - Advancement rules (top N per pool, or top N overall)
- Backend logic to:
  - Create round-robin stage with multiple groups
  - Track pool standings/results
  - Automatically create elimination stage
  - Seed elimination bracket based on pool performance
- Use `brackets-manager` multiple stages feature:
  ```typescript
  // Stage 1: Pool play
  manager.create.stage({
    type: 'round_robin',
    settings: { groupCount: 4, seedOrdering: ['seed_optimized'] }
  });
  // Stage 2: Auto-create elimination after pools complete
  manager.create.stage({
    type: 'single_elimination',
    seeding: topPlayersFromPools
  });
  ```

---

### 3. Seeding Method UI Configuration
**Priority:** Medium
**Category:** Tournament Configuration
**Date Added:** 2027-01-27

**Description:**
Allow tournament organizers to select the bracket seeding method and grand final format through the UI when creating or editing categories. Currently, these are hardcoded in the backend.

**Seeding methods to expose:**
- **Standard Tournament** (`inner_outer`) - Recommended for elimination brackets
  - Top seeds protected from early matchups
  - Classic pairing: #1 vs #16, #2 vs #15, etc.
- **Snake Seeding** (`seed_optimized`) - For round-robin groups
  - Distributes top seeds evenly across groups
- **Sequential** (`natural`) - For casual tournaments only
  - Simple 1-2-3-4 ordering (with warning)

**Grand Final options** (for double elimination):
- None - Winner of Winners Bracket wins automatically
- Simple - Single grand final match
- Double - Loser gets second chance (true double elim)

**Current Workaround:**
All brackets use `inner_outer` seeding and `simple` grand finals (now hardcoded in `functions/src/bracket.ts`).

**Implementation Notes:**
- Add to `Category` interface:
  ```typescript
  seedOrdering?: 'natural' | 'inner_outer' | 'effort_balanced' | 'seed_optimized';
  grandFinalType?: 'none' | 'simple' | 'double';
  ```
- Add dropdown fields in Category creation/edit UI
- Conditionally show options based on format:
  - Single/Double Elimination → Standard Tournament or Sequential
  - Round Robin → No Seeding, Snake (for groups), Effort Balanced
- Pass settings from Category document to `generateBracket` Cloud Function
- Include help tooltips explaining each seeding method

---

## Feature Request Template

```markdown
### [Feature Name]
**Priority:** High | Medium | Low
**Category:** [Category]
**Date Added:** YYYY-MM-DD

**Description:**
[Detailed description of the feature]

**Current Workaround:**
[If any]

**Implementation Notes:**
- [Technical notes]
```

---

## Version History

| Version | Release Date | Major Features |
|---------|--------------|----------------|
| v2.0.0  | TBD          | Initial Vue 3 release with core tournament management |

---

*Last Updated: 2027-01-27*
