/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * snapshot-prod-to-emulator.cjs
 *
 * Read-only copy of one production tournament/category into the local Firestore emulator.
 * This is intended for reproduction work only. Production is never written to.
 *
 * Usage:
 *   node scripts/snapshot-prod-to-emulator.cjs
 *   node scripts/snapshot-prod-to-emulator.cjs --tournament=MFILbHm3hFLfi5JyHzgP --category=Q7AroDdffxyxD1nNW4cy
 *
 * Prerequisite:
 *   FIRESTORE emulator running on localhost:8080
 */

const path = require('path');

const DEFAULT_TOURNAMENT_ID = 'MFILbHm3hFLfi5JyHzgP';
const DEFAULT_CATEGORY_ID = 'Q7AroDdffxyxD1nNW4cy';
const PROD_PROJECT = 'courtmaster-v2';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
const DEFAULT_ADC_PATH = '/Users/ramc/.config/gcloud/application_default_credentials.json';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = DEFAULT_ADC_PATH;
}

function requireFirebaseAdmin(modulePath) {
  try {
    return require(modulePath);
  } catch {
    const resolved = require.resolve(modulePath, {
      paths: [path.resolve(__dirname, '../functions/node_modules')],
    });
    return require(resolved);
  }
}

const { initializeApp } = requireFirebaseAdmin('firebase-admin/app');
const { getFirestore } = requireFirebaseAdmin('firebase-admin/firestore');

function getArgValue(name, defaultValue) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : defaultValue;
}

const tournamentId = getArgValue('tournament', DEFAULT_TOURNAMENT_ID);
const categoryId = getArgValue('category', DEFAULT_CATEGORY_ID);

const prodApp = initializeApp({ projectId: PROD_PROJECT }, 'prod-snapshot');
const prodDb = getFirestore(prodApp);

process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOST;
const emulatorApp = initializeApp({ projectId: 'demo-courtmaster' }, 'emulator-snapshot');
const emulatorDb = getFirestore(emulatorApp);

async function copyDoc(sourceDb, destDb, path, label) {
  const snapshot = await sourceDb.doc(path).get();
  if (!snapshot.exists) {
    console.log(`  ${label}: not found`);
    return false;
  }

  await destDb.doc(path).set(snapshot.data());
  console.log(`  ${label}: copied`);
  return true;
}

async function writeSnapshots(destDb, path, docs, label) {
  if (docs.length === 0) {
    console.log(`  ${label}: empty, skipping`);
    return 0;
  }

  const batchSize = 400;
  let written = 0;
  let batch = destDb.batch();
  let pending = 0;

  for (const docSnap of docs) {
    batch.set(destDb.collection(path).doc(docSnap.id), docSnap.data());
    written += 1;
    pending += 1;

    if (pending >= batchSize) {
      await batch.commit();
      batch = destDb.batch();
      pending = 0;
      process.stdout.write('.');
    }
  }

  if (pending > 0) {
    await batch.commit();
  }

  console.log(`  ${label}: ${written} docs copied`);
  return written;
}

async function copyCollection(sourceDb, destDb, path, label) {
  const snapshot = await sourceDb.collection(path).get();
  return writeSnapshots(destDb, path, snapshot.docs, label);
}

async function copyQuerySnapshot(destDb, path, docs, label) {
  return writeSnapshots(destDb, path, docs, label);
}

async function collectReferencedGlobalPlayerIds(registrationDocs) {
  const playerIds = new Set();

  for (const docSnap of registrationDocs) {
    const data = docSnap.data();
    if (data.playerId) playerIds.add(data.playerId);
    if (data.partnerPlayerId) playerIds.add(data.partnerPlayerId);
  }

  return [...playerIds];
}

async function main() {
  console.log('=== Snapshot Prod -> Emulator ===');
  console.log(`Tournament: ${tournamentId}`);
  console.log(`Category:   ${categoryId}`);
  console.log(`Emulator:   ${EMULATOR_HOST}`);
  console.log('Mode:       read prod, write emulator only\n');

  const tournamentPath = `tournaments/${tournamentId}`;
  const categoryPath = `${tournamentPath}/categories/${categoryId}`;

  console.log('Copying tournament and category documents...');
  await copyDoc(prodDb, emulatorDb, tournamentPath, 'tournament');
  await copyDoc(prodDb, emulatorDb, categoryPath, 'category');

  console.log('\nCopying tournament-scoped collections...');
  await copyCollection(prodDb, emulatorDb, `${tournamentPath}/players`, 'tournament players');

  const registrationQuery = await prodDb
    .collection(`${tournamentPath}/registrations`)
    .where('categoryId', '==', categoryId)
    .get();
  await copyQuerySnapshot(
    emulatorDb,
    `${tournamentPath}/registrations`,
    registrationQuery.docs,
    'category registrations',
  );

  console.log('\nCopying category-scoped bracket data...');
  for (const subcollection of ['participant', 'stage', 'group', 'round', 'match', 'match_scores']) {
    await copyCollection(
      prodDb,
      emulatorDb,
      `${categoryPath}/${subcollection}`,
      subcollection,
    );
  }

  console.log('\nCopying referenced global players...');
  const globalPlayerIds = await collectReferencedGlobalPlayerIds(registrationQuery.docs);
  let globalPlayersCopied = 0;

  for (const playerId of globalPlayerIds) {
    const copied = await copyDoc(prodDb, emulatorDb, `players/${playerId}`, `global player ${playerId}`);
    if (copied) {
      globalPlayersCopied += 1;
    }
  }
  console.log(`  referenced global players copied: ${globalPlayersCopied}`);

  console.log('\n✅ Snapshot complete.');
  console.log(`   Local emulator now has ${tournamentId} / ${categoryId} for reproduction.`);
}

main()
  .catch((error) => {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => process.exit(0));
