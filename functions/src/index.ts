// Cloud Functions Entry Point
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { BracketsManager } from 'brackets-manager';
import { generateBracket as createBracket } from './bracket';
import { generateSchedule as createSchedule } from './scheduling';
import { updateMatch as updateMatchFn } from './updateMatch';
import { submitBugReport as submitBugReportFn } from './bugReport';
import { submitReview as submitReviewFn } from './reviews';
import { searchSelfCheckInCandidates as searchSelfCheckInCandidatesFn, submitSelfCheckIn as submitSelfCheckInFn } from './selfCheckIn';
import {
  applyVolunteerCheckInAction as applyVolunteerCheckInActionFn,
  issueVolunteerSession as issueVolunteerSessionFn,
  revealVolunteerPin as revealVolunteerPinFn,
  setVolunteerPin as setVolunteerPinFn,
} from './volunteerAccess';
import { FirestoreStorage } from './storage/firestore-adapter';
import { aggregatePlayerStats as aggregatePlayerStatsFn } from './playerStats';
import { executeMerge as executeMergeFn } from './playerMerge';
import { processScoreEvent as processScoreEventFn } from './processScoreEvent';
import { resetDailyCheckIns as resetDailyCheckInsFn } from './resetDailyCheckIns';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

export const updateMatch = updateMatchFn;
export const submitBugReport = submitBugReportFn;
export const submitReview = submitReviewFn;
export const searchSelfCheckInCandidates = searchSelfCheckInCandidatesFn;
export const submitSelfCheckIn = submitSelfCheckInFn;
export const setVolunteerPin = setVolunteerPinFn;
export const revealVolunteerPin = revealVolunteerPinFn;
export const issueVolunteerSession = issueVolunteerSessionFn;
export const applyVolunteerCheckInAction = applyVolunteerCheckInActionFn;
export const aggregatePlayerStats = aggregatePlayerStatsFn;
export const executeMerge = executeMergeFn;
export const processScoreEvent = processScoreEventFn;
export const resetDailyCheckIns = resetDailyCheckInsFn;

/**
 * Generate bracket for a tournament category
 */
export const generateBracket = functions.https.onCall(
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { tournamentId, categoryId } = request.data;

    if (!tournamentId || !categoryId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'tournamentId and categoryId are required'
      );
    }

    // Verify user is admin or organizer
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userRole = userDoc.data()?.role;

    if (!['admin', 'organizer'].includes(userRole)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins and organizers can generate brackets'
      );
    }

    try {
      await createBracket(tournamentId, categoryId);
      return { success: true };
    } catch (error) {
      console.error('Error generating bracket:', error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to generate bracket'
      );
    }
  }
);

/**
 * Generate schedule for a tournament
 */
export const generateSchedule = functions.https.onCall(
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { tournamentId } = request.data;

    if (!tournamentId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'tournamentId is required'
      );
    }

    // Verify user is admin
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userRole = userDoc.data()?.role;

    if (userRole !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can generate schedules'
      );
    }

    try {
      await createSchedule(tournamentId);
      return { success: true };
    } catch (error) {
      console.error('Error generating schedule:', error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to generate schedule'
      );
    }
  }
);

/**
 * Advance winner to next match after match completion
 */
export const advanceWinner = functions.https.onCall(
  async (request) => {
    const { tournamentId, matchId, winnerId } = request.data;

    console.log('advanceWinner called:', { tournamentId, matchId, winnerId });

    try {
      // Initialize brackets-manager with tournament root path
      const manager = new BracketsManager(
        new FirestoreStorage(db, `tournaments/${tournamentId}`)
      );

      // Fetch current match to get opponent IDs
      const match = await manager.storage.select('match', matchId);
      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      const opponent1Id = String(match.opponent1?.id ?? '');
      const opponent2Id = String(match.opponent2?.id ?? '');

      // Determine winner result
      const isOpponent1Winner = winnerId === opponent1Id;
      const isOpponent2Winner = winnerId === opponent2Id;

      if (!isOpponent1Winner && !isOpponent2Winner) {
        console.warn('Winner ID does not match any opponent', {
          winnerId,
          opponent1Id,
          opponent2Id
        });
      }

      // Update match with winner - brackets-manager handles advancement
      await manager.update.match({
        id: matchId,
        opponent1: {
          result: isOpponent1Winner ? 'win' : 'loss'
        },
        opponent2: {
          result: isOpponent2Winner ? 'win' : 'loss'
        }
      });

      console.log('Match updated successfully, winner advanced');
      return { success: true };
    } catch (error) {
      console.error('Error advancing winner:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new functions.https.HttpsError(
        'internal',
        `Failed to advance winner: ${message}`
      );
    }
  }
);

/**
 * Firestore trigger: Auto-notify when match is ready
 *
 * NOTE: Commented out temporarily - uses v1 API syntax incompatible with firebase-functions v7
 * To re-enable, migrate to v2 API: import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
 */
/*
export const onMatchUpdate = functions.firestore
  .document('tournaments/{tournamentId}/matches/{matchId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Check if match became ready (both participants assigned)
    if (
      after.participant1Id &&
      after.participant2Id &&
      (!before.participant1Id || !before.participant2Id)
    ) {
      // Match is now ready to play
      await change.after.ref.update({
        status: 'ready',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // TODO: Create notifications for participants
    }
  });
*/

/**
 * HTTP trigger: Health check
 */
export const healthCheck = functions.https.onRequest((_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});
