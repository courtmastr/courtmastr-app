import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { BracketsManager } from 'brackets-manager';
import { FirestoreStorage } from './storage/firestore-adapter';

// const db = admin.firestore(); // Moved inside function to avoid init order issues

/**
 * Update match score and advance bracket if match is complete
 */
export const updateMatch = functions.https.onCall(
    async (request) => {
        const db = admin.firestore();

        // Verify authentication
        if (!request.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'User must be authenticated'
            );
        }

        const { tournamentId, matchId, status, winnerId, scores } = request.data;

        console.log('🎯 [updateMatch] Called with:', {
            tournamentId,
            matchId,
            status,
            winnerId,
            scoresLength: scores?.length,
        });

        if (!tournamentId || !matchId || status === undefined) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'tournamentId, matchId, and status are required'
            );
        }

        try {
            // 1. Update match_scores collection (our custom storage for detailed scores)
            if (scores) {
                console.log('📝 [updateMatch] Updating match_scores with scores:', scores);
                await db
                    .collection('tournaments')
                    .doc(tournamentId)
                    .collection('match_scores')
                    .doc(matchId)
                    .set({ scores, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
                console.log('✅ [updateMatch] match_scores updated successfully');
            }

            // 2. Update brackets-manager match status/result
            // Use the tournament document as the root (even components)
            // Sub-collections will be created under it: tournaments/T1/participant, tournaments/T1/match, etc.
            const rootPath = `tournaments/${tournamentId}`;
            console.log('🔧 [updateMatch] Creating BracketsManager with rootPath:', rootPath);
            const manager = new BracketsManager(new FirestoreStorage(db, rootPath));

            // Map status to brackets-manager status (0-4)
            // 3 = running, 4 = completed
            const bmStatus = status === 'completed' ? 4 : (status === 'in_progress' ? 3 : 2);
            console.log('📊 [updateMatch] Mapped status:', { clientStatus: status, bmStatus });

            const updateData: any = {
                id: matchId,
                status: bmStatus,
            };

            if (status === 'completed' && winnerId) {
                console.log('🏆 [updateMatch] Match completed with winnerId:', winnerId);
                // Need to find which opponent won
                // We need to fetch the match first to know which opponent ID matches the winner ID
                // Note: brackets-manager update.match expects `opponent1: { result: 'win' }` etc.
                console.log('🔍 [updateMatch] Fetching match data for matchId:', matchId);
                const matchData = await manager.storage.select('match', matchId);
                console.log('📋 [updateMatch] Match data retrieved:', {
                    matchId: matchData?.id,
                    opponent1Id: matchData?.opponent1?.id,
                    opponent2Id: matchData?.opponent2?.id,
                });

                if (!matchData) throw new Error('Match not found');

                // Check opponents
                // opponent1.id might be null if it was a bye? No, played match has players.
                if (matchData.opponent1?.id === winnerId) {
                    console.log('✅ [updateMatch] Winner is opponent1');
                    updateData.opponent1 = { ...matchData.opponent1, result: 'win' };
                    updateData.opponent2 = { ...matchData.opponent2, result: 'loss' };
                } else if (matchData.opponent2?.id === winnerId) {
                    console.log('✅ [updateMatch] Winner is opponent2');
                    updateData.opponent1 = { ...matchData.opponent1, result: 'loss' };
                    updateData.opponent2 = { ...matchData.opponent2, result: 'win' };
                } else {
                    // Fallback: registration ID logic? 
                    // In our adapter we assumed participant ID matched registration name (which is what we use as ID).
                    // brackets-manager participant ID is usually just a number/string ID.
                    // But in `bracket.ts` we used `reg.id` as the seeding ID.
                    // And `reg.id` IS the registration ID in our system.
                    // So `matchData.opponent1.id` should be the registration ID.
                    console.warn(`⚠️  [updateMatch] Winner ID ${winnerId} does not match opponent1 (${matchData.opponent1?.id}) or opponent2 (${matchData.opponent2?.id})`);
                }
            }

            console.log('🚀 [updateMatch] Calling manager.update.match with updateData:', updateData);
            await manager.update.match(updateData);
            console.log('✅ [updateMatch] manager.update.match completed successfully');

            return { success: true };

        } catch (error) {
            console.error('❌ [updateMatch] Error updating match:', error);
            if (error instanceof Error) {
                console.error('   Stack trace:', error.stack);
            }
            throw new functions.https.HttpsError(
                'internal',
                error instanceof Error ? error.message : 'Failed to update match'
            );
        }
    }
);
