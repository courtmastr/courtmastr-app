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
// const db = admin.firestore(); // Moved inside function to avoid init order issues
/**
 * Update match score and advance bracket if match is complete
 */
exports.updateMatch = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d;
    const db = admin.firestore();
    // Verify authentication
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { tournamentId, categoryId, matchId, status, winnerId, scores } = request.data;
    console.log('🎯 [updateMatch] Called with:', {
        tournamentId,
        categoryId,
        matchId,
        status,
        winnerId,
        scoresLength: scores === null || scores === void 0 ? void 0 : scores.length,
    });
    if (!tournamentId || !matchId || status === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'tournamentId, matchId, and status are required');
    }
    if (!categoryId) {
        throw new functions.https.HttpsError('invalid-argument', 'categoryId is required for match updates');
    }
    try {
        // 1. Update match_scores collection (our custom storage for detailed scores)
        if (scores) {
            console.log('📝 [updateMatch] Updating match_scores with scores:', scores);
            await db
                .collection('tournaments')
                .doc(tournamentId)
                .collection('categories')
                .doc(categoryId)
                .collection('match_scores')
                .doc(matchId)
                .set({ scores, updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
            console.log('✅ [updateMatch] match_scores updated successfully');
        }
        // 2. Update brackets-manager match status/result
        // Use the category document as the root with full path including categories
        // Sub-collections will be created under it: tournaments/T1/categories/C1/participant, .../match, etc.
        const rootPath = `tournaments/${tournamentId}/categories/${categoryId}`;
        console.log('🔧 [updateMatch] Creating BracketsManager with rootPath:', rootPath);
        const manager = new brackets_manager_1.BracketsManager(new firestore_adapter_1.FirestoreStorage(db, rootPath));
        // STATUS MAPPING: Convert app string status to brackets-manager numeric status
        // /match_scores.status (string) -> /match.status (number)
        // "completed" -> 4, "in_progress" -> 3, "ready"/"scheduled" -> 2
        const bmStatus = status === 'completed' ? 4 : (status === 'in_progress' ? 3 : 2);
        console.log('📊 [updateMatch] Mapped status:', { clientStatus: status, bmStatus });
        const updateData = {
            id: matchId,
            status: bmStatus,
        };
        if (status === 'completed' && winnerId) {
            console.log('🏆 [updateMatch] Match completed with winnerId (registration ID):', winnerId);
            // winnerId is a registration ID, but brackets-manager uses numeric participant IDs
            // We need to map the registration ID to the bracket participant numeric ID
            // 1. Fetch match data
            console.log('🔍 [updateMatch] Fetching match data for matchId:', matchId);
            const matchData = await manager.storage.select('match', matchId);
            console.log('📋 [updateMatch] Match data retrieved:', {
                matchId: matchData === null || matchData === void 0 ? void 0 : matchData.id,
                opponent1Id: (_a = matchData === null || matchData === void 0 ? void 0 : matchData.opponent1) === null || _a === void 0 ? void 0 : _a.id,
                opponent2Id: (_b = matchData === null || matchData === void 0 ? void 0 : matchData.opponent2) === null || _b === void 0 ? void 0 : _b.id,
            });
            if (!matchData)
                throw new Error('Match not found');
            // 2. Fetch participants to map registration ID to numeric ID
            console.log('👥 [updateMatch] Fetching participants to map registration ID');
            const participants = await manager.storage.select('participant');
            console.log('📋 [updateMatch] Participants fetched:', participants === null || participants === void 0 ? void 0 : participants.length);
            // Find participant by registration ID (stored in participant.name field)
            // participant.name = registration ID (Firestore document ID)
            // participant.id = numeric brackets-manager ID
            const winnerParticipant = participants === null || participants === void 0 ? void 0 : participants.find((p) => p.name === winnerId);
            if (!winnerParticipant) {
                console.warn(`⚠️  [updateMatch] No participant found with name=${winnerId}`);
                throw new Error(`Winner participant not found for registration ID: ${winnerId}`);
            }
            const bracketWinnerId = winnerParticipant.id;
            console.log('🎯 [updateMatch] Mapped registration ID to bracket participant ID:', {
                registrationId: winnerId,
                bracketParticipantId: bracketWinnerId
            });
            // 3. Check which opponent won and update accordingly
            const opponent1Id = (_c = matchData.opponent1) === null || _c === void 0 ? void 0 : _c.id;
            const opponent2Id = (_d = matchData.opponent2) === null || _d === void 0 ? void 0 : _d.id;
            // Use loose equality to handle string/number type differences
            if (opponent1Id == bracketWinnerId) {
                console.log('✅ [updateMatch] Winner is opponent1');
                updateData.opponent1 = { ...matchData.opponent1, result: 'win' };
                updateData.opponent2 = { ...matchData.opponent2, result: 'loss' };
            }
            else if (opponent2Id == bracketWinnerId) {
                console.log('✅ [updateMatch] Winner is opponent2');
                updateData.opponent1 = { ...matchData.opponent1, result: 'loss' };
                updateData.opponent2 = { ...matchData.opponent2, result: 'win' };
            }
            else {
                console.warn(`⚠️  [updateMatch] Bracket winner ID ${bracketWinnerId} does not match opponent1 (${opponent1Id}) or opponent2 (${opponent2Id})`);
                throw new Error(`Winner participant ID ${bracketWinnerId} does not match either opponent in match ${matchId}`);
            }
        }
        console.log('🚀 [updateMatch] Calling manager.update.match with updateData:', updateData);
        await manager.update.match(updateData);
        console.log('✅ [updateMatch] manager.update.match completed successfully');
        return { success: true };
    }
    catch (error) {
        console.error('❌ [updateMatch] Error updating match:', error);
        if (error instanceof Error) {
            console.error('   Stack trace:', error.stack);
        }
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Failed to update match');
    }
});
//# sourceMappingURL=updateMatch.js.map