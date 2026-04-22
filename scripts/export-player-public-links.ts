import fs from 'node:fs/promises';
import path from 'node:path';
import { deleteApp, initializeApp } from 'firebase/app';
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface TournamentRecord {
  id: string;
  name?: string;
  slug?: string | null;
}

interface TournamentPlayerRecord {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
}

interface CategoryRecord {
  id: string;
  name?: string;
}

interface RegistrationRecord {
  id: string;
  categoryId: string;
  status?: string;
  playerId?: string | null;
  partnerPlayerId?: string | null;
}

interface CliOptions {
  tournamentId?: string;
  slug?: string;
  name?: string;
  output?: string;
  baseUrl: string;
}

interface ExportRow {
  playerId: string;
  firstName: string;
  lastName: string;
  email: string;
  categories: string[];
  registrationIds: string[];
  publicPlayerUrls: string[];
}

const PROD_ENV_PATH = path.resolve(process.cwd(), '.env.production');
const DEFAULT_BASE_URL = 'https://courtmaster-v2.web.app';

const readEnvFile = async (filePath: string): Promise<Record<string, string>> => {
  const contents = await fs.readFile(filePath, 'utf8');

  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) {
          return null;
        }

        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^"(.*)"$/, '$1');
        return key ? [key, value] as const : null;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null)
  );
};

const loadFirebaseConfig = async (): Promise<FirebaseConfig> => {
  const envValues = await readEnvFile(PROD_ENV_PATH);
  const get = (key: string): string => process.env[key] ?? envValues[key] ?? '';

  const config: FirebaseConfig = {
    apiKey: get('VITE_FIREBASE_API_KEY'),
    authDomain: get('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: get('VITE_FIREBASE_PROJECT_ID'),
    storageBucket: get('VITE_FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: get('VITE_FIREBASE_MESSAGING_SENDER_ID'),
    appId: get('VITE_FIREBASE_APP_ID'),
  };

  const missingKeys = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length > 0) {
    throw new Error(`Missing Firebase config values: ${missingKeys.join(', ')}`);
  }

  return config;
};

const parseArgs = (): CliOptions => {
  const options: CliOptions = {
    baseUrl: DEFAULT_BASE_URL,
  };

  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--')) {
      continue;
    }

    const [rawKey, rawValue] = arg.slice(2).split('=');
    const value = rawValue?.trim();
    if (!value) {
      continue;
    }

    switch (rawKey) {
      case 'tournament-id':
        options.tournamentId = value;
        break;
      case 'slug':
        options.slug = value;
        break;
      case 'name':
        options.name = value;
        break;
      case 'output':
        options.output = value;
        break;
      case 'base-url':
        options.baseUrl = value.replace(/\/+$/, '');
        break;
      default:
        throw new Error(`Unknown option: --${rawKey}`);
    }
  }

  if (!options.tournamentId && !options.slug && !options.name) {
    throw new Error('Provide one of --tournament-id, --slug, or --name.');
  }

  return options;
};

const escapeCsv = (value: string): string => {
  const escaped = value.replaceAll('"', '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

const buildCsv = (rows: ExportRow[]): string => {
  const header = [
    'playerId',
    'firstName',
    'lastName',
    'email',
    'categories',
    'registrationIds',
    'publicPlayerUrls',
  ];

  const body = rows.map((row) => [
    row.playerId,
    row.firstName,
    row.lastName,
    row.email,
    row.categories.join(' | '),
    row.registrationIds.join(' | '),
    row.publicPlayerUrls.join(' | '),
  ]);

  return [header, ...body]
    .map((columns) => columns.map((value) => escapeCsv(value)).join(','))
    .join('\n');
};

const findTournament = async (
  options: CliOptions,
  db: ReturnType<typeof getFirestore>
): Promise<TournamentRecord> => {
  if (options.tournamentId) {
    const tournamentDoc = await getDoc(doc(db, 'tournaments', options.tournamentId));
    if (tournamentDoc.exists()) {
      return {
        id: tournamentDoc.id,
        ...(tournamentDoc.data() as Omit<TournamentRecord, 'id'>),
      };
    }
  }

  if (options.slug) {
    const snap = await getDocs(
      query(collection(db, 'tournaments'), where('slug', '==', options.slug))
    );
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { id: doc.id, ...(doc.data() as Omit<TournamentRecord, 'id'>) };
    }
  }

  if (options.name) {
    const snap = await getDocs(
      query(collection(db, 'tournaments'), where('name', '==', options.name))
    );
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { id: doc.id, ...(doc.data() as Omit<TournamentRecord, 'id'>) };
    }
  }

  throw new Error('Tournament not found with the provided selector.');
};

const ensureAccumulator = (
  rowsByPlayerId: Map<string, ExportRow>,
  player: TournamentPlayerRecord
): ExportRow | null => {
  const email = player.email?.trim();
  if (!email) {
    return null;
  }

  const existing = rowsByPlayerId.get(player.id);
  if (existing) {
    return existing;
  }

  const next: ExportRow = {
    playerId: player.id,
    firstName: player.firstName?.trim() ?? '',
    lastName: player.lastName?.trim() ?? '',
    email,
    categories: [],
    registrationIds: [],
    publicPlayerUrls: [],
  };
  rowsByPlayerId.set(player.id, next);
  return next;
};

const pushUnique = (values: string[], value: string): void => {
  if (!values.includes(value)) {
    values.push(value);
  }
};

async function main(): Promise<void> {
  const options = parseArgs();
  const firebaseConfig = await loadFirebaseConfig();
  const app = initializeApp(firebaseConfig, 'export-player-public-links');
  const db = getFirestore(app);

  try {
    const tournament = await findTournament(options, db);
    const [playersSnap, categoriesSnap, registrationsSnap] = await Promise.all([
      getDocs(collection(db, `tournaments/${tournament.id}/players`)),
      getDocs(collection(db, `tournaments/${tournament.id}/categories`)),
      getDocs(collection(db, `tournaments/${tournament.id}/registrations`)),
    ]);

    const players = new Map<string, TournamentPlayerRecord>(
      playersSnap.docs.map((doc) => [
        doc.id,
        { id: doc.id, ...(doc.data() as Omit<TournamentPlayerRecord, 'id'>) },
      ])
    );
    const categories = new Map<string, CategoryRecord>(
      categoriesSnap.docs.map((doc) => [
        doc.id,
        { id: doc.id, ...(doc.data() as Omit<CategoryRecord, 'id'>) },
      ])
    );

    const rowsByPlayerId = new Map<string, ExportRow>();
    const missingEmails: string[] = [];

    for (const registrationDoc of registrationsSnap.docs) {
      const registration = {
        id: registrationDoc.id,
        ...(registrationDoc.data() as Omit<RegistrationRecord, 'id'>),
      };

      if (registration.status === 'rejected' || registration.status === 'withdrawn') {
        continue;
      }

      const categoryName = categories.get(registration.categoryId)?.name ?? registration.categoryId;
      const publicPlayerUrl = `${options.baseUrl}/tournaments/${tournament.id}/player?reg=${encodeURIComponent(registration.id)}`;

      for (const playerId of [registration.playerId, registration.partnerPlayerId]) {
        if (!playerId) {
          continue;
        }

        const player = players.get(playerId);
        if (!player) {
          continue;
        }

        const row = ensureAccumulator(rowsByPlayerId, player);
        if (!row) {
          missingEmails.push(playerId);
          continue;
        }

        pushUnique(row.categories, categoryName);
        pushUnique(row.registrationIds, registration.id);
        pushUnique(row.publicPlayerUrls, publicPlayerUrl);
      }
    }

    const rows = Array.from(rowsByPlayerId.values()).sort((left, right) =>
      `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`)
    );

    const safeSlug =
      tournament.slug?.trim() ||
      tournament.name?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') ||
      tournament.id;
    const outputPath = path.resolve(
      process.cwd(),
      options.output ?? `output/${safeSlug}-player-public-links.csv`
    );

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, buildCsv(rows), 'utf8');

    console.log(`Tournament: ${tournament.name ?? tournament.id} (${tournament.id})`);
    console.log(`Rows written: ${rows.length}`);
    console.log(`Missing email players skipped: ${missingEmails.length}`);
    console.log(`Output: ${outputPath}`);
  } finally {
    await deleteApp(app);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
