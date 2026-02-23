/**
 * Spring Classic 2025 Tournament Seed - Local
 *
 * Seeds a second tournament to the Firebase emulators.
 * Run: npm run seed:spring2025:local
 * Requires: emulators running (npm run emulators)
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  connectFirestoreEmulator,
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { createOrSignIn } from './helpers';

const app = initializeApp({
  apiKey: 'demo-api-key',
  authDomain: 'demo-courtmaster.firebaseapp.com',
  projectId: 'demo-courtmaster',
});

const auth = getAuth(app);
const db = getFirestore(app);

connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
connectFirestoreEmulator(db, 'localhost', 8080);

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(64));
  console.log('  Seed: Spring Classic 2025 (Local Emulator)');
  console.log('='.repeat(64));

  try {
    console.log('\n[1] Setting up admin user...');
    const adminId = await createOrSignIn(auth, db, {
      email: 'admin@courtmastr.com',
      password: 'admin123',
      displayName: 'Tournament Admin',
      role: 'admin',
    });

    // Re-authenticate as admin
    await signInWithEmailAndPassword(auth, 'admin@courtmastr.com', 'admin123');

    console.log('\n[2] Creating Spring Classic 2025 Tournament...');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 30);
    startDate.setHours(8, 0, 0, 0);

    const tRef = await addDoc(collection(db, 'tournaments'), {
      name: 'Spring Classic 2025',
      description: 'Annual Spring Badminton Championship',
      sport: 'badminton',
      format: 'single_elimination',
      status: 'draft',
      state: 'SETUP',
      location: 'Springfield Community Center',
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(new Date(startDate.getTime() + 2 * 24 * 60 * 60 * 1000)),
      registrationDeadline: Timestamp.fromDate(new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000)),
      maxParticipants: 100,
      settings: {
        minRestTimeMinutes: 10,
        matchDurationMinutes: 25,
        allowSelfRegistration: true,
        requireApproval: true,
        gamesPerMatch: 3,
        pointsToWin: 21,
        mustWinBy: 2,
        maxPoints: 30,
      },
      createdBy: adminId,
      organizerIds: [adminId],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const tournamentId = tRef.id;
    console.log(`  Created tournament: ${tournamentId}`);

    console.log('\n[3] Creating Categories...');
    const categories = [
      { name: "Men's Singles", type: 'singles', gender: 'men' },
      { name: "Women's Singles", type: 'singles', gender: 'women' },
      { name: "Men's Doubles", type: 'doubles', gender: 'men' },
      { name: "Women's Doubles", type: 'doubles', gender: 'women' },
      { name: 'Mixed Doubles', type: 'mixed_doubles', gender: 'mixed' },
    ];

    for (const cat of categories) {
      const cRef = await addDoc(collection(db, 'tournaments', tournamentId, 'categories'), {
        tournamentId,
        name: cat.name,
        type: cat.type,
        gender: cat.gender,
        ageGroup: 'open',
        format: 'single_elimination',
        status: 'setup',
        seedingEnabled: true,
        maxParticipants: 32,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`  Created category: ${cat.name} (${cRef.id})`);
    }

    console.log('\n[4] Creating Courts...');
    for (let i = 1; i <= 4; i++) {
      await addDoc(collection(db, 'tournaments', tournamentId, 'courts'), {
        tournamentId,
        name: `Court ${i}`,
        number: i,
        status: 'available',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    console.log('  Created 4 courts');

    console.log('\n' + '='.repeat(64));
    console.log('  Spring Classic 2025 Seed completed successfully!');
    console.log('='.repeat(64));
    console.log(`\n  Tournament ID: ${tournamentId}`);
    console.log("  Categories: Men's Singles, Women's Singles, Men's Doubles, Women's Doubles, Mixed Doubles");
    console.log('  Status: Draft (ready for registration)');
    console.log('  Login: admin@courtmastr.com / admin123');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    process.exit(1);
  }
}

main();
