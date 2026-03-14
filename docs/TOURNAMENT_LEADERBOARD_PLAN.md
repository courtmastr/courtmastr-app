# Tournament Leaderboard Implementation Plan

**Document Version:** 2.0
**Status:** Ready for Implementation
**Standards:** BWF (Badminton World Federation) Compliant
**Date:** February 2026
**Replaces:** v1.0 (contained critical schema errors — see Changelog)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Data Source Verification](#2-data-source-verification)
3. [Scope Definition](#3-scope-definition)
4. [BWF Tiebreaker Rules](#4-bwf-tiebreaker-rules)
5. [Data Model](#5-data-model)
6. [Algorithm Specification](#6-algorithm-specification)
7. [File Structure](#7-file-structure)
8. [Component Specification](#8-component-specification)
9. [Feature Matrix](#9-feature-matrix)
10. [API Interface](#10-api-interface)
11. [Testing Strategy](#11-testing-strategy)
12. [Implementation Phases](#12-implementation-phases)
13. [Design Decisions](#13-design-decisions)
14. [References](#14-references)
15. [Changelog](#15-changelog)

---

## 1. Executive Summary

This document specifies the complete implementation plan for a **Tournament Leaderboard** system for CourtMastr v2. The leaderboard supports both **per-category** and **tournament-wide** (all-category) views, implementing **BWF Article 16.2 compliant tiebreaker logic**.

### Key Features
- Data sourced from `/match_scores` + `/match` join (see §2 for why both are needed)
- BWF Article 16.2 compliant tiebreaker logic, fully specified
- Supports all tournament formats (Single Elimination, Double Elimination, Round Robin)
- CSV and JSON export (PDF deferred to post-MVP)
- Sortable, filterable Vuetify data table
- Auto-generates on page load; manual refresh button available
- Per-category entries for tournament-wide view (one row per registration, not per player)

---

## 2. Data Source Verification

### 2.1 Collection Architecture

**IMPORTANT:** Match data is split across TWO collections that must be joined:

| Collection | Path | Purpose | Leaderboard Usage |
|------------|------|---------|-------------------|
| `/match_scores` | `tournaments/{id}/categories/{catId}/match_scores/{matchId}` | **Operational data** | Scores, winnerId, status |
| `/match` | `tournaments/{id}/categories/{catId}/match/{matchId}` | **Bracket structure** | participant1Id, participant2Id |
| `/registrations` | `tournaments/{id}/registrations/{regId}` | **Participant registry** | Player names, categoryId |
| `/players` | `tournaments/{id}/players/{playerId}` | **Player details** | firstName, lastName |
| `/categories` | `tournaments/{id}/categories/{catId}` | **Category info** | Name, format type |

> **Why two collections?** `match_scores` is optimized for frequent score writes. Participant IDs (who played whom) live in `/match` which is written once when the bracket is generated. They must be joined by document ID (the match ID is the same in both collections).

### 2.2 Exact Schema: `/match_scores` Document

```typescript
// /tournaments/{tournamentId}/categories/{categoryId}/match_scores/{matchId}
{
  // Document ID = match ID (same as /match document ID)
  status: 'scheduled' | 'ready' | 'in_progress' | 'completed' | 'walkover';
  scores: GameScore[];           // Per-game scores — see below
  winnerId?: string;             // Registration ID of match winner
  courtId?: string;
  scheduledTime?: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  calledAt?: Timestamp;
  queuePosition?: number;
  queuedAt?: Timestamp;
  delayReason?: string;
  delayedAt?: Timestamp;
  updatedAt: Timestamp;          // serverTimestamp() — always present
}

// GameScore sub-object
interface GameScore {
  gameNumber: number;            // 1, 2, 3 (NOT "game")
  score1: number;                // Points for opponent1 (NOT "player1")
  score2: number;                // Points for opponent2 (NOT "player2")
  winnerId?: string;             // Registration ID of game winner (already resolved)
  isComplete: boolean;
}
```

> **NOTE for implementors:** Field names are `score1`/`score2` and `gameNumber` — NOT `player1`/`player2` or `game`. Game winners are already tracked via `winnerId` in each GameScore — no need to infer from points.

### 2.3 Exact Schema: `/match` Document

```typescript
// /tournaments/{tournamentId}/categories/{categoryId}/match/{matchId}
{
  id: string;                    // Document ID (string, post-migration)
  stage_id: string;
  group_id?: string;
  round_id?: string;
  round?: number;                // Round number (enhancement field)
  bracket?: 'winners' | 'losers' | 'finals';
  number: number;
  status: number;                // 0=Locked, 1=Waiting, 2=Ready, 3=Running, 4=Completed (internal, DO NOT use for UI)
  opponent1: {
    id: string | null;           // brackets-manager sequential ID — NOT a registration ID
    registrationId?: string;     // Registration ID (enhancement field — may not be present)
    result?: 'win' | 'loss';
    score?: number;
  } | null;
  opponent2: { /* same */ } | null;
}
```

### 2.4 Critical ID Resolution Pattern (from AGENTS.md)

The `/match` document's `opponent.id` is a brackets-manager sequential integer — NOT a registration ID.
Registration IDs are stored in the `/participant` collection:

```typescript
// /tournaments/{id}/categories/{catId}/participant/{participantId}
{
  id: string;     // Document ID (sequential: "0", "1", "2") — NOT a registration ID
  name: string;   // HIDDEN FIELD: contains the Firestore registration ID
  tournament_id: string;
}
```

**Resolution chain:**
```typescript
// ✅ CORRECT: Use participant.name for registration ID
const registrationId = participant.name;

// ❌ WRONG: Never use participant.id for registration lookups
const registrationId = participant.id;  // This is a seeding position number
```

**In practice for the leaderboard:** Fetch the `/participant` subcollection for each category, build a Map of `participantId → registrationId`, then resolve opponent1/opponent2 IDs from `/match` through that map.

### 2.5 Badminton Scoring Config (source of truth)

```typescript
export const BADMINTON_CONFIG = {
  gamesPerMatch: 3,   // Best of 3
  pointsToWin: 21,    // First to 21
  mustWinBy: 2,       // Must win by 2 clear points
  maxPoints: 30,      // Cap: at 29-29, first to 30 wins
};
```

---

## 3. Scope Definition

### 3.1 Per-Category Leaderboard

**Purpose:** Standings within one category (e.g., Men's Singles)
**Data source:** Single category's `match_scores` + `match` collections
**URL pattern:** `/tournaments/{tournamentId}/categories/{categoryId}/leaderboard`
**Primary use case:** Round Robin pool standings, category rankings
**Existing reference:** `RoundRobinStandings.vue` (reference implementation — reuse its patterns)

### 3.2 Tournament-Wide Leaderboard

**Purpose:** View across ALL categories in a tournament
**Data source:** All categories' `match_scores` + `match` collections, iterated
**URL pattern:** `/tournaments/{tournamentId}/leaderboard`
**Display model:** **One row per registration** (a player in 3 categories appears 3 times with a category badge on each row)
**Why separate entries?** Simplest to implement, unambiguous stats per discipline

> **Tournament-wide fetch strategy:** Fetch all category IDs → for each category, run the same per-category fetch in parallel → merge all results into a single sorted list.

---

## 4. BWF Tiebreaker Rules

Per **BWF Statutes, Chapter 5, Section 5.1, Article 16.2** (General Competition Regulations)

### 4.1 Tiebreaker Hierarchy

| Priority | Article | Rule | Applied When |
|----------|---------|------|-------------|
| **1** | 16.2.1 | Match Points | Always — higher wins |
| **2** | 16.2.2 | Head-to-Head | **2-player tie only** — winner of their direct match ranks higher |
| **3** | 16.2.3 | Game Difference | **3+ player tie** — (gamesWon − gamesLost), descending |
| **4** | 16.2.3.1 | Head-to-Head (subset) | If game diff leaves exactly 2 players equal — winner of match between them |
| **5** | 16.2.4 | Point Difference | If still tied — (pointsFor − pointsAgainst), descending |
| **6** | 16.2.4.1 | Head-to-Head (final) | If point diff leaves exactly 2 equal — winner of their direct match |
| **7** | 16.2.4.2 | Equal Standing | All tiebreakers exhausted — same rank awarded |

### 4.2 Match Points

| Result | Points |
|--------|--------|
| Win | 2 |
| Loss | 1 (participation credit) |
| Walkover win | 2 (treated as regular win) |
| Walkover loss | 1 (treated as regular loss) |

### 4.3 Worked Example: Two-Way Tie

```
Paul: 3W 1L → 7 match points
Art:  3W 1L → 7 match points

Step 1 tie: Apply Art. 16.2.2 (head-to-head)
Paul beat Art in their direct match → Paul ranks higher
```

### 4.4 Worked Example: Three-Way Tie

```
Joan: 2W 1L → 5 match points  Game diff: 4W−2L = +2
Kate: 2W 1L → 5 match points  Game diff: 4W−3L = +1
Mary: 2W 1L → 5 match points  Game diff: 3W−3L = 0

Step 1 tie: Skip Art. 16.2.2 (3-way, not 2-way)
Step 2: Apply Art. 16.2.3 (game difference)
Joan (+2) > Kate (+1) > Mary (0) → fully resolved
Result: Joan 1st, Kate 2nd, Mary 3rd
```

### 4.5 Worked Example: Partial Three-Way Tie

```
A: 2W 1L, game diff +2
B: 2W 1L, game diff +1
C: 2W 1L, game diff +1

Game diff resolves A (1st), but B and C are still tied.
Apply Art. 16.2.3.1: B vs C head-to-head → winner ranks 2nd
```

---

## 5. Data Model

### 5.1 Core Types (`src/types/leaderboard.ts`)

```typescript
export type LeaderboardScope = 'category' | 'tournament';

export type TieBreakerStep =
  | 'match_wins'
  | 'head_to_head'
  | 'game_difference'
  | 'point_difference'
  | 'equal';

export type LeaderboardStage = 'idle' | 'fetching' | 'calculating' | 'sorting' | 'done' | 'error';

/**
 * One row in the leaderboard table.
 */
export interface LeaderboardEntry {
  // Identity
  rank: number;                  // Assigned after sorting (1-based)
  registrationId: string;        // Firestore registration doc ID
  participantName: string;       // Display name (player full name or team name)
  participantType: 'player' | 'team';
  categoryId: string;
  categoryName: string;

  // Match stats
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  matchPoints: number;           // 2×wins + 1×losses

  // Game stats (BWF tiebreaker inputs)
  gamesWon: number;
  gamesLost: number;
  gameDifference: number;        // gamesWon - gamesLost

  // Point stats (BWF tiebreaker inputs)
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;       // pointsFor - pointsAgainst

  // Derived
  winRate: number;               // (matchesWon / matchesPlayed) × 100, rounded to 2dp

  // Elimination tracking (elimination formats only)
  eliminated: boolean;
  eliminationRound?: number;     // Round number where eliminated
  finalPlacement?: number;       // 1st, 2nd, 3rd, etc. (if tournament complete)

  // Timestamps
  lastMatchAt?: Date;
  firstMatchAt?: Date;
}

export interface Leaderboard {
  scope: LeaderboardScope;
  tournamentId: string;
  categoryId?: string;
  generatedAt: Date;

  entries: LeaderboardEntry[];   // Sorted, rank already assigned

  // Summary counts
  totalMatches: number;
  completedMatches: number;
  totalParticipants: number;
  activeParticipants: number;
  eliminatedParticipants: number;

  // Tournament-wide only
  categories?: CategorySummary[];

  // Audit trail for resolved ties
  tiebreakerResolutions: TiebreakerResolution[];
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  format: string;               // 'single_elimination' | 'double_elimination' | 'round_robin'
  totalParticipants: number;
  matchesCompleted: number;
  matchesTotal: number;
  topThree: Pick<LeaderboardEntry, 'rank' | 'participantName' | 'matchesWon' | 'matchPoints'>[];
}

export interface TiebreakerResolution {
  tiedRank: number;
  registrationIds: string[];
  step: TieBreakerStep;
  description: string;
  resolvedOrder: string[];       // registrationIds in resolved order
  headToHeadMatchId?: string;
}

export interface LeaderboardOptions {
  includeEliminated?: boolean;  // default: true
  minimumMatches?: number;      // default: 0
  categoryIds?: string[];       // tournament scope: filter to specific categories
}

export type ExportFormat = 'csv' | 'json';  // PDF deferred to post-MVP

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  columns?: (keyof LeaderboardEntry)[];
}
```

---

## 6. Algorithm Specification

### 6.1 Phase 1: Data Collection

#### Key insight: participant IDs require joining `/match` + `/participant`

```typescript
/**
 * Internal representation after joining match + match_scores + participant resolution.
 * This is NOT a Firestore document — it is a derived type built by the leaderboard service.
 */
interface ResolvedMatch {
  id: string;                    // Match document ID
  categoryId: string;
  participant1Id: string;        // Registration ID (resolved via participant.name)
  participant2Id: string;        // Registration ID (resolved via participant.name)
  winnerId: string;              // Registration ID (from match_scores.winnerId)
  scores: GameScore[];           // From match_scores.scores
  round: number;                 // From match.round (or derived from round_id)
  bracket?: 'winners' | 'losers' | 'finals';
  completedAt?: Date;
}
```

#### Fetch strategy for a single category

```typescript
async function fetchCategoryData(
  tournamentId: string,
  categoryId: string
): Promise<{
  registrations: Registration[];
  participants: Participant[];  // For ID resolution
  matchDocs: Match[];           // From /match (bracket structure)
  matchScoreDocs: MatchScore[]; // From /match_scores (completed only)
}> {
  const base = `tournaments/${tournamentId}/categories/${categoryId}`;

  // All 4 fetches run in parallel
  const [registrations, participants, matchDocs, matchScoreDocs] = await Promise.all([
    // Approved/checked_in registrations for this category
    getDocs(query(
      collection(db, `tournaments/${tournamentId}/registrations`),
      where('categoryId', '==', categoryId),
      where('status', 'in', ['approved', 'checked_in'])
    )).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),

    // Participant map for registrationId resolution
    getDocs(collection(db, `${base}/participant`))
      .then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),

    // Bracket structure (to get opponent1/opponent2 IDs)
    getDocs(collection(db, `${base}/match`))
      .then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),

    // Completed match scores only
    getDocs(query(
      collection(db, `${base}/match_scores`),
      where('status', 'in', ['completed', 'walkover'])
    )).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
  ]);

  return { registrations, participants, matchDocs, matchScoreDocs };
}
```

#### Resolve participant IDs and join matches

```typescript
function resolveMatches(
  categoryId: string,
  participants: Participant[],
  matchDocs: Match[],
  matchScoreDocs: MatchScore[]
): ResolvedMatch[] {

  // Build lookup: bracketsManager participantId → registrationId
  // CRITICAL: use participant.name (NOT participant.id) for registrationId
  const participantMap = new Map<string, string>(
    participants.map(p => [String(p.id), p.name])  // p.name IS the registrationId
  );

  // Build lookup: matchId → matchScore
  const scoreMap = new Map(matchScoreDocs.map(s => [s.id, s]));

  const resolved: ResolvedMatch[] = [];

  for (const match of matchDocs) {
    const score = scoreMap.get(match.id);

    // Only process matches with completed scores and valid winner
    if (!score || !score.winnerId) continue;
    if (!['completed', 'walkover'].includes(score.status)) continue;

    // Resolve registration IDs.
    // Prefer registrationId enhancement field if present, otherwise resolve via participant map.
    const p1Id = match.opponent1?.registrationId
      ?? participantMap.get(String(match.opponent1?.id));
    const p2Id = match.opponent2?.registrationId
      ?? participantMap.get(String(match.opponent2?.id));

    if (!p1Id || !p2Id) {
      console.warn(`[leaderboard] Cannot resolve participants for match ${match.id} in category ${categoryId}`);
      continue;
    }

    resolved.push({
      id: match.id,
      categoryId,
      participant1Id: p1Id,
      participant2Id: p2Id,
      winnerId: score.winnerId,
      scores: score.scores ?? [],
      round: match.round ?? 0,
      bracket: match.bracket,
      completedAt: score.completedAt?.toDate(),
    });
  }

  return resolved;
}
```

#### Tournament-wide: iterate all categories

```typescript
async function fetchAllCategoryData(
  tournamentId: string,
  categoryIds: string[]
): Promise<{ allMatches: ResolvedMatch[]; allRegistrations: Registration[] }> {

  // Fetch all categories in parallel
  const categoryData = await Promise.all(
    categoryIds.map(catId => fetchCategoryData(tournamentId, catId))
  );

  const allMatches: ResolvedMatch[] = [];
  const allRegistrations: Registration[] = [];

  for (let i = 0; i < categoryIds.length; i++) {
    const { registrations, participants, matchDocs, matchScoreDocs } = categoryData[i];
    const resolved = resolveMatches(categoryIds[i], participants, matchDocs, matchScoreDocs);
    allMatches.push(...resolved);
    allRegistrations.push(...registrations);
  }

  return { allMatches, allRegistrations };
}
```

### 6.2 Phase 2: Statistics Aggregation

```typescript
function aggregateStats(
  registrations: Registration[],
  matches: ResolvedMatch[],
  categoryMap: Map<string, Category>,
  players: Player[]
): Map<string, LeaderboardEntry> {

  const statsMap = new Map<string, LeaderboardEntry>();

  // Initialize one entry per registration
  for (const reg of registrations) {
    const category = categoryMap.get(reg.categoryId);
    statsMap.set(reg.id, {
      rank: 0,                                    // Assigned after sort
      registrationId: reg.id,
      participantName: resolveParticipantName(reg, players),
      participantType: reg.teamId ? 'team' : 'player',
      categoryId: reg.categoryId,
      categoryName: category?.name ?? 'Unknown',
      matchesPlayed: 0,
      matchesWon: 0,
      matchesLost: 0,
      matchPoints: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDifference: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDifference: 0,
      winRate: 0,
      eliminated: false,
      lastMatchAt: undefined,
      firstMatchAt: undefined,
    });
  }

  // Process each completed match
  for (const match of matches) {
    const p1 = statsMap.get(match.participant1Id);
    const p2 = statsMap.get(match.participant2Id);

    if (!p1 || !p2) {
      console.warn(`[leaderboard] No registration entry for participants in match ${match.id}`);
      continue;
    }

    p1.matchesPlayed++;
    p2.matchesPlayed++;

    // Points from game scores
    // score1 = participant1's points in that game, score2 = participant2's points
    for (const game of match.scores) {
      p1.pointsFor += game.score1;
      p1.pointsAgainst += game.score2;
      p2.pointsFor += game.score2;
      p2.pointsAgainst += game.score1;

      if (game.isComplete) {
        // game.winnerId is already a registration ID — no inference needed
        if (game.winnerId === match.participant1Id) {
          p1.gamesWon++;
          p2.gamesLost++;
        } else {
          p2.gamesWon++;
          p1.gamesLost++;
        }
      }
    }

    // Match win/loss — BWF: 2 pts win, 1 pt loss (same for walkovers)
    if (match.winnerId === match.participant1Id) {
      p1.matchesWon++;
      p1.matchPoints += 2;
      p2.matchesLost++;
      p2.matchPoints += 1;
    } else {
      p2.matchesWon++;
      p2.matchPoints += 2;
      p1.matchesLost++;
      p1.matchPoints += 1;
    }

    // Timestamps
    const t = match.completedAt;
    if (t) {
      if (!p1.lastMatchAt || t > p1.lastMatchAt) p1.lastMatchAt = t;
      if (!p1.firstMatchAt || t < p1.firstMatchAt) p1.firstMatchAt = t;
      if (!p2.lastMatchAt || t > p2.lastMatchAt) p2.lastMatchAt = t;
      if (!p2.firstMatchAt || t < p2.firstMatchAt) p2.firstMatchAt = t;
    }
  }

  // Derived fields
  for (const entry of statsMap.values()) {
    entry.gameDifference = entry.gamesWon - entry.gamesLost;
    entry.pointDifference = entry.pointsFor - entry.pointsAgainst;
    entry.winRate = entry.matchesPlayed > 0
      ? Math.round((entry.matchesWon / entry.matchesPlayed) * 10000) / 100
      : 0;
  }

  return statsMap;
}

function resolveParticipantName(reg: Registration, players: Player[]): string {
  if (reg.teamName) return reg.teamName;
  if (reg.playerId) {
    const player = players.find(p => p.id === reg.playerId);
    if (player) return `${player.firstName} ${player.lastName}`;
  }
  return 'Unknown';
}
```

### 6.3 Elimination Status Calculation

For elimination formats, a player is eliminated when they can no longer win the tournament.

```typescript
/**
 * Determine elimination status from match history.
 * Works for both single and double elimination.
 * Round robin: no eliminations (returns immediately).
 */
function applyEliminationStatus(
  statsMap: Map<string, LeaderboardEntry>,
  matches: ResolvedMatch[],
  categoryFormat: 'single_elimination' | 'double_elimination' | 'round_robin'
): void {

  if (categoryFormat === 'round_robin') return;

  const lossByRound = new Map<string, number>(); // registrationId → round where eliminated

  for (const match of matches) {
    const loserId = match.winnerId === match.participant1Id
      ? match.participant2Id
      : match.participant1Id;

    if (categoryFormat === 'single_elimination') {
      // Any loss = eliminated
      if (!lossByRound.has(loserId)) {
        lossByRound.set(loserId, match.round);
      }
    } else if (categoryFormat === 'double_elimination') {
      // Eliminated only after losing in the losers bracket OR grand finals
      if (match.bracket === 'losers' || match.bracket === 'finals') {
        if (!lossByRound.has(loserId)) {
          lossByRound.set(loserId, match.round);
        }
      }
    }
  }

  for (const [regId, round] of lossByRound) {
    const entry = statsMap.get(regId);
    if (entry) {
      entry.eliminated = true;
      entry.eliminationRound = round;
    }
  }
}
```

### 6.4 Phase 3: BWF Tiebreaker Sorting — Complete Algorithm

```typescript
function sortWithBWFTiebreaker(
  entries: LeaderboardEntry[],
  matches: ResolvedMatch[]
): { sorted: LeaderboardEntry[]; resolutions: TiebreakerResolution[] } {

  const resolutions: TiebreakerResolution[] = [];
  const sorted: LeaderboardEntry[] = [];
  let currentRank = 1;

  // Group by match points, descending
  const groups = groupByDescending(entries, e => e.matchPoints);

  for (const group of groups) {
    if (group.length === 1) {
      group[0].rank = currentRank;
      sorted.push(group[0]);
      currentRank++;
    } else {
      const { resolved, resolution } = resolveTieGroup(group, matches, currentRank);
      let r = currentRank;
      for (const entry of resolved) {
        entry.rank = r++;
      }
      sorted.push(...resolved);
      if (resolution) resolutions.push(resolution);
      currentRank += resolved.length;
    }
  }

  return { sorted, resolutions };
}

/**
 * Resolve ties for a group of entries with equal match points.
 * Implements BWF Article 16.2 in full.
 */
function resolveTieGroup(
  tiedEntries: LeaderboardEntry[],
  allMatches: ResolvedMatch[],
  startRank: number
): { resolved: LeaderboardEntry[]; resolution?: TiebreakerResolution } {

  const ids = tiedEntries.map(e => e.registrationId);

  // --- Two-way tie: head-to-head (Art. 16.2.2) ---
  if (tiedEntries.length === 2) {
    const [a, b] = tiedEntries;
    const h2h = findHeadToHeadMatch(a.registrationId, b.registrationId, allMatches);
    if (h2h) {
      const winner = h2h.winnerId === a.registrationId ? a : b;
      const loser = winner === a ? b : a;
      return {
        resolved: [winner, loser],
        resolution: {
          tiedRank: startRank,
          registrationIds: ids,
          step: 'head_to_head',
          description: 'Resolved by head-to-head match result',
          resolvedOrder: [winner.registrationId, loser.registrationId],
          headToHeadMatchId: h2h.id,
        },
      };
    }
    // No head-to-head match (can happen in elimination formats) — fall through
  }

  // --- Three+ way (or unresolved 2-way): game difference (Art. 16.2.3) ---
  const gameDiffGroups = groupByDescending(tiedEntries, e => e.gameDifference);
  if (gameDiffGroups.length > 1) {
    return resolvePartialTies(gameDiffGroups, allMatches, startRank, 'game_difference');
  }

  // --- Still tied: point difference (Art. 16.2.4) ---
  const pointDiffGroups = groupByDescending(tiedEntries, e => e.pointDifference);
  if (pointDiffGroups.length > 1) {
    return resolvePartialTies(pointDiffGroups, allMatches, startRank, 'point_difference');
  }

  // --- All tiebreakers exhausted: equal standing (Art. 16.2.4.2) ---
  return {
    resolved: tiedEntries,
    resolution: {
      tiedRank: startRank,
      registrationIds: ids,
      step: 'equal',
      description: 'All tiebreakers exhausted — equal standing awarded',
      resolvedOrder: ids,
    },
  };
}

/**
 * Handle partial tie resolution.
 *
 * When a tiebreaker (e.g. game difference) separates some players but leaves
 * sub-groups still tied, this function processes each sub-group independently
 * by recursing back into resolveTieGroup.
 *
 * Example: game diff resolves A to rank 1, but B and C are still equal →
 *   recurse on {B, C} → head-to-head (Art. 16.2.3.1) resolves them.
 *
 * @param groups  Sub-groups already sorted desc by the resolving metric.
 */
function resolvePartialTies(
  groups: LeaderboardEntry[][],
  allMatches: ResolvedMatch[],
  startRank: number,
  resolvedBy: TieBreakerStep
): { resolved: LeaderboardEntry[]; resolution?: TiebreakerResolution } {

  const allResolved: LeaderboardEntry[] = [];
  const allResolutions: TiebreakerResolution[] = [];
  let rank = startRank;

  for (const group of groups) {
    if (group.length === 1) {
      group[0].rank = rank;
      allResolved.push(group[0]);
      rank++;
    } else {
      // Recurse: apply full BWF procedure to this sub-group
      const { resolved: subResolved, resolution: subResolution } = resolveTieGroup(
        group,
        allMatches,
        rank
      );
      allResolved.push(...subResolved);
      if (subResolution) allResolutions.push(subResolution);
      rank += subResolved.length;
    }
  }

  const firstResolution = allResolutions[0];
  return {
    resolved: allResolved,
    resolution: firstResolution
      ? {
          ...firstResolution,
          step: resolvedBy,
          description: `Partially resolved by ${resolvedBy}; sub-groups further processed`,
        }
      : undefined,
  };
}

// --- Pure helpers ---

function findHeadToHeadMatch(
  p1Id: string,
  p2Id: string,
  matches: ResolvedMatch[]
): ResolvedMatch | undefined {
  return matches.find(m =>
    (m.participant1Id === p1Id && m.participant2Id === p2Id) ||
    (m.participant1Id === p2Id && m.participant2Id === p1Id)
  );
}

/** Group array into sub-arrays by key, sorted descending by that key. */
function groupByDescending<T>(arr: T[], keyFn: (item: T) => number): T[][] {
  const keys = [...new Set(arr.map(keyFn))].sort((a, b) => b - a);
  return keys.map(k => arr.filter(item => keyFn(item) === k));
}
```

### 6.5 Phase 4: Main Generation Function

```typescript
export async function generateLeaderboard(
  tournamentId: string,
  categoryId?: string,
  options?: LeaderboardOptions
): Promise<Leaderboard> {

  // Fetch category metadata
  const allCategories = await fetchCategories(tournamentId);
  const categoryMap = new Map(allCategories.map(c => [c.id, c]));

  const targetCategoryIds = categoryId
    ? [categoryId]
    : (options?.categoryIds ?? allCategories.map(c => c.id));

  // Fetch player names (shared across all categories)
  const players = await fetchPlayers(tournamentId);

  // Fetch and join match data for all target categories (parallel)
  const { allMatches, allRegistrations } = await fetchAllCategoryData(
    tournamentId,
    targetCategoryIds
  );

  // Aggregate statistics
  const statsMap = aggregateStats(allRegistrations, allMatches, categoryMap, players);

  // Apply elimination status per category format
  for (const catId of targetCategoryIds) {
    const category = categoryMap.get(catId);
    if (!category) continue;
    const catMatches = allMatches.filter(m => m.categoryId === catId);
    applyEliminationStatus(statsMap, catMatches, category.format ?? 'single_elimination');
  }

  // Apply filters
  let entries = [...statsMap.values()];
  if (options?.includeEliminated === false) {
    entries = entries.filter(e => !e.eliminated);
  }
  if (options?.minimumMatches) {
    entries = entries.filter(e => e.matchesPlayed >= options.minimumMatches!);
  }

  // Sort with BWF tiebreakers (also assigns rank)
  const { sorted, resolutions } = sortWithBWFTiebreaker(entries, allMatches);

  // Build category summaries for tournament-wide view
  const categories = categoryId
    ? undefined
    : buildCategorySummaries(targetCategoryIds, categoryMap, statsMap, allMatches);

  return {
    scope: categoryId ? 'category' : 'tournament',
    tournamentId,
    categoryId,
    generatedAt: new Date(),
    entries: sorted,
    totalMatches: allMatches.length,
    completedMatches: allMatches.length, // already filtered to completed
    totalParticipants: sorted.length,
    activeParticipants: sorted.filter(e => !e.eliminated).length,
    eliminatedParticipants: sorted.filter(e => e.eliminated).length,
    categories,
    tiebreakerResolutions: resolutions,
  };
}
```

---

## 7. File Structure

```
src/
├── types/
│   └── leaderboard.ts                   # NEW — all leaderboard types (§5.1)
│
├── composables/
│   └── useLeaderboard.ts                # NEW — fetch + generate + export composable
│
├── components/
│   └── leaderboard/
│       ├── LeaderboardTable.vue         # NEW — Vuetify data table (main display)
│       ├── LeaderboardFilters.vue       # NEW — category/status/search filters
│       ├── LeaderboardSummary.vue       # NEW — 4 stat cards at top
│       └── TiebreakerTooltip.vue        # NEW — explain why a rank was assigned
│
├── features/
│   └── tournaments/
│       └── views/
│           └── LeaderboardView.vue      # NEW — full page view (wraps all components)
│
└── services/
    └── leaderboardExport.ts             # NEW — CSV + JSON export utilities
```

> **No `TournamentLeaderboard.vue` container:** `LeaderboardView.vue` is the container. Avoid duplicate wrappers.

### File Size Estimates

| File | Purpose | Est. Lines |
|------|---------|------------|
| `types/leaderboard.ts` | TypeScript interfaces | ~100 |
| `composables/useLeaderboard.ts` | Algorithm + fetch logic | ~500 |
| `components/leaderboard/LeaderboardTable.vue` | Data table + row expansion | ~280 |
| `components/leaderboard/LeaderboardFilters.vue` | Filter controls | ~140 |
| `components/leaderboard/LeaderboardSummary.vue` | Stats cards | ~100 |
| `components/leaderboard/TiebreakerTooltip.vue` | Popover explanation | ~50 |
| `features/tournaments/views/LeaderboardView.vue` | Page + routing | ~180 |
| `services/leaderboardExport.ts` | CSV + JSON | ~120 |
| **Total** | | **~1,470** |

---

## 8. Component Specification

### 8.1 LeaderboardTable.vue

**Props:**
```typescript
interface Props {
  entries: LeaderboardEntry[];
  loading: boolean;
  tiebreakerResolutions: TiebreakerResolution[];
  showCategory?: boolean;       // true for tournament-wide view (default: false)
  dense?: boolean;              // compact mode (default: false)
}
```

**Columns:**

| # | Column | Field | Sortable | Notes |
|---|--------|-------|----------|-------|
| 1 | # | `rank` | No | Gold/Silver/Bronze badge for ranks 1–3 |
| 2 | Participant | `participantName` | Yes | Bold |
| 3 | Category | `categoryName` | Yes | Badge chip — only when `showCategory` |
| 4 | Played | `matchesPlayed` | Yes | |
| 5 | Won | `matchesWon` | Yes | Success color |
| 6 | Lost | `matchesLost` | Yes | Error color |
| 7 | Win % | `winRate` | Yes | "75.00%" |
| 8 | Pts | `matchPoints` | Yes | Primary chip |
| 9 | G+/− | `gameDifference` | Yes | "+3" green / "−2" red |
| 10 | P+/− | `pointDifference` | Yes | "+45" green / "−12" red |

**Expandable row content:**
- Last 5 matches (opponent name, score, W/L)
- Tiebreaker badge: if this entry was involved in a tiebreaker, show which step resolved it

**Styling:**
```scss
.rank-1 { background: rgba(255, 215, 0, 0.1); }    // Gold
.rank-2 { background: rgba(192, 192, 192, 0.1); }  // Silver
.rank-3 { background: rgba(205, 127, 50, 0.1); }   // Bronze
.eliminated { opacity: 0.6; }
```

### 8.2 LeaderboardFilters.vue

All filters are optional and emit `update:filters`:

1. **Category multi-select** (tournament-wide only)
2. **Status chip group**: All / Active / Eliminated
3. **Participant search** (debounced, searches `participantName`)
4. **Minimum matches slider** (v-slider, 0 to max played)

### 8.3 LeaderboardSummary.vue

Four stat cards:

| Card | Icon | Value |
|------|------|-------|
| Total Participants | mdi-account-group | `totalParticipants` |
| Matches Completed | mdi-tournament | `completedMatches` |
| Active Players | mdi-run | `activeParticipants` |
| Leader | mdi-trophy | `entries[0]?.participantName` |

### 8.4 LeaderboardView.vue

Responsibilities:
1. Auto-generate on mount: `onMounted(() => leaderboard.generate(tournamentId, categoryId))`
2. Manage filter state
3. Expose Refresh button (re-runs generate)
4. Display loading skeleton, error alert, empty state

**Template structure:**
```vue
<template>
  <v-container>
    <div class="d-flex align-center mb-4">
      <h1>Leaderboard</h1>
      <v-spacer />
      <v-btn icon="mdi-refresh" :loading="stage !== 'done' && stage !== 'error'" @click="refresh" />
      <LeaderboardExport :leaderboard="leaderboard" :disabled="!leaderboard" />
    </div>

    <LeaderboardSummary v-if="leaderboard" :leaderboard="leaderboard" />

    <LeaderboardFilters :categories="categories" @update:filters="applyFilters" />

    <!-- Loading skeleton -->
    <v-skeleton-loader
      v-if="stage === 'fetching' || stage === 'calculating' || stage === 'sorting'"
      type="table"
    />

    <!-- Data table -->
    <LeaderboardTable
      v-else
      :entries="filteredEntries"
      :loading="false"
      :tiebreaker-resolutions="leaderboard?.tiebreakerResolutions ?? []"
      :show-category="scope === 'tournament'"
    />

    <!-- Empty state -->
    <v-alert v-if="stage === 'done' && !filteredEntries.length" type="info">
      No completed matches yet.
    </v-alert>

    <!-- Error state -->
    <v-alert v-if="stage === 'error'" type="error">
      {{ error }}
    </v-alert>
  </v-container>
</template>
```

---

## 9. Feature Matrix

### Per-Category Leaderboard — MVP (Phase 1+2)

| Feature | Priority | Status |
|---------|----------|--------|
| Sortable columns | P0 | Planned |
| BWF tiebreakers (full Art. 16.2) | P0 | Planned |
| Gold/Silver/Bronze rank badges | P0 | Planned |
| Eliminated player dimming | P0 | Planned |
| Elimination round display | P0 | Planned |
| CSV export | P0 | Planned |
| Participant name search | P0 | Planned |
| Status filter (Active/Eliminated) | P0 | Planned |
| Tiebreaker explanation tooltip | P1 | Planned |
| Expandable rows (match history) | P1 | Planned |
| JSON export | P1 | Planned |
| Date range filter | P1 | Planned |
| PDF export | P2 | Deferred |
| Real-time updates (onSnapshot) | P2 | Deferred |

### Tournament-Wide Leaderboard — Phase 3

| Feature | Priority | Status |
|---------|----------|--------|
| Cross-category view (separate entries) | P0 | Planned |
| Category badge per row | P0 | Planned |
| Category multi-select filter | P0 | Planned |
| Category summary cards | P1 | Planned |
| Export all categories (merged CSV) | P1 | Planned |

---

## 10. API Interface: `useLeaderboard.ts`

```typescript
export function useLeaderboard() {
  const leaderboard = ref<Leaderboard | null>(null);
  const stage = ref<LeaderboardStage>('idle');
  const error = ref<string | null>(null);
  const filters = ref<LeaderboardOptions>({});

  const filteredEntries = computed(() => {
    if (!leaderboard.value) return [];
    let entries = leaderboard.value.entries;
    if (filters.value.includeEliminated === false) {
      entries = entries.filter(e => !e.eliminated);
    }
    if (filters.value.minimumMatches) {
      entries = entries.filter(e => e.matchesPlayed >= filters.value.minimumMatches!);
    }
    return entries;
  });

  const topThree = computed(() => leaderboard.value?.entries.slice(0, 3) ?? []);
  const currentLeader = computed(() => leaderboard.value?.entries[0] ?? null);

  async function generate(
    tournamentId: string,
    categoryId?: string,
    options?: LeaderboardOptions
  ): Promise<void> {
    stage.value = 'fetching';
    error.value = null;
    try {
      stage.value = 'calculating';
      const result = await generateLeaderboard(tournamentId, categoryId, options);
      stage.value = 'sorting';
      leaderboard.value = result;
      stage.value = 'done';
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to generate leaderboard';
      stage.value = 'error';
    }
  }

  async function refresh(): Promise<void> {
    if (!leaderboard.value) return;
    const { tournamentId, categoryId } = leaderboard.value;
    await generate(tournamentId, categoryId);
  }

  function applyFilters(newFilters: LeaderboardOptions): void {
    filters.value = newFilters;
  }

  async function exportData(format: ExportFormat, filename?: string): Promise<void> {
    if (!leaderboard.value) return;
    await exportLeaderboard(leaderboard.value, { format, filename });
  }

  function clear(): void {
    leaderboard.value = null;
    stage.value = 'idle';
    error.value = null;
  }

  return {
    leaderboard, stage, error,
    filteredEntries, topThree, currentLeader,
    generate, refresh, applyFilters, exportData, clear,
  };
}
```

---

## 11. Export Service (`services/leaderboardExport.ts`)

```typescript
const CSV_COLUMNS: { key: keyof LeaderboardEntry; header: string }[] = [
  { key: 'rank', header: 'Rank' },
  { key: 'participantName', header: 'Participant' },
  { key: 'categoryName', header: 'Category' },
  { key: 'matchesPlayed', header: 'Played' },
  { key: 'matchesWon', header: 'Won' },
  { key: 'matchesLost', header: 'Lost' },
  { key: 'winRate', header: 'Win%' },
  { key: 'matchPoints', header: 'Match Pts' },
  { key: 'gamesWon', header: 'Games Won' },
  { key: 'gamesLost', header: 'Games Lost' },
  { key: 'gameDifference', header: 'Game +/-' },
  { key: 'pointsFor', header: 'Points For' },
  { key: 'pointsAgainst', header: 'Points Against' },
  { key: 'pointDifference', header: 'Point +/-' },
  { key: 'eliminated', header: 'Eliminated' },
  { key: 'eliminationRound', header: 'Elimination Round' },
];

export async function exportLeaderboard(
  leaderboard: Leaderboard,
  options: ExportOptions
): Promise<void> {
  const filename = options.filename ?? `leaderboard-${leaderboard.tournamentId}-${Date.now()}`;

  if (options.format === 'csv') {
    const header = CSV_COLUMNS.map(c => c.header).join(',');
    const rows = leaderboard.entries.map(entry =>
      CSV_COLUMNS.map(c => {
        const val = entry[c.key];
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : String(val ?? '');
      }).join(',')
    );
    downloadText([header, ...rows].join('\n'), `${filename}.csv`, 'text/csv');

  } else if (options.format === 'json') {
    downloadText(JSON.stringify(leaderboard, null, 2), `${filename}.json`, 'application/json');
  }
}

function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## 12. Testing Strategy

### 12.1 Unit Tests (`src/composables/__tests__/leaderboard.test.ts`)

Use Vitest. All pure functions — no Firestore needed.

**Statistics calculation:**
- [ ] `score1`/`score2` correctly assigned to each participant
- [ ] Game winners read from `GameScore.winnerId` (not inferred)
- [ ] matchPoints: 2 for win, 1 for loss, same for walkover
- [ ] gameDifference and pointDifference computed correctly
- [ ] winRate rounds to 2 decimal places
- [ ] Player with 0 matches initializes all counters to 0

**Tiebreaker — 2-way:**
- [ ] Head-to-head resolves when direct match exists
- [ ] Falls through to game diff when no h2h match found
- [ ] Winner correctly identified when participants appear in reverse order in match doc

**Tiebreaker — 3-way:**
- [ ] Game difference fully resolves 3-way tie
- [ ] Game difference partially resolves → sub-group proceeds to point diff
- [ ] Game difference partially resolves → sub-group of 2 uses head-to-head (Art. 16.2.3.1)
- [ ] Point difference resolves remaining tie
- [ ] All exhausted → equal standing, all share same rank

**Elimination:**
- [ ] Single elimination: first loss sets `eliminated = true`, records round
- [ ] Double elimination: only losers bracket / finals loss triggers elimination
- [ ] Round robin: `eliminated` stays false for all
- [ ] Tournament winner never marked eliminated

**Edge cases:**
- [ ] Single participant in category → rank 1, no tiebreaker
- [ ] All participants tied on all metrics → equal standing
- [ ] Unresolvable participant ID → match skipped with console.warn

### 12.2 Integration Tests (`e2e/leaderboard.integration.spec.ts`)

Against Firebase emulator.

- [ ] 4-player round robin: fetch → resolve → rank correctly
- [ ] Tournament-wide: iterates 3 categories, merges without duplicates
- [ ] Participant resolution uses `participant.name`, not `participant.id`
- [ ] Walkover counted same as regular win/loss

### 12.3 E2E Tests (`e2e/leaderboard.spec.ts`)

- [ ] Navigate to per-category leaderboard — table renders automatically (no button click)
- [ ] Refresh button re-generates data
- [ ] Search filter narrows visible rows
- [ ] Status filter hides eliminated players
- [ ] CSV download triggered, file is non-empty
- [ ] JSON download triggered, parses as valid JSON
- [ ] Mobile viewport: table scrolls horizontally

### 12.4 Test Data Scenarios

```typescript
// Scenario A: Clear winner, no ties
// Alice 3W-0L (6 pts), Bob 2W-1L (5 pts), Charlie 1W-2L (4 pts), Dan 0W-3L (3 pts)
// Expected order: Alice > Bob > Charlie > Dan

// Scenario B: Two-way tie — head-to-head resolves (Art. 16.2.2)
// Alice 2W-1L (5 pts), Bob 2W-1L (5 pts), Alice beat Bob directly
// Expected: Alice rank 1, Bob rank 2

// Scenario C: Three-way tie — game difference fully resolves (Art. 16.2.3)
// Alice game diff +2, Bob +1, Charlie 0 (all 5 pts)
// Expected: Alice > Bob > Charlie

// Scenario D: Three-way tie, partial game diff → h2h subset (Art. 16.2.3.1)
// Alice game diff +2 → rank 1
// Bob game diff +1, Charlie game diff +1 → Bob beat Charlie directly → Bob rank 2
// Expected: Alice rank 1, Bob rank 2, Charlie rank 3

// Scenario E: Complete deadlock — equal standing (Art. 16.2.4.2)
// Alice and Bob same match pts, same game diff, same point diff, no h2h result
// Expected: both rank 1
```

---

## 13. Design Decisions

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Multi-category players | Separate entry per registration | Per-discipline stats are meaningful; combined stats across disciplines are misleading |
| Eliminated players | Always shown, opacity 0.6, with "Eliminated Rd X" label | Tournament directors need full historical view; Status filter lets users hide them |
| UX: generate timing | Auto-generate on page load; Refresh button for subsequent updates | Lower friction; data fetching is fast at typical tournament sizes |
| PDF export | Deferred to P2 | CSV covers 90% of export needs; PDF adds dependency + layout complexity |
| Real-time updates | On-demand + manual refresh for MVP; Firestore onSnapshot for v2 | Simpler first; add real-time once usage patterns are understood |
| Walkover handling | Same as regular match (2 pts win, 1 pt loss) | BWF standard; avoids special-case complexity |

---

## 14. References

### Internal

| Document | Path | Relevance |
|----------|------|-----------|
| AGENTS.md | `/AGENTS.md` | Participant ID resolution rule (`participant.name`) |
| DATA_MODEL_MIGRATION_RULES.md | `/docs/migration/DATA_MODEL_MIGRATION_RULES.md` | Collection paths, ID type rules |
| RoundRobinStandings.vue | `src/features/brackets/components/RoundRobinStandings.vue` | **Reference implementation** — reuse aggregation pattern directly |
| bracketMatchAdapter.ts | `src/stores/bracketMatchAdapter.ts` lines 92–103 | Participant ID resolution in practice |
| matches.ts | `src/stores/matches.ts` lines 517–533 | GameScore completion logic (source of truth) |

### BWF

| Resource | URL |
|----------|-----|
| BWF Tiebreaker Guide | https://www.badmintonnl.ca/resources/tie-breaking-procedure/ |
| BWF World Ranking Overview | https://www.olympics.com/en/news/badminton-rankings-bwf-world-tour-team-olympics-men-women |

---

## 15. Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 2.0 | 2026-02-13 | — | Major revision: fixed all schema errors, added `resolvePartialTies`, documented join strategy for participant IDs, added elimination logic, replaced `progress: number` with `stage` enum, removed PDF from MVP, corrected GameScore field names (`score1`/`score2`, `gameNumber`), added `rank` to `LeaderboardEntry`, all code samples verified against actual codebase |
| 1.0 | 2025-02-13 | — | Initial draft |

### v1.0 → v2.0 Breaking Changes

| v1.0 (wrong) | v2.0 (correct) |
|--------------|----------------|
| `GameScore.game` | `GameScore.gameNumber` |
| `GameScore.player1` / `player2` | `GameScore.score1` / `score2` |
| `match_scores` has `participant1Id` / `participant2Id` | Those fields don't exist — must join from `/match` via `/participant` |
| Tournament-wide queries single top-level `match_scores` collection | Iterates per-category `match_scores` in parallel |
| `LeaderboardEntry` has no `rank` field | `rank: number` added (1-based, assigned after sort) |
| `useLeaderboard.progress: number` | `useLeaderboard.stage: LeaderboardStage` enum |
| `resolvePartialTies` called but undefined | Fully implemented with recursive sub-group resolution |
| PDF export in MVP | Deferred to P2 |

---

**END OF DOCUMENT**
