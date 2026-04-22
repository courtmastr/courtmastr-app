// Cloud Function: aggregate player stats when a tournament completes
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

type CategoryType = string;

interface StatDelta {
  wins: number;
  losses: number;
  gamesPlayed: number;
}

// Per-player per-sport per-category deltas
type PlayerDeltas = Map<string, Map<string, Map<CategoryType, StatDelta>>>;

interface TournamentRegistrationRecord {
  id: string;
  playerId?: string | null;
  partnerPlayerId?: string | null;
  categoryId?: string | null;
}

interface RegistrationLookupEntry {
  playerIds: string[];
  categoryId: string;
}

interface MatchScoreGame {
  score1: number;
  score2: number;
  isComplete?: boolean;
}

export interface TournamentMatchScoreRecord {
  categoryId: string;
  participant1Id?: string | null;
  participant2Id?: string | null;
  winnerId?: string | null;
  scores?: MatchScoreGame[];
}

export interface MatchScoreCollectionTarget {
  categoryId: string;
  path: string;
  levelId?: string;
}

export function buildRegistrationLookup(
  registrations: TournamentRegistrationRecord[]
): Map<string, RegistrationLookupEntry> {
  const lookup = new Map<string, RegistrationLookupEntry>();

  for (const registration of registrations) {
    if (!registration.categoryId) {
      continue;
    }

    const playerIds = Array.from(
      new Set(
        [registration.playerId, registration.partnerPlayerId].filter(
          (playerId): playerId is string =>
            typeof playerId === 'string' && playerId.length > 0
        )
      )
    );

    if (playerIds.length === 0) {
      continue;
    }

    lookup.set(registration.id, {
      playerIds,
      categoryId: registration.categoryId,
    });
  }

  return lookup;
}

export function buildMatchScoreCollectionTargets(
  tournamentId: string,
  categoryIds: string[],
  levelIdsByCategory: Record<string, string[]>
): MatchScoreCollectionTarget[] {
  const targets: MatchScoreCollectionTarget[] = [];

  for (const categoryId of categoryIds) {
    targets.push({
      categoryId,
      path: `tournaments/${tournamentId}/categories/${categoryId}/match_scores`,
    });

    for (const levelId of levelIdsByCategory[categoryId] ?? []) {
      targets.push({
        categoryId,
        levelId,
        path: `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match_scores`,
      });
    }
  }

  return targets;
}

export function applyMatchScoreDeltas(
  deltas: PlayerDeltas,
  registrationLookup: Map<string, RegistrationLookupEntry>,
  categoryTypeMap: Map<string, CategoryType>,
  sport: string,
  matchScore: TournamentMatchScoreRecord
): void {
  const participant1Id = matchScore.participant1Id ?? undefined;
  const participant2Id = matchScore.participant2Id ?? undefined;
  const winnerId = matchScore.winnerId ?? undefined;

  if (!participant1Id || !participant2Id || !winnerId) {
    return;
  }

  const categoryType = categoryTypeMap.get(matchScore.categoryId);
  if (!categoryType) {
    return;
  }

  const participant1 = registrationLookup.get(participant1Id);
  const participant2 = registrationLookup.get(participant2Id);

  if (!participant1 || !participant2) {
    return;
  }

  const winnerRegistration = winnerId === participant1Id ? participant1 : participant2;
  const loserRegistration = winnerId === participant1Id ? participant2 : participant1;

  let winnerGames = 0;
  let loserGames = 0;
  const scores = Array.isArray(matchScore.scores) ? matchScore.scores : [];

  for (const game of scores) {
    if (!game.isComplete && game.score1 === 0 && game.score2 === 0) {
      continue;
    }

    const participant1WinsGame = game.score1 > game.score2;
    if (winnerId === participant1Id) {
      if (participant1WinsGame) {
        winnerGames += 1;
      } else {
        loserGames += 1;
      }
    } else if (participant1WinsGame) {
      loserGames += 1;
    } else {
      winnerGames += 1;
    }
  }

  const gamesPlayed = winnerGames + loserGames;

  applyPlayerIdsDelta(deltas, winnerRegistration.playerIds, sport, categoryType, {
    wins: 1,
    losses: 0,
    gamesPlayed,
  });
  applyPlayerIdsDelta(deltas, loserRegistration.playerIds, sport, categoryType, {
    wins: 0,
    losses: 1,
    gamesPlayed,
  });
}

function applyPlayerIdsDelta(
  deltas: PlayerDeltas,
  playerIds: string[],
  sport: string,
  catType: CategoryType,
  delta: StatDelta
): void {
  for (const playerId of new Set(playerIds)) {
    applyDelta(deltas, playerId, sport, catType, delta);
  }
}

async function fetchLevelIdsByCategory(
  firestore: admin.firestore.Firestore,
  tournamentId: string,
  categoryIds: string[]
): Promise<Record<string, string[]>> {
  const entries = await Promise.all(
    categoryIds.map(async (categoryId) => {
      const levelsSnap = await firestore
        .collection(`tournaments/${tournamentId}/categories/${categoryId}/levels`)
        .get();
      return [categoryId, levelsSnap.docs.map((doc) => doc.id)] as const;
    })
  );

  return Object.fromEntries(entries);
}

/**
 * Triggered when a tournament document is updated.
 * When status changes to "completed" and statsProcessed == false,
 * reads all match_scores for the tournament and increments /players stats.
 */
export const aggregatePlayerStats = onDocumentUpdated(
  'tournaments/{tournamentId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const { tournamentId } = event.params;

    if (!before || !after) return;

    // Only run when:
    // 1. Status just changed to "completed"
    // 2. statsProcessed is not already true
    // 3. sport field is present
    const statusChanged = before.status !== 'completed' && after.status === 'completed';
    const alreadyProcessed = after.statsProcessed === true;
    const sport: string | undefined = after.sport;

    if (!statusChanged || alreadyProcessed || !sport) return;

    const db = admin.firestore();
    const deltas: PlayerDeltas = new Map();

    try {
      // 1. Fetch all registrations for this tournament (registrationId -> playerIds lookup)
      const registrationsSnap = await db
        .collection(`tournaments/${tournamentId}/registrations`)
        .get();

      const registrationLookup = buildRegistrationLookup(
        registrationsSnap.docs.map((regDoc) => ({
          id: regDoc.id,
          playerId: regDoc.data().playerId as string | undefined,
          partnerPlayerId: regDoc.data().partnerPlayerId as string | undefined,
          categoryId: regDoc.data().categoryId as string | undefined,
        }))
      );

      // 2. Build a map of categoryId → categoryType (singles/doubles/mixed)
      const categoryTypeMap = new Map<string, CategoryType>();
      const categoriesSnap = await db
        .collection(`tournaments/${tournamentId}/categories`)
        .get();
      const categoryIds: string[] = [];
      for (const catDoc of categoriesSnap.docs) {
        categoryIds.push(catDoc.id);
        const catType = catDoc.data().type;
        if (typeof catType === 'string' && catType.length > 0) {
          categoryTypeMap.set(catDoc.id, catType);
        }
      }

      // 3. Read match_scores from category and level-scoped paths so tournament completion
      //    does not depend on a collection-group index to aggregate results.
      const levelIdsByCategory = await fetchLevelIdsByCategory(db, tournamentId, categoryIds);
      const targets = buildMatchScoreCollectionTargets(
        tournamentId,
        categoryIds,
        levelIdsByCategory
      );
      const matchScoreCollections = await Promise.all(
        targets.map(async (target) => ({
          target,
          snap: await db.collection(target.path).get(),
        }))
      );

      // 4. Compute per-player deltas, crediting every player attached to a registration.
      for (const { target, snap } of matchScoreCollections) {
        for (const matchScoreDoc of snap.docs) {
          const matchScoreData = matchScoreDoc.data();
          const status = matchScoreData.status;
          if (status !== 'completed' && status !== 'walkover') {
            continue;
          }

          applyMatchScoreDeltas(
            deltas,
            registrationLookup,
            categoryTypeMap,
            sport,
            {
              categoryId: target.categoryId,
              participant1Id: matchScoreData.participant1Id as string | undefined,
              participant2Id: matchScoreData.participant2Id as string | undefined,
              winnerId: matchScoreData.winnerId as string | undefined,
              scores: Array.isArray(matchScoreData.scores)
                ? (matchScoreData.scores as MatchScoreGame[])
                : [],
            }
          );
        }
      }

      // 5. Batch write stat increments to /players
      const batch = db.batch();
      for (const [playerId, sportMap] of deltas) {
        if (!playerId) continue;
        const playerRef = db.collection('players').doc(playerId);
        const updateData: Record<string, admin.firestore.FieldValue | number> = {};

        let totalWins = 0;
        let totalLosses = 0;
        let totalGames = 0;

        for (const [s, catMap] of sportMap) {
          for (const [cat, delta] of catMap) {
            updateData[`stats.${s}.${cat}.wins`] = admin.firestore.FieldValue.increment(delta.wins);
            updateData[`stats.${s}.${cat}.losses`] = admin.firestore.FieldValue.increment(delta.losses);
            updateData[`stats.${s}.${cat}.gamesPlayed`] = admin.firestore.FieldValue.increment(delta.gamesPlayed);
            updateData[`stats.${s}.${cat}.tournamentsPlayed`] = admin.firestore.FieldValue.increment(1);
            totalWins += delta.wins;
            totalLosses += delta.losses;
            totalGames += delta.gamesPlayed;
          }
        }

        // Overall rollup
        updateData['stats.overall.wins'] = admin.firestore.FieldValue.increment(totalWins);
        updateData['stats.overall.losses'] = admin.firestore.FieldValue.increment(totalLosses);
        updateData['stats.overall.gamesPlayed'] = admin.firestore.FieldValue.increment(totalGames);
        updateData['stats.overall.tournamentsPlayed'] = admin.firestore.FieldValue.increment(1);
        updateData['updatedAt'] = admin.firestore.FieldValue.serverTimestamp();

        batch.update(playerRef, updateData);
      }

      await batch.commit();

      // 6. Mark tournament as processed to prevent double-counting
      await event.data!.after.ref.update({
        statsProcessed: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `[aggregatePlayerStats] Processed tournament ${tournamentId}: ${deltas.size} players updated`
      );
    } catch (err) {
      console.error(`[aggregatePlayerStats] Error processing tournament ${tournamentId}:`, err);
      throw err;
    }
  }
);

function applyDelta(
  deltas: PlayerDeltas,
  playerId: string,
  sport: string,
  catType: CategoryType,
  delta: StatDelta
): void {
  if (!playerId) return;
  if (!deltas.has(playerId)) deltas.set(playerId, new Map());
  const sportMap = deltas.get(playerId)!;
  if (!sportMap.has(sport)) sportMap.set(sport, new Map());
  const catMap = sportMap.get(sport)!;
  const existing = catMap.get(catType) ?? { wins: 0, losses: 0, gamesPlayed: 0 };
  catMap.set(catType, {
    wins: existing.wins + delta.wins,
    losses: existing.losses + delta.losses,
    gamesPlayed: existing.gamesPlayed + delta.gamesPlayed,
  });
}
