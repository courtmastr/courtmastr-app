import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { createOrSignIn } from './helpers';
import { runHistorySeed } from './history-test-core';

async function main() {
  const app = initializeApp({
    apiKey: 'demo-api-key',
    authDomain: 'demo-courtmaster.firebaseapp.com',
    projectId: 'demo-courtmaster',
  });

  const auth = getAuth(app);
  const db = getFirestore(app);

  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  
  console.log('\n[1] Authenticating...');
  const adminId = await createOrSignIn(auth, db, {
    email: 'admin@courtmastr.com',
    password: 'admin123',
    displayName: 'Seed Admin',
    role: 'admin',
  });
  
  await runHistorySeed(db, adminId);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
