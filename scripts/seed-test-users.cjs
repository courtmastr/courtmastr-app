#!/usr/bin/env node
/**
 * Seed Test Users for E2E Testing
 * 
 * This script creates test users in the Firebase emulator for E2E tests.
 * Run this before executing Playwright tests.
 * 
 * Usage: node scripts/seed-test-users.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc } = require('firebase/firestore');

// Firebase emulator configuration
const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-courtmaster.firebaseapp.com',
  projectId: 'demo-courtmaster',
  storageBucket: 'demo-courtmaster.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
};

const testUsers = [
  {
    email: 'admin@courtmaster.local',
    password: 'admin123',
    role: 'admin',
    displayName: 'Admin User',
  },
  {
    email: 'scorekeeper@courtmaster.local',
    password: 'score123',
    role: 'scorekeeper',
    displayName: 'Scorekeeper User',
  },
  {
    email: 'organizer@courtmaster.local',
    password: 'organizer123',
    role: 'organizer',
    displayName: 'Tournament Organizer',
  },
  {
    email: 'player@courtmaster.local',
    password: 'player123',
    role: 'player',
    displayName: 'Test Player',
  },
];

async function seedTestUsers() {
  console.log('🌱 Seeding test users for E2E testing...\n');

  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Connect to emulators
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);

    console.log('🔧 Connected to Firebase Emulators\n');

    let created = 0;
    let existing = 0;
    let failed = 0;

    for (const user of testUsers) {
      try {
        // Check if user already exists by trying to sign in
        try {
          await signInWithEmailAndPassword(auth, user.email, user.password);
          console.log(`⏭️  User already exists: ${user.email} (${user.role})`);
          existing++;
          continue;
        } catch (signInError) {
          // User doesn't exist, proceed to create
        }

        // Create user in Auth
        const { user: firebaseUser } = await createUserWithEmailAndPassword(
          auth,
          user.email,
          user.password
        );

        // Create user profile in Firestore
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        console.log(`✅ Created user: ${user.email} (${user.role})`);
        created++;
      } catch (error) {
        console.error(`❌ Failed to create ${user.email}: ${error.message}`);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Existing: ${existing}`);
    console.log(`   Failed: ${failed}`);
    console.log('='.repeat(50));

    if (failed === 0) {
      console.log('\n✨ Test users ready for E2E testing!');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some users failed to create');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('Make sure Firebase emulators are running:');
    console.error('   npm run emulators');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedTestUsers();
}

module.exports = { seedTestUsers, testUsers };
