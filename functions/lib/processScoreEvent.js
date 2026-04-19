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
exports.processScoreEvent = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const firestore_2 = require("firebase-functions/v2/firestore");
const brackets_manager_1 = require("brackets-manager");
const firestore_adapter_1 = require("./storage/firestore-adapter");
const volunteerAccess_1 = require("./volunteerAccess");
const getBracketBasePath = (tournamentId, categoryId, levelId) => (levelId
    ? `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}`
    : `tournaments/${tournamentId}/categories/${categoryId}`);
const resolveCourtId = async (db, tournamentId, matchId, docCourtId) => {
    var _a;
    if (docCourtId)
        return docCourtId;
    const snap = await db
        .collection(`tournaments/${tournamentId}/courts`)
        .where('currentMatchId', '==', matchId)
        .limit(1)
        .get();
    return snap.empty ? undefined : (_a = snap.docs[0]) === null || _a === void 0 ? void 0 : _a.id;
};
const mapBracketStatus = (status) => {
    if (status === 'completed' || status === 'walkover')
        return 4;
    if (status === 'in_progress')
        return 3;
    return 2;
};
/**
 * Firestore trigger: processes pending volunteer score events written to the queue
 * collection while offline. This replaces the direct httpsCallable('updateMatch')
 * path for volunteer scorers, giving them full offline resilience via Firestore's
 * IndexedDB cache — writes queue locally and sync when connectivity returns.
 */
exports.processScoreEvent = (0, firestore_2.onDocumentCreated)('tournaments/{tournamentId}/pending_score_events/{eventId}', async (event) => {
    var _a, _b, _c;
    const snapshot = event.data;
    if (!snapshot)
        return;
    const eventRef = snapshot.ref;
    const data = snapshot.data();
    const { tournamentId } = event.params;
    try {
        // 1. Validate volunteer session token (same validation as updateMatch.ts)
        await (0, volunteerAccess_1.verifyVolunteerSession)(data.sessionToken, tournamentId, 'scorekeeper');
        const db = admin.firestore();
        const rootPath = getBracketBasePath(tournamentId, data.categoryId, data.levelId);
        const matchScoresRef = db.doc(`${rootPath}/match_scores/${data.matchId}`);
        const matchScoresSnap = await matchScoresRef.get();
        const existingData = matchScoresSnap.exists ? matchScoresSnap.data() : undefined;
        // 2. Idempotency guard: if the match is already completed, skip processing
        //    completion events to avoid duplicate match_game records and bracket updates.
        if ((data.status === 'completed' || data.status === 'walkover') &&
            (existingData === null || existingData === void 0 ? void 0 : existingData.completedAt)) {
            console.info(`[processScoreEvent] Match ${data.matchId} already completed — skipping duplicate event`);
            await eventRef.delete();
            return;
        }
        // 3. Write score state to match_scores (mirrors updateMatch.ts lines 173–194)
        const matchScoreUpdates = {
            status: data.status,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        };
        if (data.scores)
            matchScoreUpdates.scores = data.scores;
        if (data.winnerId)
            matchScoreUpdates.winnerId = data.winnerId;
        if (data.status === 'in_progress' && !(existingData === null || existingData === void 0 ? void 0 : existingData.startedAt)) {
            matchScoreUpdates.startedAt = firestore_1.FieldValue.serverTimestamp();
        }
        if (data.status === 'completed' || data.status === 'walkover') {
            matchScoreUpdates.completedAt = firestore_1.FieldValue.serverTimestamp();
        }
        await matchScoresRef.set(matchScoreUpdates, { merge: true });
        // 4. Bracket advancement (mirrors updateMatch.ts lines 196–279)
        const manager = new brackets_manager_1.BracketsManager(new firestore_adapter_1.FirestoreStorage(db, rootPath));
        const updateData = {
            id: data.matchId,
            status: mapBracketStatus(data.status),
        };
        if ((data.status === 'completed' || data.status === 'walkover') && data.winnerId) {
            const matchBracketData = await manager.storage.select('match', data.matchId);
            if (!matchBracketData)
                throw new Error(`Match ${data.matchId} not found in bracket`);
            const participants = await manager.storage.select('participant');
            const winnerParticipant = participants === null || participants === void 0 ? void 0 : participants.find((p) => p.name === data.winnerId);
            if (!winnerParticipant) {
                throw new Error(`Winner participant not found for registration ID: ${data.winnerId}`);
            }
            const bracketWinnerId = winnerParticipant.id;
            const opponent1Id = (_a = matchBracketData.opponent1) === null || _a === void 0 ? void 0 : _a.id;
            const opponent2Id = (_b = matchBracketData.opponent2) === null || _b === void 0 ? void 0 : _b.id;
            if (opponent1Id == bracketWinnerId) {
                // Pass only id + result (no score) so handleGivenStatus's early-return
                // path is taken and our explicit result is not overwritten with 'draw'.
                updateData.opponent1 = { id: opponent1Id, result: 'win' };
                updateData.opponent2 = { id: opponent2Id, result: 'loss' };
            }
            else if (opponent2Id == bracketWinnerId) {
                updateData.opponent1 = { id: opponent1Id, result: 'loss' };
                updateData.opponent2 = { id: opponent2Id, result: 'win' };
            }
            else {
                throw new Error(`Winner participant ID ${bracketWinnerId} does not match either opponent in match ${data.matchId}`);
            }
            if (((_c = data.scores) === null || _c === void 0 ? void 0 : _c.length) > 0 && opponent1Id !== undefined && opponent2Id !== undefined) {
                const stageId = matchBracketData.stage_id;
                if (stageId === undefined)
                    throw new Error(`Match ${data.matchId} is missing stage_id`);
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
            const courtId = await resolveCourtId(db, tournamentId, data.matchId, typeof (existingData === null || existingData === void 0 ? void 0 : existingData.courtId) === 'string' ? existingData.courtId : undefined);
            if (courtId) {
                await db.doc(`tournaments/${tournamentId}/courts/${courtId}`).update({
                    status: 'available',
                    currentMatchId: null,
                    assignedMatchId: null,
                    lastFreedAt: firestore_1.FieldValue.serverTimestamp(),
                    updatedAt: firestore_1.FieldValue.serverTimestamp(),
                });
            }
        }
        await manager.update.match(updateData);
        // 5. Delete event document — signals successful processing to the client
        await eventRef.delete();
    }
    catch (error) {
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
        }
        catch (updateError) {
            console.error('❌ [processScoreEvent] Failed to write processingError:', updateError);
        }
    }
});
//# sourceMappingURL=processScoreEvent.js.map