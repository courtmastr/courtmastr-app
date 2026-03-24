// Cloud Function: aggregate player stats when a tournament completes
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

type CategoryType = 'singles' | 'doubles' | 'mixed';

interface StatDelta {
  wins: number;
  losses: number;
  gamesPlayed: number;
}

// Per-player per-sport per-category deltas
type PlayerDeltas = Map<string, Map<string, Map<CategoryType, StatDelta>>>;

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
      // 1. Fetch all registrations for this tournament (playerId lookup)
      const registrationsSnap = await db
        .collection(`tournaments/${tournamentId}/registrations`)
        .get();

      // Build a map: registrationId → { playerId, categoryId }
      const regMap = new Map<string, { playerId: string; categoryId: string }>();
      for (const regDoc of registrationsSnap.docs) {
        const d = regDoc.data();
        if (d.playerId && d.categoryId) {
          regMap.set(regDoc.id, { playerId: d.playerId, categoryId: d.categoryId });
        }
      }

      // 2. Build a map of categoryId → categoryType (singles/doubles/mixed)
      const categoryTypeMap = new Map<string, CategoryType>();
      const categoriesSnap = await db
        .collection(`tournaments/${tournamentId}/categories`)
        .get();
      for (const catDoc of categoriesSnap.docs) {
        const catType = catDoc.data().type as CategoryType | undefined;
        if (catType) categoryTypeMap.set(catDoc.id, catType);
      }

      // 3. Read all match_scores for this tournament via collectionGroup
      //    (tournamentId field was denormalized at write time)
      const matchScoresSnap = await db
        .collectionGroup('match_scores')
        .where('tournamentId', '==', tournamentId)
        .where('status', '==', 'completed')
        .get();

      // 4. Compute per-player deltas
      for (const msDoc of matchScoresSnap.docs) {
        const ms = msDoc.data();
        const winnerId: string | undefined = ms.winnerId;
        const participant1Id: string | undefined = ms.participant1Id;
        const participant2Id: string | undefined = ms.participant2Id;

        if (!winnerId || !participant1Id || !participant2Id) continue;

        // Determine category type from registration → categoryId
        const p1Reg = regMap.get(participant1Id);
        const p2Reg = regMap.get(participant2Id);
        const categoryId = p1Reg?.categoryId ?? p2Reg?.categoryId;
        if (!categoryId) continue;
        const catType = categoryTypeMap.get(categoryId);
        if (!catType) continue;

        const loserId = winnerId === participant1Id ? participant2Id : participant1Id;

        // Count game wins/losses from scores array
        let winnerGames = 0;
        let loserGames = 0;
        const scores: Array<{ score1: number; score2: number; isComplete?: boolean }> =
          Array.isArray(ms.scores) ? ms.scores : [];
        for (const game of scores) {
          if (!game.isComplete && game.score1 === 0 && game.score2 === 0) continue;
          const p1Wins = game.score1 > game.score2;
          if (winnerId === participant1Id) {
            if (p1Wins) winnerGames++; else loserGames++;
          } else {
            if (!p1Wins) winnerGames++; else loserGames++;
          }
        }

        applyDelta(deltas, p1Reg?.playerId ?? '', sport, catType, {
          wins: winnerId === participant1Id ? 1 : 0,
          losses: winnerId !== participant1Id ? 1 : 0,
          gamesPlayed: winnerGames + loserGames,
        });
        applyDelta(deltas, p2Reg?.playerId ?? '', sport, catType, {
          wins: winnerId === participant2Id ? 1 : 0,
          losses: winnerId !== participant2Id ? 1 : 0,
          gamesPlayed: winnerGames + loserGames,
        });

        // For doubles/mixed: partners share the same registration ID so
        // both players are already captured above when they each have a separate registration.
        // No additional processing needed for the current data model.

        // Track loser's game counts too (already done via p1/p2 above)
        void loserId; // referenced indirectly; suppress unused-var
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

      console.log(`[aggregatePlayerStats] Processed tournament ${tournamentId}: ${deltas.size} players updated`);
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
