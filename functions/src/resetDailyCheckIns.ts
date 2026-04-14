import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

const BATCH_SIZE = 500;

const getDb = (): admin.firestore.Firestore => admin.firestore();

/**
 * Resets check-in status for every registration in active tournaments at 06:00 UTC
 * (midnight Chicago time in summer, 1 AM in winter — covers all US timezones).
 *
 * For multi-day events, all players start each day as "not checked in",
 * requiring a fresh daily check-in. Only tournaments that are not yet completed
 * are processed. The `dailyCheckIns` audit log is left untouched.
 */
export const resetDailyCheckIns = onSchedule('every day 06:00', async () => {
  const db = getDb();

  // Only process tournaments that are still running (not completed or draft)
  const tournamentsSnapshot = await db
    .collection('tournaments')
    .where('status', 'in', ['registration', 'active'])
    .get();

  if (tournamentsSnapshot.empty) {
    console.log('resetDailyCheckIns: no active tournaments');
    return;
  }

  const resetRefs: admin.firestore.DocumentReference[] = [];

  for (const tournamentDoc of tournamentsSnapshot.docs) {
    // Fetch all registrations that are currently checked_in or no_show
    const registrationsSnapshot = await db
      .collection('tournaments')
      .doc(tournamentDoc.id)
      .collection('registrations')
      .where('status', 'in', ['checked_in', 'no_show'])
      .get();

    for (const regDoc of registrationsSnapshot.docs) {
      resetRefs.push(regDoc.ref);
    }
  }

  if (resetRefs.length === 0) {
    console.log('resetDailyCheckIns: no registrations to reset');
    return;
  }

  // Batch-write resets (Firestore limit: 500 writes per batch)
  for (let i = 0; i < resetRefs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const ref of resetRefs.slice(i, i + BATCH_SIZE)) {
      batch.update(ref, {
        status: 'approved',
        isCheckedIn: false,
        checkedInAt: FieldValue.delete(),
        checkInSource: FieldValue.delete(),
        participantPresence: {},
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  console.log(`resetDailyCheckIns: reset ${resetRefs.length} registrations across ${tournamentsSnapshot.size} tournaments`);
});
