// Cloud Functions Entry Point
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { generateBracket as createBracket } from './bracket';
import { generateSchedule as createSchedule } from './scheduling';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

/**
 * Generate bracket for a tournament category
 */
export const generateBracket = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { tournamentId, categoryId } = data;

    if (!tournamentId || !categoryId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'tournamentId and categoryId are required'
      );
    }

    // Verify user is admin or organizer
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
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
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { tournamentId } = data;

    if (!tournamentId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'tournamentId is required'
      );
    }

    // Verify user is admin
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
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
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { tournamentId, matchId, winnerId } = data;

    if (!tournamentId || !matchId || !winnerId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'tournamentId, matchId, and winnerId are required'
      );
    }

    try {
      // Get the completed match
      const matchDoc = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('matches')
        .doc(matchId)
        .get();

      if (!matchDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Match not found');
      }

      const match = matchDoc.data();

      // Advance winner to next match
      if (match?.nextMatchId && match?.nextMatchSlot) {
        await db
          .collection('tournaments')
          .doc(tournamentId)
          .collection('matches')
          .doc(match.nextMatchId)
          .update({
            [match.nextMatchSlot + 'Id']: winnerId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      }

      // For double elimination, also handle loser advancement
      if (match?.loserNextMatchId && match?.loserNextMatchSlot) {
        const loserId =
          match.participant1Id === winnerId
            ? match.participant2Id
            : match.participant1Id;

        await db
          .collection('tournaments')
          .doc(tournamentId)
          .collection('matches')
          .doc(match.loserNextMatchId)
          .update({
            [match.loserNextMatchSlot + 'Id']: loserId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      }

      // Release court
      if (match?.courtId) {
        await db
          .collection('tournaments')
          .doc(tournamentId)
          .collection('courts')
          .doc(match.courtId)
          .update({
            status: 'available',
            currentMatchId: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
      }

      // Create notification for next match participants
      // (simplified - in production would be more sophisticated)

      return { success: true };
    } catch (error) {
      console.error('Error advancing winner:', error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to advance winner'
      );
    }
  }
);

/**
 * Firestore trigger: Auto-notify when match is ready
 */
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

/**
 * HTTP trigger: Health check
 */
export const healthCheck = functions.https.onRequest((req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});
