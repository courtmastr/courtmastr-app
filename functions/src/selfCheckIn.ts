import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { formatDateKey } from './dailyCheckIn';
import { computeCheckIn } from './checkInHelpers';

const getDb = (): admin.firestore.Firestore => admin.firestore();

interface RegistrationDoc {
  categoryId?: string;
  playerId?: string;
  partnerPlayerId?: string;
  teamName?: string;
  status?: string;
  participantPresence?: Record<string, boolean>;
  checkedInAt?: admin.firestore.Timestamp | null;
}

interface PlayerDoc {
  firstName?: string;
  lastName?: string;
}

interface CategoryDoc {
  name?: string;
}

interface SearchCandidate {
  registrationId: string;
  categoryId: string;
  categoryName: string;
  displayName: string;
  partnerName: string;
  playerId: string | null;
  partnerPlayerId: string | null;
  status: string;
}

const normalizeQuery = (value: string): string => value.trim().toLowerCase();

const toDisplayName = (player?: PlayerDoc | null): string => {
  if (!player) return '';
  const first = (player.firstName || '').trim();
  const last = (player.lastName || '').trim();
  return `${first} ${last}`.trim();
};

const ensureStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0);
};

export const searchSelfCheckInCandidates = functions.https.onCall(async (request) => {
  const db = getDb();
  const tournamentId = String(request.data?.tournamentId || '').trim();
  const rawQuery = String(request.data?.query || '');
  const query = normalizeQuery(rawQuery);

  if (!tournamentId || query.length < 2) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'tournamentId and query (min 2 chars) are required'
    );
  }

  const [registrationsSnapshot, playersSnapshot, categoriesSnapshot] = await Promise.all([
    db
      .collection(`tournaments/${tournamentId}/registrations`)
      .where('status', 'in', ['approved', 'checked_in'])
      .get(),
    db.collection(`tournaments/${tournamentId}/players`).get(),
    db.collection(`tournaments/${tournamentId}/categories`).get(),
  ]);

  const playersById = new Map<string, PlayerDoc>(
    playersSnapshot.docs.map((doc) => [doc.id, doc.data() as PlayerDoc])
  );

  const categoriesById = new Map<string, CategoryDoc>(
    categoriesSnapshot.docs.map((doc) => [doc.id, doc.data() as CategoryDoc])
  );

  const candidates = registrationsSnapshot.docs
    .map((doc) => {
      const registration = doc.data() as RegistrationDoc;
      const player = registration.playerId ? playersById.get(registration.playerId) : null;
      const partner = registration.partnerPlayerId
        ? playersById.get(registration.partnerPlayerId)
        : null;

      const playerName = toDisplayName(player);
      const partnerName = toDisplayName(partner);
      const categoryName = categoriesById.get(registration.categoryId || '')?.name || 'Unknown Category';
      const displayName =
        (registration.teamName || '').trim() ||
        [playerName, partnerName].filter(Boolean).join(' / ') ||
        playerName ||
        'Unknown Participant';

      const searchBlob = `${displayName} ${playerName} ${partnerName} ${categoryName}`.toLowerCase();
      if (!searchBlob.includes(query)) return null;

      const candidate: SearchCandidate = {
        registrationId: doc.id,
        categoryId: registration.categoryId || '',
        categoryName,
        displayName,
        partnerName,
        playerId: registration.playerId || null,
        partnerPlayerId: registration.partnerPlayerId || null,
        status: registration.status || 'approved',
      };
      return candidate;
    })
    .filter((candidate): candidate is SearchCandidate => candidate !== null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, 20);

  return { candidates };
});

export const submitSelfCheckIn = functions.https.onCall(async (request) => {
  const db = getDb();
  const tournamentId = String(request.data?.tournamentId || '').trim();
  const registrationId = String(request.data?.registrationId || '').trim();
  const participantIds = Array.from(new Set(ensureStringArray(request.data?.participantIds)));

  if (!tournamentId || !registrationId || participantIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid self check-in request payload');
  }

  const registrationRef = db.doc(`tournaments/${tournamentId}/registrations/${registrationId}`);

  const result = await db.runTransaction(async (transaction) => {
    const registrationSnapshot = await transaction.get(registrationRef);
    if (!registrationSnapshot.exists) {
      throw new functions.https.HttpsError('not-found', 'Registration not found');
    }

    const registration = registrationSnapshot.data() as RegistrationDoc;
    const currentStatus = registration.status || 'approved';
    if (currentStatus !== 'approved' && currentStatus !== 'checked_in') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Registration is not eligible for self check-in'
      );
    }

    const requiredParticipantIds = Array.from(
      new Set([registration.playerId, registration.partnerPlayerId].filter(
        (id): id is string => Boolean(id)
      ))
    );

    if (requiredParticipantIds.length === 0) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Registration has no participants for self check-in'
      );
    }

    const requiredParticipantSet = new Set(requiredParticipantIds);
    const hasInvalidParticipant = participantIds.some((id) => !requiredParticipantSet.has(id));
    if (hasInvalidParticipant) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Cannot check in participants outside this registration'
      );
    }

    const { nextPresence, allPresent, nextStatus, setCheckedInAt } = computeCheckIn({
      participantIds,
      requiredParticipantIds,
      currentPresence: registration.participantPresence || {},
      hasCheckedInAt: !!registration.checkedInAt,
    });

    const todayKey = formatDateKey(new Date(), 'America/Chicago');
    const updates: Record<string, unknown> = {
      participantPresence: nextPresence,
      status: nextStatus,
      isCheckedIn: allPresent,
      checkInSource: 'kiosk',
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (setCheckedInAt) {
      updates.checkedInAt = FieldValue.serverTimestamp();
    }

    for (const participantId of participantIds) {
      updates[`dailyCheckIns.${todayKey}.presence.${participantId}`] = true;
    }
    if (allPresent) {
      updates[`dailyCheckIns.${todayKey}.checkedInAt`] = FieldValue.serverTimestamp();
      updates[`dailyCheckIns.${todayKey}.source`] = 'kiosk';
    }

    transaction.update(registrationRef, updates);

    return {
      registrationId,
      status: nextStatus,
      waitingForPartner: requiredParticipantIds.length > 1 && !allPresent,
      requiredParticipantIds,
      presentParticipantIds: requiredParticipantIds.filter((id) => nextPresence[id] === true),
    };
  });

  return result;
});
