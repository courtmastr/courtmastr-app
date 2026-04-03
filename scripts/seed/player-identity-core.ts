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

interface IdentityCasePlayerConfig {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: 'male' | 'female';
  skillLevel: number;
}

interface PlayerIdentitySeedResult {
  orgId: string;
  tournamentId: string;
  singlesCategoryId: string;
  doublesCategoryId: string;
  cases: {
    primaryMerge: {
      sourcePlayerId: string;
      targetPlayerId: string;
      route: string;
    };
    partnerMerge: {
      sourcePlayerId: string;
      targetPlayerId: string;
      route: string;
    };
    sameTeamGuard: {
      sourcePlayerId: string;
      targetPlayerId: string;
      route: string;
    };
    inactiveTargetGuard: {
      sourcePlayerId: string;
      targetPlayerId: string;
      route: string;
    };
  };
}

const makePlayer = async (
  db: Firestore,
  tournamentId: string,
  emailIdCache: Map<string, string>,
  config: IdentityCasePlayerConfig
): Promise<string> => seedGlobalPlayer(db, tournamentId, config, emailIdCache);

const createLabTournament = async (
  db: Firestore,
  adminId: string,
  orgId: string
): Promise<{ tournamentId: string; singlesCategoryId: string; doublesCategoryId: string }> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 2);
  startDate.setHours(9, 0, 0, 0);

  const tournamentRef = await addDoc(collection(db, 'tournaments'), {
    name: 'Player Identity Merge Lab',
    description: 'Targeted CourtMastr seed for player identity v2 linking and merge testing.',
    sport: 'badminton',
    format: 'pool_to_elimination',
    status: 'active',
    state: 'LIVE',
    location: 'Identity Test Center',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(new Date(startDate.getTime() + 6 * 60 * 60 * 1000)),
    registrationDeadline: Timestamp.fromDate(new Date(startDate.getTime() - 24 * 60 * 60 * 1000)),
    maxParticipants: 64,
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
    },
    createdBy: adminId,
    organizerIds: [adminId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const singlesCategoryRef = await addDoc(collection(db, 'tournaments', tournamentRef.id, 'categories'), {
    tournamentId: tournamentRef.id,
    name: 'Identity Lab Singles',
    type: 'singles',
    gender: 'open',
    ageGroup: 'open',
    format: 'single_elimination',
    status: 'registration',
    seedingEnabled: true,
    maxParticipants: 16,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const doublesCategoryRef = await addDoc(collection(db, 'tournaments', tournamentRef.id, 'categories'), {
    tournamentId: tournamentRef.id,
    name: 'Identity Lab Doubles',
    type: 'doubles',
    gender: 'open',
    ageGroup: 'open',
    format: 'single_elimination',
    status: 'registration',
    seedingEnabled: true,
    maxParticipants: 16,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    tournamentId: tournamentRef.id,
    singlesCategoryId: singlesCategoryRef.id,
    doublesCategoryId: doublesCategoryRef.id,
  };
};

const createSinglesRegistration = async (
  db: Firestore,
  tournamentId: string,
  categoryId: string,
  adminId: string,
  playerId: string,
  label: string
): Promise<void> => {
  await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
    tournamentId,
    categoryId,
    participantType: 'individual',
    playerId,
    status: 'approved',
    seed: null,
    registeredBy: adminId,
    notes: label,
    registeredAt: serverTimestamp(),
    approvedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

const createDoublesRegistration = async (
  db: Firestore,
  tournamentId: string,
  categoryId: string,
  adminId: string,
  playerId: string,
  partnerPlayerId: string,
  teamName: string,
  label: string
): Promise<void> => {
  await addDoc(collection(db, 'tournaments', tournamentId, 'registrations'), {
    tournamentId,
    categoryId,
    participantType: 'team',
    playerId,
    partnerPlayerId,
    teamName,
    status: 'approved',
    seed: null,
    registeredBy: adminId,
    notes: label,
    registeredAt: serverTimestamp(),
    approvedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const runPlayerIdentitySeed = async (
  db: Firestore,
  adminId: string
): Promise<PlayerIdentitySeedResult> => {
  const orgId = await createSeedOrg(db, adminId, {
    name: 'CourtMastr Identity Lab',
    slug: 'identity-lab',
  });

  const { tournamentId, singlesCategoryId, doublesCategoryId } = await createLabTournament(
    db,
    adminId,
    orgId
  );

  const emailIdCache = new Map<string, string>();

  const primarySourceId = await makePlayer(db, tournamentId, emailIdCache, {
    firstName: 'Avery',
    lastName: 'PrimarySource',
    email: 'avery.primary.source@seed.local',
    phone: '555-2001',
    gender: 'male',
    skillLevel: 4,
  });
  const primaryTargetId = await makePlayer(db, tournamentId, emailIdCache, {
    firstName: 'Avery',
    lastName: 'PrimaryTarget',
    email: 'avery.primary.target@seed.local',
    phone: '555-2002',
    gender: 'male',
    skillLevel: 5,
  });

  const partnerSourceId = await makePlayer(db, tournamentId, emailIdCache, {
    firstName: 'Bailey',
    lastName: 'PartnerSource',
    email: 'bailey.partner.source@seed.local',
    phone: '555-2003',
    gender: 'female',
    skillLevel: 4,
  });
  const partnerTargetId = await makePlayer(db, tournamentId, emailIdCache, {
    firstName: 'Bailey',
    lastName: 'PartnerTarget',
    email: 'bailey.partner.target@seed.local',
    phone: '555-2004',
    gender: 'female',
    skillLevel: 5,
  });
  const doublesAnchorId = await makePlayer(db, tournamentId, emailIdCache, {
    firstName: 'Casey',
    lastName: 'Anchor',
    email: 'casey.anchor@seed.local',
    phone: '555-2005',
    gender: 'male',
    skillLevel: 6,
  });

  const sharedSourceId = await makePlayer(db, tournamentId, emailIdCache, {
    firstName: 'Devon',
    lastName: 'SharedSource',
    email: 'devon.shared.source@seed.local',
    phone: '555-2006',
    gender: 'male',
    skillLevel: 5,
  });
  const sharedTargetId = await makePlayer(db, tournamentId, emailIdCache, {
    firstName: 'Devon',
    lastName: 'SharedTarget',
    email: 'devon.shared.target@seed.local',
    phone: '555-2007',
    gender: 'male',
    skillLevel: 5,
  });

  const inactiveSourceId = await makePlayer(db, tournamentId, emailIdCache, {
    firstName: 'Emery',
    lastName: 'InactiveSource',
    email: 'emery.inactive.source@seed.local',
    phone: '555-2008',
    gender: 'female',
    skillLevel: 3,
  });
  const inactiveTargetId = await makePlayer(db, tournamentId, emailIdCache, {
    firstName: 'Emery',
    lastName: 'InactiveTarget',
    email: 'emery.inactive.target@seed.local',
    phone: '555-2009',
    gender: 'female',
    skillLevel: 3,
  });

  await setDoc(
    doc(db, 'players', inactiveTargetId),
    {
      isActive: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await createSinglesRegistration(
    db,
    tournamentId,
    singlesCategoryId,
    adminId,
    primarySourceId,
    'Primary merge source registration'
  );

  await createSinglesRegistration(
    db,
    tournamentId,
    singlesCategoryId,
    adminId,
    inactiveSourceId,
    'Inactive target guard source registration'
  );

  await createDoublesRegistration(
    db,
    tournamentId,
    doublesCategoryId,
    adminId,
    doublesAnchorId,
    partnerSourceId,
    'Casey Anchor / Bailey PartnerSource',
    'Partner merge source registration'
  );

  await createDoublesRegistration(
    db,
    tournamentId,
    doublesCategoryId,
    adminId,
    sharedSourceId,
    sharedTargetId,
    'Devon SharedSource / Devon SharedTarget',
    'Same-team merge guard registration'
  );

  const baseUrl = 'http://localhost:3002';

  return {
    orgId,
    tournamentId,
    singlesCategoryId,
    doublesCategoryId,
    cases: {
      primaryMerge: {
        sourcePlayerId: primarySourceId,
        targetPlayerId: primaryTargetId,
        route: `${baseUrl}/players/${primarySourceId}/merge`,
      },
      partnerMerge: {
        sourcePlayerId: partnerSourceId,
        targetPlayerId: partnerTargetId,
        route: `${baseUrl}/players/${partnerSourceId}/merge`,
      },
      sameTeamGuard: {
        sourcePlayerId: sharedSourceId,
        targetPlayerId: sharedTargetId,
        route: `${baseUrl}/players/${sharedSourceId}/merge`,
      },
      inactiveTargetGuard: {
        sourcePlayerId: inactiveSourceId,
        targetPlayerId: inactiveTargetId,
        route: `${baseUrl}/players/${inactiveSourceId}/merge`,
      },
    },
  };
};
