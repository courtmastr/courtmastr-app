/**
 * Match Scheduler for Courtmaster
 * Assigns matches to courts with proper sequencing and rest time constraints
 */

import { ref } from 'vue';
import {
  db,
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
} from '@/services/firebase';
import type { Court, Match, Registration } from '@/types';
import { adaptBracketsMatchToLegacyMatch, type BracketsMatch, type Participant } from '@/stores/bracketMatchAdapter';

// ============================================
// Types
// ============================================

export interface ScheduleConfig {
  startTime: Date;
  endTime?: Date;
  matchDurationMinutes: number;
  minRestTimeMinutes: number;
  courts: Court[];
}

export interface ScheduledMatch {
  matchId: string;
  courtId: string;
  courtNumber: number;
  scheduledTime: Date;
  estimatedEndTime: Date;
  sequence: number;
}

export interface UnscheduledMatch {
  matchId: string;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface ScheduleResult {
  scheduled: ScheduledMatch[];
  unscheduled: UnscheduledMatch[];
  stats: {
    totalMatches: number;
    scheduledCount: number;
    unscheduledCount: number;
    courtUtilization: number;
    estimatedDuration: number;
  };
}

// ============================================
// Main Scheduler
// ============================================

export function useMatchScheduler() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const progress = ref(0);

  /**
   * Auto-schedule all ready matches for a tournament/category
   */
  async function scheduleMatches(
    tournamentId: string,
    options: {
      categoryId: string;
      courtIds?: string[];
      startTime?: Date;
      respectDependencies?: boolean;
    }
  ): Promise<ScheduleResult> {
    loading.value = true;
    error.value = null;
    progress.value = 0;

    try {
      if (!options.categoryId) {
        throw new Error('categoryId is required for scheduling');
      }

      // 1. Get tournament settings
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
      if (!tournamentDoc.exists()) {
        throw new Error('Tournament not found');
      }
      
      const tournament = tournamentDoc.data();
      const settings = tournament?.settings || {
        matchDurationMinutes: 30,
        minRestTimeMinutes: 15,
      };

      progress.value = 10;

      // 2. Get courts
      let courtsQuery = query(
        collection(db, 'tournaments', tournamentId, 'courts'),
        where('status', 'in', ['available', 'in_use'])
      );
      
      if (options.courtIds && options.courtIds.length > 0) {
        // If specific courts specified, filter them
        courtsQuery = query(courtsQuery, where('__name__', 'in', options.courtIds));
      }
      
      const courtsSnap = await getDocs(courtsQuery);
      const courts = courtsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Court))
        .sort((a, b) => a.number - b.number);

      if (courts.length === 0) {
        throw new Error('No available courts for scheduling');
      }

      progress.value = 20;

      // Query matches directly without complex filters to avoid index issues
      const matchPath = `tournaments/${tournamentId}/categories/${options.categoryId}/match`;
      const participantPath = `tournaments/${tournamentId}/categories/${options.categoryId}/participant`;
      const matchScoresPath = `tournaments/${tournamentId}/categories/${options.categoryId}/match_scores`;

      console.log('[scheduleMatches] Querying matches from:', {
        matchPath,
        tournamentId,
        categoryId: options.categoryId
      });

      let matches: Match[] = [];
      let adaptedMatches: Match[] = [];

      try {
        const [matchSnap, registrationSnap, participantSnap, matchScoresSnap] = await Promise.all([
          getDocs(collection(db, matchPath)),
          getDocs(collection(db, `tournaments/${tournamentId}/registrations`)),
          getDocs(collection(db, participantPath)),
          getDocs(collection(db, matchScoresPath))
        ]);

        console.log('[scheduleMatches] Raw query results:', {
          matches: matchSnap.size,
          registrations: registrationSnap.size,
          participants: participantSnap.size,
          matchScores: matchScoresSnap.size
        });

        if (matchSnap.size === 0) {
          console.warn('[scheduleMatches] No matches found in Firestore at path:', matchPath);
        }

        const bracketsMatches = matchSnap.docs.map(d => {
          const data = d.data();
          console.log('[scheduleMatches] Sample match data:', { id: d.id, status: data.status, stage_id: data.stage_id });
          return { ...data, id: d.id };
        }) as BracketsMatch[];
        const registrations = registrationSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Registration[];
        const participants = participantSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[];
        const matchScoresMap = new Map(matchScoresSnap.docs.map(d => [d.id, d.data()]));

        console.log('[scheduleMatches] Starting adaptation of', bracketsMatches.length, 'matches');

        // Adapt brackets-manager matches to legacy format
        adaptedMatches = [];
        for (const bMatch of bracketsMatches) {
          const adapted = adaptBracketsMatchToLegacyMatch(
            bMatch,
            registrations,
            participants,
            options.categoryId,
            tournamentId
          );

          if (adapted) {
            // Merge with match_scores data if it exists
            const scoreData = matchScoresMap.get(adapted.id);
            if (scoreData) {
              if (scoreData.status) adapted.status = scoreData.status as any;
              if (scoreData.courtId) adapted.courtId = scoreData.courtId as string;
              if (scoreData.scheduledTime) adapted.scheduledTime = scoreData.scheduledTime instanceof Timestamp ? scoreData.scheduledTime.toDate() : scoreData.scheduledTime as Date;
            }
            adaptedMatches.push(adapted);
          }
        }

        console.log('[scheduleMatches] Adapted matches:', adaptedMatches.length);
        if (adaptedMatches.length > 0) {
          console.log('[scheduleMatches] First adapted match:', {
            id: adaptedMatches[0].id,
            status: adaptedMatches[0].status,
            round: adaptedMatches[0].round,
            matchNumber: adaptedMatches[0].matchNumber,
            participant1Id: adaptedMatches[0].participant1Id,
            participant2Id: adaptedMatches[0].participant2Id,
            courtId: adaptedMatches[0].courtId,
            scheduledTime: adaptedMatches[0].scheduledTime
          });
        }

        // Filter matches ready for scheduling
        matches = adaptedMatches.filter(m => {
          // Include matches that are:
          // 1. Not yet completed or walkover
          // 2. Don't already have a court assignment or scheduled time
          // Note: We include TBD matches (without participants yet) as they need time slots
          const isSchedulable =
            m.status !== 'completed' &&
            m.status !== 'walkover' &&
            !m.courtId &&
            !m.scheduledTime;
          return isSchedulable;
        });

        console.log(`[scheduleMatches] Found ${matches.length} schedulable matches out of ${adaptedMatches.length} adapted`);
      } catch (queryError) {
        console.error('[scheduleMatches] Error querying matches:', queryError);
        throw queryError;
      }

      if (matches.length === 0) {
        console.log('[scheduleMatches] No schedulable matches found');
        return {
          scheduled: [],
          unscheduled: [],
          stats: {
            totalMatches: adaptedMatches.length,
            scheduledCount: 0,
            unscheduledCount: 0,
            courtUtilization: 0,
            estimatedDuration: 0,
          },
        };
      }

      progress.value = 40;

      // 4. Generate schedule
      const startTime = options.startTime || new Date();
      const endTime = tournament?.endDate?.toDate?.() || new Date(startTime.getTime() + 24 * 60 * 60 * 1000);

      const config: ScheduleConfig = {
        startTime,
        endTime,
        matchDurationMinutes: settings.matchDurationMinutes || 30,
        minRestTimeMinutes: settings.minRestTimeMinutes || 15,
        courts,
      };

      console.log('[scheduleMatches] Scheduling configuration:', {
        categoryId: options.categoryId,
        matchCount: matches.length,
        courts: courts.length,
        startTime: config.startTime,
        respectDependencies: options.respectDependencies,
        sampleMatches: matches.slice(0, 3).map(m => ({
          id: m.id,
          round: m.round,
          matchNumber: m.matchNumber,
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
        }))
      });

      const schedule = generateSchedule(matches, config, options.respectDependencies !== false);

      progress.value = 70;

      await saveSchedule(tournamentId, options.categoryId, schedule.scheduled);

      progress.value = 100;

      return schedule;

    } catch (err) {
      console.error('Error scheduling matches:', err);
      error.value = err instanceof Error ? err.message : 'Failed to schedule matches';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Schedule a single match to a specific court
   */
  async function scheduleSingleMatch(
    tournamentId: string,
    categoryId: string,
    matchId: string,
    courtId: string,
    scheduledTime: Date
  ): Promise<void> {
    await setDoc(
      doc(db, 'tournaments', tournamentId, 'categories', categoryId, 'match_scores', matchId),
      {
        courtId,
        scheduledTime: Timestamp.fromDate(scheduledTime),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Update court status
    await updateDoc(doc(db, 'tournaments', tournamentId, 'courts', courtId), {
      status: 'in_use',
      currentMatchId: matchId,
      updatedAt: serverTimestamp(),
    });
  }

  /**
   * Clear schedule for matches that haven't started
   */
  async function clearSchedule(
    tournamentId: string,
    categoryId: string
  ): Promise<{ cleared: number }> {
    const matchScoresPath = `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;
    let matchesQuery = query(
      collection(db, matchScoresPath),
      where('courtId', '!=', null)
    );
    
    const matchesSnap = await getDocs(matchesQuery);
    const batch = writeBatch(db);
    let cleared = 0;

    for (const matchDoc of matchesSnap.docs) {
      const data = matchDoc.data();
      
      // Only clear if match hasn't started (no startedAt)
      if (!data.startedAt) {
        batch.update(matchDoc.ref, {
          courtId: null,
          scheduledTime: null,
          updatedAt: serverTimestamp(),
        });
        cleared++;

        // Release court if assigned
        if (data.courtId) {
          batch.update(doc(db, 'tournaments', tournamentId, 'courts', data.courtId), {
            status: 'available',
            currentMatchId: null,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    await batch.commit();
    return { cleared };
  }

  return {
    loading,
    error,
    progress,
    scheduleMatches,
    scheduleSingleMatch,
    clearSchedule,
  };
}

// ============================================
// Scheduling Algorithm
// ============================================

import { setDoc } from 'firebase/firestore';

function generateSchedule(
  matches: any[],
  config: ScheduleConfig,
  respectDependencies: boolean
): ScheduleResult {
  const scheduled: ScheduledMatch[] = [];
  const unscheduled: UnscheduledMatch[] = [];

  const courtAvailability = new Map<string, Date>();
  for (const court of config.courts) {
    courtAvailability.set(court.id, config.startTime);
  }

  const participantSchedule = new Map<string, Date>();
  const scheduledMatchIds = new Set<string>();

  /**
   * Extract participant IDs from match
   * Uses participant1Id/participant2Id (from brackets-manager)
   */
  const getMatchParticipantIds = (match: any): string[] => {
    const ids: string[] = [];
    if (match.participant1Id) ids.push(match.participant1Id);
    if (match.participant2Id) ids.push(match.participant2Id);
    return ids;
  };

  /**
   * Group matches by round number
   */
  const matchesByRound = new Map<number, any[]>();
  for (const match of matches) {
    if (!matchesByRound.has(match.round)) {
      matchesByRound.set(match.round, []);
    }
    matchesByRound.get(match.round)!.push(match);
  }

  const sortedRounds = Array.from(matchesByRound.keys()).sort((a, b) => a - b);

  let sequence = 1;
  let lastEndTime = config.startTime;
  const latestEnd = config.endTime || new Date(config.startTime.getTime() + 12 * 60 * 60 * 1000);

  /**
   * Process rounds sequentially (round 1, then round 2, etc.)
   */
  for (const round of sortedRounds) {
    const roundMatches = matchesByRound.get(round)!;

    /**
     * Sort matches within round by priority:
     * 1. Ready matches first (both participants present)
     * 2. Then by position (matchNumber)
     */
    const sortedMatches = roundMatches.sort((a, b) => {
      const aReady = a.participant1Id && a.participant2Id ? 1 : 0;
      const bReady = b.participant1Id && b.participant2Id ? 1 : 0;
      if (aReady !== bReady) return bReady - aReady;
      return (a.matchNumber || a.position || 0) - (b.matchNumber || b.position || 0);
    });

    for (const match of sortedMatches) {
      const matchId = match.id;
      const participantIds = getMatchParticipantIds(match);

      // Skip TBD matches (no participants)
      if (participantIds.length === 0 && match.status === 0) {
        unscheduled.push({ matchId, reason: 'Waiting for participants (TBD match)' });
        continue;
      }

      /**
       * CRITICAL: Check bracket dependencies
       * Feeding match = match where nextMatchId === currentMatch.id
       * If feeding matches are unscheduled, skip this match
       */
      if (respectDependencies) {
        const feedingMatches = matches.filter(
          (m) => m.nextMatchId === match.id && !scheduledMatchIds.has(m.id)
        );
        if (feedingMatches.length > 0) {
          unscheduled.push({
            matchId,
            reason: `Waiting for ${feedingMatches.length} feeding match(es) to complete`,
            details: { feedingMatchIds: feedingMatches.map((m) => m.id) }
          });
          continue;
        }
      }

      /**
       * Calculate earliest start time based on participant rest
       * Rest time = minRestTimeMinutes * 60 * 1000 milliseconds
       */
      let earliestStart = config.startTime;
      let restViolation = false;
      let restViolationDetails: { participantId: string; restEndTime: Date } | null = null;

      for (const pid of participantIds) {
        const lastEnd = participantSchedule.get(pid);
        if (lastEnd) {
          const restEnd = new Date(lastEnd.getTime() + config.minRestTimeMinutes * 60 * 1000);
          if (restEnd > earliestStart) {
            earliestStart = restEnd;
            if (restEnd > latestEnd) {
              restViolation = true;
              restViolationDetails = { participantId: pid, restEndTime: restEnd };
            }
          }
        }
      }

      if (restViolation && restViolationDetails) {
        unscheduled.push({
          matchId,
          reason: `Participant needs ${config.minRestTimeMinutes}-minute rest until ${restViolationDetails.restEndTime.toLocaleTimeString()}, but tournament ends at ${latestEnd.toLocaleTimeString()}`,
          details: { participantId: restViolationDetails.participantId, restEndTime: restViolationDetails.restEndTime, tournamentEndTime: latestEnd }
        });
        continue;
      }

      /**
       * Try all courts, pick earliest available
       * Court selection: Find court with earliest available time
       */
      let bestCourt: Court | null = null;
      let bestStartTime = new Date(latestEnd.getTime());

      for (const court of config.courts) {
        const availableTime = courtAvailability.get(court.id) || config.startTime;
        const potentialStart = new Date(Math.max(availableTime.getTime(), earliestStart.getTime()));
        if (potentialStart < bestStartTime) {
          bestStartTime = potentialStart;
          bestCourt = court;
        }
      }

      if (!bestCourt) {
        unscheduled.push({ matchId, reason: 'No available courts' });
        continue;
      }

      const endTime = new Date(bestStartTime.getTime() + config.matchDurationMinutes * 60 * 1000);

      /**
       * Time window: Must end before tournament end time
       */
      if (endTime > latestEnd) {
        unscheduled.push({
          matchId,
          reason: `No available time slot. Match would end at ${endTime.toLocaleTimeString()}, but tournament ends at ${latestEnd.toLocaleTimeString()}`,
          details: { estimatedEnd: endTime, tournamentEnd: latestEnd }
        });
        continue;
      }

      /**
       * Write to schedule with fields: courtId, scheduledTime, sequence, updatedAt
       */
      scheduled.push({
        matchId,
        courtId: bestCourt.id,
        courtNumber: bestCourt.number,
        scheduledTime: bestStartTime,
        estimatedEndTime: endTime,
        sequence: sequence++,
      });

      scheduledMatchIds.add(matchId);
      courtAvailability.set(bestCourt.id, endTime);
      for (const pid of participantIds) {
        participantSchedule.set(pid, endTime);
      }
      if (endTime > lastEndTime) {
        lastEndTime = endTime;
      }
    }
  }

  const totalMatches = matches.length;
  const scheduledCount = scheduled.length;
  const unscheduledCount = unscheduled.length;
  const duration = lastEndTime.getTime() - config.startTime.getTime();
  const estimatedDuration = Math.ceil(duration / (1000 * 60));
  const totalCourtMinutes = config.courts.length * estimatedDuration;
  const usedMinutes = scheduledCount * config.matchDurationMinutes;
  const courtUtilization = totalCourtMinutes > 0
    ? Math.round((usedMinutes / totalCourtMinutes) * 100)
    : 0;

  return {
    scheduled,
    unscheduled,
    stats: {
      totalMatches,
      scheduledCount,
      unscheduledCount,
      courtUtilization: Math.min(courtUtilization, 100),
      estimatedDuration,
    },
  };
}

async function saveSchedule(
  tournamentId: string,
  categoryId: string,
  scheduled: ScheduledMatch[]
): Promise<void> {
  const batch = writeBatch(db);

  for (const slot of scheduled) {
    const scoreRef = doc(
      db,
      'tournaments',
      tournamentId,
      'categories',
      categoryId,
      'match_scores',
      slot.matchId
    );
    batch.set(
      scoreRef,
      {
        courtId: slot.courtId,
        scheduledTime: Timestamp.fromDate(slot.scheduledTime),
        sequence: slot.sequence,
        status: 'scheduled',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}
