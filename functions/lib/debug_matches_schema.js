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
// Auto-detect emulator or set explicitly
if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('⚠️  FIRESTORE_EMULATOR_HOST not set. Defaulting to localhost:8080');
    console.log('   Make sure the emulator is running: npm run emulators');
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}
// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'demo-courtmaster',
    });
}
console.log(`🔌 Connecting to Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}\n`);
const db = admin.firestore();
async function debugMatches(tournamentId) {
    console.log(`\n🔍 Debugging matches for tournament: ${tournamentId}`);
    // 1. List all matches in the 'match' collection (brackets-manager schema)
    const matchesRef = db.collection(`tournaments/${tournamentId}/match`);
    const snapshot = await matchesRef.get();
    console.log(`Found ${snapshot.size} matches in 'match' collection.`);
    if (snapshot.empty) {
        console.log('❌ No matches found!');
        return;
    }
    // 2. Print the first match to see its structure
    const firstMatch = snapshot.docs[0].data();
    console.log('\n📄 First match structure:', JSON.stringify(firstMatch, null, 2));
    // 3. Check for stage_id field
    if (firstMatch.stage_id) {
        console.log(`\n✅ Match has 'stage_id': ${firstMatch.stage_id} (Type: ${typeof firstMatch.stage_id})`);
    }
    else {
        console.log('\n❌ Match matches missing "stage_id" field!');
        console.log('Available fields:', Object.keys(firstMatch));
    }
}
// Run with the tournament ID from the screenshot
debugMatches('uAotrf2nIfFaoZkDTJ2u').catch(console.error);
//# sourceMappingURL=debug_matches_schema.js.map