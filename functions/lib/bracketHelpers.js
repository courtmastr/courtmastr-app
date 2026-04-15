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
exports.extractPoolQualifiers = extractPoolQualifiers;
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
function extractPoolQualifiers(params) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const roundToGroupMap = new Map();
    for (const round of params.rounds) {
        if (round.group_id !== undefined && round.group_id !== null) {
            roundToGroupMap.set(String(round.id), String(round.group_id));
        }
    }
    const participantToGroupMap = new Map();
    for (const match of params.matches) {
        const groupId = match.group_id !== undefined && match.group_id !== null
            ? String(match.group_id)
            : roundToGroupMap.get(String(match.round_id || '')) || 'group-1';
        const p1Id = (_a = match.opponent1) === null || _a === void 0 ? void 0 : _a.id;
        const p2Id = (_b = match.opponent2) === null || _b === void 0 ? void 0 : _b.id;
        if (p1Id !== null && p1Id !== undefined && !participantToGroupMap.has(String(p1Id))) {
            participantToGroupMap.set(String(p1Id), groupId);
        }
        if (p2Id !== null && p2Id !== undefined && !participantToGroupMap.has(String(p2Id))) {
            participantToGroupMap.set(String(p2Id), groupId);
        }
    }
    const registrationByParticipantId = new Map(params.participants.map((p) => [String(p.id), p.name]));
    const participantByRegistrationId = new Map(params.participants.map((p) => [p.name, String(p.id)]));
    const standings = new Map();
    for (const participant of params.participants) {
        const key = String(participant.id);
        const groupId = participantToGroupMap.get(key) || 'group-1';
        standings.set(key, {
            participantId: participant.id,
            registrationId: participant.name,
            groupId,
            matchesPlayed: 0,
            matchesWon: 0,
            matchesLost: 0,
            matchPoints: 0,
            pointsFor: 0,
            pointsAgainst: 0,
        });
    }
    for (const match of params.matches) {
        const p1Id = (_c = match.opponent1) === null || _c === void 0 ? void 0 : _c.id;
        const p2Id = (_d = match.opponent2) === null || _d === void 0 ? void 0 : _d.id;
        if (p1Id === null || p1Id === undefined || p2Id === null || p2Id === undefined)
            continue;
        const p1Standing = standings.get(String(p1Id));
        const p2Standing = standings.get(String(p2Id));
        if (!p1Standing || !p2Standing)
            continue;
        const score = params.matchScores.get(String(match.id));
        const winnerRegistrationId = score === null || score === void 0 ? void 0 : score.winnerId;
        const winnerParticipantId = winnerRegistrationId
            ? participantByRegistrationId.get(winnerRegistrationId)
            : ((_e = match.opponent1) === null || _e === void 0 ? void 0 : _e.result) === 'win'
                ? String(p1Id)
                : ((_f = match.opponent2) === null || _f === void 0 ? void 0 : _f.result) === 'win'
                    ? String(p2Id)
                    : undefined;
        p1Standing.matchesPlayed += 1;
        p2Standing.matchesPlayed += 1;
        for (const game of (score === null || score === void 0 ? void 0 : score.scores) || []) {
            p1Standing.pointsFor += game.score1;
            p1Standing.pointsAgainst += game.score2;
            p2Standing.pointsFor += game.score2;
            p2Standing.pointsAgainst += game.score1;
        }
        if (winnerParticipantId === String(p1Id)) {
            p1Standing.matchesWon += 1;
            p1Standing.matchPoints += 2;
            p2Standing.matchesLost += 1;
            p2Standing.matchPoints += 1;
        }
        else if (winnerParticipantId === String(p2Id)) {
            p2Standing.matchesWon += 1;
            p2Standing.matchPoints += 2;
            p1Standing.matchesLost += 1;
            p1Standing.matchPoints += 1;
        }
    }
    // Grant walkover wins for BYE matches (one null opponent)
    for (const match of params.matches) {
        const p1Id = (_g = match.opponent1) === null || _g === void 0 ? void 0 : _g.id;
        const p2Id = (_h = match.opponent2) === null || _h === void 0 ? void 0 : _h.id;
        const p1IsReal = p1Id !== null && p1Id !== undefined;
        const p2IsReal = p2Id !== null && p2Id !== undefined;
        if (p1IsReal && p2IsReal)
            continue;
        if (!p1IsReal && !p2IsReal)
            continue;
        const realPlayerId = p1IsReal ? String(p1Id) : String(p2Id);
        const standing = standings.get(realPlayerId);
        if (!standing)
            continue;
        standing.matchesPlayed += 1;
        standing.matchesWon += 1;
        standing.matchPoints += 2;
    }
    const standingsByGroup = new Map();
    for (const standing of standings.values()) {
        if (!standingsByGroup.has(standing.groupId)) {
            standingsByGroup.set(standing.groupId, []);
        }
        (_j = standingsByGroup.get(standing.groupId)) === null || _j === void 0 ? void 0 : _j.push(standing);
    }
    for (const groupStandings of standingsByGroup.values()) {
        groupStandings.sort((a, b) => {
            if (b.matchPoints !== a.matchPoints)
                return b.matchPoints - a.matchPoints;
            if (b.matchesWon !== a.matchesWon)
                return b.matchesWon - a.matchesWon;
            const aPointDiff = a.pointsFor - a.pointsAgainst;
            const bPointDiff = b.pointsFor - b.pointsAgainst;
            if (bPointDiff !== aPointDiff)
                return bPointDiff - aPointDiff;
            if (b.pointsFor !== a.pointsFor)
                return b.pointsFor - a.pointsFor;
            return a.registrationId.localeCompare(b.registrationId);
        });
    }
    const minGroupSize = Math.min(...Array.from(standingsByGroup.values()).map((v) => v.length));
    const qualifiersPerGroup = Math.max(1, Math.min(Math.floor(params.requestedQualifiersPerGroup), Number.isFinite(minGroupSize) ? minGroupSize : 1));
    const groupOrder = params.groups
        .slice()
        .sort((a, b) => Number(a.number || 0) - Number(b.number || 0))
        .map((group) => String(group.id));
    if (groupOrder.length === 0) {
        groupOrder.push(...Array.from(standingsByGroup.keys()).sort());
    }
    const qualifiedParticipantIds = [];
    for (let rankIndex = 0; rankIndex < qualifiersPerGroup; rankIndex++) {
        for (const groupId of groupOrder) {
            const qualifier = (_k = standingsByGroup.get(groupId)) === null || _k === void 0 ? void 0 : _k[rankIndex];
            if (qualifier) {
                qualifiedParticipantIds.push(qualifier.participantId);
            }
        }
    }
    const qualifiedRegistrationIds = qualifiedParticipantIds
        .map((id) => registrationByParticipantId.get(String(id)))
        .filter((v) => typeof v === 'string');
    return {
        participantIds: qualifiedParticipantIds,
        registrationIds: qualifiedRegistrationIds,
        groupCount: standingsByGroup.size,
        qualifiersPerGroup,
    };
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