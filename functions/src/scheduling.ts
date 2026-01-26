// Scheduling Algorithm with Rest Time Constraints
import * as admin from 'firebase-admin';
import { Match, Court, ScheduleSlot } from './types';

// Get db lazily to avoid initialization order issues
function getDb() {
  return admin.firestore();
}

interface ScheduleConfig {
  tournamentId: string;
  startTime: Date;
  endTime: Date;
  minRestTimeMinutes: number;
  matchDurationMinutes: number;
}

interface ParticipantSchedule {
  lastMatchEndTime: Date | null;
  matchIds: string[];
}

/**
 * Generate optimized schedule for a tournament
 */
export async function generateSchedule(
  tournamentId: string
): Promise<void> {
  const db = getDb();

  // Get tournament settings
  const tournamentDoc = await db
    .collection('tournaments')
    .doc(tournamentId)
    .get();

  if (!tournamentDoc.exists) {
    throw new Error('Tournament not found');
  }

  const tournament = tournamentDoc.data();
  const settings = tournament?.settings || {
    minRestTimeMinutes: 15,
    matchDurationMinutes: 30,
  };

  // Get courts
  const courtsSnapshot = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('courts')
    .where('status', '!=', 'maintenance')
    .orderBy('status')
    .orderBy('number')
    .get();

  const courts: Court[] = courtsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Court[];

  if (courts.length === 0) {
    throw new Error('No available courts');
  }

  // Get unscheduled matches (scheduled or ready status without time)
  const matchesSnapshot = await db
    .collection('tournaments')
    .doc(tournamentId)
    .collection('matches')
    .where('status', 'in', ['scheduled', 'ready'])
    .orderBy('round')
    .orderBy('matchNumber')
    .get();

  const matches: (Match & { id: string })[] = matchesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as (Match & { id: string })[];

  if (matches.length === 0) {
    return; // Nothing to schedule
  }

  // Schedule configuration
  const config: ScheduleConfig = {
    tournamentId,
    startTime: tournament?.startDate?.toDate() || new Date(),
    endTime: tournament?.endDate?.toDate() || new Date(Date.now() + 24 * 60 * 60 * 1000),
    minRestTimeMinutes: settings.minRestTimeMinutes,
    matchDurationMinutes: settings.matchDurationMinutes,
  };

  // Run scheduling algorithm
  const schedule = scheduleMatches(matches, courts, config);

  // Update matches with scheduled times and courts
  const batch = db.batch();

  for (const slot of schedule) {
    const matchRef = db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('matches')
      .doc(slot.matchId);

    batch.update(matchRef, {
      courtId: slot.courtId,
      scheduledTime: admin.firestore.Timestamp.fromDate(slot.startTime),
      status: 'scheduled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
}

/**
 * Core scheduling algorithm with rest time constraint
 */
function scheduleMatches(
  matches: (Match & { id: string })[],
  courts: Court[],
  config: ScheduleConfig
): ScheduleSlot[] {
  const schedule: ScheduleSlot[] = [];
  const participantSchedules: Map<string, ParticipantSchedule> = new Map();
  const courtNextAvailable: Map<string, Date> = new Map();

  // Initialize court availability
  for (const court of courts) {
    courtNextAvailable.set(court.id, config.startTime);
  }

  // Group matches by round and dependency
  const matchesByRound = groupMatchesByRound(matches);
  const scheduledMatchIds = new Set<string>();

  // Process rounds in order
  for (const [_round, roundMatches] of matchesByRound) {
    // Sort matches within round by priority (seeded matches first)
    const sortedMatches = sortMatchesByPriority(roundMatches);

    for (const match of sortedMatches) {
      // Skip if already scheduled or missing participants
      if (scheduledMatchIds.has(match.id)) continue;
      if (!match.participant1Id && !match.participant2Id) continue;

      // Find earliest valid slot
      const slot = findEarliestSlot(
        match,
        courts,
        config,
        participantSchedules,
        courtNextAvailable,
        scheduledMatchIds,
        matches
      );

      if (slot) {
        schedule.push(slot);
        scheduledMatchIds.add(match.id);

        // Update participant schedules
        updateParticipantSchedule(
          participantSchedules,
          match.participant1Id,
          slot.endTime,
          match.id
        );
        updateParticipantSchedule(
          participantSchedules,
          match.participant2Id,
          slot.endTime,
          match.id
        );

        // Update court availability
        courtNextAvailable.set(slot.courtId, slot.endTime);
      }
    }
  }

  return schedule;
}

/**
 * Find earliest valid time slot for a match
 */
function findEarliestSlot(
  match: Match & { id: string },
  courts: Court[],
  config: ScheduleConfig,
  participantSchedules: Map<string, ParticipantSchedule>,
  courtNextAvailable: Map<string, Date>,
  scheduledMatchIds: Set<string>,
  allMatches: (Match & { id: string })[]
): ScheduleSlot | null {
  let earliestSlot: ScheduleSlot | null = null;
  let earliestTime = new Date(config.endTime.getTime() + 1);

  // Calculate minimum start time based on participant rest
  const p1Schedule = participantSchedules.get(match.participant1Id || '');
  const p2Schedule = participantSchedules.get(match.participant2Id || '');

  let minStartTime = new Date(config.startTime);

  if (p1Schedule?.lastMatchEndTime) {
    const p1RestEnd = new Date(
      p1Schedule.lastMatchEndTime.getTime() + config.minRestTimeMinutes * 60 * 1000
    );
    if (p1RestEnd > minStartTime) {
      minStartTime = p1RestEnd;
    }
  }

  if (p2Schedule?.lastMatchEndTime) {
    const p2RestEnd = new Date(
      p2Schedule.lastMatchEndTime.getTime() + config.minRestTimeMinutes * 60 * 1000
    );
    if (p2RestEnd > minStartTime) {
      minStartTime = p2RestEnd;
    }
  }

  // Check if previous match in bracket is complete (for advancement)
  // Find matches that feed into this one
  const feedingMatches = allMatches.filter(
    (m) => m.nextMatchId === match.id && !scheduledMatchIds.has(m.id)
  );

  // If there are unscheduled feeding matches, we can't schedule this yet
  if (feedingMatches.length > 0) {
    return null;
  }

  // Try each court
  for (const court of courts) {
    const courtAvailable = courtNextAvailable.get(court.id) || config.startTime;
    const startTime = new Date(Math.max(courtAvailable.getTime(), minStartTime.getTime()));
    const endTime = new Date(startTime.getTime() + config.matchDurationMinutes * 60 * 1000);

    // Check if within tournament time
    if (endTime > config.endTime) continue;

    // Check if this is the earliest slot
    if (startTime < earliestTime) {
      earliestTime = startTime;
      earliestSlot = {
        courtId: court.id,
        matchId: match.id,
        startTime,
        endTime,
      };
    }
  }

  return earliestSlot;
}

/**
 * Group matches by round number
 */
function groupMatchesByRound(
  matches: (Match & { id: string })[]
): Map<number, (Match & { id: string })[]> {
  const groups = new Map<number, (Match & { id: string })[]>();

  for (const match of matches) {
    if (!groups.has(match.round)) {
      groups.set(match.round, []);
    }
    groups.get(match.round)!.push(match);
  }

  // Sort map by round number
  return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
}

/**
 * Sort matches within a round by priority
 */
function sortMatchesByPriority(
  matches: (Match & { id: string })[]
): (Match & { id: string })[] {
  return matches.sort((a, b) => {
    // Prioritize matches where both participants are ready
    const aReady = a.participant1Id && a.participant2Id ? 1 : 0;
    const bReady = b.participant1Id && b.participant2Id ? 1 : 0;

    if (aReady !== bReady) return bReady - aReady;

    // Then by match number
    return a.matchNumber - b.matchNumber;
  });
}

/**
 * Update participant schedule tracking
 */
function updateParticipantSchedule(
  schedules: Map<string, ParticipantSchedule>,
  participantId: string | undefined,
  endTime: Date,
  matchId: string
): void {
  if (!participantId) return;

  const existing = schedules.get(participantId) || {
    lastMatchEndTime: null,
    matchIds: [],
  };

  existing.lastMatchEndTime = endTime;
  existing.matchIds.push(matchId);

  schedules.set(participantId, existing);
}
