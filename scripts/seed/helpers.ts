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
    collection,
    doc,
    getDoc,
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
export interface GlobalPlayerSeedData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: 'male' | 'female';
    skillLevel: number;
}

/**
 * Find or create a global player by email, then write the tournament mirror.
 * Returns the globalPlayerId (used as both the /players doc ID and the
 * tournaments/{id}/players/{globalPlayerId} mirror doc ID).
 *
 * No transaction needed here — seed runs sequentially and a local email→id
 * map prevents duplicate writes within the same seed run.
 */
export async function seedGlobalPlayer(
    db: Firestore,
    tournamentId: string,
    data: GlobalPlayerSeedData,
    emailIdCache: Map<string, string>,
): Promise<string> {
    const emailNormalized = data.email.toLowerCase().trim();

    const cached = emailIdCache.get(emailNormalized);
    if (cached) {
        // Mirror may already exist; setDoc with merge ensures idempotency
        await setDoc(
            doc(db, 'tournaments', tournamentId, 'players', cached),
            {
                globalPlayerId: cached,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                gender: data.gender,
                skillLevel: data.skillLevel,
                updatedAt: serverTimestamp(),
            },
            { merge: true },
        );
        return cached;
    }

    // Check email index in Firestore (handles re-runs)
    const indexRef = doc(db, 'playerEmailIndex', emailNormalized);
    const indexSnap = await getDoc(indexRef);
    let globalPlayerId: string;

    if (indexSnap.exists()) {
        globalPlayerId = indexSnap.data().playerId as string;
    } else {
        // Create global player document
        const playerRef = doc(collection(db, 'players'));
        globalPlayerId = playerRef.id;
        const now = serverTimestamp();

        await setDoc(playerRef, {
            id: globalPlayerId,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            emailNormalized,
            phone: data.phone,
            skillLevel: data.skillLevel,
            userId: null,
            isActive: true,
            isVerified: false,
            createdAt: now,
            updatedAt: now,
            stats: {
                overall: { wins: 0, losses: 0, gamesPlayed: 0, tournamentsPlayed: 0 },
            },
        });

        await setDoc(indexRef, { playerId: globalPlayerId, createdAt: now });
    }

    emailIdCache.set(emailNormalized, globalPlayerId);

    // Write tournament mirror (doc ID = globalPlayerId)
    await setDoc(
        doc(db, 'tournaments', tournamentId, 'players', globalPlayerId),
        {
            globalPlayerId,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            gender: data.gender,
            skillLevel: data.skillLevel,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        },
        { merge: true },
    );

    return globalPlayerId;
}

/**
 * Create a seed organization with slug index and admin membership.
 * Idempotent — checks slug index before creating.
 */
export async function createSeedOrg(
    db: Firestore,
    adminId: string,
    opts: { name: string; slug: string },
): Promise<string> {
    // Check if slug already taken (re-run safety)
    const slugRef = doc(db, 'orgSlugIndex', opts.slug);
    const slugSnap = await getDoc(slugRef);
    if (slugSnap.exists()) {
        const existingOrgId = slugSnap.data().orgId as string;
        console.log(`  Found existing org: ${opts.name} (/${opts.slug})`);
        return existingOrgId;
    }

    const orgRef = doc(collection(db, 'organizations'));
    const now = serverTimestamp();

    await setDoc(orgRef, {
        id: orgRef.id,
        name: opts.name,
        slug: opts.slug,
        logoUrl: null,
        bannerUrl: null,
        contactEmail: null,
        timezone: 'America/Chicago',
        about: 'Seed organization for development and testing.',
        website: null,
        createdAt: now,
        updatedAt: now,
    });

    await setDoc(slugRef, { orgId: orgRef.id, createdAt: now });

    await setDoc(doc(db, 'organizations', orgRef.id, 'members', adminId), {
        uid: adminId,
        role: 'admin',
        joinedAt: now,
    });

    console.log(`  Created org: ${opts.name} (/${opts.slug})`);
    return orgRef.id;
}

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
