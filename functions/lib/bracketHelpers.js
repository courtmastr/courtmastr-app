"use strict";
/**
 * Server-side bracket generation helpers.
 * Ported from src/composables/useBracketGenerator.ts
 * Uses firebase-admin SDK instead of firebase client SDK.
 * No Vue reactivity, no seedCountersFromExisting (server uses auto-string IDs — no collisions).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortRegistrationsBySeed = sortRegistrationsBySeed;
exports.orderRegistrationsForPool = orderRegistrationsForPool;
exports.createSeedingArray = createSeedingArray;
exports.createSequentialSeeding = createSequentialSeeding;
exports.toNumberId = toNumberId;
exports.asArray = asArray;
exports.calculatePoolGroupCount = calculatePoolGroupCount;
exports.resolvePoolStage = resolvePoolStage;
exports.isCompletedMatch = isCompletedMatch;
exports.createSeedingFromParticipantIds = createSeedingFromParticipantIds;
exports.createSeedingArrayWithExistingOrder = createSeedingArrayWithExistingOrder;
exports.createStageWithStats = createStageWithStats;
exports.createStandardStage = createStandardStage;
exports.createPoolStage = createPoolStage;
exports.initializeByeWalkovers = initializeByeWalkovers;
exports.initializeLevelMatchScores = initializeLevelMatchScores;
exports.deleteMatchScoresByIds = deleteMatchScoresByIds;
exports.clearBracketStorage = clearBracketStorage;
const firestore_1 = require("firebase-admin/firestore");
// ============================================
// Pure helper functions
// ============================================
function sortRegistrationsBySeed(registrations) {
    const seeded = registrations
        .filter((r) => r.seed !== undefined && r.seed !== null)
        .sort((a, b) => (a.seed || 0) - (b.seed || 0));
    const unseeded = registrations
        .filter((r) => r.seed === undefined || r.seed === null)
        .sort(() => Math.random() - 0.5);
    return [...seeded, ...unseeded];
}
function fisherYatesShuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
function orderRegistrationsForPool(sortedByRank, method, numPools) {
    if (method === 'fully_random') {
        return {
            ordered: fisherYatesShuffle(sortedByRank),
            seedOrdering: ['groups.effort_balanced'],
        };
    }
    if (method === 'random_in_tiers') {
        const tiered = [];
        for (let i = 0; i < sortedByRank.length; i += numPools) {
            const tier = sortedByRank.slice(i, i + numPools);
            tiered.push(...fisherYatesShuffle(tier));
        }
        return { ordered: tiered, seedOrdering: ['groups.effort_balanced'] };
    }
    // serpentine
    return { ordered: sortedByRank, seedOrdering: ['groups.effort_balanced'] };
}
function createSeedingArray(participantCount) {
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(participantCount, 2))));
    const seeding = [];
    for (let i = 0; i < participantCount; i++) {
        seeding.push(i + 1);
    }
    while (seeding.length < bracketSize) {
        seeding.push(null);
    }
    return seeding;
}
function createSequentialSeeding(participantCount) {
    return Array.from({ length: participantCount }, (_, index) => index + 1);
}
function toNumberId(value) {
    if (value === null || value === undefined)
        return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
function asArray(value) {
    if (Array.isArray(value))
        return value;
    if (value === null)
        return [];
    return [value];
}
function calculatePoolGroupCount(participantCount, teamsPerPool) {
    const size = teamsPerPool && teamsPerPool >= 2 ? Math.floor(teamsPerPool) : 4;
    return Math.max(1, Math.ceil(participantCount / size));
}
function getRoundRobinSeedOrdering(seedOrdering) {
    if (!seedOrdering || seedOrdering.length === 0) {
        return ['groups.effort_balanced'];
    }
    const groupSeedOrdering = seedOrdering.filter((ordering) => ordering.startsWith('groups.'));
    return groupSeedOrdering.length > 0 ? groupSeedOrdering : ['groups.effort_balanced'];
}
function resolvePoolStage(stages, poolStageId) {
    if (poolStageId !== undefined && poolStageId !== null) {
        const exactMatch = stages.find((stage) => toNumberId(stage.id) === poolStageId);
        if (exactMatch)
            return exactMatch;
    }
    const roundRobinStages = stages.filter((stage) => stage.type === 'round_robin');
    if (roundRobinStages.length === 0)
        return null;
    return roundRobinStages
        .slice()
        .sort((a, b) => (toNumberId(b.id) || 0) - (toNumberId(a.id) || 0))[0];
}
function isCompletedMatch(match, score) {
    if ((score === null || score === void 0 ? void 0 : score.status) === 'completed' || (score === null || score === void 0 ? void 0 : score.status) === 'walkover') {
        return true;
    }
    return match.status === 4;
}
function createSeedingFromParticipantIds(participantIds) {
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(participantIds.length, 2))));
    const seeding = [...participantIds];
    while (seeding.length < bracketSize) {
        seeding.push(null);
    }
    return seeding;
}
function createSeedingArrayWithExistingOrder(participantIds, maxBracketSize) {
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(participantIds.length, 2))));
    const targetSize = maxBracketSize || bracketSize;
    const trimmed = participantIds.slice(0, targetSize);
    const seeding = [...trimmed];
    while (seeding.length < targetSize) {
        seeding.push(null);
    }
    return seeding;
}
function convertBracketsStatus(status) {
    switch (status) {
        case 3:
            return 'in_progress';
        case 4:
            return 'completed';
        case 0:
        case 1:
        case 2:
        default:
            return 'ready';
    }
}
function resolveWinnerRegistrationId(match, registrationIdByParticipantId) {
    var _a, _b, _c, _d;
    const p1Id = (_a = match.opponent1) === null || _a === void 0 ? void 0 : _a.id;
    const p2Id = (_b = match.opponent2) === null || _b === void 0 ? void 0 : _b.id;
    if (p1Id === null || p1Id === undefined || p2Id === null || p2Id === undefined) {
        return undefined;
    }
    if (((_c = match.opponent1) === null || _c === void 0 ? void 0 : _c.result) === 'win') {
        return registrationIdByParticipantId.get(String(p1Id));
    }
    if (((_d = match.opponent2) === null || _d === void 0 ? void 0 : _d.result) === 'win') {
        return registrationIdByParticipantId.get(String(p2Id));
    }
    return undefined;
}
// ============================================
// Firestore operations (admin SDK)
// ============================================
async function createStageWithStats(manager, storage, categoryId, stageName, stageType, seedingIds, settings) {
    var _a, _b, _c;
    const stage = await manager.create.stage({
        tournamentId: categoryId,
        name: stageName,
        type: stageType,
        seedingIds: seedingIds,
        settings: settings,
    });
    let stageId = toNumberId(stage === null || stage === void 0 ? void 0 : stage.id);
    if (stageId === null) {
        const stages = asArray(await storage.select('stage', { tournament_id: categoryId }));
        const matchingStages = stages.filter((s) => s.name === stageName && s.type === stageType);
        stageId = (_b = toNumberId((_a = matchingStages[0]) === null || _a === void 0 ? void 0 : _a.id)) !== null && _b !== void 0 ? _b : (_c = matchingStages[0]) === null || _c === void 0 ? void 0 : _c.id;
    }
    if (stageId === null) {
        throw new Error(`Failed to resolve stage ID for "${stageName}"`);
    }
    const matches = asArray(await storage.select('match', { stage_id: stageId }));
    const groups = asArray(await storage.select('group', { stage_id: stageId }));
    const rounds = asArray(await storage.select('round', { stage_id: stageId }));
    return {
        success: true,
        stageId,
        matchCount: matches.length,
        groupCount: groups.length,
        roundCount: rounds.length,
        participantCount: seedingIds.filter((id) => id !== null).length,
    };
}
async function createStandardStage(category, manager, storage, participantCount, options) {
    if (category.format === 'pool_to_elimination') {
        throw new Error('Pool-to-elimination categories must use pool stage generation.');
    }
    const stageType = category.format;
    const roundRobin = stageType === 'round_robin';
    const seeding = roundRobin
        ? createSequentialSeeding(participantCount)
        : createSeedingArray(participantCount);
    if (roundRobin) {
        return createStageWithStats(manager, storage, category.id, category.name, 'round_robin', seeding, {
            seedOrdering: getRoundRobinSeedOrdering(options.seedOrdering),
            groupCount: options.groupCount || 1,
        });
    }
    return createStageWithStats(manager, storage, category.id, category.name, stageType, seeding, {
        seedOrdering: options.seedOrdering || ['inner_outer'],
        grandFinal: stageType === 'double_elimination' ? options.grandFinal || 'double' : undefined,
        consolationFinal: options.consolationFinal,
    });
}
async function createPoolStage(category, manager, storage, participantCount, options) {
    var _a, _b;
    const teamsPerPool = (_b = (_a = category.teamsPerPool) !== null && _a !== void 0 ? _a : options.teamsPerPool) !== null && _b !== void 0 ? _b : 4;
    const groupCount = calculatePoolGroupCount(participantCount, teamsPerPool);
    const totalSlots = groupCount * teamsPerPool;
    const seeding = createSequentialSeeding(participantCount);
    while (seeding.length < totalSlots) {
        seeding.push(null);
    }
    return createStageWithStats(manager, storage, category.id, `${category.name} - Pool Play`, 'round_robin', seeding, {
        seedOrdering: getRoundRobinSeedOrdering(options.seedOrdering),
        groupCount,
    });
}
async function initializeByeWalkovers(db, tournamentId, categoryId, storage, stageId, participants) {
    var _a, _b;
    const allMatches = asArray(await storage.select('match', { stage_id: stageId }));
    const byeMatches = allMatches.filter((m) => {
        var _a, _b, _c, _d;
        return ((_a = m.opponent1) === null || _a === void 0 ? void 0 : _a.id) === null ||
            ((_b = m.opponent1) === null || _b === void 0 ? void 0 : _b.id) === undefined ||
            ((_c = m.opponent2) === null || _c === void 0 ? void 0 : _c.id) === null ||
            ((_d = m.opponent2) === null || _d === void 0 ? void 0 : _d.id) === undefined;
    });
    if (byeMatches.length === 0)
        return;
    const regIdByParticipantId = new Map(participants.map((p) => [String(p.id), p.name]));
    const batch = db.batch();
    for (const match of byeMatches) {
        const p1Id = (_a = match.opponent1) === null || _a === void 0 ? void 0 : _a.id;
        const p2Id = (_b = match.opponent2) === null || _b === void 0 ? void 0 : _b.id;
        const p1IsReal = p1Id !== null && p1Id !== undefined;
        const realParticipantId = p1IsReal ? String(p1Id) : p2Id !== null && p2Id !== undefined ? String(p2Id) : null;
        if (realParticipantId === null)
            continue;
        const winnerId = regIdByParticipantId.get(realParticipantId);
        if (!winnerId)
            continue;
        batch.set(db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('categories')
            .doc(categoryId)
            .collection('match_scores')
            .doc(String(match.id)), {
            status: 'walkover',
            winnerId,
            scores: [],
            completedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    await batch.commit();
}
async function initializeLevelMatchScores(db, tournamentId, categoryId, levelId, storage, stageId, registrationIdByParticipantId) {
    var _a, _b;
    const levelMatches = asArray(await storage.select('match', { stage_id: stageId }));
    if (levelMatches.length === 0)
        return;
    const CHUNK_SIZE = 400;
    for (let i = 0; i < levelMatches.length; i += CHUNK_SIZE) {
        const chunk = levelMatches.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();
        let ops = 0;
        for (const match of chunk) {
            const p1Id = (_a = match.opponent1) === null || _a === void 0 ? void 0 : _a.id;
            const p2Id = (_b = match.opponent2) === null || _b === void 0 ? void 0 : _b.id;
            if (p1Id === null || p1Id === undefined || p2Id === null || p2Id === undefined)
                continue;
            const status = convertBracketsStatus(match.status);
            const winnerId = resolveWinnerRegistrationId(match, registrationIdByParticipantId);
            const payload = {
                status,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            };
            if (winnerId)
                payload.winnerId = winnerId;
            if (status === 'completed' || status === 'walkover') {
                payload.completedAt = firestore_1.FieldValue.serverTimestamp();
            }
            batch.set(db
                .collection('tournaments')
                .doc(tournamentId)
                .collection('categories')
                .doc(categoryId)
                .collection('levels')
                .doc(levelId)
                .collection('match_scores')
                .doc(String(match.id)), payload, { merge: true });
            ops += 1;
        }
        if (ops > 0)
            await batch.commit();
    }
}
async function deleteMatchScoresByIds(db, tournamentId, categoryId, matchIds) {
    if (matchIds.length === 0)
        return;
    const CHUNK_SIZE = 400;
    for (let i = 0; i < matchIds.length; i += CHUNK_SIZE) {
        const chunk = matchIds.slice(i, i + CHUNK_SIZE);
        const batch = db.batch();
        for (const matchId of chunk) {
            batch.delete(db
                .collection('tournaments')
                .doc(tournamentId)
                .collection('categories')
                .doc(categoryId)
                .collection('match_scores')
                .doc(matchId));
        }
        await batch.commit();
    }
}
async function clearBracketStorage(storage) {
    await storage.delete('match');
    await storage.delete('match_game');
    await storage.delete('round');
    await storage.delete('group');
    await storage.delete('stage');
    await storage.delete('participant');
}
//# sourceMappingURL=bracketHelpers.js.map