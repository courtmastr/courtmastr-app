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
 * Check synced matches by bracketType
 */
const admin = __importStar(require("firebase-admin"));
if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'demo-courtmaster' });
}
const db = admin.firestore();
db.settings({ host: 'localhost:8080', ssl: false });
async function checkMatches() {
    const tournamentId = 'mfRQv4yFdOTv3GJNWPAW';
    const matchesSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('matches')
        .get();
    console.log(`\n📊 Total matches: ${matchesSnapshot.docs.length}\n`);
    // Group by bracketType
    const byType = {};
    const byRound = {};
    matchesSnapshot.docs.forEach(doc => {
        const m = doc.data();
        byType[m.bracketType] = (byType[m.bracketType] || 0) + 1;
        const key = `${m.bracketType}-R${m.round}`;
        if (!byRound[key])
            byRound[key] = [];
        byRound[key].push({
            round: m.round,
            matchNumber: m.matchNumber,
            bracketType: m.bracketType,
            p1: m.participant1Id,
            p2: m.participant2Id
        });
    });
    console.log('By Bracket Type:');
    Object.entries(byType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count} matches`);
    });
    console.log('\nFirst 3 matches from each bracket:');
    ['winners', 'losers', 'finals'].forEach(type => {
        console.log(`\n${type.toUpperCase()}:`);
        const rounds = Object.keys(byRound)
            .filter(k => k.startsWith(type))
            .sort();
        rounds.slice(0, 2).forEach(key => {
            const matches = byRound[key].slice(0, 3);
            console.log(`  ${key}:`);
            matches.forEach(m => {
                console.log(`    #${m.matchNumber}: ${m.p1 ? 'Player' : 'BYE'} vs ${m.p2 ? 'Player' : 'BYE'}`);
            });
        });
    });
    process.exit(0);
}
checkMatches();
//# sourceMappingURL=check_matches.js.map