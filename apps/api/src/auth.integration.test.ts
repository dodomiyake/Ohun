import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { loadEnv } from './env.js';
import { MemoryEmailProvider } from './providers.js';
import { MemoryPasswordBlocklist } from './security.js';
import { EmailVerificationChallenge, PasswordResetToken, RefreshToken, SecurityEvent, Session, User, VerificationThrottle } from './models.js';

const env = loadEnv({
  NODE_ENV: 'test', PORT: '5000', CLIENT_ORIGIN: 'http://localhost:5173', MONGO_URI: '',
  JWT_ACCESS_SECRET: '0123456789abcdef0123456789abcdef',
  TOKEN_HMAC_MASTER: 'abcdef0123456789abcdef0123456789',
  EMAIL_VERIFICATION_MAX_ATTEMPTS: '5', EMAIL_VERIFICATION_LOCK_SECONDS: '1800',
});

describe('M2.2 mobile-first authentication', () => {
  let replica: MongoMemoryReplSet | undefined;
  const email = new MemoryEmailProvider();
  let app = createApp(env, { email, blocklist: new MemoryPasswordBlocklist() });

  beforeAll(async () => {
    const configuredUri = process.env.MONGO_TEST_URI;
    if (configuredUri) await mongoose.connect(configuredUri);
    else {
      replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ dbPath: undefined }] });
      await mongoose.connect(replica.getUri('ohun_auth_test'));
    }
    await Promise.all(Object.values(mongoose.connection.models).map((model) => model.syncIndexes()));
  }, 60_000);
  beforeEach(async () => { await mongoose.connection.dropDatabase(); email.messages.length = 0; app = createApp(env, { email, blocklist: new MemoryPasswordBlocklist() }); await Promise.all(Object.values(mongoose.connection.models).map((model) => model.syncIndexes())); }, 30_000);
  afterAll(async () => { await mongoose.disconnect(); await replica?.stop(); });

  async function register(address = 'person@example.test', username = 'person') {
    return request(app).post('/api/v1/auth/register').send({ email: address, username, password: 'correct horse battery 🔒' });
  }

  it('registers minimally, verifies once, logs in, and returns /me', async () => {
    const registration = await register();
    expect(registration.status).toBe(201);
    expect(registration.body).toEqual({ ok: true, verificationRequired: true });
    expect(registration.text).not.toContain('passwordHash');
    const code = email.messages[0]?.text.match(/Verification code: (\d{6})/)?.[1];
    expect(code).toMatch(/^\d{6}$/);

    const verification = await request(app).post('/api/v1/auth/verification/code').send({ email: 'person@example.test', code });
    expect(verification.status).toBe(200);
    expect(await User.findOne({ emailNormalized: 'person@example.test', emailVerifiedAt: { $ne: null } })).not.toBeNull();
    expect(await EmailVerificationChallenge.countDocuments({ consumedAt: null })).toBe(0);

    const replay = await request(app).post('/api/v1/auth/verification/code').send({ email: 'person@example.test', code });
    expect(replay.status).toBe(400);

    const login = await request(app).post('/api/v1/auth/login').send({ identifier: 'PERSON', password: 'correct horse battery 🔒', device: { platform: 'native', name: '\u0000  My Phone  ' } });
    expect(login.status).toBe(200);
    expect(login.body.refreshToken).toBeTypeOf('string');
    expect(login.body.accessToken).toBeTypeOf('string');
    expect(await Session.findOne({ deviceName: 'My Phone', platform: 'native' })).not.toBeNull();
    expect(await RefreshToken.countDocuments()).toBe(1);
    expect(JSON.stringify(await RefreshToken.findOne())).not.toContain(login.body.refreshToken);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ user: { email: 'person@example.test', username: 'person', emailVerified: true }, profile: null });
  });

  it('uses a generic identity conflict and does not issue sessions before verification', async () => {
    expect((await register()).status).toBe(201);
    const conflict = await register('PERSON@example.test', 'different');
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.message).toBe('An account with that email or username cannot be created.');
    const login = await request(app).post('/api/v1/auth/login').send({ identifier: 'person', password: 'correct horse battery 🔒', device: { platform: 'native', name: 'Phone' } });
    expect(login.status).toBe(403);
    expect(await Session.countDocuments()).toBe(0);
  });

  it('keeps failed verification attempts across resend and locks at five', async () => {
    await register();
    for (let attempt = 0; attempt < 2; attempt += 1) await request(app).post('/api/v1/auth/verification/code').send({ email: 'person@example.test', code: '999999' });
    await request(app).post('/api/v1/auth/verification/resend').send({ email: 'person@example.test' });
    const user = await User.findOne({ emailNormalized: 'person@example.test' });
    expect((await VerificationThrottle.findOne({ userId: user?._id }))?.failedAttempts).toBe(2);
    let response;
    for (let attempt = 0; attempt < 3; attempt += 1) response = await request(app).post('/api/v1/auth/verification/code').send({ email: 'person@example.test', code: '999999' });
    expect(response?.status).toBe(429);
    expect((await VerificationThrottle.findOne({ userId: user?._id }))?.lockedUntil).toBeInstanceOf(Date);
  });

  it('allows link verification and invalidates its sibling code', async () => {
    await register();
    const message = email.messages[0]?.text ?? '';
    const link = message.match(/Verification token: (\S+)/)?.[1];
    const code = message.match(/Verification code: (\d{6})/)?.[1];
    expect((await request(app).post('/api/v1/auth/verification/link').send({ token: link })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/verification/code').send({ email: 'person@example.test', code })).status).toBe(400);
  });

  it('rotates native refresh credentials once and revokes the family on replay', async () => {
    await register();
    const code = email.messages[0]?.text.match(/Verification code: (\d{6})/)?.[1];
    await request(app).post('/api/v1/auth/verification/code').send({ email: 'person@example.test', code });
    const login = await request(app).post('/api/v1/auth/login').send({ identifier: 'person', password: 'correct horse battery 🔒', device: { platform: 'native', name: 'Phone' } });

    const refreshed = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);
    expect(await RefreshToken.countDocuments()).toBe(2);

    const replay = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('refresh_reused');
    expect((await Session.findOne())?.revokeReason).toBe('refresh_reuse_detected');
    expect(await RefreshToken.countDocuments({ revokedAt: { $ne: null } })).toBe(2);
  });

  it('logs out with a refresh credential after the access token is unavailable', async () => {
    await register();
    const code = email.messages[0]?.text.match(/Verification code: (\d{6})/)?.[1];
    await request(app).post('/api/v1/auth/verification/code').send({ email: 'person@example.test', code });
    const login = await request(app).post('/api/v1/auth/login').send({ identifier: 'person', password: 'correct horse battery 🔒', device: { platform: 'native', name: 'Phone' } });

    expect((await request(app).post('/api/v1/auth/logout').send({ refreshToken: login.body.refreshToken })).body).toEqual({ ok: true });
    expect((await Session.findOne())?.revokeReason).toBe('logout');
    expect((await RefreshToken.findOne())?.revokeReason).toBe('logout');
    expect((await request(app).post('/api/v1/auth/logout').send({ refreshToken: login.body.refreshToken })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: login.body.refreshToken })).status).toBe(401);
  });

  it('resets a password once, returns a generic request response, and revokes every session', async () => {
    expect((await request(app).post('/api/v1/auth/password/reset/request').send({ email: 'missing@example.test' })).body).toEqual({ ok: true });
    await register();
    const code = email.messages[0]?.text.match(/Verification code: (\d{6})/)?.[1];
    await request(app).post('/api/v1/auth/verification/code').send({ email: 'person@example.test', code });
    await request(app).post('/api/v1/auth/login').send({ identifier: 'person', password: 'correct horse battery 🔒', device: { platform: 'native', name: 'Phone' } });

    const requested = await request(app).post('/api/v1/auth/password/reset/request').send({ email: 'person@example.test' });
    expect(requested.body).toEqual({ ok: true });
    const resetToken = email.messages.at(-1)?.text.match(/token=([^\s]+)/)?.[1];
    expect(resetToken).toBeTypeOf('string');
    expect(JSON.stringify(await PasswordResetToken.findOne())).not.toContain(resetToken);

    const confirmed = await request(app).post('/api/v1/auth/password/reset/confirm').send({ token: resetToken, newPassword: 'a new password phrase 🔐' });
    expect(confirmed.body).toEqual({ ok: true });
    expect((await Session.findOne())?.revokeReason).toBe('password_reset');
    expect((await RefreshToken.findOne())?.revokeReason).toBe('password_reset');
    expect((await request(app).post('/api/v1/auth/password/reset/confirm').send({ token: resetToken, newPassword: 'another password phrase 🔐' })).status).toBe(400);
    expect((await request(app).post('/api/v1/auth/login').send({ identifier: 'person', password: 'a new password phrase 🔐', device: { platform: 'native', name: 'Phone' } })).status).toBe(200);
    expect(await SecurityEvent.countDocuments({ type: 'password_reset' })).toBe(1);
  });

  it('changes a password, rotates the current credential, and revokes other sessions', async () => {
    await register();
    const code = email.messages[0]?.text.match(/Verification code: (\d{6})/)?.[1];
    await request(app).post('/api/v1/auth/verification/code').send({ email: 'person@example.test', code });
    const current = await request(app).post('/api/v1/auth/login').send({ identifier: 'person', password: 'correct horse battery 🔒', device: { platform: 'native', name: 'Current phone' } });
    const other = await request(app).post('/api/v1/auth/login').send({ identifier: 'person', password: 'correct horse battery 🔒', device: { platform: 'native', name: 'Other phone' } });

    const changed = await request(app).post('/api/v1/auth/password/change').set('Authorization', `Bearer ${current.body.accessToken}`).send({ currentPassword: 'correct horse battery 🔒', newPassword: 'my replacement password 🔐', refreshToken: current.body.refreshToken });
    expect(changed.status).toBe(200);
    expect(changed.body.refreshToken).not.toBe(current.body.refreshToken);
    expect((await Session.findOne({ deviceName: 'Other phone' }))?.revokeReason).toBe('password_changed');
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: other.body.refreshToken })).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: changed.body.refreshToken })).status).toBe(200);
    expect(await SecurityEvent.countDocuments({ type: 'password_changed' })).toBe(1);
  });
});
