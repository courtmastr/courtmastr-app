/**
 * CourtMastr production demo seed core.
 *
 * This seed is intentionally scoped to the dedicated demo organization and
 * tournament. It never deletes production data and never mutates non-demo
 * organizations or tournaments.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions,
} from 'firebase/functions';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { ClientFirestoreStorage } from '../../src/services/brackets-storage';
import {
  createCategories,
  createCourts,
  createPlayersAndRegistrations,
  generateCategoryBracket,
  completePoolMatches,
  type CategoryRef,
} from './core';

export const DEMO_ORG_NAME = 'CourtMastr Demo Club';
export const DEMO_ORG_SLUG = 'demo';
export const DEMO_TOURNAMENT_NAME = 'CourtMastr Feature Demo';
export const DEMO_ORGANIZER_EMAIL = 'demo-organizer@courtmastr.com';
export const DEMO_ORGANIZER_DISPLAY_NAME = 'Demo Organizer';
export const DEMO_PLAYER_EMAIL_DOMAIN = 'demo.courtmastr.local';

const PRODUCTION_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAiCLrYmiFZyM_fNVxVvf34AaVHn_bPWOY',
  authDomain: 'courtmaster-v2.firebaseapp.com',
  projectId: 'courtmaster-v2',
  storageBucket: 'courtmaster-v2.firebasestorage.app',
  messagingSenderId: '137312981992',
  appId: '1:137312981992:web:a27ff1730942f3d2850a5d',
};

const LOCAL_FIREBASE_CONFIG = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-courtmaster.firebaseapp.com',
  projectId: 'demo-courtmaster',
};

export interface DemoSeedUser {
  uid: string;
  email: string;
}

export interface DemoVolunteerPins {
  checkin?: string;
  scorekeeper?: string;
}

export interface DemoSeedConfig {
  db: Firestore;
  auth: Auth;
  functions?: Functions;
  operator: DemoSeedUser;
  operatorPassword: string;
  demoOrganizerPassword: string;
  volunteerPins?: DemoVolunteerPins;
}

export interface DemoSeedResult {
  orgId: string;
  tournamentId: string;
  demoOrganizerId: string;
  createdTournament: boolean;
  volunteerPinsConfigured: string[];
}

interface StoredOpponent {
  id?: number | string | null;
}

interface StoredMatch {
  id: number | string;
  stage_id?: number | string;
  opponent1?: StoredOpponent | null;
  opponent2?: StoredOpponent | null;
}

interface StoredParticipant {
  id: number | string;
  name: string;
}

interface DemoProdEnv {
  operatorEmail: string;
  operatorPassword: string;
  demoOrganizerPassword: string;
  checkinPin?: string;
  scorekeeperPin?: string;
}

const pause = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const getRequiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

export const resolveDemoProdEnv = (): DemoProdEnv => ({
  operatorEmail: getRequiredEnv('COURTMASTR_SEED_OPERATOR_EMAIL'),
  operatorPassword: getRequiredEnv('COURTMASTR_SEED_OPERATOR_PASSWORD'),
  demoOrganizerPassword: getRequiredEnv('COURTMASTR_DEMO_ORGANIZER_PASSWORD'),
  checkinPin: process.env.COURTMASTR_DEMO_CHECKIN_PIN?.trim() || undefined,
  scorekeeperPin: process.env.COURTMASTR_DEMO_SCOREKEEPER_PIN?.trim() || undefined,
});

export const resolveDemoPaymentStatus = (
  seed: number | null,
): 'paid' | 'partial' | 'unpaid' => {
  if (!seed) return 'paid';
  if (seed % 7 === 0) return 'partial';
  if (seed % 5 === 0) return 'unpaid';
  return 'paid';
};

export const buildDemoScoreGames = (
  participant1Id: string,
  participant2Id: string,
  winnerIsParticipant1: boolean,
): Array<{
  gameNumber: number;
  score1: number;
  score2: number;
  winnerId: string;
  isComplete: boolean;
}> => {
  const winnerId = winnerIsParticipant1 ? participant1Id : participant2Id;
  return [
    {
      gameNumber: 1,
      score1: winnerIsParticipant1 ? 21 : 17,
      score2: winnerIsParticipant1 ? 17 : 21,
      winnerId,
      isComplete: true,
    },
    {
      gameNumber: 2,
      score1: winnerIsParticipant1 ? 21 : 19,
      score2: winnerIsParticipant1 ? 19 : 21,
      winnerId,
      isComplete: true,
    },
  ];
};

export const initializeDemoFirebaseApp = (mode: 'local' | 'production'): FirebaseApp =>
  initializeApp(mode === 'local' ? LOCAL_FIREBASE_CONFIG : PRODUCTION_FIREBASE_CONFIG);

export const signInSeedOperator = async (
  auth: Auth,
  db: Firestore,
  email: string,
  password: string,
): Promise<DemoSeedUser> => {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  const userSnap = await getDoc(doc(db, 'users', user.uid));
  const role = userSnap.exists() ? String(userSnap.data().role ?? '') : '';
  if (role !== 'admin') {
    throw new Error(`Seed operator ${email} must have role "admin"; found "${role || 'missing'}"`);
  }
  return { uid: user.uid, email };
};

export const createLocalSeedOperator = async (
  auth: Auth,
  db: Firestore,
): Promise<DemoSeedUser> => {
  const email = 'admin@courtmastr.com';
  const password = 'admin123';

  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', user.uid), {
      email,
      displayName: 'Tournament Admin',
      role: 'admin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { uid: user.uid, email };
  } catch (error: unknown) {
    const code = (error as { code?: string }).code ?? '';
    if (code !== 'auth/email-already-in-use') {
      throw error;
    }
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    await setDoc(
      doc(db, 'users', user.uid),
      {
        email,
        displayName: 'Tournament Admin',
        role: 'admin',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { uid: user.uid, email };
  }
};

const ensureDemoOrganizer = async (
  auth: Auth,
  db: Firestore,
  operator: DemoSeedUser,
  operatorPassword: string,
  password: string,
): Promise<string> => {
  let demoOrganizerId: string;

  try {
    const { user } = await createUserWithEmailAndPassword(auth, DEMO_ORGANIZER_EMAIL, password);
    demoOrganizerId = user.uid;
  } catch (error: unknown) {
    const code = (error as { code?: string }).code ?? '';
    if (code !== 'auth/email-already-in-use') {
      throw error;
    }
    const { user } = await signInWithEmailAndPassword(auth, DEMO_ORGANIZER_EMAIL, password);
    demoOrganizerId = user.uid;
  }

  await signInWithEmailAndPassword(auth, operator.email, operatorPassword);

  await setDoc(
    doc(db, 'users', demoOrganizerId),
    {
      email: DEMO_ORGANIZER_EMAIL,
      displayName: DEMO_ORGANIZER_DISPLAY_NAME,
      role: 'organizer',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return demoOrganizerId;
};

const createOrReuseDemoOrg = async (
  db: Firestore,
  operatorId: string,
  demoOrganizerId: string,
): Promise<string> => {
  const slugRef = doc(db, 'orgSlugIndex', DEMO_ORG_SLUG);
  const slugSnap = await getDoc(slugRef);
  const now = serverTimestamp();
  let orgId: string;

  if (slugSnap.exists()) {
    orgId = String(slugSnap.data().orgId ?? '');
    if (!orgId) {
      throw new Error(`Existing orgSlugIndex/${DEMO_ORG_SLUG} has no orgId`);
    }

    const orgSnap = await getDoc(doc(db, 'organizations', orgId));
    if (!orgSnap.exists()) {
      throw new Error(`Existing demo slug points to missing organization ${orgId}`);
    }

    const existingName = String(orgSnap.data().name ?? '');
    if (existingName !== DEMO_ORG_NAME) {
      throw new Error(
        `Slug /${DEMO_ORG_SLUG} belongs to "${existingName}", not "${DEMO_ORG_NAME}". Aborting without changes.`,
      );
    }
  } else {
    const orgRef = doc(collection(db, 'organizations'));
    orgId = orgRef.id;
    await setDoc(orgRef, {
      id: orgId,
      name: DEMO_ORG_NAME,
      slug: DEMO_ORG_SLUG,
      logoUrl: null,
      bannerUrl: null,
      contactEmail: DEMO_ORGANIZER_EMAIL,
      timezone: 'America/Chicago',
      about: 'CourtMastr demo organization for production feature trials.',
      website: null,
      city: 'Bloomington, IL',
      foundedYear: 2026,
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(slugRef, { orgId, createdAt: now });
  }

  await setDoc(doc(db, 'organizations', orgId, 'members', operatorId), {
    uid: operatorId,
    role: 'admin',
    joinedAt: now,
  }, { merge: true });
  await setDoc(doc(db, 'organizations', orgId, 'members', demoOrganizerId), {
    uid: demoOrganizerId,
    role: 'organizer',
    joinedAt: now,
  }, { merge: true });
  await setDoc(doc(db, 'users', demoOrganizerId), {
    activeOrgId: orgId,
    updatedAt: now,
  }, { merge: true });

  return orgId;
};

const createOrReuseDemoTournament = async (
  db: Firestore,
  operatorId: string,
  demoOrganizerId: string,
  orgId: string,
): Promise<{ tournamentId: string; created: boolean }> => {
  const existingSnapshot = await getDocs(
    query(
      collection(db, 'tournaments'),
      where('orgId', '==', orgId),
      where('name', '==', DEMO_TOURNAMENT_NAME),
    ),
  );

  if (existingSnapshot.size > 1) {
    throw new Error(
      `Found ${existingSnapshot.size} demo tournaments named "${DEMO_TOURNAMENT_NAME}" under demo org. Resolve duplicates manually before re-running.`,
    );
  }

  if (existingSnapshot.size === 1) {
    const existing = existingSnapshot.docs[0];
    await updateDoc(existing.ref, {
      organizerIds: arrayUnion(operatorId, demoOrganizerId),
      updatedAt: serverTimestamp(),
    });
    return { tournamentId: existing.id, created: false };
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 7);
  startDate.setHours(9, 0, 0, 0);

  const tournamentRef = await addDoc(collection(db, 'tournaments'), {
    name: DEMO_TOURNAMENT_NAME,
    description: 'Production demo tournament for testing CourtMastr organizer, check-in, scoring, schedule, public, and leaderboard workflows.',
    sport: 'badminton',
    format: 'pool_to_elimination',
    status: 'active',
    state: 'LIVE',
    location: 'CourtMastr Demo Arena',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(new Date(startDate.getTime() + 9 * 60 * 60 * 1000)),
    registrationDeadline: Timestamp.fromDate(new Date()),
    maxParticipants: 128,
    orgId,
    settings: {
      minRestTimeMinutes: 15,
      matchDurationMinutes: 20,
      allowSelfRegistration: false,
      requireApproval: false,
      gamesPerMatch: 3,
      pointsToWin: 21,
      mustWinBy: 2,
      maxPoints: 30,
      autoAssignEnabled: true,
      autoStartEnabled: false,
      autoReadyLeadMinutes: 15,
      autoAssignDueWindowMinutes: 45,
    },
    createdBy: operatorId,
    organizerIds: [operatorId, demoOrganizerId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { tournamentId: tournamentRef.id, created: true };
};

const applyDemoRegistrationState = async (
  db: Firestore,
  tournamentId: string,
): Promise<void> => {
  const registrations = await getDocs(collection(db, 'tournaments', tournamentId, 'registrations'));

  for (const registrationSnap of registrations.docs) {
    const data = registrationSnap.data() as {
      seed?: number | null;
      playerId?: string;
      partnerPlayerId?: string;
    };
    const seed = typeof data.seed === 'number' ? data.seed : null;
    const participantPresence: Record<string, boolean> = {};
    if (data.playerId) participantPresence[data.playerId] = true;
    if (data.partnerPlayerId) participantPresence[data.partnerPlayerId] = true;

    await setDoc(
      registrationSnap.ref,
      {
        status: 'checked_in',
        isCheckedIn: true,
        participantPresence,
        checkInSource: 'admin',
        checkedInAt: serverTimestamp(),
        paymentStatus: resolveDemoPaymentStatus(seed),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
};

const getCategoryRegistrations = async (
  db: Firestore,
  tournamentId: string,
  categoryId: string,
): Promise<Array<{ id: string; seed: number | null; playerId?: string; partnerPlayerId?: string }>> => {
  const snapshot = await getDocs(
    query(
      collection(db, 'tournaments', tournamentId, 'registrations'),
      where('categoryId', '==', categoryId),
    ),
  );

  return snapshot.docs.map((registrationDoc) => {
    const data = registrationDoc.data() as {
      seed?: number | null;
      playerId?: string;
      partnerPlayerId?: string;
    };
    return {
      id: registrationDoc.id,
      seed: typeof data.seed === 'number' ? data.seed : null,
      playerId: data.playerId,
      partnerPlayerId: data.partnerPlayerId,
    };
  });
};

const seedOperationalMatchSamples = async (
  db: Firestore,
  tournamentId: string,
  categories: CategoryRef[],
): Promise<void> => {
  const courtsSnapshot = await getDocs(collection(db, 'tournaments', tournamentId, 'courts'));
  const courtIds = courtsSnapshot.docs.map((courtDoc) => courtDoc.id);
  const start = new Date();
  start.setHours(start.getHours() + 1, 0, 0, 0);

  for (const category of categories.filter((candidate) => candidate.config.key !== 'mens_doubles')) {
    const storage = new ClientFirestoreStorage(db, `tournaments/${tournamentId}/categories/${category.id}`);
    const rawMatches = await storage.select<StoredMatch>('match');
    const rawParticipants = await storage.select<StoredParticipant>('participant');
    const matches = (Array.isArray(rawMatches) ? rawMatches : rawMatches ? [rawMatches] : [])
      .filter((match) => match.opponent1?.id != null && match.opponent2?.id != null)
      .slice(0, 3);
    const participants = Array.isArray(rawParticipants)
      ? rawParticipants
      : rawParticipants
        ? [rawParticipants]
        : [];
    const registrationIdByParticipantId = new Map<number, string>(
      participants.map((participant) => [Number(participant.id), participant.name]),
    );

    for (let index = 0; index < matches.length; index += 1) {
      const match = matches[index];
      const participant1Id = registrationIdByParticipantId.get(Number(match.opponent1?.id));
      const participant2Id = registrationIdByParticipantId.get(Number(match.opponent2?.id));
      if (!participant1Id || !participant2Id) continue;

      const plannedStartAt = new Date(start.getTime() + index * 25 * 60_000);
      const plannedEndAt = new Date(plannedStartAt.getTime() + 20 * 60_000);
      const matchId = String(match.id);
      const courtId = courtIds[index] ?? null;
      const status = index === 0 ? 'scheduled' : index === 1 ? 'ready' : 'in_progress';

      await setDoc(
        doc(db, 'tournaments', tournamentId, 'categories', category.id, 'match_scores', matchId),
        {
          tournamentId,
          categoryId: category.id,
          participant1Id,
          participant2Id,
          status,
          courtId,
          scheduledTime: Timestamp.fromDate(plannedStartAt),
          plannedStartAt: Timestamp.fromDate(plannedStartAt),
          plannedEndAt: Timestamp.fromDate(plannedEndAt),
          scheduleStatus: 'published',
          publishedAt: serverTimestamp(),
          publishedBy: 'demo-seed',
          scores: index === 2
            ? [{
                gameNumber: 1,
                score1: 8,
                score2: 6,
                isComplete: false,
              }]
            : status === 'in_progress'
              ? [{
                  gameNumber: 1,
                  score1: 0,
                  score2: 0,
                  isComplete: false,
                }]
              : [],
          ...(index === 2 ? { startedAt: serverTimestamp() } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }
  }
};

const configureVolunteerPins = async (
  functions: Functions | undefined,
  tournamentId: string,
  pins: DemoVolunteerPins | undefined,
): Promise<string[]> => {
  if (!functions || !pins) return [];
  const configured: string[] = [];
  const setVolunteerPin = httpsCallable(functions, 'setVolunteerPin');

  if (pins.checkin) {
    await setVolunteerPin({ tournamentId, role: 'checkin', pin: pins.checkin, enabled: true });
    configured.push('checkin');
  }

  if (pins.scorekeeper) {
    await setVolunteerPin({ tournamentId, role: 'scorekeeper', pin: pins.scorekeeper, enabled: true });
    configured.push('scorekeeper');
  }

  return configured;
};

export const runDemoSeed = async (config: DemoSeedConfig): Promise<DemoSeedResult> => {
  const demoOrganizerId = await ensureDemoOrganizer(
    config.auth,
    config.db,
    config.operator,
    config.operatorPassword,
    config.demoOrganizerPassword,
  );
  const orgId = await createOrReuseDemoOrg(config.db, config.operator.uid, demoOrganizerId);
  const tournament = await createOrReuseDemoTournament(
    config.db,
    config.operator.uid,
    demoOrganizerId,
    orgId,
  );

  if (!tournament.created) {
    const volunteerPinsConfigured = await configureVolunteerPins(
      config.functions,
      tournament.tournamentId,
      config.volunteerPins,
    );
    return {
      orgId,
      tournamentId: tournament.tournamentId,
      demoOrganizerId,
      createdTournament: false,
      volunteerPinsConfigured,
    };
  }

  await createCourts(config.db, tournament.tournamentId);
  const categories = await createCategories(config.db, tournament.tournamentId);
  const registrationsByCategory = await createPlayersAndRegistrations(
    config.db,
    tournament.tournamentId,
    config.operator.uid,
    categories,
    { playerEmailDomain: DEMO_PLAYER_EMAIL_DOMAIN },
  );
  await applyDemoRegistrationState(config.db, tournament.tournamentId);

  let doublesCategory: CategoryRef | null = null;
  let doublesStageId: number | null = null;
  for (const category of categories) {
    const registrations = registrationsByCategory.get(category.id) ?? [];
    const stageId = await generateCategoryBracket(
      config.db,
      tournament.tournamentId,
      category,
      registrations,
    );
    if (category.config.key === 'mens_doubles') {
      doublesCategory = category;
      doublesStageId = stageId;
    }
  }

  if (doublesCategory && doublesStageId !== null) {
    const doublesRegistrations = await getCategoryRegistrations(
      config.db,
      tournament.tournamentId,
      doublesCategory.id,
    );
    await completePoolMatches(
      config.db,
      tournament.tournamentId,
      doublesCategory.id,
      doublesStageId,
      doublesRegistrations,
    );
  }

  await seedOperationalMatchSamples(config.db, tournament.tournamentId, categories);
  const volunteerPinsConfigured = await configureVolunteerPins(
    config.functions,
    tournament.tournamentId,
    config.volunteerPins,
  );

  await pause(100);

  return {
    orgId,
    tournamentId: tournament.tournamentId,
    demoOrganizerId,
    createdTournament: true,
    volunteerPinsConfigured,
  };
};

export const connectDemoFunctionsEmulator = (
  app: FirebaseApp,
  host = 'localhost',
  port = 5001,
): Functions => {
  const functions = getFunctions(app);
  connectFunctionsEmulator(functions, host, port);
  return functions;
};
