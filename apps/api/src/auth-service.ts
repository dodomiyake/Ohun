import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import type { ApiEnv, LoginRequest, PasswordChangeRequest, RegisterRequest } from '@ohun/contracts';
import { EmailVerificationChallenge, PasswordResetToken, Profile, RefreshToken, SecurityEvent, Session, User, VerificationThrottle } from './models.js';
import type { EmailProvider } from './providers.js';
import {
  type PasswordBlocklist,
  hashPassword,
  isExpired,
  matchesTokenHash,
  normalizeDeviceName,
  opaqueToken,
  signAccessToken,
  tokenHash,
  validatePassword,
  verificationCode,
  verifyPassword,
} from './security.js';
import { InvalidSessionError, RefreshReplayError, revokeRefreshFamily, revokeSession, rotateRefreshToken } from './refresh-rotation.js';

export class AuthError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

export interface AuthServiceDependencies {
  env: ApiEnv;
  email: EmailProvider;
  blocklist: PasswordBlocklist;
  now?: () => Date;
}

const normalizeEmail = (value: string) => value.normalize('NFKC').toLocaleLowerCase('en-US');
const normalizeUsername = (value: string) => value.normalize('NFKC').toLocaleLowerCase('en-US');
const publicUser = (user: { _id: unknown; email: string; username: string; emailVerifiedAt?: Date | null }) => ({
  id: String(user._id), email: user.email, username: user.username, emailVerified: Boolean(user.emailVerifiedAt),
});

export function createAuthService({ env, email, blocklist, now: getNow = () => new Date() }: AuthServiceDependencies) {
  const hmacMaster = new TextEncoder().encode(env.TOKEN_HMAC_MASTER);
  const jwtSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

  async function createChallenge(userId: mongoose.Types.ObjectId, address: string) {
    const now = getNow();
    const throttle = await VerificationThrottle.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId }, $set: { lastSentAt: now }, $inc: { sendCount: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: false },
    );
    if (throttle.lockedUntil && throttle.lockedUntil > now) throw new AuthError(429, 'verification_locked', 'Verification is temporarily locked.');
    if (throttle.sendWindowStartedAt && now.getTime() - throttle.sendWindowStartedAt.getTime() < 3_600_000 && throttle.sendCount > 5) {
      throw new AuthError(429, 'verification_rate_limited', 'Too many verification requests.');
    }
    if (!throttle.sendWindowStartedAt || now.getTime() - throttle.sendWindowStartedAt.getTime() >= 3_600_000) {
      throttle.sendWindowStartedAt = now; throttle.sendCount = 1; await throttle.save();
    }

    const link = opaqueToken();
    const code = verificationCode();
    await EmailVerificationChallenge.updateMany({ userId, consumedAt: null }, { $set: { consumedAt: now } });
    await EmailVerificationChallenge.create({
      userId,
      linkHash: tokenHash(hmacMaster, 'verifyLink', link),
      codeHash: tokenHash(hmacMaster, 'verifyCode', code),
      codeExpiresAt: new Date(now.getTime() + env.EMAIL_VERIFICATION_CODE_TTL_SECONDS * 1000),
      expiresAt: new Date(now.getTime() + env.EMAIL_VERIFICATION_LINK_TTL_SECONDS * 1000),
    });
    await email.send({ to: address, subject: 'Verify your Ohun account', text: `Verification code: ${code}\nVerification token: ${link}` });
  }

  async function register(input: RegisterRequest) {
    await validatePassword(input.password, blocklist);
    const emailNormalized = normalizeEmail(input.email);
    const usernameNormalized = normalizeUsername(input.username);
    if (await User.exists({ $or: [{ emailNormalized }, { usernameNormalized }] })) {
      throw new AuthError(409, 'account_unavailable', 'An account with that email or username cannot be created.');
    }
    try {
      const user = await User.create({ email: input.email.normalize('NFKC'), emailNormalized, username: input.username.normalize('NFKC'), usernameNormalized, passwordHash: await hashPassword(input.password) });
      await createChallenge(user._id, user.email);
      return { ok: true as const, verificationRequired: true as const };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      if (typeof error === 'object' && error && 'code' in error && error.code === 11000) throw new AuthError(409, 'account_unavailable', 'An account with that email or username cannot be created.');
      throw error;
    }
  }

  async function consumeChallenge(challengeId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId) {
    const now = getNow();
    const consumed = await EmailVerificationChallenge.updateOne({ _id: challengeId, consumedAt: null, expiresAt: { $gt: now } }, { $set: { consumedAt: now } });
    if (consumed.modifiedCount !== 1) throw new AuthError(400, 'verification_invalid', 'The verification credential is invalid or expired.');
    await User.updateOne({ _id: userId, emailVerifiedAt: null }, { $set: { emailVerifiedAt: now } });
    await VerificationThrottle.updateOne({ userId }, { $set: { failedAttempts: 0 }, $unset: { lockedUntil: 1, windowStartedAt: 1 } });
    return { ok: true as const };
  }

  async function verifyLink(rawToken: string) {
    const now = getNow();
    const challenge = await EmailVerificationChallenge.findOne({ linkHash: tokenHash(hmacMaster, 'verifyLink', rawToken), consumedAt: null, expiresAt: { $gt: now } });
    if (!challenge) throw new AuthError(400, 'verification_invalid', 'The verification credential is invalid or expired.');
    return consumeChallenge(challenge._id, challenge.userId);
  }

  async function verifyCode(address: string, code: string) {
    const now = getNow();
    const user = await User.findOne({ emailNormalized: normalizeEmail(address) });
    if (!user) throw new AuthError(400, 'verification_invalid', 'The verification credential is invalid or expired.');
    const throttle = await VerificationThrottle.findOne({ userId: user._id });
    if (throttle?.lockedUntil && throttle.lockedUntil > now) throw new AuthError(429, 'verification_locked', 'Verification is temporarily locked.');
    const challenge = await EmailVerificationChallenge.findOne({ userId: user._id, consumedAt: null, expiresAt: { $gt: now }, codeExpiresAt: { $gt: now } }).sort({ createdAt: -1 });
    if (!challenge || !matchesTokenHash(hmacMaster, 'verifyCode', code, challenge.codeHash)) {
      const nextAttempts = (throttle?.failedAttempts ?? 0) + 1;
      const update: Record<string, unknown> = { failedAttempts: nextAttempts, windowStartedAt: throttle?.windowStartedAt ?? now };
      if (nextAttempts >= env.EMAIL_VERIFICATION_MAX_ATTEMPTS) update.lockedUntil = new Date(now.getTime() + env.EMAIL_VERIFICATION_LOCK_SECONDS * 1000);
      await VerificationThrottle.updateOne({ userId: user._id }, { $set: update }, { upsert: true });
      throw new AuthError(nextAttempts >= env.EMAIL_VERIFICATION_MAX_ATTEMPTS ? 429 : 400, 'verification_invalid', 'The verification credential is invalid or expired.');
    }
    return consumeChallenge(challenge._id, user._id);
  }

  async function resend(address: string) {
    const user = await User.findOne({ emailNormalized: normalizeEmail(address) });
    if (user && !user.emailVerifiedAt) await createChallenge(user._id, user.email);
    return { ok: true as const };
  }

  async function login(input: LoginRequest) {
    const normalized = input.identifier.normalize('NFKC').toLocaleLowerCase('en-US');
    const user = await User.findOne({ $or: [{ emailNormalized: normalized }, { usernameNormalized: normalized }] }).select('+passwordHash');
    if (!user || !(await verifyPassword(user.passwordHash, input.password))) throw new AuthError(401, 'invalid_credentials', 'Email/username or password is incorrect.');
    if (!user.emailVerifiedAt) throw new AuthError(403, 'verification_required', 'Email verification is required.');
    const now = getNow();
    const familyId = randomUUID();
    const absoluteExpiresAt = new Date(now.getTime() + env.SESSION_NATIVE_ABSOLUTE_SECONDS * 1000);
    const idleExpiresAt = new Date(Math.min(absoluteExpiresAt.getTime(), now.getTime() + env.SESSION_NATIVE_IDLE_SECONDS * 1000));
    const rawRefresh = opaqueToken();
    const session = await Session.create({ userId: user._id, familyId, platform: 'native', deviceName: normalizeDeviceName(input.device.name), absoluteExpiresAt, idleExpiresAt, lastUsedAt: now });
    await RefreshToken.create({ sessionId: session._id, userId: user._id, familyId, tokenHash: tokenHash(hmacMaster, 'refresh', rawRefresh), expiresAt: absoluteExpiresAt });
    const accessToken = await signAccessToken({ sub: String(user._id), sid: String(session._id), jti: randomUUID() }, jwtSecret, env.JWT_ISSUER, env.JWT_AUDIENCE, env.ACCESS_TOKEN_TTL_SECONDS);
    return { accessToken, refreshToken: rawRefresh, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS, user: publicUser(user) };
  }

  async function refresh(rawRefresh: string) {
    const now = getNow();
    const nextRefresh = opaqueToken();
    const currentHash = tokenHash(hmacMaster, 'refresh', rawRefresh);
    const current = await RefreshToken.findOne({ tokenHash: currentHash }).select('expiresAt');
    if (!current) throw new AuthError(401, 'refresh_invalid', 'The session could not be refreshed.');
    try {
      const rotated = await rotateRefreshToken({
        tokenHash: currentHash,
        successorHash: tokenHash(hmacMaster, 'refresh', nextRefresh),
        successorExpiresAt: current.expiresAt,
        now,
        lastUsedThrottleMs: env.SESSION_LAST_USED_THROTTLE_SECONDS * 1000,
        idleLifetimeMs: env.SESSION_NATIVE_IDLE_SECONDS * 1000,
      });
      const user = await User.findById(rotated.userId);
      if (!user) {
        await revokeSession(rotated.sessionId, 'user_missing', now);
        throw new AuthError(401, 'refresh_invalid', 'The session could not be refreshed.');
      }
      const accessToken = await signAccessToken({ sub: rotated.userId, sid: rotated.sessionId, jti: randomUUID() }, jwtSecret, env.JWT_ISSUER, env.JWT_AUDIENCE, env.ACCESS_TOKEN_TTL_SECONDS);
      return { accessToken, refreshToken: nextRefresh, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS, user: publicUser(user) };
    } catch (error) {
      if (error instanceof RefreshReplayError) throw new AuthError(401, 'refresh_reused', 'This session has been revoked. Sign in again.');
      if (error instanceof InvalidSessionError) throw new AuthError(401, 'refresh_invalid', 'The session could not be refreshed.');
      throw error;
    }
  }

  async function logout(rawRefresh?: string, accessToken?: string) {
    let sessionId: string | undefined;
    if (rawRefresh) {
      const record = await RefreshToken.findOne({ tokenHash: tokenHash(hmacMaster, 'refresh', rawRefresh) }).select('sessionId');
      sessionId = record ? String(record.sessionId) : undefined;
    }
    if (!sessionId && accessToken) {
      try { sessionId = (await authenticate(accessToken)).sessionId; } catch { /* logout remains idempotent */ }
    }
    if (sessionId) await revokeSession(sessionId, 'logout', getNow());
    return { ok: true as const };
  }

  async function requestPasswordReset(address: string) {
    const user = await User.findOne({ emailNormalized: normalizeEmail(address) });
    if (!user) return { ok: true as const };
    const now = getNow();
    const rawToken = opaqueToken();
    await PasswordResetToken.updateMany({ userId: user._id, usedAt: null }, { $set: { usedAt: now } });
    await PasswordResetToken.create({ userId: user._id, tokenHash: tokenHash(hmacMaster, 'reset', rawToken), expiresAt: new Date(now.getTime() + env.PASSWORD_RESET_TTL_SECONDS * 1000) });
    await email.send({ to: user.email, subject: 'Reset your Ohun password', text: `Open Ohun to reset your password: ohun://reset-password?token=${rawToken}` });
    return { ok: true as const };
  }

  async function confirmPasswordReset(rawToken: string, newPassword: string) {
    await validatePassword(newPassword, blocklist);
    const newHash = await hashPassword(newPassword);
    const now = getNow();
    let userId: string | undefined;
    await mongoose.connection.transaction(async (transaction) => {
      const reset = await PasswordResetToken.findOne({ tokenHash: tokenHash(hmacMaster, 'reset', rawToken), usedAt: null, expiresAt: { $gt: now } }).session(transaction);
      if (!reset) throw new AuthError(400, 'reset_invalid', 'The password-reset link is invalid or expired.');
      const consumed = await PasswordResetToken.updateOne({ _id: reset._id, usedAt: null }, { $set: { usedAt: now } }, { session: transaction });
      if (consumed.modifiedCount !== 1) throw new AuthError(400, 'reset_invalid', 'The password-reset link is invalid or expired.');
      const changed = await User.updateOne({ _id: reset.userId }, { $set: { passwordHash: newHash } }, { session: transaction });
      if (changed.matchedCount !== 1) throw new AuthError(400, 'reset_invalid', 'The password-reset link is invalid or expired.');
      await Session.updateMany({ userId: reset.userId, revokedAt: null }, { $set: { revokedAt: now, revokeReason: 'password_reset' } }, { session: transaction });
      await RefreshToken.updateMany({ userId: reset.userId, revokedAt: null }, { $set: { revokedAt: now, revokeReason: 'password_reset' } }, { session: transaction });
      userId = String(reset.userId);
    });
    if (userId) await recordSecurityEvent(userId, 'password_reset', { reason: 'password_reset' });
    return { ok: true as const };
  }

  async function changePassword(identity: { userId: string; sessionId: string }, input: PasswordChangeRequest) {
    await validatePassword(input.newPassword, blocklist);
    const nextHash = await hashPassword(input.newPassword);
    const nextRefresh = opaqueToken();
    const now = getNow();
    const presentedHash = tokenHash(hmacMaster, 'refresh', input.refreshToken);
    let userForResponse: { _id: unknown; email: string; username: string; emailVerifiedAt?: Date | null } | undefined;
    try { await mongoose.connection.transaction(async (transaction) => {
      const user = await User.findById(identity.userId).select('+passwordHash').session(transaction);
      if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) throw new AuthError(401, 'current_password_invalid', 'The current password is incorrect.');
      const current = await RefreshToken.findOne({ tokenHash: presentedHash, sessionId: identity.sessionId, userId: identity.userId }).session(transaction);
      if (!current) throw new AuthError(401, 'refresh_invalid', 'The session could not be refreshed.');
      if (current.usedAt) throw new RefreshReplayError('Refresh credential was already consumed');
      if (current.revokedAt || isExpired(current.expiresAt, now)) throw new AuthError(401, 'refresh_invalid', 'The session could not be refreshed.');
      const session = await Session.findOne({ _id: identity.sessionId, userId: identity.userId, revokedAt: null, absoluteExpiresAt: { $gt: now }, idleExpiresAt: { $gt: now } }).session(transaction);
      if (!session) throw new AuthError(401, 'session_invalid', 'Authentication is required.');
      const consumed = await RefreshToken.updateOne({ _id: current._id, usedAt: null, revokedAt: null }, { $set: { usedAt: now } }, { session: transaction });
      if (consumed.modifiedCount !== 1) throw new AuthError(401, 'refresh_invalid', 'The session could not be refreshed.');
      await RefreshToken.create([{ sessionId: session._id, userId: user._id, familyId: current.familyId, tokenHash: tokenHash(hmacMaster, 'refresh', nextRefresh), parentTokenId: current._id, expiresAt: current.expiresAt }], { session: transaction });
      await User.updateOne({ _id: user._id }, { $set: { passwordHash: nextHash } }, { session: transaction });
      const otherSessions = await Session.find({ userId: user._id, _id: { $ne: session._id }, revokedAt: null }).select('_id').session(transaction);
      const otherIds = otherSessions.map((item) => item._id);
      if (otherIds.length) {
        await Session.updateMany({ _id: { $in: otherIds } }, { $set: { revokedAt: now, revokeReason: 'password_changed' } }, { session: transaction });
        await RefreshToken.updateMany({ sessionId: { $in: otherIds }, revokedAt: null }, { $set: { revokedAt: now, revokeReason: 'password_changed' } }, { session: transaction });
      }
      userForResponse = user;
    }); } catch (error) {
      if (error instanceof RefreshReplayError) {
        const replayed = await RefreshToken.findOne({ tokenHash: presentedHash }).select('familyId');
        if (replayed) await revokeRefreshFamily(replayed.familyId, 'refresh_reuse_detected', now);
        throw new AuthError(401, 'refresh_reused', 'This session has been revoked. Sign in again.');
      }
      throw error;
    }
    if (!userForResponse) throw new Error('Password change transaction produced no user');
    await recordSecurityEvent(identity.userId, 'password_changed', { sessionId: identity.sessionId, reason: 'password_changed' });
    const accessToken = await signAccessToken({ sub: identity.userId, sid: identity.sessionId, jti: randomUUID() }, jwtSecret, env.JWT_ISSUER, env.JWT_AUDIENCE, env.ACCESS_TOKEN_TTL_SECONDS);
    return { accessToken, refreshToken: nextRefresh, expiresIn: env.ACCESS_TOKEN_TTL_SECONDS, user: publicUser(userForResponse) };
  }

  async function recordSecurityEvent(userId: string, type: string, metadata: Record<string, string>) {
    try { await SecurityEvent.create({ userId, type, metadata, occurredAt: getNow() }); }
    catch { console.error(`[api] security event persistence failed: ${type}`); }
  }

  async function authenticate(token: string) {
    const { verifyAccessToken } = await import('./security.js');
    const claims = await verifyAccessToken(token, jwtSecret, env.JWT_ISSUER, env.JWT_AUDIENCE);
    const now = getNow();
    const session = await Session.findOne({ _id: claims.sid, userId: claims.sub, revokedAt: null });
    if (!session || isExpired(session.absoluteExpiresAt, now) || isExpired(session.idleExpiresAt, now)) throw new AuthError(401, 'session_invalid', 'Authentication is required.');
    return { userId: String(claims.sub), sessionId: String(claims.sid) };
  }

  async function me(userId: string) {
    const [user, profile] = await Promise.all([User.findById(userId), Profile.findOne({ userId })]);
    if (!user) throw new AuthError(401, 'session_invalid', 'Authentication is required.');
    return { user: publicUser(user), profile: profile ? { displayName: profile.displayName, bio: profile.bio, status: profile.status, ...(profile.avatarKey ? { avatarKey: profile.avatarKey } : {}) } : null };
  }

  return { register, resend, verifyCode, verifyLink, login, refresh, logout, requestPasswordReset, confirmPasswordReset, changePassword, authenticate, me };
}

export type AuthService = ReturnType<typeof createAuthService>;
