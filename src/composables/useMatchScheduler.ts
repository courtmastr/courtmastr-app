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
import type { Court, Match } from '@/types';

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

export interface ScheduleResult {
  scheduled: ScheduledMatch[];
  unscheduled: string[]; // Match IDs that couldn't be scheduled
  stats: {
    totalMatches: number;
    scheduledCount: number;
    courtUtilization: number; // percentage
    estimatedDuration: number; // minutes
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
      categoryId?: string;
      courtIds?: string[];
      startTime?: Date;
      respectDependencies?: boolean;
    } = {}
  ): Promise<ScheduleResult> {
    loading.value = true;
    error.value = null;
    progress.value = 0;

    try {
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

      // 3. Get unscheduled matches from brackets-manager
      const matchesQuery = query(
        collection(db, 'tournaments', tournamentId, 'match'),
        where('status', 'in', [0, 1, 2]), // locked, waiting, ready
        orderBy('round_id'),
        orderBy('number')
      );
      
      const matchesSnap = await getDocs(matchesQuery);
      let matches = matchesSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as any[];

      // Filter by category if specified
      if (options.categoryId) {
        // Need to get stages for this category first
        const stagesQuery = query(
          collection(db, 'tournaments', tournamentId, 'stage'),
          where('tournament_id', '==', options.categoryId)
        );
        const stagesSnap = await getDocs(stagesQuery);
        const stageIds = stagesSnap.docs.map(d => d.id);
        
        matches = matches.filter(m => stageIds.includes(m.stage_id));
      }

      if (matches.length === 0) {
        return {
          scheduled: [],
          unscheduled: [],
          stats: {
            totalMatches: 0,
            scheduledCount: 0,
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

      const schedule = generateSchedule(matches, config, options.respectDependencies !== false);

      progress.value = 70;

      // 5. Save schedule to Firestore
      await saveSchedule(tournamentId, schedule.scheduled);

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
    matchId: string,
    courtId: string,
    scheduledTime: Date
  ): Promise<void> {
    // Update match_scores collection (Courtmaster's pattern)
    await setDoc(
      doc(db, 'tournaments', tournamentId, 'match_scores', matchId),
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
    categoryId?: string
  ): Promise<{ cleared: number }> {
    // Get scheduled matches
    let matchesQuery = query(
      collection(db, 'tournaments', tournamentId, 'match_scores'),
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
  const unscheduled: string[] = [];
  
  // Track court availability
  const courtAvailability = new Map<string, Date>();
  for (const court of config.courts) {
    courtAvailability.set(court.id, config.startTime);
  }
  
  // Track participant (registration) last match end time
  const participantSchedule = new Map<string, Date>();
  
  // Track scheduled match IDs
  const scheduledMatchIds = new Set<string>();
  
  // Get registrations from participants
  const getMatchParticipantIds = (match: any): string[] => {
    const ids: string[] = [];
    if (match.opponent1?.id) ids.push(match.opponent1.id);
    if (match.opponent2?.id) ids.push(match.opponent2.id);
    return ids;
  };

  // Sort matches by priority
  // 1. Ready matches first (both participants known)
  // 2. By round number
  // 3. By match number
  const sortedMatches = [...matches].sort((a, b) => {
    const aReady = a.opponent1?.id && a.opponent2?.id ? 1 : 0;
    const bReady = b.opponent1?.id && b.opponent2?.id ? 1 : 0;
    if (aReady !== bReady) return bReady - aReady;
    
    if (a.round_id !== b.round_id) return a.round_id - b.round_id;
    return a.number - b.number;
  });

  let sequence = 1;
  let lastEndTime = config.startTime;

  for (const match of sortedMatches) {
    const matchId = match.id;
    const participantIds = getMatchParticipantIds(match);
    
    // Skip if both participants are unknown (TBD match)
    if (participantIds.length === 0 && match.status === 0) {
      unscheduled.push(matchId);
      continue;
    }

    // Calculate earliest start time based on:
    // 1. Court availability
    // 2. Participant rest times
    let earliestStart = config.startTime;
    
    // Check participant rest constraints
    for (const pid of participantIds) {
      const lastEnd = participantSchedule.get(pid);
      if (lastEnd) {
        const restEnd = new Date(lastEnd.getTime() + config.minRestTimeMinutes * 60 * 1000);
        if (restEnd > earliestStart) {
          earliestStart = restEnd;
        }
      }
    }

    // Find best court (earliest available)
    let bestCourt: Court | null = null;
    let bestStartTime = new Date(config.endTime?.getTime() || Date.now() + 86400000);

    for (const court of config.courts) {
      const availableTime = courtAvailability.get(court.id) || config.startTime;
      const potentialStart = new Date(Math.max(availableTime.getTime(), earliestStart.getTime()));
      
      if (potentialStart < bestStartTime) {
        bestStartTime = potentialStart;
        bestCourt = court;
      }
    }

    // Check if we found a valid slot
    if (!bestCourt) {
      unscheduled.push(matchId);
      continue;
    }

    const endTime = new Date(bestStartTime.getTime() + config.matchDurationMinutes * 60 * 1000);
    
    // Check if within tournament end time
    if (config.endTime && endTime > config.endTime) {
      unscheduled.push(matchId);
      continue;
    }

    // Schedule the match
    scheduled.push({
      matchId,
      courtId: bestCourt.id,
      courtNumber: bestCourt.number,
      scheduledTime: bestStartTime,
      estimatedEndTime: endTime,
      sequence: sequence++,
    });

    scheduledMatchIds.add(matchId);
    
    // Update tracking
    courtAvailability.set(bestCourt.id, endTime);
    for (const pid of participantIds) {
      participantSchedule.set(pid, endTime);
    }
    
    if (endTime > lastEndTime) {
      lastEndTime = endTime;
    }
  }

  // Calculate stats
  const totalMatches = matches.length;
  const scheduledCount = scheduled.length;
  const duration = lastEndTime.getTime() - config.startTime.getTime();
  const estimatedDuration = Math.ceil(duration / (1000 * 60));
  
  // Court utilization: how much of available court time is used
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
      courtUtilization: Math.min(courtUtilization, 100),
      estimatedDuration,
    },
  };
}

async function saveSchedule(
  tournamentId: string,
  scheduled: ScheduledMatch[]
): Promise<void> {
  const batch = writeBatch(db);

  for (const slot of scheduled) {
    // Save to match_scores collection (following Courtmaster pattern)
    const scoreRef = doc(db, 'tournaments', tournamentId, 'match_scores', slot.matchId);
    batch.set(
      scoreRef,
      {
        courtId: slot.courtId,
        scheduledTime: Timestamp.fromDate(slot.scheduledTime),
        sequence: slot.sequence,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
}
