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
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const db = admin.firestore();
    // Verify authentication
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { tournamentId, matchId, status, winnerId, scores } = request.data;
    console.log('🎯 [updateMatch] Called with:', {
        tournamentId,
        matchId,
        status,
        winnerId,
        scoresLength: scores === null || scores === void 0 ? void 0 : scores.length,
    });
    if (!tournamentId || !matchId || status === undefined) {
        throw new functions.https.HttpsError('invalid-argument', 'tournamentId, matchId, and status are required');
    }
    try {
        // 1. Update match_scores collection (our custom storage for detailed scores)
        if (scores) {
            console.log('📝 [updateMatch] Updating match_scores with scores:', scores);
            await db
                .collection('tournaments')
                .doc(tournamentId)
                .collection('match_scores')
                .doc(matchId)
                .set({ scores, updatedAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
            console.log('✅ [updateMatch] match_scores updated successfully');
        }
        // 2. Update brackets-manager match status/result
        // Use the tournament document as the root (even components)
        // Sub-collections will be created under it: tournaments/T1/participant, tournaments/T1/match, etc.
        const rootPath = `tournaments/${tournamentId}`;
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
            console.log('🏆 [updateMatch] Match completed with winnerId:', winnerId);
            // Need to find which opponent won
            // We need to fetch the match first to know which opponent ID matches the winner ID
            // Note: brackets-manager update.match expects `opponent1: { result: 'win' }` etc.
            console.log('🔍 [updateMatch] Fetching match data for matchId:', matchId);
            const matchData = await manager.storage.select('match', matchId);
            console.log('📋 [updateMatch] Match data retrieved:', {
                matchId: matchData === null || matchData === void 0 ? void 0 : matchData.id,
                opponent1Id: (_a = matchData === null || matchData === void 0 ? void 0 : matchData.opponent1) === null || _a === void 0 ? void 0 : _a.id,
                opponent2Id: (_b = matchData === null || matchData === void 0 ? void 0 : matchData.opponent2) === null || _b === void 0 ? void 0 : _b.id,
            });
            if (!matchData)
                throw new Error('Match not found');
            // Check opponents - use string comparison to handle type differences
            // opponent1.id might be null if it was a bye? No, played match has players.
            const opponent1Id = String((_d = (_c = matchData.opponent1) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : '');
            const opponent2Id = String((_f = (_e = matchData.opponent2) === null || _e === void 0 ? void 0 : _e.id) !== null && _f !== void 0 ? _f : '');
            const winnerIdStr = String(winnerId);
            if (opponent1Id === winnerIdStr) {
                console.log('✅ [updateMatch] Winner is opponent1');
                updateData.opponent1 = { ...matchData.opponent1, result: 'win' };
                updateData.opponent2 = { ...matchData.opponent2, result: 'loss' };
            }
            else if (opponent2Id === winnerIdStr) {
                console.log('✅ [updateMatch] Winner is opponent2');
                updateData.opponent1 = { ...matchData.opponent1, result: 'loss' };
                updateData.opponent2 = { ...matchData.opponent2, result: 'win' };
            }
            else {
                // Fallback: registration ID logic? 
                // In our adapter we assumed participant ID matched registration name (which is what we use as ID).
                // brackets-manager participant ID is usually just a number/string ID.
                // But in `bracket.ts` we used `reg.id` as the seeding ID.
                // And `reg.id` IS the registration ID in our system.
                // So `matchData.opponent1.id` should be the registration ID.
                console.warn(`⚠️  [updateMatch] Winner ID ${winnerId} does not match opponent1 (${(_g = matchData.opponent1) === null || _g === void 0 ? void 0 : _g.id}) or opponent2 (${(_h = matchData.opponent2) === null || _h === void 0 ? void 0 : _h.id})`);
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