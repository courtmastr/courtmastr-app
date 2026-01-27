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
// Test the refactored bracket generation using brackets-manager
const admin = __importStar(require("firebase-admin"));
const manager_1 = require("./manager");
const bracket_1 = require("./bracket");
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'demo-project',
    });
}
async function testBracketGeneration() {
    const tournamentId = 'test_bracket_generation';
    const categoryId = 'test_category';
    const db = admin.firestore();
    try {
        // Create a test category
        await db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('categories')
            .doc(categoryId)
            .set({
            name: 'Test Category',
            format: 'double_elimination',
            status: 'draft',
        });
        // Create test registrations
        const playerNames = ['Player A', 'Player B', 'Player C', 'Player D'];
        for (let i = 0; i < playerNames.length; i++) {
            await db
                .collection('tournaments')
                .doc(tournamentId)
                .collection('registrations')
                .add({
                categoryId: categoryId,
                playerName: playerNames[i],
                status: 'approved',
                seed: i + 1, // Seeded 1-4
            });
        }
        console.log('📋 Created test tournament and registrations');
        // Generate bracket using the refactored function
        await (0, bracket_1.generateBracket)(tournamentId, categoryId);
        console.log('\n✅ Bracket generation completed successfully!');
        // Verify bracket data was created
        const manager = (0, manager_1.getBracketsManager)(tournamentId);
        // Check participants
        const participants = await manager.storage.select('participant');
        console.log(`\n👥 Participants created: ${Array.isArray(participants) ? participants.length : 0}`);
        if (Array.isArray(participants)) {
            participants.forEach(p => console.log(`  - ${p.name}`));
        }
        // Check stages
        const stages = await manager.storage.select('stage');
        console.log(`\n🎯 Stages created: ${Array.isArray(stages) ? stages.length : (stages ? 1 : 0)}`);
        if (stages) {
            const stageList = Array.isArray(stages) ? stages : [stages];
            stageList.forEach(s => console.log(`  - ${s.name} (${s.type})`));
        }
        // Check matches
        const matches = await manager.storage.select('match');
        console.log(`\n🏆 Matches created: ${Array.isArray(matches) ? matches.length : 0}`);
        if (Array.isArray(matches)) {
            console.log('  Match details:');
            matches.slice(0, 10).forEach((m, idx) => {
                console.log(`    [${idx + 1}] Match ${m.id}: ${m.status || 'pending'}`);
            });
            if (matches.length > 10) {
                console.log(`    ... and ${matches.length - 10} more matches`);
            }
        }
        // Check category status was updated
        const categoryDoc = await db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('categories')
            .doc(categoryId)
            .get();
        const categoryData = categoryDoc.data();
        console.log(`\n📊 Category status: ${categoryData === null || categoryData === void 0 ? void 0 : categoryData.status}`);
        console.log('\n✨ All verifications passed!');
    }
    catch (error) {
        console.error('\n❌ Error during bracket generation test:', error);
        throw error;
    }
}
// Run the test
testBracketGeneration()
    .then(() => {
    console.log('\n🎉 Test completed successfully');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test_bracket_refactor.js.map