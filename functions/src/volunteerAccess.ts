import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';
import { timingSafeEqual } from 'node:crypto';
import { formatDateKey } from './dailyCheckIn';
import { computeCheckIn } from './checkInHelpers';
import {
  assertVolunteerSessionAccess,
  decryptPin,
  encryptPin,
  issueVolunteerSessionToken,
  verifyVolunteerSessionToken,
} from './volunteerAccessCore';
import type {
  VolunteerAccessConfig,
  VolunteerAccessEntry,
  VolunteerCheckInAction,
  VolunteerRole,
  VolunteerSessionPayload,
} from './types';

const VOLUNTEER_PIN_SECRET_ENV = 'VOLUNTEER_PIN_SECRET';
const VOLUNTEER_SESSION_SECRET_ENV = 'VOLUNTEER_SESSION_SECRET';
const VOLUNTEER_SESSION_TTL_MS = 48 * 60 * 60 * 1000;
const PIN_PATTERN = /^\d{4,8}$/;

interface TournamentAccessDoc {
  createdBy?: string;
  organizerIds?: string[];
  volunteerAccess?: VolunteerAccessConfig;
}

interface RegistrationDoc {
  playerId?: string;
  partnerPlayerId?: string;
  participantPresence?: Record<string, boolean>;
  checkedInAt?: admin.firestore.Timestamp | null;
}

interface UserRoleDoc {
  role?: string;
}

const getDb = (): admin.firestore.Firestore => admin.firestore();

const requireConfiguredSecret = (envName: string): string => {
  const secret = String(process.env[envName] || '').trim();
  if (!secret) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `${envName} is not configured`,
    );
  }

  return secret;
};

const parseTournamentId = (value: unknown): string => {
  const tournamentId = String(value || '').trim();
  if (!tournamentId) {
    throw new functions.https.HttpsError('invalid-argument', 'tournamentId is required');
  }

  return tournamentId;
};

const parseVolunteerRole = (value: unknown): VolunteerRole => {
  const role = String(value || '').trim();
  if (role !== 'checkin' && role !== 'scorekeeper') {
    throw new functions.https.HttpsError('invalid-argument', 'role must be checkin or scorekeeper');
  }

  return role;
};

const parseSessionToken = (value: unknown): string => {
  const sessionToken = String(value || '').trim();
  if (!sessionToken) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'sessionToken is required',
    );
  }

  return sessionToken;
};

const parseRegistrationId = (value: unknown): string => {
  const registrationId = String(value || '').trim();
  if (!registrationId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'registrationId is required',
    );
  }

  return registrationId;
};

const parseCheckInAction = (value: unknown): VolunteerCheckInAction => {
  const action = String(value || '').trim();
  if (action !== 'check_in' && action !== 'undo_check_in' && action !== 'assign_bib') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'action must be check_in, undo_check_in, or assign_bib',
    );
  }

  return action;
};

const parseBibNumber = (value: unknown): number => {
  const bibNumber = Number(value);
  if (!Number.isInteger(bibNumber) || bibNumber <= 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'bibNumber must be a positive integer',
    );
  }

  return bibNumber;
};

const normalizePin = (value: unknown): string => {
  const pin = String(value || '').trim();
  if (!PIN_PATTERN.test(pin)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'pin must be 4 to 8 digits',
    );
  }

  return pin;
};

const maskPin = (pin: string): string => {
  if (pin.length <= 2) {
    return '*'.repeat(pin.length);
  }

  return `${'*'.repeat(pin.length - 2)}${pin.slice(-2)}`;
};

const pinMatches = (inputPin: string, storedPin: string): boolean => {
  const inputBuffer = Buffer.from(inputPin, 'utf8');
  const storedBuffer = Buffer.from(storedPin, 'utf8');

  if (inputBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, storedBuffer);
};

const getVolunteerAccessEntry = (
  tournament: TournamentAccessDoc,
  role: VolunteerRole,
): VolunteerAccessEntry | null => {
  return tournament.volunteerAccess?.[role] ?? null;
};

const getTournamentForStaff = async (
  request: functions.https.CallableRequest<unknown>,
  tournamentId: string,
): Promise<{
  ref: admin.firestore.DocumentReference;
  tournament: TournamentAccessDoc;
}> => {
  if (!request.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const db = getDb();
  const [userSnapshot, tournamentSnapshot] = await Promise.all([
    db.collection('users').doc(request.auth.uid).get(),
    db.collection('tournaments').doc(tournamentId).get(),
  ]);

  if (!tournamentSnapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'Tournament not found');
  }

  const userRole = (userSnapshot.data() as UserRoleDoc | undefined)?.role;
  const tournament = tournamentSnapshot.data() as TournamentAccessDoc;
  const organizerIds = tournament.organizerIds ?? [];
  const isOrganizerForTournament =
    tournament.createdBy === request.auth.uid || organizerIds.includes(request.auth.uid);

  if (userRole !== 'admin' && (userRole !== 'organizer' || !isOrganizerForTournament)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only tournament staff can manage volunteer PIN access',
    );
  }

  return {
    ref: tournamentSnapshot.ref,
    tournament,
  };
};

const getTournamentForVolunteer = async (
  tournamentId: string,
): Promise<TournamentAccessDoc> => {
  const snapshot = await getDb().collection('tournaments').doc(tournamentId).get();
  if (!snapshot.exists) {
    throw new functions.https.HttpsError('not-found', 'Tournament not found');
  }

  return snapshot.data() as TournamentAccessDoc;
};

export const setVolunteerPin = functions.https.onCall({
  secrets: [VOLUNTEER_PIN_SECRET_ENV],
}, async (request) => {
  const tournamentId = parseTournamentId(request.data?.tournamentId);
  const role = parseVolunteerRole(request.data?.role);
  const enabledInput = request.data?.enabled;
  const hasPinInput = request.data?.pin !== undefined && request.data?.pin !== null;

  if (!hasPinInput && typeof enabledInput !== 'boolean') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Provide a PIN and/or enabled flag',
    );
  }

  const pinSecret = requireConfiguredSecret(VOLUNTEER_PIN_SECRET_ENV);
  const { ref, tournament } = await getTournamentForStaff(request, tournamentId);
  const existingEntry = getVolunteerAccessEntry(tournament, role);

  let encryptedPin = existingEntry?.encryptedPin || '';
  let pinRevision = existingEntry?.pinRevision ?? 0;
  let enabled = typeof enabledInput === 'boolean' ? enabledInput : existingEntry?.enabled ?? true;
  let maskedPin = encryptedPin ? maskPin(decryptPin(encryptedPin, pinSecret)) : null;

  if (hasPinInput) {
    const pin = normalizePin(request.data?.pin);
    encryptedPin = encryptPin(pin, pinSecret);
    pinRevision += 1;
    enabled = typeof enabledInput === 'boolean' ? enabledInput : true;
    maskedPin = maskPin(pin);
  }

  if (!encryptedPin) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Set a PIN before enabling volunteer access',
    );
  }

  await ref.set({
    volunteerAccess: {
      [role]: {
        encryptedPin,
        enabled,
        pinRevision,
        maskedPin: maskedPin || undefined,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: request.auth?.uid || '',
      },
    },
  }, { merge: true });

  return {
    tournamentId,
    role,
    enabled,
    pinRevision,
    maskedPin,
  };
});

export const revealVolunteerPin = functions.https.onCall({
  secrets: [VOLUNTEER_PIN_SECRET_ENV],
}, async (request) => {
  const tournamentId = parseTournamentId(request.data?.tournamentId);
  const role = parseVolunteerRole(request.data?.role);
  const pinSecret = requireConfiguredSecret(VOLUNTEER_PIN_SECRET_ENV);
  const { tournament } = await getTournamentForStaff(request, tournamentId);
  const entry = getVolunteerAccessEntry(tournament, role);

  if (!entry?.encryptedPin) {
    throw new functions.https.HttpsError('not-found', 'Volunteer PIN not configured');
  }

  return {
    tournamentId,
    role,
    enabled: entry.enabled,
    pinRevision: entry.pinRevision,
    pin: decryptPin(entry.encryptedPin, pinSecret),
  };
});

export const issueVolunteerSession = functions.https.onCall({
  secrets: [VOLUNTEER_PIN_SECRET_ENV, VOLUNTEER_SESSION_SECRET_ENV],
}, async (request) => {
  const tournamentId = parseTournamentId(request.data?.tournamentId);
  const role = parseVolunteerRole(request.data?.role);
  const pin = normalizePin(request.data?.pin);
  const pinSecret = requireConfiguredSecret(VOLUNTEER_PIN_SECRET_ENV);
  const sessionSecret = requireConfiguredSecret(VOLUNTEER_SESSION_SECRET_ENV);
  const tournament = await getTournamentForVolunteer(tournamentId);
  const entry = getVolunteerAccessEntry(tournament, role);

  if (!entry?.encryptedPin) {
    throw new functions.https.HttpsError('not-found', 'Volunteer PIN not configured');
  }

  if (!entry.enabled) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `${role} volunteer access is disabled for this tournament`,
    );
  }

  const storedPin = decryptPin(entry.encryptedPin, pinSecret);
  if (!pinMatches(pin, storedPin)) {
    throw new functions.https.HttpsError('permission-denied', 'Invalid volunteer PIN');
  }

  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + VOLUNTEER_SESSION_TTL_MS;
  const sessionToken = issueVolunteerSessionToken({
    tournamentId,
    role,
    pinRevision: entry.pinRevision,
    issuedAtMs,
    expiresAtMs,
  }, sessionSecret);

  return {
    tournamentId,
    role,
    sessionToken,
    pinRevision: entry.pinRevision,
    expiresAtMs,
  };
});

const toHttpsError = (error: unknown): functions.https.HttpsError => {
  const message = error instanceof Error ? error.message : 'Invalid volunteer session';

  if (message.includes('not configured')) {
    return new functions.https.HttpsError('not-found', message);
  }

  if (message.includes('disabled')) {
    return new functions.https.HttpsError('failed-precondition', message);
  }

  return new functions.https.HttpsError('permission-denied', message);
};

export const verifyVolunteerSession = async (
  sessionToken: string,
  tournamentId: string,
  role: VolunteerRole,
): Promise<{
  payload: VolunteerSessionPayload;
  tournament: TournamentAccessDoc;
  entry: VolunteerAccessEntry;
}> => {
  const sessionSecret = requireConfiguredSecret(VOLUNTEER_SESSION_SECRET_ENV);

  let payload: VolunteerSessionPayload;
  try {
    payload = verifyVolunteerSessionToken(sessionToken, sessionSecret);
  } catch (error) {
    throw toHttpsError(error);
  }

  const tournament = await getTournamentForVolunteer(tournamentId);
  const entry = getVolunteerAccessEntry(tournament, role);

  try {
    const validatedPayload = assertVolunteerSessionAccess({
      payload,
      tournamentId,
      role,
      accessEntry: entry,
    });

    return {
      payload: validatedPayload,
      tournament,
      entry: entry as VolunteerAccessEntry,
    };
  } catch (error) {
    throw toHttpsError(error);
  }
};

export const applyVolunteerCheckInAction = functions.https.onCall({
  secrets: [VOLUNTEER_SESSION_SECRET_ENV],
}, async (request) => {
  const tournamentId = parseTournamentId(request.data?.tournamentId);
  const registrationId = parseRegistrationId(request.data?.registrationId);
  const action = parseCheckInAction(request.data?.action);
  const sessionToken = parseSessionToken(request.data?.sessionToken);
  // Optional: which participant is checking in (for player-by-player doubles check-in).
  // If omitted, all participants on the registration are checked in at once.
  const participantIdInput =
    request.data?.participantId != null
      ? String(request.data.participantId).trim() || null
      : null;

  await verifyVolunteerSession(sessionToken, tournamentId, 'checkin');

  const db = getDb();
  const registrationRef = db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('registrations')
    .doc(registrationId);

  if (action === 'check_in') {
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(registrationRef);
      if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', 'Registration not found');
      }

      const registration = snap.data() as RegistrationDoc;
      const requiredParticipantIds = [registration.playerId, registration.partnerPlayerId]
        .filter((id): id is string => Boolean(id));

      if (requiredParticipantIds.length === 0) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Registration has no participants',
        );
      }

      // Which participants are being checked in now
      const participantIds = participantIdInput
        ? [participantIdInput]
        : requiredParticipantIds;

      if (participantIdInput && !requiredParticipantIds.includes(participantIdInput)) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Participant is not part of this registration',
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
        checkInSource: 'admin',
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (setCheckedInAt) {
        updates.checkedInAt = FieldValue.serverTimestamp();
      }

      for (const id of participantIds) {
        updates[`dailyCheckIns.${todayKey}.presence.${id}`] = true;
      }
      if (allPresent) {
        updates[`dailyCheckIns.${todayKey}.checkedInAt`] = FieldValue.serverTimestamp();
        updates[`dailyCheckIns.${todayKey}.source`] = 'admin';
      }

      transaction.update(registrationRef, updates);
    });
  } else if (action === 'undo_check_in') {
    const snap = await registrationRef.get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Registration not found');
    }

    await registrationRef.update({
      status: 'approved',
      isCheckedIn: false,
      checkedInAt: FieldValue.delete(),
      checkInSource: FieldValue.delete(),
      participantPresence: {},
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    const snap = await registrationRef.get();
    if (!snap.exists) {
      throw new functions.https.HttpsError('not-found', 'Registration not found');
    }

    await registrationRef.update({
      bibNumber: parseBibNumber(request.data?.bibNumber),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return {
    success: true,
    tournamentId,
    registrationId,
    action,
  };
});
