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
exports.executeMerge = void 0;
exports.mergePlayerStats = mergePlayerStats;
exports.buildMergeRegistrationPlan = buildMergeRegistrationPlan;
exports.validateMergePair = validateMergePair;
exports.executeMergeLogic = executeMergeLogic;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const MAX_BATCH_WRITES = 450;
const ZERO_PLAYER_STATS = {
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    tournamentsPlayed: 0,
};
function isStatsBucket(value) {
    if (!value || typeof value !== 'object')
        return false;
    const record = value;
    return (typeof record.wins === 'number' &&
        typeof record.losses === 'number' &&
        typeof record.gamesPlayed === 'number' &&
        typeof record.tournamentsPlayed === 'number');
}
function mergeStatsBucket(target, source) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return {
        wins: ((_a = target === null || target === void 0 ? void 0 : target.wins) !== null && _a !== void 0 ? _a : 0) + ((_b = source === null || source === void 0 ? void 0 : source.wins) !== null && _b !== void 0 ? _b : 0),
        losses: ((_c = target === null || target === void 0 ? void 0 : target.losses) !== null && _c !== void 0 ? _c : 0) + ((_d = source === null || source === void 0 ? void 0 : source.losses) !== null && _d !== void 0 ? _d : 0),
        gamesPlayed: ((_e = target === null || target === void 0 ? void 0 : target.gamesPlayed) !== null && _e !== void 0 ? _e : 0) + ((_f = source === null || source === void 0 ? void 0 : source.gamesPlayed) !== null && _f !== void 0 ? _f : 0),
        tournamentsPlayed: ((_g = target === null || target === void 0 ? void 0 : target.tournamentsPlayed) !== null && _g !== void 0 ? _g : 0) + ((_h = source === null || source === void 0 ? void 0 : source.tournamentsPlayed) !== null && _h !== void 0 ? _h : 0),
    };
}
function mergePlayerStats(targetStats, sourceStats) {
    var _a, _b;
    const merged = {
        overall: mergeStatsBucket(targetStats === null || targetStats === void 0 ? void 0 : targetStats.overall, sourceStats === null || sourceStats === void 0 ? void 0 : sourceStats.overall),
    };
    const sportKeys = new Set([
        ...Object.keys(targetStats !== null && targetStats !== void 0 ? targetStats : {}),
        ...Object.keys(sourceStats !== null && sourceStats !== void 0 ? sourceStats : {}),
    ]);
    sportKeys.delete('overall');
    for (const sportKey of sportKeys) {
        const targetSport = targetStats === null || targetStats === void 0 ? void 0 : targetStats[sportKey];
        const sourceSport = sourceStats === null || sourceStats === void 0 ? void 0 : sourceStats[sportKey];
        if (isStatsBucket(targetSport) || isStatsBucket(sourceSport)) {
            merged[sportKey] = mergeStatsBucket(isStatsBucket(targetSport) ? targetSport : undefined, isStatsBucket(sourceSport) ? sourceSport : undefined);
            continue;
        }
        const categoryKeys = new Set([
            ...Object.keys((_a = targetSport) !== null && _a !== void 0 ? _a : {}),
            ...Object.keys((_b = sourceSport) !== null && _b !== void 0 ? _b : {}),
        ]);
        const categoryStats = {};
        for (const categoryKey of categoryKeys) {
            const targetCategory = targetSport === null || targetSport === void 0 ? void 0 : targetSport[categoryKey];
            const sourceCategory = sourceSport === null || sourceSport === void 0 ? void 0 : sourceSport[categoryKey];
            categoryStats[categoryKey] = mergeStatsBucket(targetCategory, sourceCategory);
        }
        merged[sportKey] = categoryStats;
    }
    return merged;
}
function buildMergeRegistrationPlan(primaryRegistrations, partnerRegistrations, sourcePlayerId, targetPlayerId) {
    const updates = new Map();
    let primaryRegistrationCount = 0;
    let partnerRegistrationCount = 0;
    const queueUpdate = (registrationId, field) => {
        const existing = updates.get(registrationId);
        const mergedUpdate = existing ? { ...existing.updates } : {};
        if (field === 'playerId' && mergedUpdate.playerId !== targetPlayerId) {
            mergedUpdate.playerId = targetPlayerId;
            primaryRegistrationCount += 1;
        }
        if (field === 'partnerPlayerId' && mergedUpdate.partnerPlayerId !== targetPlayerId) {
            mergedUpdate.partnerPlayerId = targetPlayerId;
            partnerRegistrationCount += 1;
        }
        updates.set(registrationId, {
            registrationId,
            updates: mergedUpdate,
        });
    };
    for (const registration of primaryRegistrations) {
        if (registration.playerId === sourcePlayerId) {
            queueUpdate(registration.id, 'playerId');
        }
    }
    for (const registration of partnerRegistrations) {
        if (registration.partnerPlayerId === sourcePlayerId) {
            queueUpdate(registration.id, 'partnerPlayerId');
        }
    }
    return {
        updates: Array.from(updates.values()),
        primaryRegistrationCount,
        partnerRegistrationCount,
        repointedRegistrationCount: primaryRegistrationCount + partnerRegistrationCount,
    };
}
function validateMergePair(sourcePlayerId, targetPlayerId) {
    if (!sourcePlayerId || !targetPlayerId) {
        throw new Error('sourcePlayerId and targetPlayerId are required');
    }
    if (sourcePlayerId === targetPlayerId) {
        throw new Error('Cannot merge player with itself');
    }
}
function normalizePlayerRecord(id, raw) {
    var _a;
    return {
        id,
        identityStatus: typeof raw.identityStatus === 'string' ? raw.identityStatus : 'active',
        isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
        stats: (_a = raw.stats) !== null && _a !== void 0 ? _a : {
            overall: ZERO_PLAYER_STATS,
        },
    };
}
function normalizeRegistrationRecord(id, raw, path) {
    return {
        id,
        ref: { id, path },
        playerId: typeof raw.playerId === 'string' ? raw.playerId : null,
        partnerPlayerId: typeof raw.partnerPlayerId === 'string' ? raw.partnerPlayerId : null,
    };
}
function createFirestoreMergeDb(firestore) {
    const toBatch = (batch) => ({
        update(ref, data) {
            batch.update(firestore.doc(ref.path), data);
        },
        async commit() {
            await batch.commit();
        },
    });
    return {
        async getPlayer(playerId) {
            const snap = await firestore.collection('players').doc(playerId).get();
            if (!snap.exists)
                return null;
            return normalizePlayerRecord(snap.id, snap.data());
        },
        async findRegistrationsByPlayerId(playerId) {
            const snap = await firestore
                .collectionGroup('registrations')
                .where('playerId', '==', playerId)
                .get();
            return snap.docs.map((doc) => normalizeRegistrationRecord(doc.id, doc.data(), doc.ref.path));
        },
        async findRegistrationsByPartnerPlayerId(playerId) {
            const snap = await firestore
                .collectionGroup('registrations')
                .where('partnerPlayerId', '==', playerId)
                .get();
            return snap.docs.map((doc) => normalizeRegistrationRecord(doc.id, doc.data(), doc.ref.path));
        },
        createBatch() {
            return toBatch(firestore.batch());
        },
    };
}
async function executeMergeLogic(input, db) {
    validateMergePair(input.sourcePlayerId, input.targetPlayerId);
    const sourcePlayer = await db.getPlayer(input.sourcePlayerId);
    if (!sourcePlayer) {
        throw new Error(`Source player ${input.sourcePlayerId} not found`);
    }
    const targetPlayer = await db.getPlayer(input.targetPlayerId);
    if (!targetPlayer) {
        throw new Error(`Target player ${input.targetPlayerId} not found`);
    }
    if (sourcePlayer.identityStatus === 'merged') {
        throw new Error('Source player is already merged');
    }
    if (sourcePlayer.isActive === false) {
        throw new Error('Source player is not active');
    }
    if (targetPlayer.identityStatus === 'merged') {
        throw new Error('Target player is already merged');
    }
    if (targetPlayer.isActive === false) {
        throw new Error('Target player is not active');
    }
    const [primaryRegistrations, partnerRegistrations] = await Promise.all([
        db.findRegistrationsByPlayerId(input.sourcePlayerId),
        db.findRegistrationsByPartnerPlayerId(input.sourcePlayerId),
    ]);
    const plan = buildMergeRegistrationPlan(primaryRegistrations, partnerRegistrations, input.sourcePlayerId, input.targetPlayerId);
    const registrationsToValidate = [...primaryRegistrations, ...partnerRegistrations];
    const hasSharedRegistration = registrationsToValidate.some((registration) => ((registration.playerId === input.sourcePlayerId
        && registration.partnerPlayerId === input.targetPlayerId)
        || (registration.playerId === input.targetPlayerId
            && registration.partnerPlayerId === input.sourcePlayerId)));
    if (hasSharedRegistration) {
        throw new Error('Cannot merge players who are paired in the same registration');
    }
    const registrationById = new Map();
    for (const registration of [...primaryRegistrations, ...partnerRegistrations]) {
        registrationById.set(registration.id, registration);
    }
    let batch = db.createBatch();
    let writesInBatch = 0;
    const queueUpdate = async (ref, data) => {
        batch.update(ref, data);
        writesInBatch += 1;
        if (writesInBatch >= MAX_BATCH_WRITES) {
            await batch.commit();
            batch = db.createBatch();
            writesInBatch = 0;
        }
    };
    for (const update of plan.updates) {
        const registration = registrationById.get(update.registrationId);
        if (!registration)
            continue;
        await queueUpdate(registration.ref, update.updates);
    }
    const mergedStats = mergePlayerStats(targetPlayer.stats, sourcePlayer.stats);
    await queueUpdate({ id: targetPlayer.id, path: `players/${targetPlayer.id}` }, {
        stats: mergedStats,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await queueUpdate({ id: sourcePlayer.id, path: `players/${sourcePlayer.id}` }, {
        identityStatus: 'merged',
        mergedIntoPlayerId: targetPlayer.id,
        isActive: false,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    if (writesInBatch > 0) {
        await batch.commit();
    }
    return {
        sourcePlayerId: input.sourcePlayerId,
        targetPlayerId: input.targetPlayerId,
        primaryRegistrationCount: plan.primaryRegistrationCount,
        partnerRegistrationCount: plan.partnerRegistrationCount,
        repointedRegistrationCount: plan.repointedRegistrationCount,
    };
}
async function readMergeRequestStatus(firestore, mergeRequestId) {
    const snap = await firestore.collection('mergeRequests').doc(mergeRequestId).get();
    if (!snap.exists)
        return null;
    return snap.data();
}
exports.executeMerge = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const sourcePlayerId = String((_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.sourcePlayerId) !== null && _b !== void 0 ? _b : '').trim();
    const targetPlayerId = String((_d = (_c = request.data) === null || _c === void 0 ? void 0 : _c.targetPlayerId) !== null && _d !== void 0 ? _d : '').trim();
    const mergeRequestId = String((_f = (_e = request.data) === null || _e === void 0 ? void 0 : _e.mergeRequestId) !== null && _f !== void 0 ? _f : '').trim() || null;
    try {
        validateMergePair(sourcePlayerId, targetPlayerId);
    }
    catch (error) {
        throw new functions.https.HttpsError('invalid-argument', error instanceof Error ? error.message : 'Invalid merge request');
    }
    const firestore = admin.firestore();
    const userSnap = await firestore.collection('users').doc(request.auth.uid).get();
    const userRole = (_g = userSnap.data()) === null || _g === void 0 ? void 0 : _g.role;
    if (!['admin', 'organizer'].includes(userRole)) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins and organizers can merge players');
    }
    if (mergeRequestId) {
        const mergeRequest = await readMergeRequestStatus(firestore, mergeRequestId);
        if (!mergeRequest) {
            throw new functions.https.HttpsError('not-found', 'Merge request not found');
        }
        if (mergeRequest.status !== 'approved') {
            throw new functions.https.HttpsError('failed-precondition', 'Merge request must be approved before execution');
        }
        if ((mergeRequest.sourcePlayerId && mergeRequest.sourcePlayerId !== sourcePlayerId)
            || (mergeRequest.targetPlayerId && mergeRequest.targetPlayerId !== targetPlayerId)) {
            throw new functions.https.HttpsError('failed-precondition', 'Merge request players do not match the requested merge pair');
        }
    }
    try {
        const result = await executeMergeLogic({
            sourcePlayerId,
            targetPlayerId,
            requestedBy: request.auth.uid,
        }, createFirestoreMergeDb(firestore));
        if (mergeRequestId) {
            await firestore.collection('mergeRequests').doc(mergeRequestId).update({
                status: 'completed',
                completedAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        return {
            success: true,
            ...result,
        };
    }
    catch (error) {
        console.error('Error executing player merge:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'Failed to merge players');
    }
});
//# sourceMappingURL=playerMerge.js.map