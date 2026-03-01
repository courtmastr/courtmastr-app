/**
 * useLeaderboard
 *
 * Generates tournament leaderboards from Firestore data.
 *
 * Architecture:
 *  - Pure functions (aggregation, tiebreaking) are exported for unit testing.
 *  - Firestore-dependent functions (fetch*) stay internal to this module.
 *  - useLeaderboard() is the Vue composable for component consumption.
 *
 * Data join strategy:
 *  match_scores has winnerId + game scores but NOT participant IDs.
 *  /match has opponent1/opponent2 IDs (brackets-manager sequential IDs).
 *  /participant has name = registrationId (the actual Firestore reg ID).
 *  These three are joined to build ResolvedMatch objects.
 */

import { ref, computed } from 'vue';
import {
  db,
  collection,
  getDocs,
  query,
  where,
} from '@/services/firebase';
import type { Registration, Player, Category, Match } from '@/types';
import type {
  Leaderboard,
  LeaderboardEntry,
  LeaderboardOptions,
  LeaderboardPhaseScope,
  LeaderboardStage,
  CategorySummary,
  TiebreakerResolution,
  TieBreakerStep,
  ExportFormat,
  ResolvedMatch,
  TiebreakerEntryValues,
  TiebreakerMetric,
} from '@/types/leaderboard';
import { exportLeaderboard } from '@/services/leaderboardExport';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import {
  RANKING_PRESETS,
  resolveRankingPreset,
} from '@/features/leaderboard/rankingPresets';
import type { RankingPresetDefinition } from '@/features/leaderboard/rankingPresets';

// ============================================
// Pure Functions (exported for unit testing)
// ============================================

/**
 * Convert Match[] (from the match store) → ResolvedMatch[].
 * The store's adapter pipeline already resolves participant IDs,
 * so this is a thin mapping layer.
 */
export function matchesToResolvedMatches(matches: Match[]): ResolvedMatch[] {
  let droppedCount = 0;
  const resolved = matches
    .filter((m) => {
      const isCompleted = ['completed', 'walkover'].includes(m.status);
      const hasWinner = !!m.winnerId;
      const hasP1 = !!m.participant1Id;
      const hasP2 = !!m.participant2Id;

      if (!isCompleted || !hasWinner || !hasP1 || !hasP2) {
        droppedCount++;
        return false;
      }
      return true;
    })
    .map((m) => ({
      id: m.id,
      categoryId: m.categoryId,
      stageId: m.stageId,
      participant1Id: m.participant1Id!,
      participant2Id: m.participant2Id!,
      winnerId: m.winnerId!,
      scores: m.scores,
      round: m.round,
      bracket: m.bracketPosition?.bracket,
      completedAt: m.completedAt,
    }));

  if (droppedCount > 0) {
    console.log(`[matchesToResolvedMatches] Processed ${matches.length} matches: ${resolved.length} completed, ${droppedCount} dropped (incomplete/not ready)`);
  }

  return resolved;
}

export function selectMatchesForPhaseScope(
  matches: Match[],
  categories: Category[],
  phaseScope: LeaderboardPhaseScope,
  categoryId?: string
): Match[] {
  if (phaseScope === 'tournament') return matches;
  if (!categoryId) return matches;

  const categoryMatches = matches.filter((match) => match.categoryId === categoryId);
  if (phaseScope === 'category') {
    return categoryMatches;
  }

  const category = categories.find((item) => item.id === categoryId);
  if (!category) return [];

  if (category.poolStageId !== null && category.poolStageId !== undefined) {
    const poolStageMatches = categoryMatches.filter(
      (match) => match.stageId && String(match.stageId) === String(category.poolStageId)
    );

    if (poolStageMatches.length > 0) {
      return poolStageMatches;
    }
  }

  // Legacy fallback: pool matches are category-scoped (no levelId)
  return categoryMatches.filter((match) => !match.levelId);
}

/**
 * Join /match docs + /match_scores docs into ResolvedMatch objects.
 * Resolves participant IDs via the /participant collection.
 */
export function resolveMatches(
  categoryId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  participants: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matchDocs: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matchScoreDocs: any[]
): ResolvedMatch[] {
  // Build lookup: bracketsManager participantId (string) → registrationId
  // CRITICAL: participant.name IS the Firestore registration ID (not participant.id)
  const participantMap = new Map<string, string>(
    participants.map((p) => [String(p.id), p.name as string])
  );

  // Build lookup: matchId → matchScore doc
  const scoreMap = new Map<string, typeof matchScoreDocs[0]>(
    matchScoreDocs.map((s) => [s.id, s])
  );

  const resolved: ResolvedMatch[] = [];

  for (const match of matchDocs) {
    const score = scoreMap.get(match.id);

    if (!score || !score.winnerId) continue;
    if (!['completed', 'walkover'].includes(score.status)) continue;

    // Prefer registrationId enhancement field; fall back to participant map
    const p1Id: string | undefined =
      match.opponent1?.registrationId ??
      participantMap.get(String(match.opponent1?.id));
    const p2Id: string | undefined =
      match.opponent2?.registrationId ??
      participantMap.get(String(match.opponent2?.id));

    if (!p1Id || !p2Id) {
      console.warn(
        `[leaderboard] Cannot resolve participants for match ${match.id} in category ${categoryId}`
      );
      continue;
    }

    resolved.push({
      id: match.id,
      categoryId,
      stageId: match.stage_id != null ? String(match.stage_id) : undefined,
      participant1Id: p1Id,
      participant2Id: p2Id,
      winnerId: score.winnerId,
      scores: score.scores ?? [],
      round: match.round ?? 0,
      bracket: match.bracket,
      completedAt: score.completedAt?.toDate?.() ?? undefined,
    });
  }

  return resolved;
}

/**
 * Aggregate stats for all registrations from a list of resolved matches.
 * Returns a Map of registrationId → LeaderboardEntry (with rank = 0, derived fields computed).
 */
export function aggregateStats(
  registrations: Registration[],
  matches: ResolvedMatch[],
  categoryMap: Map<string, Category>,
  players: Player[],
  pointsModel: RankingPresetDefinition['points'] = RANKING_PRESETS.courtmaster_default.points
): Map<string, LeaderboardEntry> {
  const statsMap = new Map<string, LeaderboardEntry>();

  // Initialize one entry per approved/checked_in registration
  for (const reg of registrations) {
    const category = categoryMap.get(reg.categoryId);
    statsMap.set(reg.id, {
      rank: 0,
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
    });
  }

  for (const match of matches) {
    const p1 = statsMap.get(match.participant1Id);
    const p2 = statsMap.get(match.participant2Id);

    if (!p1 || !p2) {
      console.warn(
        `[leaderboard] No registration entry for participants in match ${match.id}`
      );
      continue;
    }

    p1.matchesPlayed++;
    p2.matchesPlayed++;

    // score1 = participant1's points per game, score2 = participant2's points
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

    // Match win/loss — points model is preset-driven.
    if (match.winnerId === match.participant1Id) {
      p1.matchesWon++;
      p1.matchPoints += pointsModel.win;
      p2.matchesLost++;
      p2.matchPoints += pointsModel.loss;
    } else {
      p2.matchesWon++;
      p2.matchPoints += pointsModel.win;
      p1.matchesLost++;
      p1.matchPoints += pointsModel.loss;
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

  // Compute derived fields
  for (const entry of statsMap.values()) {
    entry.gameDifference = entry.gamesWon - entry.gamesLost;
    entry.pointDifference = entry.pointsFor - entry.pointsAgainst;
    entry.winRate =
      entry.matchesPlayed > 0
        ? Math.round((entry.matchesWon / entry.matchesPlayed) * 10000) / 100
        : 0;
  }

  return statsMap;
}

/** Resolve a participant's display name from their registration + player records. */
export function resolveParticipantName(
  reg: Registration,
  players: Player[]
): string {
  const formatPlayerName = (playerId?: string): string | null => {
    if (!playerId) return null;
    const player = players.find((p) => p.id === playerId);
    if (!player) return null;
    return `${player.firstName} ${player.lastName}`.trim();
  };

  // For doubles/mixed registrations, prefer full player names when both are available.
  if (reg.partnerPlayerId) {
    const playerOne = formatPlayerName(reg.playerId);
    const playerTwo = formatPlayerName(reg.partnerPlayerId);
    if (playerOne && playerTwo) {
      return `${playerOne} / ${playerTwo}`;
    }
  }

  if (reg.teamName) return reg.teamName;

  const playerName = formatPlayerName(reg.playerId);
  if (playerName) return playerName;

  return 'Unknown';
}

/**
 * Mark entries as eliminated based on match history and category format.
 * Mutates entries in statsMap.
 *
 * - round_robin: no eliminations
 * - single_elimination: first loss = eliminated
 * - double_elimination: loss in losers bracket or finals = eliminated
 * - pool_to_elimination: treated as single_elimination
 */
export function applyEliminationStatus(
  statsMap: Map<string, LeaderboardEntry>,
  matches: ResolvedMatch[],
  categoryFormat: string
): void {
  if (categoryFormat === 'round_robin') return;

  const lossByRound = new Map<string, number>(); // registrationId → round eliminated

  for (const match of matches) {
    const loserId =
      match.winnerId === match.participant1Id
        ? match.participant2Id
        : match.participant1Id;

    if (categoryFormat === 'double_elimination') {
      // Only eliminated after losing in losers bracket or grand finals
      if (match.bracket === 'losers' || match.bracket === 'finals') {
        if (!lossByRound.has(loserId)) {
          lossByRound.set(loserId, match.round);
        }
      }
    } else {
      // single_elimination and pool_to_elimination: any loss = eliminated
      if (!lossByRound.has(loserId)) {
        lossByRound.set(loserId, match.round);
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

/**
 * Sort entries using full BWF Article 16.2 tiebreaker hierarchy.
 * Assigns entry.rank after sorting.
 */
export function sortWithBWFTiebreaker(
  entries: LeaderboardEntry[],
  matches: ResolvedMatch[],
  preset: RankingPresetDefinition = RANKING_PRESETS.courtmaster_default
): { sorted: LeaderboardEntry[]; resolutions: TiebreakerResolution[] } {
  const resolutions: TiebreakerResolution[] = [];
  const sorted: LeaderboardEntry[] = [];
  let currentRank = 1;

  const groups = groupByDescending(entries, (e) => e.matchPoints);

  for (const group of groups) {
    if (group.length === 1) {
      group[0].rank = currentRank;
      sorted.push(group[0]);
      currentRank++;
    } else {
      const { resolved, resolution } = resolveTieGroup(group, matches, currentRank, preset);
      // Equal standing (BWF Art. 16.2.4.2): all entries share the same rank.
      // Also skip recording the resolution when no one has played a match yet
      // (pre-bracket state produces spurious "equal standing" for all players).
      const isEqualStanding = resolution?.step === 'equal';
      const anyMatchesPlayed = group.some((e) => e.matchesPlayed > 0);
      let r = currentRank;
      for (const entry of resolved) {
        // Equal standing (BWF Art. 16.2.4.2): all entries share the same rank.
        entry.rank = isEqualStanding ? currentRank : r++;
      }
      sorted.push(...resolved);
      // Suppress equal-standing resolutions when no one has played yet —
      // the pre-match "everyone is equal" state is not a meaningful tiebreaker event.
      const shouldRecord = resolution && !(isEqualStanding && !anyMatchesPlayed);
      if (shouldRecord) resolutions.push(resolution!);
      currentRank += resolved.length;
    }
  }

  return { sorted, resolutions };
}

/**
 * Resolve a group of entries that all have the same match points.
 * Applies BWF Article 16.2 tiebreaker hierarchy.
 */
export function resolveTieGroup(
  tiedEntries: LeaderboardEntry[],
  allMatches: ResolvedMatch[],
  startRank: number,
  preset: RankingPresetDefinition = RANKING_PRESETS.courtmaster_default
): { resolved: LeaderboardEntry[]; resolution?: TiebreakerResolution } {
  for (const step of preset.tieBreakOrder) {
    if (step === 'head_to_head') {
      if (tiedEntries.length !== 2) continue;

      const [a, b] = tiedEntries;
      const h2h = findHeadToHeadMatch(a.registrationId, b.registrationId, allMatches);
      if (!h2h) continue;

      const winner = h2h.winnerId === a.registrationId ? a : b;
      const loser = winner === a ? b : a;
      return {
        resolved: [winner, loser],
        resolution: {
          tiedRank: startRank,
          registrationIds: tiedEntries.map((entry) => entry.registrationId),
          step: 'head_to_head',
          description: 'Resolved by head-to-head match result',
          resolvedOrder: [winner.registrationId, loser.registrationId],
          headToHeadMatchId: h2h.id,
          resolvedValues: buildResolvedValues(
            winner,
            loser,
            'head_to_head',
            preset.normalizeByMatchesPlayed
          ),
        },
      };
    }

    if (step === 'game_difference') {
      const gameDiffGroups = groupByDescending(
        tiedEntries,
        (entry) =>
          preset.normalizeByMatchesPlayed && entry.matchesPlayed > 0
            ? Math.round((entry.gameDifference / entry.matchesPlayed) * 10) / 10
            : entry.gameDifference
      );

      if (gameDiffGroups.length > 1) {
        return resolvePartialTies(
          gameDiffGroups,
          allMatches,
          startRank,
          'game_difference',
          preset
        );
      }
      continue;
    }

    if (step === 'point_difference') {
      const pointDiffGroups = groupByDescending(
        tiedEntries,
        (entry) =>
          preset.normalizeByMatchesPlayed && entry.matchesPlayed > 0
            ? Math.round((entry.pointDifference / entry.matchesPlayed) * 10) / 10
            : entry.pointDifference
      );

      if (pointDiffGroups.length > 1) {
        return resolvePartialTies(
          pointDiffGroups,
          allMatches,
          startRank,
          'point_difference',
          preset
        );
      }
      continue;
    }

    if (step === 'equal') {
      break;
    }
  }

  const ids = tiedEntries.map((entry) => entry.registrationId);
  const alphabeticallySorted = [...tiedEntries].sort((a, b) =>
    a.participantName.localeCompare(b.participantName)
  );

  return {
    resolved: alphabeticallySorted,
    resolution: {
      tiedRank: startRank,
      registrationIds: ids,
      step: 'equal',
      description: `${tiedEntries.length}-way equal standing — all tiebreakers exhausted. Order shown is alphabetical.`,
      resolvedOrder: alphabeticallySorted.map((entry) => entry.registrationId),
    },
  };
}

/**
 * Handle partial tie resolution.
 *
 * After a tiebreaker (e.g. game difference) splits entries into sub-groups,
 * single-member groups are ranked directly while multi-member groups recurse
 * back through the full BWF procedure (implementing Art. 16.2.3.1 and 16.2.4.1).
 *
 * @param groups  Sub-arrays of entries, already sorted descending by the resolving metric.
 */
export function resolvePartialTies(
  groups: LeaderboardEntry[][],
  allMatches: ResolvedMatch[],
  startRank: number,
  resolvedBy: TieBreakerStep,
  preset: RankingPresetDefinition = RANKING_PRESETS.courtmaster_default
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
      const { resolved: subResolved, resolution: subResolution } = resolveTieGroup(
        group,
        allMatches,
        rank,
        preset
      );
      allResolved.push(...subResolved);
      if (subResolution) allResolutions.push(subResolution);
      rank += subResolved.length;
    }
  }

  // Always emit a resolution describing which metric resolved (or partially resolved) the tie.
  // If sub-groups needed further recursion, annotate with the outermost resolvedBy step.
  const allIds = groups.flat().map((e) => e.registrationId);
  const resolvedOrder = allResolved.map((e) => e.registrationId);
  const baseResolution: TiebreakerResolution = {
    tiedRank: startRank,
    registrationIds: allIds,
    step: resolvedBy,
    description: allResolutions.length
      ? `Partially resolved by ${resolvedBy}; sub-groups further processed`
      : `Resolved by ${resolvedBy}`,
    resolvedOrder,
    resolvedValues: allIds.length === 2
      ? buildResolvedValues(
        groups.flat()[0],
        groups.flat()[1],
        resolvedBy,
        preset.normalizeByMatchesPlayed
      )
      : undefined,
  };

  return { resolved: allResolved, resolution: baseResolution };
}

/** Find the direct head-to-head match between two participants (either order). */
export function findHeadToHeadMatch(
  p1Id: string,
  p2Id: string,
  matches: ResolvedMatch[]
): ResolvedMatch | undefined {
  return matches.find(
    (m) =>
      (m.participant1Id === p1Id && m.participant2Id === p2Id) ||
      (m.participant1Id === p2Id && m.participant2Id === p1Id)
  );
}

/**
 * Group an array into sub-arrays by a numeric key, sorted descending.
 * Entries with the same key value are grouped together.
 *
 * @example groupByDescending([a(5), b(3), c(5)], e => e.pts) → [[a,c], [b]]
 */
export function groupByDescending<T>(arr: T[], keyFn: (item: T) => number): T[][] {
  const keys = [...new Set(arr.map(keyFn))].sort((a, b) => b - a);
  return keys.map((k) => arr.filter((item) => keyFn(item) === k));
}

/**
 * Build per-category summary cards/metadata for tournament-wide leaderboard pages.
 */
export function buildCategorySummaries(
  categoryIds: string[],
  categoryMap: Map<string, Category>,
  entries: LeaderboardEntry[],
  matches: ResolvedMatch[]
): CategorySummary[] {
  return categoryIds.map((catId) => {
    const category = categoryMap.get(catId);
    const categoryEntries = entries.filter((entry) => entry.categoryId === catId);
    const categoryMatches = matches.filter((match) => match.categoryId === catId);

    // Clone entries so local re-ranking does not mutate the main leaderboard rows.
    const clonedEntries = categoryEntries.map((entry) => ({ ...entry }));
    const { sorted } = sortWithBWFTiebreaker(clonedEntries, categoryMatches);

    return {
      categoryId: catId,
      categoryName: category?.name ?? 'Unknown',
      format: category?.format ?? 'unknown',
      totalParticipants: categoryEntries.length,
      matchesCompleted: categoryMatches.length,
      matchesTotal: categoryMatches.length,
      topThree: sorted.slice(0, 3).map((entry) => ({
        rank: entry.rank,
        participantName: entry.participantName,
        matchesWon: entry.matchesWon,
        matchPoints: entry.matchPoints,
      })),
    };
  });
}

/**
 * Build the metric receipt for exactly 2 entries.
 * Called at the moment of separation — captures all metrics
 * up to and including the deciding one.
 */
export function buildResolvedValues(
  a: LeaderboardEntry,
  b: LeaderboardEntry,
  decidingStep: TieBreakerStep,
  normalizeByMatchesPlayed = true
): TiebreakerEntryValues[] {
  const gdPerMatch = (e: LeaderboardEntry) =>
    normalizeByMatchesPlayed && e.matchesPlayed > 0
      ? Math.round((e.gameDifference / e.matchesPlayed) * 10) / 10
      : e.gameDifference;
  const pdPerMatch = (e: LeaderboardEntry) =>
    normalizeByMatchesPlayed && e.matchesPlayed > 0
      ? Math.round((e.pointDifference / e.matchesPlayed) * 10) / 10
      : e.pointDifference;

  const gdA = gdPerMatch(a);
  const gdB = gdPerMatch(b);
  const pdA = pdPerMatch(a);
  const pdB = pdPerMatch(b);

  const metricsFor = (e: LeaderboardEntry, gd: number, pd: number): TiebreakerMetric[] => [
    {
      label: 'Match Points',
      value: e.matchPoints,
      tied: a.matchPoints === b.matchPoints,
      decided: decidingStep === 'match_wins',
    },
    {
      label: normalizeByMatchesPlayed ? 'GD / match' : 'Game Difference',
      value: gd,
      tied: gdA === gdB,
      decided: decidingStep === 'game_difference',
    },
    {
      label: normalizeByMatchesPlayed ? 'PD / match' : 'Point Difference',
      value: pd,
      tied: pdA === pdB,
      decided: decidingStep === 'point_difference',
    },
  ];

  return [
    { registrationId: a.registrationId, participantName: a.participantName, metrics: metricsFor(a, gdA, pdA) },
    { registrationId: b.registrationId, participantName: b.participantName, metrics: metricsFor(b, gdB, pdB) },
  ];
}

// ============================================
// Firestore Fetch Functions (internal)
// ============================================

async function fetchCategories(tournamentId: string): Promise<Category[]> {
  const snap = await getDocs(
    collection(db, `tournaments/${tournamentId}/categories`)
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category));
}

async function fetchPlayers(tournamentId: string): Promise<Player[]> {
  const snap = await getDocs(
    collection(db, `tournaments/${tournamentId}/players`)
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Player));
}

async function fetchCategoryData(
  tournamentId: string,
  categoryId: string
): Promise<{
  registrations: Registration[];
  participants: { id: string; name: string }[];
  matchDocs: unknown[];
  matchScoreDocs: unknown[];
}> {
  const base = `tournaments/${tournamentId}/categories/${categoryId}`;

  const [registrationSnap, participantSnap, matchSnap, scoreSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, `tournaments/${tournamentId}/registrations`),
        where('categoryId', '==', categoryId),
        where('status', 'in', ['approved', 'checked_in'])
      )
    ),
    getDocs(collection(db, `${base}/participant`)),
    getDocs(collection(db, `${base}/match`)),
    getDocs(
      query(
        collection(db, `${base}/match_scores`),
        where('status', 'in', ['completed', 'walkover'])
      )
    ),
  ]);

  return {
    registrations: registrationSnap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as Registration)
    ),
    participants: participantSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as { id: string; name: string }[],
    matchDocs: matchSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    matchScoreDocs: scoreSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

async function fetchAllCategoryData(
  tournamentId: string,
  categoryIds: string[]
): Promise<{ allMatches: ResolvedMatch[]; allRegistrations: Registration[] }> {
  const results = await Promise.all(
    categoryIds.map((catId) => fetchCategoryData(tournamentId, catId))
  );

  const allMatches: ResolvedMatch[] = [];
  const allRegistrations: Registration[] = [];

  for (let i = 0; i < categoryIds.length; i++) {
    const { registrations, participants, matchDocs, matchScoreDocs } = results[i];
    const resolved = resolveMatches(
      categoryIds[i],
      participants,
      matchDocs as never[],
      matchScoreDocs as never[]
    );
    allMatches.push(...resolved);
    allRegistrations.push(...registrations);
  }

  return { allMatches, allRegistrations };
}

// ============================================
// Main Generation Function
// ============================================

/**
 * Preloaded data from Pinia stores — avoids duplicate Firestore reads
 * when the stores have already fetched the data.
 */
export interface PreloadedData {
  matches: Match[];
  registrations: Registration[];
  categories: Category[];
  players: Player[];
}

/**
 * Generate a complete leaderboard for a tournament or single category.
 *
 * @param tournamentId  Tournament Firestore ID
 * @param categoryId    If provided, generates a per-category leaderboard
 * @param options       Optional filters (includeEliminated, minimumMatches, categoryIds)
 * @param preloaded     When provided, uses store data instead of hitting Firestore directly
 */
export async function generateLeaderboard(
  tournamentId: string,
  categoryId?: string,
  options?: LeaderboardOptions,
  preloaded?: PreloadedData
): Promise<Leaderboard> {
  let allCategories: Category[];
  let players: Player[];
  let allMatches: ResolvedMatch[];
  let allRegistrations: Registration[];
  const phaseScope = options?.phaseScope ?? (categoryId ? 'category' : 'tournament');
  const rankingPreset = resolveRankingPreset(options?.rankingPreset);

  if (preloaded) {
    // Option B: use store data — proven adapter has already resolved participant IDs
    allCategories = preloaded.categories;
    players = preloaded.players;

    const targetCategoryIds = categoryId
      ? [categoryId]
      : (options?.categoryIds ?? allCategories.map((c) => c.id));

    // Filter matches to target categories and convert via bridge
    const categoryMatches = preloaded.matches.filter((m) =>
      targetCategoryIds.includes(m.categoryId)
    );
    const scopedMatches = selectMatchesForPhaseScope(
      categoryMatches,
      allCategories,
      phaseScope,
      categoryId
    );

    allMatches = matchesToResolvedMatches(scopedMatches);

    // Filter registrations to target categories
    allRegistrations = preloaded.registrations.filter(
      (r) =>
        targetCategoryIds.includes(r.categoryId) &&
        ['approved', 'checked_in'].includes(r.status)
    );
  } else {
    // Option A: direct Firestore queries (legacy path)
    allCategories = await fetchCategories(tournamentId);
    players = await fetchPlayers(tournamentId);

    const targetCategoryIds = categoryId
      ? [categoryId]
      : (options?.categoryIds ?? allCategories.map((c) => c.id));

    const fetched = await fetchAllCategoryData(tournamentId, targetCategoryIds);
    allMatches = fetched.allMatches;
    allRegistrations = fetched.allRegistrations;
  }

  const categoryMap = new Map(allCategories.map((c) => [c.id, c]));

  const targetCategoryIds = categoryId
    ? [categoryId]
    : (options?.categoryIds ?? allCategories.map((c) => c.id));

  const statsMap = aggregateStats(
    allRegistrations,
    allMatches,
    categoryMap,
    players,
    rankingPreset.points
  );

  // Apply elimination status per category format
  for (const catId of targetCategoryIds) {
    const category = categoryMap.get(catId);
    if (!category) continue;
    const catMatches = allMatches.filter((m) => m.categoryId === catId);
    applyEliminationStatus(statsMap, catMatches, category.format ?? 'single_elimination');
  }

  // Apply option filters
  const allEntries = [...statsMap.values()];
  let entries = allEntries;
  if (options?.includeEliminated === false) {
    entries = entries.filter((e) => !e.eliminated);
  }
  if (options?.minimumMatches) {
    entries = entries.filter((e) => e.matchesPlayed >= options.minimumMatches!);
  }

  const { sorted, resolutions } = sortWithBWFTiebreaker(entries, allMatches, rankingPreset);
  const categories = categoryId
    ? undefined
    : buildCategorySummaries(targetCategoryIds, categoryMap, allEntries, allMatches);

  return {
    scope: categoryId ? 'category' : 'tournament',
    phaseScope,
    tournamentId,
    categoryId,
    generatedAt: new Date(),
    entries: sorted,
    totalMatches: allMatches.length,
    completedMatches: allMatches.length,
    totalParticipants: sorted.length,
    activeParticipants: sorted.filter((e) => !e.eliminated).length,
    eliminatedParticipants: sorted.filter((e) => e.eliminated).length,
    categories,
    tiebreakerResolutions: resolutions,
  };
}

// ============================================
// Vue Composable
// ============================================

export function useLeaderboard() {
  const matchStore = useMatchStore();
  const registrationStore = useRegistrationStore();
  const tournamentStore = useTournamentStore();

  const leaderboard = ref<Leaderboard | null>(null);
  const stage = ref<LeaderboardStage>('idle');
  const error = ref<string | null>(null);
  const options = ref<LeaderboardOptions>({});

  const filteredEntries = computed(() => {
    if (!leaderboard.value) return [];
    let entries = leaderboard.value.entries;
    if (options.value.includeEliminated === false) {
      entries = entries.filter((e) => !e.eliminated);
    }
    if (options.value.minimumMatches) {
      entries = entries.filter(
        (e) => e.matchesPlayed >= options.value.minimumMatches!
      );
    }
    return entries;
  });

  const topThree = computed(() => leaderboard.value?.entries.slice(0, 3) ?? []);
  const currentLeader = computed(() => leaderboard.value?.entries[0] ?? null);
  const categories = computed(() => leaderboard.value?.categories ?? []);

  async function generate(
    tournamentId: string,
    categoryId?: string,
    opts?: LeaderboardOptions
  ): Promise<void> {
    stage.value = 'fetching';
    error.value = null;
    try {
      // Fetch data via stores (reuses the proven adapter pipeline)
      await Promise.all([
        matchStore.fetchMatches(tournamentId), // Correctly fetch from root match collection

        registrationStore.fetchRegistrations(tournamentId),
        registrationStore.fetchPlayers(tournamentId),
      ]);

      // Ensure categories are loaded (parent view usually loads them,
      // but fetch if empty to be safe)
      if (tournamentStore.categories.length === 0) {
        await tournamentStore.fetchTournament(tournamentId);
      }

      stage.value = 'calculating';

      const result = await generateLeaderboard(
        tournamentId,
        categoryId,
        opts,
        {
          matches: matchStore.matches,
          registrations: registrationStore.registrations,
          categories: tournamentStore.categories,
          players: registrationStore.players,
        }
      );

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

  function applyFilters(newOptions: LeaderboardOptions): void {
    options.value = newOptions;
  }

  async function exportData(format: ExportFormat, filename?: string): Promise<void> {
    if (!leaderboard.value) return;
    await exportLeaderboard(leaderboard.value, { format, filename });
  }

  function clear(): void {
    leaderboard.value = null;
    stage.value = 'idle';
    error.value = null;
    options.value = {};
  }

  return {
    leaderboard,
    stage,
    error,
    filteredEntries,
    topThree,
    currentLeader,
    categories,
    generate,
    refresh,
    applyFilters,
    exportData,
    clear,
  };
}
