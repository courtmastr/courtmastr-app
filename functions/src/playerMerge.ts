import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';

const MAX_BATCH_WRITES = 450;

interface PlayerStats {
  wins: number;
  losses: number;
  gamesPlayed: number;
  tournamentsPlayed: number;
}

interface PlayerStatsByCategory {
  [categoryType: string]: PlayerStats;
}

interface PlayerStatsTree {
  overall: PlayerStats;
  [sport: string]: PlayerStats | PlayerStatsByCategory;
}

export interface MergeExecutionInput {
  sourcePlayerId: string;
  targetPlayerId: string;
  requestedBy: string;
}

export interface MergeExecutionResult {
  sourcePlayerId: string;
  targetPlayerId: string;
  primaryRegistrationCount: number;
  partnerRegistrationCount: number;
  repointedRegistrationCount: number;
}

export interface MergePlayerRecord {
  id: string;
  identityStatus?: string | null;
  isActive?: boolean | null;
  stats?: PlayerStatsTree | null;
}

export interface MergeDocRef {
  id: string;
  path: string;
}

export interface MergeRegistrationRecord {
  id: string;
  ref: MergeDocRef;
  playerId?: string | null;
  partnerPlayerId?: string | null;
}

export interface MergeRegistrationUpdate {
  registrationId: string;
  updates: Record<string, string>;
}

export interface MergeRegistrationPlan {
  updates: MergeRegistrationUpdate[];
  primaryRegistrationCount: number;
  partnerRegistrationCount: number;
  repointedRegistrationCount: number;
}

export interface MergeWriteBatch {
  update(ref: MergeDocRef, data: Record<string, unknown>): void;
  commit(): Promise<void>;
}

export interface MergeDbAdapter {
  getPlayer(playerId: string): Promise<MergePlayerRecord | null>;
  findRegistrationsByPlayerId(playerId: string): Promise<MergeRegistrationRecord[]>;
  findRegistrationsByPartnerPlayerId(playerId: string): Promise<MergeRegistrationRecord[]>;
  createBatch(): MergeWriteBatch;
}

interface MergeRequestRecord {
  status?: string | null;
  sourcePlayerId?: string | null;
  targetPlayerId?: string | null;
}

interface FirebaseMergeRequestData {
  sourcePlayerId?: unknown;
  targetPlayerId?: unknown;
  mergeRequestId?: unknown;
}

const ZERO_PLAYER_STATS: PlayerStats = {
  wins: 0,
  losses: 0,
  gamesPlayed: 0,
  tournamentsPlayed: 0,
};

function isStatsBucket(value: unknown): value is PlayerStats {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.wins === 'number' &&
    typeof record.losses === 'number' &&
    typeof record.gamesPlayed === 'number' &&
    typeof record.tournamentsPlayed === 'number'
  );
}

function mergeStatsBucket(target: Partial<PlayerStats> | undefined | null, source: Partial<PlayerStats> | undefined | null): PlayerStats {
  return {
    wins: (target?.wins ?? 0) + (source?.wins ?? 0),
    losses: (target?.losses ?? 0) + (source?.losses ?? 0),
    gamesPlayed: (target?.gamesPlayed ?? 0) + (source?.gamesPlayed ?? 0),
    tournamentsPlayed: (target?.tournamentsPlayed ?? 0) + (source?.tournamentsPlayed ?? 0),
  };
}

export function mergePlayerStats(
  targetStats: PlayerStatsTree | null | undefined,
  sourceStats: PlayerStatsTree | null | undefined
): PlayerStatsTree {
  const merged: PlayerStatsTree = {
    overall: mergeStatsBucket(targetStats?.overall, sourceStats?.overall),
  };

  const sportKeys = new Set([
    ...Object.keys(targetStats ?? {}),
    ...Object.keys(sourceStats ?? {}),
  ]);
  sportKeys.delete('overall');

  for (const sportKey of sportKeys) {
    const targetSport = targetStats?.[sportKey];
    const sourceSport = sourceStats?.[sportKey];

    if (isStatsBucket(targetSport) || isStatsBucket(sourceSport)) {
      merged[sportKey] = mergeStatsBucket(
        isStatsBucket(targetSport) ? targetSport : undefined,
        isStatsBucket(sourceSport) ? sourceSport : undefined
      );
      continue;
    }

    const categoryKeys = new Set([
      ...Object.keys((targetSport as PlayerStatsByCategory | undefined) ?? {}),
      ...Object.keys((sourceSport as PlayerStatsByCategory | undefined) ?? {}),
    ]);
    const categoryStats: PlayerStatsByCategory = {};

    for (const categoryKey of categoryKeys) {
      const targetCategory = (targetSport as PlayerStatsByCategory | undefined)?.[categoryKey];
      const sourceCategory = (sourceSport as PlayerStatsByCategory | undefined)?.[categoryKey];
      categoryStats[categoryKey] = mergeStatsBucket(targetCategory, sourceCategory);
    }

    merged[sportKey] = categoryStats;
  }

  return merged;
}

export function buildMergeRegistrationPlan(
  primaryRegistrations: MergeRegistrationRecord[],
  partnerRegistrations: MergeRegistrationRecord[],
  sourcePlayerId: string,
  targetPlayerId: string
): MergeRegistrationPlan {
  const updates = new Map<string, MergeRegistrationUpdate>();
  let primaryRegistrationCount = 0;
  let partnerRegistrationCount = 0;

  const queueUpdate = (
    registrationId: string,
    field: 'playerId' | 'partnerPlayerId'
  ): void => {
    const existing = updates.get(registrationId);
    const mergedUpdate = existing ? { ...existing.updates } : {};
    if (field === 'playerId' && mergedUpdate.playerId !== targetPlayerId) {
      mergedUpdate.playerId = targetPlayerId;
      primaryRegistrationCount += 1;
    }
    if (field === 'partnerPlayerId' && mergedUpdate.partnerPlayerId !== targetPlayerId) {
      mergedUpdate.partnerPlayerId = targetPlayerId;
      partnerRegistrationCount += 1;
    }

    updates.set(registrationId, {
      registrationId,
      updates: mergedUpdate,
    });
  };

  for (const registration of primaryRegistrations) {
    if (registration.playerId === sourcePlayerId) {
      queueUpdate(registration.id, 'playerId');
    }
  }

  for (const registration of partnerRegistrations) {
    if (registration.partnerPlayerId === sourcePlayerId) {
      queueUpdate(registration.id, 'partnerPlayerId');
    }
  }

  return {
    updates: Array.from(updates.values()),
    primaryRegistrationCount,
    partnerRegistrationCount,
    repointedRegistrationCount: primaryRegistrationCount + partnerRegistrationCount,
  };
}

export function validateMergePair(sourcePlayerId: string, targetPlayerId: string): void {
  if (!sourcePlayerId || !targetPlayerId) {
    throw new Error('sourcePlayerId and targetPlayerId are required');
  }

  if (sourcePlayerId === targetPlayerId) {
    throw new Error('Cannot merge player with itself');
  }
}

function normalizePlayerRecord(id: string, raw: Record<string, unknown>): MergePlayerRecord {
  return {
    id,
    identityStatus: typeof raw.identityStatus === 'string' ? raw.identityStatus : 'active',
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    stats: (raw.stats as PlayerStatsTree | undefined) ?? {
      overall: ZERO_PLAYER_STATS,
    },
  };
}

function normalizeRegistrationRecord(
  id: string,
  raw: Record<string, unknown>,
  path: string
): MergeRegistrationRecord {
  return {
    id,
    ref: { id, path },
    playerId: typeof raw.playerId === 'string' ? raw.playerId : null,
    partnerPlayerId: typeof raw.partnerPlayerId === 'string' ? raw.partnerPlayerId : null,
  };
}

function createFirestoreMergeDb(firestore: admin.firestore.Firestore): MergeDbAdapter {
  const toBatch = (batch: admin.firestore.WriteBatch): MergeWriteBatch => ({
    update(ref, data) {
      batch.update(firestore.doc(ref.path), data);
    },
    async commit(): Promise<void> {
      await batch.commit();
    },
  });

  return {
    async getPlayer(playerId: string): Promise<MergePlayerRecord | null> {
      const snap = await firestore.collection('players').doc(playerId).get();
      if (!snap.exists) return null;
      return normalizePlayerRecord(snap.id, snap.data() as Record<string, unknown>);
    },
    async findRegistrationsByPlayerId(playerId: string): Promise<MergeRegistrationRecord[]> {
      const snap = await firestore
        .collectionGroup('registrations')
        .where('playerId', '==', playerId)
        .get();
      return snap.docs.map((doc) =>
        normalizeRegistrationRecord(doc.id, doc.data() as Record<string, unknown>, doc.ref.path)
      );
    },
    async findRegistrationsByPartnerPlayerId(playerId: string): Promise<MergeRegistrationRecord[]> {
      const snap = await firestore
        .collectionGroup('registrations')
        .where('partnerPlayerId', '==', playerId)
        .get();
      return snap.docs.map((doc) =>
        normalizeRegistrationRecord(doc.id, doc.data() as Record<string, unknown>, doc.ref.path)
      );
    },
    createBatch(): MergeWriteBatch {
      return toBatch(firestore.batch());
    },
  };
}

export async function executeMergeLogic(
  input: MergeExecutionInput,
  db: MergeDbAdapter
): Promise<MergeExecutionResult> {
  validateMergePair(input.sourcePlayerId, input.targetPlayerId);

  const sourcePlayer = await db.getPlayer(input.sourcePlayerId);
  if (!sourcePlayer) {
    throw new Error(`Source player ${input.sourcePlayerId} not found`);
  }

  const targetPlayer = await db.getPlayer(input.targetPlayerId);
  if (!targetPlayer) {
    throw new Error(`Target player ${input.targetPlayerId} not found`);
  }

  if (sourcePlayer.identityStatus === 'merged') {
    throw new Error('Source player is already merged');
  }
  if (sourcePlayer.isActive === false) {
    throw new Error('Source player is not active');
  }

  if (targetPlayer.identityStatus === 'merged') {
    throw new Error('Target player is already merged');
  }
  if (targetPlayer.isActive === false) {
    throw new Error('Target player is not active');
  }

  const [primaryRegistrations, partnerRegistrations] = await Promise.all([
    db.findRegistrationsByPlayerId(input.sourcePlayerId),
    db.findRegistrationsByPartnerPlayerId(input.sourcePlayerId),
  ]);

  const plan = buildMergeRegistrationPlan(
    primaryRegistrations,
    partnerRegistrations,
    input.sourcePlayerId,
    input.targetPlayerId
  );

  const registrationsToValidate = [...primaryRegistrations, ...partnerRegistrations];
  const hasSharedRegistration = registrationsToValidate.some((registration) => (
    (registration.playerId === input.sourcePlayerId
      && registration.partnerPlayerId === input.targetPlayerId)
    || (registration.playerId === input.targetPlayerId
      && registration.partnerPlayerId === input.sourcePlayerId)
  ));

  if (hasSharedRegistration) {
    throw new Error('Cannot merge players who are paired in the same registration');
  }

  const registrationById = new Map<string, MergeRegistrationRecord>();
  for (const registration of [...primaryRegistrations, ...partnerRegistrations]) {
    registrationById.set(registration.id, registration);
  }

  let batch = db.createBatch();
  let writesInBatch = 0;

  const queueUpdate = async (
    ref: MergeDocRef,
    data: Record<string, unknown>
  ): Promise<void> => {
    batch.update(ref, data);
    writesInBatch += 1;

    if (writesInBatch >= MAX_BATCH_WRITES) {
      await batch.commit();
      batch = db.createBatch();
      writesInBatch = 0;
    }
  };

  for (const update of plan.updates) {
    const registration = registrationById.get(update.registrationId);
    if (!registration) continue;
    await queueUpdate(registration.ref, update.updates);
  }

  const mergedStats = mergePlayerStats(targetPlayer.stats, sourcePlayer.stats);

  await queueUpdate(
    { id: targetPlayer.id, path: `players/${targetPlayer.id}` },
    {
      stats: mergedStats,
      updatedAt: FieldValue.serverTimestamp(),
    }
  );

  await queueUpdate(
    { id: sourcePlayer.id, path: `players/${sourcePlayer.id}` },
    {
      identityStatus: 'merged',
      mergedIntoPlayerId: targetPlayer.id,
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    }
  );

  if (writesInBatch > 0) {
    await batch.commit();
  }

  return {
    sourcePlayerId: input.sourcePlayerId,
    targetPlayerId: input.targetPlayerId,
    primaryRegistrationCount: plan.primaryRegistrationCount,
    partnerRegistrationCount: plan.partnerRegistrationCount,
    repointedRegistrationCount: plan.repointedRegistrationCount,
  };
}

async function readMergeRequestStatus(
  firestore: admin.firestore.Firestore,
  mergeRequestId: string
): Promise<MergeRequestRecord | null> {
  const snap = await firestore.collection('mergeRequests').doc(mergeRequestId).get();
  if (!snap.exists) return null;
  return snap.data() as MergeRequestRecord;
}

export const executeMerge = functions.https.onCall(
  async (request: functions.https.CallableRequest<FirebaseMergeRequestData>) => {
    if (!request.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const sourcePlayerId = String(request.data?.sourcePlayerId ?? '').trim();
    const targetPlayerId = String(request.data?.targetPlayerId ?? '').trim();
    const mergeRequestId = String(request.data?.mergeRequestId ?? '').trim() || null;

    try {
      validateMergePair(sourcePlayerId, targetPlayerId);
    } catch (error) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        error instanceof Error ? error.message : 'Invalid merge request'
      );
    }

    const firestore = admin.firestore();
    const userSnap = await firestore.collection('users').doc(request.auth.uid).get();
    const userRole = userSnap.data()?.role;

    if (!['admin', 'organizer'].includes(userRole)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins and organizers can merge players'
      );
    }

    if (mergeRequestId) {
      const mergeRequest = await readMergeRequestStatus(firestore, mergeRequestId);
      if (!mergeRequest) {
        throw new functions.https.HttpsError('not-found', 'Merge request not found');
      }
      if (mergeRequest.status !== 'approved') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Merge request must be approved before execution'
        );
      }
      if (
        (mergeRequest.sourcePlayerId && mergeRequest.sourcePlayerId !== sourcePlayerId)
        || (mergeRequest.targetPlayerId && mergeRequest.targetPlayerId !== targetPlayerId)
      ) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Merge request players do not match the requested merge pair'
        );
      }
    }

    try {
      const result = await executeMergeLogic(
        {
          sourcePlayerId,
          targetPlayerId,
          requestedBy: request.auth.uid,
        },
        createFirestoreMergeDb(firestore)
      );

      if (mergeRequestId) {
        await firestore.collection('mergeRequests').doc(mergeRequestId).update({
          status: 'completed',
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      console.error('Error executing player merge:', error);
      throw new functions.https.HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to merge players'
      );
    }
  }
);
