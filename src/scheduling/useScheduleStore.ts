import {
  db,
  collection,
  doc,
  getDocs,
  setDoc,
  Timestamp,
  writeBatch,
  serverTimestamp,
} from '@/services/firebase';
import { SCHEDULE_FIELDS, SCHEDULE_STATUS } from './scheduleRules';

export interface ManualPlannedTimeInput {
  tournamentId: string;
  categoryId?: string;
  levelId?: string;
  matchId: string;
  plannedStartAt: Date;
  matchDurationMinutes: number;
  locked?: boolean;
}

export interface PublishMatchScheduleInput {
  tournamentId: string;
  categoryId?: string;
  levelId?: string;
  matchId: string;
  publishedBy?: string;
}

const getBracketBasePath = (
  tournamentId: string,
  categoryId?: string,
  levelId?: string
): string => {
  if (categoryId && levelId) {
    return `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}`;
  }
  if (categoryId) {
    return `tournaments/${tournamentId}/categories/${categoryId}`;
  }
  return `tournaments/${tournamentId}`;
};

const getMatchScoresPath = (
  tournamentId: string,
  categoryId?: string,
  levelId?: string
): string => `${getBracketBasePath(tournamentId, categoryId, levelId)}/match_scores`;

export const saveManualPlannedTime = async (
  input: ManualPlannedTimeInput
): Promise<void> => {
  const {
    tournamentId,
    categoryId,
    levelId,
    matchId,
    plannedStartAt,
    matchDurationMinutes,
    locked,
  } = input;

  const plannedEndAt = new Date(plannedStartAt.getTime() + matchDurationMinutes * 60_000);

  await setDoc(
    doc(db, getMatchScoresPath(tournamentId, categoryId, levelId), matchId),
    {
      [SCHEDULE_FIELDS.plannedStartAt]: Timestamp.fromDate(plannedStartAt),
      [SCHEDULE_FIELDS.plannedEndAt]: Timestamp.fromDate(plannedEndAt),
      [SCHEDULE_FIELDS.scheduleStatus]: SCHEDULE_STATUS.draft,
      ...(locked !== undefined ? { [SCHEDULE_FIELDS.lockedTime]: locked } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export interface DragRescheduleInput {
  tournamentId: string;
  categoryId: string;
  levelId?: string;
  matchId: string;
  newStartAt: Date;
  durationMinutes: number;
  newCourtId: string;
}

export const saveDragReschedule = async (input: DragRescheduleInput): Promise<void> => {
  const { tournamentId, categoryId, levelId, matchId, newStartAt, durationMinutes, newCourtId } =
    input;
  const newEndAt = new Date(newStartAt.getTime() + durationMinutes * 60_000);
  await setDoc(
    doc(db, getMatchScoresPath(tournamentId, categoryId, levelId), matchId),
    {
      [SCHEDULE_FIELDS.plannedStartAt]: Timestamp.fromDate(newStartAt),
      [SCHEDULE_FIELDS.plannedEndAt]: Timestamp.fromDate(newEndAt),
      [SCHEDULE_FIELDS.courtId]: newCourtId,
      [SCHEDULE_FIELDS.scheduleStatus]: SCHEDULE_STATUS.draft,
      [SCHEDULE_FIELDS.lockedTime]: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const publishMatchSchedule = async (
  input: PublishMatchScheduleInput
): Promise<void> => {
  const { tournamentId, categoryId, levelId, matchId, publishedBy = 'system' } = input;

  await setDoc(
    doc(db, getMatchScoresPath(tournamentId, categoryId, levelId), matchId),
    {
      [SCHEDULE_FIELDS.scheduleStatus]: SCHEDULE_STATUS.published,
      [SCHEDULE_FIELDS.publishedAt]: serverTimestamp(),
      [SCHEDULE_FIELDS.publishedBy]: publishedBy,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const migrateLegacyScheduledTime = async (
  tournamentId: string,
  categoryId: string,
  levelId?: string
): Promise<{ migratedCount: number }> => {
  const matchScoresPath = getMatchScoresPath(tournamentId, categoryId, levelId);
  const snapshot = await getDocs(collection(db, matchScoresPath));
  const batch = writeBatch(db);
  let migratedCount = 0;

  for (const scoreDoc of snapshot.docs) {
    const data = scoreDoc.data() as {
      scheduledTime?: Timestamp;
      plannedStartAt?: Timestamp;
    };

    if (data.scheduledTime && !data.plannedStartAt) {
      batch.update(scoreDoc.ref, {
        [SCHEDULE_FIELDS.plannedStartAt]: data.scheduledTime,
        updatedAt: serverTimestamp(),
      });
      migratedCount += 1;
    }
  }

  if (migratedCount > 0) {
    await batch.commit();
  }

  return { migratedCount };
};
