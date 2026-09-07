import { hash, verify, type Algorithm } from '@node-rs/argon2';
import { createHmac, hkdfSync, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export interface PasswordBlocklist { contains(password: string): Promise<boolean>; }
export class MemoryPasswordBlocklist implements PasswordBlocklist { constructor(private readonly values = new Set<string>()) {} async contains(password: string) { return this.values.has(password); } }
export async function validatePassword(password: string, blocklist: PasswordBlocklist): Promise<void> { const length = Array.from(password).length; if (length < 15 || length > 128) throw new Error('Password must contain 15–128 Unicode characters'); if (await blocklist.contains(password)) throw new Error('Password is blocked'); }
export function hashPassword(password: string) { return hash(password, { algorithm: 2 as Algorithm, memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 }); }
export function verifyPassword(passwordHash: string, password: string) { return verify(passwordHash, password); }
export function opaqueToken() { return randomBytes(32).toString('base64url'); }
export function verificationCode() { return randomInt(0, 1_000_000).toString().padStart(6, '0'); }
export function normalizeDeviceName(value: string) { return Array.from(value.normalize('NFKC')).filter((character) => { const code = character.codePointAt(0) ?? 0; return code > 31 && code !== 127; }).join('').trim().slice(0, 80) || 'Unknown device'; }
const contexts = { refresh: 'ohun-refresh-v1', verifyLink: 'ohun-verify-link-v1', verifyCode: 'ohun-verify-code-v1', reset: 'ohun-reset-v1', ip: 'ohun-ip-correlation-v1' } as const;
export type HmacPurpose = keyof typeof contexts;
export function derivePurposeKey(master: Uint8Array, purpose: HmacPurpose): Buffer { return Buffer.from(hkdfSync('sha256', master, new Uint8Array(), contexts[purpose], 32)); }
export function tokenHash(master: Uint8Array, purpose: HmacPurpose, value: string) { return createHmac('sha256', derivePurposeKey(master, purpose)).update(value, 'utf8').digest('base64url'); }
export function matchesTokenHash(master: Uint8Array, purpose: HmacPurpose, value: string, expected: string) {
  const actualBytes = Buffer.from(tokenHash(master, purpose, value), 'base64url');
  const expectedBytes = Buffer.from(expected, 'base64url');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
export interface AccessClaims { sub: string; sid: string; jti: string; }
export async function signAccessToken(claims: AccessClaims, secret: Uint8Array, issuer: string, audience: string, ttlSeconds: number) { return new SignJWT({ sid: claims.sid, typ: 'access' }).setProtectedHeader({ alg: 'HS256' }).setSubject(claims.sub).setJti(claims.jti).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime(`${ttlSeconds}s`).sign(secret); }
export async function verifyAccessToken(token: string, secret: Uint8Array, issuer: string, audience: string) { const result = await jwtVerify(token, secret, { algorithms: ['HS256'], issuer, audience }); if (result.payload.typ !== 'access' || typeof result.payload.sid !== 'string' || !result.payload.jti || !result.payload.sub) throw new Error('Invalid access token claims'); return result.payload; }
export function isExpired(value: Date, now = new Date()) { return value.getTime() <= now.getTime(); }
