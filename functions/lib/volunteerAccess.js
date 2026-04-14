"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyVolunteerCheckInAction = exports.verifyVolunteerSession = exports.issueVolunteerSession = exports.revealVolunteerPin = exports.setVolunteerPin = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const node_crypto_1 = require("node:crypto");
const dailyCheckIn_1 = require("./dailyCheckIn");
const checkInHelpers_1 = require("./checkInHelpers");
const volunteerAccessCore_1 = require("./volunteerAccessCore");
const VOLUNTEER_PIN_SECRET_ENV = 'VOLUNTEER_PIN_SECRET';
const VOLUNTEER_SESSION_SECRET_ENV = 'VOLUNTEER_SESSION_SECRET';
const VOLUNTEER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PIN_PATTERN = /^\d{4,8}$/;
const getDb = () => admin.firestore();
const requireConfiguredSecret = (envName) => {
    const secret = String(process.env[envName] || '').trim();
    if (!secret) {
        throw new functions.https.HttpsError('failed-precondition', `${envName} is not configured`);
    }
    return secret;
};
const parseTournamentId = (value) => {
    const tournamentId = String(value || '').trim();
    if (!tournamentId) {
        throw new functions.https.HttpsError('invalid-argument', 'tournamentId is required');
    }
    return tournamentId;
};
const parseVolunteerRole = (value) => {
    const role = String(value || '').trim();
    if (role !== 'checkin' && role !== 'scorekeeper') {
        throw new functions.https.HttpsError('invalid-argument', 'role must be checkin or scorekeeper');
    }
    return role;
};
const parseSessionToken = (value) => {
    const sessionToken = String(value || '').trim();
    if (!sessionToken) {
        throw new functions.https.HttpsError('invalid-argument', 'sessionToken is required');
    }
    return sessionToken;
};
const parseRegistrationId = (value) => {
    const registrationId = String(value || '').trim();
    if (!registrationId) {
        throw new functions.https.HttpsError('invalid-argument', 'registrationId is required');
    }
    return registrationId;
};
const parseCheckInAction = (value) => {
    const action = String(value || '').trim();
    if (action !== 'check_in' && action !== 'undo_check_in' && action !== 'assign_bib') {
        throw new functions.https.HttpsError('invalid-argument', 'action must be check_in, undo_check_in, or assign_bib');
    }
    return action;
};
const parseBibNumber = (value) => {
    const bibNumber = Number(value);
    if (!Number.isInteger(bibNumber) || bibNumber <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'bibNumber must be a positive integer');
    }
    return bibNumber;
};
const normalizePin = (value) => {
    const pin = String(value || '').trim();
    if (!PIN_PATTERN.test(pin)) {
        throw new functions.https.HttpsError('invalid-argument', 'pin must be 4 to 8 digits');
    }
    return pin;
};
const maskPin = (pin) => {
    if (pin.length <= 2) {
        return '*'.repeat(pin.length);
    }
    return `${'*'.repeat(pin.length - 2)}${pin.slice(-2)}`;
};
const pinMatches = (inputPin, storedPin) => {
    const inputBuffer = Buffer.from(inputPin, 'utf8');
    const storedBuffer = Buffer.from(storedPin, 'utf8');
    if (inputBuffer.length !== storedBuffer.length) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(inputBuffer, storedBuffer);
};
const getVolunteerAccessEntry = (tournament, role) => {
    var _a, _b;
    return (_b = (_a = tournament.volunteerAccess) === null || _a === void 0 ? void 0 : _a[role]) !== null && _b !== void 0 ? _b : null;
};
const getTournamentForStaff = async (request, tournamentId) => {
    var _a, _b;
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
    const userRole = (_a = userSnapshot.data()) === null || _a === void 0 ? void 0 : _a.role;
    const tournament = tournamentSnapshot.data();
    const organizerIds = (_b = tournament.organizerIds) !== null && _b !== void 0 ? _b : [];
    const isOrganizerForTournament = tournament.createdBy === request.auth.uid || organizerIds.includes(request.auth.uid);
    if (userRole !== 'admin' && (userRole !== 'organizer' || !isOrganizerForTournament)) {
        throw new functions.https.HttpsError('permission-denied', 'Only tournament staff can manage volunteer PIN access');
    }
    return {
        ref: tournamentSnapshot.ref,
        tournament,
    };
};
const getTournamentForVolunteer = async (tournamentId) => {
    const snapshot = await getDb().collection('tournaments').doc(tournamentId).get();
    if (!snapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Tournament not found');
    }
    return snapshot.data();
};
exports.setVolunteerPin = functions.https.onCall({
    secrets: [VOLUNTEER_PIN_SECRET_ENV],
}, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const tournamentId = parseTournamentId((_a = request.data) === null || _a === void 0 ? void 0 : _a.tournamentId);
    const role = parseVolunteerRole((_b = request.data) === null || _b === void 0 ? void 0 : _b.role);
    const enabledInput = (_c = request.data) === null || _c === void 0 ? void 0 : _c.enabled;
    const hasPinInput = ((_d = request.data) === null || _d === void 0 ? void 0 : _d.pin) !== undefined && ((_e = request.data) === null || _e === void 0 ? void 0 : _e.pin) !== null;
    if (!hasPinInput && typeof enabledInput !== 'boolean') {
        throw new functions.https.HttpsError('invalid-argument', 'Provide a PIN and/or enabled flag');
    }
    const pinSecret = requireConfiguredSecret(VOLUNTEER_PIN_SECRET_ENV);
    const { ref, tournament } = await getTournamentForStaff(request, tournamentId);
    const existingEntry = getVolunteerAccessEntry(tournament, role);
    let encryptedPin = (existingEntry === null || existingEntry === void 0 ? void 0 : existingEntry.encryptedPin) || '';
    let pinRevision = (_f = existingEntry === null || existingEntry === void 0 ? void 0 : existingEntry.pinRevision) !== null && _f !== void 0 ? _f : 0;
    let enabled = typeof enabledInput === 'boolean' ? enabledInput : (_g = existingEntry === null || existingEntry === void 0 ? void 0 : existingEntry.enabled) !== null && _g !== void 0 ? _g : true;
    let maskedPin = encryptedPin ? maskPin((0, volunteerAccessCore_1.decryptPin)(encryptedPin, pinSecret)) : null;
    if (hasPinInput) {
        const pin = normalizePin((_h = request.data) === null || _h === void 0 ? void 0 : _h.pin);
        encryptedPin = (0, volunteerAccessCore_1.encryptPin)(pin, pinSecret);
        pinRevision += 1;
        enabled = typeof enabledInput === 'boolean' ? enabledInput : true;
        maskedPin = maskPin(pin);
    }
    if (!encryptedPin) {
        throw new functions.https.HttpsError('failed-precondition', 'Set a PIN before enabling volunteer access');
    }
    await ref.set({
        volunteerAccess: {
            [role]: {
                encryptedPin,
                enabled,
                pinRevision,
                maskedPin: maskedPin || undefined,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                updatedBy: ((_j = request.auth) === null || _j === void 0 ? void 0 : _j.uid) || '',
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
exports.revealVolunteerPin = functions.https.onCall({
    secrets: [VOLUNTEER_PIN_SECRET_ENV],
}, async (request) => {
    var _a, _b;
    const tournamentId = parseTournamentId((_a = request.data) === null || _a === void 0 ? void 0 : _a.tournamentId);
    const role = parseVolunteerRole((_b = request.data) === null || _b === void 0 ? void 0 : _b.role);
    const pinSecret = requireConfiguredSecret(VOLUNTEER_PIN_SECRET_ENV);
    const { tournament } = await getTournamentForStaff(request, tournamentId);
    const entry = getVolunteerAccessEntry(tournament, role);
    if (!(entry === null || entry === void 0 ? void 0 : entry.encryptedPin)) {
        throw new functions.https.HttpsError('not-found', 'Volunteer PIN not configured');
    }
    return {
        tournamentId,
        role,
        enabled: entry.enabled,
        pinRevision: entry.pinRevision,
        pin: (0, volunteerAccessCore_1.decryptPin)(entry.encryptedPin, pinSecret),
    };
});
exports.issueVolunteerSession = functions.https.onCall({
    secrets: [VOLUNTEER_PIN_SECRET_ENV, VOLUNTEER_SESSION_SECRET_ENV],
}, async (request) => {
    var _a, _b, _c;
    const tournamentId = parseTournamentId((_a = request.data) === null || _a === void 0 ? void 0 : _a.tournamentId);
    const role = parseVolunteerRole((_b = request.data) === null || _b === void 0 ? void 0 : _b.role);
    const pin = normalizePin((_c = request.data) === null || _c === void 0 ? void 0 : _c.pin);
    const pinSecret = requireConfiguredSecret(VOLUNTEER_PIN_SECRET_ENV);
    const sessionSecret = requireConfiguredSecret(VOLUNTEER_SESSION_SECRET_ENV);
    const tournament = await getTournamentForVolunteer(tournamentId);
    const entry = getVolunteerAccessEntry(tournament, role);
    if (!(entry === null || entry === void 0 ? void 0 : entry.encryptedPin)) {
        throw new functions.https.HttpsError('not-found', 'Volunteer PIN not configured');
    }
    if (!entry.enabled) {
        throw new functions.https.HttpsError('failed-precondition', `${role} volunteer access is disabled for this tournament`);
    }
    const storedPin = (0, volunteerAccessCore_1.decryptPin)(entry.encryptedPin, pinSecret);
    if (!pinMatches(pin, storedPin)) {
        throw new functions.https.HttpsError('permission-denied', 'Invalid volunteer PIN');
    }
    const issuedAtMs = Date.now();
    const expiresAtMs = issuedAtMs + VOLUNTEER_SESSION_TTL_MS;
    const sessionToken = (0, volunteerAccessCore_1.issueVolunteerSessionToken)({
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
const toHttpsError = (error) => {
    const message = error instanceof Error ? error.message : 'Invalid volunteer session';
    if (message.includes('not configured')) {
        return new functions.https.HttpsError('not-found', message);
    }
    if (message.includes('disabled')) {
        return new functions.https.HttpsError('failed-precondition', message);
    }
    return new functions.https.HttpsError('permission-denied', message);
};
const verifyVolunteerSession = async (sessionToken, tournamentId, role) => {
    const sessionSecret = requireConfiguredSecret(VOLUNTEER_SESSION_SECRET_ENV);
    let payload;
    try {
        payload = (0, volunteerAccessCore_1.verifyVolunteerSessionToken)(sessionToken, sessionSecret);
    }
    catch (error) {
        throw toHttpsError(error);
    }
    const tournament = await getTournamentForVolunteer(tournamentId);
    const entry = getVolunteerAccessEntry(tournament, role);
    try {
        const validatedPayload = (0, volunteerAccessCore_1.assertVolunteerSessionAccess)({
            payload,
            tournamentId,
            role,
            accessEntry: entry,
        });
        return {
            payload: validatedPayload,
            tournament,
            entry: entry,
        };
    }
    catch (error) {
        throw toHttpsError(error);
    }
};
exports.verifyVolunteerSession = verifyVolunteerSession;
exports.applyVolunteerCheckInAction = functions.https.onCall({
    secrets: [VOLUNTEER_SESSION_SECRET_ENV],
}, async (request) => {
    var _a, _b, _c, _d, _e, _f;
    const tournamentId = parseTournamentId((_a = request.data) === null || _a === void 0 ? void 0 : _a.tournamentId);
    const registrationId = parseRegistrationId((_b = request.data) === null || _b === void 0 ? void 0 : _b.registrationId);
    const action = parseCheckInAction((_c = request.data) === null || _c === void 0 ? void 0 : _c.action);
    const sessionToken = parseSessionToken((_d = request.data) === null || _d === void 0 ? void 0 : _d.sessionToken);
    // Optional: which participant is checking in (for player-by-player doubles check-in).
    // If omitted, all participants on the registration are checked in at once.
    const participantIdInput = ((_e = request.data) === null || _e === void 0 ? void 0 : _e.participantId) != null
        ? String(request.data.participantId).trim() || null
        : null;
    await (0, exports.verifyVolunteerSession)(sessionToken, tournamentId, 'checkin');
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
            const registration = snap.data();
            const requiredParticipantIds = [registration.playerId, registration.partnerPlayerId]
                .filter((id) => Boolean(id));
            if (requiredParticipantIds.length === 0) {
                throw new functions.https.HttpsError('failed-precondition', 'Registration has no participants');
            }
            // Which participants are being checked in now
            const participantIds = participantIdInput
                ? [participantIdInput]
                : requiredParticipantIds;
            if (participantIdInput && !requiredParticipantIds.includes(participantIdInput)) {
                throw new functions.https.HttpsError('permission-denied', 'Participant is not part of this registration');
            }
            const { nextPresence, allPresent, nextStatus, setCheckedInAt } = (0, checkInHelpers_1.computeCheckIn)({
                participantIds,
                requiredParticipantIds,
                currentPresence: registration.participantPresence || {},
                hasCheckedInAt: !!registration.checkedInAt,
            });
            const todayKey = (0, dailyCheckIn_1.formatDateKey)(new Date(), 'America/Chicago');
            const updates = {
                participantPresence: nextPresence,
                status: nextStatus,
                isCheckedIn: allPresent,
                checkInSource: 'admin',
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            };
            if (setCheckedInAt) {
                updates.checkedInAt = firestore_1.FieldValue.serverTimestamp();
            }
            for (const id of participantIds) {
                updates[`dailyCheckIns.${todayKey}.presence.${id}`] = true;
            }
            if (allPresent) {
                updates[`dailyCheckIns.${todayKey}.checkedInAt`] = firestore_1.FieldValue.serverTimestamp();
                updates[`dailyCheckIns.${todayKey}.source`] = 'admin';
            }
            transaction.update(registrationRef, updates);
        });
    }
    else if (action === 'undo_check_in') {
        const snap = await registrationRef.get();
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', 'Registration not found');
        }
        await registrationRef.update({
            status: 'approved',
            isCheckedIn: false,
            checkedInAt: firestore_1.FieldValue.delete(),
            checkInSource: firestore_1.FieldValue.delete(),
            participantPresence: {},
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    else {
        const snap = await registrationRef.get();
        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', 'Registration not found');
        }
        await registrationRef.update({
            bibNumber: parseBibNumber((_f = request.data) === null || _f === void 0 ? void 0 : _f.bibNumber),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    return {
        success: true,
        tournamentId,
        registrationId,
        action,
    };
});
//# sourceMappingURL=volunteerAccess.js.map