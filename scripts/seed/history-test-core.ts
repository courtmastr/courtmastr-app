import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { createSeedOrg, seedGlobalPlayer } from './helpers';
import { BracketsManager } from 'brackets-manager';
import { ClientFirestoreStorage } from '../../src/services/brackets-storage';

// Same MCIA setup
const MENS_DOUBLES = [
  'Christuraj & Abhiram Madugula', 'Kishore Subbarao & Ramc Venkatasamy', 'Sakthi & Sahaya Vinodh', 'Sivakumar Srinivasulu & Vijaysivakumar Moorthy',
  'Sai kiran Chekuri & Prakash Mukku', 'Gowtham Kandasamy & Arjun Ponnapati', 'Sakthivel Shanmugam & Sakthinesan', 'Shakthi Rajendran & Nirmal Anandam',
  'Sudhan Sekar & Dhrumil Trivedj', 'Ranjith Vijayasekar & Vinothkumar Nagarajan', 'Mathibal Balasubramanian & Srikanth Marikkannu', 'Dinesh Krishnan & Siva shankar Raghunathan',
  'Aamir Abdullah & Rajesh Panicker', 'Karthik Kalairajan & Manoj Edward', 'Arjun Chinamgari & Himesh Reddivari', 'Kothandaraman Narasiman & Jawaharbabu Jayaram'
] as const;

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function splitPersonName(fullName: string): { firstName: string; lastName: string } {
  const normalized = normalizeName(fullName);
  const tokens = normalized.split(' ');
  const firstName = tokens.shift() || normalized;
  const lastName = tokens.join(' ') || '-';
  return { firstName, lastName };
}

async function simulateStage(db: Firestore, tournamentId: string, categoryId: string, stageId: number) {
  const storage = new ClientFirestoreStorage(db, `tournaments/${tournamentId}/categories/${categoryId}`);
  const manager = new BracketsManager(storage);
  
  let playing = true;
  let matchesPlayedCount = 0;
  
  while (playing) {
    const rawMatches = await storage.select('match', { stage_id: stageId });
    const matches = Array.isArray(rawMatches) ? rawMatches : (rawMatches ? [rawMatches] : []);
    let playedThisRound = false;

    for (const match of matches) {
      if ((match as any).status !== 2) continue;
      
      const opp1 = (match as any).opponent1;
      const opp2 = (match as any).opponent2;
      
      if (opp1?.id == null || opp2?.id == null) continue;
      
      const p1Id = opp1.id;
      const p2Id = opp2.id;
      
      const p1RowRaw = await storage.select('participant', { id: p1Id });
      const p2RowRaw = await storage.select('participant', { id: p2Id });
      const p1Row = Array.isArray(p1RowRaw) ? p1RowRaw[0] : p1RowRaw;
      const p2Row = Array.isArray(p2RowRaw) ? p2RowRaw[0] : p2RowRaw;
      
      const reg1 = (p1Row as any)?.name;
      const reg2 = (p2Row as any)?.name;
      
      if (!reg1 || !reg2) continue;
      
      const p1Wins = Math.random() > 0.5;
      
      await manager.update.match({
        id: (match as any).id,
        opponent1: { result: p1Wins ? 'win' : 'loss', score: p1Wins ? 21 : 12 },
        opponent2: { result: p1Wins ? 'loss' : 'win', score: p1Wins ? 12 : 21 }
      });
      
      const winnerId = p1Wins ? reg1 : reg2;
      
      const scoreDoc = doc(db, 'tournaments', tournamentId, 'categories', categoryId, 'match_scores', String((match as any).id));
      await setDoc(scoreDoc, {
        tournamentId,
        status: 'completed',
        winnerId,
        scores: [{ gameNumber: 1, score1: p1Wins ? 21 : 12, score2: p1Wins ? 12 : 21, winnerId, isComplete: true }],
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      playedThisRound = true;
      matchesPlayedCount++;
    }
    
    if (!playedThisRound) playing = false;
  }
  
  return matchesPlayedCount;
}

async function createFinishedTournament(db: Firestore, adminId: string, orgId: string, name: string, yearOffset: number) {
  console.log(`\n--- Creating Tournament: ${name} ---`);
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() + yearOffset);
  
  const tourneyRef = await addDoc(collection(db, 'tournaments'), {
    name,
    orgId,
    description: "Historical tournament data for analytics testing",
    sport: 'badminton',
    format: 'single_elimination',
    status: 'active',
    state: 'LIVE',
    location: 'MCIA Venue',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(new Date(startDate.getTime() + 8 * 60 * 60 * 1000)),
    registrationDeadline: Timestamp.fromDate(new Date(startDate.getTime() - 24 * 60 * 60 * 1000)),
    maxParticipants: 32,
    createdBy: adminId,
    organizerIds: [adminId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const tId = tourneyRef.id;
  
  const catRef = await addDoc(collection(db, 'tournaments', tId, 'categories'), {
    tournamentId: tId,
    name: "Men's Doubles",
    type: 'doubles',
    gender: 'men',
    ageGroup: 'open',
    format: 'single_elimination',
    status: 'completed',
    seedingEnabled: true,
    maxParticipants: 16,
    bracketGeneratedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const cId = catRef.id;
  
  const playerIdByName = new Map<string, string>();
  const emailIdCache = new Map<string, string>();
  
  console.log(`  Registering teams...`);
  const participants = [];
  
  let seed = 1;
  for (const rawTeam of MENS_DOUBLES) {
    const parts = normalizeName(rawTeam).split(/\s*&\s*/);
    const p1Name = parts[0];
    const p2Name = parts[1];
    
    // Player 1
    let p1Id = playerIdByName.get(p1Name);
    if (!p1Id) {
      const { firstName, lastName } = splitPersonName(p1Name);
      const safeEmail = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '.') + '@mcia2026.local';
      p1Id = await seedGlobalPlayer(db, tId, { firstName, lastName, email: safeEmail, phone: '555-0000', gender: 'male', skillLevel: 5 }, emailIdCache);
      playerIdByName.set(p1Name, p1Id);
    }
    
    // Player 2
    let p2Id = playerIdByName.get(p2Name);
    if (!p2Id) {
      const { firstName, lastName } = splitPersonName(p2Name);
      const safeEmail = `${firstName}.${lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '.') + '@mcia2026.local';
      p2Id = await seedGlobalPlayer(db, tId, { firstName, lastName, email: safeEmail, phone: '555-0000', gender: 'male', skillLevel: 5 }, emailIdCache);
      playerIdByName.set(p2Name, p2Id);
    }
    
    const regRef = await addDoc(collection(db, 'tournaments', tId, 'registrations'), {
      tournamentId: tId,
      categoryId: cId,
      participantType: 'team',
      playerId: p1Id,
      partnerPlayerId: p2Id,
      teamName: rawTeam,
      status: 'approved',
      seed,
      registeredBy: adminId,
      registeredAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    participants.push({ id: seed, tournament_id: cId, name: regRef.id });
    seed++;
  }
  
  console.log(`  Generating brackets...`);
  const storage = new ClientFirestoreStorage(db, `tournaments/${tId}/categories/${cId}`);
  const manager = new BracketsManager(storage);
  
  await storage.insert('participant', participants);
  
  const seedingIds = Array.from({ length: participants.length }, (_, i) => i + 1);
  const stage = await manager.create.stage({
    tournamentId: cId,
    name: "Men's Doubles",
    type: 'single_elimination',
    seedingIds,
    settings: { seedOrdering: ['inner_outer'] },
  });
  
  const stageId = Number((stage as any).id);
  
  await setDoc(doc(db, 'tournaments', tId, 'categories', cId), {
    stageId, poolStageId: null, eliminationStageId: null,
    updatedAt: serverTimestamp()
  }, { merge: true });
  
  console.log(`  Simulating matches...`);
  const matchesSimulated = await simulateStage(db, tId, cId, stageId);
  console.log(`  Finished simulating ${matchesSimulated} matches.`);

  // Update status to 'completed' to trigger stats aggregation Cloud Function
  await setDoc(doc(db, 'tournaments', tId), {
    status: 'completed',
    state: 'COMPLETED',
    updatedAt: serverTimestamp()
  }, { merge: true });
  console.log(`  Tournament ${name} marked as completed (triggering stats).`);
}

export async function runHistorySeed(db: Firestore, adminId: string) {
  console.log('\n[2] Creating Org: MCIA Historical Society');
  const orgId = await createSeedOrg(db, adminId, { name: 'MCIA Historical Society', slug: 'mcia-history' });
  
  await createFinishedTournament(db, adminId, orgId, 'MCIA Badminton 2025', -1);
  await createFinishedTournament(db, adminId, orgId, 'MCIA Badminton 2026', 0);
  
  console.log('\n======================================================');
  console.log('Historical test seed completed successfully.');
  console.log('Log in with admin@courtmastr.com / admin123');
  console.log('======================================================\n');
}
