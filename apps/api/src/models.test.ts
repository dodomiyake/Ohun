import { describe, expect, it } from 'vitest';
import { EmailVerificationChallenge, Profile, RefreshToken, SecurityEvent, Session, User, VerificationThrottle } from './models.js';

describe('M2 model ownership and indexes', () => {
  it('owns username only on User', () => { expect(User.schema.path('username')).toBeDefined(); expect(Profile.schema.path('username')).toBeUndefined(); });
  it('does not select password hashes by default', () => { expect(User.schema.path('passwordHash').options.select).toBe(false); });
  it('separates sessions from refresh tokens', () => { expect(Session.schema.path('refreshTokenHash')).toBeUndefined(); expect(RefreshToken.schema.path('sessionId')).toBeDefined(); expect(RefreshToken.schema.path('tokenHash')).toBeDefined(); });
  it('defines unique identity and token indexes', () => { expect(User.schema.indexes()).toEqual(expect.arrayContaining([[{ emailNormalized: 1 }, expect.objectContaining({ unique: true })], [{ usernameNormalized: 1 }, expect.objectContaining({ unique: true })]])); expect(RefreshToken.schema.indexes()).toEqual(expect.arrayContaining([[{ tokenHash: 1 }, expect.objectContaining({ unique: true })]])); });
  it('defines cleanup TTL indexes without relying on them for validity', () => { expect(RefreshToken.schema.indexes()).toEqual(expect.arrayContaining([[{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })]])); expect(EmailVerificationChallenge.schema.indexes()).toEqual(expect.arrayContaining([[{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })]])); });
  it('keeps verification throttle separate from challenges', () => { expect(VerificationThrottle.schema.path('userId')).toBeDefined(); expect(VerificationThrottle.schema.path('failedAttempts')).toBeDefined(); });
  it('rejects unknown security-event metadata', () => { const event = new SecurityEvent({ userId: '507f1f77bcf86cd799439011', type: 'session.revoked', metadata: { password: 'forbidden' } }); expect(event.validateSync()?.message).toContain('unknown field'); });
});
