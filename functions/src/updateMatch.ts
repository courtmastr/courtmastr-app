import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { BracketsManager } from 'brackets-manager';
import { FirestoreStorage } from './storage/firestore-adapter';
import type { GameScore, MatchStatus } from './types';
import { verifyVolunteerSession } from './volunteerAccess';

type MatchMutationStatus = Extract<MatchStatus, 'ready' | 'in_progress' | 'completed' | 'walkover'>;

interface UpdateMatchRequestData {
  tournamentId?: unknown;
  categoryId?: unknown;
  levelId?: unknown;
  matchId?: unknown;
  status?: unknown;
  winnerId?: unknown;
  scores?: unknown;
  sessionToken?: unknown;
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

const parseRequiredString = (value: unknown, fieldName: string): string => {
  const parsed = String(value || '').trim();
  if (!parsed) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `${fieldName} is required`,
    );
  }

  return parsed;
};

const parseOptionalString = (value: unknown): string | undefined => {
  const parsed = String(value || '').trim();
  return parsed || undefined;
};

const parseStatus = (value: unknown): MatchMutationStatus => {
  const status = String(value || '').trim();
  if (
    status !== 'ready' &&
    status !== 'in_progress' &&
    status !== 'completed' &&
    status !== 'walkover'
  ) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'status must be ready, in_progress, completed, or walkover',
    );
  }

  return status;
};

const parseScores = (value: unknown): GameScore[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'scores must be an array when provided',
    );
  }

  return value as GameScore[];
};

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
  if (docCourtId) {
    return docCourtId;
  }

  const courtSnapshot = await db
    .collection(`tournaments/${tournamentId}/courts`)
    .where('currentMatchId', '==', matchId)
    .limit(1)
    .get();

  return courtSnapshot.empty ? undefined : courtSnapshot.docs[0]?.id;
};

const mapBracketStatus = (status: MatchMutationStatus): number => {
  if (status === 'completed' || status === 'walkover') {
    return 4;
  }

  if (status === 'in_progress') {
    return 3;
  }

  return 2;
};

export const updateMatch = functions.https.onCall(async (request) => {
  const db = admin.firestore();
  const data = (request.data ?? {}) as UpdateMatchRequestData;
  const tournamentId = parseRequiredString(data.tournamentId, 'tournamentId');
  const categoryId = parseRequiredString(data.categoryId, 'categoryId');
  const levelId = parseOptionalString(data.levelId);
  const matchId = parseRequiredString(data.matchId, 'matchId');
  const status = parseStatus(data.status);
  const winnerId = parseOptionalString(data.winnerId);
  const scores = parseScores(data.scores);
  const sessionToken = parseOptionalString(data.sessionToken);

  if (!request.auth && !sessionToken) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated or provide a volunteer session',
    );
  }

  if (!request.auth && sessionToken) {
    await verifyVolunteerSession(sessionToken, tournamentId, 'scorekeeper');
  }

  if ((status === 'in_progress' || status === 'completed' || status === 'walkover') && !scores) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'scores are required for in-progress and completed match updates',
    );
  }

  if ((status === 'completed' || status === 'walkover') && !winnerId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'winnerId is required for completed or walkover updates',
    );
  }

  try {
    const rootPath = getBracketBasePath(tournamentId, categoryId, levelId);
    const manager = new BracketsManager(new FirestoreStorage(db, rootPath));
    const matchScoresRef = db.doc(`${rootPath}/match_scores/${matchId}`);
    const matchScoresSnapshot = await matchScoresRef.get();
    const existingMatchScoreData = matchScoresSnapshot.exists ? matchScoresSnapshot.data() : undefined;

    const matchScoreUpdates: Record<string, unknown> = {
      status,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (scores) {
      matchScoreUpdates.scores = scores;
    }

    if (winnerId) {
      matchScoreUpdates.winnerId = winnerId;
    }

    if (status === 'in_progress' && !existingMatchScoreData?.startedAt) {
      matchScoreUpdates.startedAt = FieldValue.serverTimestamp();
    }

    if (status === 'completed' || status === 'walkover') {
      matchScoreUpdates.completedAt = FieldValue.serverTimestamp();
    }

    await matchScoresRef.set(matchScoreUpdates, { merge: true });

    const updateData: Record<string, unknown> = {
      id: matchId,
      status: mapBracketStatus(status),
    };

    if ((status === 'completed' || status === 'walkover') && winnerId) {
      const matchData = await manager.storage.select('match', matchId) as StoredBracketMatch | null;
      if (!matchData) {
        throw new Error('Match not found');
      }

      const participants = await manager.storage.select('participant') as StoredBracketParticipant[] | null;
      const winnerParticipant = participants?.find((participant) => participant.name === winnerId);
      if (!winnerParticipant) {
        throw new Error(`Winner participant not found for registration ID: ${winnerId}`);
      }

      const bracketWinnerId = winnerParticipant.id;
      const opponent1Id = matchData.opponent1?.id;
      const opponent2Id = matchData.opponent2?.id;

      if (opponent1Id == bracketWinnerId) {
        updateData.opponent1 = { ...matchData.opponent1, result: 'win' };
        updateData.opponent2 = { ...matchData.opponent2, result: 'loss' };
      } else if (opponent2Id == bracketWinnerId) {
        updateData.opponent1 = { ...matchData.opponent1, result: 'loss' };
        updateData.opponent2 = { ...matchData.opponent2, result: 'win' };
      } else {
        throw new Error(
          `Winner participant ID ${bracketWinnerId} does not match either opponent in match ${matchId}`,
        );
      }

      if (scores && scores.length > 0 && opponent1Id !== undefined && opponent2Id !== undefined) {
        const stageId = matchData.stage_id;
        if (stageId === undefined) {
          throw new Error(`Match ${matchId} is missing stage_id`);
        }

        for (let index = 0; index < scores.length; index += 1) {
          const game = scores[index];
          const opponent1Result: 'win' | 'loss' =
            game.score1 > game.score2 ? 'win' : 'loss';
          const opponent2Result: 'win' | 'loss' =
            game.score2 > game.score1 ? 'win' : 'loss';

          await manager.storage.insert('match_game', {
            stage_id: stageId,
            parent_id: matchId,
            number: index + 1,
            status: 4,
            opponent1: {
              id: opponent1Id,
              score: game.score1,
              result: opponent1Result,
            },
            opponent2: {
              id: opponent2Id,
              score: game.score2,
              result: opponent2Result,
            },
          });
        }
      }

      const courtId = await resolveCourtId(
        db,
        tournamentId,
        matchId,
        typeof existingMatchScoreData?.courtId === 'string' ? existingMatchScoreData.courtId : undefined,
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

    return { success: true };
  } catch (error) {
    console.error('❌ [updateMatch] Error updating match:', error);
    throw new functions.https.HttpsError(
      'internal',
      error instanceof Error ? error.message : 'Failed to update match',
    );
  }
});
