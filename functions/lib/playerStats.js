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
exports.aggregatePlayerStats = void 0;
exports.buildRegistrationLookup = buildRegistrationLookup;
exports.buildMatchScoreCollectionTargets = buildMatchScoreCollectionTargets;
exports.applyMatchScoreDeltas = applyMatchScoreDeltas;
// Cloud Function: aggregate player stats when a tournament completes
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
function buildRegistrationLookup(registrations) {
    const lookup = new Map();
    for (const registration of registrations) {
        if (!registration.categoryId) {
            continue;
        }
        const playerIds = Array.from(new Set([registration.playerId, registration.partnerPlayerId].filter((playerId) => typeof playerId === 'string' && playerId.length > 0)));
        if (playerIds.length === 0) {
            continue;
        }
        lookup.set(registration.id, {
            playerIds,
            categoryId: registration.categoryId,
        });
    }
    return lookup;
}
function buildMatchScoreCollectionTargets(tournamentId, categoryIds, levelIdsByCategory) {
    var _a;
    const targets = [];
    for (const categoryId of categoryIds) {
        targets.push({
            categoryId,
            path: `tournaments/${tournamentId}/categories/${categoryId}/match_scores`,
        });
        for (const levelId of (_a = levelIdsByCategory[categoryId]) !== null && _a !== void 0 ? _a : []) {
            targets.push({
                categoryId,
                levelId,
                path: `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match_scores`,
            });
        }
    }
    return targets;
}
function applyMatchScoreDeltas(deltas, registrationLookup, categoryTypeMap, sport, matchScore) {
    var _a, _b, _c;
    const participant1Id = (_a = matchScore.participant1Id) !== null && _a !== void 0 ? _a : undefined;
    const participant2Id = (_b = matchScore.participant2Id) !== null && _b !== void 0 ? _b : undefined;
    const winnerId = (_c = matchScore.winnerId) !== null && _c !== void 0 ? _c : undefined;
    if (!participant1Id || !participant2Id || !winnerId) {
        return;
    }
    const categoryType = categoryTypeMap.get(matchScore.categoryId);
    if (!categoryType) {
        return;
    }
    const participant1 = registrationLookup.get(participant1Id);
    const participant2 = registrationLookup.get(participant2Id);
    if (!participant1 || !participant2) {
        return;
    }
    const winnerRegistration = winnerId === participant1Id ? participant1 : participant2;
    const loserRegistration = winnerId === participant1Id ? participant2 : participant1;
    let winnerGames = 0;
    let loserGames = 0;
    const scores = Array.isArray(matchScore.scores) ? matchScore.scores : [];
    for (const game of scores) {
        if (!game.isComplete && game.score1 === 0 && game.score2 === 0) {
            continue;
        }
        const participant1WinsGame = game.score1 > game.score2;
        if (winnerId === participant1Id) {
            if (participant1WinsGame) {
                winnerGames += 1;
            }
            else {
                loserGames += 1;
            }
        }
        else if (participant1WinsGame) {
            loserGames += 1;
        }
        else {
            winnerGames += 1;
        }
    }
    const gamesPlayed = winnerGames + loserGames;
    applyPlayerIdsDelta(deltas, winnerRegistration.playerIds, sport, categoryType, {
        wins: 1,
        losses: 0,
        gamesPlayed,
    });
    applyPlayerIdsDelta(deltas, loserRegistration.playerIds, sport, categoryType, {
        wins: 0,
        losses: 1,
        gamesPlayed,
    });
}
function applyPlayerIdsDelta(deltas, playerIds, sport, catType, delta) {
    for (const playerId of new Set(playerIds)) {
        applyDelta(deltas, playerId, sport, catType, delta);
    }
}
async function fetchLevelIdsByCategory(firestore, tournamentId, categoryIds) {
    const entries = await Promise.all(categoryIds.map(async (categoryId) => {
        const levelsSnap = await firestore
            .collection(`tournaments/${tournamentId}/categories/${categoryId}/levels`)
            .get();
        return [categoryId, levelsSnap.docs.map((doc) => doc.id)];
    }));
    return Object.fromEntries(entries);
}
/**
 * Triggered when a tournament document is updated.
 * When status changes to "completed" and statsProcessed == false,
 * reads all match_scores for the tournament and increments /players stats.
 */
exports.aggregatePlayerStats = (0, firestore_1.onDocumentUpdated)('tournaments/{tournamentId}', async (event) => {
    var _a, _b, _c, _d;
    const before = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before) === null || _b === void 0 ? void 0 : _b.data();
    const after = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.after) === null || _d === void 0 ? void 0 : _d.data();
    const { tournamentId } = event.params;
    if (!before || !after)
        return;
    // Only run when:
    // 1. Status just changed to "completed"
    // 2. statsProcessed is not already true
    // 3. sport field is present
    const statusChanged = before.status !== 'completed' && after.status === 'completed';
    const alreadyProcessed = after.statsProcessed === true;
    const sport = after.sport;
    if (!statusChanged || alreadyProcessed || !sport)
        return;
    const db = admin.firestore();
    const deltas = new Map();
    try {
        // 1. Fetch all registrations for this tournament (registrationId -> playerIds lookup)
        const registrationsSnap = await db
            .collection(`tournaments/${tournamentId}/registrations`)
            .get();
        const registrationLookup = buildRegistrationLookup(registrationsSnap.docs.map((regDoc) => ({
            id: regDoc.id,
            playerId: regDoc.data().playerId,
            partnerPlayerId: regDoc.data().partnerPlayerId,
            categoryId: regDoc.data().categoryId,
        })));
        // 2. Build a map of categoryId → categoryType (singles/doubles/mixed)
        const categoryTypeMap = new Map();
        const categoriesSnap = await db
            .collection(`tournaments/${tournamentId}/categories`)
            .get();
        const categoryIds = [];
        for (const catDoc of categoriesSnap.docs) {
            categoryIds.push(catDoc.id);
            const catType = catDoc.data().type;
            if (typeof catType === 'string' && catType.length > 0) {
                categoryTypeMap.set(catDoc.id, catType);
            }
        }
        // 3. Read match_scores from category and level-scoped paths so tournament completion
        //    does not depend on a collection-group index to aggregate results.
        const levelIdsByCategory = await fetchLevelIdsByCategory(db, tournamentId, categoryIds);
        const targets = buildMatchScoreCollectionTargets(tournamentId, categoryIds, levelIdsByCategory);
        const matchScoreCollections = await Promise.all(targets.map(async (target) => ({
            target,
            snap: await db.collection(target.path).get(),
        })));
        // 4. Compute per-player deltas, crediting every player attached to a registration.
        for (const { target, snap } of matchScoreCollections) {
            for (const matchScoreDoc of snap.docs) {
                const matchScoreData = matchScoreDoc.data();
                const status = matchScoreData.status;
                if (status !== 'completed' && status !== 'walkover') {
                    continue;
                }
                applyMatchScoreDeltas(deltas, registrationLookup, categoryTypeMap, sport, {
                    categoryId: target.categoryId,
                    participant1Id: matchScoreData.participant1Id,
                    participant2Id: matchScoreData.participant2Id,
                    winnerId: matchScoreData.winnerId,
                    scores: Array.isArray(matchScoreData.scores)
                        ? matchScoreData.scores
                        : [],
                });
            }
        }
        // 5. Batch write stat increments to /players
        const batch = db.batch();
        for (const [playerId, sportMap] of deltas) {
            if (!playerId)
                continue;
            const playerRef = db.collection('players').doc(playerId);
            const updateData = {};
            let totalWins = 0;
            let totalLosses = 0;
            let totalGames = 0;
            for (const [s, catMap] of sportMap) {
                for (const [cat, delta] of catMap) {
                    updateData[`stats.${s}.${cat}.wins`] = admin.firestore.FieldValue.increment(delta.wins);
                    updateData[`stats.${s}.${cat}.losses`] = admin.firestore.FieldValue.increment(delta.losses);
                    updateData[`stats.${s}.${cat}.gamesPlayed`] = admin.firestore.FieldValue.increment(delta.gamesPlayed);
                    updateData[`stats.${s}.${cat}.tournamentsPlayed`] = admin.firestore.FieldValue.increment(1);
                    totalWins += delta.wins;
                    totalLosses += delta.losses;
                    totalGames += delta.gamesPlayed;
                }
            }
            // Overall rollup
            updateData['stats.overall.wins'] = admin.firestore.FieldValue.increment(totalWins);
            updateData['stats.overall.losses'] = admin.firestore.FieldValue.increment(totalLosses);
            updateData['stats.overall.gamesPlayed'] = admin.firestore.FieldValue.increment(totalGames);
            updateData['stats.overall.tournamentsPlayed'] = admin.firestore.FieldValue.increment(1);
            updateData['updatedAt'] = admin.firestore.FieldValue.serverTimestamp();
            batch.update(playerRef, updateData);
        }
        await batch.commit();
        // 6. Mark tournament as processed to prevent double-counting
        await event.data.after.ref.update({
            statsProcessed: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[aggregatePlayerStats] Processed tournament ${tournamentId}: ${deltas.size} players updated`);
    }
    catch (err) {
        console.error(`[aggregatePlayerStats] Error processing tournament ${tournamentId}:`, err);
        throw err;
    }
});
function applyDelta(deltas, playerId, sport, catType, delta) {
    var _a;
    if (!playerId)
        return;
    if (!deltas.has(playerId))
        deltas.set(playerId, new Map());
    const sportMap = deltas.get(playerId);
    if (!sportMap.has(sport))
        sportMap.set(sport, new Map());
    const catMap = sportMap.get(sport);
    const existing = (_a = catMap.get(catType)) !== null && _a !== void 0 ? _a : { wins: 0, losses: 0, gamesPlayed: 0 };
    catMap.set(catType, {
        wins: existing.wins + delta.wins,
        losses: existing.losses + delta.losses,
        gamesPlayed: existing.gamesPlayed + delta.gamesPlayed,
    });
}
//# sourceMappingURL=playerStats.js.map