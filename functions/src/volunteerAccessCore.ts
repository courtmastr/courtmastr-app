import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type {
  VolunteerAccessEntry,
  VolunteerRole,
  VolunteerSessionPayload,
} from './types';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const TOKEN_HEADER = {
  alg: 'HS256',
  typ: 'volunteer-session',
};

const deriveKey = (secret: string): Buffer => {
  if (!secret.trim()) {
    throw new Error('Secret is required');
  }

  return createHash('sha256').update(secret).digest();
};

const encodeBase64Url = (value: Buffer | string): string => {
  const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  return buffer.toString('base64url');
};

const decodeBase64Url = (value: string): Buffer => Buffer.from(value, 'base64url');

const isVolunteerRole = (value: string): value is VolunteerRole =>
  value === 'checkin' || value === 'scorekeeper';

const assertValidPayload = (value: unknown): VolunteerSessionPayload => {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid volunteer session token payload');
  }

  const candidate = value as Partial<VolunteerSessionPayload>;
  if (!candidate.tournamentId || typeof candidate.tournamentId !== 'string') {
    throw new Error('Invalid volunteer session token payload');
  }

  if (!candidate.role || !isVolunteerRole(candidate.role)) {
    throw new Error('Invalid volunteer session token payload');
  }

  if (!Number.isInteger(candidate.pinRevision) || (candidate.pinRevision ?? 0) < 1) {
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

const signToken = (unsignedToken: string, secret: string): Buffer =>
  createHmac('sha256', deriveKey(secret)).update(unsignedToken).digest();

export const encryptPin = (pin: string, secret: string): string => {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext].map((part) => encodeBase64Url(part)).join('.');
};

export const decryptPin = (ciphertext: string, secret: string): string => {
  const parts = ciphertext.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted PIN payload');
  }

  const [ivValue, authTagValue, payloadValue] = parts.map((part) => decodeBase64Url(part));
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, deriveKey(secret), ivValue);
  decipher.setAuthTag(authTagValue);

  const plaintext = Buffer.concat([
    decipher.update(payloadValue),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
};

export const issueVolunteerSessionToken = (
  payload: VolunteerSessionPayload,
  secret: string,
): string => {
  const headerSegment = encodeBase64Url(JSON.stringify(TOKEN_HEADER));
  const payloadSegment = encodeBase64Url(JSON.stringify(payload));
  const unsignedToken = `${headerSegment}.${payloadSegment}`;
  const signatureSegment = encodeBase64Url(signToken(unsignedToken, secret));

  return `${unsignedToken}.${signatureSegment}`;
};

export const verifyVolunteerSessionToken = (
  token: string,
  secret: string,
): VolunteerSessionPayload => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid volunteer session token');
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const unsignedToken = `${headerSegment}.${payloadSegment}`;
  const expectedSignature = signToken(unsignedToken, secret);
  const actualSignature = decodeBase64Url(signatureSegment);

  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new Error('Invalid volunteer session token');
  }

  const payload = assertValidPayload(JSON.parse(decodeBase64Url(payloadSegment).toString('utf8')));
  if (payload.expiresAtMs <= Date.now()) {
    throw new Error('Volunteer session token expired');
  }

  return payload;
};

interface AssertVolunteerSessionAccessInput {
  payload: VolunteerSessionPayload;
  tournamentId: string;
  role: VolunteerRole;
  accessEntry?: VolunteerAccessEntry | null;
}

export const assertVolunteerSessionAccess = (
  input: AssertVolunteerSessionAccessInput,
): VolunteerSessionPayload => {
  const {
    payload,
    tournamentId,
    role,
    accessEntry,
  } = input;

  if (payload.tournamentId !== tournamentId) {
    throw new Error('Volunteer session does not match this tournament');
  }

  if (payload.role !== role) {
    throw new Error('Volunteer session does not match this role');
  }

  if (!accessEntry?.encryptedPin) {
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
