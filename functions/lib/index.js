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
exports.healthCheck = exports.onMatchUpdate = exports.advanceWinner = exports.generateSchedule = exports.generateBracket = void 0;
// Cloud Functions Entry Point
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const bracket_1 = require("./bracket");
const scheduling_1 = require("./scheduling");
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
/**
 * Generate bracket for a tournament category
 */
exports.generateBracket = functions.https.onCall(async (data, context) => {
    var _a;
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { tournamentId, categoryId } = data;
    if (!tournamentId || !categoryId) {
        throw new functions.https.HttpsError('invalid-argument', 'tournamentId and categoryId are required');
    }
    // Verify user is admin or organizer
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const userRole = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role;
    if (!['admin', 'organizer'].includes(userRole)) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins and organizers can generate brackets');
    }
    try {
        await (0, bracket_1.generateBracket)(tournamentId, categoryId);
        return { success: true };
    }
    catch (error) {
        console.error('Error generating bracket:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Failed to generate bracket');
    }
});
/**
 * Generate schedule for a tournament
 */
exports.generateSchedule = functions.https.onCall(async (data, context) => {
    var _a;
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { tournamentId } = data;
    if (!tournamentId) {
        throw new functions.https.HttpsError('invalid-argument', 'tournamentId is required');
    }
    // Verify user is admin
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const userRole = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role;
    if (userRole !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can generate schedules');
    }
    try {
        await (0, scheduling_1.generateSchedule)(tournamentId);
        return { success: true };
    }
    catch (error) {
        console.error('Error generating schedule:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Failed to generate schedule');
    }
});
/**
 * Advance winner to next match after match completion
 */
exports.advanceWinner = functions.https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { tournamentId, matchId, winnerId } = data;
    if (!tournamentId || !matchId || !winnerId) {
        throw new functions.https.HttpsError('invalid-argument', 'tournamentId, matchId, and winnerId are required');
    }
    try {
        // Get the completed match
        const matchDoc = await db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('matches')
            .doc(matchId)
            .get();
        if (!matchDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Match not found');
        }
        const match = matchDoc.data();
        // Advance winner to next match
        if ((match === null || match === void 0 ? void 0 : match.nextMatchId) && (match === null || match === void 0 ? void 0 : match.nextMatchSlot)) {
            await db
                .collection('tournaments')
                .doc(tournamentId)
                .collection('matches')
                .doc(match.nextMatchId)
                .update({
                [match.nextMatchSlot + 'Id']: winnerId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        // For double elimination, also handle loser advancement
        if ((match === null || match === void 0 ? void 0 : match.loserNextMatchId) && (match === null || match === void 0 ? void 0 : match.loserNextMatchSlot)) {
            const loserId = match.participant1Id === winnerId
                ? match.participant2Id
                : match.participant1Id;
            await db
                .collection('tournaments')
                .doc(tournamentId)
                .collection('matches')
                .doc(match.loserNextMatchId)
                .update({
                [match.loserNextMatchSlot + 'Id']: loserId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        // Release court
        if (match === null || match === void 0 ? void 0 : match.courtId) {
            await db
                .collection('tournaments')
                .doc(tournamentId)
                .collection('courts')
                .doc(match.courtId)
                .update({
                status: 'available',
                currentMatchId: null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        // Create notification for next match participants
        // (simplified - in production would be more sophisticated)
        return { success: true };
    }
    catch (error) {
        console.error('Error advancing winner:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Failed to advance winner');
    }
});
/**
 * Firestore trigger: Auto-notify when match is ready
 */
exports.onMatchUpdate = functions.firestore
    .document('tournaments/{tournamentId}/matches/{matchId}')
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Check if match became ready (both participants assigned)
    if (after.participant1Id &&
        after.participant2Id &&
        (!before.participant1Id || !before.participant2Id)) {
        // Match is now ready to play
        await change.after.ref.update({
            status: 'ready',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // TODO: Create notifications for participants
    }
});
/**
 * HTTP trigger: Health check
 */
exports.healthCheck = functions.https.onRequest((req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
    });
});
//# sourceMappingURL=index.js.map