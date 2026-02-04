import { BracketsManager } from 'brackets-manager';
import { FirestoreStorage } from './storage/firestore-adapter';
import * as admin from 'firebase-admin';

/**
 * Creates a BracketsManager instance scoped to a specific category.
 * Matches client-side behavior: stores data in category-isolated subcollections.
 * 
 * @param tournamentId The ID of the tournament context.
 * @param categoryId The ID of the category (for category-isolated storage).
 * @returns A fully configured BracketsManager instance.
 */
export function getBracketsManager(tournamentId: string, categoryId: string) {
    const db = admin.firestore();
    // Category-isolated path to match client-side behavior
    // Stores at: tournaments/{tournamentId}/categories/{categoryId}/participant, match, etc.
    const rootPath = `tournaments/${tournamentId}/categories/${categoryId}`;
    const storage = new FirestoreStorage(db, rootPath);
    return new BracketsManager(storage);
}
