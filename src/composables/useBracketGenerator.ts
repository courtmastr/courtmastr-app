/**
 * Client-side Bracket Generator for Courtmaster
 * Uses brackets-manager library with proper FirestoreStorage adapter
 * Stores data in category-isolated subcollections
 */

import { ref } from 'vue';
import {
  db,
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from '@/services/firebase';
import { BracketsManager } from 'brackets-manager';
import { ClientFirestoreStorage } from '@/services/brackets-storage';
import type { Registration, Category } from '@/types';

// ============================================
// Types
// ============================================

export interface BracketOptions {
  grandFinal?: 'simple' | 'double' | 'none';
  consolationFinal?: boolean;
  seedOrdering?: ('natural' | 'reverse' | 'half_shift' | 'inner_outer')[];
}

export interface BracketResult {
  success: boolean;
  stageId: number;
  matchCount: number;
  groupCount: number;
  roundCount: number;
  participantCount: number;
}

// ============================================
// Main Generator
// ============================================

export function useBracketGenerator() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const progress = ref(0);

  /**
   * Generate bracket using brackets-manager library with FirestoreStorage
   * Stores all data in category-isolated subcollections
   */
  async function generateBracket(
    tournamentId: string,
    categoryId: string,
    options: BracketOptions = {}
  ): Promise<BracketResult> {
    loading.value = true;
    error.value = null;
    progress.value = 0;

    try {
      // 1. Get category details
      const categoryDoc = await getDoc(
        doc(db, 'tournaments', tournamentId, 'categories', categoryId)
      );

      if (!categoryDoc.exists()) {
        throw new Error('Category not found');
      }

      const category = categoryDoc.data() as Category;

      progress.value = 10;

      // 2. Get approved registrations
      const registrationsQuery = query(
        collection(db, 'tournaments', tournamentId, 'registrations'),
        where('categoryId', '==', categoryId),
        where('status', 'in', ['approved', 'checked_in'])
      );

      const registrationsSnap = await getDocs(registrationsQuery);
      const registrations = registrationsSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Registration[];

      if (registrations.length < 2) {
        throw new Error('Need at least 2 participants to generate bracket');
      }

      progress.value = 20;

      // 3. Sort by seed
      const sortedRegistrations = sortRegistrationsBySeed(registrations);
      console.log(`📊 Generating ${category.format} bracket for ${sortedRegistrations.length} participants`);

      // 4. Create seeding array (null for BYEs)
      const seeding = createSeedingArray(sortedRegistrations);

      progress.value = 30;

      // 5. Create FirestoreStorage with category-isolated path
      // This ensures each category's data is completely separate
      const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
      const storage = new ClientFirestoreStorage(db, categoryPath);
      const manager = new BracketsManager(storage);

      console.log(`💾 Using FirestoreStorage with path: ${categoryPath}`);

      const participantsData = sortedRegistrations.map((reg, index) => ({
        id: index + 1,
        tournament_id: categoryId,
        name: reg.id,
      }));

      await storage.insert('participant', participantsData);
      console.log(`✅ Created ${participantsData.length} participants`);

      await new Promise(resolve => setTimeout(resolve, 500));

      console.log('🔍 Verifying participants in storage...');
      const verifyParticipants = await storage.select('participant') as any[];
      console.log(`   Found ${verifyParticipants?.length || 0} participants`);

      if (verifyParticipants && verifyParticipants.length > 0) {
        console.log('   First participant:', verifyParticipants[0]);

        const testSelect = await storage.select('participant', 1);
        console.log('   Select by ID 1:', testSelect ? 'FOUND' : 'NOT FOUND');
      }

      progress.value = 40;

      const stageType = category.format === 'pool_to_elimination'
        ? 'single_elimination'
        : category.format;

      const settings: any = {
        seedOrdering: options.seedOrdering || ['inner_outer'],
      };

      if (stageType === 'double_elimination') {
        settings.grandFinal = options.grandFinal || 'double';
      }

      if (options.consolationFinal !== undefined) {
        settings.consolationFinal = options.consolationFinal;
      }

      const stage = await manager.create.stage({
        tournamentId: categoryId,
        name: category.name,
        type: stageType as any,
        seedingIds: seeding,
        settings,
      });

      // brackets-manager may not return id reliably, fetch from storage
      let stageId = stage?.id;
      if (stageId === undefined) {
        const stages = await storage.select('stage', { tournament_id: categoryId }) as any[];
        if (stages && stages.length > 0) {
          stageId = stages[0].id;
        }
      }
      console.log('📌 Stage created with ID:', stageId);

      progress.value = 60;

      // 8. Update category status
      await setDoc(
        doc(db, 'tournaments', tournamentId, 'categories', categoryId),
        {
          status: 'active',
          stageId: stageId ?? null, // Use null instead of undefined for Firestore
          bracketGeneratedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      progress.value = 100;

      // Get stats from Firestore
      const matches = await storage.select('match', { stage_id: stageId });
      const groups = await storage.select('group', { stage_id: stageId });
      const rounds = await storage.select('round', { stage_id: stageId });
      const participantCount = participantsData.length;

      const result: BracketResult = {
        success: true,
        stageId: (stageId as number) ?? 0,
        matchCount: Array.isArray(matches) ? matches.length : 0,
        groupCount: Array.isArray(groups) ? groups.length : 0,
        roundCount: Array.isArray(rounds) ? rounds.length : 0,
        participantCount,
      };

      console.log(`✅ Bracket generated and saved to ${categoryPath}:`, result);
      return result;

    } catch (err) {
      console.error('Error generating bracket:', err);
      error.value = err instanceof Error ? err.message : 'Failed to generate bracket';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Delete existing bracket for a category
   */
  async function deleteBracket(
    tournamentId: string,
    categoryId: string
  ): Promise<void> {
    const categoryPath = `tournaments/${tournamentId}/categories/${categoryId}`;
    const storage = new ClientFirestoreStorage(db, categoryPath);

    // Get all stages for this category
    const stages = await storage.select('stage') as any[];

    if (stages && Array.isArray(stages)) {
      for (const stage of stages) {
        // Delete all related data
        await storage.delete('match', { stage_id: stage.id });
        await storage.delete('round', { stage_id: stage.id });
        await storage.delete('group', { stage_id: stage.id });
        await storage.delete('participant', { tournament_id: categoryId });
        await storage.delete('stage', stage.id);
      }
    }

    // Update category status
    await setDoc(
      doc(db, 'tournaments', tournamentId, 'categories', categoryId),
      {
        status: 'setup',
        stageId: null,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    console.log(`✅ Deleted bracket from ${categoryPath}`);
  }

  return {
    loading,
    error,
    progress,
    generateBracket,
    deleteBracket,
  };
}

// ============================================
// Helper Functions
// ============================================

function sortRegistrationsBySeed(registrations: Registration[]): Registration[] {
  const seeded = registrations
    .filter(r => r.seed !== undefined && r.seed !== null)
    .sort((a, b) => (a.seed || 0) - (b.seed || 0));

  const unseeded = registrations
    .filter(r => r.seed === undefined || r.seed === null)
    .sort(() => Math.random() - 0.5);

  return [...seeded, ...unseeded];
}

function createSeedingArray(registrations: Registration[]): (number | null)[] {
  const count = registrations.length;
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(count, 2))));
  const seeding: (number | null)[] = [];

  for (let i = 0; i < registrations.length; i++) {
    seeding.push(i + 1);
  }

  while (seeding.length < bracketSize) {
    seeding.push(null);
  }

  console.log('🎯 Seeding array:', seeding.map((s, i) => s ? `Pos${i}:P${s}` : `Pos${i}:BYE`).join(', '));
  console.log(`   ${count} participants -> ${bracketSize}-slot bracket (${bracketSize - count} BYEs)`);

  return seeding;
}
