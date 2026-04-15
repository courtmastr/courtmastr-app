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
exports.resetDailyCheckIns = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const dailyCheckIn_1 = require("./dailyCheckIn");
const BATCH_SIZE = 500;
const CHUNK_SIZE = 30; // Firestore 'in' query max
const getDb = () => admin.firestore();
exports.resetDailyCheckIns = (0, scheduler_1.onSchedule)('every day 06:00', async () => {
    var _a, _b;
    const db = getDb();
    const now = new Date();
    // 1. Query all non-completed tournaments
    const tournamentsSnapshot = await db
        .collection('tournaments')
        .where('status', '!=', 'completed')
        .get();
    if (tournamentsSnapshot.empty)
        return;
    // 2. For each tournament, find registrations to reset
    const resetUpdates = [];
    for (const tournamentDoc of tournamentsSnapshot.docs) {
        const tournament = tournamentDoc.data();
        const timezone = tournament.timezone || 'America/Chicago';
        const { windowStart, windowEnd } = (0, dailyCheckIn_1.getTodayWindowUTC)(now, timezone);
        // 3. Fetch all matches for this tournament
        const matchesSnapshot = await db
            .collection('tournaments')
            .doc(tournamentDoc.id)
            .collection('matches')
            .get();
        // 4. Collect registration IDs with matches in today's window
        const registrationIdsToCheck = new Set();
        for (const matchDoc of matchesSnapshot.docs) {
            const match = matchDoc.data();
            const plannedStartAt = (_b = (_a = match.plannedStartAt) === null || _a === void 0 ? void 0 : _a.toDate()) !== null && _b !== void 0 ? _b : null;
            if (!plannedStartAt)
                continue;
            if (plannedStartAt >= windowStart && plannedStartAt < windowEnd) {
                if (match.participant1Id)
                    registrationIdsToCheck.add(match.participant1Id);
                if (match.participant2Id)
                    registrationIdsToCheck.add(match.participant2Id);
            }
        }
        if (registrationIdsToCheck.size === 0)
            continue;
        // 5. Fetch those registrations to check their status
        const registrationIds = [...registrationIdsToCheck];
        // Firestore 'in' query supports max 30 items — chunk if needed
        for (let i = 0; i < registrationIds.length; i += CHUNK_SIZE) {
            const chunk = registrationIds.slice(i, i + CHUNK_SIZE);
            const registrationsSnapshot = await db
                .collection('tournaments')
                .doc(tournamentDoc.id)
                .collection('registrations')
                .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
                .get();
            for (const regDoc of registrationsSnapshot.docs) {
                const reg = regDoc.data();
                if (reg.status === 'checked_in' || reg.status === 'no_show') {
                    resetUpdates.push(regDoc.ref);
                }
            }
        }
    }
    if (resetUpdates.length === 0) {
        console.log('resetDailyCheckIns: no registrations to reset');
        return;
    }
    // 6. Batch-write resets (max 500 per batch)
    for (let i = 0; i < resetUpdates.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const chunk = resetUpdates.slice(i, i + BATCH_SIZE);
        for (const ref of chunk) {
            batch.update(ref, {
                status: 'approved',
                isCheckedIn: false,
                checkedInAt: firestore_1.FieldValue.delete(),
                checkInSource: firestore_1.FieldValue.delete(),
                participantPresence: {},
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();
    }
    console.log(`resetDailyCheckIns: reset ${resetUpdates.length} registrations`);
});
//# sourceMappingURL=resetDailyCheckIns.js.map