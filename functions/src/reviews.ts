import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

type ReviewSource = 'public' | 'authenticated';

interface SubmitReviewData {
  rating: number;
  quote: string;
  displayName: string;
  organization?: string;
  source?: ReviewSource;
  tournamentId?: string;
  tournamentName?: string;
}

const MAX_QUOTE_LENGTH = 600;
const MIN_QUOTE_LENGTH = 8;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_ORGANIZATION_LENGTH = 120;

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

export const submitReview = functions.https.onCall(
  async (request: functions.https.CallableRequest<SubmitReviewData>) => {
    const rating = Number(request.data?.rating);
    const quote = normalizeText(request.data?.quote);
    const displayName = normalizeText(request.data?.displayName);
    const organization = normalizeText(request.data?.organization);
    const tournamentId = normalizeText(request.data?.tournamentId);
    const tournamentName = normalizeText(request.data?.tournamentName);

    if (!Number.isFinite(rating) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Rating must be an integer between 1 and 5.'
      );
    }

    if (quote.length < MIN_QUOTE_LENGTH || quote.length > MAX_QUOTE_LENGTH) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Quote must be between ${MIN_QUOTE_LENGTH} and ${MAX_QUOTE_LENGTH} characters.`
      );
    }

    if (!displayName || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Display name is required and must be less than ${MAX_DISPLAY_NAME_LENGTH} characters.`
      );
    }

    if (organization.length > MAX_ORGANIZATION_LENGTH) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        `Organization must be less than ${MAX_ORGANIZATION_LENGTH} characters.`
      );
    }

    const requestedSource = request.data?.source;
    const source: ReviewSource = request.auth
      ? (requestedSource === 'public' ? 'public' : 'authenticated')
      : 'public';

    const reviewDoc: Record<string, unknown> = {
      status: 'pending',
      rating,
      quote,
      displayName,
      source,
      isFeatured: false,
      submitterUserId: request.auth?.uid || null,
      submitterEmail: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (organization) {
      reviewDoc.organization = organization;
    }
    if (tournamentId) {
      reviewDoc.tournamentId = tournamentId;
    }
    if (tournamentName) {
      reviewDoc.tournamentName = tournamentName;
    }

    if (request.auth) {
      const db = admin.firestore();
      const userDoc = await db.collection('users').doc(request.auth.uid).get();
      const userEmail = normalizeText(userDoc.data()?.email) || normalizeText(request.auth.token?.email);
      reviewDoc.submitterEmail = userEmail || null;
    }

    const docRef = await admin.firestore().collection('reviews').add(reviewDoc);

    return {
      success: true,
      reviewId: docRef.id,
      status: 'pending',
    };
  }
);
