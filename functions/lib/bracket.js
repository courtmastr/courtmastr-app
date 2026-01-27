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
exports.generateBracket = generateBracket;
// Bracket Generation Logic
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const manager_1 = require("./manager");
// Get db lazily to avoid initialization order issues
function getDb() {
    return admin.firestore();
}
/**
 * Generate bracket for a category using brackets-manager
 */
async function generateBracket(tournamentId, categoryId) {
    const db = getDb();
    // Get category details
    const categoryDoc = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('categories')
        .doc(categoryId)
        .get();
    if (!categoryDoc.exists) {
        throw new Error('Category not found');
    }
    const category = categoryDoc.data();
    const format = category === null || category === void 0 ? void 0 : category.format;
    // Get approved/checked-in registrations
    const registrationsSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('registrations')
        .where('categoryId', '==', categoryId)
        .where('status', 'in', ['approved', 'checked_in'])
        .get();
    const registrations = registrationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    }));
    if (registrations.length < 2) {
        throw new Error('Need at least 2 participants to generate bracket');
    }
    // Sort by seed (seeded players first, then random)
    const seededRegistrations = registrations
        .filter((r) => r.seed !== undefined)
        .sort((a, b) => (a.seed || 0) - (b.seed || 0));
    const unseededRegistrations = registrations
        .filter((r) => r.seed === undefined)
        .sort(() => Math.random() - 0.5);
    const sortedRegistrations = [...seededRegistrations, ...unseededRegistrations];
    // Delete existing bracket data for this category (if any)
    // brackets-manager stores data in sub-collections under the tournament
    const manager = (0, manager_1.getBracketsManager)(tournamentId);
    // TODO: Fix stage deletion - currently causing "Could not delete match games" error
    /*
    // Check if a stage already exists for this category
    const existingStages = await manager.storage.select('stage', {
      tournament_id: categoryId  // Using categoryId as the stage identifier
    });
  
    // Delete existing stage(s) if any
    if (existingStages) {
      const stages = Array.isArray(existingStages) ? existingStages : [existingStages];
      for (const stage of stages) {
        if (stage && typeof stage === 'object' && 'id' in stage && stage.id) {
          await manager.delete.stage(stage.id);
        }
      }
    }
    */
    // Map format to brackets-manager format
    let stageType;
    switch (format) {
        case 'single_elimination':
            stageType = 'single_elimination';
            break;
        case 'double_elimination':
            stageType = 'double_elimination';
            break;
        case 'round_robin':
            stageType = 'round_robin';
            break;
        default:
            throw new Error(`Unsupported format: ${format}`);
    }
    // Create seeding array (participant names or IDs)
    // brackets-manager requires bracket size to be a power of 2
    // For non-power-of-2 counts, pad with null for automatic byes
    const numParticipants = sortedRegistrations.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(numParticipants)));
    const seeding = sortedRegistrations.map(reg => reg.id);
    // Pad with nulls for byes
    while (seeding.length < bracketSize) {
        seeding.push(null);
    }
    console.log(`📊 Bracket info: ${numParticipants} participants → ${bracketSize}-size bracket (${bracketSize - numParticipants} byes)`);
    // Create the stage (bracket)
    const stage = await manager.create.stage({
        tournamentId: categoryId, // Use categoryId to scope this stage
        name: (category === null || category === void 0 ? void 0 : category.name) || 'Bracket',
        type: stageType,
        seeding,
        settings: {
            seedOrdering: ['natural'],
            grandFinal: stageType === 'double_elimination' ? 'simple' : undefined,
        },
    });
    console.log(`✅ Generated ${stageType} bracket for category ${categoryId} with ${registrations.length} participants`);
    console.log(`   Stage ID: ${stage.id}`);
    // Sync match data to legacy schema for frontend compatibility
    await syncMatchesToLegacySchema(tournamentId, categoryId, manager, sortedRegistrations, String(stage.id));
    // Update category status
    await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('categories')
        .doc(categoryId)
        .update({
        status: 'active',
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
/**
 * Sync brackets-manager match data to legacy matches collection for frontend compatibility
 */
async function syncMatchesToLegacySchema(tournamentId, categoryId, manager, registrations, stageId) {
    var _a, _b, _c;
    const db = getDb();
    console.log('🔄 Syncing matches to legacy schema...');
    console.log(`  Tournament: ${tournamentId}, Category: ${categoryId}, Stage: ${stageId}`);
    // Get all matches from brackets-manager for THIS STAGE ONLY
    const matches = await manager.storage.select('match', { stage_id: stageId });
    const participants = await manager.storage.select('participant');
    const groups = await manager.storage.select('group', { stage_id: stageId });
    console.log(`📊 Data from brackets-manager:`);
    console.log(`  - Matches: ${Array.isArray(matches) ? matches.length : (matches ? 1 : 0)}`);
    console.log(`  - Participants: ${Array.isArray(participants) ? participants.length : (participants ? 1 : 0)}`);
    console.log(`  - Groups: ${Array.isArray(groups) ? groups.length : (groups ? 1 : 0)}`);
    if (!matches || !Array.isArray(matches)) {
        console.log('⚠️  No matches to sync (matches is not an array)');
        console.log('   matches value:', JSON.stringify(matches, null, 2));
        return;
    }
    if (matches.length === 0) {
        console.log('⚠️  No matches to sync (empty array)');
        return;
    }
    // Log first match structure
    console.log('📝 Sample match structure:', JSON.stringify(matches[0], null, 2));
    if (Array.isArray(participants) && participants.length > 0) {
        console.log('📝 Sample participant structure:', JSON.stringify(participants[0], null, 2));
    }
    if (Array.isArray(groups) && groups.length > 0) {
        console.log('📝 Sample group structure:', JSON.stringify(groups[0], null, 2));
    }
    // Delete existing legacy matches for this category
    const existingMatches = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('matches')
        .where('categoryId', '==', categoryId)
        .get();
    console.log(`🗑️  Deleting ${existingMatches.docs.length} existing legacy matches`);
    const batch = db.batch();
    existingMatches.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    // Create a map of participant IDs to registration IDs
    const participantToRegistrationMap = new Map();
    if (Array.isArray(participants)) {
        for (const p of participants) {
            // The participant name is the registration ID
            if (p.name) {
                participantToRegistrationMap.set(p.id, p.name);
                console.log(`  Mapping participant ${p.id} → registration ${p.name}`);
            }
        }
    }
    console.log(`🗺️  Created ${participantToRegistrationMap.size} participant mappings`);
    // Determine bracket type from groups
    const groupArray = Array.isArray(groups) ? groups : groups ? [groups] : [];
    const groupMap = new Map(groupArray.map((g) => [g.id, g]));
    console.log(`📋 Group map:`, Array.from(groupMap.entries()).map(([id, g]) => `${id}: ${g.number}`));
    // Create legacy matches
    const writeBatch = db.batch();
    let matchCount = 0;
    for (const match of matches) {
        // Handle both string IDs and object references from Firestore adapter
        const groupId = typeof match.group_id === 'object' && match.group_id !== null
            ? match.group_id.id
            : match.group_id;
        const group = groupMap.get(groupId);
        if (!group) {
            console.log(`⚠️  Skipping match ${match.id} - no group found for group_id ${groupId} (type: ${typeof match.group_id})`);
            continue;
        }
        // Determine if this is Winners/Losers/Finals based on group number
        let bracketType = 'main';
        if (group.number === 1)
            bracketType = 'winners';
        else if (group.number === 2)
            bracketType = 'losers';
        else if (group.number === 3)
            bracketType = 'finals';
        // Handle opponent IDs (can be null for byes, or object references)
        const getOpponentId = (opponent) => {
            if (!opponent || opponent.id === null || opponent.id === undefined) {
                return null;
            }
            const oppId = typeof opponent.id === 'object' ? opponent.id.id : opponent.id;
            return participantToRegistrationMap.get(oppId) || null;
        };
        // Extract round number from round_id (can be object or number)
        const roundNumber = typeof match.round_id === 'object' && match.round_id !== null
            ? match.round_id.number
            : match.round || 1;
        const legacyMatch = {
            tournamentId,
            categoryId,
            round: roundNumber,
            matchNumber: match.number,
            bracketType,
            status: ((_a = match.opponent1) === null || _a === void 0 ? void 0 : _a.result) ? 'completed' : 'scheduled',
            participant1Id: getOpponentId(match.opponent1),
            participant2Id: getOpponentId(match.opponent2),
            scores: [],
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        };
        // Add winner if match is completed
        if (((_b = match.opponent1) === null || _b === void 0 ? void 0 : _b.result) === 'win') {
            legacyMatch.winnerId = getOpponentId(match.opponent1);
        }
        else if (((_c = match.opponent2) === null || _c === void 0 ? void 0 : _c.result) === 'win') {
            legacyMatch.winnerId = getOpponentId(match.opponent2);
        }
        if (matchCount < 3) {
            console.log(`✨ Creating legacy match ${matchCount + 1}:`, {
                round: legacyMatch.round,
                matchNumber: legacyMatch.matchNumber,
                bracketType: legacyMatch.bracketType,
                participant1Id: legacyMatch.participant1Id,
                participant2Id: legacyMatch.participant2Id,
            });
        }
        const matchRef = db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('matches')
            .doc();
        writeBatch.set(matchRef, legacyMatch);
        matchCount++;
    }
    await writeBatch.commit();
    console.log(`✅ Synced ${matchCount} matches to legacy schema`);
}
//# sourceMappingURL=bracket.js.map