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
/**
 * Test script to call generateBracket and see debug logs
 */
const admin = __importStar(require("firebase-admin"));
const bracket_1 = require("./bracket");
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'demo-courtmaster',
    });
}
// Connect to emulators
const db = admin.firestore();
db.settings({
    host: 'localhost:8080',
    ssl: false,
});
async function testBracketGeneration() {
    const tournamentId = 'QOVnXUV2g8cWRoeJFDN4';
    // Get categories
    const categoriesSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('categories')
        .get();
    console.log(`\n📋 Found ${categoriesSnapshot.docs.length} categories:\n`);
    for (const catDoc of categoriesSnapshot.docs) {
        const cat = catDoc.data();
        console.log(`  - ${cat.name} (${catDoc.id}): ${cat.format}`);
    }
    // Generate bracket for Men's Singles
    const mensCategory = categoriesSnapshot.docs.find(d => d.data().name === "Men's Singles");
    if (!mensCategory) {
        console.error('❌ Men\'s Singles category not found!');
        process.exit(1);
    }
    console.log(`\n🎯 Generating bracket for Men's Singles (${mensCategory.id})...\n`);
    console.log('='.repeat(80));
    try {
        await (0, bracket_1.generateBracket)(tournamentId, mensCategory.id);
        console.log('='.repeat(80));
        console.log('\n✅ Bracket generation completed!\n');
        // Check if matches were created in legacy schema
        const matchesSnapshot = await db
            .collection('tournaments')
            .doc(tournamentId)
            .collection('matches')
            .where('categoryId', '==', mensCategory.id)
            .get();
        console.log(`\n📊 Legacy matches created: ${matchesSnapshot.docs.length}`);
        if (matchesSnapshot.docs.length > 0) {
            console.log('\n📝 First 3 matches:');
            matchesSnapshot.docs.slice(0, 3).forEach((doc, i) => {
                const m = doc.data();
                console.log(`  ${i + 1}. Round ${m.round}, Match ${m.matchNumber} (${m.bracketType})`);
                console.log(`     P1: ${m.participant1Id}, P2: ${m.participant2Id}`);
            });
        }
    }
    catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
    process.exit(0);
}
testBracketGeneration();
//# sourceMappingURL=test_bracket_debug.js.map