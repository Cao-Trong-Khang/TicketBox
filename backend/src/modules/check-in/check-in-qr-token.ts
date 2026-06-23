import { createHmac, timingSafeEqual } from 'node:crypto';

const TICKET_QR_TOKEN_VERSION = 1;
const DEFAULT_ISSUER = 'ticketbox';

export type TicketQrTokenPayload = {
  ticketId: string;
  concertId: string;
  iss: string;
  exp: number;
  nonce: string;
  v: number;
};

export type TicketQrTokenVerificationResult =
  | { valid: true; payload: TicketQrTokenPayload }
  | { valid: false; reason: string };

export function createTicketQrToken(input: {
  ticketId: string;
  concertId: string;
  nonce: string;
  expiresAt: Date;
}): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const payload: TicketQrTokenPayload = {
    ticketId: input.ticketId,
    concertId: input.concertId,
    iss: getIssuer(),
    exp: Math.floor(input.expiresAt.getTime() / 1000),
    nonce: input.nonce,
    v: TICKET_QR_TOKEN_VERSION,
  };
  const encodedHeader = encodeJson(header);
  const encodedPayload = encodeJson(payload);
  const signature = sign(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyTicketQrToken(
  token: string,
  now = new Date(),
): TicketQrTokenVerificationResult {
  const parts = token.split('.');

  if (parts.length !== 3) {
    return { valid: false, reason: 'Ticket QR token is not signed' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`);

  if (!timingSafeEqualString(signature, expectedSignature)) {
    return { valid: false, reason: 'Ticket QR token signature is invalid' };
  }

  const header = decodeJson(encodedHeader);
  const payload = decodeJson(encodedPayload);

  if (!isRecord(header) || header.alg !== 'HS256' || header.typ !== 'JWT') {
    return { valid: false, reason: 'Ticket QR token header is invalid' };
  }

  if (!isTicketQrPayload(payload)) {
    return { valid: false, reason: 'Ticket QR token payload is invalid' };
  }

  if (payload.iss !== getIssuer()) {
    return { valid: false, reason: 'Ticket QR token issuer is invalid' };
  }

  if (payload.v !== TICKET_QR_TOKEN_VERSION) {
    return { valid: false, reason: 'Ticket QR token version is unsupported' };
  }

  if (payload.exp <= Math.floor(now.getTime() / 1000)) {
    return { valid: false, reason: 'Ticket QR token is expired' };
  }

  return { valid: true, payload };
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

  return (
    leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function getSecret(): string {
  const secret = process.env.CHECK_IN_QR_HMAC_SECRET;

  if (!secret) {
    throw new Error('CHECK_IN_QR_HMAC_SECRET is required');
  }

  return secret;
}

function getIssuer(): string {
  return process.env.CHECK_IN_QR_ISSUER || DEFAULT_ISSUER;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTicketQrPayload(value: unknown): value is TicketQrTokenPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.ticketId === 'string' &&
    value.ticketId.length > 0 &&
    typeof value.concertId === 'string' &&
    value.concertId.length > 0 &&
    typeof value.iss === 'string' &&
    value.iss.length > 0 &&
    typeof value.exp === 'number' &&
    Number.isInteger(value.exp) &&
    typeof value.nonce === 'string' &&
    value.nonce.length > 0 &&
    value.v === TICKET_QR_TOKEN_VERSION
  );
}
