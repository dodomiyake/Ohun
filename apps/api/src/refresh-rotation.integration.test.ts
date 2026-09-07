import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RefreshToken, Session, User } from './models.js';
import { RefreshReplayError, rotateRefreshToken } from './refresh-rotation.js';

let replicaSet: MongoMemoryReplSet;
let databaseDirectory: string | undefined;

async function seed(tokenHash = 'current-token') {
  const now = new Date();
  const user = await User.create({ email: `${tokenHash}@example.test`, emailNormalized: `${tokenHash}@example.test`, username: tokenHash, usernameNormalized: tokenHash, passwordHash: 'not-used-in-this-test' });
  const session = await Session.create({ userId: user._id, familyId: `family-${tokenHash}`, platform: 'web', deviceName: 'Test browser', absoluteExpiresAt: new Date(now.getTime() + 86_400_000), idleExpiresAt: new Date(now.getTime() + 3_600_000), lastUsedAt: new Date(now.getTime() - 600_000) });
  const refresh = await RefreshToken.create({ sessionId: session._id, userId: user._id, familyId: session.familyId, tokenHash, expiresAt: new Date(now.getTime() + 3_600_000) });
  return { session, refresh };
}

describe('refresh rotation transaction', () => {
  beforeAll(async () => {
    const injectedUri = process.env.MONGO_TEST_URI?.trim();
    if (injectedUri) {
      await mongoose.connect(injectedUri);
    } else {
      // WiredTiger requires filesystem operations that are not guaranteed on
      // checked-out workspace/overlay mounts. Use the native temp volume.
      databaseDirectory = await mkdtemp(join(tmpdir(), 'ohun-mongo-test-'));
      replicaSet = await MongoMemoryReplSet.create({ binary: { version: '7.0.14' }, instanceOpts: [{ dbPath: databaseDirectory }], replSet: { count: 1, storageEngine: 'wiredTiger' } });
      await mongoose.connect(replicaSet.getUri());
    }
    await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  }, 120_000);

  afterEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((collection) => collection.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (replicaSet) await replicaSet.stop();
    if (databaseDirectory) await rm(databaseDirectory, { recursive: true, force: true });
  });

  it('consumes one token and creates exactly one child', async () => {
    const { refresh } = await seed();
    const result = await rotateRefreshToken({ tokenHash: 'current-token', successorHash: 'successor', successorExpiresAt: new Date(Date.now() + 3_600_000), lastUsedThrottleMs: 300_000, idleLifetimeMs: 3_600_000 });
    expect(result.sessionId).toBe(String(refresh.sessionId));
    expect(await RefreshToken.countDocuments({ parentTokenId: refresh._id })).toBe(1);
    expect((await RefreshToken.findById(refresh._id))?.usedAt).toBeInstanceOf(Date);
  });

  it('cannot issue two successors under concurrent rotation', async () => {
    const { refresh } = await seed('concurrent');
    const common = { tokenHash: 'concurrent', successorExpiresAt: new Date(Date.now() + 3_600_000), lastUsedThrottleMs: 300_000, idleLifetimeMs: 3_600_000 };
    const outcomes = await Promise.allSettled([rotateRefreshToken({ ...common, successorHash: 'child-a' }), rotateRefreshToken({ ...common, successorHash: 'child-b' })]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(await RefreshToken.countDocuments({ parentTokenId: refresh._id })).toBe(1);
  });

  it('rolls back consumption when successor creation fails', async () => {
    const { refresh } = await seed('rollback');
    await RefreshToken.create({ sessionId: refresh.sessionId, userId: refresh.userId, familyId: refresh.familyId, tokenHash: 'duplicate', expiresAt: new Date(Date.now() + 3_600_000) });
    await expect(rotateRefreshToken({ tokenHash: 'rollback', successorHash: 'duplicate', successorExpiresAt: new Date(Date.now() + 3_600_000), lastUsedThrottleMs: 300_000, idleLifetimeMs: 3_600_000 })).rejects.toThrow();
    expect((await RefreshToken.findById(refresh._id))?.usedAt).toBeNull();
  });

  it('detects replay and revokes the token family', async () => {
    const { session, refresh } = await seed('replay');
    refresh.usedAt = new Date();
    await refresh.save();
    await expect(rotateRefreshToken({ tokenHash: 'replay', successorHash: 'unused', successorExpiresAt: new Date(Date.now() + 3_600_000), lastUsedThrottleMs: 300_000, idleLifetimeMs: 3_600_000 })).rejects.toBeInstanceOf(RefreshReplayError);
    expect((await Session.findById(session._id))?.revokeReason).toBe('refresh_reuse_detected');
  });
});
