/**
 * Tournament Setup Composable
 * Combines bracket generation and match scheduling into a single workflow
 */

import { ref } from 'vue';
import { useBracketGenerator } from './useBracketGenerator';
import { useMatchScheduler } from './useMatchScheduler';

export interface SetupOptions {
  tournamentId: string;
  categoryId: string;
  // Bracket options
  format?: 'single_elimination' | 'double_elimination' | 'round_robin';
  grandFinal?: 'simple' | 'double' | 'none';
  consolationFinal?: boolean;
  // Schedule options
  autoSchedule?: boolean;
  startTime?: Date;
  courtIds?: string[];
}

export interface SetupResult {
  success: boolean;
  bracket: {
    matchCount: number;
    stageId?: string;
  };
  schedule: {
    scheduled: number;
    unscheduled: number;
    estimatedDuration: number;
    courtUtilization: number;
  };
}

export function useTournamentSetup() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const step = ref<'idle' | 'generating' | 'scheduling' | 'complete'>('idle');
  const progress = ref(0);

  const bracketGen = useBracketGenerator();
  const scheduler = useMatchScheduler();

  /**
   * Generate bracket and optionally schedule matches
   */
  async function setupCategory(options: SetupOptions): Promise<SetupResult> {
    loading.value = true;
    error.value = null;
    step.value = 'generating';
    progress.value = 0;

    const result: SetupResult = {
      success: false,
      bracket: { matchCount: 0 },
      schedule: { scheduled: 0, unscheduled: 0, estimatedDuration: 0, courtUtilization: 0 },
    };

    try {
      // Step 1: Generate Bracket
      console.log(`🎾 Setting up category ${options.categoryId}...`);
      console.log(`   Format: ${options.format || 'from category'}`);
      console.log(`   Auto-schedule: ${options.autoSchedule !== false}`);

      const bracketResult = await bracketGen.generateBracket(
        options.tournamentId,
        options.categoryId,
        {
          grandFinal: options.grandFinal,
          consolationFinal: options.consolationFinal,
        }
      );

      result.bracket.matchCount = bracketResult.matchCount;
      progress.value = 50;

      console.log(`✅ Bracket generated: ${bracketResult.matchCount} matches`);

      // Step 2: Schedule matches (if enabled)
      if (options.autoSchedule !== false && bracketResult.matchCount > 0) {
        step.value = 'scheduling';

        const scheduleResult = await scheduler.scheduleMatches(
          options.tournamentId,
          {
            categoryId: options.categoryId,
            courtIds: options.courtIds,
            startTime: options.startTime,
            respectDependencies: true,
          }
        );

        result.schedule.scheduled = scheduleResult.stats.scheduledCount;
        result.schedule.unscheduled = scheduleResult.unscheduled.length;
        result.schedule.estimatedDuration = scheduleResult.stats.estimatedDuration;
        result.schedule.courtUtilization = scheduleResult.stats.courtUtilization;

        console.log(`✅ Schedule created:`);
        console.log(`   - Scheduled: ${result.schedule.scheduled} matches`);
        console.log(`   - Unscheduled: ${result.schedule.unscheduled} matches`);
        console.log(`   - Duration: ${result.schedule.estimatedDuration} minutes`);
        console.log(`   - Court utilization: ${result.schedule.courtUtilization}%`);
      }

      step.value = 'complete';
      progress.value = 100;
      result.success = true;

      return result;

    } catch (err) {
      console.error('Setup failed:', err);
      error.value = bracketGen.error.value || scheduler.error.value || 'Setup failed';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Reset/delete a category setup
   */
  async function resetCategory(tournamentId: string, categoryId: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      // Clear schedule first
      await scheduler.clearSchedule(tournamentId, categoryId);
      
      // Delete bracket
      await bracketGen.deleteBracket(tournamentId, categoryId);
      
      console.log(`🗑️ Category ${categoryId} reset complete`);
    } catch (err) {
      console.error('Reset failed:', err);
      error.value = 'Failed to reset category';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    error,
    step,
    progress,
    setupCategory,
    resetCategory,
  };
}
