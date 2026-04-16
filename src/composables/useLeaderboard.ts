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
import type {
  Registration,
  Player,
  Category,
  Match,
  RankingProgressionMode,
} from '@/types';
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
  LeaderboardParticipantDoc,
  LeaderboardMatchDoc,
  LeaderboardMatchScoreDoc,
} from '@/types/leaderboard';
import { exportLeaderboard } from '@/services/leaderboardExport';
import { useMatchStore } from '@/stores/matches';
import { useRegistrationStore } from '@/stores/registrations';
import { useTournamentStore } from '@/stores/tournaments';
import { getGamesNeeded, resolveScoringConfig } from '@/features/scoring/utils/validation';
import {
  DEFAULT_RANKING_PROGRESSION,
  RANKING_PRESETS,
  resolveRankingPreset,
} from '@/features/leaderboard/rankingPresets';
import type { RankingPresetDefinition } from '@/features/leaderboard/rankingPresets';
import { resolveEffectiveRankingConfig } from '@/features/leaderboard/effectiveRankingConfig';
import { logger } from '@/utils/logger';

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
    logger.debug(`[matchesToResolvedMatches] Processed ${matches.length} matches: ${resolved.length} completed, ${droppedCount} dropped (incomplete/not ready)`);
  }

  return resolved;
}

export function selectMatchesForPhaseScope(
  matches: Match[],
  categories: Category[],
  phaseScope: LeaderboardPhaseScope,
  categoryId?: string,
  progressionMode: RankingProgressionMode = 'carry_forward'
): Match[] {
  if (phaseScope === 'tournament') return matches;
  if (!categoryId) return matches;

  const categoryMatches = matches.filter((match) => match.categoryId === categoryId);
  if (phaseScope === 'category') {
    if (progressionMode === 'phase_reset') {
      const category = categories.find((item) => item.id === categoryId);
      if (category?.format === 'pool_to_elimination') {
        if (category.eliminationStageId !== null && category.eliminationStageId !== undefined) {
          const eliminationStageMatches = categoryMatches.filter(
            (match) => match.stageId && String(match.stageId) === String(category.eliminationStageId)
          );

          if (eliminationStageMatches.length > 0) {
            return eliminationStageMatches;
          }
        }

        const leveledMatches = categoryMatches.filter((match) => Boolean(match.levelId));
        if (leveledMatches.length > 0) {
          return leveledMatches;
        }
      }
    }

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
  participants: LeaderboardParticipantDoc[],
  matchDocs: LeaderboardMatchDoc[],
  matchScoreDocs: LeaderboardMatchScoreDoc[]
): ResolvedMatch[] {
  // Build lookup: bracketsManager participantId (string) → registrationId
  // CRITICAL: participant.name IS the Firestore registration ID (not participant.id)
  const participantMap = new Map<string, string>(
    participants.map((p) => [String(p.id), p.name])
  );

  // Build lookup: matchId → matchScore doc
  const scoreMap = new Map<string, LeaderboardMatchScoreDoc>(
    matchScoreDocs.map((s) => [s.id, s])
  );

  const resolved: ResolvedMatch[] = [];

  for (const match of matchDocs) {
    const score = scoreMap.get(match.id);

    if (!score || !score.winnerId) continue;
    if (score.status !== 'completed' && score.status !== 'walkover') continue;

    // Prefer registrationId enhancement field; fall back to participant map
    const p1Id: string | undefined =
      match.opponent1?.registrationId ??
      participantMap.get(String(match.opponent1?.id));
    const p2Id: string | undefined =
      match.opponent2?.registrationId ??
      participantMap.get(String(match.opponent2?.id));

    if (!p1Id || !p2Id) {
      logger.warn(
        `[leaderboard] Cannot resolve participants for match ${match.id} in category ${categoryId}`
      );
      continue;
    }

    const completedAt = score.completedAt instanceof Date
      ? score.completedAt
      : score.completedAt?.toDate?.();

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
      completedAt,
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
      logger.warn(
        `[leaderboard] No registration entry for participants in match ${match.id}`
      );
      continue;
    }

    p1.matchesPlayed++;
    p2.matchesPlayed++;

    const matchCategory = categoryMap.get(match.categoryId);
    const scoringConfig = resolveScoringConfig(undefined, matchCategory);
    const gamesNeeded = getGamesNeeded(scoringConfig);
    let p1GamesWonInMatch = 0;
    let p2GamesWonInMatch = 0;

    // score1 = participant1's points per game, score2 = participant2's points
    for (const game of match.scores) {
      const matchDecided = p1GamesWonInMatch >= gamesNeeded || p2GamesWonInMatch >= gamesNeeded;
      if (matchDecided) {
        logger.warn(
          `[leaderboard] Ignoring post-clinch game ${game.gameNumber} in match ${match.id}`
        );
        continue;
      }

      p1.pointsFor += game.score1;
      p1.pointsAgainst += game.score2;
      p2.pointsFor += game.score2;
      p2.pointsAgainst += game.score1;

      if (game.isComplete) {
        // game.winnerId is already a registration ID — no inference needed
        if (game.winnerId === match.participant1Id) {
          p1.gamesWon++;
          p2.gamesLost++;
          p1GamesWonInMatch++;
        } else {
          p2.gamesWon++;
          p1.gamesLost++;
          p2GamesWonInMatch++;
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
  // teamName always takes priority (matches app behaviour in useParticipantResolver)
  if (reg.teamName) return reg.teamName;

  const formatPlayerName = (playerId?: string): string | null => {
    if (!playerId) return null;
    const player = players.find((p) => p.id === playerId);
    if (!player) return null;
    return `${player.firstName} ${player.lastName}`.trim();
  };

  // Doubles/mixed: show both player names when no teamName set
  if (reg.partnerPlayerId) {
    const playerOne = formatPlayerName(reg.playerId);
    const playerTwo = formatPlayerName(reg.partnerPlayerId);
    if (playerOne && playerTwo) {
      return `${playerOne} / ${playerTwo}`;
    }
  }

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
      label: normalizeByMatchesPlayed ? 'SD / match' : 'Set Difference',
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
  participants: LeaderboardParticipantDoc[];
  matchDocs: LeaderboardMatchDoc[];
  matchScoreDocs: LeaderboardMatchScoreDoc[];
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
      ...(d.data() as Omit<LeaderboardParticipantDoc, 'id'>),
    })),
    matchDocs: matchSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<LeaderboardMatchDoc, 'id'>),
    })),
    matchScoreDocs: scoreSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<LeaderboardMatchScoreDoc, 'id'>),
    })),
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
      matchDocs,
      matchScoreDocs
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
  const progressionMode = options?.progressionMode ?? DEFAULT_RANKING_PROGRESSION;

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
      categoryId,
      progressionMode
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
    rankingPreset: rankingPreset.id,
    progressionMode,
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
      // 1. Ensure categories are loaded first — needed for the per-category match fetch loop below
      if (tournamentStore.categories.length === 0 || !tournamentStore.currentTournament) {
        await tournamentStore.fetchTournament(tournamentId);
      }

      // 2. Load registrations + players in parallel (no match-store race condition here)
      await Promise.all([
        registrationStore.fetchRegistrations(tournamentId),
        registrationStore.fetchPlayers(tournamentId),
      ]);

      // 3. Fetch matches using the same per-category path as SmartBracketView.
      //    A tournament-wide single fetch (fetchMatches with no categoryId) does a full
      //    matches.value replace and can lose participant ID resolution for
      //    pool_to_elimination categories (participant sub-collection lookup fails → all
      //    participant IDs come back undefined → matchesToResolvedMatches drops every match).
      //    Per-category fetches safely merge into the store via the otherMatches merge path.
      if (categoryId) {
        await matchStore.fetchMatches(tournamentId, categoryId);
      } else {
        for (const category of tournamentStore.categories) {
          await matchStore.fetchMatches(tournamentId, category.id);
        }
      }

      const selectedCategory = categoryId
        ? tournamentStore.categories.find((category) => category.id === categoryId)
        : undefined;
      const effectiveRankingConfig = resolveEffectiveRankingConfig(
        tournamentStore.currentTournament?.settings ?? {},
        selectedCategory ?? {}
      );

      const mergedOptions: LeaderboardOptions = {
        ...opts,
        rankingPreset: opts?.rankingPreset ?? effectiveRankingConfig.preset,
        progressionMode: opts?.progressionMode ?? effectiveRankingConfig.progressionMode,
      };

      stage.value = 'calculating';

      const result = await generateLeaderboard(
        tournamentId,
        categoryId,
        mergedOptions,
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
