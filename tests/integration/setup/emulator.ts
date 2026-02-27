import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

interface EmulatorContext {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
}

let cachedContext: EmulatorContext | null = null;

const isAlreadyConnectedError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /already|started|initialized/i.test(error.message);
};

export const getEmulatorApp = (): EmulatorContext => {
  if (cachedContext) {
    return cachedContext;
  }

  const app = getApps().find((entry) => entry.name === 'tests-emulator')
    ?? initializeApp(
      {
        apiKey: 'demo-api-key',
        appId: 'demo-app-id',
        authDomain: 'localhost',
        projectId: 'demo-courtmaster',
      },
      'tests-emulator'
    );

  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app);

  const host = process.env.FIREBASE_EMULATOR_HOST || '127.0.0.1';

  try {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  } catch (error) {
    if (!isAlreadyConnectedError(error)) throw error;
  }

  try {
    connectFirestoreEmulator(db, host, 8080);
  } catch (error) {
    if (!isAlreadyConnectedError(error)) throw error;
  }

  try {
    connectFunctionsEmulator(functions, host, 5001);
  } catch (error) {
    if (!isAlreadyConnectedError(error)) throw error;
  }

  cachedContext = {
    app,
    auth,
    db,
    functions,
  };

  return cachedContext;
};

export const resetEmulatorApp = (): void => {
  cachedContext = null;
};
