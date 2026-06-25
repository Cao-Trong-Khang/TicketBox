import { createHmac, timingSafeEqual } from 'node:crypto';

const CHECK_IN_QR_TOKEN_VERSION = 1;
const DEFAULT_ISSUER = 'ticketbox';
const MINIMUM_SECRET_LENGTH = 32;

export const CHECK_IN_QR_ENTITY_TYPES = {
  ticket: 'TICKET',
  vipGuest: 'VIP_GUEST',
} as const;

export type CheckInQrEntityType =
  (typeof CHECK_IN_QR_ENTITY_TYPES)[keyof typeof CHECK_IN_QR_ENTITY_TYPES];

export type CheckInQrTokenPayload = {
  version: number;
  entityType: CheckInQrEntityType;
  entityId: string;
  concertId: string;
  issuer: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

export type CheckInQrTokenVerificationResult =
  | { valid: true; payload: CheckInQrTokenPayload }
  | { valid: false; reason: string };

export function createCheckInQrToken(input: {
  entityType: CheckInQrEntityType;
  entityId: string;
  concertId: string;
  nonce: string;
  issuedAt?: Date;
  expiresAt: Date;
}): string {
  const issuedAt = input.issuedAt ?? new Date();
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const payload: CheckInQrTokenPayload = {
    version: CHECK_IN_QR_TOKEN_VERSION,
    entityType: input.entityType,
    entityId: input.entityId,
    concertId: input.concertId,
    issuer: getIssuer(),
    issuedAt: Math.floor(issuedAt.getTime() / 1000),
    expiresAt: Math.floor(input.expiresAt.getTime() / 1000),
    nonce: input.nonce,
  };
  const encodedHeader = encodeJson(header);
  const encodedPayload = encodeJson(payload);
  const signature = sign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyCheckInQrToken(
  token: string,
  now = new Date(),
): CheckInQrTokenVerificationResult {
  const parts = token.split('.');

  if (parts.length !== 3) {
    return { valid: false, reason: 'QR token is not signed' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);

  if (!timingSafeEqualString(signature, expectedSignature)) {
    return { valid: false, reason: 'QR token signature is invalid' };
  }

  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);

  if (!isRecord(header) || header.alg !== 'HS256' || header.typ !== 'JWT') {
    return { valid: false, reason: 'QR token header is invalid' };
  }

  if (!isCheckInQrPayload(payload)) {
    return { valid: false, reason: 'QR token payload is invalid' };
  }

  if (payload.issuer !== getIssuer()) {
    return { valid: false, reason: 'QR token issuer is invalid' };
  }

  if (payload.version !== CHECK_IN_QR_TOKEN_VERSION) {
    return { valid: false, reason: 'QR token version is unsupported' };
  }

  if (payload.expiresAt <= Math.floor(now.getTime() / 1000)) {
    return { valid: false, reason: 'QR token is expired' };
  }

  return { valid: true, payload };
}

export function verifyCheckInQrTokenForEntity(
  token: string,
  entityType: CheckInQrEntityType,
  now = new Date(),
): CheckInQrTokenVerificationResult {
  const verification = verifyCheckInQrToken(token, now);

  if (!verification.valid) {
    return verification;
  }

  if (verification.payload.entityType !== entityType) {
    return {
      valid: false,
      reason: `QR token entity type is invalid for ${entityType}`,
    };
  }

  return verification;
}

export function assertCheckInQrConfiguration(): void {
  getSecret();
  getIssuer();
}

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJson(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function sign(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function timingSafeEqualString(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getSecret(): string {
  const secret = process.env.CHECK_IN_QR_HMAC_SECRET?.trim();

  if (!secret) {
    throw new Error('CHECK_IN_QR_HMAC_SECRET is required');
  }

  if (secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error(
      `CHECK_IN_QR_HMAC_SECRET must be at least ${MINIMUM_SECRET_LENGTH} characters long`,
    );
  }

  return secret;
}

function getIssuer(): string {
  const issuer = process.env.CHECK_IN_QR_ISSUER?.trim() || DEFAULT_ISSUER;

  if (!issuer) {
    throw new Error('CHECK_IN_QR_ISSUER must not be empty');
  }

  return issuer;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCheckInQrPayload(value: unknown): value is CheckInQrTokenPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === CHECK_IN_QR_TOKEN_VERSION &&
    isEntityType(value.entityType) &&
    typeof value.entityId === 'string' &&
    value.entityId.length > 0 &&
    typeof value.concertId === 'string' &&
    value.concertId.length > 0 &&
    typeof value.issuer === 'string' &&
    value.issuer.length > 0 &&
    typeof value.issuedAt === 'number' &&
    Number.isInteger(value.issuedAt) &&
    typeof value.expiresAt === 'number' &&
    Number.isInteger(value.expiresAt) &&
    typeof value.nonce === 'string' &&
    value.nonce.length > 0
  );
}

function isEntityType(value: unknown): value is CheckInQrEntityType {
  return value === CHECK_IN_QR_ENTITY_TYPES.ticket || value === CHECK_IN_QR_ENTITY_TYPES.vipGuest;
}
