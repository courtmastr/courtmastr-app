import { BracketsManager } from 'brackets-manager';
import { FirestoreStorage } from './storage/firestore-adapter';
import * as admin from 'firebase-admin';

/**
 * Creates a BracketsManager instance scoped to a specific tournament.
 * 
 * @param tournamentId The ID of the tournament context.
 * @returns A fully configured BracketsManager instance.
 */
export function getBracketsManager(tournamentId: string) {
    const db = admin.firestore();
    // Use the tournament document as the root (even components)
    // Sub-collections will be created under it: tournaments/T1/participant, tournaments/T1/match, etc.
    const rootPath = `tournaments/${tournamentId}`;
    const storage = new FirestoreStorage(db, rootPath);
    return new BracketsManager(storage);
}
