"use strict";
/**
 * Server-side bracket generation operations.
 * All 4 operations mirror the client-side useBracketGenerator.ts composable.
 * Uses FirestoreStorage (admin SDK) instead of ClientFirestoreStorage (client SDK).
 */
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
exports.createBracket = createBracket;
exports.createEliminationFromPool = createEliminationFromPool;
exports.createLevelBracket = createLevelBracket;
exports.deleteBracket = deleteBracket;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const brackets_manager_1 = require("brackets-manager");
const firestore_adapter_1 = require("./storage/firestore-adapter");
const bracketHelpers_1 = require("./bracketHelpers");
function getDb() {
    return admin.firestore();
}
function getStorage(rootPath) {
    return new firestore_adapter_1.FirestoreStorage(getDb(), rootPath);
}
function getManager(rootPath) {
    return new brackets_manager_1.BracketsManager(getStorage(rootPath));
}
// ============================================
// 1. createBracket — standard + pool phase generation
// ============================================
async function createBracket(tournamentId, categoryId, options = {}) {
    var _a, _b, _c, _d, _e;
    const db = getDb();
    // 1. Get category details
    const categoryDoc = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('categories')
        .doc(categoryId)
        .get();
    if (!categoryDoc.exists)
        throw new Error('Category not found');
    const category = { id: categoryDoc.id, ...categoryDoc.data() };
    // 2. Get approved/checked_in registrations
    const registrationsSnap = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('registrations')
        .where('categoryId', '==', categoryId)
        .where('status', 'in', ['approved', 'checked_in'])
        .get();
    const registrations = registrationsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    }));
    if (registrations.length < 2) {
        throw new Error('Need at least 2 participants to generate bracket');
    }
    // 3. Sort by seed; apply pool seeding method if applicable
    const baseSorted = (0, bracketHelpers_1.sortRegistrationsBySeed)(registrations);
    let finalOrdered = baseSorted;
    let poolSeedOverride;
    if (category.format === 'pool_to_elimination') {
        const teamsPerPool = (_b = (_a = category.teamsPerPool) !== null && _a !== void 0 ? _a : options.teamsPerPool) !== null && _b !== void 0 ? _b : 4;
        const numPools = (0, bracketHelpers_1.calculatePoolGroupCount)(registrations.length, teamsPerPool);
        const method = (_d = (_c = category.poolSeedingMethod) !== null && _c !== void 0 ? _c : options.poolSeedingMethod) !== null && _d !== void 0 ? _d : 'serpentine';
        const { ordered, seedOrdering } = (0, bracketHelpers_1.orderRegistrationsForPool)(baseSorted, method, numPools);
        finalOrdered = ordered;
        poolSeedOverride = seedOrdering;
    }
    // 4. Create storage scoped to category
    const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
    const storage = getStorage(categoryPath);
    const manager = getManager(categoryPath);
    // 5. Insert participants (name = registrationId, tournament_id = categoryId)
    const participantsData = finalOrdered.map((reg, index) => ({
        id: index + 1,
        tournament_id: categoryId,
        name: reg.id,
    }));
    await storage.insert('participant', participantsData);
    // 6. Generate stage
    let result;
    if (category.format === 'pool_to_elimination') {
        result = await (0, bracketHelpers_1.createPoolStage)(category, manager, storage, participantsData.length, poolSeedOverride ? { ...options, seedOrdering: poolSeedOverride } : options);
        await db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('categories')
            .doc(categoryId)
            .set({
            status: 'active',
            stageId: result.stageId,
            poolStageId: result.stageId,
            eliminationStageId: null,
            poolPhase: 'pool',
            poolGroupCount: result.groupCount,
            poolQualifiersPerGroup: (_e = options.qualifiersPerGroup) !== null && _e !== void 0 ? _e : 2,
            bracketGeneratedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        await (0, bracketHelpers_1.initializeByeWalkovers)(db, tournamentId, categoryId, storage, result.stageId, participantsData);
    }
    else {
        result = await (0, bracketHelpers_1.createStandardStage)(category, manager, storage, participantsData.length, options);
        await db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('categories')
            .doc(categoryId)
            .set({
            status: 'active',
            stageId: result.stageId,
            poolStageId: null,
            eliminationStageId: null,
            poolPhase: null,
            poolGroupCount: null,
            poolQualifiersPerGroup: null,
            poolQualifiedRegistrationIds: [],
            bracketGeneratedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    return result;
}
// ============================================
// 2. createEliminationFromPool — advance pool → elimination
// ============================================
async function createEliminationFromPool(tournamentId, categoryId, options = {}) {
    var _a, _b;
    const db = getDb();
    const categoryDoc = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('categories')
        .doc(categoryId)
        .get();
    if (!categoryDoc.exists)
        throw new Error('Category not found');
    const category = { id: categoryDoc.id, ...categoryDoc.data() };
    if (category.format !== 'pool_to_elimination') {
        throw new Error('Category is not configured for pool-to-elimination');
    }
    const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
    const storage = getStorage(categoryPath);
    const manager = getManager(categoryPath);
    const stages = (0, bracketHelpers_1.asArray)(await storage.select('stage'));
    const poolStage = (0, bracketHelpers_1.resolvePoolStage)(stages, category.poolStageId);
    if (!poolStage)
        throw new Error('Pool stage not found. Generate pool play first.');
    const poolStageId = poolStage.id;
    const participants = (0, bracketHelpers_1.asArray)(await storage.select('participant'));
    const poolMatches = (0, bracketHelpers_1.asArray)(await storage.select('match', { stage_id: poolStageId }));
    if (participants.length < 2)
        throw new Error('Need at least 2 participants to generate elimination');
    if (poolMatches.length === 0)
        throw new Error('No pool matches found. Generate pool play first.');
    // Fetch match_scores to verify completion
    const matchScoresSnap = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('categories')
        .doc(categoryId)
        .collection('match_scores')
        .get();
    const matchScoresMap = new Map(matchScoresSnap.docs.map((d) => [d.id, { ...d.data(), id: d.id }]));
    const pendingPoolMatches = poolMatches.filter((match) => {
        const score = matchScoresMap.get(String(match.id));
        return !(0, bracketHelpers_1.isCompletedMatch)(match, score);
    });
    if (pendingPoolMatches.length > 0) {
        throw new Error(`Pool stage not complete. ${pendingPoolMatches.length} match(es) still pending.`);
    }
    if (!((_a = options.precomputedQualifierRegistrationIds) === null || _a === void 0 ? void 0 : _a.length)) {
        throw new Error('Pool qualifier order is required to generate elimination stage.');
    }
    const participantByRegistrationId = new Map(participants.map((participant) => [participant.name, participant.id]));
    const qualifierParticipantIds = options.precomputedQualifierRegistrationIds
        .map((registrationId) => participantByRegistrationId.get(registrationId))
        .filter((participantId) => participantId !== undefined);
    const qualifierRegistrationIds = options.precomputedQualifierRegistrationIds;
    const resolvedGroupCount = 0;
    const resolvedQualifiersPerGroup = 0;
    if (qualifierParticipantIds.length < 2) {
        throw new Error('Not enough qualifiers to generate elimination stage.');
    }
    // Server uses auto-generated string IDs — no seedCountersFromExisting needed
    const bracketType = (_b = options.eliminationFormat) !== null && _b !== void 0 ? _b : 'single_elimination';
    const eliminationSeeding = (0, bracketHelpers_1.createSeedingFromParticipantIds)(qualifierParticipantIds);
    const result = await (0, bracketHelpers_1.createStageWithStats)(manager, storage, categoryId, `${category.name} - Elimination`, bracketType, eliminationSeeding, {
        seedOrdering: options.seedOrdering || ['inner_outer'],
        consolationFinal: options.consolationFinal,
    });
    await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('categories')
        .doc(categoryId)
        .set({
        status: 'active',
        stageId: result.stageId,
        eliminationStageId: result.stageId,
        poolPhase: 'elimination',
        poolGroupCount: resolvedGroupCount,
        poolQualifiersPerGroup: resolvedQualifiersPerGroup,
        poolQualifiedRegistrationIds: qualifierRegistrationIds,
        bracketGeneratedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    return result;
}
// ============================================
// 3. createLevelBracket — level-scoped bracket
// ============================================
async function createLevelBracket(tournamentId, categoryId, levelId, levelName, orderedRegistrationIds, eliminationFormat, options = {}) {
    if (orderedRegistrationIds.length < 2) {
        throw new Error('Need at least 2 participants to generate level bracket');
    }
    const db = getDb();
    const levelPath = `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}`;
    const storage = getStorage(levelPath);
    const manager = getManager(levelPath);
    await (0, bracketHelpers_1.clearBracketStorage)(storage);
    const participantsData = orderedRegistrationIds.map((registrationId, index) => ({
        id: index + 1,
        tournament_id: `${categoryId}:${levelId}`,
        name: registrationId,
    }));
    await storage.insert('participant', participantsData);
    const maxBracketSize = eliminationFormat === 'playoff_8' ? 8 : undefined;
    const seeding = (0, bracketHelpers_1.createSeedingArrayWithExistingOrder)(participantsData.map((p) => p.id), maxBracketSize);
    const stageType = eliminationFormat === 'double_elimination' ? 'double_elimination' : 'single_elimination';
    const result = await (0, bracketHelpers_1.createStageWithStats)(manager, storage, `${categoryId}:${levelId}`, levelName, stageType, seeding, {
        seedOrdering: options.seedOrdering || ['inner_outer'],
        grandFinal: stageType === 'double_elimination' ? options.grandFinal || 'double' : undefined,
        consolationFinal: options.consolationFinal,
    });
    const registrationIdByParticipantId = new Map(participantsData.map((p) => [String(p.id), p.name]));
    await (0, bracketHelpers_1.initializeLevelMatchScores)(db, tournamentId, categoryId, levelId, storage, result.stageId, registrationIdByParticipantId);
    return result;
}
// ============================================
// 4. deleteBracket — full cleanup
// ============================================
async function deleteBracket(tournamentId, categoryId) {
    const db = getDb();
    const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
    const storage = getStorage(categoryPath);
    const stages = (0, bracketHelpers_1.asArray)(await storage.select('stage'));
    if (stages.length > 0) {
        for (const stage of stages) {
            const stageId = stage.id;
            const stageMatches = (0, bracketHelpers_1.asArray)(await storage.select('match', { stage_id: stageId }));
            if (stageMatches.length > 0) {
                await (0, bracketHelpers_1.deleteMatchScoresByIds)(db, tournamentId, categoryId, stageMatches.map((m) => String(m.id)));
            }
            await storage.delete('match', { stage_id: stageId });
            await storage.delete('match_game', { stage_id: stageId });
            await storage.delete('round', { stage_id: stageId });
            await storage.delete('group', { stage_id: stageId });
            await storage.delete('stage', stageId);
        }
    }
    await storage.delete('participant', { tournament_id: categoryId });
    await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('categories')
        .doc(categoryId)
        .set({
        status: 'setup',
        stageId: null,
        poolStageId: null,
        eliminationStageId: null,
        poolPhase: null,
        poolGroupCount: null,
        poolQualifiersPerGroup: null,
        poolQualifiedRegistrationIds: [],
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
}
//# sourceMappingURL=bracket.js.map