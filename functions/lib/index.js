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
exports.healthCheck = exports.advanceWinner = exports.generateSchedule = exports.generateBracket = exports.processScoreEvent = exports.executeMerge = exports.aggregatePlayerStats = exports.applyVolunteerCheckInAction = exports.issueVolunteerSession = exports.revealVolunteerPin = exports.setVolunteerPin = exports.submitSelfCheckIn = exports.searchSelfCheckInCandidates = exports.submitReview = exports.submitBugReport = exports.updateMatch = void 0;
// Cloud Functions Entry Point
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const brackets_manager_1 = require("brackets-manager");
const bracket_1 = require("./bracket");
const scheduling_1 = require("./scheduling");
const updateMatch_1 = require("./updateMatch");
const bugReport_1 = require("./bugReport");
const reviews_1 = require("./reviews");
const selfCheckIn_1 = require("./selfCheckIn");
const volunteerAccess_1 = require("./volunteerAccess");
const firestore_adapter_1 = require("./storage/firestore-adapter");
const playerStats_1 = require("./playerStats");
const playerMerge_1 = require("./playerMerge");
const processScoreEvent_1 = require("./processScoreEvent");
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
exports.updateMatch = updateMatch_1.updateMatch;
exports.submitBugReport = bugReport_1.submitBugReport;
exports.submitReview = reviews_1.submitReview;
exports.searchSelfCheckInCandidates = selfCheckIn_1.searchSelfCheckInCandidates;
exports.submitSelfCheckIn = selfCheckIn_1.submitSelfCheckIn;
exports.setVolunteerPin = volunteerAccess_1.setVolunteerPin;
exports.revealVolunteerPin = volunteerAccess_1.revealVolunteerPin;
exports.issueVolunteerSession = volunteerAccess_1.issueVolunteerSession;
exports.applyVolunteerCheckInAction = volunteerAccess_1.applyVolunteerCheckInAction;
exports.aggregatePlayerStats = playerStats_1.aggregatePlayerStats;
exports.executeMerge = playerMerge_1.executeMerge;
exports.processScoreEvent = processScoreEvent_1.processScoreEvent;
/**
 * Generate bracket for a tournament category
 */
exports.generateBracket = functions.https.onCall(async (request) => {
    var _a;
    // Verify authentication
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { tournamentId, categoryId } = request.data;
    if (!tournamentId || !categoryId) {
        throw new functions.https.HttpsError('invalid-argument', 'tournamentId and categoryId are required');
    }
    // Verify user is admin or organizer
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
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
exports.generateSchedule = functions.https.onCall(async (request) => {
    var _a;
    // Verify authentication
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { tournamentId } = request.data;
    if (!tournamentId) {
        throw new functions.https.HttpsError('invalid-argument', 'tournamentId is required');
    }
    // Verify user is admin
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
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
exports.advanceWinner = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d;
    const { tournamentId, matchId, winnerId } = request.data;
    console.log('advanceWinner called:', { tournamentId, matchId, winnerId });
    try {
        // Initialize brackets-manager with tournament root path
        const manager = new brackets_manager_1.BracketsManager(new firestore_adapter_1.FirestoreStorage(db, `tournaments/${tournamentId}`));
        // Fetch current match to get opponent IDs
        const match = await manager.storage.select('match', matchId);
        if (!match) {
            throw new Error(`Match ${matchId} not found`);
        }
        const opponent1Id = String((_b = (_a = match.opponent1) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : '');
        const opponent2Id = String((_d = (_c = match.opponent2) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : '');
        // Determine winner result
        const isOpponent1Winner = winnerId === opponent1Id;
        const isOpponent2Winner = winnerId === opponent2Id;
        if (!isOpponent1Winner && !isOpponent2Winner) {
            console.warn('Winner ID does not match any opponent', {
                winnerId,
                opponent1Id,
                opponent2Id
            });
        }
        // Update match with winner - brackets-manager handles advancement
        await manager.update.match({
            id: matchId,
            opponent1: {
                result: isOpponent1Winner ? 'win' : 'loss'
            },
            opponent2: {
                result: isOpponent2Winner ? 'win' : 'loss'
            }
        });
        console.log('Match updated successfully, winner advanced');
        return { success: true };
    }
    catch (error) {
        console.error('Error advancing winner:', error);
        const message = error instanceof Error ? error.message : String(error);
        throw new functions.https.HttpsError('internal', `Failed to advance winner: ${message}`);
    }
});
/**
 * Firestore trigger: Auto-notify when match is ready
 *
 * NOTE: Commented out temporarily - uses v1 API syntax incompatible with firebase-functions v7
 * To re-enable, migrate to v2 API: import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
 */
/*
export const onMatchUpdate = functions.firestore
  .document('tournaments/{tournamentId}/matches/{matchId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Check if match became ready (both participants assigned)
    if (
      after.participant1Id &&
      after.participant2Id &&
      (!before.participant1Id || !before.participant2Id)
    ) {
      // Match is now ready to play
      await change.after.ref.update({
        status: 'ready',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // TODO: Create notifications for participants
    }
  });
*/
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