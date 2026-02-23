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

        const { tournamentId, categoryId, matchId, status, winnerId, scores } = request.data;

        console.log('🎯 [updateMatch] Called with:', {
            tournamentId,
            categoryId,
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

        if (!categoryId) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'categoryId is required for match updates'
            );
        }

        try {
            // 1. Update match_scores collection (our custom storage for detailed scores)
            if (scores) {
                console.log('📝 [updateMatch] Updating match_scores with scores:', scores);
                await db
                    .collection('tournaments')
                    .doc(tournamentId)
                    .collection('categories')
                    .doc(categoryId)
                    .collection('match_scores')
                    .doc(matchId)
                    .set({ scores, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
                console.log('✅ [updateMatch] match_scores updated successfully');
            }

            // 2. Update brackets-manager match status/result
            // Use the category document as the root with full path including categories
            // Sub-collections will be created under it: tournaments/T1/categories/C1/participant, .../match, etc.
            const rootPath = `tournaments/${tournamentId}/categories/${categoryId}`;
            console.log('🔧 [updateMatch] Creating BracketsManager with rootPath:', rootPath);
            const manager = new BracketsManager(new FirestoreStorage(db, rootPath));

            // STATUS MAPPING: Convert app string status to brackets-manager numeric status
            // /match_scores.status (string) -> /match.status (number)
            // "completed" -> 4, "in_progress" -> 3, "ready"/"scheduled" -> 2
            const bmStatus = status === 'completed' ? 4 : (status === 'in_progress' ? 3 : 2);
            console.log('📊 [updateMatch] Mapped status:', { clientStatus: status, bmStatus });

            const updateData: any = {
                id: matchId,
                status: bmStatus,
            };

            if (status === 'completed' && winnerId) {
                console.log('🏆 [updateMatch] Match completed with winnerId (registration ID):', winnerId);

                // winnerId is a registration ID, but brackets-manager uses numeric participant IDs
                // We need to map the registration ID to the bracket participant numeric ID

                // 1. Fetch match data
                console.log('🔍 [updateMatch] Fetching match data for matchId:', matchId);
                const matchData = await manager.storage.select('match', matchId);
                console.log('📋 [updateMatch] Match data retrieved:', {
                    matchId: matchData?.id,
                    opponent1Id: matchData?.opponent1?.id,
                    opponent2Id: matchData?.opponent2?.id,
                });

                if (!matchData) throw new Error('Match not found');

                // 2. Fetch participants to map registration ID to numeric ID
                console.log('👥 [updateMatch] Fetching participants to map registration ID');
                const participants = await manager.storage.select('participant');
                console.log('📋 [updateMatch] Participants fetched:', participants?.length);

                // Find participant by registration ID (stored in participant.name field)
                // participant.name = registration ID (Firestore document ID)
                // participant.id = numeric brackets-manager ID
                const winnerParticipant = participants?.find((p: any) => p.name === winnerId);

                if (!winnerParticipant) {
                    console.warn(`⚠️  [updateMatch] No participant found with name=${winnerId}`);
                    throw new Error(`Winner participant not found for registration ID: ${winnerId}`);
                }

                const bracketWinnerId = winnerParticipant.id;
                console.log('🎯 [updateMatch] Mapped registration ID to bracket participant ID:', {
                    registrationId: winnerId,
                    bracketParticipantId: bracketWinnerId
                });

                // 3. Check which opponent won and update accordingly
                const opponent1Id = matchData.opponent1?.id;
                const opponent2Id = matchData.opponent2?.id;

                // Use loose equality to handle string/number type differences
                if (opponent1Id == bracketWinnerId) {
                    console.log('✅ [updateMatch] Winner is opponent1');
                    updateData.opponent1 = { ...matchData.opponent1, result: 'win' };
                    updateData.opponent2 = { ...matchData.opponent2, result: 'loss' };
                } else if (opponent2Id == bracketWinnerId) {
                    console.log('✅ [updateMatch] Winner is opponent2');
                    updateData.opponent1 = { ...matchData.opponent1, result: 'loss' };
                    updateData.opponent2 = { ...matchData.opponent2, result: 'win' };
                } else {
                    console.warn(`⚠️  [updateMatch] Bracket winner ID ${bracketWinnerId} does not match opponent1 (${opponent1Id}) or opponent2 (${opponent2Id})`);
                    throw new Error(`Winner participant ID ${bracketWinnerId} does not match either opponent in match ${matchId}`);
                }

                if (scores && scores.length > 0 && opponent1Id && opponent2Id) {
                    console.log('🎮 [updateMatch] Creating match_game documents for', scores.length, 'games');
                    for (let i = 0; i < scores.length; i++) {
                        const game = scores[i];
                        const gameNumber = i + 1;

                        let gameWinner1: 'win' | 'loss' = 'loss';
                        let gameWinner2: 'win' | 'loss' = 'loss';
                        if (game.score1 > game.score2) {
                            gameWinner1 = 'win';
                        } else if (game.score2 > game.score1) {
                            gameWinner2 = 'win';
                        }

                        const matchGameData = {
                            stage_id: matchData.stage_id,
                            parent_id: matchId,
                            number: gameNumber,
                            status: 4,
                            opponent1: {
                                id: opponent1Id,
                                score: game.score1,
                                result: gameWinner1,
                            },
                            opponent2: {
                                id: opponent2Id,
                                score: game.score2,
                                result: gameWinner2,
                            },
                        };

                        await manager.storage.insert('match_game', matchGameData);
                        console.log(`✅ [updateMatch] Created match_game ${gameNumber}:`, { parent_id: matchId, gameNumber, score1: game.score1, score2: game.score2 });
                    }
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
