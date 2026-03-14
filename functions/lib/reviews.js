"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitReview = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const MAX_QUOTE_LENGTH = 600;
const MIN_QUOTE_LENGTH = 8;
const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_ORGANIZATION_LENGTH = 120;
const normalizeText = (value) => {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim();
};
exports.submitReview = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const rating = Number((_a = request.data) === null || _a === void 0 ? void 0 : _a.rating);
    const quote = normalizeText((_b = request.data) === null || _b === void 0 ? void 0 : _b.quote);
    const displayName = normalizeText((_c = request.data) === null || _c === void 0 ? void 0 : _c.displayName);
    const organization = normalizeText((_d = request.data) === null || _d === void 0 ? void 0 : _d.organization);
    const tournamentId = normalizeText((_e = request.data) === null || _e === void 0 ? void 0 : _e.tournamentId);
    const tournamentName = normalizeText((_f = request.data) === null || _f === void 0 ? void 0 : _f.tournamentName);
    if (!Number.isFinite(rating) || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new functions.https.HttpsError('invalid-argument', 'Rating must be an integer between 1 and 5.');
    }
    if (quote.length < MIN_QUOTE_LENGTH || quote.length > MAX_QUOTE_LENGTH) {
        throw new functions.https.HttpsError('invalid-argument', `Quote must be between ${MIN_QUOTE_LENGTH} and ${MAX_QUOTE_LENGTH} characters.`);
    }
    if (!displayName || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
        throw new functions.https.HttpsError('invalid-argument', `Display name is required and must be less than ${MAX_DISPLAY_NAME_LENGTH} characters.`);
    }
    if (organization.length > MAX_ORGANIZATION_LENGTH) {
        throw new functions.https.HttpsError('invalid-argument', `Organization must be less than ${MAX_ORGANIZATION_LENGTH} characters.`);
    }
    const requestedSource = (_g = request.data) === null || _g === void 0 ? void 0 : _g.source;
    const source = request.auth
        ? (requestedSource === 'public' ? 'public' : 'authenticated')
        : 'public';
    const reviewDoc = {
        status: 'pending',
        rating,
        quote,
        displayName,
        source,
        isFeatured: false,
        submitterUserId: ((_h = request.auth) === null || _h === void 0 ? void 0 : _h.uid) || null,
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
        const userEmail = normalizeText((_j = userDoc.data()) === null || _j === void 0 ? void 0 : _j.email) || normalizeText((_k = request.auth.token) === null || _k === void 0 ? void 0 : _k.email);
        reviewDoc.submitterEmail = userEmail || null;
    }
    const docRef = await admin.firestore().collection('reviews').add(reviewDoc);
    return {
        success: true,
        reviewId: docRef.id,
        status: 'pending',
    };
});
//# sourceMappingURL=reviews.js.map