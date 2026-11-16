import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { ACCESS_TOKEN_TYPE } from '@studylog/shared';
import { jwtVerify, SignJWT } from 'jose';

const encoder = new TextEncoder();

export interface AccessTokenClaims {
  userId: string;
}

function secretKey(secret: string): Uint8Array {
  return encoder.encode(secret);
}

/**
 * Short-lived JWT (15 min by default). Claims stay minimal on purpose: only the
 * user id, the token type and the standard timestamps. An access token is never
 * trusted for anything except `sub`, and it is never used for authorization of
 * a resource that belongs to somebody else.
 */
export async function signAccessToken(
  userId: string,
  secret: string,
  ttlMinutes: number,
): Promise<string> {
  return new SignJWT({ type: ACCESS_TOKEN_TYPE })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ttlMinutes}m`)
    .sign(secretKey(secret));
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    algorithms: ['HS256'],
  });

  if (payload.type !== ACCESS_TOKEN_TYPE || typeof payload.sub !== 'string') {
    throw new Error('Unexpected token type');
  }

  return { userId: payload.sub };
}

export interface RefreshTokenPair {
  /** Value that goes into the cookie. Never stored. */
  token: string;
  /** Value that goes into the database. */
  hash: string;
}

/**
 * Opaque refresh token: 256 bits from the CSPRNG, hex encoded.
 *
 * It is not a JWT because it carries no data and must be revocable. Only the
 * SHA-256 digest is persisted, so a database leak does not hand out sessions.
 * SHA-256 is enough here (unlike for passwords) because the input already has
 * full entropy: there is nothing to brute force.
 */
export function createRefreshToken(): RefreshTokenPair {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return sha256Hex(token);
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function newFamilyId(): string {
  return randomUUID();
}
