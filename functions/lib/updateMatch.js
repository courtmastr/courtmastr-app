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
exports.updateMatch = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const brackets_manager_1 = require("brackets-manager");
const firestore_adapter_1 = require("./storage/firestore-adapter");
const volunteerAccess_1 = require("./volunteerAccess");
const parseRequiredString = (value, fieldName) => {
    const parsed = String(value || '').trim();
    if (!parsed) {
        throw new functions.https.HttpsError('invalid-argument', `${fieldName} is required`);
    }
    return parsed;
};
const parseOptionalString = (value) => {
    const parsed = String(value || '').trim();
    return parsed || undefined;
};
const parseStatus = (value) => {
    const status = String(value || '').trim();
    if (status !== 'ready' &&
        status !== 'in_progress' &&
        status !== 'completed' &&
        status !== 'walkover') {
        throw new functions.https.HttpsError('invalid-argument', 'status must be ready, in_progress, completed, or walkover');
    }
    return status;
};
const parseScores = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value)) {
        throw new functions.https.HttpsError('invalid-argument', 'scores must be an array when provided');
    }
    return value;
};
const getBracketBasePath = (tournamentId, categoryId, levelId) => (levelId
    ? `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}`
    : `tournaments/${tournamentId}/categories/${categoryId}`);
const resolveCourtId = async (db, tournamentId, matchId, docCourtId) => {
    var _a;
    if (docCourtId) {
        return docCourtId;
    }
    const courtSnapshot = await db
        .collection(`tournaments/${tournamentId}/courts`)
        .where('currentMatchId', '==', matchId)
        .limit(1)
        .get();
    return courtSnapshot.empty ? undefined : (_a = courtSnapshot.docs[0]) === null || _a === void 0 ? void 0 : _a.id;
};
const mapBracketStatus = (status) => {
    if (status === 'completed' || status === 'walkover') {
        return 4;
    }
    if (status === 'in_progress') {
        return 3;
    }
    return 2;
};
exports.updateMatch = functions.https.onCall(async (request) => {
    var _a, _b, _c;
    const db = admin.firestore();
    const data = ((_a = request.data) !== null && _a !== void 0 ? _a : {});
    const tournamentId = parseRequiredString(data.tournamentId, 'tournamentId');
    const categoryId = parseRequiredString(data.categoryId, 'categoryId');
    const levelId = parseOptionalString(data.levelId);
    const matchId = parseRequiredString(data.matchId, 'matchId');
    const status = parseStatus(data.status);
    const winnerId = parseOptionalString(data.winnerId);
    const scores = parseScores(data.scores);
    const sessionToken = parseOptionalString(data.sessionToken);
    if (!request.auth && !sessionToken) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated or provide a volunteer session');
    }
    if (!request.auth && sessionToken) {
        await (0, volunteerAccess_1.verifyVolunteerSession)(sessionToken, tournamentId, 'scorekeeper');
    }
    if ((status === 'in_progress' || status === 'completed' || status === 'walkover') && !scores) {
        throw new functions.https.HttpsError('invalid-argument', 'scores are required for in-progress and completed match updates');
    }
    if ((status === 'completed' || status === 'walkover') && !winnerId) {
        throw new functions.https.HttpsError('invalid-argument', 'winnerId is required for completed or walkover updates');
    }
    try {
        const rootPath = getBracketBasePath(tournamentId, categoryId, levelId);
        const manager = new brackets_manager_1.BracketsManager(new firestore_adapter_1.FirestoreStorage(db, rootPath));
        const matchScoresRef = db.doc(`${rootPath}/match_scores/${matchId}`);
        const matchScoresSnapshot = await matchScoresRef.get();
        const existingMatchScoreData = matchScoresSnapshot.exists ? matchScoresSnapshot.data() : undefined;
        const matchScoreUpdates = {
            status,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        };
        if (scores) {
            matchScoreUpdates.scores = scores;
        }
        if (winnerId) {
            matchScoreUpdates.winnerId = winnerId;
        }
        if (status === 'in_progress' && !(existingMatchScoreData === null || existingMatchScoreData === void 0 ? void 0 : existingMatchScoreData.startedAt)) {
            matchScoreUpdates.startedAt = firestore_1.FieldValue.serverTimestamp();
        }
        if (status === 'completed' || status === 'walkover') {
            matchScoreUpdates.completedAt = firestore_1.FieldValue.serverTimestamp();
        }
        await matchScoresRef.set(matchScoreUpdates, { merge: true });
        const updateData = {
            id: matchId,
            status: mapBracketStatus(status),
        };
        if ((status === 'completed' || status === 'walkover') && winnerId) {
            const matchData = await manager.storage.select('match', matchId);
            if (!matchData) {
                throw new Error('Match not found');
            }
            const participants = await manager.storage.select('participant');
            const winnerParticipant = participants === null || participants === void 0 ? void 0 : participants.find((participant) => participant.name === winnerId);
            if (!winnerParticipant) {
                throw new Error(`Winner participant not found for registration ID: ${winnerId}`);
            }
            const bracketWinnerId = winnerParticipant.id;
            const opponent1Id = (_b = matchData.opponent1) === null || _b === void 0 ? void 0 : _b.id;
            const opponent2Id = (_c = matchData.opponent2) === null || _c === void 0 ? void 0 : _c.id;
            if (opponent1Id == bracketWinnerId) {
                // Pass only id + result (no score) so BracketsManager's handleGivenStatus
                // early-return path is taken and our explicit result is not overwritten.
                updateData.opponent1 = { id: opponent1Id, result: 'win' };
                updateData.opponent2 = { id: opponent2Id, result: 'loss' };
            }
            else if (opponent2Id == bracketWinnerId) {
                updateData.opponent1 = { id: opponent1Id, result: 'loss' };
                updateData.opponent2 = { id: opponent2Id, result: 'win' };
            }
            else {
                throw new Error(`Winner participant ID ${bracketWinnerId} does not match either opponent in match ${matchId}`);
            }
            if (scores && scores.length > 0 && opponent1Id !== undefined && opponent2Id !== undefined) {
                const stageId = matchData.stage_id;
                if (stageId === undefined) {
                    throw new Error(`Match ${matchId} is missing stage_id`);
                }
                for (let index = 0; index < scores.length; index += 1) {
                    const game = scores[index];
                    const opponent1Result = game.score1 > game.score2 ? 'win' : 'loss';
                    const opponent2Result = game.score2 > game.score1 ? 'win' : 'loss';
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
            const courtId = await resolveCourtId(db, tournamentId, matchId, typeof (existingMatchScoreData === null || existingMatchScoreData === void 0 ? void 0 : existingMatchScoreData.courtId) === 'string' ? existingMatchScoreData.courtId : undefined);
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
        return { success: true };
    }
    catch (error) {
        console.error('❌ [updateMatch] Error updating match:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Failed to update match');
    }
});
//# sourceMappingURL=updateMatch.js.map