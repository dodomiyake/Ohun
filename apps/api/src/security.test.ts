import { describe, expect, it } from 'vitest';
import { MemoryPasswordBlocklist, hashPassword, isExpired, normalizeDeviceName, opaqueToken, signAccessToken, tokenHash, validatePassword, verificationCode, verifyAccessToken, verifyPassword } from './security.js';
import { MemoryEmailProvider, assertNonProductionProvider } from './providers.js';

const secret = new TextEncoder().encode('0123456789abcdef0123456789abcdef');

describe('M2 security primitives', () => {
  it('accepts spaces and Unicode without trimming', async () => { await expect(validatePassword('  correct horse 🔒 battery', new MemoryPasswordBlocklist())).resolves.toBeUndefined(); });
  it('rejects short and overlong passwords', async () => { await expect(validatePassword('too short', new MemoryPasswordBlocklist())).rejects.toThrow(); await expect(validatePassword('x'.repeat(129), new MemoryPasswordBlocklist())).rejects.toThrow(); });
  it('rejects blocklisted passwords', async () => { await expect(validatePassword('correct horse battery', new MemoryPasswordBlocklist(new Set(['correct horse battery'])))).rejects.toThrow('blocked'); });
  it('hashes and verifies with Argon2id', async () => { const value = 'long Unicode password 🔒'; const digest = await hashPassword(value); expect(digest).toContain('$argon2id$'); await expect(verifyPassword(digest, value)).resolves.toBe(true); });
  it('creates 256-bit opaque tokens and six digit codes', () => { expect(Buffer.from(opaqueToken(), 'base64url')).toHaveLength(32); expect(verificationCode()).toMatch(/^\d{6}$/); });
  it('normalises and limits client-supplied device names', () => { expect(normalizeDeviceName('\u0000  Phone  ')).toBe('Phone'); expect(normalizeDeviceName('x'.repeat(100))).toHaveLength(80); });
  it('separates HMAC purposes', () => { expect(tokenHash(secret, 'refresh', 'same')).not.toBe(tokenHash(secret, 'reset', 'same')); });
  it('signs and verifies pinned access JWT claims', async () => { const token = await signAccessToken({ sub: 'u', sid: 's', jti: 'j' }, secret, 'issuer', 'audience', 60); const claims = await verifyAccessToken(token, secret, 'issuer', 'audience'); expect(claims).toMatchObject({ sub: 'u', sid: 's', jti: 'j', typ: 'access' }); await expect(verifyAccessToken(token, secret, 'wrong', 'audience')).rejects.toThrow(); });
  it('enforces expiry in application logic', () => { expect(isExpired(new Date(0))).toBe(true); expect(isExpired(new Date(Date.now() + 60_000))).toBe(false); });
  it('captures email only in process and guards production adapters', async () => { const provider = new MemoryEmailProvider(); await provider.send({ to: 'user@example.test', subject: 'Verify', text: 'secret' }); expect(provider.messages).toHaveLength(1); expect(() => assertNonProductionProvider('production', 'memory')).toThrow(); });
});
