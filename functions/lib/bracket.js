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
    // Check if a stage already exists for this category
    const existingStages = await manager.storage.select('stage', {
        tournament_id: categoryId // Using categoryId as the stage identifier
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
    await manager.create.stage({
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
//# sourceMappingURL=bracket.js.map