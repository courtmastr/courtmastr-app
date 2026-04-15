import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getTodayWindowUTC } from './dailyCheckIn';

const BATCH_SIZE = 500;
const CHUNK_SIZE = 30; // Firestore 'in' query max

interface TournamentDoc {
  status?: string;
  timezone?: string;
}

interface MatchDoc {
  participant1Id?: string;
  participant2Id?: string;
  plannedStartAt?: admin.firestore.Timestamp | null;
}

interface RegistrationDoc {
  status?: string;
}

const getDb = (): admin.firestore.Firestore => admin.firestore();

export const resetDailyCheckIns = onSchedule('every day 06:00', async () => {
  const db = getDb();
  const now = new Date();

  // 1. Query all non-completed tournaments
  const tournamentsSnapshot = await db
    .collection('tournaments')
    .where('status', '!=', 'completed')
    .get();

  if (tournamentsSnapshot.empty) return;

  // 2. For each tournament, find registrations to reset
  const resetUpdates: admin.firestore.DocumentReference[] = [];

  for (const tournamentDoc of tournamentsSnapshot.docs) {
    const tournament = tournamentDoc.data() as TournamentDoc;
    const timezone = tournament.timezone || 'America/Chicago';
    const { windowStart, windowEnd } = getTodayWindowUTC(now, timezone);

    // 3. Fetch all matches for this tournament
    const matchesSnapshot = await db
      .collection('tournaments')
      .doc(tournamentDoc.id)
      .collection('matches')
      .get();

    // 4. Collect registration IDs with matches in today's window
    const registrationIdsToCheck = new Set<string>();
    for (const matchDoc of matchesSnapshot.docs) {
      const match = matchDoc.data() as MatchDoc;
      const plannedStartAt = match.plannedStartAt?.toDate() ?? null;
      if (!plannedStartAt) continue;
      if (plannedStartAt >= windowStart && plannedStartAt < windowEnd) {
        if (match.participant1Id) registrationIdsToCheck.add(match.participant1Id);
        if (match.participant2Id) registrationIdsToCheck.add(match.participant2Id);
      }
    }

    if (registrationIdsToCheck.size === 0) continue;

    // 5. Fetch those registrations to check their status
    const registrationIds = [...registrationIdsToCheck];
    // Firestore 'in' query supports max 30 items — chunk if needed
    for (let i = 0; i < registrationIds.length; i += CHUNK_SIZE) {
      const chunk = registrationIds.slice(i, i + CHUNK_SIZE);
      const registrationsSnapshot = await db
        .collection('tournaments')
        .doc(tournamentDoc.id)
        .collection('registrations')
        .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
        .get();

      for (const regDoc of registrationsSnapshot.docs) {
        const reg = regDoc.data() as RegistrationDoc;
        if (reg.status === 'checked_in' || reg.status === 'no_show') {
          resetUpdates.push(regDoc.ref);
        }
      }
    }
  }

  if (resetUpdates.length === 0) {
    console.log('resetDailyCheckIns: no registrations to reset');
    return;
  }

  // 6. Batch-write resets (max 500 per batch)
  for (let i = 0; i < resetUpdates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = resetUpdates.slice(i, i + BATCH_SIZE);
    for (const ref of chunk) {
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

  console.log(`resetDailyCheckIns: reset ${resetUpdates.length} registrations`);
});
