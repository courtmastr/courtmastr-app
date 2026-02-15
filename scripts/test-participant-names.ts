import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-courtmaster.firebaseapp.com',
  projectId: 'demo-courtmaster',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
connectFirestoreEmulator(db, 'localhost', 8080);

const TOURNAMENT_ID = '3DJe3nq66JrAg2O8yvHN';
const CATEGORY_ID = '5kxWVQQCsizFbaeBCnvz';

async function testParticipantNameResolution() {
  console.log('=== Testing Participant Name Resolution ===\n');

  try {
    console.log('1. Fetching participants...');
    const participantPath = `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/participant`;
    const participantSnap = await getDocs(collection(db, participantPath));
    const participants = participantSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`   Found ${participants.length} participants`);
    console.log('   Sample:', participants.slice(0, 2).map(p => `ID:${p.id} -> RegID:${p.name}`));

    console.log('\n2. Fetching registrations...');
    const registrationSnap = await getDocs(collection(db, `tournaments/${TOURNAMENT_ID}/registrations`));
    const registrations = registrationSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`   Found ${registrations.length} registrations`);

    console.log('\n3. Fetching players...');
    const playerSnap = await getDocs(collection(db, `tournaments/${TOURNAMENT_ID}/players`));
    const players = playerSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`   Found ${players.length} players`);

    console.log('\n4. Testing name resolution chain...');
    const testParticipant = participants[0];
    if (testParticipant) {
      console.log(`   Participant ID: ${testParticipant.id}`);
      console.log(`   Registration ID (from participant.name): ${testParticipant.name}`);
      
      const registration = registrations.find(r => r.id === testParticipant.name);
      if (registration) {
        console.log(`   Found registration: ${registration.id}`);
        console.log(`   Player ID: ${registration.playerId}`);
        
        const player = players.find(p => p.id === registration.playerId);
        if (player) {
          console.log(`   Player Name: ${player.firstName} ${player.lastName}`);
          console.log('   ✅ Name resolution chain works!');
        } else {
          console.log('   ❌ Player not found');
        }
      } else {
        console.log('   ❌ Registration not found');
      }
    }

    console.log('\n5. Checking match opponent mapping...');
    const matchPath = `tournaments/${TOURNAMENT_ID}/categories/${CATEGORY_ID}/match`;
    const matchSnap = await getDocs(collection(db, matchPath));
    const matches = matchSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    if (matches.length > 0) {
      const testMatch = matches[0];
      console.log(`   Match ${testMatch.id}:`);
      console.log(`   Opponent1 ID: ${testMatch.opponent1?.id}`);
      
      const opponentParticipant = participants.find(p => p.id === String(testMatch.opponent1?.id));
      if (opponentParticipant) {
        console.log(`   -> Participant found: ${opponentParticipant.id}`);
        console.log(`   -> Registration ID: ${opponentParticipant.name}`);
        
        const opponentRegistration = registrations.find(r => r.id === opponentParticipant.name);
        if (opponentRegistration) {
          console.log(`   -> Registration found: ${opponentRegistration.id}`);
          
          const opponentPlayer = players.find(p => p.id === opponentRegistration.playerId);
          if (opponentPlayer) {
            console.log(`   -> Player: ${opponentPlayer.firstName} ${opponentPlayer.lastName}`);
            console.log('   ✅ Full mapping works!');
          }
        }
      } else {
        console.log('   ⚠️  No participant found for opponent1');
      }
    }

    console.log('\n=== TEST COMPLETE ===');

  } catch (err) {
    console.error('❌ ERROR:', err);
  }
}

testParticipantNameResolution().then(() => process.exit(0));
