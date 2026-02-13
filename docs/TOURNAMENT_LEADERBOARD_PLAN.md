# Tournament Leaderboard Implementation Plan

**Document Version:** 1.0  
**Status:** Ready for Implementation  
**Standards:** BWF (Badminton World Federation) Compliant  
**Date:** February 2025

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
13. [Open Questions](#13-open-questions)
14. [References](#14-references)

---

## 1. Executive Summary

This document outlines the complete implementation plan for a **Tournament Leaderboard** system for CourtMaster v2. The leaderboard will support both **per-category** and **tournament-wide** views, implementing **BWF (Badminton World Federation) standard tiebreaker rules** for fair and accurate rankings.

### Key Features
- Single source of truth from `/match_scores` collection
- BWF Article 16.2 compliant tiebreaker logic
- Support for all tournament formats (Single Elimination, Double Elimination, Round Robin, Pool to Elimination)
- Exportable to CSV and PDF
- Sortable, filterable data tables
- On-demand calculation (real-time support planned for future)

---

## 2. Data Source Verification

### 2.1 Single Source of Truth: `/match_scores`

Per **AGENTS.md Section 6** and **DATA_MODEL_MIGRATION_RULES.md**:

| Collection | Purpose | Leaderboard Usage |
|------------|---------|-------------------|
| `/match_scores` | **Operational Data** | **PRIMARY SOURCE** - Scores, winnerId, status |
| `/match` | Bracket Structure | Read-only for bracket position (optional) |
| `/registrations` | Participant Registry | Resolve registrationId → player names |
| `/players` | Player Details | Get firstName/lastName for display |

### 2.2 Critical Schema

```typescript
// /tournaments/{tournamentId}/match_scores/{matchId}
{
  // Document ID = match ID from /match collection
  status: "completed",           // String: Only process "completed"
  scores: [                      // Array of game scores
    { game: 1, player1: 21, player2: 15 },
    { game: 2, player1: 21, player2: 18 }
  ],
  winnerId: "registrationId123", // Registration ID of winner
  completedAt: Timestamp,        // When match finished
  courtId: "court1",            // Court assignment (optional)
  startedAt: Timestamp          // When match started (optional)
}
```

**Query Rule:** Only read matches where `status === "completed"` AND `winnerId` exists.

### 2.3 Supporting Collections

#### Registrations (`/tournaments/{id}/registrations`)
```typescript
{
  id: string;                    // Registration ID (links to match_scores.winnerId)
  tournamentId: string;
  categoryId: string;
  playerId?: string;            // For singles
  teamId?: string;              // For doubles
  partnerPlayerId?: string;     // For doubles
  teamName?: string;            // Display name for doubles teams
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'checked_in';
  seed?: number;
}
```

#### Players (`/tournaments/{id}/players`)
```typescript
{
  id: string;                    // Player ID (links to registration.playerId)
  firstName: string;
  lastName: string;
  email?: string;
}
```

### 2.4 Critical ID Pattern (AGENTS.md Section 6)

**⚠️ IMPORTANT:** When looking up registration IDs from brackets-manager data:

```typescript
// ✅ CORRECT: Use participant.name for registration ID
const registrationId = participant.name;  // Firestore doc ID

// ❌ WRONG: Never use participant.id for registration lookups
const registrationId = participant.id;    // Numeric brackets-manager ID only
```

This is handled in `src/stores/bracketMatchAdapter.ts` lines 100-103.

---

## 3. Scope Definition

### 3.1 Per-Category Leaderboard

**Purpose:** Standings within a single category (Men's Singles, Women's Doubles, etc.)

**Data:** All matches in one category

**Use Cases:**
- Round robin pool standings
- Tracking progression within a division
- Category-specific rankings

**Existing Implementation:** `RoundRobinStandings.vue` (reference pattern)

**Path:** `/tournaments/{tournamentId}/categories/{categoryId}/`

### 3.2 Tournament-Wide Leaderboard

**Purpose:** Aggregate performance across ALL categories in a tournament

**Data:** All matches across all categories in tournament

**Use Cases:**
- Overall tournament MVP tracking
- Best performer across divisions
- Tournament statistics summary

**Calculation:** Sum stats across all participant's registrations (one player may have multiple entries if registered in multiple categories)

**Path:** `/tournaments/{tournamentId}/`

---

## 4. BWF Tiebreaker Rules

Per **BWF Statutes, Chapter 5, Section 5.1, Article 16.2** (General Competition Regulations)

### 4.1 Tiebreaker Hierarchy

| Priority | Rule | Description |
|----------|------|-------------|
| **1** | Match Wins | Higher number of matches won |
| **2** | **Head-to-Head** | If 2-way tie: Winner of direct match ranks higher (Art. 16.2.2) |
| **3** | **Game Difference** | If 3+ way tie: (Games Won - Games Lost), greater difference ranked higher (Art. 16.2.3) |
| **4** | **Head-to-Head (subset)** | If still leaves 2 players equal after game diff, winner of match between them ranks higher (Art. 16.2.3.1) |
| **5** | **Point Difference** | (Points Won - Points Lost), greater difference ranked higher (Art. 16.2.4) |
| **6** | **Head-to-Head (final)** | If still leaves 2 players equal, winner of direct match ranks higher (Art. 16.2.4.1) |
| **7** | Equal Standing | If after all procedures tie still exists, equal ranking awarded (Art. 16.2.4.2) |

### 4.2 Point System

- **Win:** 2 match points
- **Loss:** 1 match point (participation credit)

### 4.3 Two-Way Tie Example

```
Paul: 3 wins, 1 loss (7 match points)
Art:  3 wins, 1 loss (7 match points)

Tiebreaker: Paul beat Art in their head-to-head match
Result: Paul ranked higher than Art
```

### 4.4 Three-Way Tie Example

```
Joan: 2 wins, 1 loss
Kate: 2 wins, 1 loss  
Mary: 2 wins, 1 loss

Step 1: All have same match points (5 each)
Step 2: Calculate game difference
  - Joan: 4 games won, 2 lost = +2
  - Kate: 4 games won, 3 lost = +1
  - Mary: 3 games won, 3 lost = 0
Result: Joan (1st), Kate (2nd), Mary (3rd)
```

### 4.5 Three-Way Tie with Equal Game Difference

```
If game differences are equal, proceed to point difference:
  - Calculate total points scored minus total points conceded
  - Greater point difference ranked higher
  
If point differences are equal:
  - Check head-to-head among remaining tied players
  
If still tied:
  - Equal standing awarded
```

---

## 5. Data Model

### 5.1 Core Types

```typescript
// ============================================
// src/types/leaderboard.ts
// ============================================

/**
 * Scope of the leaderboard calculation
 */
export type LeaderboardScope = 'category' | 'tournament';

/**
 * Steps in BWF tiebreaker procedure
 */
export type TieBreakerStep = 
  | 'match_wins'
  | 'head_to_head'
  | 'game_difference'
  | 'point_difference'
  | 'equal';

/**
 * Individual participant entry in leaderboard
 */
export interface LeaderboardEntry {
  // Identity
  registrationId: string;        // Firestore registration document ID
  participantName: string;       // Display name (player or team)
  participantType: 'player' | 'team';
  categoryId: string;           // Category this entry belongs to
  categoryName: string;         // Human-readable category name
  
  // Match Statistics
  matchesPlayed: number;        // Total completed matches
  matchesWon: number;           // Matches won
  matchesLost: number;          // Matches lost
  matchPoints: number;          // 2 per win, 1 per loss (BWF standard)
  
  // Game Statistics (for BWF tiebreakers)
  gamesWon: number;             // Total games won across all matches
  gamesLost: number;            // Total games lost across all matches
  gameDifference: number;       // gamesWon - gamesLost
  
  // Point Statistics (for BWF tiebreakers)
  pointsFor: number;            // Total points scored
  pointsAgainst: number;        // Total points conceded
  pointDifference: number;      // pointsFor - pointsAgainst
  
  // Derived Statistics
  winRate: number;              // (matchesWon / matchesPlayed) * 100
  averagePointsPerGame: number; // pointsFor / gamesPlayed
  
  // Tournament Progress (for elimination formats)
  currentRound: number;         // Current round in bracket (if active)
  eliminated: boolean;          // Whether player is eliminated
  eliminationRound?: number;    // Round where eliminated (if applicable)
  finalPlacement?: number;      // Final tournament placement (1st, 2nd, 3rd, etc.)
  
  // Metadata
  lastMatchAt?: Date;           // Timestamp of most recent match
  firstMatchAt?: Date;          // Timestamp of first match
}

/**
 * Complete leaderboard data structure
 */
export interface Leaderboard {
  // Identification
  scope: LeaderboardScope;
  tournamentId: string;
  categoryId?: string;          // Only populated for category scope
  
  // Generation metadata
  generatedAt: Date;
  generatedBy?: string;         // User ID who generated
  
  // Entries
  entries: LeaderboardEntry[];  // Sorted by rank (index 0 = 1st place)
  
  // Summary Statistics
  totalMatches: number;         // Total matches in scope
  completedMatches: number;     // Completed matches
  inProgressMatches: number;    // Currently playing
  totalParticipants: number;    // Unique participants
  activeParticipants: number;   // Not eliminated
  eliminatedParticipants: number;
  
  // Category breakdown (for tournament-wide view)
  categories?: CategorySummary[];
  
  // Tiebreaker audit trail
  tiebreakerResolutions?: TiebreakerResolution[];
}

/**
 * Summary statistics for a category
 */
export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  totalParticipants: number;
  matchesCompleted: number;
  matchesTotal: number;
  completionPercentage: number;
  topThree: LeaderboardEntry[];
}

/**
 * Record of how a tie was resolved
 */
export interface TiebreakerResolution {
  tiedRank: number;             // The rank where tie occurred
  registrationIds: string[];    // All players involved in tie
  step: TieBreakerStep;         // Which tiebreaker step was used
  description: string;          // Human-readable explanation
  resolvedOrder: string[];      // Registration IDs in resolved order
  headToHeadMatchId?: string;   // If resolved by head-to-head
}

/**
 * Options for generating leaderboard
 */
export interface LeaderboardOptions {
  includeEliminated?: boolean;  // Include eliminated players (default: true)
  minimumMatches?: number;      // Minimum matches to be ranked (default: 0)
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  categoryIds?: string[];       // Filter to specific categories (tournament scope)
}

/**
 * Export formats
 */
export type ExportFormat = 'csv' | 'pdf' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeMetadata?: boolean;
  columns?: string[];           // Specific columns to include
}
```

### 5.2 Statistics Calculation

#### Match Points (BWF Standard)
```typescript
function calculateMatchPoints(wins: number, losses: number): number {
  return (wins * 2) + (losses * 1);
}
```

#### Game Statistics
```typescript
interface GameStats {
  gamesWon: number;
  gamesLost: number;
  totalPoints: number;
}

function calculateGameStats(scores: GameScore[], isPlayer1: boolean): GameStats {
  let gamesWon = 0;
  let gamesLost = 0;
  let totalPoints = 0;
  
  for (const score of scores) {
    const myScore = isPlayer1 ? score.score1 : score.score2;
    const opponentScore = isPlayer1 ? score.score2 : score.score1;
    
    totalPoints += myScore;
    
    if (score.isComplete) {
      if (score.winnerId === (isPlayer1 ? participant1Id : participant2Id)) {
        gamesWon++;
      } else {
        gamesLost++;
      }
    }
  }
  
  return { gamesWon, gamesLost, totalPoints };
}
```

#### Win Rate
```typescript
function calculateWinRate(wins: number, total: number): number {
  return total > 0 ? Math.round((wins / total) * 100 * 100) / 100 : 0;
}
```

---

## 6. Algorithm Specification

### 6.1 Phase 1: Data Collection

```typescript
/**
 * Fetch all necessary data for leaderboard calculation
 */
async function fetchLeaderboardData(
  tournamentId: string,
  categoryId?: string,
  options?: LeaderboardOptions
): Promise<LeaderboardData> {
  
  // Parallel fetch for efficiency
  const [
    registrations,
    players,
    categories,
    matches
  ] = await Promise.all([
    // 1. Fetch registrations for participant info
    fetchRegistrations(tournamentId, categoryId, options),
    
    // 2. Fetch players for name resolution
    fetchPlayers(tournamentId),
    
    // 3. Fetch categories for metadata
    fetchCategories(tournamentId),
    
    // 4. Fetch completed matches from match_scores
    fetchCompletedMatches(tournamentId, categoryId, options)
  ]);
  
  return {
    registrations,
    players,
    categories,
    matches,
    tournamentId,
    categoryId
  };
}

/**
 * Fetch only completed matches with scores
 */
async function fetchCompletedMatches(
  tournamentId: string,
  categoryId?: string,
  options?: LeaderboardOptions
): Promise<Match[]> {
  const basePath = categoryId
    ? `tournaments/${tournamentId}/categories/${categoryId}/match_scores`
    : `tournaments/${tournamentId}/match_scores`;
  
  const constraints: QueryConstraint[] = [
    where('status', '==', 'completed'),
    where('winnerId', '!=', null)
  ];
  
  // Add date range filter if specified
  if (options?.dateRange?.start) {
    constraints.push(where('completedAt', '>=', options.dateRange.start));
  }
  if (options?.dateRange?.end) {
    constraints.push(where('completedAt', '<=', options.dateRange.end));
  }
  
  const q = query(collection(db, basePath), ...constraints);
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Match[];
}
```

### 6.2 Phase 2: Statistics Aggregation

```typescript
/**
 * Aggregate statistics for all participants
 */
function aggregateLeaderboardStats(
  data: LeaderboardData
): Map<string, LeaderboardEntry> {
  
  const { registrations, players, categories, matches, tournamentId, categoryId } = data;
  
  // Initialize map for O(1) lookup
  const statsMap = new Map<string, LeaderboardEntry>();
  
  // Create category lookup for names
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  
  // Initialize all approved/checked_in participants
  for (const reg of registrations) {
    if (reg.status === 'approved' || reg.status === 'checked_in') {
      const category = categoryMap.get(reg.categoryId);
      
      statsMap.set(reg.id, {
        registrationId: reg.id,
        participantName: resolveParticipantName(reg, players),
        participantType: reg.teamId ? 'team' : 'player',
        categoryId: reg.categoryId,
        categoryName: category?.name || 'Unknown',
        
        // Initialize counters
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
        averagePointsPerGame: 0,
        
        // Progress tracking
        currentRound: 0,
        eliminated: false,
        
        // Metadata
        lastMatchAt: undefined,
        firstMatchAt: undefined
      });
    }
  }
  
  // Process each completed match
  for (const match of matches) {
    if (!match.winnerId || !match.participant1Id || !match.participant2Id) {
      continue; // Skip invalid matches
    }
    
    const p1 = statsMap.get(match.participant1Id);
    const p2 = statsMap.get(match.participant2Id);
    
    if (!p1 || !p2) {
      console.warn(`Participants not found for match ${match.id}`);
      continue;
    }
    
    // Update match statistics
    updateMatchStats(p1, p2, match);
  }
  
  // Calculate derived fields for all entries
  for (const entry of statsMap.values()) {
    calculateDerivedFields(entry);
  }
  
  return statsMap;
}

/**
 * Update statistics for a single match
 */
function updateMatchStats(
  p1: LeaderboardEntry,
  p2: LeaderboardEntry,
  match: Match
): void {
  
  // Increment matches played
  p1.matchesPlayed++;
  p2.matchesPlayed++;
  
  // Process scores
  for (const score of match.scores) {
    p1.pointsFor += score.score1;
    p1.pointsAgainst += score.score2;
    p2.pointsFor += score.score2;
    p2.pointsAgainst += score.score1;
    
    if (score.isComplete) {
      if (score.winnerId === match.participant1Id) {
        p1.gamesWon++;
        p2.gamesLost++;
      } else {
        p2.gamesWon++;
        p1.gamesLost++;
      }
    }
  }
  
  // Update win/loss
  if (match.winnerId === match.participant1Id) {
    p1.matchesWon++;
    p1.matchPoints += 2;  // BWF: 2 points for win
    p2.matchesLost++;
    p2.matchPoints += 1;  // BWF: 1 point for loss
  } else {
    p2.matchesWon++;
    p2.matchPoints += 2;
    p1.matchesLost++;
    p1.matchPoints += 1;
  }
  
  // Update round tracking
  if (match.round > p1.currentRound) p1.currentRound = match.round;
  if (match.round > p2.currentRound) p2.currentRound = match.round;
  
  // Update timestamps
  const completedAt = match.completedAt?.toDate();
  if (completedAt) {
    if (!p1.lastMatchAt || completedAt > p1.lastMatchAt) {
      p1.lastMatchAt = completedAt;
    }
    if (!p1.firstMatchAt || completedAt < p1.firstMatchAt) {
      p1.firstMatchAt = completedAt;
    }
    
    if (!p2.lastMatchAt || completedAt > p2.lastMatchAt) {
      p2.lastMatchAt = completedAt;
    }
    if (!p2.firstMatchAt || completedAt < p2.firstMatchAt) {
      p2.firstMatchAt = completedAt;
    }
  }
}

/**
 * Calculate derived statistics
 */
function calculateDerivedFields(entry: LeaderboardEntry): void {
  // Game difference
  entry.gameDifference = entry.gamesWon - entry.gamesLost;
  
  // Point difference
  entry.pointDifference = entry.pointsFor - entry.pointsAgainst;
  
  // Win rate
  entry.winRate = entry.matchesPlayed > 0
    ? Math.round((entry.matchesWon / entry.matchesPlayed) * 100 * 100) / 100
    : 0;
  
  // Average points per game
  const totalGames = entry.gamesWon + entry.gamesLost;
  entry.averagePointsPerGame = totalGames > 0
    ? Math.round((entry.pointsFor / totalGames) * 100) / 100
    : 0;
}

/**
 * Resolve participant name from registration and players
 */
function resolveParticipantName(
  registration: Registration,
  players: Player[]
): string {
  // Team name takes priority
  if (registration.teamName) {
    return registration.teamName;
  }
  
  // Look up player name
  if (registration.playerId) {
    const player = players.find(p => p.id === registration.playerId);
    if (player) {
      return `${player.firstName} ${player.lastName}`;
    }
  }
  
  return 'Unknown';
}
```

### 6.3 Phase 3: BWF Tiebreaker Sorting

```typescript
/**
 * Sort entries using BWF tiebreaker rules
 */
function sortWithBWFTiebreaker(
  entries: LeaderboardEntry[],
  matches: Match[]
): { sorted: LeaderboardEntry[]; resolutions: TiebreakerResolution[] } {
  
  const resolutions: TiebreakerResolution[] = [];
  
  // Step 1: Group by match points
  const byMatchPoints = groupBy(entries, e => e.matchPoints);
  const sortedKeys = Array.from(byMatchPoints.keys()).sort((a, b) => b - a);
  
  const sortedEntries: LeaderboardEntry[] = [];
  let currentRank = 1;
  
  for (const matchPoints of sortedKeys) {
    const group = byMatchPoints.get(matchPoints)!;
    
    if (group.length === 1) {
      // No tie - add directly
      sortedEntries.push(group[0]);
      currentRank++;
    } else {
      // Resolve tie within this group
      const { sorted: resolvedGroup, resolution } = resolveTieGroup(
        group,
        matches,
        currentRank
      );
      
      sortedEntries.push(...resolvedGroup);
      if (resolution) {
        resolutions.push(resolution);
      }
      currentRank += resolvedGroup.length;
    }
  }
  
  return { sorted: sortedEntries, resolutions };
}

/**
 * Resolve a group of tied entries
 */
function resolveTieGroup(
  tiedEntries: LeaderboardEntry[],
  allMatches: Match[],
  startRank: number
): { sorted: LeaderboardEntry[]; resolution?: TiebreakerResolution } {
  
  const registrationIds = tiedEntries.map(e => e.registrationId);
  
  // Two-way tie: Head-to-head
  if (tiedEntries.length === 2) {
    const [p1, p2] = tiedEntries;
    const headToHeadMatch = findHeadToHeadMatch(p1.registrationId, p2.registrationId, allMatches);
    
    if (headToHeadMatch) {
      const winner = headToHeadMatch.winnerId === p1.registrationId ? p1 : p2;
      const loser = winner === p1 ? p2 : p1;
      
      return {
        sorted: [winner, loser],
        resolution: {
          tiedRank: startRank,
          registrationIds,
          step: 'head_to_head',
          description: `Resolved by head-to-head match (Match ${headToHeadMatch.id})`,
          resolvedOrder: [winner.registrationId, loser.registrationId],
          headToHeadMatchId: headToHeadMatch.id
        }
      };
    }
  }
  
  // Three+ way tie: Game difference
  const byGameDiff = [...tiedEntries].sort((a, b) => b.gameDifference - a.gameDifference);
  
  // Check if game difference resolves all
  if (!allEqual(byGameDiff.map(e => e.gameDifference))) {
    // Partial resolution - recurse on sub-groups
    return resolvePartialTies(byGameDiff, allMatches, startRank, 'game_difference');
  }
  
  // Still tied: Point difference
  const byPointDiff = [...tiedEntries].sort((a, b) => b.pointDifference - a.pointDifference);
  
  if (!allEqual(byPointDiff.map(e => e.pointDifference))) {
    return resolvePartialTies(byPointDiff, allMatches, startRank, 'point_difference');
  }
  
  // Final: Check head-to-head among remaining tied
  // If still tied, equal standing
  return {
    sorted: tiedEntries, // Return in original order (equal standing)
    resolution: {
      tiedRank: startRank,
      registrationIds,
      step: 'equal',
      description: 'Tie could not be resolved - equal standing awarded',
      resolvedOrder: registrationIds
    }
  };
}

/**
 * Find head-to-head match between two participants
 */
function findHeadToHeadMatch(
  p1Id: string,
  p2Id: string,
  matches: Match[]
): Match | undefined {
  return matches.find(m => 
    (m.participant1Id === p1Id && m.participant2Id === p2Id) ||
    (m.participant1Id === p2Id && m.participant2Id === p1Id)
  );
}

/**
 * Check if all values in array are equal
 */
function allEqual(values: number[]): boolean {
  return values.every(v => v === values[0]);
}

/**
 * Group array by key function
 */
function groupBy<T, K>(array: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of array) {
    const key = keyFn(item);
    const group = map.get(key) || [];
    group.push(item);
    map.set(key, group);
  }
  return map;
}
```

### 6.4 Main Generation Function

```typescript
/**
 * Generate complete leaderboard
 */
export async function generateLeaderboard(
  tournamentId: string,
  categoryId?: string,
  options?: LeaderboardOptions
): Promise<Leaderboard> {
  
  const startTime = Date.now();
  
  // Phase 1: Fetch data
  const data = await fetchLeaderboardData(tournamentId, categoryId, options);
  
  // Phase 2: Aggregate statistics
  const statsMap = aggregateLeaderboardStats(data);
  
  // Filter by minimum matches if specified
  let entries = Array.from(statsMap.values());
  if (options?.minimumMatches) {
    entries = entries.filter(e => e.matchesPlayed >= options.minimumMatches!);
  }
  
  // Filter eliminated if specified
  if (options?.includeEliminated === false) {
    entries = entries.filter(e => !e.eliminated);
  }
  
  // Phase 3: Sort with BWF tiebreaker
  const { sorted: sortedEntries, resolutions } = sortWithBWFTiebreaker(
    entries,
    data.matches
  );
  
  // Calculate summary statistics
  const totalMatches = data.matches.length;
  const completedMatches = data.matches.filter(m => m.status === 'completed').length;
  const inProgressMatches = data.matches.filter(m => m.status === 'in_progress').length;
  
  // Build category summaries for tournament-wide view
  let categories: CategorySummary[] | undefined;
  if (!categoryId) {
    categories = generateCategorySummaries(data.categories, statsMap, data.matches);
  }
  
  const endTime = Date.now();
  
  return {
    scope: categoryId ? 'category' : 'tournament',
    tournamentId,
    categoryId,
    generatedAt: new Date(),
    entries: sortedEntries,
    totalMatches,
    completedMatches,
    inProgressMatches,
    totalParticipants: entries.length,
    activeParticipants: entries.filter(e => !e.eliminated).length,
    eliminatedParticipants: entries.filter(e => e.eliminated).length,
    categories,
    tiebreakerResolutions: resolutions
  };
}
```

---

## 7. File Structure

```
src/
├── types/
│   ├── index.ts                    # Existing: Core types
│   └── leaderboard.ts              # NEW: Leaderboard-specific types
│
├── composables/
│   ├── useMatchScheduler.ts        # Existing
│   └── useLeaderboard.ts           # NEW: Leaderboard logic composable
│
├── components/
│   ├── leaderboard/
│   │   ├── LeaderboardTable.vue    # NEW: Main data table
│   │   ├── LeaderboardFilters.vue  # NEW: Filter controls
│   │   ├── LeaderboardExport.vue   # NEW: Export buttons
│   │   ├── LeaderboardSummary.vue  # NEW: Stats cards
│   │   ├── LeaderboardRow.vue      # NEW: Individual row component
│   │   └── TiebreakerTooltip.vue   # NEW: Tiebreaker explanation
│   │
│   └── TournamentLeaderboard.vue   # NEW: Main container
│
├── features/
│   ├── brackets/
│   │   └── components/
│   │       └── RoundRobinStandings.vue  # Existing: Reference implementation
│   │
│   └── tournaments/
│       └── views/
│           └── LeaderboardView.vue # NEW: Full page view
│
├── services/
│   └── leaderboardExport.ts        # NEW: Export utilities
│
└── utils/
    └── leaderboard.ts              # NEW: Helper functions
```

### 7.1 File Descriptions

| File | Purpose | Lines Est. |
|------|---------|------------|
| `types/leaderboard.ts` | TypeScript interfaces and types | ~150 |
| `composables/useLeaderboard.ts` | Core calculation logic, data fetching | ~400 |
| `components/leaderboard/LeaderboardTable.vue` | Vuetify data table with sorting | ~300 |
| `components/leaderboard/LeaderboardFilters.vue` | Filter inputs and controls | ~150 |
| `components/leaderboard/LeaderboardExport.vue` | Export buttons and logic | ~100 |
| `components/leaderboard/LeaderboardSummary.vue` | Summary statistics cards | ~120 |
| `components/leaderboard/LeaderboardRow.vue` | Expandable row with details | ~80 |
| `components/leaderboard/TiebreakerTooltip.vue` | BWF tiebreaker explanation | ~60 |
| `components/TournamentLeaderboard.vue` | Main container component | ~200 |
| `features/tournaments/views/LeaderboardView.vue` | Full page view with routing | ~150 |
| `services/leaderboardExport.ts` | CSV/PDF export utilities | ~150 |
| `utils/leaderboard.ts` | Helper functions | ~100 |
| **Total** | | **~1,960 lines** |

---

## 8. Component Specification

### 8.1 LeaderboardTable.vue

**Props:**
```typescript
interface Props {
  entries: LeaderboardEntry[];
  loading: boolean;
  sortable?: boolean;           // Enable column sorting (default: true)
  showCategory?: boolean;       // Show category column (default: false)
  highlightTopThree?: boolean;  // Gold/Silver/Bronze styling (default: true)
  dense?: boolean;              // Compact mode (default: false);
  itemsPerPage?: number;        // Pagination (default: -1 = all)
}
```

**Events:**
```typescript
interface Emits {
  (e: 'row-click', entry: LeaderboardEntry): void;
  (e: 'sort-change', sortBy: string, sortDesc: boolean): void;
}
```

**Columns:**
| # | Column | Key | Align | Sortable | Format |
|---|--------|-----|-------|----------|--------|
| 1 | Rank | `rank` | center | No | Badge (Gold/Silver/Bronze) |
| 2 | Participant | `participantName` | left | Yes | Bold text, clickable |
| 3 | Category | `categoryName` | left | Yes | Category badge |
| 4 | Played | `matchesPlayed` | center | Yes | Number |
| 5 | Won | `matchesWon` | center | Yes | Success color |
| 6 | Lost | `matchesLost` | center | Yes | Error color |
| 7 | Win % | `winRate` | center | Yes | `0.00%` |
| 8 | Match Pts | `matchPoints` | center | Yes | Primary chip |
| 9 | Games +/- | `gameDifference` | center | Yes | `+5` / `-3` |
| 10 | Points +/- | `pointDifference` | center | Yes | `+45` / `-20` |

**Features:**
- Expandable rows showing:
  - Match history (last 5 matches)
  - Tiebreaker explanation (if applicable)
  - Current round/elimination status
- Sticky header
- Horizontal scroll on mobile
- Virtual scrolling for large datasets (>100 entries)

**Styling:**
```scss
.leaderboard-table {
  // Top 3 highlighting
  tr.rank-1 { background: rgba(255, 215, 0, 0.1); }  // Gold
  tr.rank-2 { background: rgba(192, 192, 192, 0.1); } // Silver
  tr.rank-3 { background: rgba(205, 127, 50, 0.1); }  // Bronze
  
  // Eliminated players
  tr.eliminated { opacity: 0.6; }
  
  // Sort indicators
  th.sortable { cursor: pointer; }
  th.sorted-asc::after { content: ' ▲'; }
  th.sorted-desc::after { content: ' ▼'; }
}
```

### 8.2 LeaderboardFilters.vue

**Props:**
```typescript
interface Props {
  categories: Category[];
  loading?: boolean;
}
```

**Filters:**
1. **Category Select** (tournament-wide view only)
   - Multi-select dropdown
   - "All Categories" option
   
2. **Status Filter**
   - Options: All, Active, Eliminated
   - Chip group UI
   
3. **Search Input**
   - Debounced text search
   - Searches participant names
   
4. **Minimum Matches Slider**
   - Range: 0 to max matches played
   - Shows current value
   
5. **Date Range Picker**
   - Start date / End date
   - Filters matches completed within range

**Events:**
```typescript
interface Emits {
  (e: 'update:filters', filters: LeaderboardFilters): void;
  (e: 'reset'): void;
}
```

### 8.3 LeaderboardExport.vue

**Export Formats:**

| Format | Extension | Description |
|--------|-----------|-------------|
| CSV | `.csv` | Spreadsheet format, all columns |
| PDF | `.pdf` | Formatted table, print-ready |
| JSON | `.json` | Raw data with metadata |

**CSV Columns:**
```csv
Rank,Participant,Category,Played,Won,Lost,WinPercentage,MatchPoints,
GamesWon,GamesLost,GamesDifference,PointsFor,PointsAgainst,PointsDifference,
CurrentRound,Eliminated,FinalPlacement,LastMatchDate
```

**PDF Layout:**
- Header: Tournament name, generation date
- Table: All columns, styled
- Footer: Page numbers, tiebreaker notes

**Props:**
```typescript
interface Props {
  leaderboard: Leaderboard;
  disabled?: boolean;
}
```

### 8.4 LeaderboardSummary.vue

**Statistics Cards:**

| Card | Icon | Value | Description |
|------|------|-------|-------------|
| Participants | mdi-account-group | `totalParticipants` | Total registered players |
| Matches | mdi-tournament | `completedMatches / totalMatches` | Completion progress |
| Completion | mdi-chart-pie | `completionPercentage`% | Progress bar |
| Top Performer | mdi-trophy | `entries[0].participantName` | Current leader |

**Layout:**
- 4-column grid on desktop
- 2-column on tablet
- 1-column on mobile

### 8.5 TournamentLeaderboard.vue (Container)

**Responsibilities:**
1. Fetch data on mount
2. Manage filter state
3. Generate leaderboard on demand
4. Handle exports
5. Display error states

**Template Structure:**
```vue
<template>
  <div class="tournament-leaderboard">
    <!-- Header -->
    <div class="leaderboard-header">
      <h1>Leaderboard</h1>
      <LeaderboardExport :leaderboard="leaderboard" />
    </div>
    
    <!-- Summary Cards -->
    <LeaderboardSummary :stats="leaderboardStats" />
    
    <!-- Filters -->
    <LeaderboardFilters
      :categories="categories"
      @update:filters="applyFilters"
    />
    
    <!-- Generate Button -->
    <v-btn
      color="primary"
      :loading="loading"
      @click="generateLeaderboard"
    >
      Generate Leaderboard
    </v-btn>
    
    <!-- Data Table -->
    <LeaderboardTable
      :entries="leaderboard?.entries || []"
      :loading="loading"
      :show-category="scope === 'tournament'"
      @row-click="navigateToParticipant"
    />
    
    <!-- Empty State -->
    <v-alert
      v-if="!loading && !leaderboard?.entries.length"
      type="info"
    >
      No completed matches found. Play some matches to see the leaderboard.
    </v-alert>
  </div>
</template>
```

---

## 9. Feature Matrix

### 9.1 Per-Category Leaderboard

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Sortable columns | ✓ Planned | P0 | All columns |
| BWF Tiebreakers | ✓ Planned | P0 | Full Article 16.2 |
| Gold/Silver/Bronze badges | ✓ Planned | P0 | Top 3 styling |
| Expandable rows | ✓ Planned | P1 | Match history |
| Export CSV | ✓ Planned | P0 | Standard format |
| Export PDF | ✓ Planned | P1 | Print-ready |
| Export JSON | ✓ Planned | P1 | Raw data |
| Search participants | ✓ Planned | P0 | Name search |
| Filter by status | ✓ Planned | P0 | Active/Eliminated |
| Minimum matches filter | ✓ Planned | P1 | Threshold setting |
| Date range filter | ✓ Planned | P1 | Match date range |
| Tiebreaker explanation | ✓ Planned | P1 | Tooltip/popover |
| Responsive design | ✓ Planned | P0 | Mobile-friendly |
| Pagination | ✓ Planned | P1 | For large datasets |
| Virtual scrolling | Future | P2 | >100 entries |
| Charts/Graphs | Future | P2 | Performance trends |
| Real-time updates | Future | P2 | Firestore listeners |

### 9.2 Tournament-Wide Leaderboard

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Cross-category aggregation | ✓ Planned | P0 | All categories |
| Category filter | ✓ Planned | P0 | Multi-select |
| Category comparison | ✓ Planned | P1 | Side-by-side stats |
| Tournament MVP calculation | ✓ Planned | P1 | Best overall performance |
| Multi-registration handling | ✓ Planned | P1 | One player, multiple categories |
| Export all categories | ✓ Planned | P1 | Separate sheets per category |
| Global statistics | ✓ Planned | P0 | Tournament totals |
| Category breakdown | ✓ Planned | P1 | Per-category summaries |
| All per-category features | ✓ Planned | P0 | Inherits all features |

---

## 10. API Interface

### 10.1 useLeaderboard.ts Composable

```typescript
/**
 * Composable for leaderboard functionality
 */
export function useLeaderboard() {
  // ==========================================
  // State
  // ==========================================
  
  const leaderboard = ref<Leaderboard | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const progress = ref(0); // 0-100 for generation progress
  
  // ==========================================
  // Getters (Computed)
  // ==========================================
  
  /**
   * Top 3 performers
   */
  const topThree = computed<LeaderboardEntry[]>(() => {
    return leaderboard.value?.entries.slice(0, 3) || [];
  });
  
  /**
   * Number of eliminated participants
   */
  const eliminatedCount = computed<number>(() => {
    return leaderboard.value?.entries.filter(e => e.eliminated).length || 0;
  });
  
  /**
   * Completion percentage
   */
  const completionPercentage = computed<number>(() => {
    if (!leaderboard.value || leaderboard.value.totalMatches === 0) return 0;
    return Math.round(
      (leaderboard.value.completedMatches / leaderboard.value.totalMatches) * 100
    );
  });
  
  /**
   * Current leader
   */
  const currentLeader = computed<LeaderboardEntry | null>(() => {
    return leaderboard.value?.entries[0] || null;
  });
  
  /**
   * All categories in current leaderboard
   */
  const categories = computed<CategorySummary[]>(() => {
    return leaderboard.value?.categories || [];
  });
  
  // ==========================================
  // Actions
  // ==========================================
  
  /**
   * Generate leaderboard data
   * 
   * @param tournamentId - Tournament ID
   * @param categoryId - Optional category ID (if omitted, tournament-wide)
   * @param options - Generation options
   */
  async function generate(
    tournamentId: string,
    categoryId?: string,
    options?: LeaderboardOptions
  ): Promise<void>;
  
  /**
   * Refresh leaderboard with current filters
   */
  async function refresh(): Promise<void>;
  
  /**
   * Export leaderboard to file
   * 
   * @param format - Export format
   * @param filename - Optional custom filename
   */
  async function exportData(
    format: ExportFormat,
    filename?: string
  ): Promise<void>;
  
  /**
   * Get entry by registration ID
   */
  function getEntry(registrationId: string): LeaderboardEntry | undefined;
  
  /**
   * Get participant's rank
   */
  function getRank(registrationId: string): number | undefined;
  
  /**
   * Clear leaderboard data
   */
  function clear(): void;
  
  // ==========================================
  // Return
  // ==========================================
  
  return {
    // State
    leaderboard,
    loading,
    error,
    progress,
    
    // Getters
    topThree,
    eliminatedCount,
    completionPercentage,
    currentLeader,
    categories,
    
    // Actions
    generate,
    refresh,
    exportData,
    getEntry,
    getRank,
    clear
  };
}
```

### 10.2 Usage Example

```vue
<script setup lang="ts">
import { useLeaderboard } from '@/composables/useLeaderboard';

const props = defineProps<{
  tournamentId: string;
  categoryId?: string;
}>();

const {
  leaderboard,
  loading,
  error,
  topThree,
  generate,
  exportData
} = useLeaderboard();

// Generate on mount
onMounted(async () => {
  await generate(props.tournamentId, props.categoryId);
});

// Export handler
async function handleExport(format: ExportFormat) {
  await exportData(format, `leaderboard-${props.tournamentId}`);
}
</script>
```

---

## 11. Testing Strategy

### 11.1 Unit Tests

**Test File:** `tests/unit/leaderboard.test.ts`

**Test Cases:**

#### Statistics Calculation
- [ ] Correct match points calculation (2 for win, 1 for loss)
- [ ] Accurate game won/lost counting
- [ ] Proper point for/against summation
- [ ] Win rate calculation precision
- [ ] Average points per game calculation

#### Tiebreaker Logic
- [ ] Two-way tie resolved by head-to-head
- [ ] Three-way tie resolved by game difference
- [ ] Three-way tie with equal game diff → point difference
- [ ] Subset tie resolution after partial resolution
- [ ] Equal standing when all tiebreakers exhausted
- [ ] Head-to-head match not found handling

#### Edge Cases
- [ ] Player with 0 matches
- [ ] Single participant
- [ ] All participants tied on all metrics
- [ ] Walkover matches (count as regular wins)
- [ ] Retired/disqualified players
- [ ] Very large tournament (100+ participants)

### 11.2 Integration Tests

**Test File:** `tests/integration/leaderboard.integration.test.ts`

**Test Scenarios:**

#### Data Fetching
- [ ] Correct Firestore queries generated
- [ ] Proper handling of missing collections
- [ ] Date range filtering
- [ ] Category filtering
- [ ] Multi-category aggregation

#### Export Functionality
- [ ] CSV format correctness
- [ ] PDF generation
- [ ] JSON structure validation
- [ ] Special characters in names handled
- [ ] Large dataset export performance

### 11.3 E2E Tests

**Test File:** `tests/e2e/leaderboard.spec.ts`

**User Flows:**

1. **Generate Leaderboard**
   - Navigate to leaderboard view
   - Click generate button
   - Verify data loads
   - Check sorting is correct

2. **Apply Filters**
   - Select category filter
   - Enter search term
   - Verify filtered results
   - Reset filters

3. **Export Data**
   - Click export CSV
   - Verify download
   - Validate file contents

4. **Mobile Experience**
   - Test on mobile viewport
   - Verify horizontal scrolling
   - Check filter modal

### 11.4 Test Data Scenarios

```typescript
// Scenario 1: Clear winner (no ties)
const scenarioClearWinner = {
  participants: ['Alice', 'Bob', 'Charlie'],
  matches: [
    { p1: 'Alice', p2: 'Bob', winner: 'Alice', scores: [[21, 15], [21, 18]] },
    { p1: 'Alice', p2: 'Charlie', winner: 'Alice', scores: [[21, 10], [21, 12]] },
    { p1: 'Bob', p2: 'Charlie', winner: 'Bob', scores: [[21, 19], [18, 21], [21, 15]] }
  ],
  expectedOrder: ['Alice', 'Bob', 'Charlie']
};

// Scenario 2: Two-way tie (head-to-head)
const scenarioTwoWayTie = {
  participants: ['Player1', 'Player2'],
  matches: [
    { p1: 'Player1', p2: 'Player2', winner: 'Player1', scores: [[21, 18]] }
  ],
  expectedOrder: ['Player1', 'Player2'],
  tiebreaker: 'head_to_head'
};

// Scenario 3: Three-way tie (game difference)
const scenarioThreeWayTie = {
  participants: ['A', 'B', 'C'],
  matches: [
    // All have 2 wins, 1 loss
    // Game differences: A=+2, B=+1, C=0
  ],
  expectedOrder: ['A', 'B', 'C'],
  tiebreaker: 'game_difference'
};
```

---

## 12. Implementation Phases

### Phase 1: Foundation (Days 1-3)
**Deliverables:**
- [ ] `src/types/leaderboard.ts` - Type definitions
- [ ] `src/composables/useLeaderboard.ts` - Core logic
- [ ] Unit tests for statistics calculation
- [ ] Unit tests for tiebreaker logic

**Success Criteria:**
- All unit tests passing
- Types compile without errors
- Composable generates correct data

### Phase 2: UI Components (Days 4-6)
**Deliverables:**
- [ ] `LeaderboardTable.vue` - Data table
- [ ] `LeaderboardFilters.vue` - Filter controls
- [ ] `LeaderboardSummary.vue` - Stats cards
- [ ] `TournamentLeaderboard.vue` - Container
- [ ] Basic styling and layout

**Success Criteria:**
- Components render correctly
- Props/Events working
- Responsive design functional

### Phase 3: Features & Polish (Days 7-8)
**Deliverables:**
- [ ] Export functionality (CSV/PDF/JSON)
- [ ] Tiebreaker explanation tooltips
- [ ] Loading states and error handling
- [ ] Empty states
- [ ] Integration tests

**Success Criteria:**
- Export works correctly
- All edge cases handled
- Integration tests passing

### Phase 4: Integration & Testing (Days 9-10)
**Deliverables:**
- [ ] `LeaderboardView.vue` - Full page
- [ ] Router configuration
- [ ] E2E tests
- [ ] Documentation updates
- [ ] Performance optimization

**Success Criteria:**
- E2E tests passing
- No console errors
- Performance < 2s for 100 participants

### Total Effort Estimate
- **Development:** 10 days
- **Testing:** 2 days (parallel)
- **Review & Polish:** 2 days
- **Total:** ~14 days

---

## 13. Open Questions

Before implementation begins, the following questions need clarification:

### 13.1 Multi-Category Participation

**Question:** If a player is registered in 3 categories (e.g., Men's Singles, Men's Doubles, Mixed Doubles), how should they appear in the tournament-wide leaderboard?

**Options:**
1. **Separate Entries** - Player appears 3 times, once per category
2. **Aggregated Entry** - Single row showing combined stats across all categories
3. **Both Views** - Toggle between aggregated and separated views

**Recommendation:** Option 1 (Separate Entries) - Simplest to implement, clearest for users

### 13.2 Elimination Format Handling

**Question:** For single/double elimination tournaments, what additional information should be displayed?

**Options:**
1. **Current Round Only** - Show which round player is in
2. **Elimination Status** - Show "Eliminated in Round X" or "Still Active"
3. **Final Placement** - Show final ranking (1st, 2nd, 3rd, 4th, etc.)
4. **Bracket Visualization** - Show position in bracket tree

**Recommendation:** Options 1, 2, and 3 - All are valuable and relatively simple

### 13.3 Walkover Handling

**Question:** How should walkover wins/losses be counted in statistics?

**Options:**
1. **Count as Regular Match** - Same as completed match
2. **Count with Indicator** - Mark as walkover in UI, same stats
3. **Separate Column** - Track walkovers separately
4. **Exclude from Stats** - Don't count toward win rate

**Recommendation:** Option 1 - BWF standard, simplest implementation

### 13.4 CSV Export Frequency

**Question:** Should leaderboard exports be cached or generated on-demand?

**Options:**
1. **On-Demand** - Generate fresh each time (current plan)
2. **Cached** - Cache for 5 minutes to reduce load
3. **Background Generation** - Pre-generate for common filters

**Recommendation:** Option 1 - Start simple, add caching if performance issues arise

### 13.5 Real-Time Updates

**Question:** Should the leaderboard update in real-time as matches complete?

**Options:**
1. **On-Demand Only** - User clicks refresh (current plan)
2. **Polling** - Auto-refresh every 30 seconds
3. **Firestore Listeners** - Real-time updates via onSnapshot
4. **Hybrid** - Real-time for active tournament, on-demand for completed

**Recommendation:** Option 1 for MVP, Option 3 for v2

---

## 14. References

### 14.1 Internal Documentation

| Document | Location | Relevance |
|----------|----------|-----------|
| AGENTS.md | `/AGENTS.md` | Project conventions, data model rules |
| DATA_MODEL_MIGRATION_RULES.md | `/docs/migration/DATA_MODEL_MIGRATION_RULES.md` | Collection usage, ID patterns |
| RoundRobinStandings.vue | `/src/features/brackets/components/RoundRobinStandings.vue` | Reference implementation |
| bracketMatchAdapter.ts | `/src/stores/bracketMatchAdapter.ts` | ID resolution pattern |
| matches.ts | `/src/stores/matches.ts` | Match data operations |
| registrations.ts | `/src/stores/registrations.ts` | Registration data operations |

### 14.2 External References

| Resource | URL | Description |
|----------|-----|-------------|
| BWF Statutes | [BWF Laws](https://extranet.bwf.sport/docs/document-system/81/1466/1471/Section%205.3.3.1%20_%20World%20Ranking%20System.pdf) | Official BWF regulations |
| BWF Tie-Breaking | [BadmintonNL](https://www.badmintonnl.ca/resources/tie-breaking-procedure/) | Practical tiebreaker guide |
| BWF World Ranking | [Olympics.com](https://www.olympics.com/en/news/badminton-rankings-bwf-world-tour-team-olympics-men-women) | Ranking system overview |

### 14.3 Code References

#### Existing RoundRobinStandings Pattern
```typescript
// From RoundRobinStandings.vue (lines 26-111)
const standings = computed(() => {
  const standingsMap = new Map<string, StandingEntry>();
  
  // Initialize
  for (const reg of categoryRegs) {
    standingsMap.set(reg.id, createInitialEntry(reg));
  }
  
  // Process matches
  for (const match of completedMatches) {
    updateStats(standingsMap, match);
  }
  
  // Sort: Match Points > Wins > Point Diff > Points For
  return Array.from(standingsMap.values()).sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    if (b.won !== a.won) return b.won - a.won;
    if (b.pointsDiff !== a.pointsDiff) return b.pointsDiff - a.pointsDiff;
    return b.pointsFor - a.pointsFor;
  });
});
```

#### Match Score Schema (Verified)
```typescript
// From DATA_MODEL_MIGRATION_RULES.md (lines 82-97)
{
  status: "completed",
  scores: [
    { game: 1, player1: 21, player2: 15 },
    { game: 2, player1: 21, player2: 18 }
  ],
  winnerId: "registrationId123",
  completedAt: Timestamp
}
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-02-13 | Sisyphus | Initial plan creation |

---

**END OF DOCUMENT**
