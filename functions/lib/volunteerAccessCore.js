"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertVolunteerSessionAccess = exports.verifyVolunteerSessionToken = exports.issueVolunteerSessionToken = exports.decryptPin = exports.encryptPin = void 0;
const node_crypto_1 = require("node:crypto");
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const TOKEN_HEADER = {
    alg: 'HS256',
    typ: 'volunteer-session',
};
const deriveKey = (secret) => {
    if (!secret.trim()) {
        throw new Error('Secret is required');
    }
    return (0, node_crypto_1.createHash)('sha256').update(secret).digest();
};
const encodeBase64Url = (value) => {
    const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
    return buffer.toString('base64url');
};
const decodeBase64Url = (value) => Buffer.from(value, 'base64url');
const isVolunteerRole = (value) => value === 'checkin' || value === 'scorekeeper';
const assertValidPayload = (value) => {
    var _a;
    if (!value || typeof value !== 'object') {
        throw new Error('Invalid volunteer session token payload');
    }
    const candidate = value;
    if (!candidate.tournamentId || typeof candidate.tournamentId !== 'string') {
        throw new Error('Invalid volunteer session token payload');
    }
    if (!candidate.role || !isVolunteerRole(candidate.role)) {
        throw new Error('Invalid volunteer session token payload');
    }
    if (!Number.isInteger(candidate.pinRevision) || ((_a = candidate.pinRevision) !== null && _a !== void 0 ? _a : 0) < 1) {
        throw new Error('Invalid volunteer session token payload');
    }
    if (!Number.isFinite(candidate.issuedAtMs) || !Number.isFinite(candidate.expiresAtMs)) {
        throw new Error('Invalid volunteer session token payload');
    }
    const pinRevision = Number(candidate.pinRevision);
    const issuedAtMs = Number(candidate.issuedAtMs);
    const expiresAtMs = Number(candidate.expiresAtMs);
    return {
        tournamentId: candidate.tournamentId,
        role: candidate.role,
        pinRevision,
        issuedAtMs,
        expiresAtMs,
    };
};
const signToken = (unsignedToken, secret) => (0, node_crypto_1.createHmac)('sha256', deriveKey(secret)).update(unsignedToken).digest();
const encryptPin = (pin, secret) => {
    const iv = (0, node_crypto_1.randomBytes)(IV_LENGTH_BYTES);
    const cipher = (0, node_crypto_1.createCipheriv)(ENCRYPTION_ALGORITHM, deriveKey(secret), iv);
    const ciphertext = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv, authTag, ciphertext].map((part) => encodeBase64Url(part)).join('.');
};
exports.encryptPin = encryptPin;
const decryptPin = (ciphertext, secret) => {
    const parts = ciphertext.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted PIN payload');
    }
    const [ivValue, authTagValue, payloadValue] = parts.map((part) => decodeBase64Url(part));
    const decipher = (0, node_crypto_1.createDecipheriv)(ENCRYPTION_ALGORITHM, deriveKey(secret), ivValue);
    decipher.setAuthTag(authTagValue);
    const plaintext = Buffer.concat([
        decipher.update(payloadValue),
        decipher.final(),
    ]);
    return plaintext.toString('utf8');
};
exports.decryptPin = decryptPin;
const issueVolunteerSessionToken = (payload, secret) => {
    const headerSegment = encodeBase64Url(JSON.stringify(TOKEN_HEADER));
    const payloadSegment = encodeBase64Url(JSON.stringify(payload));
    const unsignedToken = `${headerSegment}.${payloadSegment}`;
    const signatureSegment = encodeBase64Url(signToken(unsignedToken, secret));
    return `${unsignedToken}.${signatureSegment}`;
};
exports.issueVolunteerSessionToken = issueVolunteerSessionToken;
const verifyVolunteerSessionToken = (token, secret) => {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid volunteer session token');
    }
    const [headerSegment, payloadSegment, signatureSegment] = parts;
    const unsignedToken = `${headerSegment}.${payloadSegment}`;
    const expectedSignature = signToken(unsignedToken, secret);
    const actualSignature = decodeBase64Url(signatureSegment);
    if (actualSignature.length !== expectedSignature.length ||
        !(0, node_crypto_1.timingSafeEqual)(actualSignature, expectedSignature)) {
        throw new Error('Invalid volunteer session token');
    }
    const payload = assertValidPayload(JSON.parse(decodeBase64Url(payloadSegment).toString('utf8')));
    if (payload.expiresAtMs <= Date.now()) {
        throw new Error('Volunteer session token expired');
    }
    return payload;
};
exports.verifyVolunteerSessionToken = verifyVolunteerSessionToken;
const assertVolunteerSessionAccess = (input) => {
    const { payload, tournamentId, role, accessEntry, } = input;
    if (payload.tournamentId !== tournamentId) {
        throw new Error('Volunteer session does not match this tournament');
    }
    if (payload.role !== role) {
        throw new Error('Volunteer session does not match this role');
    }
    if (!(accessEntry === null || accessEntry === void 0 ? void 0 : accessEntry.encryptedPin)) {
        throw new Error('Volunteer access is not configured');
    }
    if (!accessEntry.enabled) {
        throw new Error('Volunteer access is disabled');
    }
    if (accessEntry.pinRevision !== payload.pinRevision) {
        throw new Error('Volunteer session expired after PIN reset');
    }
    return payload;
};
exports.assertVolunteerSessionAccess = assertVolunteerSessionAccess;
//# sourceMappingURL=volunteerAccessCore.js.map