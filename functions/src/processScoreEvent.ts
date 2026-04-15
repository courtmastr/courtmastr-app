import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { BracketsManager } from 'brackets-manager';
import { FirestoreStorage } from './storage/firestore-adapter';
import type { GameScore, MatchStatus } from './types';
import { verifyVolunteerSession } from './volunteerAccess';

type MatchMutationStatus = Extract<MatchStatus, 'ready' | 'in_progress' | 'completed' | 'walkover'>;

interface PendingScoreEventData {
  tournamentId: string;
  categoryId: string;
  levelId?: string;
  matchId: string;
  status: MatchMutationStatus;
  scores: GameScore[];
  winnerId?: string;
  sessionToken: string;
  sequence: number;
}

interface BracketOpponent {
  id?: string | number;
  result?: 'win' | 'loss';
}

interface StoredBracketMatch {
  id: string | number;
  stage_id?: string | number;
  opponent1?: BracketOpponent;
  opponent2?: BracketOpponent;
}

interface StoredBracketParticipant {
  id: string | number;
  name?: string;
}

const getBracketBasePath = (
  tournamentId: string,
  categoryId: string,
  levelId?: string,
): string => (
  levelId
    ? `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}`
    : `tournaments/${tournamentId}/categories/${categoryId}`
);

const resolveCourtId = async (
  db: admin.firestore.Firestore,
  tournamentId: string,
  matchId: string,
  docCourtId?: string,
): Promise<string | undefined> => {
  if (docCourtId) return docCourtId;
  const snap = await db
    .collection(`tournaments/${tournamentId}/courts`)
    .where('currentMatchId', '==', matchId)
    .limit(1)
    .get();
  return snap.empty ? undefined : snap.docs[0]?.id;
};

const mapBracketStatus = (status: MatchMutationStatus): number => {
  if (status === 'completed' || status === 'walkover') return 4;
  if (status === 'in_progress') return 3;
  return 2;
};

/**
 * Firestore trigger: processes pending volunteer score events written to the queue
 * collection while offline. This replaces the direct httpsCallable('updateMatch')
 * path for volunteer scorers, giving them full offline resilience via Firestore's
 * IndexedDB cache — writes queue locally and sync when connectivity returns.
 */
export const processScoreEvent = onDocumentCreated(
  'tournaments/{tournamentId}/pending_score_events/{eventId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const eventRef = snapshot.ref;
    const data = snapshot.data() as PendingScoreEventData;
    const { tournamentId } = event.params;

    try {
      // 1. Validate volunteer session token (same validation as updateMatch.ts)
      await verifyVolunteerSession(data.sessionToken, tournamentId, 'scorekeeper');

      const db = admin.firestore();
      const rootPath = getBracketBasePath(tournamentId, data.categoryId, data.levelId);
      const matchScoresRef = db.doc(`${rootPath}/match_scores/${data.matchId}`);
      const matchScoresSnap = await matchScoresRef.get();
      const existingData = matchScoresSnap.exists ? matchScoresSnap.data() : undefined;

      // 2. Idempotency guard: if the match is already completed, skip processing
      //    completion events to avoid duplicate match_game records and bracket updates.
      if (
        (data.status === 'completed' || data.status === 'walkover') &&
        existingData?.completedAt
      ) {
        console.info(`[processScoreEvent] Match ${data.matchId} already completed — skipping duplicate event`);
        await eventRef.delete();
        return;
      }

      // 3. Write score state to match_scores (mirrors updateMatch.ts lines 173–194)
      const matchScoreUpdates: Record<string, unknown> = {
        status: data.status,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (data.scores) matchScoreUpdates.scores = data.scores;
      if (data.winnerId) matchScoreUpdates.winnerId = data.winnerId;

      if (data.status === 'in_progress' && !existingData?.startedAt) {
        matchScoreUpdates.startedAt = FieldValue.serverTimestamp();
      }
      if (data.status === 'completed' || data.status === 'walkover') {
        matchScoreUpdates.completedAt = FieldValue.serverTimestamp();
      }

      await matchScoresRef.set(matchScoreUpdates, { merge: true });

      // 4. Bracket advancement (mirrors updateMatch.ts lines 196–279)
      const manager = new BracketsManager(new FirestoreStorage(db, rootPath));
      const updateData: Record<string, unknown> = {
        id: data.matchId,
        status: mapBracketStatus(data.status),
      };

      if ((data.status === 'completed' || data.status === 'walkover') && data.winnerId) {
        const matchBracketData = await manager.storage.select('match', data.matchId) as StoredBracketMatch | null;
        if (!matchBracketData) throw new Error(`Match ${data.matchId} not found in bracket`);

        const participants = await manager.storage.select('participant') as StoredBracketParticipant[] | null;
        const winnerParticipant = participants?.find((p) => p.name === data.winnerId);
        if (!winnerParticipant) {
          throw new Error(`Winner participant not found for registration ID: ${data.winnerId}`);
        }

        const bracketWinnerId = winnerParticipant.id;
        const opponent1Id = matchBracketData.opponent1?.id;
        const opponent2Id = matchBracketData.opponent2?.id;

        if (opponent1Id == bracketWinnerId) {
          // Pass only id + result (no score) so handleGivenStatus's early-return
          // path is taken and our explicit result is not overwritten with 'draw'.
          updateData.opponent1 = { id: opponent1Id, result: 'win' };
          updateData.opponent2 = { id: opponent2Id, result: 'loss' };
        } else if (opponent2Id == bracketWinnerId) {
          updateData.opponent1 = { id: opponent1Id, result: 'loss' };
          updateData.opponent2 = { id: opponent2Id, result: 'win' };
        } else {
          throw new Error(
            `Winner participant ID ${bracketWinnerId} does not match either opponent in match ${data.matchId}`,
          );
        }

        if (data.scores?.length > 0 && opponent1Id !== undefined && opponent2Id !== undefined) {
          const stageId = matchBracketData.stage_id;
          if (stageId === undefined) throw new Error(`Match ${data.matchId} is missing stage_id`);

          for (let index = 0; index < data.scores.length; index += 1) {
            const game = data.scores[index];
            await manager.storage.insert('match_game', {
              stage_id: stageId,
              parent_id: data.matchId,
              number: index + 1,
              status: 4,
              opponent1: {
                id: opponent1Id,
                score: game.score1,
                result: game.score1 > game.score2 ? 'win' : 'loss',
              },
              opponent2: {
                id: opponent2Id,
                score: game.score2,
                result: game.score2 > game.score1 ? 'win' : 'loss',
              },
            });
          }
        }

        const courtId = await resolveCourtId(
          db,
          tournamentId,
          data.matchId,
          typeof existingData?.courtId === 'string' ? existingData.courtId : undefined,
        );
        if (courtId) {
          await db.doc(`tournaments/${tournamentId}/courts/${courtId}`).update({
            status: 'available',
            currentMatchId: null,
            assignedMatchId: null,
            lastFreedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      await manager.update.match(updateData);

      // 5. Delete event document — signals successful processing to the client
      await eventRef.delete();
    } catch (error) {
      console.error('❌ [processScoreEvent] Error processing score event:', error);
      // Write error to the document rather than deleting — client onSnapshot
      // surfaces this via processingError/processingErrorCode fields.
      const message = error instanceof Error ? error.message : 'Processing failed';
      const isSessionError = message.includes('expired') || message.includes('PIN reset') || message.includes('disabled');
      try {
        await eventRef.update({
          processingError: message,
          processingErrorCode: isSessionError ? 'session_invalid' : 'processing_failed',
        });
      } catch (updateError) {
        console.error('❌ [processScoreEvent] Failed to write processingError:', updateError);
      }
    }
  },
);
