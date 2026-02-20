/**
 * One-time migration: backfill `organizerIds` on existing tournament documents.
 *
 * Tournaments created before the multi-organizer feature was introduced only
 * have a `createdBy` field. This script sets `organizerIds: [createdBy]` on
 * any tournament document that does not already have the field.
 *
 * Run against the LOCAL emulator:
 *   npx tsx scripts/seed/migrate-organizer-ids.ts
 *
 * Run against PRODUCTION (set FIREBASE_PROJECT_ID and use a service account):
 *   FIREBASE_PROJECT_ID=your-project npx tsx scripts/seed/migrate-organizer-ids.ts --prod
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const isProd = process.argv.includes('--prod');

if (isProd) {
  // Production: requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to a
  // service account JSON file with Firestore write access.
  initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS as string) });
} else {
  // Local emulator
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  initializeApp({ projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'demo-courtmaster' });
}

const db = getFirestore();

async function migrate(): Promise<void> {
  const snapshot = await db.collection('tournaments').get();
  let updated = 0;
  let skipped = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.organizerIds && Array.isArray(data.organizerIds) && data.organizerIds.length > 0) {
      skipped++;
      continue;
    }
    const createdBy: string = data.createdBy || '';
    await docSnap.ref.update({
      organizerIds: createdBy ? [createdBy] : [],
    });
    updated++;
    console.log(`  Updated: ${docSnap.id} (${data.name ?? 'unnamed'}) → organizerIds: [${createdBy}]`);
  }

  console.log(`\nMigration complete. Updated: ${updated}, Already set: ${skipped}`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
