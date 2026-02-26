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
exports.submitSelfCheckIn = exports.searchSelfCheckInCandidates = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
const normalizeQuery = (value) => value.trim().toLowerCase();
const toDisplayName = (player) => {
    if (!player)
        return '';
    const first = (player.firstName || '').trim();
    const last = (player.lastName || '').trim();
    return `${first} ${last}`.trim();
};
const ensureStringArray = (value) => {
    if (!Array.isArray(value))
        return [];
    return value
        .map((item) => String(item || '').trim())
        .filter((item) => item.length > 0);
};
exports.searchSelfCheckInCandidates = functions.https.onCall(async (request) => {
    var _a, _b;
    const tournamentId = String(((_a = request.data) === null || _a === void 0 ? void 0 : _a.tournamentId) || '').trim();
    const rawQuery = String(((_b = request.data) === null || _b === void 0 ? void 0 : _b.query) || '');
    const query = normalizeQuery(rawQuery);
    if (!tournamentId || query.length < 2) {
        throw new functions.https.HttpsError('invalid-argument', 'tournamentId and query (min 2 chars) are required');
    }
    const [registrationsSnapshot, playersSnapshot, categoriesSnapshot] = await Promise.all([
        db
            .collection(`tournaments/${tournamentId}/registrations`)
            .where('status', 'in', ['approved', 'checked_in'])
            .get(),
        db.collection(`tournaments/${tournamentId}/players`).get(),
        db.collection(`tournaments/${tournamentId}/categories`).get(),
    ]);
    const playersById = new Map(playersSnapshot.docs.map((doc) => [doc.id, doc.data()]));
    const categoriesById = new Map(categoriesSnapshot.docs.map((doc) => [doc.id, doc.data()]));
    const candidates = registrationsSnapshot.docs
        .map((doc) => {
        var _a;
        const registration = doc.data();
        const player = registration.playerId ? playersById.get(registration.playerId) : null;
        const partner = registration.partnerPlayerId
            ? playersById.get(registration.partnerPlayerId)
            : null;
        const playerName = toDisplayName(player);
        const partnerName = toDisplayName(partner);
        const categoryName = ((_a = categoriesById.get(registration.categoryId || '')) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Category';
        const displayName = (registration.teamName || '').trim() ||
            [playerName, partnerName].filter(Boolean).join(' / ') ||
            playerName ||
            'Unknown Participant';
        const searchBlob = `${displayName} ${playerName} ${partnerName} ${categoryName}`.toLowerCase();
        if (!searchBlob.includes(query))
            return null;
        const candidate = {
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
        .filter((candidate) => candidate !== null)
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .slice(0, 20);
    return { candidates };
});
exports.submitSelfCheckIn = functions.https.onCall(async (request) => {
    var _a, _b, _c;
    const tournamentId = String(((_a = request.data) === null || _a === void 0 ? void 0 : _a.tournamentId) || '').trim();
    const registrationId = String(((_b = request.data) === null || _b === void 0 ? void 0 : _b.registrationId) || '').trim();
    const participantIds = Array.from(new Set(ensureStringArray((_c = request.data) === null || _c === void 0 ? void 0 : _c.participantIds)));
    if (!tournamentId || !registrationId || participantIds.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid self check-in request payload');
    }
    const registrationRef = db.doc(`tournaments/${tournamentId}/registrations/${registrationId}`);
    const result = await db.runTransaction(async (transaction) => {
        const registrationSnapshot = await transaction.get(registrationRef);
        if (!registrationSnapshot.exists) {
            throw new functions.https.HttpsError('not-found', 'Registration not found');
        }
        const registration = registrationSnapshot.data();
        const currentStatus = registration.status || 'approved';
        if (currentStatus !== 'approved' && currentStatus !== 'checked_in') {
            throw new functions.https.HttpsError('failed-precondition', 'Registration is not eligible for self check-in');
        }
        const requiredParticipantIds = Array.from(new Set([registration.playerId, registration.partnerPlayerId].filter((id) => Boolean(id))));
        if (requiredParticipantIds.length === 0) {
            throw new functions.https.HttpsError('failed-precondition', 'Registration has no participants for self check-in');
        }
        const requiredParticipantSet = new Set(requiredParticipantIds);
        const hasInvalidParticipant = participantIds.some((id) => !requiredParticipantSet.has(id));
        if (hasInvalidParticipant) {
            throw new functions.https.HttpsError('permission-denied', 'Cannot check in participants outside this registration');
        }
        const currentPresence = registration.participantPresence || {};
        const nextPresence = { ...currentPresence };
        for (const participantId of participantIds) {
            nextPresence[participantId] = true;
        }
        const allPresent = requiredParticipantIds.every((id) => nextPresence[id] === true);
        const nextStatus = allPresent ? 'checked_in' : 'approved';
        const updates = {
            participantPresence: nextPresence,
            status: nextStatus,
            isCheckedIn: allPresent,
            checkInSource: 'kiosk',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (allPresent && !registration.checkedInAt) {
            updates.checkedInAt = admin.firestore.FieldValue.serverTimestamp();
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
//# sourceMappingURL=selfCheckIn.js.map