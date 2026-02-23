/**
 * Shared seed helpers.
 *
 * Auth utilities shared by all seed entry points (local.ts, production.ts,
 * tnf2025-local.ts, tnf2025-prod.ts, spring2025-local.ts, spring2025-prod.ts).
 */

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    type Auth,
} from 'firebase/auth';
import {
    doc,
    setDoc,
    serverTimestamp,
    type Firestore,
} from 'firebase/firestore';

export interface UserConfig {
    email: string;
    password: string;
    displayName: string;
    role: string;
}

/**
 * Creates a user if they don't exist yet, or signs in as them if they do.
 * Upserts the user document in Firestore.
 * Returns the user's UID.
 */
export async function createOrSignIn(
    auth: Auth,
    db: Firestore,
    config: UserConfig,
): Promise<string> {
    try {
        const { user } = await createUserWithEmailAndPassword(
            auth,
            config.email,
            config.password,
        );
        await setDoc(doc(db, 'users', user.uid), {
            email: config.email,
            displayName: config.displayName,
            role: config.role,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        console.log(`  Created ${config.role}: ${config.email}`);
        return user.uid;
    } catch (err: unknown) {
        const code = (err as { code?: string }).code ?? '';
        if (code === 'auth/email-already-in-use') {
            const { user } = await signInWithEmailAndPassword(
                auth,
                config.email,
                config.password,
            );
            await setDoc(
                doc(db, 'users', user.uid),
                {
                    email: config.email,
                    displayName: config.displayName,
                    role: config.role,
                    updatedAt: serverTimestamp(),
                },
                { merge: true },
            );
            console.log(`  Found existing ${config.role}: ${config.email}`);
            return user.uid;
        }
        throw err;
    }
}
