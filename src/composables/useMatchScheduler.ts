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
  Timestamp,
  serverTimestamp,
  setDoc,
} from '@/services/firebase';
import type { Court, Match, Registration } from '@/types';
import {
  adaptBracketsMatchToLegacyMatch,
  buildMatchStructureMaps,
  type BracketsMatch,
  type Participant,
} from '@/stores/bracketMatchAdapter';
import { scheduleTimes, saveTimedSchedule, type TimeScheduleConfig } from './useTimeScheduler';

// ============================================
// Types
// ============================================

export interface ScheduleConfig {
  startTime: Date;
  endTime?: Date;
  matchDurationMinutes: number;
  bufferMinutes?: number;
  minRestTimeMinutes: number;
  concurrency?: number;  // defaults to courts.length when courts provided
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
      levelId?: string;
      courtIds?: string[];
      startTime?: Date;
      respectDependencies?: boolean;
      matchDurationMinutes?: number;
      bufferMinutes?: number;
      concurrency?: number;
      reflowMode?: boolean;
      allowPublishedChanges?: boolean;
      includeAssignedMatches?: boolean;
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
      // Bug B fix: only count 'available' courts for concurrency; do not count in_use courts
      // as they are already occupied and cannot take new assignments at schedule time.
      let courtsQuery = query(
        collection(db, 'tournaments', tournamentId, 'courts'),
        where('status', 'in', ['available'])
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
      const basePath = options.levelId
        ? `tournaments/${tournamentId}/categories/${options.categoryId}/levels/${options.levelId}`
        : `tournaments/${tournamentId}/categories/${options.categoryId}`;
      const matchPath = `${basePath}/match`;
      const participantPath = `${basePath}/participant`;
      const matchScoresPath = `${basePath}/match_scores`;
      const roundPath = `${basePath}/round`;
      const groupPath = `${basePath}/group`;

      console.log('[scheduleMatches] Querying matches from:', {
        matchPath,
        tournamentId,
        categoryId: options.categoryId
      });

      let matches: Match[] = [];
      let adaptedMatches: Match[] = [];

      try {
        const [matchSnap, registrationSnap, participantSnap, matchScoresSnap, roundSnap, groupSnap] = await Promise.all([
          getDocs(collection(db, matchPath)),
          getDocs(collection(db, `tournaments/${tournamentId}/registrations`)),
          getDocs(collection(db, participantPath)),
          getDocs(collection(db, matchScoresPath)),
          getDocs(collection(db, roundPath)),
          getDocs(collection(db, groupPath)),
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
        const rounds = roundSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const groups = groupSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const structureMaps = buildMatchStructureMaps(rounds, groups);

        console.log('[scheduleMatches] Starting adaptation of', bracketsMatches.length, 'matches');

        // Adapt brackets-manager matches to legacy format.
        // includeTBD=true so we get placeholder matches for future bracket rounds.
        adaptedMatches = [];
        for (const bMatch of bracketsMatches) {
          const adapted = adaptBracketsMatchToLegacyMatch(
            bMatch,
            registrations,
            participants,
            options.categoryId,
            tournamentId,
            structureMaps,
            { includeTBD: true }
          );

          if (adapted) {
            (adapted as Match).levelId = options.levelId;
            // Merge with match_scores data if it exists
            const scoreData = matchScoresMap.get(adapted.id);
            if (scoreData) {
              // GUARD: Bracket status 4 (completed) must not be overridden
              // by stale match_scores status — prevents re-scheduling completed matches
              const bracketCompleted = bMatch.status === 4;
              if (scoreData.status) {
                if (bracketCompleted && scoreData.status !== 'completed' && scoreData.status !== 'walkover') {
                  console.warn(`[scheduleMatches] ⚠️ Ignoring stale match_scores status "${scoreData.status}" for completed bracket match ${adapted.id}`);
                } else {
                  adapted.status = scoreData.status as any;
                }
              }
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

        // Filter matches ready for time scheduling:
        // - Never touch completed/walkover/cancelled
        // - Respect lockedTime manual overrides
        // - In reflow mode, keep safe defaults unless explicitly overridden
        // TBD matches (no participants) are intentionally included for placeholder slots.
        matches = adaptedMatches.filter(m => {
          const scoreData = matchScoresMap.get(m.id);
          if (scoreData?.lockedTime === true) return false; // Bug D fix: skip locked matches

          const status = String(m.status || '');
          if (status === 'completed' || status === 'walkover' || status === 'cancelled') {
            return false;
          }

          if (options.reflowMode === true) {
            const isPublished = scoreData?.scheduleStatus === 'published' || Boolean(scoreData?.publishedAt);
            if (isPublished && options.allowPublishedChanges !== true) {
              return false;
            }

            const hasAssignedCourt = Boolean(scoreData?.courtId || m.courtId);
            if (hasAssignedCourt && options.includeAssignedMatches !== true) {
              return false;
            }

            if (status === 'in_progress') {
              return false;
            }
          }

          return true;
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

      // 4. Time-first scheduling (court-independent)
      const startTime = options.startTime || new Date();
      const endTime = tournament?.endDate?.toDate?.() || undefined;

      const matchDurationMinutes =
        options.matchDurationMinutes ?? settings.matchDurationMinutes ?? 30;
      const bufferMinutes = options.bufferMinutes ?? settings.bufferMinutes ?? 0;
      const concurrency = options.concurrency ?? (courts.length || 1);

      const timeConfig: TimeScheduleConfig = {
        startTime,
        endTime,
        matchDurationMinutes,
        bufferMinutes,
        concurrency,
        minRestTimeMinutes: settings.minRestTimeMinutes ?? 15,
      };

      console.log('[scheduleMatches] Time-first scheduling configuration:', {
        categoryId: options.categoryId,
        matchCount: matches.length,
        concurrency,
        matchDurationMinutes,
        bufferMinutes,
        startTime,
      });

      const timeResult = scheduleTimes(matches, timeConfig);

      progress.value = 70;

      await saveTimedSchedule(
        tournamentId,
        options.categoryId,
        timeResult,
        options.levelId
      );
      progress.value = 100;

      // Return result in the existing ScheduleResult shape for backward compat
      const schedule: ScheduleResult = {
        scheduled: timeResult.planned.map((p, i) => ({
          matchId: p.matchId,
          courtId: '',         // time-first: no court assigned
          courtNumber: 0,
          scheduledTime: p.plannedStartAt,
          estimatedEndTime: p.plannedEndAt,
          sequence: i + 1,
        })),
        unscheduled: timeResult.unscheduled,
        stats: {
          totalMatches: timeResult.stats.totalMatches,
          scheduledCount: timeResult.stats.plannedCount,
          unscheduledCount: timeResult.stats.unscheduledCount,
          courtUtilization: 0,
          estimatedDuration: timeResult.stats.estimatedEndTime
            ? Math.ceil((timeResult.stats.estimatedEndTime.getTime() - startTime.getTime()) / 60_000)
            : 0,
        },
      };

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
    scheduledTime: Date,
    levelId?: string
  ): Promise<void> {
    const matchScoresPath = levelId
      ? `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match_scores`
      : `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;
    await setDoc(
      doc(db, matchScoresPath, matchId),
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
    categoryId: string,
    levelId?: string
  ): Promise<{ cleared: number }> {
    const matchScoresPath = levelId
      ? `tournaments/${tournamentId}/categories/${categoryId}/levels/${levelId}/match_scores`
      : `tournaments/${tournamentId}/categories/${categoryId}/match_scores`;
    const matchesQuery = query(
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
          plannedStartAt: null,
          plannedEndAt: null,
          scheduleStatus: null,
          scheduleVersion: null,
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
