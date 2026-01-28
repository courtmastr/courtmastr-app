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
const admin = __importStar(require("firebase-admin"));
const bracket_1 = require("./bracket");
const manager_1 = require("./manager");
// Auto-detect emulator or set explicitly
if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('⚠️  FIRESTORE_EMULATOR_HOST not set. Defaulting to localhost:8080');
    console.log('   Make sure the emulator is running: npm run emulators');
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}
if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'demo-courtmaster' });
}
console.log(`🔌 Connecting to Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}\n`);
const db = admin.firestore();
async function testCompleteFlow() {
    console.log('🧪 COMPLETE FLOW TEST: Double Elimination');
    console.log('='.repeat(80));
    const tournamentId = `test_de_${Date.now()}`;
    const categoryId = 'category_mens_singles';
    try {
        // Setup: Create category
        await db.collection('tournaments').doc(tournamentId)
            .collection('categories').doc(categoryId)
            .set({
            name: "Men's Singles",
            format: 'double_elimination',
            status: 'draft',
        });
        // Setup: Create registrations (8 players for clean bracket)
        const playerNames = ['Player A', 'Player B', 'Player C', 'Player D',
            'Player E', 'Player F', 'Player G', 'Player H'];
        for (let i = 0; i < playerNames.length; i++) {
            await db.collection('tournaments').doc(tournamentId)
                .collection('registrations')
                .add({
                categoryId: categoryId,
                playerName: playerNames[i],
                status: 'approved',
                seed: i + 1,
            });
        }
        console.log(`\n✅ Setup complete: 8 players in ${tournamentId}`);
        // Test: Generate bracket
        console.log('\n📊 Generating double elimination bracket...');
        await (0, bracket_1.generateBracket)(tournamentId, categoryId);
        // Verify: Check brackets-manager data
        console.log('\n🔍 Verifying brackets-manager data...');
        const manager = (0, manager_1.getBracketsManager)(tournamentId);
        const stages = await manager.storage.select('stage');
        const stageCount = Array.isArray(stages) ? stages.length : (stages ? 1 : 0);
        console.log(`   Stages: ${stageCount} ${stageCount === 1 ? '✅' : '❌'}`);
        if (stages && stageCount > 0) {
            const stage = Array.isArray(stages) ? stages[0] : stages;
            console.log(`   Stage ID: ${stage.id} (type: ${typeof stage.id})`);
            const groups = await manager.storage.select('group', { stage_id: String(stage.id) });
            const groupCount = Array.isArray(groups) ? groups.length : (groups ? 1 : 0);
            console.log(`   Groups: ${groupCount} ${groupCount === 3 ? '✅' : '❌'} (expected 3: WB, LB, Finals)`);
            const matches = await manager.storage.select('match', { stage_id: String(stage.id) });
            const matchCount = Array.isArray(matches) ? matches.length : (matches ? 1 : 0);
            console.log(`   Matches: ${matchCount} ${matchCount > 0 ? '✅' : '❌'}`);
            // For 8 players DE:
            // WB: 7 matches (4+2+1)
            // LB: 4 matches (2+1+1)
            // Finals: 1 match (GF)
            // Total: 12 matches
            const expectedMatches = 12;
            console.log(`   Expected: ~${expectedMatches} matches ${Math.abs(matchCount - expectedMatches) <= 2 ? '✅' : '⚠️'}`);
            const participants = await manager.storage.select('participant');
            const participantCount = Array.isArray(participants) ? participants.length : (participants ? 1 : 0);
            console.log(`   Participants: ${participantCount} ${participantCount === 8 ? '✅' : '❌'}`);
            // Verify: Check legacy schema
            console.log('\n🔍 Verifying legacy schema...');
            const legacyMatches = await db.collection('tournaments').doc(tournamentId)
                .collection('matches')
                .where('categoryId', '==', categoryId)
                .get();
            console.log(`   Legacy matches: ${legacyMatches.size} ${legacyMatches.size === matchCount ? '✅' : '❌'}`);
            if (legacyMatches.size > 0) {
                const bracketTypes = new Set(legacyMatches.docs.map(d => d.data().bracketType));
                console.log(`   Bracket types: ${Array.from(bracketTypes).join(', ')}`);
                console.log(`   Has winners bracket: ${bracketTypes.has('winners') ? '✅' : '❌'}`);
                console.log(`   Has losers bracket: ${bracketTypes.has('losers') ? '✅' : '❌'}`);
                console.log(`   Has finals: ${bracketTypes.has('finals') ? '✅' : '❌'}`);
            }
            // Final verdict
            console.log('\n' + '='.repeat(80));
            if (matchCount > 0 && legacyMatches.size === matchCount && groupCount === 3) {
                console.log('✅ TEST PASSED: Double elimination bracket generated successfully!');
                return true;
            }
            else {
                console.log('❌ TEST FAILED: Issues detected in bracket generation');
                return false;
            }
        }
        else {
            console.log('\n' + '='.repeat(80));
            console.log('❌ TEST FAILED: No stages found');
            return false;
        }
    }
    catch (error) {
        console.error('\n❌ TEST FAILED WITH ERROR:', error);
        return false;
    }
}
testCompleteFlow()
    .then(success => process.exit(success ? 0 : 1))
    .catch(e => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=test_complete_flow.js.map